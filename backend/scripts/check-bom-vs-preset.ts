/**
 * Preset-vs-BOM integrity sweep (report-only, no writes).
 *
 * Same-named label/packaging masters are per-customer BY DESIGN — each customer's set is
 * applied to styles via customer_accessories_presets. The style's
 * customerAccessoriesPresetId → preset items is therefore the AUTHORITY for which
 * label/packaging master a style's BOM rows must reference; a BOM row pointing at a
 * same-named master from another customer's set is silent cross-customer drift.
 *
 * Usage: npx ts-node scripts/check-bom-vs-preset.ts
 */
import prisma from '../src/config/database';

async function main() {
  const styles = await prisma.styles.findMany({
    where: { customerAccessoriesPresetId: { not: null } },
    select: {
      id: true,
      styleCode: true,
      customerAccessoriesPresetId: true,
      style_material_bom: {
        where: { materialType: { in: ['LABEL', 'PACKAGING'] }, isActive: true },
        select: { id: true, materialType: true, componentName: true, labelId: true, packagingId: true, materialId: true },
      },
    },
  });

  const presetIds = [...new Set(styles.map((s) => s.customerAccessoriesPresetId!))];
  const presets = await prisma.customer_accessories_presets.findMany({
    where: { id: { in: presetIds } },
    include: {
      customer: { select: { name: true } },
      items: { include: { label: { select: { labelName: true } }, material: { select: { name: true } } } },
    },
  });
  const presetById = new Map(presets.map((p) => [p.id, p]));

  let mismatches = 0;
  let checkedRows = 0;

  for (const style of styles) {
    const preset = presetById.get(style.customerAccessoriesPresetId!);
    if (!preset) {
      console.log(`⚠ ${style.styleCode}: presetId ${style.customerAccessoriesPresetId} does not exist`);
      continue;
    }

    for (const row of style.style_material_bom) {
      // Match the preset item by type + name (componentName carries the label/packaging name)
      const item = preset.items.find(
        (i) =>
          i.materialType === row.materialType &&
          ((i.label?.labelName || i.material?.name || i.componentName || '').toLowerCase() ===
            (row.componentName || '').toLowerCase())
      );
      if (!item) continue; // BOM row not driven by the preset (manually added) — not drift
      checkedRows++;

      const expectedId = item.labelId || item.materialId;
      const actualId = row.labelId || row.packagingId || row.materialId;
      if (expectedId && actualId && expectedId !== actualId) {
        mismatches++;
        console.log(
          `✗ ${style.styleCode} [${preset.customer.name} / ${preset.presetName}] ` +
            `${row.materialType} "${row.componentName}": BOM has ${actualId} but preset says ${expectedId} (bomRow ${row.id})`
        );
      }
    }
  }

  console.log(`\nChecked ${checkedRows} preset-driven BOM rows across ${styles.length} styles with presets.`);
  console.log(mismatches === 0 ? '✓ No preset-vs-BOM drift found.' : `✗ ${mismatches} mismatch(es) — fix by relinking to the preset's id.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
