/**
 * Backfill productCategoryId for existing brand_categories
 *
 * This script matches existing text-based categories with product_category_master
 * based on category name and updates the productCategoryId field.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillBrandCategoryIds() {
  console.log('Starting brand category backfill...\n');

  try {
    // Get all brand categories without productCategoryId
    const brandCategories = await prisma.brand_categories.findMany({
      where: {
        productCategoryId: null,
      },
      select: {
        id: true,
        customerId: true,
        brandName: true,
        category: true,
        subCategory: true,
        subSubCategory: true,
      },
    });

    console.log(`Found ${brandCategories.length} brand categories to process\n`);

    // Get all product categories for matching
    const productCategories = await prisma.product_category_master.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
      },
    });

    console.log(`Found ${productCategories.length} product categories for matching\n`);

    let matchedCount = 0;
    let unmatchedCount = 0;
    const updates: { id: string; productCategoryId: string; categoryName: string; matchedName: string }[] = [];

    // Process each brand category
    for (const bc of brandCategories) {
      // Try to match the category name with product category master
      // We'll match on the category field (which should be the full category name)
      const categoryToMatch = bc.category.trim();

      // Try exact match first
      let match = productCategories.find(
        (pc) => pc.name.toLowerCase() === categoryToMatch.toLowerCase()
      );

      // If no exact match, try partial match (category name contains or is contained in product category name)
      if (!match) {
        match = productCategories.find(
          (pc) =>
            pc.name.toLowerCase().includes(categoryToMatch.toLowerCase()) ||
            categoryToMatch.toLowerCase().includes(pc.name.toLowerCase())
        );
      }

      if (match) {
        updates.push({
          id: bc.id,
          productCategoryId: match.id,
          categoryName: bc.category,
          matchedName: match.name,
        });
        matchedCount++;
      } else {
        unmatchedCount++;
        console.log(`⚠️  No match found for: "${bc.category}" (Brand: ${bc.brandName})`);
      }
    }

    console.log(`\n📊 Matching Summary:`);
    console.log(`   ✅ Matched: ${matchedCount}`);
    console.log(`   ❌ Unmatched: ${unmatchedCount}`);
    console.log(`   📝 Total: ${brandCategories.length}\n`);

    if (updates.length > 0) {
      console.log(`\n🔄 Updating ${updates.length} brand categories...\n`);

      // Update in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        await Promise.all(
          batch.map((update) =>
            prisma.brand_categories.update({
              where: { id: update.id },
              data: { productCategoryId: update.productCategoryId },
            })
          )
        );

        console.log(`   ✓ Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}`);
      }

      console.log(`\n✅ Successfully updated ${updates.length} brand categories\n`);

      // Show sample updates
      console.log(`\n📋 Sample Updates (first 10):`);
      updates.slice(0, 10).forEach((update, index) => {
        console.log(`   ${index + 1}. "${update.categoryName}" → "${update.matchedName}"`);
      });
    } else {
      console.log(`\n✅ No updates needed - all categories already have productCategoryId or no matches found\n`);
    }

    // Summary statistics
    const totalWithProductCategoryId = await prisma.brand_categories.count({
      where: {
        productCategoryId: { not: null },
      },
    });

    const totalBrandCategories = await prisma.brand_categories.count();

    console.log(`\n📈 Final Statistics:`);
    console.log(`   Total brand categories: ${totalBrandCategories}`);
    console.log(`   With productCategoryId: ${totalWithProductCategoryId}`);
    console.log(`   Without productCategoryId: ${totalBrandCategories - totalWithProductCategoryId}`);
    console.log(`   Coverage: ${((totalWithProductCategoryId / totalBrandCategories) * 100).toFixed(1)}%\n`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillBrandCategoryIds()
  .then(() => {
    console.log('✅ Backfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
