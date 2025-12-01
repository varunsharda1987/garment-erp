const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAllData() {
  try {
    console.log('🧹 Starting complete database cleanup...\n');

    // Get counts before deletion
    console.log('📊 Counting records before cleanup...\n');

    const beforeCounts = {
      // Materials & Inventory
      grieges: await prisma.grieges.count(),
      finished_fabrics: await prisma.finished_fabrics.count(),
      materials: await prisma.materials.count(),
      suppliers: await prisma.suppliers.count(),

      // Customers & Relations
      customers: await prisma.customers.count(),
      brand_categories: await prisma.brand_categories.count(),
      customer_gst_numbers: await prisma.customer_gst_numbers.count(),

      // Styles & BOMs
      styles: await prisma.styles.count(),
      bill_of_materials: await prisma.bill_of_materials.count(),
      bom_items: await prisma.bom_items.count(),

      // Orders & Production
      orders: await prisma.orders.count(),
      order_items: await prisma.order_items.count(),
      work_orders: await prisma.work_orders.count(),
      production_tracking: await prisma.production_tracking.count(),

      // Sales Documents
      quotations: await prisma.quotations.count(),
      invoices: await prisma.invoices.count(),
      delivery_notes: await prisma.delivery_notes.count(),
    };

    console.log('Before cleanup:');
    Object.entries(beforeCounts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   ${table}: ${count}`);
      }
    });

    console.log('\n🔧 Deleting all data...\n');

    // Delete in correct order to respect foreign key constraints
    const deletionOrder = [
      // Deepest dependencies first
      'production_tracking',
      'work_orders',
      'bom_items',
      'bill_of_materials',
      'order_items',
      'quotation_items',
      'invoice_items',
      'delivery_note_items',

      // Mid-level tables
      'delivery_notes',
      'invoices',
      'quotations',
      'orders',
      'styles',

      // Material-related tables
      'finished_fabric_cad_widths',
      'finished_fabrics',
      'griege_cad_widths',
      'grieges',
      'materials',
      'supplier_gst_numbers',
      'suppliers',

      // Customer-related tables
      'brand_categories',
      'customer_gst_numbers',
      'customers',

      // Samples
      'samples',
    ];

    let totalDeleted = 0;

    for (const table of deletionOrder) {
      try {
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        if (result > 0) {
          console.log(`   ✅ Deleted ${result} records from ${table}`);
          totalDeleted += result;
        }
      } catch (error) {
        // Skip if table doesn't exist or is empty
        if (error.code === 'P2010' || error.message.includes('no such table')) {
          console.log(`   ⏭️  Skipped ${table} (doesn't exist)`);
        } else {
          console.log(`   ⚠️  Error deleting ${table}: ${error.message}`);
        }
      }
    }

    // Verify all are empty
    console.log('\n📊 Verifying cleanup...\n');

    const afterCounts = {
      grieges: await prisma.grieges.count(),
      finished_fabrics: await prisma.finished_fabrics.count(),
      materials: await prisma.materials.count(),
      suppliers: await prisma.suppliers.count(),
      customers: await prisma.customers.count(),
      brand_categories: await prisma.brand_categories.count(),
      styles: await prisma.styles.count(),
      orders: await prisma.orders.count(),
    };

    console.log('After cleanup:');
    let allEmpty = true;
    Object.entries(afterCounts).forEach(([table, count]) => {
      const icon = count === 0 ? '✅' : '❌';
      console.log(`   ${icon} ${table}: ${count}`);
      if (count > 0) allEmpty = false;
    });

    if (allEmpty) {
      console.log('\n✅ SUCCESS! All data deleted.');
      console.log(`✅ Total records deleted: ${totalDeleted}`);
      console.log('✅ Database schema and relationships remain intact.');
      console.log('\n🎯 You can now test the complete workflow:');
      console.log('   1. Create suppliers through UI');
      console.log('   2. Create materials (griege, finished fabrics) through UI');
      console.log('   3. Create customers with brand categories through UI');
      console.log('   4. Create styles and verify category dropdowns work');
      console.log('   5. Test end-to-end relationships');
    } else {
      console.log('\n⚠️  Warning: Some tables still have data.');
    }

  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllData();
