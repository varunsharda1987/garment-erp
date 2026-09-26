/**
 * One-time conversion: greige received STRAIGHT into a processor's unit before such deliveries were
 * booked as held there (direct-to-processor plan, Phase 2 step 6 — C:\Users\NEW\.claude\plans\
 * we-have-recently-made-wondrous-volcano.md).
 *
 * In Aug-2026 GRN2608-0071..0075 booked greige into the Mangal, Shree Bhavya and Aryan units as if it
 * were in our store: no holder, no challan. So the dyers' Processor Statements showed none of it,
 * ITC-04 missed it, and a job there raised a second "dispatch" challan from "Main Warehouse" for
 * cloth that never moved. This books each such lot the way a GRN approval into a unit now does
 * (grn.service resolveDirectDelivery + helpers/direct-supply-challan.helper.ts, the one writer):
 *
 *  - the lot becomes HELD by the unit's processor (sourceType DIRECT). It does not move: it was on
 *    the ledger at the unit before and stays there;
 *  - ONE Rule 45 challan per GRN covers what is still lying there. Owner decision (25-Sep-2026): late
 *    challans are dated TODAY, with the day the processor received the goods noted, and the one-year
 *    clock runs from that day (expectedDate = receipt + 1 year);
 *  - metres already used went out on the jobs' own challans at the time. Those are KEPT (owner: Aryan
 *    keeps CH2609-0056 / CH2609-0144), and only those jobs' Section 143 due dates are corrected to a
 *    year from the day the processor got the cloth — logged in audit_logs and the job's remarks.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/backfill-direct-delivery.ts                 # preview (default): writes nothing
 *   npx ts-node scripts/backfill-direct-delivery.ts --apply         # writes, one transaction per GRN
 *   ... --user <email>   issuing user (default admin@kasya.in)
 *
 * Idempotent: a lot that already has a holder, or a GRN that already has its direct-supply challan,
 * is skipped. Aborts a GRN's transaction if the stock ledger and derived_stock_view disagree at the
 * unit afterwards. Needs the owner's OK (and the CA's on the ITC-04 treatment) before --apply.
 */
import { randomUUID } from 'crypto';
import { Unit } from '@prisma/client';
import prisma from '../src/config/database';
import greigeStockService from '../src/services/greige-stock.service';
import { createDirectSupplyChallanInTx } from '../src/services/helpers/direct-supply-challan.helper';
import { formatDate } from '../src/utils/date';
import { isQtyZero } from '../src/utils/quantity';

const APPLY = process.argv.includes('--apply');
const userArg = process.argv.indexOf('--user');
const USER_EMAIL = userArg > 0 ? process.argv[userArg + 1] : 'admin@kasya.in';

const yearAfter = (d: Date) => {
  const due = new Date(d);
  due.setFullYear(due.getFullYear() + 1); // the same arithmetic as calculateStatutoryDueDate
  return due;
};
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function ledgerVsDerived(
  client: Pick<typeof prisma, '$queryRawUnsafe'>,
  materialId: string,
  warehouseId: string
): Promise<{ ledger: number; derived: number }> {
  const [ledger] = await client.$queryRawUnsafe<{ q: number | null }[]>(
    `SELECT COALESCE(SUM(quantity), 0)::float q FROM stock_levels WHERE "materialId" = $1 AND "warehouseId" = $2`,
    materialId,
    warehouseId
  );
  const [derived] = await client.$queryRawUnsafe<{ q: number | null }[]>(
    `SELECT COALESCE(SUM(quantity), 0)::float q FROM derived_stock_view WHERE "materialId" = $1 AND "warehouseId" = $2`,
    materialId,
    warehouseId
  );
  return { ledger: Number(ledger?.q ?? 0), derived: Number(derived?.q ?? 0) };
}

