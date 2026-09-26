/**
 * Backfill: give every ACTIVE requirement reservation the lot it holds (2026-09-26).
 *
 * From 2026-09-26 each stock_reservations row names its lot (greigeStockId / fabricStockId / laceStockId)
 * and every release gives back to THAT lot (helpers/stock-reservation.helper.ts). Rows written before
 * carry no lot, so the new release/consume code could not return their quantity to a lot. This maps them:
 *
 *   - per material, lots whose quantityReserved is not yet explained by lot-tagged rows are filled in
 *     allocateStock's own order (the requirement's processor first, then FIFO by receivedDate);
 *   - a row spanning several lots is split into one row per lot;
 *   - a row whose requirement is CANCELLED / RECEIVED / gone is then RELEASED (the historical leak);
 *   - whatever cannot be explained is reported for a manual decision, never guessed.
 *
 * Only greige lots are attributed automatically: lace_stock.quantityReserved is also written by the lace
 * allocation flows (the other convention), and fabric has no MRP reservations today — both are reported.
 *
 *   npx ts-node scripts/backfill-reservation-lots.ts            (dry run)
 *   npx ts-node scripts/backfill-reservation-lots.ts --apply
 */

import { Prisma } from '@prisma/client';
import prisma from '../src/config/database';
import { releaseReservations } from '../src/services/helpers/stock-reservation.helper';
import { isQtyZero } from '../src/utils/quantity';

const APPLY = process.argv.includes('--apply');
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const TERMINAL = new Set(['CANCELLED', 'RECEIVED']);

async function main() {
  const legacy = await prisma.stock_reservations.findMany({
    where: {
      status: 'ACTIVE',
      referenceType: 'MATERIAL_REQUIREMENT',
      greigeStockId: null,
      fabricStockId: null,
      laceStockId: null,
    },
    orderBy: { reservedAt: 'asc' },
    include: { materials: { select: { code: true, materialType: true, greigeId: true, fabricId: true, laceId: true } } },
  });
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${legacy.length} ACTIVE requirement reservation(s) with no lot\n`);
  if (legacy.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const requirements = await prisma.material_requirements.findMany({
    where: { id: { in: legacy.map((r) => r.referenceId) } },
    select: { id: true, requirementNumber: true, status: true, processorId: true },
  });
  const reqById = new Map(requirements.map((r) => [r.id, r]));

  type Plan = { rowId: string; lots: Array<{ lotId: string; qty: number }>; unexplained: number; release: boolean };
  const plans: Plan[] = [];
  const reports: string[] = [];

  // Unexplained reserved quantity per greige lot = quantityReserved − held by lot-tagged ACTIVE rows
  const greigeIds = [...new Set(legacy.map((r) => r.materials.greigeId).filter((id): id is string => !!id))];
  const lots = greigeIds.length
    ? await prisma.greige_stock.findMany({
        where: { greigeId: { in: greigeIds }, quantityReserved: { gt: 0 } },
        select: { id: true, greigeId: true, processorId: true, receivedDate: true, quantityReserved: true },
        orderBy: { receivedDate: 'asc' },
      })
    : [];
  const tagged = lots.length
    ? await prisma.stock_reservations.groupBy({
        by: ['greigeStockId'],
        where: { status: 'ACTIVE', greigeStockId: { in: lots.map((l) => l.id) } },
        _sum: { reservedQuantity: true, consumedQuantity: true },
      })
    : [];
  const taggedHeld = new Map(
    tagged.map((t) => [t.greigeStockId!, Number(t._sum.reservedQuantity ?? 0) - Number(t._sum.consumedQuantity ?? 0)])
  );
  const unexplained = new Map(lots.map((l) => [l.id, round3(Number(l.quantityReserved) - (taggedHeld.get(l.id) ?? 0))]));

  for (const row of legacy) {
    const req = reqById.get(row.referenceId);
    const held = round3(Number(row.reservedQuantity) - Number(row.consumedQuantity));
    const release = !req || TERMINAL.has(String(req.status));
    const label = `${row.referenceNumber ?? row.referenceId} (${row.materials.code}, ${held})`;

    if (row.materials.materialType !== 'GREIGE' || !row.materials.greigeId) {
      reports.push(`${label}: ${row.materials.materialType} — not attributed automatically, decide by hand`);
      continue;
    }
    const candidates = lots
      .filter((l) => l.greigeId === row.materials.greigeId && (unexplained.get(l.id) ?? 0) > 0)
      .sort((a, b) => {
        const own = (l: (typeof lots)[number]) => (req?.processorId && l.processorId === req.processorId ? 0 : 1);
        return own(a) - own(b) || a.receivedDate.getTime() - b.receivedDate.getTime();
      });
    let left = held;
    const split: Plan['lots'] = [];
    for (const lot of candidates) {
      if (left <= 0.0005) break;
      const take = round3(Math.min(left, unexplained.get(lot.id) ?? 0));
      if (take <= 0) continue;
      split.push({ lotId: lot.id, qty: take });
      unexplained.set(lot.id, round3((unexplained.get(lot.id) ?? 0) - take));
      left = round3(left - take);
    }
    // Quantity rule (utils/quantity): lots hold 2 decimals, requirements 3 — dust belongs to the last lot
    if (left > 0 && isQtyZero(left) && split.length > 0) {
      split[split.length - 1].qty = round3(split[split.length - 1].qty + left);
      left = 0;
    }
    plans.push({ rowId: row.id, lots: split, unexplained: left, release });
    console.log(
      `${label} → ${split.map((s) => `lot ${s.lotId.slice(0, 8)} ${s.qty}`).join(' + ') || 'no lot'}` +
        (left > 0 ? `  (unexplained ${left})` : '') +
        (release ? `  → RELEASE (requirement ${req ? req.status : 'missing'})` : '')
    );
    if (left > 0) reports.push(`${label}: ${left} could not be matched to a lot's reserved quantity`);
  }

  for (const [lotId, rest] of unexplained) {
    if (!isQtyZero(rest) && rest > 0) {
      reports.push(`greige lot ${lotId}: ${rest} reserved that no requirement reservation explains`);
    }
  }
  if (reports.length) console.log(`\nFor a manual decision:\n  - ${reports.join('\n  - ')}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      if (plan.lots.length === 0) continue;
      const row = legacy.find((r) => r.id === plan.rowId)!;
      const [first, ...rest] = plan.lots;
      await tx.stock_reservations.update({
        where: { id: row.id },
        data: {
          greigeStockId: first.lotId,
          reservedQuantity: new Prisma.Decimal(round3(first.qty + Number(row.consumedQuantity))),
        },
      });
      for (const extra of rest) {
        await tx.stock_reservations.create({
          data: {
            materialId: row.materialId,
            warehouseId: row.warehouseId,
            reservationType: row.reservationType,
            referenceType: row.referenceType,
            referenceId: row.referenceId,
            referenceNumber: row.referenceNumber,
            reservedQuantity: new Prisma.Decimal(extra.qty),
            unit: row.unit,
            status: 'ACTIVE',
            reservedById: row.reservedById,
            reservedAt: row.reservedAt,
            remarks: `Split from ${row.id} by backfill-reservation-lots`,
            greigeStockId: extra.lotId,
          },
        });
      }
      if (plan.release) await releaseReservations(tx, [row.referenceId]);
    }
  });
  console.log('\nApplied. Re-run without --apply: it should find nothing left to do.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
