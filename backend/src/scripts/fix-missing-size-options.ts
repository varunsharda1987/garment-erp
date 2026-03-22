/**
 * Script to fix missing size_options for existing style_variants
 *
 * This script:
 * 1. Finds all style_variants with null sizeId
 * 2. Creates corresponding size_options records
 * 3. Updates the style_variants with the correct sizeId
 *
 * Run with: npx ts-node src/scripts/fix-missing-size-options.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Size order for sorting
const SIZE_ORDER: Record<string, number> = {
  XS: 10,
  S: 20,
  M: 30,
  L: 40,
  XL: 50,
  XXL: 60,
  '2XL': 60,
  XXXL: 70,
  '3XL': 70,
  '4XL': 80,
  '5XL': 90,
};

function getSizeOrder(size: string): number {
  return SIZE_ORDER[size.toUpperCase()] || 100;
}

async function main() {
  console.log('Finding style_variants with missing sizeId...');

  // Find all variants with null sizeId
  const variantsWithoutSize = await prisma.style_variants.findMany({
    where: { sizeId: null },
    select: {
      id: true,
      styleId: true,
      sizeName: true,
      sku: true,
    },
  });

  console.log(`Found ${variantsWithoutSize.length} variants without sizeId`);

  if (variantsWithoutSize.length === 0) {
    console.log('No variants to fix!');
    return;
  }

  // Group by styleId
  const variantsByStyle = new Map<string, typeof variantsWithoutSize>();
  for (const variant of variantsWithoutSize) {
    const existing = variantsByStyle.get(variant.styleId) || [];
    existing.push(variant);
    variantsByStyle.set(variant.styleId, existing);
  }

  console.log(`Variants span across ${variantsByStyle.size} styles`);

  let fixedCount = 0;
  let sizeOptionsCreated = 0;

  // Process each style
  for (const [styleId, variants] of variantsByStyle) {
    console.log(`\nProcessing style ${styleId} with ${variants.length} variants...`);

    // Get unique size names
    const uniqueSizes = [...new Set(variants.map((v) => v.sizeName).filter(Boolean))];

    for (const sizeName of uniqueSizes) {
      if (!sizeName) continue;

      // Check if size_option already exists
      let sizeOption = await prisma.size_options.findFirst({
        where: { styleId, sizeName },
      });

      if (!sizeOption) {
        // Create size_option
        sizeOption = await prisma.size_options.create({
          data: {
            id: randomUUID(),
            styleId,
            sizeName,
            sizeCode: sizeName,
            sortOrder: getSizeOrder(sizeName),
            isActive: true,
          },
        });
        console.log(`  Created size_option for "${sizeName}"`);
        sizeOptionsCreated++;
      }

      // Update all variants with this size
      const variantsToUpdate = variants.filter((v) => v.sizeName === sizeName);
      for (const variant of variantsToUpdate) {
        await prisma.style_variants.update({
          where: { id: variant.id },
          data: {
            sizeId: sizeOption.id,
            sortOrder: getSizeOrder(sizeName),
          },
        });
        fixedCount++;
      }
      console.log(`  Updated ${variantsToUpdate.length} variants with size "${sizeName}"`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Size options created: ${sizeOptionsCreated}`);
  console.log(`Variants fixed: ${fixedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
