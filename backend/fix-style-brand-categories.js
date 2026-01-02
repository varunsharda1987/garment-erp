/**
 * Fix Style Brand Categories - Migration Script
 *
 * Problem: Styles have brandName (text) but brandCategoryId is null
 * Solution: Match styles to brand_categories and set the foreign key
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStyleBrandCategories() {
  try {
    console.log('=== Fix Style Brand Categories ===\n');

    // Get all active styles
    const styles = await prisma.styles.findMany({
      where: { isActive: true },
      select: {
        id: true,
        styleCode: true,
        customerName: true,
        brandName: true,
        brandCategoryId: true
      }
    });

    console.log(`Found ${styles.length} active styles to process\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const style of styles) {
      try {
        // Skip if already has brandCategoryId
        if (style.brandCategoryId) {
          console.log(`✓ ${style.styleCode}: Already has brandCategoryId`);
          skipped++;
          continue;
        }

        // Skip if no customer name
        if (!style.customerName) {
          console.log(`⊘ ${style.styleCode}: No customerName set`);
          skipped++;
          continue;
        }

        // Find customer
        const customer = await prisma.customers.findFirst({
          where: { name: style.customerName },
          include: { brand_categories: true }
        });

        if (!customer) {
          console.log(`⚠ ${style.styleCode}: Customer '${style.customerName}' not found`);
          skipped++;
          continue;
        }

        if (!customer.brand_categories || customer.brand_categories.length === 0) {
          console.log(`⚠ ${style.styleCode}: Customer '${style.customerName}' has no brand categories`);
          skipped++;
          continue;
        }

        // Try to match by brandName if available
        let matchedCategory = null;
        if (style.brandName) {
          matchedCategory = customer.brand_categories.find(
            bc => bc.brandName === style.brandName
          );
        }

        // If no match and customer has only one category, use it
        if (!matchedCategory && customer.brand_categories.length === 1) {
          matchedCategory = customer.brand_categories[0];
          console.log(`  Using single available category for customer`);
        }

        // If no match and customer has multiple categories, use first one and warn
        if (!matchedCategory && customer.brand_categories.length > 1) {
          matchedCategory = customer.brand_categories[0];
          console.log(`  ⚠ Multiple categories available, using first: ${matchedCategory.brandName} - ${matchedCategory.category}`);
        }

        if (matchedCategory) {
          // Update the style
          await prisma.styles.update({
            where: { id: style.id },
            data: {
              brandCategoryId: matchedCategory.id,
              brandName: matchedCategory.brandName // Also update brandName to match
            }
          });

          console.log(`✓ ${style.styleCode}: Set to ${matchedCategory.brandName} - ${matchedCategory.category}`);
          fixed++;
        } else {
          console.log(`⚠ ${style.styleCode}: Could not match to any category`);
          skipped++;
        }

      } catch (error) {
        console.error(`✗ ${style.styleCode}: Error - ${error.message}`);
        errors++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total: ${styles.length}`);

  } catch (error) {
    console.error('Fatal error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixStyleBrandCategories()
  .then(() => {
    console.log('\n✓ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
