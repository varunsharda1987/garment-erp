/**
 * Backfill PO Source Script
 *
 * This script populates the `poSource` field for existing purchase orders.
 *
 * Logic:
 * 1. POs with `costSheetGenerationId` set → COST_SHEET
 * 2. POs with entries in `requirement_po_links` → MRP
 * 3. POs with service category (EMBROIDERY_SERVICE, WASHING_SERVICE, etc.) → SERVICE_REQUIREMENT
 * 4. All others → MANUAL
 *
 * Run with: npx ts-node scripts/backfill-po-source.ts
 */

import { PrismaClient, POSource, POCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Service PO categories that indicate SERVICE_REQUIREMENT source
const SERVICE_CATEGORIES: POCategory[] = [
  'EMBROIDERY_SERVICE',
  'WASHING_SERVICE',
  'FINISHING_SERVICE',
  'CUTTING_SERVICE',
  'STITCHING_SERVICE',
  'HANDWORK_SERVICE',
  'SMOCKING_SERVICE',
  'TRANSPORTATION_SERVICE',
];

async function backfillPOSource(): Promise<void> {
  console.log('Starting PO source backfill...\n');

  // Get counts before
  const beforeCounts = await prisma.purchase_orders.groupBy({
    by: ['poSource'],
    _count: { id: true },
  });

  console.log('Before backfill:');
  for (const c of beforeCounts) {
    console.log(`  ${c.poSource || 'NULL'}: ${c._count.id}`);
  }
  console.log();

  // 1. Mark Cost Sheet POs (have costSheetGenerationId)
  const costSheetResult = await prisma.purchase_orders.updateMany({
    where: {
      costSheetGenerationId: { not: null },
      poSource: null, // Only update if not already set
    },
    data: {
      poSource: POSource.COST_SHEET,
    },
  });
  console.log(`✓ Cost Sheet POs updated: ${costSheetResult.count}`);

  // 2. Mark MRP POs (have entries in requirement_po_links)
  // First, get unique PO IDs from requirement_po_links
  const mrpPOIds = await prisma.requirement_po_links.findMany({
    select: { purchaseOrderId: true },
    distinct: ['purchaseOrderId'],
  });

  if (mrpPOIds.length > 0) {
    const mrpResult = await prisma.purchase_orders.updateMany({
      where: {
        id: { in: mrpPOIds.map((r) => r.purchaseOrderId) },
        poSource: null, // Only update if not already set
        costSheetGenerationId: null, // Don't override Cost Sheet POs
      },
      data: {
        poSource: POSource.MRP,
      },
    });
    console.log(`✓ MRP POs updated: ${mrpResult.count}`);
  } else {
    console.log('✓ MRP POs updated: 0 (no requirement_po_links found)');
  }

  // 3. Mark Service POs (have service category)
  const serviceResult = await prisma.purchase_orders.updateMany({
    where: {
      poCategory: { in: SERVICE_CATEGORIES },
      poSource: null, // Only update if not already set
    },
    data: {
      poSource: POSource.SERVICE_REQUIREMENT,
    },
  });
  console.log(`✓ Service POs updated: ${serviceResult.count}`);

  // 4. Mark remaining as MANUAL
  const manualResult = await prisma.purchase_orders.updateMany({
    where: {
      poSource: null,
    },
    data: {
      poSource: POSource.MANUAL,
    },
  });
  console.log(`✓ Manual POs updated: ${manualResult.count}`);

  // Get counts after
  const afterCounts = await prisma.purchase_orders.groupBy({
    by: ['poSource'],
    _count: { id: true },
  });

  console.log('\nAfter backfill:');
  for (const c of afterCounts) {
    console.log(`  ${c.poSource || 'NULL'}: ${c._count.id}`);
  }

  // Summary
  const total = afterCounts.reduce((sum, c) => sum + c._count.id, 0);
  console.log(`\n✓ Backfill complete! Total POs: ${total}`);
}

// Main execution
async function main(): Promise<void> {
  try {
    await backfillPOSource();
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
