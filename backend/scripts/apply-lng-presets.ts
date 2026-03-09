/**
 * Apply Nihsamah Presets to All LNG Styles
 *
 * Applies:
 * 1. "Nihsamah Nighty" size preset → size_options + style_variants (SKUs)
 * 2. "Nihsamah Nightgown" accessories preset → customerAccessoriesPresetId + style_material_bom
 *
 * Skips styles that already have variants or accessories.
 *
 * Usage:
 *   npx ts-node scripts/apply-lng-presets.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateSKU } from '../src/utils/sku-generator';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Apply Presets to LNG Styles ===\n');

  // Step 1: Look up size preset (preset name is "Sizes", category name is "Nihsamah Nighty")
  console.log('Step 1: Looking up size preset with "Nihsamah Nighty" category...');
  const sizePreset = await prisma.customer_size_category_presets.findFirst({
    where: {
      isActive: true,
      sizeCategory: { name: { contains: 'Nihsamah', mode: 'insensitive' } },
    },
    include: { sizeCategory: true },
  });

  let presetSizes: string[] = [];
  if (sizePreset) {
    presetSizes = (sizePreset.sizeCategory.sizes as string[]) || [];
    console.log(`  Found: "${sizePreset.presetName}" - Sizes: ${presetSizes.join(', ')}\n`);
  } else {
    console.log('  NOT FOUND - will skip size/SKU generation\n');
  }

  // Step 2: Look up accessories preset
  console.log('Step 2: Looking up accessories preset "Nihsamah Nightgown"...');
  const accessoriesPreset = await prisma.customer_accessories_presets.findFirst({
    where: {
      presetName: { contains: 'Nihsamah Nightgown', mode: 'insensitive' },
      isActive: true,
    },
    include: {
      items: {
        include: {
          material: {
            select: { id: true, packagingId: true, labelId: true },
          },
        },
      },
    },
  });

  if (accessoriesPreset) {
    console.log(`  Found: "${accessoriesPreset.presetName}" (${accessoriesPreset.items.length} items)`);
    for (const item of accessoriesPreset.items) {
      console.log(`    - ${item.materialType}: labelId=${item.labelId || '-'}, materialId=${item.materialId || '-'}`);
    }
    console.log('');
  } else {
    console.log('  NOT FOUND - will skip accessories\n');
  }

  if (!sizePreset && !accessoriesPreset) {
    console.log('No presets found. Nothing to do.');
    return;
  }

  // Step 3: Query all LNG styles
  console.log('Step 3: Querying LNG styles...');
  const lngStyles = await prisma.styles.findMany({
    where: { styleCode: { startsWith: 'LNG', mode: 'insensitive' } },
    include: {
      style_variants: { select: { id: true } },
      style_material_bom: { select: { id: true, materialType: true } },
    },
  });
  console.log(`  Found ${lngStyles.length} LNG styles\n`);

  // Step 4: Process each style
  let sizesApplied = 0;
  let sizesSkipped = 0;
  let accessoriesApplied = 0;
  let accessoriesSkipped = 0;
  let skuConflicts = 0;
  let errors = 0;

  for (const style of lngStyles) {
    try {
      const needsSizes = presetSizes.length > 0 && style.style_variants.length === 0;
      const needsAccessories = accessoriesPreset && style.style_material_bom.length === 0;

      if (!needsSizes && !needsAccessories) {
        sizesSkipped += presetSizes.length > 0 ? 1 : 0;
        accessoriesSkipped += accessoriesPreset ? 1 : 0;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // Apply sizes
        if (needsSizes) {
          for (const size of presetSizes) {
            let sizeOption = await tx.size_options.findFirst({
              where: { styleId: style.id, sizeName: size },
            });

            if (!sizeOption) {
              sizeOption = await tx.size_options.create({
                data: {
                  id: randomUUID(),
                  styleId: style.id,
                  sizeName: size,
                  sizeCode: size,
                  sortOrder: 0,
                  isActive: true,
                },
              });
            }

            let sku = generateSKU(style.styleCode, size);

            const existingVariant = await tx.style_variants.findUnique({
              where: { sku },
              select: { styleId: true },
            });

            if (existingVariant && existingVariant.styleId !== style.id) {
              const suffix = style.id.substring(0, 4);
              sku = `${sku}${suffix}`.substring(0, 30);
              skuConflicts++;
            }

            await tx.style_variants.upsert({
              where: { sku },
              create: {
                id: randomUUID(),
                styleId: style.id,
                sizeId: sizeOption.id,
                sizeName: size,
                sku,
                isActive: true,
              },
              update: {
                styleId: style.id,
                sizeId: sizeOption.id,
                sizeName: size,
                isActive: true,
              },
            });
          }
          sizesApplied++;
        } else if (presetSizes.length > 0) {
          sizesSkipped++;
        }

        // Apply accessories
        if (needsAccessories && accessoriesPreset) {
          // Set preset reference on style
          await tx.styles.update({
            where: { id: style.id },
            data: { customerAccessoriesPresetId: accessoriesPreset.id },
          });

          // Create style_material_bom records from preset items
          // Note: preset items may have invalid usageCategory values like "GARMENT"
          // Valid enum: GARMENT_TRIM, VALUE_ADDITION, PACKAGING
          for (const item of accessoriesPreset.items) {
            // Map usageCategory: LABEL/PACKAGING types default to PACKAGING
            const resolvedUsageCategory =
              item.usageCategory === 'GARMENT_TRIM' || item.usageCategory === 'VALUE_ADDITION' || item.usageCategory === 'PACKAGING'
                ? item.usageCategory
                : 'PACKAGING';

            if (item.materialType === 'LABEL' && item.labelId) {
              await tx.style_material_bom.create({
                data: {
                  id: randomUUID(),
                  styleId: style.id,
                  materialType: 'LABEL',
                  labelId: item.labelId,
                  usageCategory: resolvedUsageCategory,
                  componentName: item.componentName || undefined,
                  quantityPerGarment: 1,
                  unit: 'pcs',
                  extraPercentage: item.extraPercentage ?? 5,
                },
              });
            } else if (item.materialType === 'PACKAGING' && item.material?.packagingId) {
              await tx.style_material_bom.create({
                data: {
                  id: randomUUID(),
                  styleId: style.id,
                  materialType: 'PACKAGING',
                  packagingId: item.material.packagingId,
                  usageCategory: resolvedUsageCategory,
                  componentName: item.componentName || undefined,
                  quantityPerGarment: Number(item.quantity) || 1,
                  unit: 'pcs',
                  extraPercentage: item.extraPercentage ?? 5,
                },
              });
            }
          }

          // Auto-add THREAD if missing
          const hasThread = await tx.style_material_bom.findFirst({
            where: { styleId: style.id, materialType: 'THREAD' },
          });
          if (!hasThread) {
            await tx.style_material_bom.create({
              data: {
                id: randomUUID(),
                styleId: style.id,
                materialType: 'THREAD',
                usageCategory: 'GARMENT_TRIM',
                componentName: 'Default Thread',
                quantityPerGarment: 0,
                unit: 'cone',
                extraPercentage: 5,
              },
            });
          }

          accessoriesApplied++;
        } else if (accessoriesPreset) {
          accessoriesSkipped++;
        }
      });

      const actions: string[] = [];
      if (needsSizes) actions.push('sizes');
      if (needsAccessories) actions.push('accessories');
      console.log(`  ${style.styleCode}: applied ${actions.join(' + ')}`);
    } catch (error: any) {
      console.error(`  ${style.styleCode}: ERROR - ${error.message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`  Total LNG styles: ${lngStyles.length}`);
  console.log(`  Sizes applied: ${sizesApplied}, skipped (already had): ${sizesSkipped}`);
  console.log(`  Accessories applied: ${accessoriesApplied}, skipped (already had): ${accessoriesSkipped}`);
  if (skuConflicts > 0) console.log(`  SKU conflicts resolved: ${skuConflicts}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);
  console.log('=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
