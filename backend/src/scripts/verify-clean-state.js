const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCleanState() {
  try {
    console.log('🔍 Verifying Clean Database State\n');

    // Check all customer-related tables are empty
    const counts = {
      customers: await prisma.customers.count(),
      brandCategories: await prisma.brand_categories.count(),
      customerGstNumbers: await prisma.customer_gst_numbers.count(),
      styles: await prisma.styles.count(),
      orders: await prisma.orders.count(),
      quotations: await prisma.quotations.count(),
      invoices: await prisma.invoices.count(),
      deliveryNotes: await prisma.delivery_notes.count(),
    };

    console.log('📊 Table Counts:');
    Object.entries(counts).forEach(([table, count]) => {
      const icon = count === 0 ? '✅' : '❌';
      console.log(`   ${icon} ${table}: ${count}`);
    });

    // Verify schema relationships still exist
    console.log('\n🔗 Verifying Schema Relationships:\n');

    // Test: Can we query customers with brand_categories relation?
    const customerQuery = await prisma.customers.findMany({
      include: {
        brand_categories: true,
      },
      take: 1,
    });
    console.log('   ✅ customers → brand_categories relation intact');

    // Test: Can we query brand_categories with customer relation?
    const brandCategoryQuery = await prisma.brand_categories.findMany({
      include: {
        customer: true,
      },
      take: 1,
    });
    console.log('   ✅ brand_categories → customers relation intact');

    // Test: Can we query brand_categories with styles relation?
    const brandCategoryStylesQuery = await prisma.brand_categories.findMany({
      include: {
        styles: true,
      },
      take: 1,
    });
    console.log('   ✅ brand_categories → styles relation intact');

    // Test: Can we query styles with brand_categories relation?
    const styleQuery = await prisma.styles.findMany({
      include: {
        brand_categories: true,
      },
      take: 1,
    });
    console.log('   ✅ styles → brand_categories relation intact');

    const allEmpty = Object.values(counts).every(count => count === 0);

    if (allEmpty) {
      console.log('\n✅ SUCCESS! Database is clean and ready for UI testing.');
      console.log('✅ All schema relationships are intact.');
      console.log('\n🎯 You can now:');
      console.log('   1. Create a customer through CustomerForm');
      console.log('   2. Add brand categories to that customer');
      console.log('   3. Create a style and select from those categories');
    } else {
      console.log('\n⚠️  Some tables still have data. Run clean-database-simple.js first.');
    }

  } catch (error) {
    console.error('❌ Error verifying database:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCleanState();
