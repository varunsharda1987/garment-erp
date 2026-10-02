/**
 * Move samples off the retired IN_PROGRESS / SUBMITTED steps (2026-10-02).
 *
 * Sample steps are now To make (REQUESTED) → Sent → the buyer's verdict (owner): "Start Progress" and
 * "Mark Complete" recorded nothing anyone read, and the API no longer accepts those two statuses. A
 * sample left in one of them is put back to REQUESTED ("To make"), where the menu offers Mark Sent.
 * `completionDate` is left as it was (history only — nothing reads it).
 *
 * Usage:
 *   cd backend && npx ts-node --files scripts/repair-retired-sample-statuses.ts            # dry run
 *   cd backend && npx ts-node --files scripts/repair-retired-sample-statuses.ts --apply    # writes
 *
 * --apply writes scripts/repair-retired-sample-statuses-snapshot.json first (id + old status).
 */
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');

async function main() {
  const samples = await prisma.samples.findMany({
    where: { status: { in: ['IN_PROGRESS', 'SUBMITTED'] } },
    select: {
      id: true,
      sampleNumber: true,
      sampleType: true,
      status: true,
      customers: { select: { name: true } },
      styles: { select: { styleCode: true } }, // allow-style-code: script log line, not a screen
    },
    orderBy: { sampleNumber: 'asc' },
  });

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — samples on a retired step:`);
  if (samples.length === 0) console.log('  none');
  for (const s of samples) {
    console.log(
      `  ${s.sampleNumber}  ${s.sampleType}  ${s.customers?.name ?? ''}  ${s.styles?.styleCode ?? ''}  ${s.status} → REQUESTED`
    );
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${samples.length} sample(s) would move to To make. Re-run with --apply.`);
    return;
  }

  const snapshotPath = path.join(__dirname, 'repair-retired-sample-statuses-snapshot.json');
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      { writtenAt: new Date().toISOString(), samples: samples.map((s) => ({ id: s.id, sampleNumber: s.sampleNumber, status: s.status })) },
      null,
      2
    )
  );

  const result = await prisma.samples.updateMany({
    where: { id: { in: samples.map((s) => s.id) }, status: { in: ['IN_PROGRESS', 'SUBMITTED'] } },
    data: { status: 'REQUESTED' },
  });
  console.log(`\nMoved ${result.count} sample(s) to REQUESTED. Snapshot: ${snapshotPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
