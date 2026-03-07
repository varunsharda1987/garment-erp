/**
 * Backfill BOM Sourcing Strategy Script
 *
 * This script populates the new sourcing strategy fields on existing order_bom_items
 * by copying values from their linked style_costing_fabric_items via the cost sheet.
 *
 * Fields to backfill:
 * - greigeId        (from fabric_master.greigeId if GREIGE_PROCESSED)
 * - processorId     (from style_costing_fabric_items.processorId)
 * - greigeCost      (from style_costing_fabric_items.greigeCost)
 * - processingCost  (from style_costing_fabric_items.processingCost)
 * - rateCardId      (from style_costing_fabric_items.rateCardId)
 *
 * Logic:
 * 1. Find all order_bom_items with a fabricId (fabric BOM items)
 * 2. For each, find the matching style_costing_fabric_item via:
 *    order_bom_items.orderBom.sourceCostSheetId → style_costing → fabricItems
 * 3. Match by fabricId
 * 4. Copy the sourcing strategy fields
 *
 * Run with: npx ts-node scripts/backfill-bom-sourcing-strategy.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillStats {
  totalBomItems: number;
  fabricBomItems: number;
  matchedItems: number;
  updatedItems: number;
  skippedItems: number;
  errors: string[];
}

async function backfillBomSourcingStrategy(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Backfill BOM Sourcing Strategy Script');
  console.log('='.repeat(60));
  console.log();

  const stats: BackfillStats = {
    totalBomItems: 0,
    fabricBomItems: 0,
    matchedItems: 0,
    updatedItems: 0,
    skippedItems: 0,
    errors: [],
  };

  // 1. Count total BOM items
  stats.totalBomItems = await prisma.order_bom_items.count();
  console.log(`Total BOM items in database: ${stats.totalBomItems}`);

  // 2. Find all fabric BOM items (those with fabricId set)
  const fabricBomItems = await prisma.order_bom_items.findMany({
    where: {
      fabricId: { not: null },
    },
    include: {
      orderBom: {
        select: {
          id: true,
          sourceCostSheetId: true,
        },
      },
      fabric_master: {
        select: {
          id: true,
          fabricCode: true,
          greigeId: true,
        },
      },
    },
  });

  stats.fabricBomItems = fabricBomItems.length;
  console.log(`Fabric BOM items to process: ${stats.fabricBomItems}`);
  console.log();

  if (stats.fabricBomItems === 0) {
    console.log('No fabric BOM items found. Nothing to backfill.');
    return;
  }

  // 3. Process each fabric BOM item
  for (const bomItem of fabricBomItems) {
    try {
      const sourceCostSheetId = bomItem.orderBom?.sourceCostSheetId;
      if (!sourceCostSheetId) {
        stats.skippedItems++;
        continue; // No cost sheet linked to this BOM
      }

      // Find the cost sheet and its fabric items
      const costSheet = await prisma.style_costing.findUnique({
        where: { id: sourceCostSheetId },
        include: {
          fabricItems: {
            where: {
              fabricId: bomItem.fabricId!,
            },
            include: {
              fabric: {
                select: {
                  greigeId: true,
                },
              },
            },
          },
        },
      });

      if (!costSheet || costSheet.fabricItems.length === 0) {
        stats.skippedItems++;
        continue; // No matching fabric item in cost sheet
      }

      const matchingFabricItem = costSheet.fabricItems[0];
      stats.matchedItems++;

      // Get greigeId from the fabric if sourcing strategy is GREIGE_PROCESSED
      const greigeIdFromFabric = matchingFabricItem.fabric?.greigeId || bomItem.fabric_master?.greigeId || null;
      const isGreigeProcessed = matchingFabricItem.sourcingStrategy === 'GREIGE_PROCESSED';

      // Check if any sourcing fields need to be updated
      const needsUpdate =
        bomItem.greigeId !== (isGreigeProcessed ? greigeIdFromFabric : null) ||
        bomItem.processorId !== matchingFabricItem.processorId ||
        Number(bomItem.greigeCost) !== Number(matchingFabricItem.greigeCost) ||
        Number(bomItem.processingCost) !== Number(matchingFabricItem.processingCost) ||
        bomItem.rateCardId !== matchingFabricItem.rateCardId ||
        bomItem.sourcingStrategy !== matchingFabricItem.sourcingStrategy;

      if (!needsUpdate) {
        stats.skippedItems++;
        continue; // Already has the correct values
      }

      // Update the BOM item
      await prisma.order_bom_items.update({
        where: { id: bomItem.id },
        data: {
          sourcingStrategy: matchingFabricItem.sourcingStrategy,
          greigeId: isGreigeProcessed ? greigeIdFromFabric : null,
          processorId: matchingFabricItem.processorId,
          greigeCost: matchingFabricItem.greigeCost,
          processingCost: matchingFabricItem.processingCost,
          rateCardId: matchingFabricItem.rateCardId,
        },
      });

      stats.updatedItems++;

      // Progress indicator
      if (stats.updatedItems % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stats.errors.push(`BOM Item ${bomItem.id}: ${errorMessage}`);
    }
  }

  console.log('\n');

  // 4. Print summary
  console.log('='.repeat(60));
  console.log('Backfill Complete');
  console.log('='.repeat(60));
  console.log(`Total BOM items:         ${stats.totalBomItems}`);
  console.log(`Fabric BOM items:        ${stats.fabricBomItems}`);
  console.log(`Matched to cost sheet:   ${stats.matchedItems}`);
  console.log(`Updated:                 ${stats.updatedItems}`);
  console.log(`Skipped (no changes):    ${stats.skippedItems}`);
  console.log(`Errors:                  ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\nErrors encountered:');
    stats.errors.slice(0, 10).forEach((err) => console.log(`  - ${err}`));
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  // 5. Verification - count items with sourcing fields set
  const itemsWithSourcingData = await prisma.order_bom_items.count({
    where: {
      OR: [
        { greigeId: { not: null } },
        { processorId: { not: null } },
        { processingCost: { not: null } },
      ],
    },
  });

  console.log('\n--- Verification ---');
  console.log(`BOM items with sourcing data: ${itemsWithSourcingData}`);
}

// Also backfill lace items
async function backfillLaceBomItems(): Promise<void> {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('Backfill Lace BOM Items');
  console.log('='.repeat(60));
  console.log();

  let updatedCount = 0;
  let skippedCount = 0;

  // Find all lace BOM items
  const laceBomItems = await prisma.order_bom_items.findMany({
    where: {
      laceId: { not: null },
    },
    include: {
      orderBom: {
        select: {
          id: true,
          sourceCostSheetId: true,
        },
      },
    },
  });

  console.log(`Lace BOM items to process: ${laceBomItems.length}`);

  for (const bomItem of laceBomItems) {
    try {
      const sourceCostSheetId = bomItem.orderBom?.sourceCostSheetId;
      if (!sourceCostSheetId) {
        skippedCount++;
        continue;
      }

      // Find the cost sheet and its lace items
      const costSheet = await prisma.style_costing.findUnique({
        where: { id: sourceCostSheetId },
        include: {
          laceItems: {
            where: {
              laceId: bomItem.laceId!,
            },
          },
        },
      });

      if (!costSheet || costSheet.laceItems.length === 0) {
        skippedCount++;
        continue;
      }

      const matchingLaceItem = costSheet.laceItems[0];

      // Check if needs update
      const needsUpdate =
        bomItem.processorId !== matchingLaceItem.processorId ||
        Number(bomItem.processingCost) !== Number(matchingLaceItem.processingCost);

      if (!needsUpdate) {
        skippedCount++;
        continue;
      }

      // Update the BOM item with processor info from cost sheet
      await prisma.order_bom_items.update({
        where: { id: bomItem.id },
        data: {
          processorId: matchingLaceItem.processorId,
          processingCost: matchingLaceItem.processingCost,
        },
      });

      updatedCount++;
    } catch {
      skippedCount++;
    }
  }

  console.log(`Lace BOM items updated: ${updatedCount}`);
  console.log(`Lace BOM items skipped: ${skippedCount}`);
}

async function main(): Promise<void> {
  try {
    await backfillBomSourcingStrategy();
    await backfillLaceBomItems();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
