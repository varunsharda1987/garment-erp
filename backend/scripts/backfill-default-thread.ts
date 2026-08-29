/**
 * Backfill orphan BOM rows (no master FK at all) left by the old 'auto-thread' sentinel.
 *
 * THREAD orphans ("Thread (Auto-added)") are linked to the shared THR-DEFAULT thread master
 * (created on first run, with its same-ID materials record per the master-config invariant).
 * Non-THREAD orphans are reported; pass --delete-others to remove them.
 *
 * Usage:
 *   npx ts-node scripts/backfill-default-thread.ts             # dry-run (default)
 *   npx ts-node scripts/backfill-default-thread.ts --apply
 *   npx ts-node scripts/backfill-default-thread.ts --apply --delete-others
 */
import prisma from '../src/config/database';
import { ensureMaterialRecord } from '../src/services/helpers/material-sync.helper';

const APPLY = process.argv.includes('--apply');
const DELETE_OTHERS = process.argv.includes('--delete-others');

const NO_FK_FILTER = {
  materialId: null,
  laceId: null,
  buttonId: null,
  threadId: null,
  zipperId: null,
  elasticId: null,
  labelId: null,
  packagingId: null,
  machinePartId: null,
  otherMaterialId: null,
  hookEyeId: null,
  snapButtonId: null,
  buckleId: null,
  beltId: null,
  velcroId: null,
  drawstringId: null,
  ribbonId: null,
  sequinId: null,
  beadId: null,
  motifId: null,
  interliningId: null,
  paddingId: null,
  otherFastenerId: null,
  otherTapeId: null,
  otherDecorativeId: null,
  otherFunctionalId: null,
} as const;

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply to write)'}\n`);

  const orphans = await prisma.style_material_bom.findMany({
    where: NO_FK_FILTER,
    include: { styles: { select: { styleCode: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const threadOrphans = orphans.filter((o) => o.materialType === 'THREAD');
  const otherOrphans = orphans.filter((o) => o.materialType !== 'THREAD');

  console.log(`Orphan BOM rows (no master FK): ${orphans.length}`);
  console.log(`  THREAD (will link to THR-DEFAULT): ${threadOrphans.length}`);
  console.log(`  Other types (${DELETE_OTHERS ? 'will DELETE' : 'report only'}): ${otherOrphans.length}\n`);

  for (const o of otherOrphans) {
    console.log(`  [other] ${o.styles?.styleCode ?? '?'} | ${o.materialType} | ${o.componentName} | ${o.id}`);
  }

  if (!APPLY) {
    console.log('\nDry-run complete. No changes written.');
    return;
  }

  if (threadOrphans.length > 0) {
    let defaultThread = await prisma.thread_master.findUnique({
      where: { threadCode: 'THR-DEFAULT' },
      select: { id: true },
    });
    if (!defaultThread) {
      defaultThread = await prisma.thread_master.create({
        data: {
          threadCode: 'THR-DEFAULT',
          threadName: 'Default Thread',
          description: 'Shared placeholder thread auto-added to styles saved without a specific thread',
        },
        select: { id: true },
      });
      console.log(`Created Default Thread master: ${defaultThread.id}`);
    }
    await ensureMaterialRecord(defaultThread.id, 'THREAD');

    const result = await prisma.style_material_bom.updateMany({
      where: { ...NO_FK_FILTER, materialType: 'THREAD' },
      data: {
        materialId: defaultThread.id,
        threadId: defaultThread.id,
        componentName: 'Default Thread',
      },
    });
    console.log(`Linked ${result.count} THREAD orphan rows to THR-DEFAULT (${defaultThread.id})`);
  }

  if (DELETE_OTHERS && otherOrphans.length > 0) {
    const del = await prisma.style_material_bom.deleteMany({
      where: { id: { in: otherOrphans.map((o) => o.id) } },
    });
    console.log(`Deleted ${del.count} non-THREAD orphan rows`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
