/**
 * Settle the MRP requirements of job work colours that were finished before finishing settled them (2026-10-03).
 *
 * A colour whose final delivery was in, or that was closed short, left its requirements PARTIALLY_RECEIVED — "still
 * on order" for ever (MR2609-0534 on DJ-ESSKY075LS-001: 3,683.2 of 3,700 m; MR2609-0256 on PJ-ESSKY082LS-001:
 * 1,893.5 of 1,941.2 m). This runs the one rule the receipt, reversal and Close short now run —
 * resettleJobRequirements (helpers/jwo-requirement-settle.helper.ts) — on every job with a finished line.
 *
 *   npx ts-node --files scripts/repair-jwo-requirement-settle.ts            # dry run: lists what would change
 *   npx ts-node --files scripts/repair-jwo-requirement-settle.ts --apply    # writes a snapshot first
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { resettleJobRequirements, type SettleOutcome } from '../src/services/helpers/jwo-requirement-settle.helper';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, `repair-jwo-requirement-settle-snapshot-${Date.now()}.json`);

class DryRun extends Error {}

async function main() {
  const jobs = await prisma.job_work_orders.findMany({
    where: { lines: { some: { closedAt: { not: null } } }, jwoStatus: { not: 'CANCELLED' } },
    select: { id: true, jobWorkNumber: true },
    orderBy: { jobWorkNumber: 'asc' },
  });

  const found: Array<{ job: string; outcomes: SettleOutcome[] }> = [];
  for (const job of jobs) {
    let outcomes: SettleOutcome[] = [];
    try {
      await prisma.$transaction(async (tx) => {
        outcomes = await resettleJobRequirements(tx, job.id);
        if (!APPLY) throw new DryRun();
      });
    } catch (err) {
      if (!(err instanceof DryRun)) throw err;
    }
    if (outcomes.length) found.push({ job: job.jobWorkNumber, outcomes });
  }

  if (found.length === 0) {
    console.log(`Nothing to settle — ${jobs.length} job(s) with a finished colour checked.`);
    return;
  }
  for (const { job, outcomes } of found) {
    for (const o of outcomes) {
      console.log(
        `${APPLY ? 'settled ' : 'would  '} ${job}  ${o.requirementNumber}  ${o.change}` +
          (o.short != null ? `  — ${o.short} m short` : '  — in full')
      );
    }
  }
  if (APPLY) {
    fs.writeFileSync(SNAPSHOT, JSON.stringify({ appliedAt: new Date().toISOString(), found }, null, 2));
    console.log(`\nApplied. Record: ${SNAPSHOT}`);
  } else {
    console.log('\nDry run — nothing written. Re-run with --apply.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
