const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAllMasterData() {
  try {
    console.log('🧹 Cleaning ALL master data from database...\n');
    console.log('⚠️  This will delete customers, suppliers, materials, styles, orders, etc.\n');

    // Delete in correct order to respect foreign key constraints
    const deletionOrder = [
      // Production & Tracking (deepest dependencies)
      'style_production_tracking',
      'production_tracking',
      'work_order_breakup',
      'work_orders',

      // Stock & Inventory
      'stock_count_items',
      'stock_counts',
      'stock_reservations',
      'stock_transactions',
      'stock_movements',
      'stock_levels',
      'fabric_stock_transaction',
      'fabric_stock_allocation',
      'fabric_stock',
      'finished_goods_stock',
      'inventory_stock',

      // BOM & Material Requisitions
      'bom_items',
      'bill_of_materials',
      'material_requisition_items',
      'material_requisitions',

      // Purchase Orders & GRN
      'grn_items',
      'goods_receiving_notes',
      'purchase_order_items',
      'purchase_orders',

      // Sales Documents
      'order_item_breakup',
      'order_items',
      'quotation_items',
      'invoice_items',
      'delivery_note_items',
      'delivery_notes',
      'invoices',
      'quotations',
      'orders',

      // Quality
      'quality_defects',
      'quality_inspections',
      'quality_inspection',

      // Styles & Components
      'style_value_additions',
      'style_processes',
      'style_packaging',
      'style_garment_trims',
      'style_fabrics',
      'style_costing_fabric_items',
      'style_costing',
      'style_components',
      'style_accessories',
      'style_variants',
      'style_import_staging',
      'styles',

      // Fabric & Materials
      'fabric_processing',
      'fabric_procurement',
      'fabric_width_cad',
      'fabric_master',
      'greige_master',
      'materials',

      // Suppliers
      'greige_suppliers',
      'fabric_suppliers',
      'material_suppliers',
      'suppliers',

      // Customers
      'brand_categories',
      'customer_gst_numbers',
      'customers',

      // Other
      'samples',
      'production_plans',
      'payments',
    ];

    let totalDeleted = 0;
    const deletedTables = [];

    console.log('🔧 Deleting data...\n');

    for (const table of deletionOrder) {
      try {
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        if (result > 0) {
          console.log(`   ✅ ${table}: ${result} records deleted`);
          totalDeleted += result;
          deletedTables.push({ table, count: result });
        }
      } catch (error) {
        // Skip if table doesn't exist
        if (!error.message.includes('no such table')) {
          // Only show errors that aren't "table doesn't exist"
          if (!error.message.includes('does not exist')) {
            console.log(`   ⚠️  ${table}: ${error.message.split('\n')[0]}`);
          }
        }
      }
    }

    // Summary
    console.log('\n📊 Cleanup Summary:\n');
    console.log(`   Total records deleted: ${totalDeleted}`);
    console.log(`   Tables affected: ${deletedTables.length}`);

    if (deletedTables.length > 0) {
      console.log('\n   Deleted from:');
      deletedTables.forEach(({ table, count }) => {
        console.log(`      • ${table} (${count})`);
      });
    }

    console.log('\n✅ Database cleanup complete!');
    console.log('✅ Schema and relationships remain intact.');
    console.log('\n🎯 Next steps:');
    console.log('   1. Test creating suppliers through the UI');
    console.log('   2. Test creating materials (greige, fabrics) through the UI');
    console.log('   3. Test creating customers with brand categories');
    console.log('   4. Test creating styles and verify relationships');
    console.log('   5. Verify end-to-end data flow works correctly');

  } catch (error) {
    console.error('\n❌ Error cleaning database:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllMasterData();
