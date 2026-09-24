/**
 * Repair rounding "dust" left before the one-tolerance rule (utils/quantity.ts, 2026-09-24).
 *
 * A material requirement whose shortfall is > 0 but within QTY_EPSILON (e.g. MR2609-0084: 1,340.722 m
 * required, 1340.72 allocated from a 2-decimal pre-fill, 0.002 m left) reads "Partially from Stock"
 * and sits in the needs-PO lists for millimetres. The fix closes it exactly as allocateStock now
 * would: allocatedFromStock = totalRequired, shortfall = 0, PARTIAL_STOCK → FULFILLED_STOCK.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/repair-quantity-dust.ts            # dry run (default): lists only
 *   cd backend && npx ts-node scripts/repair-quantity-dust.ts --apply    # writes, in one transaction
 *
 * Only rows whose remainder is dust are touched; the other dust families found by the audit
 * (challans, lace issue notes, send-outs) are LISTED here for review, not changed.
 */
import prisma from '../src/config/database';
import { QTY_EPSILON } from '../src/utils/quantity';

const APPLY = process.argv.includes('--apply');

async function main() {
  const requirements = await prisma.material_requirements.findMany({
    where: { shortfall: { gt: 0, lt: QTY_EPSILON }, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      requirementNumber: true,
      status: true,
      totalRequired: true,
      allocatedFromStock: true,
      shortfall: true,
      unit: true,
    },
    orderBy: { requirementNumber: 'asc' },
  });

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — material requirements with a dust shortfall (< ${QTY_EPSILON}):`);
  if (requirements.length === 0) console.log('  none');
  const toFix = requirements.filter((r) => r.status === 'PARTIAL_STOCK' || r.status === 'FULFILLED_STOCK');
  for (const r of requirements) {
    const fixable = toFix.includes(r);
    console.log(
      `  ${r.requirementNumber}  ${r.status}  required ${r.totalRequired}  allocated ${r.allocatedFromStock}  ` +
        `shortfall ${r.shortfall} ${r.unit}  → ${fixable ? 'shortfall 0, FULFILLED_STOCK' : 'LEFT AS IS (status not from stock)'}`
    );
  }

  // Other families: list for review only
  const lotsNearZero = await prisma.$queryRawUnsafe<{ kind: string; n: number }[]>(`
    select 'fabric_stock' kind, count(*)::int n from fabric_stock where "quantityAvailable" > 0 and "quantityAvailable" < ${QTY_EPSILON}
    union all select 'greige_stock', count(*)::int from greige_stock where "quantityAvailable" > 0 and "quantityAvailable" < ${QTY_EPSILON}
    union all select 'lace_stock', count(*)::int from lace_stock where "quantityAvailable" > 0 and "quantityAvailable" < ${QTY_EPSILON}`);
  console.log('\nFor review only (not changed): stock lots holding a dust quantity');
  for (const l of lotsNearZero) console.log(`  ${l.kind}: ${l.n}`);

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${toFix.length} requirement(s) would be closed. Re-run with --apply.`);
    return;
  }

  await prisma.$transaction(
    toFix.map((r) =>
      prisma.material_requirements.update({
        where: { id: r.id },
        data: { allocatedFromStock: r.totalRequired, shortfall: 0, status: 'FULFILLED_STOCK' },
      })
    )
  );
  console.log(`\nApplied — ${toFix.length} requirement(s) closed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
