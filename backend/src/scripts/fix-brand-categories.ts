/**
 * Fix Script: Split comma-separated categories in brand_categories table
 *
 * This script fixes brand_categories entries where the category field contains
 * comma-separated values (should be separate rows instead).
 */

import prisma from '../config/database';

async function fixBrandCategories() {
  console.log('🔄 Starting brand categories fix...\n');

  try {
    // Find all brand_categories with comma-separated categories
    const brandCategories = await prisma.brand_categories.findMany();

    console.log(`📊 Found ${brandCategories.length} brand_categories entries\n`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const bc of brandCategories) {
      // Check if category contains commas
      if (bc.category.includes(',')) {
        try {
          console.log(`🔧 Fixing: ${bc.brandName} → "${bc.category}"`);

          // Split the categories
          const categories = bc.category
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0);

          console.log(`   Splitting into: ${categories.join(', ')}`);

          // Delete the old entry
          await prisma.brand_categories.delete({
            where: { id: bc.id },
          });

          // Create new entries for each category
          for (const category of categories) {
            await prisma.brand_categories.create({
              data: {
                customerId: bc.customerId,
                brandName: bc.brandName,
                category: category,
                subCategory: bc.subCategory,
                subSubCategory: bc.subSubCategory,
              },
            });
          }

          console.log(`   ✅ Created ${categories.length} separate entries\n`);
          fixedCount++;
        } catch (error: unknown) {
          console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Fix Summary:');
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✨ Fix complete!');
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixBrandCategories()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
