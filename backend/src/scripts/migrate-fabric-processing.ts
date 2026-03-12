/**
 * Migration Script: fabric_processing → processing_batch
 *
 * This script migrates existing fabric_processing records to the new
 * processing_batch/processing_stage system while preserving all data.
 *
 * Run with: npx ts-node -r dotenv/config src/scripts/migrate-fabric-processing.ts
 */

import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn } from '../utils/logger';

const prisma = new PrismaClient();

interface MigrationStats {
  totalRecords: number;
  migrated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ id: string; error: string }>;
}

async function migrateFabricProcessing() {
  const stats: MigrationStats = {
    totalRecords: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    logInfo('Starting fabric_processing migration...');

    // Get all fabric_processing records
    const oldRecords = await prisma.fabric_processing.findMany({
      include: {
        greigeMaster: true,
        processingMill: true,
        finishedFabric: true,
        procurement: true,
        createdBy: true,
      },
      orderBy: { sentDate: 'asc' },
    });

    stats.totalRecords = oldRecords.length;
    logInfo(`Found ${stats.totalRecords} fabric_processing records to migrate`);

    // Get or create JOB_WORK warehouse
    let jobWorkWarehouse = await prisma.warehouses.findFirst({
      where: { warehouseType: 'JOB_WORK' },
    });

    if (!jobWorkWarehouse) {
      logWarn('JOB_WORK warehouse not found, creating...');
      jobWorkWarehouse = await prisma.warehouses.create({
        data: {
          warehouseCode: 'JOB-WORK-001',
          warehouseName: 'Job Work - Processing Materials',
          warehouseType: 'JOB_WORK', createdById: 'system',
          isVirtual: true,
          isActive: true,
          address: 'Virtual Warehouse for Job Work Tracking',
        },
      });
      logInfo(`Created JOB_WORK warehouse: ${jobWorkWarehouse.id}`);
    }

    // Migrate each record
    for (const oldRecord of oldRecords) {
      try {
        // Check if already migrated (by batchNumber if it exists)
        if (oldRecord.batchNumber) {
          const existing = await prisma.processing_batch.findFirst({
            where: {
              OR: [
                { batchNumber: oldRecord.batchNumber },
                {
                  AND: [
                    { greigeId: oldRecord.greigeId },
                    { createdAt: oldRecord.createdAt },
                  ],
                },
              ],
            },
          });

          if (existing) {
            logWarn(`Record ${oldRecord.id} already migrated, skipping`);
            stats.skipped++;
            continue;
          }
        }

        // Generate batch number if not present
        const batchNumber = oldRecord.batchNumber || await generateMigrationBatchNumber();

        // Map processingStatus to BatchStatus
        let batchStatus: string;
        switch (oldRecord.processingStatus) {
          case 'COMPLETED':
          case 'PARTIAL_COMPLETED':
            batchStatus = 'COMPLETED';
            break;
          case 'REJECTED':
            batchStatus = 'CANCELLED';
            break;
          case 'SENT':
          case 'IN_PROCESS':
          default:
            batchStatus = 'ACTIVE';
        }

        // Map processingStatus to StageStatus
        let stageStatus: string;
        switch (oldRecord.processingStatus) {
          case 'SENT':
            stageStatus = 'AT_PROCESSOR';
            break;
          case 'IN_PROCESS':
            stageStatus = 'IN_PROCESS';
            break;
          case 'COMPLETED':
          case 'PARTIAL_COMPLETED':
            stageStatus = 'COMPLETED';
            break;
          case 'REJECTED':
            stageStatus = 'REWORK_REQUIRED';
            break;
          default:
            stageStatus = 'PENDING';
        }

        // Create processing_batch
        const batch = await prisma.$transaction(async (tx) => {
          const newBatch = await tx.processing_batch.create({
            data: {
              batchNumber,
              materialType: 'GREIGE', // All old records are greige-based
              greigeId: oldRecord.greigeId,
              totalQuantitySent: oldRecord.greigeQuantitySent,
              totalQuantityReceived: oldRecord.actualQuantityReceived || 0,
              quantityInProcess:
                oldRecord.processingStatus === 'COMPLETED'
                  ? 0
                  : oldRecord.greigeQuantitySent,
              quantityInTransit: 0,
              quantityRejected:
                oldRecord.processingStatus === 'REJECTED'
                  ? oldRecord.greigeQuantitySent
                  : 0,
              overallStatus: batchStatus,
              totalCostIncurred: oldRecord.totalFinishedCost ?? undefined,
              createdById: oldRecord.createdById,
              createdAt: oldRecord.createdAt,
              updatedAt: oldRecord.updatedAt,
            },
          });

          // Create processing_stage (single stage for old records)
          const stage = await tx.processing_stage.create({
            data: {
              batchId: newBatch.id,
              stageNumber: 1,
              processorId: oldRecord.processingMillId,
              processingType: oldRecord.processingType,
              quantitySent: oldRecord.greigeQuantitySent,
              quantityReceived: oldRecord.actualQuantityReceived || 0,
              quantityInProcess:
                oldRecord.processingStatus === 'COMPLETED'
                  ? 0
                  : oldRecord.greigeQuantitySent,
              processSpecifications: oldRecord.processSpecifications,
              expectedOutputSpecs: {
                widthMin: oldRecord.expectedFinishedWidthMin?.toString() ?? '0',
                widthMax: oldRecord.expectedFinishedWidthMax?.toString() ?? '0',
                shrinkagePercent: oldRecord.expectedShrinkagePercent?.toString() ?? '0',
              },
              actualOutputSpecs:
                oldRecord.actualFinishedWidth && oldRecord.actualShrinkagePercent
                  ? {
                      width: oldRecord.actualFinishedWidth.toString(),
                      shrinkagePercent: oldRecord.actualShrinkagePercent.toString(),
                      widthVariance: oldRecord.widthVarianceInches?.toString(),
                      shrinkageVariance:
                        oldRecord.shrinkageVariancePercent?.toString(),
                      millAvgShrinkage: oldRecord.millAvgShrinkage?.toString(),
                    }
                  : undefined,
              status: stageStatus,
              sentDate: oldRecord.sentDate,
              expectedCompletionDate: oldRecord.expectedReturnDate,
              actualCompletionDate: oldRecord.actualReturnDate,
              processingCost: oldRecord.processingCost ?? 0,
              qualityNotes: oldRecord.qualityNotes,
              reworkReason: oldRecord.rejectionReason,
            },
          });

          // If completed, create delivery record
          if (
            oldRecord.processingStatus === 'COMPLETED' ||
            oldRecord.processingStatus === 'PARTIAL_COMPLETED'
          ) {
            const deliveryNumber = await generateDeliveryNumber(tx);

            await tx.processing_delivery.create({
              data: {
                batchId: newBatch.id,
                stageId: stage.id,
                deliveryNumber,
                quantityDelivered: oldRecord.actualQuantityReceived || 0,
                quantityAccepted: oldRecord.actualQuantityReceived || 0,
                quantityRejected: oldRecord.processingLossMeters || 0,
                qualityStatus: 'ACCEPTED',
                qualityNotes: oldRecord.qualityNotes,
                deliveryDate: oldRecord.actualReturnDate ?? oldRecord.sentDate ?? new Date(),
                qcDate: oldRecord.actualReturnDate,
                acceptanceDate: oldRecord.actualReturnDate,
                receivedById: oldRecord.createdById,
              },
            });
          }

          return newBatch;
        });

        logInfo(`Migrated record ${oldRecord.id} → batch ${batch.batchNumber}`);
        stats.migrated++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logError(
          `Failed to migrate record ${oldRecord.id}: ${errorMessage}`
        );
        stats.errors++;
        stats.errorDetails.push({ id: oldRecord.id, error: errorMessage });
      }
    }

    // Log summary
    logInfo('Migration completed!');
    logInfo(`Total records: ${stats.totalRecords}`);
    logInfo(`Successfully migrated: ${stats.migrated}`);
    logInfo(`Skipped (already migrated): ${stats.skipped}`);
    logInfo(`Errors: ${stats.errors}`);

    if (stats.errors > 0) {
      logError('Error details:');
      stats.errorDetails.forEach((err) => {
        logError(`  - ${err.id}: ${err.error}`);
      });
    }

    return stats;
  } catch (error) {
    logError('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate migration batch number (MIGPB + year + month + sequence)
 */
async function generateMigrationBatchNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

  const latestBatch = await prisma.processing_batch.findFirst({
    where: {
      batchNumber: {
        startsWith: `MIGPB${year}${month}`,
      },
    },
    orderBy: {
      batchNumber: 'desc',
    },
  });

  let sequence = 1;
  if (latestBatch) {
    const lastSequence = parseInt(latestBatch.batchNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `MIGPB${year}${month}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Generate delivery number
 */
async function generateDeliveryNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

  const latestDelivery = await tx.processing_delivery.findFirst({
    where: {
      deliveryNumber: {
        startsWith: `DEL${year}${month}`,
      },
    },
    orderBy: {
      deliveryNumber: 'desc',
    },
  });

  let sequence = 1;
  if (latestDelivery) {
    const lastSequence = parseInt(latestDelivery.deliveryNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `DEL${year}${month}-${sequence.toString().padStart(4, '0')}`;
}

// Run migration if executed directly
if (require.main === module) {
  migrateFabricProcessing()
    .then((stats) => {
      console.log('\n=== Migration Summary ===');
      console.log(`Total records: ${stats.totalRecords}`);
      console.log(`Migrated: ${stats.migrated}`);
      console.log(`Skipped: ${stats.skipped}`);
      console.log(`Errors: ${stats.errors}`);
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateFabricProcessing };
