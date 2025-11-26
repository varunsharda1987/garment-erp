/**
 * Rollback Script for Style Redesign Migration
 *
 * This script rolls back the Style Redesign migration:
 * 1. Remove migrated material BOM entries (GARMENT_TRIM and PACKAGING categories)
 * 2. Reset cadStatus to null for all styles
 * 3. Reset gender to null for all styles
 *
 * ⚠️  WARNING: This will delete migrated data!
 *
 * Run with: npx ts-node backend/scripts/rollback-style-redesign.ts
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface RollbackStats {
  materialBOMDeleted: number;
  cadStatusReset: number;
  genderReset: number;
  errors: string[];
}

const stats: RollbackStats = {
  materialBOMDeleted: 0,
  cadStatusReset: 0,
  genderReset: 0,
  errors: []
};

/**
 * Prompt user for confirmation
 */
async function confirmRollback(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  WARNING: This will delete migrated data and reset CAD status and gender fields!\n\n' +
      'Are you sure you want to proceed with rollback? (yes/no): ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      }
    );
  });
}

/**
 * Step 1: Delete migrated material BOM entries
 */
async function deleteMaterialBOM() {
  console.log('\n🗑️  Step 1: Deleting migrated material BOM entries...');

  try {
    // Delete all GARMENT_TRIM entries
    const garmentTrimsResult = await prisma.style_material_bom.deleteMany({
      where: {
        usageCategory: 'GARMENT_TRIM'
      }
    });

    console.log(`   ✅ Deleted ${garmentTrimsResult.count} garment trim entries`);
    stats.materialBOMDeleted += garmentTrimsResult.count;

    // Delete all PACKAGING entries
    const packagingResult = await prisma.style_material_bom.deleteMany({
      where: {
        usageCategory: 'PACKAGING'
      }
    });

    console.log(`   ✅ Deleted ${packagingResult.count} packaging entries`);
    stats.materialBOMDeleted += packagingResult.count;

    console.log(`   ✅ Total material BOM entries deleted: ${stats.materialBOMDeleted}`);
  } catch (error: any) {
    console.error(`   ❌ Error deleting material BOM: ${error.message}`);
    stats.errors.push(`Material BOM deletion: ${error.message}`);
  }
}

/**
 * Step 2: Reset CAD status
 */
async function resetCADStatus() {
  console.log('\n🔄 Step 2: Resetting CAD status for all styles...');

  try {
    const result = await prisma.style.updateMany({
      where: {
        cadStatus: { not: null }
      },
      data: {
        cadStatus: null,
        cadApprovedAt: null
      }
    });

    stats.cadStatusReset = result.count;
    console.log(`   ✅ Reset CAD status for ${result.count} styles`);
  } catch (error: any) {
    console.error(`   ❌ Error resetting CAD status: ${error.message}`);
    stats.errors.push(`CAD status reset: ${error.message}`);
  }
}

/**
 * Step 3: Reset gender field
 */
async function resetGender() {
  console.log('\n🔄 Step 3: Resetting gender field for all styles...');

  try {
    const result = await prisma.style.updateMany({
      where: {
        gender: { not: null }
      },
      data: {
        gender: null
      }
    });

    stats.genderReset = result.count;
    console.log(`   ✅ Reset gender for ${result.count} styles`);
  } catch (error: any) {
    console.error(`   ❌ Error resetting gender: ${error.message}`);
    stats.errors.push(`Gender reset: ${error.message}`);
  }
}

/**
 * Main rollback function
 */
async function runRollback() {
  console.log('🔙 Starting Style Redesign Rollback\n');
  console.log('=' .repeat(60));

  // Confirm with user
  const confirmed = await confirmRollback();

  if (!confirmed) {
    console.log('\n❌ Rollback cancelled by user');
    return;
  }

  console.log('\n✅ Rollback confirmed. Starting...\n');

  try {
    // Step 1: Delete material BOM
    await deleteMaterialBOM();

    // Step 2: Reset CAD status
    await resetCADStatus();

    // Step 3: Reset gender
    await resetGender();

    // Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Rollback Summary:');
    console.log('=' .repeat(60));
    console.log(`✅ Material BOM entries deleted: ${stats.materialBOMDeleted}`);
    console.log(`✅ CAD status reset: ${stats.cadStatusReset}`);
    console.log(`✅ Gender reset: ${stats.genderReset}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('\n✅ Rollback completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Rollback failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run rollback
runRollback()
  .then(() => {
    console.log('\n👋 Rollback script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Rollback script failed:', error);
    process.exit(1);
  });
