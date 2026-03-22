/**
 * Migration Script: Convert old brandNames format to brand_categories table
 *
 * This script migrates customers that have brandNames in the old format (newline-separated string)
 * to the new brand_categories table structure.
 */

import prisma from '../config/database';

interface BrandCategoryInput {
  customerId: string;
  brandName: string;
  category: string;
}

async function migrateBrandCategories() {
  console.log('🔄 Starting brand categories migration...\n');

  try {
    // Find all customers with brandNames but no brand_categories
    const customers = await prisma.customers.findMany({
      where: {
        brandNames: { not: null },
      },
      include: {
        brand_categories: true,
      },
    });

    console.log(`📊 Found ${customers.length} customers with brandNames field\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      // Skip if customer already has brand_categories
      if (customer.brand_categories && customer.brand_categories.length > 0) {
        console.log(`⏭️  Skipping ${customer.name} - already has brand_categories`);
        skippedCount++;
        continue;
      }

      if (!customer.brandNames) {
        console.log(`⏭️  Skipping ${customer.name} - no brandNames`);
        skippedCount++;
        continue;
      }

      try {
        // Parse brandNames (newline-separated)
        const brands = customer.brandNames
          .split('\n')
          .map((b) => b.trim())
          .filter((b) => b.length > 0);

        // Parse categories (newline-separated, matched by index)
        let categories: string[] = [];
        if (customer.categories) {
          categories = customer.categories
            .split('\n')
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
        }

        // Create brand_categories entries
        const brandCategoryData: BrandCategoryInput[] = [];

        for (let i = 0; i < brands.length; i++) {
          const brand = brands[i];

          // If we have categories, try to match by index
          // Otherwise, add a default category
          if (categories.length > 0) {
            // Parse comma-separated categories for this brand
            const brandCategories = categories[i]
              ? categories[i]
                  .split(',')
                  .map((c) => c.trim())
                  .filter((c) => c.length > 0)
              : ['General'];

            for (const category of brandCategories) {
              brandCategoryData.push({
                customerId: customer.id,
                brandName: brand,
                category: category,
              });
            }
          } else {
            // No categories defined, use a default
            brandCategoryData.push({
              customerId: customer.id,
              brandName: brand,
              category: 'General',
            });
          }
        }

        if (brandCategoryData.length > 0) {
          // Create brand_categories entries
          await prisma.brand_categories.createMany({
            data: brandCategoryData,
            skipDuplicates: true,
          });

          console.log(`✅ Migrated ${customer.name}:`);
          console.log(`   - Brands: ${brands.join(', ')}`);
          console.log(`   - Created ${brandCategoryData.length} brand-category combinations\n`);

          migratedCount++;
        } else {
          console.log(`⚠️  ${customer.name} - no valid brand-category data to migrate\n`);
          skippedCount++;
        }
      } catch (error: unknown) {
        console.error(`❌ Error migrating ${customer.name}:`, error instanceof Error ? error.message : 'Unknown error');
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateBrandCategories()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
