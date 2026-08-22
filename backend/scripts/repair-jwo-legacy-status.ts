/**
 * Reconcile job_work_orders' legacy `status` column with `jwoStatus` (landmine №1).
 *
 * Before the 2026-08-22 fix, several flows wrote only one of the two status columns, so a
 * cancelled job could keep legacy READY_TO_SEND and stay on the receivable/"at processor"
 * lists forever. All writers now go through services/helpers/jwo-status.helper.ts; this
 * one-time repair brings historical rows in line with that helper's mapping.
 *
 * Rows where jwoStatus is NULL (legacy-only creates) are left untouched — the gates handle
 * NULL explicitly. Rows whose mapping is `null` (PARTIALLY_RECEIVED, CLOSED) are also left
 * untouched by design.
 *
 *   npx ts-node scripts/repair-jwo-legacy-status.ts           # dry-run (default)
 *   npx ts-node scripts/repair-jwo-legacy-status.ts --apply   # write
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { JWO_TO_LEGACY_STATUS } from '../src/services/helpers/jwo-status.helper';

const APPLY = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.job_work_orders.findMany({
    where: { jwoStatus: { not: null } },
    select: { id: true, jobWorkNumber: true, status: true, jwoStatus: true },
  });

  const drifted = rows.filter((r) => {
    const expected = JWO_TO_LEGACY_STATUS[r.jwoStatus!];
    return expected !== null && r.status !== expected;
  });

  console.log(`JWOs with jwoStatus set: ${rows.length}; legacy column drifted: ${drifted.length}`);
  for (const r of drifted) {
    const expected = JWO_TO_LEGACY_STATUS[r.jwoStatus!]!;
    console.log(`  ${r.jobWorkNumber}: legacy ${r.status} -> ${expected} (jwoStatus ${r.jwoStatus})`);
    if (APPLY) {
      await prisma.job_work_orders.update({ where: { id: r.id }, data: { status: expected } });
    }
  }
  console.log(APPLY ? 'Applied.' : 'Dry run — pass --apply to write.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