async function main() {
  const user = await prisma.users.findFirst({ where: { email: USER_EMAIL }, select: { id: true, email: true } });
  if (!user) throw new Error(`No user ${USER_EMAIL} — pass --user <email>`);
  const today = new Date();

  // Lots in a processor's unit that no holder has been booked on (TRANSFER shadows excluded)
  const lots = await prisma.greige_stock.findMany({
    where: {
      processorId: null,
      warehouse: { warehouseType: 'JOB_WORK', supplierId: { not: null } },
      OR: [{ sourceType: null }, { sourceType: { not: 'TRANSFER' } }],
    },
    select: {
      id: true,
      greigeId: true,
      warehouseId: true,
      quantityAvailable: true,
      quantityConsumed: true,
      quantityReserved: true,
      receivedDate: true,
      purchaseCost: true,
      foldLengthCm: true,
      greige: { select: { greigeCode: true, greigeName: true } },
      warehouse: { select: { warehouseName: true, supplierId: true, supplier: { select: { name: true } } } },
      grnItem: {
        select: {
          goods_receiving_notes: {
            select: {
              id: true,
              grnNumber: true,
              receivingDate: true,
              invoiceNumber: true,
              invoiceDate: true,
              supplierId: true,
              suppliers: { select: { name: true } },
            },
          },
          purchase_order_items: { select: { unitPrice: true } },
        },
      },
    },
    orderBy: { receivedDate: 'asc' },
  });

  console.log(`\n${APPLY ? 'APPLY' : 'PREVIEW — nothing is written'} · issuing user ${user.email} · today ${formatDate(today)}\n`);
  if (lots.length === 0) {
    console.log('No greige lot sits in a processor unit without a holder. Nothing to convert.');
    return;
  }

  // One challan per GRN, as a live approval raises
  type Lot = (typeof lots)[number];
  const byGrn = new Map<string, Lot[]>();
  for (const lot of lots) {
    const grn = lot.grnItem?.goods_receiving_notes;
    if (!grn) {
      console.log(`  SKIP ${lot.greige?.greigeCode} in ${lot.warehouse?.warehouseName}: no GRN behind it — review by hand.`);
      continue;
    }
    byGrn.set(grn.id, [...(byGrn.get(grn.id) ?? []), lot]);
  }

  let challans = 0;
  let clockFixes = 0;
  let declaredTotal = 0;
  for (const [grnId, grnLots] of byGrn) {
    const grn = grnLots[0].grnItem!.goods_receiving_notes!;
    const processorId = grnLots[0].warehouse!.supplierId!;
    const processorName = grnLots[0].warehouse!.supplier?.name ?? grnLots[0].warehouse!.warehouseName;
    const supplierName = grn.suppliers?.name ?? 'the supplier';
    const receivedOn = grnLots[0].receivedDate;

    console.log(`${grn.grnNumber} · ${supplierName} → ${processorName} · received by the dyer ${formatDate(receivedOn)}`);
    if (grn.supplierId && grn.supplierId === processorId) {
      console.log(`  SKIP: ${processorName} is both supplier and processor — not supported yet (Phase 4g).\n`);
      continue;
    }
    const existing = await prisma.challans.findFirst({
      where: { directSupplyGrnId: grnId, status: { not: 'CANCELLED' } },
      select: { challanNumber: true },
    });
    if (existing) {
      console.log(`  SKIP: already covered by ${existing.challanNumber}.\n`);
      continue;
    }

    // What is still lying there is what the new challan covers; what was used went out on job challans
    const lines = grnLots
      .filter((lot) => !isQtyZero(Number(lot.quantityAvailable)))
      .map((lot) => {
        const rate = Number(lot.purchaseCost ?? lot.grnItem?.purchase_order_items?.unitPrice ?? 0);
        return {
          itemType: 'GREIGE' as const,
          greigeStockId: lot.id,
          quantity: Number(lot.quantityAvailable),
          unit: Unit.METER,
          rate,
          ...(lot.foldLengthCm ? { foldLengthCm: Number(lot.foldLengthCm) } : {}),
          description: `${lot.greige?.greigeCode ?? 'Greige'} — ${lot.greige?.greigeName ?? 'greige'}`,
        };
      });
    for (const lot of grnLots) {
      const avail = Number(lot.quantityAvailable);
      const used = Number(lot.quantityConsumed ?? 0);
      const rate = Number(lot.purchaseCost ?? lot.grnItem?.purchase_order_items?.unitPrice ?? 0);
      declaredTotal += avail * rate;
      console.log(
        `  lot ${lot.greige?.greigeCode} · still there ${avail} m${used ? ` · already used ${used} m` : ''} · ` +
          `rate ₹${rate}/m → held by ${processorName}${isQtyZero(avail) ? ' (nothing left to cover)' : ''}`
      );
    }

    // Jobs that used these lots: keep their challans, correct only their one-year clock
    const lotIds = grnLots.map((l) => l.id);
    const jobs = await prisma.job_work_orders.findMany({
      where: { greigeStockLotId: { in: lotIds }, jwoStatus: { not: 'CANCELLED' } },
      select: {
        id: true,
        jobWorkNumber: true,
        statutoryDueDate: true,
        remarks: true,
        outwardChallan: { select: { challanNumber: true } },
      },
    });
    const due = yearAfter(receivedOn);
    const clockJobs = jobs.filter((j) => j.statutoryDueDate && j.statutoryDueDate.getTime() > due.getTime());
    for (const j of jobs) {
      const fix = clockJobs.includes(j);
      console.log(
        `  job ${j.jobWorkNumber} (challan ${j.outwardChallan?.challanNumber ?? '—'}, kept) · Section 143 due ` +
          `${ymd(j.statutoryDueDate)}${fix ? ` → ${ymd(due)}` : ' (already right)'}`
      );
    }
    const usedNote = jobs.length
      ? ` Covers what is still lying there; the rest went out on ${jobs
          .map((j) => j.outwardChallan?.challanNumber)
          .filter(Boolean)
          .join(', ')}.`
      : '';
    const note =
      `Issued late on ${formatDate(today)} (one-time conversion): the goods were booked at ${grnLots[0].warehouse!.warehouseName} ` +
      `on receipt without a challan.${usedNote}`;
    if (lines.length > 0) {
      challans++;
      console.log(
        `  NEW challan: OUTWARD, "Supplied directly by ${supplierName}" → ${processorName}, dated ${formatDate(today)}, ` +
          `${lines.length} line(s), ${lines.reduce((s, l) => s + l.quantity, 0)} m, return by ${formatDate(due)}`
      );
    }
    clockFixes += clockJobs.length;
    console.log('');

    if (!APPLY) continue;

    const materialWarehouses = [...new Set(grnLots.map((l) => `${l.greigeId}|${l.warehouseId}`))].map((k) => {
      const [materialId, warehouseId] = k.split('|');
      return { materialId, warehouseId };
    });

    await prisma.$transaction(
      async (tx) => {
        await greigeStockService.bookHeldAtProcessor(lotIds, processorId, tx);
        if (lines.length > 0) {
          const challan = await createDirectSupplyChallanInTx(tx, {
            grnId,
            grnNumber: grn.grnNumber,
            supplierId: grn.supplierId ?? null,
            supplierName,
            processorId,
            processorName,
            invoiceNumber: grn.invoiceNumber ?? null,
            invoiceDate: grn.invoiceDate ?? null,
            receivedOn,
            challanDate: today,
            lines,
            userId: user.id,
            note,
          });
          console.log(`  → ${challan.challanNumber} issued`);
        }
        for (const j of clockJobs) {
          const correction =
            `[S143 CLOCK CORRECTED ${formatDate(today)}] the cloth was at ${processorName} from ${formatDate(receivedOn)} ` +
            `(${grn.grnNumber}), so the one-year return period runs from then: due ${formatDate(due)}, not ` +
            `${formatDate(j.statutoryDueDate)}. Challan ${j.outwardChallan?.challanNumber ?? '—'} kept.`;
          await tx.job_work_orders.update({
            where: { id: j.id },
            data: { statutoryDueDate: due, remarks: j.remarks ? `${j.remarks}\n${correction}` : correction },
          });
          await tx.audit_logs.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              action: 'S143_CLOCK_CORRECTED',
              entityType: 'job_work_orders',
              entityId: j.id,
              oldValues: { statutoryDueDate: j.statutoryDueDate },
              newValues: { statutoryDueDate: due, reason: 'backfill-direct-delivery' },
            },
          });
          console.log(`  → ${j.jobWorkNumber} due ${ymd(due)}`);
        }
        // The lots did not move: the ledger and the derived view must still agree at the unit
        for (const { materialId, warehouseId } of materialWarehouses) {
          const { ledger, derived } = await ledgerVsDerived(tx, materialId, warehouseId);
          if (Math.abs(ledger - derived) > 0.01) {
            throw new Error(`${grn.grnNumber}: ledger ${ledger} ≠ derived ${derived} at the unit — rolled back`);
          }
        }
      },
      { timeout: 30000 }
    );
  }

  console.log(
    `${APPLY ? 'Done' : 'Would do'}: ${challans} challan(s), declared ₹${declaredTotal.toFixed(2)}, ` +
      `${clockFixes} job clock correction(s).`
  );
  if (!APPLY) console.log('Preview only — nothing written. Re-run with --apply once the owner (and CA) agree.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
