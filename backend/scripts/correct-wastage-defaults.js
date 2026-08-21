/**
 * ONE-OFF CORRECTION — wastage defaults to 0.
 *
 * Why this script has to exist:
 *   preloadDefaults() is insert-only by design, so that a value the user chose in Settings is
 *   never overwritten by a deploy. TRIM (2), LACE (5) and LABEL_EXTRA (5) were seeded long
 *   before that policy mattered, so they are sitting in the table as if they were deliberate
 *   choices. They were not — they are stale seed values, and changing the registry alone will
 *   not move them.
 *
 * Also removes GREIGE_DEFAULT_QUALITY_GRADE, which duplicated DEFAULT_QUALITY_GRADE for the
 * same concept. Nothing reads it any more (greige-stock.service now calls the single accessor).
 *
 * Safe to re-run: every write is idempotent.
 *
 *   node scripts/correct-wastage-defaults.js          # dry run, prints what it would do
 *   node scripts/correct-wastage-defaults.js --apply  # writes
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const CORRECTIONS = [
  { key: 'TRIM_DEFAULT_WASTAGE_PERCENT', from: '2', to: '0' },
  { key: 'LACE_DEFAULT_WASTAGE_PERCENT', from: '5', to: '0' },
  { key: 'LABEL_DEFAULT_EXTRA_PERCENT', from: '5', to: '0' },
];

const REMOVALS = ['GREIGE_DEFAULT_QUALITY_GRADE'];

async function main() {
  console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===');

  for (const c of CORRECTIONS) {
    const row = await prisma.system_settings.findUnique({ where: { key: c.key } });
    if (!row) {
      console.log(`  ${c.key}: absent — nothing to do (the registry value applies)`);
      continue;
    }
    if (row.value === c.to) {
      console.log(`  ${c.key}: already ${c.to}`);
      continue;
    }
    if (row.value !== c.from) {
      // Someone deliberately set something else. Their choice wins — that is the whole policy.
      console.log(`  ${c.key}: value is '${row.value}', not the stale seed '${c.from}' — LEAVING ALONE (user choice)`);
      continue;
    }
    console.log(`  ${c.key}: ${row.value} -> ${c.to}`);
    if (APPLY) {
      await prisma.system_settings.update({ where: { key: c.key }, data: { value: c.to } });
    }
  }

  for (const key of REMOVALS) {
    const row = await prisma.system_settings.findUnique({ where: { key } });
    if (!row) {
      console.log(`  ${key}: already removed`);
      continue;
    }
    console.log(`  ${key}: DELETE (duplicate of DEFAULT_QUALITY_GRADE)`);
    if (APPLY) {
      await prisma.system_settings.delete({ where: { key } });
    }
  }

  console.log(APPLY ? '=== DONE — restart the API so its 5-min cache reloads ===' : '=== DRY RUN COMPLETE ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
