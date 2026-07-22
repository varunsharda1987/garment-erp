/**
 * Cleanup orphaned greige_stock and fabric_procurement records
 *
 * These records were created outside the parent transaction during failed Stock IN attempts.
 * They have no corresponding stock_movements record.
 *
 * Run with: cd backend && npx ts-node scripts/cleanup-orphan-stock.ts
 */

import prisma from '../src/config/database';

async function cleanupOrphanRecords() {
  console.log('=== Cleanup Orphaned Stock Records ===\n');

  // Find greige_stock records from today that might be orphans
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all greige stock created today
  const greigeStocks = await prisma.greige_stock.findMany({
    where: {
      createdAt: { gte: today },
      sourceType: 'MANUAL',
    },
    select: {
      id: true,
      greigeId: true,
      quantityAvailable: true,
      procurementId: true,
      createdAt: true,
      greige: { select: { greigeCode: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${greigeStocks.length} greige_stock records from today\n`);

  // For each, check if there's a corresponding stock_movement
  const orphans: typeof greigeStocks = [];

  for (const gs of greigeStocks) {
    // Look for stock_movement with this quantity around the same time
    const movement = await prisma.stock_movements.findFirst({
      where: {
        createdAt: {
          gte: new Date(gs.createdAt.getTime() - 60000), // 1 min before
          lte: new Date(gs.createdAt.getTime() + 60000), // 1 min after
        },
        movementType: 'STOCK_IN',
        quantity: gs.quantityAvailable,
      },
    });

    if (!movement) {
      orphans.push(gs);
    }
  }

  console.log(`Found ${orphans.length} potential orphans (no matching stock_movement):\n`);

  for (const o of orphans) {
    console.log(`  - ${o.greige?.greigeCode}: ${o.quantityAvailable} meters, created ${o.createdAt.toISOString()}`);
    console.log(`    greige_stock.id: ${o.id}`);
    console.log(`    procurementId: ${o.procurementId}`);
    console.log('');
  }

  if (orphans.length === 0) {
    console.log('No orphans found. Nothing to clean up.');
    await prisma.$disconnect();
    return;
  }

  // Ask for confirmation
  console.log('\n⚠️  To delete these orphans, run with --delete flag');
  console.log('    npx ts-node scripts/cleanup-orphan-stock.ts --delete\n');

  if (process.argv.includes('--delete')) {
    console.log('Deleting orphans...\n');

    for (const o of orphans) {
      // Delete greige_stock first
      await prisma.greige_stock.delete({ where: { id: o.id } });
      console.log(`  Deleted greige_stock: ${o.id}`);

      // Delete associated fabric_procurement if exists
      if (o.procurementId) {
        try {
          await prisma.fabric_procurement.delete({ where: { id: o.procurementId } });
          console.log(`  Deleted fabric_procurement: ${o.procurementId}`);
        } catch (e) {
          console.log(`  Could not delete procurement (may have other refs): ${o.procurementId}`);
        }
      }
    }

    console.log('\n✅ Cleanup complete!');
  }

  await prisma.$disconnect();
}

cleanupOrphanRecords().catch((e) => {
  console.error(e);
  process.exit(1);
});
