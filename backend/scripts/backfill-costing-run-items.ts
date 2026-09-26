/**
 * Give every costing run saved before 2026-09-26 its own record (fabric_costing_run_items).
 *
 * Until then a run was only the CAD rows pointing at it (fabric_width_cad.costingRunId), so there is
 * no record of what an older run was saved with. The best that exists is what its rows say today:
 * this freezes that, with `backfilled = true` so the run's detail says the figures were recorded
 * later. Runs whose rows all moved on (or were cleared) have nothing to record and stay empty.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/backfill-costing-run-items.ts            # dry run (default)
 *   cd backend && npx ts-node scripts/backfill-costing-run-items.ts --apply    # writes, in one transaction
 *
 * Only runs with NO items are touched, so it is safe to re-run.
 */
import prisma from '../src/config/database';
import { freezeRunItems } from '../src/services/helpers/costing-run-items.helper';

const APPLY = process.argv.includes('--apply');

async function main() {
  const runs = await prisma.fabric_costing_run.findMany({
    where: { items: { none: {} } },
    select: {
      id: true,
      runName: true,
      purpose: true,
      style: { select: { styleCode: true } },
      fabricCads: { select: { id: true }, orderBy: [{ componentName: 'asc' }, { cutableWidth: 'asc' }] },
    },
    orderBy: [{ styleId: 'asc' }, { runNumber: 'asc' }],
  });

  const withRows = runs.filter((r) => r.fabricCads.length > 0);
  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — costing runs without their own record: ${runs.length}`);
  for (const r of runs) {
    console.log(
      `  ${r.style.styleCode.padEnd(14)} ${r.purpose.padEnd(24)} ${r.runName.padEnd(8)} ` +
        (r.fabricCads.length ? `${r.fabricCads.length} fabric(s) to record` : 'no fabric rows left — stays empty')
    );
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${withRows.length} run(s) would be recorded. Re-run with --apply.`);
    return;
  }

  let lines = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of withRows) {
      lines += await freezeRunItems(
        tx,
        r.id,
        r.fabricCads.map((c) => c.id),
        { backfilled: true }
      );
    }
  });
  console.log(`\nApplied. Recorded ${lines} fabric line(s) across ${withRows.length} run(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
