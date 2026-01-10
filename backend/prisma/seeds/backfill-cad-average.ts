/**
 * Backfill Script: Calculate and store cadAverage for existing CAD records
 *
 * This script calculates cadAverage for all fabric_width_cad records that have:
 * - cadMeters (layer length)
 * - piecesPerMarker > 0
 *
 * Formula: cadAverage = (cadMeters + layerMarginMeters) / piecesPerMarker
 *
 * Run with: npx ts-node prisma/seeds/backfill-cad-average.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillCadAverage() {
  console.log('Starting CAD Average backfill...\n');

  // Find all CAD records with cadMeters and piecesPerMarker
  const records = await prisma.fabric_width_cad.findMany({
    where: {
      cadMeters: { not: null },
      piecesPerMarker: { gt: 0 },
    },
    select: {
      id: true,
      cadMeters: true,
      layerMarginMeters: true,
      piecesPerMarker: true,
      cadAverage: true,
    },
  });

  console.log(`Found ${records.length} CAD records to process\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const rec of records) {
    try {
      const layerLength = Number(rec.cadMeters) || 0;
      const margin = Number(rec.layerMarginMeters) || 0;
      const pieces = rec.piecesPerMarker || 0;

      if (pieces <= 0) {
        skipped++;
        continue;
      }

      const cadAverage = (layerLength + margin) / pieces;

      // Check if already has same value (avoid unnecessary updates)
      const existingCadAvg = rec.cadAverage ? Number(rec.cadAverage) : null;
      if (existingCadAvg !== null && Math.abs(existingCadAvg - cadAverage) < 0.0001) {
        skipped++;
        continue;
      }

      await prisma.fabric_width_cad.update({
        where: { id: rec.id },
        data: { cadAverage },
      });

      updated++;

      // Log progress every 100 records
      if (updated % 100 === 0) {
        console.log(`  Processed ${updated} records...`);
      }
    } catch (error) {
      console.error(`  Error updating record ${rec.id}:`, error);
      errors++;
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${records.length}`);
}

backfillCadAverage()
  .then(() => {
    console.log('\nBackfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
