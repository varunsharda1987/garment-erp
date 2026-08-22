/**
 * Costing-approval invariant sweep (two-owner split, 2026-08-22).
 *
 * fabric_width_cad.approvalStatus = CAD-GEOMETRY approval; costingApprovalStatus (+By/At) =
 * costing PRICE approval. This script verifies the data invariants the split relies on.
 *
 *   npx ts-node scripts/check-phantom-approved-costings.ts --dry-run   (default)
 *   npx ts-node scripts/check-phantom-approved-costings.ts --fix
 *
 * ERROR (fixable with --fix):
 *   E1  costingApprovalStatus set but totalCostPerMeter NULL  -> clear the 3 costing-approval
 *       fields + isPreferred (a price approval cannot exist without a price)
 *   E2  costingApprovalStatus set but costingStyleId NULL     -> backfill costingStyleId from
 *       styleFabric -> style_components.styleId when resolvable, else report for manual review
 * REPORT-ONLY (never auto-fixed — money data needs human eyes):
 *   R1  isLocked PRODUCTION rows with totalCostPerMeter NULL (pre-guard promotions)
 *   R2  totalCostPerMeter set but costingStyleId NULL (orphan cost decoration)
 * INFO (legitimate states, counted for visibility):
 *   I1  approvalStatus APPROVED + totalCostPerMeter NULL ("CAD-approved, not yet costed")
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FIX = process.argv.includes('--fix');

async function main() {
  let errors = 0;

  // E1: price approval without a price
  const e1 = await prisma.fabric_width_cad.findMany({
    where: { costingApprovalStatus: { not: null }, totalCostPerMeter: null },
    select: { id: true, componentName: true, costingApprovalStatus: true, purpose: true },
  });
  errors += e1.length;
  console.log(`E1 costing approval with NULL cost: ${e1.length}`);
  for (const r of e1) {
    console.log(`   ${r.id}  ${r.purpose ?? '-'}  ${r.componentName ?? '-'}  ${r.costingApprovalStatus}`);
    if (FIX) {
      await prisma.fabric_width_cad.update({
        where: { id: r.id },
        data: { costingApprovalStatus: null, costingApprovedBy: null, costingApprovedAt: null, isPreferred: false },
      });
      console.log('   -> cleared costing approval');
    }
  }

  // E2: price approval without a style link
  const e2 = await prisma.fabric_width_cad.findMany({
    where: { costingApprovalStatus: { not: null }, costingStyleId: null },
    select: {
      id: true,
      componentName: true,
      styleFabric: { select: { style_components: { select: { styleId: true } } } },
    },
  });
  errors += e2.length;
  console.log(`E2 costing approval with NULL costingStyleId: ${e2.length}`);
  for (const r of e2) {
    const resolvedStyleId = r.styleFabric?.style_components?.styleId ?? null;
    console.log(`   ${r.id}  ${r.componentName ?? '-'}  resolvable style: ${resolvedStyleId ?? 'NO — manual review'}`);
    if (FIX && resolvedStyleId) {
      await prisma.fabric_width_cad.update({ where: { id: r.id }, data: { costingStyleId: resolvedStyleId } });
      console.log('   -> backfilled costingStyleId');
    }
  }

  // R1: locked PRODUCTION rows without a price (pre-guard promotions)
  const r1 = await prisma.fabric_width_cad.count({
    where: { isLocked: true, purpose: 'PRODUCTION', totalCostPerMeter: null },
  });
  console.log(`R1 locked PRODUCTION rows with NULL cost (report only): ${r1}`);

  // R2: cost decoration without a style link
  const r2 = await prisma.fabric_width_cad.count({
    where: { totalCostPerMeter: { not: null }, costingStyleId: null },
  });
  console.log(`R2 cost set with NULL costingStyleId (report only): ${r2}`);

  // I1: legitimate CAD-approved-not-yet-costed rows
  const i1 = await prisma.fabric_width_cad.count({
    where: { approvalStatus: 'APPROVED', totalCostPerMeter: null },
  });
  console.log(`I1 CAD-approved, not yet costed (legitimate): ${i1}`);

  console.log(FIX ? `\nDone. ${errors} error row(s) processed with --fix.` : `\nDry run. ${errors} error row(s).`);
  process.exitCode = !FIX && errors > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
