/**
 * Add CAD Data Script
 *
 * Populates fabric_width_cad table with realistic CAD (Consumption Average per Dozen) data
 * for all fabric masters that don't already have CAD records.
 *
 * CAD varies based on:
 * - Fabric width (wider fabric = lower CAD due to better marker efficiency)
 * - Garment type (different styles have different consumption patterns)
 * - Marker efficiency (typically 80-90%)
 *
 * This script:
 * 1. Finds fabrics without CAD data
 * 2. Creates CAD records for common widths (56", 58", 60")
 * 3. Calculates realistic CAD values based on fabric width
 * 4. Sets appropriate marker efficiency and wastage percentages
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Realistic CAD calculation helper
function calculateCAD(fabricWidth: number, garmentType: string = 'shirt'): {
  cadMeters: number;
  cadYards: number;
  markerEfficiency: number;
  cadWastagePercent: number;
} {
  // Base CAD values for different garment types (in meters per dozen for 58" width)
  const baseCADs: Record<string, number> = {
    shirt: 18.0,      // Typical shirt: ~1.5m per piece
    trouser: 24.0,    // Trouser: ~2m per piece
    dress: 22.0,      // Dress: ~1.8m per piece
    tshirt: 15.0,     // T-shirt: ~1.25m per piece
  };

  const baseCAD = baseCADs[garmentType] || baseCADs.shirt;

  // Width efficiency factor (wider fabric = better efficiency)
  // 56" = 100%, 58" = 95%, 60" = 90%, 62" = 88%
  const widthFactor = 1 + (58 - fabricWidth) * 0.01;

  // Calculate CAD
  const cadMeters = Math.round((baseCAD * widthFactor) * 100) / 100;
  const cadYards = Math.round((cadMeters * 1.09361) * 100) / 100; // Convert to yards

  // Marker efficiency (wider fabrics have better efficiency)
  const markerEfficiency = Math.max(80, Math.min(92, 85 + (fabricWidth - 58) * 0.5));

  // Wastage percent (inversely related to width)
  const cadWastagePercent = Math.max(3, Math.min(8, 6 - (fabricWidth - 58) * 0.1));

  return {
    cadMeters: Math.round(cadMeters * 100) / 100,
    cadYards: Math.round(cadYards * 100) / 100,
    markerEfficiency: Math.round(markerEfficiency * 10) / 10,
    cadWastagePercent: Math.round(cadWastagePercent * 10) / 10,
  };
}

async function main() {
  console.log('📏 Starting CAD Data Population...\n');

  try {
    // Get admin user
    let adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      adminUser = await prisma.users.findFirst({
        where: { email: 'migration@system.local' },
      });
    }

    if (!adminUser) {
      throw new Error('No admin user found. Please create one first.');
    }

    const userId = adminUser.id;

    // Get all fabric masters
    const fabrics = await prisma.fabric_master.findMany({
      include: {
        widthCADs: true,
      },
    });

    console.log(`📊 Found ${fabrics.length} fabric masters\n`);

    let cadRecordsCreated = 0;
    const commonWidths = [56, 58, 60]; // Common fabric widths

    for (const fabric of fabrics) {
      console.log(`\n🎨 Processing: ${fabric.fabricName}`);
      console.log(`   Actual Width: ${Number(fabric.actualWidth)}"`);

      // If fabric already has CAD records, skip
      if (fabric.widthCADs.length > 0) {
        console.log(`   ℹ️  Already has ${fabric.widthCADs.length} CAD records - skipping`);
        continue;
      }

      // Determine which widths to create CAD for
      const widthsToCreate = new Set<number>();

      // Always include actual width
      widthsToCreate.add(Number(fabric.actualWidth));

      // Add common widths that are close to actual width (±4 inches)
      for (const width of commonWidths) {
        if (Math.abs(width - Number(fabric.actualWidth)) <= 4) {
          widthsToCreate.add(width);
        }
      }

      // Create CAD records for each width
      for (const width of Array.from(widthsToCreate).sort()) {
        const cadData = calculateCAD(width);

        await prisma.fabric_width_cad.create({
          data: {
            fabricId: fabric.id,
            availableWidth: width,
            cadMeters: cadData.cadMeters,
            cadYards: cadData.cadYards,
            cadWastagePercent: cadData.cadWastagePercent,
            markerEfficiency: cadData.markerEfficiency,
            isPreferred: width === Number(fabric.actualWidth), // Actual width is preferred
            notes: `Auto-generated CAD for ${width}" width`,
            createdById: userId,
          },
        });

        console.log(`   ✅ Created CAD for ${width}": ${cadData.cadMeters}m/dz (Efficiency: ${cadData.markerEfficiency}%)`);
        cadRecordsCreated++;
      }
    }

    // Final summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CAD Data Population Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Fabrics Processed: ${fabrics.length}`);
    console.log(`CAD Records Created: ${cadRecordsCreated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Validation query
    const cadCount = await prisma.fabric_width_cad.count();
    const fabricsWithCAD = await prisma.fabric_master.findMany({
      include: {
        _count: {
          select: { widthCADs: true },
        },
      },
    });

    console.log('📊 Current Database State:');
    console.log(`Total CAD Records: ${cadCount}`);
    console.log(`Fabrics with CAD: ${fabricsWithCAD.filter(f => f._count.widthCADs > 0).length}/${fabrics.length}`);
    console.log(`Fabrics without CAD: ${fabricsWithCAD.filter(f => f._count.widthCADs === 0).length}\n`);

    console.log('🎉 CAD Data Population Complete!\n');
    console.log('💡 Tips:');
    console.log('   - Review CAD values and adjust based on actual marker plans');
    console.log('   - Update marker_plan_file with actual marker file paths');
    console.log('   - Set isPreferred flag for the most commonly used width');
    console.log('   - Add notes about specific marker details\n');

  } catch (error) {
    console.error('❌ Error populating CAD data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
