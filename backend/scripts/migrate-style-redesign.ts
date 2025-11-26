/**
 * Data Migration Script for Style Redesign
 *
 * This script migrates legacy data to support the new Style Redesign workflow:
 * 1. Migrate style_garment_trims → style_material_bom
 * 2. Migrate style_packaging → style_material_bom
 * 3. Backfill cadStatus for existing styles (set to PENDING)
 * 4. Backfill gender field for existing styles (analyze data or default to UNISEX)
 *
 * Run with: npx ts-node backend/scripts/migrate-style-redesign.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  stylesUpdated: number;
  garmentTrimsMigrated: number;
  packagingMigrated: number;
  genderBackfilled: number;
  cadStatusBackfilled: number;
  errors: string[];
}

const stats: MigrationStats = {
  stylesUpdated: 0,
  garmentTrimsMigrated: 0,
  packagingMigrated: 0,
  genderBackfilled: 0,
  cadStatusBackfilled: 0,
  errors: []
};

/**
 * Step 1: Migrate garment trims to material BOM
 */
async function migrateGarmentTrims() {
  console.log('\n📦 Step 1: Migrating garment trims to material BOM...');

  try {
    // Fetch all garment trims (if the table exists)
    const garmentTrims = await prisma.$queryRaw<any[]>`
      SELECT * FROM style_garment_trims
    `.catch(() => {
      console.log('   ⚠️  style_garment_trims table does not exist, skipping...');
      return [];
    });

    if (garmentTrims.length === 0) {
      console.log('   ℹ️  No garment trims found to migrate');
      return;
    }

    console.log(`   Found ${garmentTrims.length} garment trim records`);

    for (const trim of garmentTrims) {
      try {
        // Check if already migrated
        const existing = await prisma.style_material_bom.findFirst({
          where: {
            styleId: trim.styleId,
            materialCode: trim.materialCode,
            usageCategory: 'GARMENT_TRIM'
          }
        });

        if (existing) {
          console.log(`   ⏭️  Trim ${trim.materialCode} for style ${trim.styleId} already migrated`);
          continue;
        }

        // Create material BOM entry
        await prisma.style_material_bom.create({
          data: {
            styleId: trim.styleId,
            materialType: trim.materialType || 'BUTTON', // Default if not set
            materialCode: trim.materialCode,
            materialName: trim.materialName,
            quantityPerGarment: trim.quantityPerGarment || 0,
            unit: trim.unit || 'piece',
            unitPrice: trim.unitPrice || 0,
            usageCategory: 'GARMENT_TRIM',
            componentName: trim.componentName,
            specifications: trim.specifications || {}
          }
        });

        stats.garmentTrimsMigrated++;
        console.log(`   ✅ Migrated trim ${trim.materialCode}`);
      } catch (error: any) {
        const errorMsg = `Failed to migrate trim ${trim.materialCode}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`   ✅ Migrated ${stats.garmentTrimsMigrated} garment trims`);
  } catch (error: any) {
    console.error(`   ❌ Error in garment trims migration: ${error.message}`);
    stats.errors.push(`Garment trims migration: ${error.message}`);
  }
}

/**
 * Step 2: Migrate packaging to material BOM
 */
async function migratePackaging() {
  console.log('\n📦 Step 2: Migrating packaging to material BOM...');

  try {
    // Fetch all packaging entries (if the table exists)
    const packaging = await prisma.$queryRaw<any[]>`
      SELECT * FROM style_packaging
    `.catch(() => {
      console.log('   ⚠️  style_packaging table does not exist, skipping...');
      return [];
    });

    if (packaging.length === 0) {
      console.log('   ℹ️  No packaging found to migrate');
      return;
    }

    console.log(`   Found ${packaging.length} packaging records`);

    for (const pkg of packaging) {
      try {
        // Check if already migrated
        const existing = await prisma.style_material_bom.findFirst({
          where: {
            styleId: pkg.styleId,
            materialCode: pkg.materialCode,
            usageCategory: 'PACKAGING'
          }
        });

        if (existing) {
          console.log(`   ⏭️  Packaging ${pkg.materialCode} for style ${pkg.styleId} already migrated`);
          continue;
        }

        // Create material BOM entry
        await prisma.style_material_bom.create({
          data: {
            styleId: pkg.styleId,
            materialType: 'PACKAGING',
            materialCode: pkg.materialCode,
            materialName: pkg.materialName,
            quantityPerGarment: pkg.quantityPerGarment || 0,
            unit: pkg.unit || 'piece',
            unitPrice: pkg.unitPrice || 0,
            usageCategory: 'PACKAGING',
            componentName: pkg.componentName,
            specifications: pkg.specifications || {}
          }
        });

        stats.packagingMigrated++;
        console.log(`   ✅ Migrated packaging ${pkg.materialCode}`);
      } catch (error: any) {
        const errorMsg = `Failed to migrate packaging ${pkg.materialCode}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`   ✅ Migrated ${stats.packagingMigrated} packaging items`);
  } catch (error: any) {
    console.error(`   ❌ Error in packaging migration: ${error.message}`);
    stats.errors.push(`Packaging migration: ${error.message}`);
  }
}

/**
 * Step 3: Backfill cadStatus for existing styles
 */
async function backfillCADStatus() {
  console.log('\n📝 Step 3: Backfilling CAD status for existing styles...');

  try {
    // Find all styles without cadStatus set
    const styles = await prisma.style.findMany({
      where: {
        OR: [
          { cadStatus: null },
          { cadStatus: undefined as any }
        ]
      },
      select: { id: true, styleCode: true }
    });

    if (styles.length === 0) {
      console.log('   ℹ️  All styles already have CAD status set');
      return;
    }

    console.log(`   Found ${styles.length} styles without CAD status`);

    // Update all to PENDING status
    const result = await prisma.style.updateMany({
      where: {
        OR: [
          { cadStatus: null },
          { cadStatus: undefined as any }
        ]
      },
      data: {
        cadStatus: 'PENDING'
      }
    });

    stats.cadStatusBackfilled = result.count;
    console.log(`   ✅ Set CAD status to PENDING for ${result.count} styles`);
  } catch (error: any) {
    console.error(`   ❌ Error backfilling CAD status: ${error.message}`);
    stats.errors.push(`CAD status backfill: ${error.message}`);
  }
}

/**
 * Step 4: Backfill gender field for existing styles
 */
async function backfillGender() {
  console.log('\n👔 Step 4: Backfilling gender field for existing styles...');

  try {
    // Find all styles without gender set
    const styles = await prisma.style.findMany({
      where: {
        OR: [
          { gender: null },
          { gender: undefined as any }
        ]
      },
      select: {
        id: true,
        styleCode: true,
        styleName: true,
        description: true,
        category: true
      }
    });

    if (styles.length === 0) {
      console.log('   ℹ️  All styles already have gender set');
      return;
    }

    console.log(`   Found ${styles.length} styles without gender`);

    // Analyze and set gender based on naming patterns
    for (const style of styles) {
      let gender: 'MALE' | 'FEMALE' | 'UNISEX' = 'UNISEX';

      // Check style name and description for gender indicators
      const textToCheck = `${style.styleName} ${style.description || ''} ${style.category || ''}`.toLowerCase();

      // Male indicators
      const maleKeywords = ['men', 'male', 'man', 'boy', 'boys', 'shirt', 'pant', 'trouser'];
      const femaleKeywords = ['women', 'female', 'woman', 'girl', 'girls', 'ladies', 'kurti', 'saree', 'blouse', 'lehenga'];

      const hasMaleKeyword = maleKeywords.some(keyword => textToCheck.includes(keyword));
      const hasFemaleKeyword = femaleKeywords.some(keyword => textToCheck.includes(keyword));

      if (hasMaleKeyword && !hasFemaleKeyword) {
        gender = 'MALE';
      } else if (hasFemaleKeyword && !hasMaleKeyword) {
        gender = 'FEMALE';
      } else {
        gender = 'UNISEX'; // Default or both keywords present
      }

      try {
        await prisma.style.update({
          where: { id: style.id },
          data: { gender }
        });

        stats.genderBackfilled++;
        console.log(`   ✅ Set gender to ${gender} for style ${style.styleCode}`);
      } catch (error: any) {
        const errorMsg = `Failed to set gender for style ${style.styleCode}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`   ✅ Backfilled gender for ${stats.genderBackfilled} styles`);
  } catch (error: any) {
    console.error(`   ❌ Error backfilling gender: ${error.message}`);
    stats.errors.push(`Gender backfill: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting Style Redesign Data Migration\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Migrate garment trims
    await migrateGarmentTrims();

    // Step 2: Migrate packaging
    await migratePackaging();

    // Step 3: Backfill CAD status
    await backfillCADStatus();

    // Step 4: Backfill gender
    await backfillGender();

    // Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Migration Summary:');
    console.log('=' .repeat(60));
    console.log(`✅ Garment trims migrated: ${stats.garmentTrimsMigrated}`);
    console.log(`✅ Packaging migrated: ${stats.packagingMigrated}`);
    console.log(`✅ CAD status backfilled: ${stats.cadStatusBackfilled}`);
    console.log(`✅ Gender backfilled: ${stats.genderBackfilled}`);
    console.log(`✅ Styles updated: ${stats.stylesUpdated}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n👋 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
