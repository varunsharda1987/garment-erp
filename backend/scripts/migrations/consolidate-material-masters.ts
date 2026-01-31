/**
 * Migration Script: Consolidate Material Masters → material_master
 *
 * Strategy:
 * 1. Read all records from legacy tables (lace_master, button_master, etc.)
 * 2. Create material_master records with proper field mappings
 * 3. Store type-specific attributes in specifications JSON
 * 4. Track legacy IDs for backward compatibility
 *
 * Usage:
 *   npx ts-node scripts/migrations/consolidate-material-masters.ts          # Analysis only
 *   npx ts-node scripts/migrations/consolidate-material-masters.ts --execute # Execute migration
 */

import { PrismaClient, MaterialType } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  totalScanned: number;
  totalMigrated: number;
  byType: Record<string, { scanned: number; migrated: number; skipped: number }>;
  errors: string[];
}

// Helper to convert Decimal to number
function toNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  return typeof val === 'object' && val.toNumber ? val.toNumber() : Number(val);
}

// Get a default user ID for migration
async function getDefaultUserId(): Promise<string> {
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (adminUser) return adminUser.id;

  // Find any user
  const anyUser = await prisma.users.findFirst({
    select: { id: true },
  });

  if (anyUser) return anyUser.id;

  throw new Error('No user found in database. Please create a user first.');
}

async function migrateLaceMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing lace_master...');

  const laces = await prisma.lace_master.findMany({
    where: { isActive: true },
  });

  stats.byType['LACE'] = { scanned: laces.length, migrated: 0, skipped: 0 };
  stats.totalScanned += laces.length;

  console.log(`  Found ${laces.length} active records`);

  for (const lace of laces) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyLaceId: lace.id },
      });

      if (existing) {
        stats.byType['LACE'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.LACE,
            code: lace.laceCode,
            name: lace.laceName,
            description: lace.description,
            pricePerMeter: lace.pricePerMeter,
            unit: 'meter',
            specifications: {
              width: toNumber(lace.width),
              design: lace.design,
              color: lace.color,
              composition: lace.composition,
              laceType: lace.laceType,
              image: lace.image,
              supplierCode: lace.supplierCode,
              buyerCode: lace.buyerCode,
            },
            isActive: lace.isActive,
            createdById: lace.createdById || defaultUserId,
            legacyLaceId: lace.id,
          },
        });
        stats.byType['LACE'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Lace ${lace.laceCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['LACE'].scanned}, Migrated: ${stats.byType['LACE'].migrated}, Skipped: ${stats.byType['LACE'].skipped}`);
}

async function migrateButtonMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing button_master...');

  const buttons = await prisma.button_master.findMany({
    where: { isActive: true },
  });

  stats.byType['BUTTON'] = { scanned: buttons.length, migrated: 0, skipped: 0 };
  stats.totalScanned += buttons.length;

  console.log(`  Found ${buttons.length} active records`);

  for (const button of buttons) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyButtonId: button.id },
      });

      if (existing) {
        stats.byType['BUTTON'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.BUTTON,
            code: button.buttonCode,
            name: button.buttonName,
            description: button.description,
            pricePerPiece: button.pricePerPiece,
            pricePerGross: button.pricePerGross,
            unit: 'piece',
            specifications: {
              size: button.size,
              holes: button.holes,
              color: button.color,
              material: button.material,
              shape: button.shape,
              image: button.image,
              supplierCode: button.supplierCode,
              buyerCode: button.buyerCode,
            },
            isActive: button.isActive,
            createdById: button.createdById || defaultUserId,
            legacyButtonId: button.id,
          },
        });
        stats.byType['BUTTON'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Button ${button.buttonCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['BUTTON'].scanned}, Migrated: ${stats.byType['BUTTON'].migrated}, Skipped: ${stats.byType['BUTTON'].skipped}`);
}

