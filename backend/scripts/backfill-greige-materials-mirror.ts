/**
 * One-off backfill: greige_master rows missing their materials mirror row.
 *
 * Material Identity Unification requires materials.id === greige_master.id; masters
 * without a mirror crash the manual GREIGE PO picker on save ("Material with ID … not
 * found"). Root cause (style-import minting masters without ensureMaterialRecord) fixed
 * in the same commit — this repairs the existing rows.
 *
 *   npx ts-node scripts/backfill-greige-materials-mirror.ts          # dry-run
 *   npx ts-node scripts/backfill-greige-materials-mirror.ts --apply  # write
 */
import 'dotenv/config';
import prisma from '../src/config/database';
import { ensureMaterialRecord } from '../src/services/helpers/material-sync.helper';

async function main() {
  const apply = process.argv.includes('--apply');

  const missing = await prisma.greige_master.findMany({
    where: { isActive: true, materials: { none: {} } },
    select: { id: true, greigeCode: true, greigeName: true },
    orderBy: { greigeCode: 'asc' },
  });
  console.log(`Active greige masters without a materials mirror: ${missing.length}`);
  for (const g of missing) {
    console.log(`  ${g.greigeCode}  ${g.greigeName}`);
    if (apply) {
      await ensureMaterialRecord(g.id, 'GREIGE');
    }
  }
  console.log(apply ? '\nMirrored.' : '\nDry-run — pass --apply to create the materials rows.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
