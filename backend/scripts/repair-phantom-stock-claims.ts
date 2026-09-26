/**
 * Requirements that say "from stock" without holding it (owner decision 26-Sep-2026: MRP suggests stock, only
 * Use Stock claims it).
 *
 * Until 26-Sep-2026 MRP's calculation set allocatedFromStock / FULFILLED_STOCK / PARTIAL_STOCK from the free
 * stock it saw, but reserved nothing — so two orders could count the same metres (MR2608-0117: 3,271.11 m of
 * GRG-0039 "allocated", the lot showing 0 reserved). The calculation no longer claims stock; this repairs the
 * rows it left behind: a row's allocatedFromStock is cut back to what its reservations really hold (active
 * holds + what was consumed from them), and its status follows (usually back to PO Required — the page then
 * shows "Can Fulfill" and Use Stock).
 *
 * Left alone, because the stock was really used even though no reservation records it:
 *   - greige already sent to the processor (a PROCESSING child with a job past APPROVED — MRP's
 *     GREIGE_SENT_TO_PROCESSOR rule);
 *   - rows received through a challan, or linked to a PO / job work.
 *
 * Dry run by default (it is also the invariant sweep: 0 rows = healthy). `--apply` writes, and saves the old
 * values to repair-phantom-stock-claims-snapshot.json first.
 *
 *   cd backend && npx ts-node scripts/repair-phantom-stock-claims.ts [--apply]
 */

import fs from 'fs';
import path from 'path';
import { MaterialRequirementStatus } from '@prisma/client';
import prisma from '../src/config/database';
import { isQtyZero, qtyRemaining } from '../src/utils/quantity';

const APPLY = process.argv.includes('--apply');
const JOB_NOT_SENT = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'];

async function main() {
  const rows = await prisma.material_requirements.findMany({
    where: {
      status: { in: [MaterialRequirementStatus.FULFILLED_STOCK, MaterialRequirementStatus.PARTIAL_STOCK] },
      allocatedFromStock: { gt: 0 },
    },
    select: {
      id: true,
      requirementNumber: true,
      status: true,
      totalRequired: true,
      allocatedFromStock: true,
      shortfall: true,
      orders: { select: { orderNumber: true } },
      materials: { select: { code: true } },
      _count: { select: { challanItems: true, requirement_po_links: true, requirement_jwo_links: true } },
      childRequirements: {
        select: {
          requirementType: true,
          requirement_jwo_links: { select: { job_work_orders: { select: { jwoStatus: true } } } },
        },
      },
    },
    orderBy: { requirementNumber: 'asc' },
  });

  const fixes: Array<{
    id: string;
    requirementNumber: string;
    before: { status: string; allocatedFromStock: number; shortfall: number };
    after: { status: MaterialRequirementStatus; allocatedFromStock: number; shortfall: number };
  }> = [];

  for (const r of rows) {
    const sentToProcessor = r.childRequirements.some(
      (c) =>
        c.requirementType === 'PROCESSING' &&
        c.requirement_jwo_links.some((l) => !JOB_NOT_SENT.includes(String(l.job_work_orders.jwoStatus)))
    );
    if (sentToProcessor) continue;
    if (r._count.challanItems > 0 || r._count.requirement_po_links > 0 || r._count.requirement_jwo_links > 0) continue;

    const reservations = await prisma.stock_reservations.findMany({
      where: { referenceType: 'MATERIAL_REQUIREMENT', referenceId: r.id, status: { in: ['ACTIVE', 'CONSUMED'] } },
      select: { status: true, reservedQuantity: true, consumedQuantity: true },
    });
    const covered =
      Math.round(
        reservations.reduce(
          (sum, x) =>
            sum +
            Number(x.consumedQuantity) +
            (x.status === 'ACTIVE' ? Math.max(0, Number(x.reservedQuantity) - Number(x.consumedQuantity)) : 0),
          0
        ) * 1000
      ) / 1000;
    const allocated = Number(r.allocatedFromStock);
    if (isQtyZero(allocated - covered) || allocated < covered) continue;

    const total = Number(r.totalRequired);
    const shortfall = qtyRemaining(total, covered);
    const status = isQtyZero(covered)
      ? MaterialRequirementStatus.PO_REQUIRED
      : isQtyZero(shortfall)
        ? MaterialRequirementStatus.FULFILLED_STOCK
        : MaterialRequirementStatus.PARTIAL_STOCK;
    fixes.push({
      id: r.id,
      requirementNumber: r.requirementNumber,
      before: { status: String(r.status), allocatedFromStock: allocated, shortfall: Number(r.shortfall) },
      after: { status, allocatedFromStock: covered, shortfall },
    });
    console.log(
      `${r.requirementNumber} (${r.orders?.orderNumber ?? '—'}, ${r.materials?.code ?? '—'}): ` +
        `${r.status} ${allocated} "from stock", reservations hold ${covered} → ${status}, short ${shortfall}`
    );
  }

  console.log(`\n${fixes.length} requirement(s) claim stock they do not hold.`);
  if (!APPLY || fixes.length === 0) {
    if (fixes.length > 0) console.log('Dry run — nothing written. Re-run with --apply.');
    return;
  }

  const snapshot = path.join(__dirname, 'repair-phantom-stock-claims-snapshot.json');
  fs.writeFileSync(snapshot, JSON.stringify({ at: new Date().toISOString(), fixes }, null, 2));
  await prisma.$transaction(async (tx) => {
    for (const f of fixes) {
      await tx.material_requirements.update({
        where: { id: f.id },
        data: { status: f.after.status, allocatedFromStock: f.after.allocatedFromStock, shortfall: f.after.shortfall },
      });
    }
  });
  console.log(`Applied. Old values saved to ${snapshot}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