async function migrateThreadMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing thread_master...');

  const threads = await prisma.thread_master.findMany({
    where: { isActive: true },
  });

  stats.byType['THREAD'] = { scanned: threads.length, migrated: 0, skipped: 0 };
  stats.totalScanned += threads.length;

  console.log(`  Found ${threads.length} active records`);

  for (const thread of threads) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyThreadId: thread.id },
      });

      if (existing) {
        stats.byType['THREAD'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.THREAD,
            code: thread.threadCode,
            name: thread.threadName,
            description: thread.description,
            pricePerUnit: thread.pricePerCone,
            unit: 'cone',
            specifications: {
              color: thread.color,
              colorCode: thread.colorCode,
              coneSize: thread.coneSize,
              brand: thread.brand,
              metersPerUnit: toNumber(thread.metersPerUnit),
              packagingType: thread.packagingType,
              piecesPerBox: thread.piecesPerBox,
              image: thread.image,
              supplierCode: thread.supplierCode,
              buyerCode: thread.buyerCode,
            },
            isActive: thread.isActive,
            createdById: thread.createdById || defaultUserId,
            legacyThreadId: thread.id,
          },
        });
        stats.byType['THREAD'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Thread ${thread.threadCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['THREAD'].scanned}, Migrated: ${stats.byType['THREAD'].migrated}, Skipped: ${stats.byType['THREAD'].skipped}`);
}

async function migrateZipperMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing zipper_master...');

  const zippers = await prisma.zipper_master.findMany({
    where: { isActive: true },
  });

  stats.byType['ZIPPER'] = { scanned: zippers.length, migrated: 0, skipped: 0 };
  stats.totalScanned += zippers.length;

  console.log(`  Found ${zippers.length} active records`);

  for (const zipper of zippers) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyZipperId: zipper.id },
      });

      if (existing) {
        stats.byType['ZIPPER'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.ZIPPER,
            code: zipper.zipperCode,
            name: zipper.zipperName,
            description: zipper.description,
            pricePerPiece: zipper.pricePerPiece,
            unit: 'piece',
            specifications: {
              length: toNumber(zipper.length),
              color: zipper.color,
              teethType: zipper.teethType,
              sliderType: zipper.sliderType,
              tapeWidth: toNumber(zipper.tapeWidth),
              brand: zipper.brand,
              image: zipper.image,
              supplierCode: zipper.supplierCode,
              buyerCode: zipper.buyerCode,
            },
            isActive: zipper.isActive,
            createdById: zipper.createdById || defaultUserId,
            legacyZipperId: zipper.id,
          },
        });
        stats.byType['ZIPPER'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Zipper ${zipper.zipperCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['ZIPPER'].scanned}, Migrated: ${stats.byType['ZIPPER'].migrated}, Skipped: ${stats.byType['ZIPPER'].skipped}`);
}

async function migrateElasticMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing elastic_master...');

  const elastics = await prisma.elastic_master.findMany({
    where: { isActive: true },
  });

  stats.byType['ELASTIC'] = { scanned: elastics.length, migrated: 0, skipped: 0 };
  stats.totalScanned += elastics.length;

  console.log(`  Found ${elastics.length} active records`);

  for (const elastic of elastics) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyElasticId: elastic.id },
      });

      if (existing) {
        stats.byType['ELASTIC'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.ELASTIC,
            code: elastic.elasticCode,
            name: elastic.elasticName,
            description: elastic.description,
            pricePerMeter: elastic.pricePerMeter,
            unit: 'meter',
            specifications: {
              width: toNumber(elastic.width),
              color: elastic.color,
              stretchPercent: toNumber(elastic.stretchPercent),
              composition: elastic.composition,
              elasticType: elastic.elasticType,
              image: elastic.image,
              supplierCode: elastic.supplierCode,
              buyerCode: elastic.buyerCode,
            },
            isActive: elastic.isActive,
            createdById: elastic.createdById || defaultUserId,
            legacyElasticId: elastic.id,
          },
        });
        stats.byType['ELASTIC'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Elastic ${elastic.elasticCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['ELASTIC'].scanned}, Migrated: ${stats.byType['ELASTIC'].migrated}, Skipped: ${stats.byType['ELASTIC'].skipped}`);
}

async function migrateLabelMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing label_master...');

  const labels = await prisma.label_master.findMany({
    where: { isActive: true },
  });

  stats.byType['LABEL'] = { scanned: labels.length, migrated: 0, skipped: 0 };
  stats.totalScanned += labels.length;

  console.log(`  Found ${labels.length} active records`);

  for (const label of labels) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyLabelId: label.id },
      });

      if (existing) {
        stats.byType['LABEL'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.LABEL,
            code: label.labelCode,
            name: label.labelName,
            description: label.description,
            pricePerPiece: label.pricePerPiece,
            unit: 'piece',
            specifications: {
              size: label.size,
              labelType: label.labelType,
              labelCategory: label.labelCategory,
              printMethod: label.printMethod,
              material: label.material,
              color: label.color,
              content: label.content,
              fabricContent: label.fabricContent,
              washcareInstructions: label.washcareInstructions,
              pricePerHundred: toNumber(label.pricePerHundred),
              image: label.image,
              supplierCode: label.supplierCode,
              buyerCode: label.buyerCode,
            },
            isActive: label.isActive,
            createdById: label.createdById || defaultUserId,
            legacyLabelId: label.id,
          },
        });
        stats.byType['LABEL'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Label ${label.labelCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['LABEL'].scanned}, Migrated: ${stats.byType['LABEL'].migrated}, Skipped: ${stats.byType['LABEL'].skipped}`);
}

