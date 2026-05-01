/**
 * Backfill Specialized Stock from Stock Movements
 *
 * This script migrates existing STOCK_IN movements to their appropriate
 * specialized stock tables (greige_stock, fabric_stock, lace_stock, etc.).
 *
 * Purpose: Fix data created via manual Stock IN that only updated stock_levels
 * but didn't create entries in specialized stock tables.
 *
 * Run: cd backend && npx ts-node scripts/backfill-specialized-stock-from-movements.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillStats {
  totalMovements: number;
  processed: number;
  skipped: number;
  created: Record<string, number>;
  errors: number;
}

async function getSystemUser(): Promise<string> {
  const user = await prisma.users.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error('No active user found for backfill');
  return user.id;
}

async function backfillSpecializedStock() {
  console.log('=== Backfill Specialized Stock from Stock Movements ===\n');

  const stats: BackfillStats = {
    totalMovements: 0,
    processed: 0,
    skipped: 0,
    created: {},
    errors: 0,
  };

  // Get system user for createdById
  const systemUserId = await getSystemUser();
  console.log(`Using system user: ${systemUserId}\n`);

  // Fetch all STOCK_IN movements
  const movements = await prisma.stock_movements.findMany({
    where: { movementType: 'STOCK_IN' },
    include: {
      materials: {
        select: {
          id: true,
          code: true,
          greigeId: true,
          fabricId: true,
          laceId: true,
          threadId: true,
          buttonId: true,
          zipperId: true,
          elasticId: true,
          labelId: true,
          packagingId: true,
          machinePartId: true,
          otherMaterialId: true,
          greige_master: { select: { greigeWidth: true } },
          fabric_master: { select: { actualWidth: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  stats.totalMovements = movements.length;
  console.log(`Found ${stats.totalMovements} STOCK_IN movements to process\n`);

  for (const movement of movements) {
    const material = movement.materials;
    if (!material) {
      console.log(`  SKIP: Movement ${movement.id} has no material`);
      stats.skipped++;
      continue;
    }

    const qty = Number(movement.quantity);
    const rate = movement.rate ? Number(movement.rate) : 0;
    const userId = movement.performedById || systemUserId;

    try {
      // Check if specialized stock already exists for this movement
      // (to avoid creating duplicates if script runs multiple times)

      if (material.greigeId) {
        // Check for existing greige_stock entry with matching parameters
        const existing = await prisma.greige_stock.findFirst({
          where: {
            greigeId: material.greigeId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: greige_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        // Create greige_stock entry
        const width = Number(material.greige_master?.greigeWidth) || 44;
        await prisma.greige_stock.create({
          data: {
            greigeId: material.greigeId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            greigeWidth: new Prisma.Decimal(width),
            cutableWidth: new Prisma.Decimal(width - 2),
            unit: movement.unit || 'METER',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['GREIGE'] = (stats.created['GREIGE'] || 0) + 1;
        console.log(`  CREATED: greige_stock for ${material.code} (${qty} m)`);
      } else if (material.fabricId) {
        const existing = await prisma.fabric_stock.findFirst({
          where: {
            fabricId: material.fabricId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: fabric_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        const width = Number(material.fabric_master?.actualWidth) || 44;
        await prisma.fabric_stock.create({
          data: {
            fabricId: material.fabricId,
            finishedWidth: new Prisma.Decimal(width),
            cutableWidth: new Prisma.Decimal(width - 2),
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'meters',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['FABRIC'] = (stats.created['FABRIC'] || 0) + 1;
        console.log(`  CREATED: fabric_stock for ${material.code} (${qty} m)`);
      } else if (material.laceId) {
        const existing = await prisma.lace_stock.findFirst({
          where: {
            laceId: material.laceId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: lace_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.lace_stock.create({
          data: {
            laceId: material.laceId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['LACE'] = (stats.created['LACE'] || 0) + 1;
        console.log(`  CREATED: lace_stock for ${material.code} (${qty})`);
      } else if (material.threadId) {
        const existing = await prisma.thread_stock.findFirst({
          where: {
            threadId: material.threadId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: thread_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.thread_stock.create({
          data: {
            threadId: material.threadId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'SPOOL',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['THREAD'] = (stats.created['THREAD'] || 0) + 1;
        console.log(`  CREATED: thread_stock for ${material.code} (${qty})`);
      } else if (material.buttonId) {
        const existing = await prisma.button_stock.findFirst({
          where: {
            buttonId: material.buttonId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: button_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.button_stock.create({
          data: {
            buttonId: material.buttonId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'pieces',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['BUTTON'] = (stats.created['BUTTON'] || 0) + 1;
        console.log(`  CREATED: button_stock for ${material.code} (${qty})`);
      } else if (material.zipperId) {
        const existing = await prisma.zipper_stock.findFirst({
          where: {
            zipperId: material.zipperId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: zipper_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.zipper_stock.create({
          data: {
            zipperId: material.zipperId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'pieces',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['ZIPPER'] = (stats.created['ZIPPER'] || 0) + 1;
        console.log(`  CREATED: zipper_stock for ${material.code} (${qty})`);
      } else if (material.elasticId) {
        const existing = await prisma.elastic_stock.findFirst({
          where: {
            elasticId: material.elasticId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: elastic_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.elastic_stock.create({
          data: {
            elasticId: material.elasticId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'meters',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['ELASTIC'] = (stats.created['ELASTIC'] || 0) + 1;
        console.log(`  CREATED: elastic_stock for ${material.code} (${qty})`);
      } else if (material.labelId) {
        const existing = await prisma.label_stock.findFirst({
          where: {
            labelId: material.labelId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: label_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.label_stock.create({
          data: {
            labelId: material.labelId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'pieces',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['LABEL'] = (stats.created['LABEL'] || 0) + 1;
        console.log(`  CREATED: label_stock for ${material.code} (${qty})`);
      } else if (material.packagingId) {
        const existing = await prisma.packaging_stock.findFirst({
          where: {
            packagingId: material.packagingId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: packaging_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.packaging_stock.create({
          data: {
            packagingId: material.packagingId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'pieces',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['PACKAGING'] = (stats.created['PACKAGING'] || 0) + 1;
        console.log(`  CREATED: packaging_stock for ${material.code} (${qty})`);
      } else if (material.machinePartId) {
        const existing = await prisma.machine_part_stock.findFirst({
          where: {
            machinePartId: material.machinePartId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: machine_part_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.machine_part_stock.create({
          data: {
            machinePartId: material.machinePartId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'pieces',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['MACHINE_PART'] = (stats.created['MACHINE_PART'] || 0) + 1;
        console.log(`  CREATED: machine_part_stock for ${material.code} (${qty})`);
      } else if (material.otherMaterialId) {
        const existing = await prisma.other_material_stock.findFirst({
          where: {
            otherMaterialId: material.otherMaterialId,
            quantityAvailable: { gte: qty - 0.01, lte: qty + 0.01 },
            receivedDate: {
              gte: new Date(movement.createdAt.getTime() - 60000),
              lte: new Date(movement.createdAt.getTime() + 60000),
            },
          },
        });

        if (existing) {
          console.log(`  SKIP: other_material_stock already exists for ${material.code}`);
          stats.skipped++;
          continue;
        }

        await prisma.other_material_stock.create({
          data: {
            otherMaterialId: material.otherMaterialId,
            quantityAvailable: new Prisma.Decimal(qty),
            quantityReserved: new Prisma.Decimal(0),
            quantityConsumed: new Prisma.Decimal(0),
            unit: 'pieces',
            purchaseCost: new Prisma.Decimal(rate),
            weightedAvgCost: new Prisma.Decimal(rate),
            qualityGrade: 'A',
            warehouseId: movement.warehouseId,
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            sourceType: 'MANUAL',
            receivedDate: movement.createdAt,
            createdById: userId,
          },
        });
        stats.created['OTHER_MATERIAL'] = (stats.created['OTHER_MATERIAL'] || 0) + 1;
        console.log(`  CREATED: other_material_stock for ${material.code} (${qty})`);
      } else {
        // Generic material - no specialized table
        console.log(`  SKIP: ${material.code} is generic (no specialized FK)`);
        stats.skipped++;
      }

      stats.processed++;
    } catch (error) {
      console.error(`  ERROR processing ${material.code}:`, error);
      stats.errors++;
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Total movements: ${stats.totalMovements}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('\nCreated by type:');
  for (const [type, count] of Object.entries(stats.created)) {
    console.log(`  ${type}: ${count}`);
  }
}

backfillSpecializedStock()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
