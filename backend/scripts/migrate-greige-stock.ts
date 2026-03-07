/**
 * Migration Script: Migrate proxy fabric_master records to greige_stock table
 *
 * This script:
 * 1. Finds all proxy fabric_master records (finishType='GREIGE', colorName='RAW', isGeneric=true)
 * 2. Finds linked fabric_stock records
 * 3. Creates equivalent greige_stock records
 * 4. Optionally deletes the old proxy records
 *
 * Run with: npx ts-node scripts/migrate-greige-stock.ts [--dry-run] [--cleanup]
 *   --dry-run: Show what would be migrated without making changes
 *   --cleanup: Delete proxy records after migration (use with caution!)
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ProxyFabricRecord {
  id: string;
  fabricCode: string;
  fabricName: string;
  greigeId: string | null;
  actualWidth: Prisma.Decimal | null;
}

interface FabricStockRecord {
  id: string;
  fabricId: string;
  finishedWidth: Prisma.Decimal;
  cutableWidth: Prisma.Decimal | null;
  quantityAvailable: Prisma.Decimal;
  quantityReserved: Prisma.Decimal;
  quantityConsumed: Prisma.Decimal;
  unit: string;
  procurementId: string | null;
  warehouseLocation: string | null;
  rollNumbers: string | null;
  qualityGrade: string;
  purchaseCost: Prisma.Decimal | null;
  weightedAvgCost: Prisma.Decimal | null;
  receivedDate: Date;
  agingDays: number;
  status: string;
  stockType: string;
  createdById: string;
}

async function migrateGreigeStock(dryRun: boolean = false, cleanup: boolean = false) {
  console.log('='.repeat(60));
  console.log('GREIGE STOCK MIGRATION SCRIPT');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Cleanup: ${cleanup ? 'YES (will delete proxy records)' : 'NO'}`);
  console.log('');

  try {
    // Step 1: Find all proxy fabric_master records
    console.log('Step 1: Finding proxy fabric_master records...');
    const proxyFabrics = await prisma.fabric_master.findMany({
      where: {
        finishType: 'GREIGE',
        colorName: 'RAW',
        isGeneric: true,
      },
      select: {
        id: true,
        fabricCode: true,
        fabricName: true,
        greigeId: true,
        actualWidth: true,
      },
    }) as ProxyFabricRecord[];

    console.log(`Found ${proxyFabrics.length} proxy fabric_master records`);

    if (proxyFabrics.length === 0) {
      console.log('No proxy records to migrate. Exiting.');
      return;
    }

    // Step 2: For each proxy, find linked fabric_stock records
    console.log('\nStep 2: Finding linked fabric_stock records...');

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const proxyFabric of proxyFabrics) {
      console.log(`\nProcessing: ${proxyFabric.fabricCode}`);

      // Find linked stock records
      const stockRecords = await prisma.fabric_stock.findMany({
        where: { fabricId: proxyFabric.id },
      }) as FabricStockRecord[];

      if (stockRecords.length === 0) {
        console.log(`  - No stock records found, skipping`);
        skippedCount++;
        continue;
      }

      console.log(`  - Found ${stockRecords.length} stock record(s)`);

      // Check if greige exists
      if (!proxyFabric.greigeId) {
        console.log(`  - ERROR: No greigeId linked, cannot migrate`);
        errors.push(`${proxyFabric.fabricCode}: No greigeId`);
        errorCount++;
        continue;
      }

      const greige = await prisma.greige_master.findUnique({
        where: { id: proxyFabric.greigeId },
      });

      if (!greige) {
        console.log(`  - ERROR: Greige ${proxyFabric.greigeId} not found`);
        errors.push(`${proxyFabric.fabricCode}: Greige not found`);
        errorCount++;
        continue;
      }

      // Step 3: Create greige_stock records
      for (const stockRecord of stockRecords) {
        console.log(`  - Migrating stock record ${stockRecord.id}`);

        if (!dryRun) {
          try {
            // Check if already migrated
            const existing = await prisma.greige_stock.findFirst({
              where: {
                greigeId: proxyFabric.greigeId,
                procurementId: stockRecord.procurementId,
                greigeWidth: stockRecord.finishedWidth,
                qualityGrade: stockRecord.qualityGrade,
              },
            });

            if (existing) {
              console.log(`    Already migrated, skipping`);
              continue;
            }

            // Get supplier from procurement if exists
            let supplierId: string | null = null;
            if (stockRecord.procurementId) {
              const procurement = await prisma.fabric_procurement.findUnique({
                where: { id: stockRecord.procurementId },
                select: { supplierId: true },
              });
              supplierId = procurement?.supplierId || null;
            }

            // Create greige_stock record
            await prisma.greige_stock.create({
              data: {
                greigeId: proxyFabric.greigeId,
                quantityAvailable: stockRecord.quantityAvailable,
                quantityReserved: stockRecord.quantityReserved,
                quantityConsumed: stockRecord.quantityConsumed,
                unit: stockRecord.unit,
                greigeWidth: stockRecord.finishedWidth,
                cutableWidth: stockRecord.cutableWidth,
                purchaseCost: stockRecord.purchaseCost,
                weightedAvgCost: stockRecord.weightedAvgCost,
                procurementId: stockRecord.procurementId,
                supplierId: supplierId,
                warehouseLocation: stockRecord.warehouseLocation,
                rollNumbers: stockRecord.rollNumbers,
                qualityGrade: stockRecord.qualityGrade,
                receivedDate: stockRecord.receivedDate,
                agingDays: stockRecord.agingDays,
                status: stockRecord.status,
                stockType: stockRecord.stockType,
                createdById: stockRecord.createdById,
              },
            });

            console.log(`    Created greige_stock record`);
            migratedCount++;
          } catch (err) {
            console.log(`    ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`);
            errors.push(`${proxyFabric.fabricCode} stock ${stockRecord.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
            errorCount++;
          }
        } else {
          console.log(`    [DRY RUN] Would create greige_stock record`);
          migratedCount++;
        }
      }

      // Step 4: Cleanup (if enabled)
      if (cleanup && !dryRun) {
        console.log(`  - Cleaning up proxy records...`);

        // Delete fabric_stock records first (FK constraint)
        await prisma.fabric_stock.deleteMany({
          where: { fabricId: proxyFabric.id },
        });

        // Delete proxy fabric_master record
        await prisma.fabric_master.delete({
          where: { id: proxyFabric.id },
        });

        console.log(`    Deleted proxy fabric_master and linked fabric_stock`);
      } else if (cleanup && dryRun) {
        console.log(`  - [DRY RUN] Would delete proxy fabric_master and linked fabric_stock`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total proxy records found: ${proxyFabrics.length}`);
    console.log(`Stock records migrated: ${migratedCount}`);
    console.log(`Skipped (no stock): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach((err) => console.log(`  - ${err}`));
    }

    if (dryRun) {
      console.log('\n[DRY RUN] No changes were made. Run without --dry-run to apply changes.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const cleanup = args.includes('--cleanup');

if (args.includes('--help')) {
  console.log(`
Usage: npx ts-node scripts/migrate-greige-stock.ts [options]

Options:
  --dry-run   Show what would be migrated without making changes
  --cleanup   Delete proxy records after migration (use with caution!)
  --help      Show this help message

Examples:
  npx ts-node scripts/migrate-greige-stock.ts --dry-run        # Preview migration
  npx ts-node scripts/migrate-greige-stock.ts                   # Run migration
  npx ts-node scripts/migrate-greige-stock.ts --cleanup         # Migrate and cleanup
`);
  process.exit(0);
}

migrateGreigeStock(dryRun, cleanup)
  .then(() => {
    console.log('\nMigration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
