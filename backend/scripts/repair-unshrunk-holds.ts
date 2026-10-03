/**
 * Give back what orders no longer need — the holds MRP left at the old quantity (2026-10-03).
 *
 * Until shrinkRequirementToNeed, an order that needed LESS of a committed requirement only got `surplusQty`
 * written on it: its PO link and receipt hold stayed at the old quantity, so goods sat held for an order that
 * no longer needs them (ESSKY091LS: S 525 → 336, 189 Main Cum Size Labels held for nothing). This applies the
 * new rule to every such row: the requirement, its link and its hold come down by the surplus, and the line is
 * recomputed so the freed goods fill the next order in line (or become free stock).
 *
 * Only rows MRP itself would now shrink: a MATERIAL requirement on a PO link, not on job work or a challan, not
 * part of a split. Everything else is listed and left as it is.
 *
 * Usage:
 *   cd backend && npx ts-node --files scripts/repair-unshrunk-holds.ts            # dry run (default)
 *   cd backend && npx ts-node --files scripts/repair-unshrunk-holds.ts --apply    # writes; snapshot JSON first
 */
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { shrinkRequirementToNeed } from '../src/services/helpers/po-allocation.helper';

const APPLY = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.material_requirements.findMany({
    where: { surplusQty: { gt: 0 }, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      requirementNumber: true,
      status: true,
      requirementType: true,
      totalRequired: true,
      surplusQty: true,
      allocatedFromStock: true,
      splitFromId: true,
      createdById: true,
      materials: { select: { code: true } },
      orders: { select: { orderNumber: true } },
      requirement_po_links: {
        select: { id: true, purchaseOrderItemId: true, allocatedQuantity: true, receivedQuantity: true, fillOrder: true },
      },
      _count: { select: { requirement_jwo_links: true, challanItems: true, splitChildren: true } },
    },
    orderBy: { requirementNumber: 'asc' },
  });

  const fixable = rows.filter(
    (r) =>
      r.requirementType === 'MATERIAL' &&
      r.requirement_po_links.length > 0 &&
      r._count.requirement_jwo_links === 0 &&
      r._count.challanItems === 0 &&
      r.splitFromId === null &&
      r._count.splitChildren === 0
  );

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — requirements carrying a surplus:`);
  if (rows.length === 0) console.log('  none');
  for (const r of rows) {
    const ok = fixable.includes(r);
    const total = Number(r.totalRequired);
    const surplus = Number(r.surplusQty);
    console.log(
      `  ${r.requirementNumber}  ${r.orders?.orderNumber ?? '-'}  ${r.materials.code}  ${r.status}  ` +
        `${total} → ${ok ? total - surplus : 'LEFT AS IS'} (surplus ${surplus})` +
        (ok ? '' : `  [${r.requirementType}, ${r._count.requirement_jwo_links} job, ${r._count.challanItems} challan]`)
    );
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${fixable.length} requirement(s) would come down. Re-run with --apply.`);
    return;
  }

  // Snapshot what is about to change: the rows, their links, and every link and hold on the same PO lines
  const itemIds = [...new Set(fixable.flatMap((r) => r.requirement_po_links.map((l) => l.purchaseOrderItemId)))];
  const snapshot = {
    takenAt: new Date().toISOString(),
    requirements: fixable,
    lineLinks: await prisma.requirement_po_links.findMany({ where: { purchaseOrderItemId: { in: itemIds } } }),
    lineHolds: await prisma.stock_reservations.findMany({
      where: { poLink: { purchaseOrderItemId: { in: itemIds } } },
    }),
  };
  const file = path.join(__dirname, `repair-unshrunk-holds-snapshot-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot: ${file}`);

  for (const r of fixable) {
    const target = Number(r.totalRequired) - Number(r.surplusQty);
    const result = await prisma.$transaction(
      (tx) => shrinkRequirementToNeed(tx, r.id, target, r.createdById),
      { timeout: 60000, maxWait: 10000 }
    );
    console.log(`  ${r.requirementNumber}: down ${result.shrunk}${result.stuck > 0 ? `, ${result.stuck} could not come down` : ''}`);
  }
  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
