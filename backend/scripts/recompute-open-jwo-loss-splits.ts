/**
 * One-off recompute of the loss split on RECEIVED-but-not-CLOSED job work orders.
 *
 * The pre-2026-08-18 formula measured loss against the greige SENT, so expected process
 * shrinkage was recorded as abnormal loss (e.g. 91.66 m / ₹916.63 debit demanded on a
 * JWO that returned exactly its contracted qty). This re-runs applyLossSplit — identical
 * to a fresh receive — under the corrected expected-output basis.
 *
 * CLOSED orders are untouched (settled on actuals; qtyBillable already overwritten).
 *
 *   npx ts-node scripts/recompute-open-jwo-loss-splits.ts           # dry-run (default)
 *   npx ts-node scripts/recompute-open-jwo-loss-splits.ts --apply   # write
 */
import 'dotenv/config';
import prisma from '../src/config/database';
import { jobWorkOrderService } from '../src/services/job-work-order.service';

async function main() {
  const apply = process.argv.includes('--apply');

  const candidates = await prisma.job_work_orders.findMany({
    where: {
      isActive: true,
      qtyReceivedMeters: { not: null },
      NOT: [{ jwoStatus: { in: ['CLOSED', 'CANCELLED'] } }],
    },
    select: {
      id: true,
      jobWorkNumber: true,
      qtySentMeters: true,
      qtyBillable: true,
      qtyReceivedMeters: true,
      expectedShrinkage: true,
      tolerancePercent: true,
      qtyNormalLoss: true,
      qtyAbnormalLoss: true,
      jwoStatus: true,
      status: true,
      processTypeMaster: { select: { tolerancePercent: true } },
    },
    orderBy: { jobWorkNumber: 'asc' },
  });

  console.log(`Received, not-closed JWOs: ${candidates.length}\n`);
  for (const jwo of candidates) {
    const received = Number(jwo.qtyReceivedMeters);
    const preview = jobWorkOrderService.calculateLossSplit({
      qtySent: Number(jwo.qtySentMeters),
      qtyReceived: received,
      qtyExpected: jwo.qtyBillable != null ? Number(jwo.qtyBillable) : null,
      expectedShrinkagePercent: jwo.expectedShrinkage != null ? Number(jwo.expectedShrinkage) : null,
      tolerancePercent: Number(jwo.tolerancePercent ?? jwo.processTypeMaster?.tolerancePercent ?? 0),
      ratePerMeter: 0,
    });
    console.log(
      `${jwo.jobWorkNumber} [${jwo.jwoStatus ?? jwo.status}] sent ${jwo.qtySentMeters} recv ${received} ` +
        `expected ${preview.qtyExpected.toFixed(2)} | abnormal ${jwo.qtyAbnormalLoss ?? '—'} → ${preview.qtyAbnormalLoss.toFixed(3)} ` +
        `| normal ${jwo.qtyNormalLoss ?? '—'} → ${preview.qtyNormalLoss.toFixed(3)}`
    );
    if (apply) {
      await jobWorkOrderService.applyLossSplit(jwo.id, received);
    }
  }

  console.log(apply ? '\nApplied.' : '\nDry-run — pass --apply to write.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
