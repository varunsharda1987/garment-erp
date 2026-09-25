/**
 * Repair style sizes so they read XS → XXXL and match the Style Form (2026-09-25).
 *
 * Two faults, both fixed at the source in the same change (style.service.ts `ensureSizeOption`,
 * style-variant.service.ts), left rows behind:
 *
 * 1. ORDER — the style import wrote `sortOrder: 0` on every size_options row it created (1,264 of
 *    2,040 live), so the LNG styles' S…XXXL came back in whatever order Postgres returned. Every
 *    size_options / style_variants row gets `getSizeOrder(sizeName)` — the one size-order rule.
 * 2. STALE SIZES — the Style Form's size grid writes style_variants, but a size unchecked there
 *    stayed ACTIVE in size_options, and the sale-order Size dropdown reads size_options: ESSKY093LS
 *    offered XXXL while its form has XS–XXL. An active size with no active variant is deactivated —
 *    ONLY on a style that has at least one active variant (its form has saved a real size list).
 *    A style with sizes but no variants at all is listed, never touched. Rows are never deleted:
 *    26 tables FK to size_options.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/repair-size-order.ts            # dry run (default): lists only
 *   cd backend && npx ts-node scripts/repair-size-order.ts --apply    # snapshot JSON, then one transaction
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import prisma from '../src/config/database';
import { getSizeOrder } from '../src/utils/sku-generator';

const APPLY = process.argv.includes('--apply');

/** Group ids by the sortOrder they should get, so the writes are one updateMany per rank. */
function byTarget(rows: { id: string; target: number }[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.target, [...(map.get(r.target) ?? []), r.id]);
  return map;
}

async function main() {
  const [options, variants] = await Promise.all([
    prisma.size_options.findMany({
      select: {
        id: true,
        styleId: true,
        sizeName: true,
        sortOrder: true,
        isActive: true,
        styles: { select: { styleCode: true } },
      },
    }),
    prisma.style_variants.findMany({
      select: { id: true, styleId: true, sizeId: true, sizeName: true, sortOrder: true, isActive: true },
    }),
  ]);

  // 1. Order
  const optionFixes = options
    .map((o) => ({ id: o.id, from: o.sortOrder, target: getSizeOrder(o.sizeName) }))
    .filter((o) => o.from !== o.target);
  const variantFixes = variants
    .filter((v) => v.sizeName)
    .map((v) => ({ id: v.id, from: v.sortOrder, target: getSizeOrder(v.sizeName as string) }))
    .filter((v) => v.from !== v.target);

  // 2. Stale sizes. A variant covers a size by FK, or by name when its sizeId was never set.
  const activeVariants = variants.filter((v) => v.isActive);
  const stylesWithVariants = new Set(activeVariants.map((v) => v.styleId));
  const covered = new Set(activeVariants.filter((v) => v.sizeId).map((v) => v.sizeId as string));
  const coveredByName = new Set(activeVariants.filter((v) => !v.sizeId && v.sizeName).map((v) => `${v.styleId}|${v.sizeName}`));
  const uncovered = options.filter(
    (o) => o.isActive && !covered.has(o.id) && !coveredByName.has(`${o.styleId}|${o.sizeName}`)
  );
  const toDeactivate = uncovered.filter((o) => stylesWithVariants.has(o.styleId));
  const untouched = uncovered.filter((o) => !stylesWithVariants.has(o.styleId));

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — style sizes`);
  console.log(`  size_options sortOrder to fix:   ${optionFixes.length} of ${options.length}`);
  console.log(`  style_variants sortOrder to fix: ${variantFixes.length} of ${variants.length}`);

  console.log(`\nActive sizes the Style Form no longer has → deactivate (${toDeactivate.length}):`);
  if (toDeactivate.length === 0) console.log('  none');
  for (const o of toDeactivate.sort((a, b) => a.styles.styleCode.localeCompare(b.styles.styleCode))) {
    console.log(`  ${o.styles.styleCode}  ${o.sizeName}`);
  }

  const untouchedStyles = [...new Set(untouched.map((o) => o.styles.styleCode))].sort();
  console.log(`\nFor review only (not changed): styles with sizes but no variants — ${untouchedStyles.length}`);
  for (const code of untouchedStyles) console.log(`  ${code}`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  const snapPath = join(__dirname, 'repair-size-order-snapshot.json');
  writeFileSync(
    snapPath,
    JSON.stringify(
      {
        sizeOptionSortOrder: optionFixes.map(({ id, from }) => ({ id, sortOrder: from })),
        styleVariantSortOrder: variantFixes.map(({ id, from }) => ({ id, sortOrder: from })),
        deactivatedSizeOptionIds: toDeactivate.map((o) => o.id),
      },
      null,
      2
    )
  );
  console.log(`\nSnapshot written: ${snapPath}`);

  await prisma.$transaction(
    async (tx) => {
      for (const [sortOrder, ids] of byTarget(optionFixes)) {
        await tx.size_options.updateMany({ where: { id: { in: ids } }, data: { sortOrder } });
      }
      for (const [sortOrder, ids] of byTarget(variantFixes)) {
        await tx.style_variants.updateMany({ where: { id: { in: ids } }, data: { sortOrder } });
      }
      if (toDeactivate.length > 0) {
        await tx.size_options.updateMany({
          where: { id: { in: toDeactivate.map((o) => o.id) }, isActive: true },
          data: { isActive: false },
        });
      }
    },
    { timeout: 60_000 }
  );
  console.log(
    `Applied: ${optionFixes.length} size_options + ${variantFixes.length} style_variants re-ranked, ` +
      `${toDeactivate.length} size(s) deactivated.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
