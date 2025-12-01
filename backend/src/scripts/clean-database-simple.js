const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('🧹 Starting database cleanup...\n');

    // Use raw SQL to get around complex foreign key dependencies
    // This will delete all customer-related data in the correct order

    console.log('Deleting all customer-related data...');

    // First, get count of records before deletion
    const beforeCounts = {
      customers: await prisma.customers.count(),
      brandCategories: await prisma.brand_categories.count(),
      styles: await prisma.styles.count(),
      orders: await prisma.orders.count(),
    };

    console.log('\n📊 Before cleanup:');
    console.log(`   Customers: ${beforeCounts.customers}`);
    console.log(`   Brand Categories: ${beforeCounts.brandCategories}`);
    console.log(`   Styles: ${beforeCounts.styles}`);
    console.log(`   Orders: ${beforeCounts.orders}`);

    console.log('\n🔧 Deleting data...');

    // Delete in order from deepest dependencies to top-level tables
    const tables = [
      'production_tracking',
      'work_orders',
      'order_items',
      'quotation_items',
      'invoice_items',
      'delivery_note_items',
      'delivery_notes',
      'invoices',
      'quotations',
      'orders',
      'bom_items',
      'bill_of_materials',
      'styles',
      'brand_categories',
      'customer_gst_numbers',
      'customers'
    ];

    for (const table of tables) {
      try {
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        if (result > 0) {
          console.log(`   ✅ Deleted ${result} records from ${table}`);
        }
      } catch (error) {
        // If table doesn't exist or has no records, continue
        if (error.code !== 'P2010') {
          console.log(`   ⚠️  Skipped ${table}: ${error.message}`);
        }
      }
    }

    // Verify tables are empty
    const afterCounts = {
      customers: await prisma.customers.count(),
      brandCategories: await prisma.brand_categories.count(),
      styles: await prisma.styles.count(),
      orders: await prisma.orders.count(),
    };

    console.log('\n📊 After cleanup:');
    console.log(`   Customers: ${afterCounts.customers}`);
    console.log(`   Brand Categories: ${afterCounts.brandCategories}`);
    console.log(`   Styles: ${afterCounts.styles}`);
    console.log(`   Orders: ${afterCounts.orders}`);

    if (afterCounts.customers === 0 && afterCounts.brandCategories === 0) {
      console.log('\n✅ Database cleaned successfully! Customer-related tables are empty.');
      console.log('✅ Schema and foreign keys remain intact.');
      console.log('\n🎯 You can now create customers through the UI interface.');
    } else {
      console.log('\n⚠️  Warning: Some records still remain.');
    }

  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
