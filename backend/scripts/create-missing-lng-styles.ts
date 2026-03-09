/**
 * Create Missing LNG Styles
 *
 * Creates styles that don't exist yet in the database, with:
 * - Brand: Nihsamah
 * - Customer: House Of Kasya Pvt Ltd
 * - Component: Nightgown (FULL)
 * - Nihsamah size preset (sizes + SKUs)
 * - Nihsamah accessories preset
 * - genericGreigeName per batch (Poplin or Viscose Staple)
 *
 * Usage:
 *   npx ts-node scripts/create-missing-lng-styles.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateSKU } from '../src/utils/sku-generator';

const prisma = new PrismaClient();

interface StyleBatch {
  genericGreigeName: string;
  styleCodes: string[];
}

const batches: StyleBatch[] = [
  {
    genericGreigeName: 'Poplin',
    styleCodes: [
      'LNG190','LNG202','LNG250','LNG257','LNG245','LNG203','LNG207','LNG231',
      'LNG251','LNG253','LNG254','LNG256','LNG206','LNG209','LNG260','LNG170',
      'LNG173','LNG258','LNG259','LNG261','LNG262','LNG176',
    ],
  },
  {
    genericGreigeName: 'Viscose Staple',
    styleCodes: [
      'LNG248B','LNG248M','LNG249','LNG249T','LNG244','LNG201','LNG198M','LNG248T',
    ],
  },
];

async function main() {
  console.log('=== Create Missing LNG Styles ===\n');

  // Step 1: Look up Nightgown component master
  console.log('Step 1: Looking up Nightgown component master...');
  const nightgownMaster = await prisma.component_masters.findFirst({
    where: { name: { equals: 'Nightgown', mode: 'insensitive' }, isActive: true },
    select: { id: true, name: true },
  });
  if (!nightgownMaster) {
    console.error('ERROR: "Nightgown" not found in component_masters. Aborting.');
    process.exit(1);
  }
  console.log(`  Found: ${nightgownMaster.name} (${nightgownMaster.id})\n`);

  // Step 2: Look up customer
  console.log('Step 2: Looking up customer "House Of Kasya Pvt Ltd"...');
  const customer = await prisma.customers.findFirst({
    where: { name: { contains: 'Kasya', mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!customer) {
    console.error('ERROR: Customer containing "Kasya" not found. Aborting.');
    process.exit(1);
  }
  console.log(`  Found: ${customer.name} (${customer.id})\n`);

  // Step 3: Look up brand category "Nihsamah" under that customer
  console.log('Step 3: Looking up brand category "Nihsamah"...');
  const brandCategory = await prisma.brand_categories.findFirst({
    where: {
      customerId: customer.id,
      brandName: { equals: 'Nihsamah', mode: 'insensitive' },
    },
    select: { id: true, brandName: true, category: true },
  });
  if (brandCategory) {
    console.log(`  Found: ${brandCategory.brandName} / ${brandCategory.category} (${brandCategory.id})\n`);
  } else {
    console.log('  Not found - will use brandName text only\n');
  }

  // Step 4: Look up Nihsamah size preset
  console.log('Step 4: Looking up Nihsamah size preset...');
  const sizePreset = await prisma.customer_size_category_presets.findFirst({
    where: { presetName: { equals: 'Nihsamah', mode: 'insensitive' }, isActive: true },
    include: { sizeCategory: true },
  });
  let presetSizes: string[] = [];
  if (sizePreset) {
    presetSizes = (sizePreset.sizeCategory.sizes as string[]) || [];
    console.log(`  Found: ${sizePreset.presetName} - Sizes: ${presetSizes.join(', ')}\n`);
  } else {
    console.log('  Not found - will skip size/SKU generation\n');
  }

  // Step 5: Look up Nihsamah accessories preset
  console.log('Step 5: Looking up Nihsamah accessories preset...');
  const accessoriesPreset = await prisma.customer_accessories_presets.findFirst({
    where: {
      presetName: { equals: 'Nihsamah', mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true, presetName: true },
  });
  if (accessoriesPreset) {
    console.log(`  Found: ${accessoriesPreset.presetName} (${accessoriesPreset.id})\n`);
  } else {
    console.log('  Not found - will skip accessories preset\n');
  }

  // Step 6: Get an admin user for createdById
  console.log('Step 6: Looking up admin user...');
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!adminUser) {
    console.error('ERROR: No active admin user found. Aborting.');
    process.exit(1);
  }
  console.log(`  Found: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.id})\n`);

  // Step 7: Process batches
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let skuConflicts = 0;

  for (const batch of batches) {
    const uniqueCodes = [...new Set(batch.styleCodes)];
    console.log(`--- Batch: "${batch.genericGreigeName}" (${uniqueCodes.length} styles) ---`);

    // Check which ones already exist
    const existing = await prisma.styles.findMany({
      where: { styleCode: { in: uniqueCodes } },
      select: { styleCode: true },
    });
    const existingSet = new Set(existing.map(s => s.styleCode));
    const toCreate = uniqueCodes.filter(c => !existingSet.has(c));

    if (existingSet.size > 0) {
      console.log(`  Already exist (skipping): ${[...existingSet].join(', ')}`);
    }
    console.log(`  To create: ${toCreate.length}\n`);

    for (const styleCode of toCreate) {
      try {
        await prisma.$transaction(async (tx) => {
          // Generate internal code
          const now = new Date();
          const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          const count = await tx.styles.count();
          const internalCode = `STY-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

          // Create the style
          const styleId = randomUUID();
          await tx.styles.create({
            data: {
              id: styleId,
              styleCode: styleCode,
              styleName: styleCode,
              brandName: 'Nihsamah',
              customerName: customer.name,
              brandCategoryId: brandCategory?.id || null,
              customerAccessoriesPresetId: accessoriesPreset?.id || null,
              internalCode,
              status: 'DRAFT',
              cadStatus: 'PENDING',
              numberOfComponents: 1,
              createdById: adminUser.id,
              gender: 'WOMEN',
            },
          });

          // Create component
          const componentId = randomUUID();
          await tx.style_components.create({
            data: {
              id: componentId,
              styleId,
              componentName: 'Nightgown',
              componentType: 'FULL',
              componentMasterId: nightgownMaster.id,
              sortOrder: 0,
            },
          });

          // Create fabric with genericGreigeName
          await tx.style_fabrics.create({
            data: {
              id: randomUUID(),
              componentId,
              fabricName: batch.genericGreigeName,
              fabricType: 'GENERIC',
              genericGreigeName: batch.genericGreigeName,
              quantityNeeded: 0,
              allowCombinedCutting: true,
            },
          });

          // Create size options and variants
          if (presetSizes.length > 0) {
            for (const size of presetSizes) {
              const sizeOptionId = randomUUID();
              await tx.size_options.create({
                data: {
                  id: sizeOptionId,
                  styleId,
                  sizeName: size,
                  sizeCode: size,
                  sortOrder: 0,
                  isActive: true,
                },
              });

              let sku = generateSKU(styleCode, size);

              // Check for SKU conflicts
              const existingVariant = await tx.style_variants.findUnique({
                where: { sku },
                select: { styleId: true },
              });

              if (existingVariant) {
                const suffix = styleId.substring(0, 4);
                sku = `${sku}${suffix}`.substring(0, 30);
                skuConflicts++;
                console.log(`    SKU conflict resolved: ${generateSKU(styleCode, size)} -> ${sku}`);
              }

              await tx.style_variants.create({
                data: {
                  id: randomUUID(),
                  styleId,
                  sizeId: sizeOptionId,
                  sizeName: size,
                  sku,
                  isActive: true,
                },
              });
            }
          }
        });

        console.log(`  Created: ${styleCode}`);
        totalCreated++;
      } catch (error: any) {
        console.error(`  ERROR creating ${styleCode}: ${error.message}`);
        totalErrors++;
      }
    }

    totalSkipped += existingSet.size;
    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Skipped (already exist): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  if (skuConflicts > 0) {
    console.log(`  SKU conflicts resolved: ${skuConflicts}`);
  }
  console.log('=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
