/**
 * Seed script for initial Lace Types
 * Run with: npx ts-node prisma/seeds/seed-lace-types.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LACE_TYPES = [
  'Schiffli Lace',
  'Crochet Lace',
  'Organza Lace',
  'Chemical Lace',
  'Net / Lycra Lace',
  'Gota Lace',
  'Poly Lace',
  'Cotton Lace',
];

async function seedLaceTypes() {
  console.log('Seeding Lace Types...\n');

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < LACE_TYPES.length; i++) {
    const value = LACE_TYPES[i];
    const code = value.toUpperCase().replace(/[\s\/]+/g, '_');

    try {
      const existing = await prisma.lookup_values.findUnique({
        where: {
          category_value: {
            category: 'LACE_TYPE',
            value: value,
          }
        }
      });

      if (existing) {
        console.log(`  [SKIP] ${value} (already exists)`);
        skipCount++;
        continue;
      }

      await prisma.lookup_values.create({
        data: {
          category: 'LACE_TYPE',
          code: code,
          value: value,
          sortOrder: i,
          isActive: true,
          isSystem: true,
        }
      });
      console.log(`  [OK] Created: ${value}`);
      successCount++;
    } catch (error: unknown) {
      console.error(`  [ERROR] Failed to create ${value}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Total: ${LACE_TYPES.length}`);
  console.log('\nLace Types seeded successfully!');
}

seedLaceTypes()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