async function migratePackagingMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing packaging_master...');

  const packages = await prisma.packaging_master.findMany({
    where: { isActive: true },
  });

  stats.byType['PACKAGING'] = { scanned: packages.length, migrated: 0, skipped: 0 };
  stats.totalScanned += packages.length;

  console.log(`  Found ${packages.length} active records`);

  for (const pkg of packages) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyPackagingId: pkg.id },
      });

      if (existing) {
        stats.byType['PACKAGING'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.PACKAGING,
            code: pkg.packagingCode,
            name: pkg.packagingName,
            description: pkg.description,
            pricePerPiece: pkg.pricePerPiece,
            unit: 'piece',
            specifications: {
              packagingType: pkg.packagingType,
              size: pkg.size,
              material: pkg.material,
              thickness: pkg.thickness,
              printDetails: pkg.printDetails,
              pricePerHundred: toNumber(pkg.pricePerHundred),
              image: pkg.image,
              supplierCode: pkg.supplierCode,
              buyerCode: pkg.buyerCode,
            },
            isActive: pkg.isActive,
            createdById: pkg.createdById || defaultUserId,
            legacyPackagingId: pkg.id,
          },
        });
        stats.byType['PACKAGING'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Packaging ${pkg.packagingCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['PACKAGING'].scanned}, Migrated: ${stats.byType['PACKAGING'].migrated}, Skipped: ${stats.byType['PACKAGING'].skipped}`);
}

async function migrateMachinePartMaster(stats: MigrationStats, execute: boolean, defaultUserId: string) {
  console.log('\n📊 Processing machine_part_master...');

  const parts = await prisma.machine_part_master.findMany({
    where: { isActive: true },
  });

  stats.byType['MACHINE_PART'] = { scanned: parts.length, migrated: 0, skipped: 0 };
  stats.totalScanned += parts.length;

  console.log(`  Found ${parts.length} active records`);

  for (const part of parts) {
    try {
      // Check if already migrated
      const existing = await prisma.material_master.findFirst({
        where: { legacyMachinePartId: part.id },
      });

      if (existing) {
        stats.byType['MACHINE_PART'].skipped++;
        continue;
      }

      if (execute) {
        await prisma.material_master.create({
          data: {
            materialType: MaterialType.MACHINE_PART,
            code: part.partCode,
            name: part.partName,
            description: part.description,
            pricePerUnit: part.pricePerUnit,
            unit: 'piece',
            specifications: {
              partNumber: part.partNumber,
              category: part.category,
              machine: part.machine,
              brand: part.brand,
              model: part.model,
              specifications: part.specifications,
              image: part.image,
            },
            isActive: part.isActive,
            createdById: part.createdById || defaultUserId,
            legacyMachinePartId: part.id,
          },
        });
        stats.byType['MACHINE_PART'].migrated++;
        stats.totalMigrated++;
      }
    } catch (error: any) {
      stats.errors.push(`Machine Part ${part.partCode}: ${error.message}`);
    }
  }

  console.log(`  ✓ Scanned: ${stats.byType['MACHINE_PART'].scanned}, Migrated: ${stats.byType['MACHINE_PART'].migrated}, Skipped: ${stats.byType['MACHINE_PART'].skipped}`);
}

async function runMigration() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  console.log('═'.repeat(60));
  console.log('  Material Master Consolidation Migration');
  console.log('═'.repeat(60));
  console.log(`\nMode: ${execute ? '🚀 EXECUTE (will modify database)' : '📊 ANALYSIS ONLY (dry run)'}`);

  if (execute) {
    console.log('\n⚠️  WARNING: This will MODIFY the database!');
    console.log('Press Ctrl+C now to cancel, or wait 3 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const stats: MigrationStats = {
    totalScanned: 0,
    totalMigrated: 0,
    byType: {},
    errors: [],
  };

  try {
    // Get default user for records without createdById
    const defaultUserId = await getDefaultUserId();
    console.log(`\nUsing default user ID: ${defaultUserId}`);

    // Check current material_master count
    const currentCount = await prisma.material_master.count();
    console.log(`\nCurrent material_master records: ${currentCount}`);

    // Migrate each material type
    await migrateLaceMaster(stats, execute, defaultUserId);
    await migrateButtonMaster(stats, execute, defaultUserId);
    await migrateThreadMaster(stats, execute, defaultUserId);
    await migrateZipperMaster(stats, execute, defaultUserId);
    await migrateElasticMaster(stats, execute, defaultUserId);
    await migrateLabelMaster(stats, execute, defaultUserId);
    await migratePackagingMaster(stats, execute, defaultUserId);
    await migrateMachinePartMaster(stats, execute, defaultUserId);

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('  Migration Summary');
    console.log('═'.repeat(60));
    console.log(`\nTotal scanned:  ${stats.totalScanned}`);
    console.log(`Total migrated: ${stats.totalMigrated}`);

    console.log('\nBy Material Type:');
    for (const [type, counts] of Object.entries(stats.byType)) {
      console.log(`  ${type.padEnd(15)} : Scanned ${counts.scanned.toString().padStart(4)}, Migrated ${counts.migrated.toString().padStart(4)}, Skipped ${counts.skipped.toString().padStart(4)}`);
    }

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Final count
    const finalCount = await prisma.material_master.count();
    console.log(`\nFinal material_master records: ${finalCount}`);

    if (!execute) {
      console.log('\n💡 To execute the migration, run:');
      console.log('   npx ts-node scripts/migrations/consolidate-material-masters.ts --execute');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
