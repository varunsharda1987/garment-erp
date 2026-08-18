/**
 * One-off data hygiene: fabric_master.colorName '' (empty string) → NULL.
 *
 * The naming convention stores unknown colour as NULL (segment omitted) and the dedup
 * tuple matches colorName with Prisma null (IS NULL) — empty strings would never match.
 * Names and codes are NOT touched (user decision: existing records stay as-is).
 *
 *   npx ts-node scripts/normalize-fabric-color-sentinels.ts          # dry-run (default)
 *   npx ts-node scripts/normalize-fabric-color-sentinels.ts --apply  # write
 */
import 'dotenv/config';
import prisma from '../src/config/database';

async function main() {
  const apply = process.argv.includes('--apply');

  const rows = await prisma.fabric_master.findMany({
    where: { colorName: '' },
    select: { id: true, fabricCode: true, fabricName: true },
  });
  console.log(`fabric_master rows with colorName = '' : ${rows.length}`);
  for (const r of rows) console.log(`  ${r.fabricCode}  ${r.fabricName}`);

  if (!apply) {
    console.log('\nDry-run — pass --apply to set these to NULL.');
    return;
  }

  const result = await prisma.fabric_master.updateMany({
    where: { colorName: '' },
    data: { colorName: null },
  });
  console.log(`\nUpdated ${result.count} rows (colorName '' → NULL).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
