/**
 * Migration Script: cad_averages → fabric_width_cad
 *
 * This script migrates data from the deprecated cad_averages table
 * to the new fabric_width_cad table structure.
 *
 * Key Changes:
 * - Moves from style_fabrics-centric to fabric_master-centric
 * - Converts snake_case to camelCase field names
 * - Adds new fields: createdById, actualCad, cadVariancePercent, etc.
 * - Links to fabric_master instead of style_fabrics
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface CadAverageRow {
  id: string;
  style_fabric_id: string;
  fabric_width: any; // Decimal
  cad_average_meters: any | null;
  cad_average_yards: any | null;
  cad_wastage_percent: any | null;
  marker_efficiency: any | null;
  marker_plan_file: string | null;
  is_preferred: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface StyleFabricWithFabric {
  id: string;
  fabricId: string | null;
  fabricCADId: string | null;
  style_components: {
    styleId: string;
    styles: {
      createdById: string;
    };
  };
}

async function main() {
  console.log('🔄 Starting migration from cad_averages to fabric_width_cad...\n');

  // Step 1: Get all existing cad_averages records
  const cadAveragesRecords = await prisma.$queryRaw<CadAverageRow[]>`
    SELECT * FROM cad_averages ORDER BY created_at ASC
  `;

  console.log(`📊 Found ${cadAveragesRecords.length} cad_averages records to migrate\n`);

  if (cadAveragesRecords.length === 0) {
    console.log('✅ No records to migrate. Exiting.');
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  const migrationLog: Array<{
    cadAverageId: string;
    status: 'success' | 'skipped' | 'error';
    reason?: string;
    newFabricWidthCadId?: string;
  }> = [];

  // Step 2: Process each cad_averages record
  for (const cadAvg of cadAveragesRecords) {
    try {
      console.log(`\n📝 Processing cad_averages record: ${cadAvg.id}`);
      console.log(`   Style Fabric ID: ${cadAvg.style_fabric_id}`);
      console.log(`   Fabric Width: ${cadAvg.fabric_width}`);

      // Get the associated style_fabrics record with fabric relationship
      const styleFabric = (await prisma.style_fabrics.findUnique({
        where: { id: cadAvg.style_fabric_id },
        include: {
          style_components: {
            include: {
              styles: {
                select: { createdById: true },
              },
            },
          },
        },
      })) as StyleFabricWithFabric | null;

      if (!styleFabric) {
        console.log(`   ⚠️  SKIPPED: style_fabrics record not found`);
        skipped++;
        migrationLog.push({
          cadAverageId: cadAvg.id,
          status: 'skipped',
          reason: 'style_fabrics record not found',
        });
        continue;
      }

      // Check if style_fabrics has a fabricId reference
      if (!styleFabric.fabricId) {
        console.log(`   ⚠️  SKIPPED: style_fabrics.fabricId is null (not migrated to fabric_master yet)`);
        skipped++;
        migrationLog.push({
          cadAverageId: cadAvg.id,
          status: 'skipped',
          reason: 'style_fabrics.fabricId is null',
        });
        continue;
      }

      // Get createdById from the style
      const createdById = styleFabric.style_components.styles.createdById;

      // Check if a fabric_width_cad record already exists for this fabric + width
      const existingFabricWidthCad = await prisma.fabric_width_cad.findFirst({
        where: {
          fabricId: styleFabric.fabricId,
          cutableWidth: cadAvg.fabric_width,
        },
      });

      if (existingFabricWidthCad) {
        console.log(`   ℹ️  fabric_width_cad already exists (ID: ${existingFabricWidthCad.id})`);

        // Update the style_fabrics to reference this existing fabric_width_cad
        if (!styleFabric.fabricCADId) {
          await prisma.style_fabrics.update({
            where: { id: styleFabric.id },
            data: { fabricCADId: existingFabricWidthCad.id },
          });
          console.log(`   ✅ Updated style_fabrics.fabricCADId to ${existingFabricWidthCad.id}`);
        }

        migrated++;
        migrationLog.push({
          cadAverageId: cadAvg.id,
          status: 'success',
          reason: 'Linked to existing fabric_width_cad',
          newFabricWidthCadId: existingFabricWidthCad.id,
        });
        continue;
      }

      // Create a new fabric_width_cad record
      const newFabricWidthCad = await prisma.fabric_width_cad.create({
        data: {
          id: randomUUID(),
          fabricId: styleFabric.fabricId,
          cutableWidth: cadAvg.fabric_width,
          widthUnit: 'inches',
          cadMeters: cadAvg.cad_average_meters,
          cadYards: cadAvg.cad_average_yards,
          cadWastagePercent: cadAvg.cad_wastage_percent || 5,
          markerEfficiency: cadAvg.marker_efficiency,
          isPreferred: cadAvg.is_preferred,
          markerPlanFile: cadAvg.marker_plan_file,
          notes: cadAvg.notes,
          createdById: createdById,
          createdAt: cadAvg.created_at,
          updatedAt: cadAvg.updated_at,
        },
      });

      console.log(`   ✅ Created fabric_width_cad record: ${newFabricWidthCad.id}`);

      // Update the style_fabrics to reference this new fabric_width_cad
      await prisma.style_fabrics.update({
        where: { id: styleFabric.id },
        data: { fabricCADId: newFabricWidthCad.id },
      });

      console.log(`   ✅ Updated style_fabrics.fabricCADId to ${newFabricWidthCad.id}`);

      migrated++;
      migrationLog.push({
        cadAverageId: cadAvg.id,
        status: 'success',
        newFabricWidthCadId: newFabricWidthCad.id,
      });
    } catch (error) {
      // allow-swallow — one-off migration script: per-record errors are counted and written to the migration log
      console.error(`   ❌ ERROR migrating record ${cadAvg.id}:`, error);
      errors++;
      migrationLog.push({
        cadAverageId: cadAvg.id,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Step 3: Summary Report
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total records processed: ${cadAveragesRecords.length}`);
  console.log(`✅ Successfully migrated: ${migrated}`);
  console.log(`⚠️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  // Step 4: Save detailed migration log
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFilePath = `./migration-logs/cad-averages-migration-${timestamp}.json`;

  const fs = require('fs');
  const path = require('path');

  const logDir = path.join(__dirname, '../../migration-logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(__dirname, '../../migration-logs', `cad-averages-migration-${timestamp}.json`),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          total: cadAveragesRecords.length,
          migrated,
          skipped,
          errors,
        },
        details: migrationLog,
      },
      null,
      2
    )
  );

  console.log(`\n📄 Detailed log saved to: ${logFilePath}`);

  // Step 5: Verification
  console.log('\n🔍 Verification:');
  const fabricWidthCadCount = await prisma.fabric_width_cad.count();
  console.log(`   fabric_width_cad records: ${fabricWidthCadCount}`);

  const styleFabricsWithCAD = await prisma.style_fabrics.count({
    where: { fabricCADId: { not: null } },
  });
  console.log(`   style_fabrics with fabricCADId: ${styleFabricsWithCAD}`);

  console.log('\n✅ Migration completed!');
  console.log('\n⚠️  NEXT STEPS:');
  console.log('   1. Review the migration log for any errors or skipped records');
  console.log('   2. Test the application thoroughly');
  console.log('   3. Once verified, run the Prisma migration to drop cad_averages table');
  console.log('   4. Update all controllers and frontend code to use fabric_width_cad');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
