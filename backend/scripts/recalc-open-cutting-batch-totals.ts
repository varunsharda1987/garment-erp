/**
 * Recompute the lay totals of OPEN cutting batches through recalculateBatchTotals (2026-09-28).
 *
 * The lay rule changed (controllers/cutting.utils.ts → layCoverage). A lay saved for a batch cut from ONE
 * fabric carries no per-lot link, and was counted on no lot: the lot's "used in lays" stayed 0, so the
 * completion's Return to Store offered the whole issue back (CB-WO2609-0088-003, 1,707.3 m). In a batch of
 * several fabrics, a fabric with two lots was counted twice. These totals are derived — every lay save
 * recomputes them — so this only brings open batches up to the new rule without waiting for their next lay.
 *
 * Dry run by default: each batch is recomputed inside a transaction that is then rolled back, printing
 * before → after. `--apply` commits. No stock moves: only cutting_batches.fabricConsumed and
 * cutting_batch_fabrics.fabricConsumed change.
 *
 *   cd backend && npx ts-node scripts/recalc-open-cutting-batch-totals.ts [--apply]
 */
import prisma from '../src/config/database';
import { recalculateBatchTotals } from '../src/controllers/cutting.utils';

const APPLY = process.argv.includes('--apply');

class RolledBack extends Error {}

const snapshot = (tx: typeof prisma, batchId: string) =>
  tx.cutting_batches.findUniqueOrThrow({
    where: { id: batchId },
    select: {
      fabricConsumed: true,
      additionalFabrics: {
        select: {
          id: true,
          fabricConsumed: true,
          fabricStock: { select: { fabricMaster: { select: { fabricCode: true } } } },
        },
        orderBy: { id: 'asc' },
      },
    },
  });

async function main() {
  const batches = await prisma.cutting_batches.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] }, lays: { some: {} } },
    select: { id: true, batchNumber: true, status: true },
    orderBy: { batchNumber: 'asc' },
  });
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${batches.length} open batch(es) with lays\n`);

  for (const b of batches) {
    let lines: string[] = [];
    try {
      await prisma.$transaction(async (tx) => {
        const before = await snapshot(tx as typeof prisma, b.id);
        await recalculateBatchTotals(tx, b.id);
        const after = await snapshot(tx as typeof prisma, b.id);
        lines = [
          `${b.batchNumber} (${b.status}): batch ${Number(before.fabricConsumed)} m → ${Number(after.fabricConsumed)} m`,
          ...after.additionalFabrics.map((af) => {
            const was = before.additionalFabrics.find((x) => x.id === af.id);
            const code = af.fabricStock?.fabricMaster?.fabricCode ?? af.id;
            return `   lot ${code}: used in lays ${Number(was?.fabricConsumed ?? 0)} m → ${Number(af.fabricConsumed)} m`;
          }),
        ];
        if (!APPLY) throw new RolledBack();
      });
    } catch (err) {
      if (!(err instanceof RolledBack)) throw err;
    }
    console.log(lines.join('\n'));
  }
  if (!APPLY) console.log('\nNothing written. Re-run with --apply to save.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
