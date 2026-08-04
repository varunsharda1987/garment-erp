/**
 * P1.11 Backfill Script: Requirement Price Snapshots
 *
 * Purpose: Populate unitPrice/rateSource/orderBomItemId for existing requirements
 * that were created before P1 snapshot changes.
 *
 * Run: cd backend && npx ts-node scripts/backfill-requirement-snapshots.ts
 *
 * Safe to run multiple times (idempotent).
 */

import prisma from '../src/config/database';

async function backfillRequirementSnapshots() {
  console.log('=== P1.11 Backfill: Requirement Price Snapshots ===\n');

  // Find OPEN requirements without snapshot (unitPrice is null)
  const openStatuses = ['PENDING', 'FULFILLED_STOCK', 'PARTIAL_STOCK', 'PO_REQUIRED', 'PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'];

  const requirementsToBackfill = await prisma.material_requirements.findMany({
    where: {
      unitPrice: null,
      status: { in: openStatuses as any },
      orderBomId: { not: null }, // Must have a BOM reference to look up price
    },
    select: {
      id: true,
      requirementNumber: true,
      materialId: true,
      orderBomId: true,
      requirementType: true,
      colorName: true,
      componentName: true,
    },
  });

  console.log(`Found ${requirementsToBackfill.length} requirements without price snapshot\n`);

  if (requirementsToBackfill.length === 0) {
    console.log('Nothing to backfill. All requirements already have snapshots.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const req of requirementsToBackfill) {
    try {
      // Find the matching BOM item
      const bomItem = await prisma.order_bom_items.findFirst({
        where: {
          orderBomId: req.orderBomId!,
          OR: [
            // Match by materialId (for trims, etc.)
            { materialId: req.materialId },
            // Match by fabricId (for fabrics)
            { fabricId: req.materialId },
            // Match by greigeId (for greige)
            { greigeId: req.materialId },
          ],
          // Additional matching by color/component if available
          ...(req.colorName ? { colorName: req.colorName } : {}),
          ...(req.componentName ? { componentName: { contains: req.componentName } } : {}),
        },
        select: {
          id: true,
          unitPrice: true,
          greigeCost: true,
          processingCost: true,
          materialType: true,
        },
      });

      if (!bomItem) {
        console.log(`  [SKIP] ${req.requirementNumber}: No matching BOM item found`);
        skipped++;
        continue;
      }

      // Determine the price based on requirement type
      let snapshotPrice: number | null = null;

      if (req.requirementType === 'PROCESSING') {
        // Processing requirements use processingCost
        snapshotPrice = bomItem.processingCost ? Number(bomItem.processingCost) : null;
      } else if (bomItem.materialType === 'GREIGE') {
        // Greige requirements use greigeCost
        snapshotPrice = bomItem.greigeCost ? Number(bomItem.greigeCost) : Number(bomItem.unitPrice) || null;
      } else {
        // Standard materials use unitPrice
        snapshotPrice = bomItem.unitPrice ? Number(bomItem.unitPrice) : null;
      }

      if (snapshotPrice === null || snapshotPrice === 0) {
        console.log(`  [SKIP] ${req.requirementNumber}: BOM item has no price (unitPrice=${bomItem.unitPrice}, greigeCost=${bomItem.greigeCost})`);
        skipped++;
        continue;
      }

      // Update the requirement with snapshot
      await prisma.material_requirements.update({
        where: { id: req.id },
        data: {
          unitPrice: snapshotPrice,
          rateSource: 'ORDER_BOM',
          orderBomItemId: bomItem.id,
        },
      });

      console.log(`  [OK] ${req.requirementNumber}: Set unitPrice=${snapshotPrice}, rateSource=ORDER_BOM`);
      updated++;

    } catch (err: any) {
      console.error(`  [ERROR] ${req.requirementNumber}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors:  ${errors}`);
  console.log(`Total:   ${requirementsToBackfill.length}`);
}

// Run
backfillRequirementSnapshots()
  .then(() => {
    console.log('\nBackfill complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
