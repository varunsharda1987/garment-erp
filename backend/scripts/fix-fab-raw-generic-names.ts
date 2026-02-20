/**
 * Fix FAB-RAW-* fabrics with NULL genericGreigeName
 *
 * These fabrics were auto-created from greige processing but didn't inherit
 * the genericGreigeName from their parent greige.
 *
 * This script:
 * 1. Finds all fabric_master records where genericGreigeName is NULL
 * 2. For each, looks up the parent greige (via greigeId)
 * 3. Updates the fabric's genericGreigeName from the greige
 *
 * Run with: npx ts-node scripts/fix-fab-raw-generic-names.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFabRawGenericNames() {
  console.log('=== Fix FAB-RAW-* genericGreigeName Script ===\n');

  try {
    // Find fabrics with NULL genericGreigeName
    const fabricsToFix = await prisma.fabric_master.findMany({
      where: {
        genericGreigeName: null,
      },
      include: {
        greige: true,
      },
    });

    console.log(`Found ${fabricsToFix.length} fabrics with NULL genericGreigeName\n`);

    if (fabricsToFix.length === 0) {
      console.log('No fabrics to fix. Exiting.');
      return;
    }

    let fixedCount = 0;
    let skippedCount = 0;

    for (const fabric of fabricsToFix) {
      console.log(`Processing: ${fabric.fabricCode} - ${fabric.fabricName}`);

      if (!fabric.greigeId) {
        console.log(`  ⚠ No greigeId - skipping (manually set genericGreigeName if needed)`);
        skippedCount++;
        continue;
      }

      if (!fabric.greige) {
        console.log(`  ⚠ Greige not found for ID ${fabric.greigeId} - skipping`);
        skippedCount++;
        continue;
      }

      const greigeGenericName = fabric.greige.genericGreigeName;

      if (!greigeGenericName) {
        // Try to extract from greigeName using regex
        const match = fabric.greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        const extractedName = match ? match[1].trim() : fabric.greige.greigeName.split('/')[0].trim();

        console.log(`  ⓘ Greige has no genericGreigeName, extracted "${extractedName}" from greigeName`);

        await prisma.fabric_master.update({
          where: { id: fabric.id },
          data: { genericGreigeName: extractedName },
        });

        console.log(`  ✓ Updated genericGreigeName to "${extractedName}"`);
        fixedCount++;
      } else {
        await prisma.fabric_master.update({
          where: { id: fabric.id },
          data: { genericGreigeName: greigeGenericName },
        });

        console.log(`  ✓ Updated genericGreigeName to "${greigeGenericName}" (from greige)`);
        fixedCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Total processed: ${fabricsToFix.length}`);

  } catch (error) {
    console.error('Error fixing fabrics:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixFabRawGenericNames()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
