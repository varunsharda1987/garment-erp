/**
 * Seed Script: Thread Packaging Specifications
 *
 * Seeds the thread_packaging_specs table with reference data for packaging conversions:
 * - Units per box (e.g., 15 spools per box for 3-Ply)
 * - Meters per unit (e.g., 400 meters per spool for 3-Ply)
 *
 * Run: npx ts-node scripts/seed-thread-packaging-specs.ts
 */

import { PrismaClient, ThreadPly, ThreadPackagingType } from '@prisma/client';

const prisma = new PrismaClient();

interface PackagingSpec {
  ply: ThreadPly;
  packagingType: ThreadPackagingType;
  unitsPerBox: number;
  metersPerUnit: number;
}

const PACKAGING_SPECS: PackagingSpec[] = [
  // 3-Ply Specifications
  {
    ply: 'THREE_PLY',
    packagingType: 'SPOOL',
    unitsPerBox: 15,
    metersPerUnit: 400,
  },
  {
    ply: 'THREE_PLY',
    packagingType: 'CONE_5K',
    unitsPerBox: 10,
    metersPerUnit: 5000,
  },
  {
    ply: 'THREE_PLY',
    packagingType: 'CONE_10K',
    unitsPerBox: 10,
    metersPerUnit: 10000,
  },
  // 2-Ply Specifications
  {
    ply: 'TWO_PLY',
    packagingType: 'SPOOL',
    unitsPerBox: 10,
    metersPerUnit: 800,
  },
  {
    ply: 'TWO_PLY',
    packagingType: 'CONE_5K',
    unitsPerBox: 10,
    metersPerUnit: 5000,
  },
  {
    ply: 'TWO_PLY',
    packagingType: 'CONE_10K',
    unitsPerBox: 10,
    metersPerUnit: 10000,
  },
];

async function main() {
  console.log('🧵 Seeding thread packaging specifications...\n');

  for (const spec of PACKAGING_SPECS) {
    try {
      const existing = await prisma.thread_packaging_specs.findUnique({
        where: {
          ply_packagingType: {
            ply: spec.ply,
            packagingType: spec.packagingType,
          },
        },
      });

      if (existing) {
        // Update if exists
        await prisma.thread_packaging_specs.update({
          where: {
            ply_packagingType: {
              ply: spec.ply,
              packagingType: spec.packagingType,
            },
          },
          data: {
            unitsPerBox: spec.unitsPerBox,
            metersPerUnit: spec.metersPerUnit,
            isActive: true,
          },
        });
        console.log(
          `✅ Updated: ${spec.ply} ${spec.packagingType} (${spec.unitsPerBox} units/box, ${spec.metersPerUnit}m/unit)`
        );
      } else {
        // Create if doesn't exist
        await prisma.thread_packaging_specs.create({
          data: spec,
        });
        console.log(
          `✨ Created: ${spec.ply} ${spec.packagingType} (${spec.unitsPerBox} units/box, ${spec.metersPerUnit}m/unit)`
        );
      }
    } catch (error) {
      console.error(`❌ Error processing ${spec.ply} ${spec.packagingType}:`, error);
    }
  }

  console.log('\n✅ Thread packaging specifications seeded successfully!');

  // Summary
  const count = await prisma.thread_packaging_specs.count({
    where: { isActive: true },
  });
  console.log(`\n📊 Total active specs: ${count}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
