/**
 * ONE-OFF BACKFILL — remove the wastage nobody chose.
 *
 * BACKGROUND
 *   style_material_bom.extraPercentage carried a DB column default of 5, and no API could set
 *   the field (it was absent from both Zod schemas), so every row in the table is 5 purely
 *   because the column default fired. That 5 then flowed into order_bom_items.wastagePercent
 *   and became the "5% wastage" visible on every trim of every BOM.
 *
 * WHY MATCHING ON "= 5" IS SAFE
 *   A deliberate 5 was impossible: until the accompanying schema fix shipped, the API stripped
 *   extraPercentage from every request. So a stored 5 is always the column default, never a
 *   user's choice. Values that are NOT 5 (e.g. the 3s and 0s in order_bom_items) were set by
 *   hand and are left strictly alone.
 *
 * SCOPE GUARDS
 *   - order_bom_items: DRAFT BOMs only. APPROVED and LOCKED BOMs are production/contractual
 *     records — rewriting their quantities is never acceptable.
 *   - FABRIC and GREIGE rows are skipped: their wastage comes from CAD planning, not from the
 *     trim default.
 *
 * style_material_bom is set to NULL rather than 0. NULL means "inherit the system default", so
 * if the default is ever changed in Settings these rows follow it. Pinning 0 would freeze them.
 *
 * Safe to re-run.
 *
 *   node scripts/backfill-stale-wastage.js          # dry run
 *   node scripts/backfill-stale-wastage.js --apply  # writes
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/** The stale DB column default we are clearing. */
const STALE = 5;
/** Wastage on these comes from CAD, not the trim default. */
const CAD_OWNED_TYPES = ['FABRIC', 'GREIGE'];

async function main() {
  console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===');

  // ---- 1. style_material_bom: the style-level template -------------------------------
  // Templates have no status of their own, and existing order BOMs already hold their own
  // snapshot, so clearing these cannot alter an approved document.
  const templateCount = await prisma.style_material_bom.count({ where: { extraPercentage: STALE } });
  console.log(`\nstyle_material_bom rows at ${STALE}% (stale column default): ${templateCount}`);
  console.log(`  -> set to NULL (inherit the configured default)`);
  if (APPLY && templateCount > 0) {
    const r = await prisma.style_material_bom.updateMany({
      where: { extraPercentage: STALE },
      data: { extraPercentage: null },
    });
    console.log(`  updated ${r.count}`);
  }

  // ---- 2. order_bom_items: DRAFT only -------------------------------------------------
  const draftBoms = await prisma.order_bom.findMany({ where: { status: 'DRAFT' }, select: { id: true } });
  const draftIds = draftBoms.map((b) => b.id);
  console.log(`\nDRAFT order BOMs: ${draftIds.length}`);

  const skipped = await prisma.order_bom_items.count({
    where: { wastagePercent: STALE, orderBomId: { notIn: draftIds } },
  });
  if (skipped > 0) {
    console.log(`  SKIPPING ${skipped} item(s) at ${STALE}% in APPROVED/LOCKED BOMs — never rewritten`);
  }

  const target = {
    orderBomId: { in: draftIds },
    wastagePercent: STALE,
    materialType: { notIn: CAD_OWNED_TYPES },
  };
  const items = await prisma.order_bom_items.findMany({
    where: target,
    select: { materialType: true },
  });
  const byType = items.reduce((m, i) => ({ ...m, [i.materialType]: (m[i.materialType] || 0) + 1 }), {});
  console.log(`  items to clear: ${items.length}`, JSON.stringify(byType));
  console.log(`  -> set to 0 (the snapshot is a fixed record, so it is pinned, not inherited)`);

  if (APPLY && items.length > 0) {
    const r = await prisma.order_bom_items.updateMany({ where: target, data: { wastagePercent: 0 } });
    console.log(`  updated ${r.count}`);
  }

  // ---- 3. Show what deliberately survives --------------------------------------------
  const survivors = await prisma.order_bom_items.groupBy({
    by: ['materialType', 'wastagePercent'],
    _count: true,
    where: { wastagePercent: { not: 0 } },
  });
  console.log(`\nNon-zero wastage remaining (deliberate values, untouched):`);
  if (survivors.length === 0) console.log('  none');
  survivors.forEach((s) => console.log(`  ${String(s.materialType).padEnd(14)} ${s.wastagePercent}%  x${s._count}`));

  console.log(APPLY ? '\n=== DONE ===' : '\n=== DRY RUN COMPLETE ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
