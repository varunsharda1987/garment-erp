/**
 * Backfill Script: Update LNG Prefix Styles
 *
 * Updates all styles with styleCode starting with "LNG" to:
 * 1. Set component to Nightgown (Full Garment group)
 * 2. Set generic greige name to Poplin
 * 3. Apply Nihsamah size preset + auto-generate SKUs
 * 4. Keep status as DRAFT
 *
 * Usage:
 *   npx ts-node scripts/backfill-lng-styles.ts --dry-run   # Preview only
 *   npx ts-node scripts/backfill-lng-styles.ts              # Execute
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateSKU } from '../src/utils/sku-generator';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('🔧 Backfill Script: Update LNG Prefix Styles');
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE EXECUTION'}\n`);

  // Step 1: Look up Nightgown component master
  console.log('📊 Step 1: Looking up Nightgown component master...');
  const nightgownMaster = await prisma.component_masters.findFirst({
    where: { name: { equals: 'Nightgown', mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true, componentGroupId: true },
  });

  if (!nightgownMaster) {
    console.error('❌ "Nightgown" not found in component_masters. Aborting.');
    process.exit(1);
  }
  console.log(`   ✅ Found: ${nightgownMaster.name} (id: ${nightgownMaster.id})\n`);

  // Step 2: Look up Nihsamah size preset
  console.log('📊 Step 2: Looking up Nihsamah size preset...');
  const nihsamahPreset = await prisma.customer_size_category_presets.findFirst({
    where: { presetName: { equals: 'Nihsamah', mode: 'insensitive' }, isActive: true },
    include: { sizeCategory: true },
  });

  let presetSizes: string[] = [];
  if (!nihsamahPreset) {
    console.log('   ⚠️  "Nihsamah" preset not found. Will skip size/SKU assignment.\n');
  } else {
    presetSizes = (nihsamahPreset.sizeCategory.sizes as string[]) || [];
    console.log(`   ✅ Found preset: ${nihsamahPreset.presetName}`);
    console.log(`   📏 Sizes: ${presetSizes.join(', ')}\n`);
  }

  // Step 3: Query all LNG styles
  console.log('📊 Step 3: Querying styles with LNG prefix...');
  const lngStyles = await prisma.styles.findMany({
    where: { styleCode: { startsWith: 'LNG', mode: 'insensitive' } },
    include: {
      style_components: {
        include: { style_fabrics: true },
      },
      style_variants: true,
    },
  });

  if (lngStyles.length === 0) {
    console.log('   ℹ️  No styles found with LNG prefix. Nothing to do.\n');
    return;
  }
  console.log(`   Found ${lngStyles.length} style(s):\n`);
  lngStyles.forEach(s => {
    console.log(`   - ${s.styleCode} (${s.styleName || 'unnamed'}) [${s.status}]`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN: Would update the above styles with:');
    console.log('   - Component: Nightgown (FULL)');
    console.log('   - Generic Greige Name: Poplin');
    if (presetSizes.length > 0) {
      console.log(`   - Sizes: ${presetSizes.join(', ')}`);
      console.log('   - SKUs: auto-generated ({styleCode}{size})');
    }
    console.log('   - Status: DRAFT');
    console.log('\n   Run without --dry-run to execute.\n');
    return;
  }

  // Step 4: Process each style
  console.log('📊 Step 4: Processing styles...\n');
  let updatedCount = 0;
  let errorCount = 0;
  let skuConflicts = 0;

  for (const style of lngStyles) {
    try {
      console.log(`   Processing: ${style.styleCode}...`);

      await prisma.$transaction(async (tx) => {
        // 4a. Unlink fabric_width_cad before deleting fabrics (preserve CAD data)
        const existingFabricIds = style.style_components
          .flatMap(c => c.style_fabrics.map(f => f.id));

        if (existingFabricIds.length > 0) {
          const unlinkResult = await tx.fabric_width_cad.updateMany({
            where: { styleFabricId: { in: existingFabricIds } },
            data: { styleFabricId: null },
          });
          if (unlinkResult.count > 0) {
            console.log(`     ↳ Preserved ${unlinkResult.count} CAD record(s)`);
          }
        }

        // 4b. Delete existing fabrics and components
        if (style.style_components.length > 0) {
          await tx.style_fabrics.deleteMany({
            where: { componentId: { in: style.style_components.map(c => c.id) } },
          });
          await tx.style_components.deleteMany({
            where: { styleId: style.id },
          });
        }

        // 4c. Create Nightgown component
        const componentId = randomUUID();
        await tx.style_components.create({
          data: {
            id: componentId,
            styleId: style.id,
            componentName: 'Nightgown',
            componentType: 'FULL',
            componentMasterId: nightgownMaster.id,
            sortOrder: 0,
          },
        });

        // 4d. Create fabric with Poplin greige
        await tx.style_fabrics.create({
          data: {
            id: randomUUID(),
            componentId: componentId,
            fabricName: 'Poplin',
            fabricType: 'GENERIC',
            genericGreigeName: 'Poplin',
            quantityNeeded: 0,
            allowCombinedCutting: true,
          },
        });

        // 4e. Handle sizes and SKUs (if preset found)
        if (presetSizes.length > 0) {
          // Delete existing variants
          await tx.style_variants.deleteMany({
            where: { styleId: style.id },
          });

          for (const size of presetSizes) {
            // Get or create size option
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

            // Generate SKU
            let sku = generateSKU(style.styleCode, size);

            // Check for conflicts with OTHER styles
            const existingVariant = await tx.style_variants.findUnique({
              where: { sku },
              select: { styleId: true },
            });

            if (existingVariant && existingVariant.styleId !== style.id) {
              // Conflict: SKU belongs to another style, append suffix
              const suffix = style.id.substring(0, 4);
              sku = `${sku}${suffix}`.substring(0, 30);
              skuConflicts++;
              console.log(`     ⚠️  SKU conflict resolved: ${generateSKU(style.styleCode, size)} → ${sku}`);
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
        }

        // 4f. Set status to DRAFT and numberOfComponents to 1
        await tx.styles.update({
          where: { id: style.id },
          data: {
            status: 'DRAFT',
            numberOfComponents: 1,
          },
        });
      });

      console.log(`     ✅ Updated: ${style.styleCode}`);
      updatedCount++;
    } catch (error) {
      console.error(`     ❌ Error updating ${style.styleCode}:`, error);
      errorCount++;
    }
  }

  // Summary
  console.log('\n🎉 Backfill completed!\n');
  console.log('📊 Summary:');
  console.log(`   - LNG styles found: ${lngStyles.length}`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  if (skuConflicts > 0) {
    console.log(`   - SKU conflicts resolved: ${skuConflicts}`);
  }
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
