/**
 * Backfill job_work_orders rows where jwoStatus IS NULL (legacy-only creates).
 *
 * Before the 2026-08-22 fix, two flows (dyeing/printing lab-dip) set only the legacy
 * `status` column. This script backfills `jwoStatus` from the legacy column so the
 * column can be made NOT NULL and eventually the legacy column dropped.
 *
 * Reverse mapping (legacy → jwoStatus):
 *   LAB_DIP_PENDING | LAB_DIP_SUBMITTED | LAB_DIP_APPROVED | READY_TO_SEND
 *       → sentDate ? 'ISSUED' : 'DRAFT'
 *   SENT_TO_MILL | AT_MILL → 'ISSUED'
 *   RECEIVED → 'RECEIVED'
 *   QUALITY_CHECKED → 'QUALITY_CHECKED'
 *   STOCK_UPDATED → 'STOCK_UPDATED'
 *   CANCELLED → 'CANCELLED'
 *
 * Granularity note: legacy didn't distinguish IN_TRANSIT vs AT_PROCESSOR — both map
 * to ISSUED (the common ancestor). This is intentional.
 *
 *   npx ts-node scripts/backfill-jwo-status.ts           # dry-run (default)
 *   npx ts-node scripts/backfill-jwo-status.ts --apply   # write
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { JobWorkStatus, JobWorkOrderStatus } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

/**
 * Reverse mapping: legacy status → jwoStatus.
 * Returns a function that takes sentDate to disambiguate pre-issue states.
 */
function mapLegacyToJwoStatus(
  legacy: JobWorkStatus,
  sentDate: Date | null
): JobWorkOrderStatus {
  switch (legacy) {
    case 'LAB_DIP_PENDING':
    case 'LAB_DIP_SUBMITTED':
    case 'LAB_DIP_APPROVED':
    case 'READY_TO_SEND':
      return sentDate ? 'ISSUED' : 'DRAFT';
    case 'SENT_TO_MILL':
    case 'AT_MILL':
      return 'ISSUED';
    case 'RECEIVED':
      return 'RECEIVED';
    case 'QUALITY_CHECKED':
      return 'QUALITY_CHECKED';
    case 'STOCK_UPDATED':
      return 'STOCK_UPDATED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      // Exhaustiveness check — if new values added to enum, compiler will catch
      const _exhaustive: never = legacy;
      throw new Error(`Unmapped legacy status: ${_exhaustive}`);
  }
}

async function main() {
  const rows = await prisma.job_work_orders.findMany({
    where: { jwoStatus: null },
    select: {
      id: true,
      jobWorkNumber: true,
      status: true,
      sentDate: true,
    },
  });

  console.log(`JWOs with jwoStatus NULL: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  for (const r of rows) {
    const newJwoStatus = mapLegacyToJwoStatus(r.status, r.sentDate);
    console.log(
      `  ${r.jobWorkNumber}: legacy ${r.status} → jwoStatus ${newJwoStatus}${r.sentDate ? ' (has sentDate)' : ''}`
    );
    if (APPLY) {
      await prisma.job_work_orders.update({
        where: { id: r.id },
        data: { jwoStatus: newJwoStatus },
      });
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
