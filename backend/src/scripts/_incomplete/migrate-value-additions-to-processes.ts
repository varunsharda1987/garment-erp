/**
 * Migration Script: Convert style_value_additions to style_processes
 *
 * This script migrates data from the legacy style_value_additions table
 * to the new style_processes table with ProcessType enum.
 *
 * Run with: npx ts-node src/scripts/migrate-value-additions-to-processes.ts
 */

import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { ProcessType } from '@prisma/client';

const processTypeMapping: Record<string, ProcessType> = {
  embroidery: ProcessType.EMBROIDERY,
  handwork: ProcessType.FINISHING, // Map handwork to FINISHING
  dyeing: ProcessType.DYEING,
  washing: ProcessType.WASHING,
  printing: ProcessType.PRINTING,
};

async function migrateValueAdditionsToProcesses() {
  console.log('🔄 Starting migration: style_value_additions → style_processes');

  try {
    // Get all value additions
    const valueAdditions = await prisma.style_value_additions.findMany({
      include: {
        styles: {
          select: {
            id: true,
            styleCode: true,
          },
        },
      },
    });

    console.log(`📊 Found ${valueAdditions.length} value additions to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const addition of valueAdditions) {
      try {
        const additionType = addition.additionType.toLowerCase();
        const processType = processTypeMapping[additionType];

        if (!processType) {
          console.warn(
            `⚠️  Skipping unknown addition type: ${addition.additionType} for style ${addition.styles.styleCode}`
          );
          skipped++;
          continue;
        }

        // Check if process already exists
        const existingProcess = await prisma.style_processes.findFirst({
          where: {
            styleId: addition.styleId,
            processType: processType,
          },
        });

        if (existingProcess) {
          console.log(`⏭️  Process already exists for style ${addition.styles.styleCode} - ${processType}`);
          skipped++;
          continue;
        }

        // Create new process record
        await prisma.style_processes.create({
          data: {
            id: randomUUID(),
            styleId: addition.styleId,
            processName: processType,
            processType: processType,
            isRequired: false, // Value additions are optional
            sortOrder: getSortOrder(processType),
            vendorName: addition.vendor || null,
            estimatedCost: addition.estimatedCost || null,
            notes: buildNotes(addition),
            createdAt: addition.createdAt,
            updatedAt: addition.updatedAt,
          },
        });

        migrated++;
        console.log(`✅ Migrated ${processType} for style ${addition.styles.styleCode}`);
      } catch (error) {
        // allow-swallow — one-off migration script: per-addition errors are counted and reported in the summary
        errors++;
        console.error(`❌ Error migrating addition ${addition.id}:`, error);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${valueAdditions.length}`);

    if (migrated > 0) {
      console.log('\n⚠️  IMPORTANT: The style_value_additions table still contains the old data.');
      console.log('   Review the migrated data in style_processes before deleting the old table.');
      console.log('   To delete old data, run: DELETE FROM style_value_additions;');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get sort order for processes to match workflow
 */
function getSortOrder(processType: ProcessType): number {
  const order: Record<ProcessType, number> = {
    [ProcessType.PRINTING]: 1,
    [ProcessType.DYEING]: 2,
    [ProcessType.EMBROIDERY]: 3,
    [ProcessType.CUTTING]: 4,
    [ProcessType.STITCHING]: 5,
    [ProcessType.FINISHING]: 6,
    [ProcessType.WASHING]: 7,
  };
  return order[processType] || 0;
}

/**
 * Build notes from legacy fields
 */
function buildNotes(addition: any): string | null {
  const parts: string[] = [];

  if (addition.description) {
    parts.push(`Description: ${addition.description}`);
  }

  if (addition.type) {
    parts.push(`Type: ${addition.type}`);
  }

  if (addition.numberOfItems) {
    parts.push(`Items: ${addition.numberOfItems}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

// Run migration
migrateValueAdditionsToProcesses()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
