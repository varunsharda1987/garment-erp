/**
 * Clean Customer and Style Data
 *
 * This script safely deletes customer-related data and styles to allow rebuilding.
 * It follows foreign key relationships to ensure proper deletion order.
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function cleanCustomerData() {
  console.log('\n⚠️  WARNING: This will delete the following data:');
  console.log('   - All styles and related data (components, fabrics, variants, etc.)');
  console.log('   - All orders and related data');
  console.log('   - All quotations and invoices');
  console.log('   - All samples and tests');
  console.log('   - All customers and brand categories');
  console.log('   - All dispatches and deliveries');
  console.log('   \n🔒 This will NOT delete:');
  console.log('   - Product categories');
  console.log('   - Material masters (fabrics, trims, accessories)');
  console.log('   - Supplier data');
  console.log('   - User accounts');
  console.log('   - System configuration\n');

  const answer = await askQuestion('Are you sure you want to proceed? (type "DELETE" to confirm): ');

  if (answer !== 'DELETE') {
    console.log('\n❌ Deletion cancelled.\n');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🔄 Starting deletion process...\n');

  try {
    // Step 1: Delete style-related data (most dependent tables first)
    console.log('📦 Deleting style-related data...');

    // Delete dispatch and delivery data
    await prisma.dispatch_pods.deleteMany({});
    console.log('   ✓ Deleted dispatch PODs');

    await prisma.dispatch_cartons.deleteMany({});
    console.log('   ✓ Deleted dispatch cartons');

    await prisma.dispatch_documents.deleteMany({});
    console.log('   ✓ Deleted dispatch documents');

    await prisma.dispatch_transports.deleteMany({});
    console.log('   ✓ Deleted dispatch transports');

    // Delete work order data
    await prisma.work_order_breakup.deleteMany({});
    console.log('   ✓ Deleted work order breakup');

    await prisma.work_orders.deleteMany({});
    console.log('   ✓ Deleted work orders');

    // Delete order data
    await prisma.order_item_breakup.deleteMany({});
    console.log('   ✓ Deleted order item breakup');

    await prisma.order_item_costing.deleteMany({});
    console.log('   ✓ Deleted order item costing');

    await prisma.order_samples.deleteMany({});
    console.log('   ✓ Deleted order samples');

    await prisma.order_inspections.deleteMany({});
    console.log('   ✓ Deleted order inspections');

    await prisma.order_items.deleteMany({});
    console.log('   ✓ Deleted order items');

    await prisma.orders.deleteMany({});
    console.log('   ✓ Deleted orders');

    // Delete quotation data
    await prisma.quotation_items.deleteMany({});
    console.log('   ✓ Deleted quotation items');

    await prisma.quotations.deleteMany({});
    console.log('   ✓ Deleted quotations');

    // Delete invoice data (no separate invoice_items table)
    await prisma.invoices.deleteMany({});
    console.log('   ✓ Deleted invoices');

    // Delete sample and test data
    await prisma.garment_physical_tests.deleteMany({});
    console.log('   ✓ Deleted garment physical tests');

    await prisma.fabric_physical_tests.deleteMany({});
    console.log('   ✓ Deleted fabric physical tests');

    await prisma.sample_measurements.deleteMany({});
    console.log('   ✓ Deleted sample measurements');

    await prisma.sample_colorways.deleteMany({});
    console.log('   ✓ Deleted sample colorways');

    await prisma.sample_size_sets.deleteMany({});
    console.log('   ✓ Deleted sample size sets');

    await prisma.samples.deleteMany({});
    console.log('   ✓ Deleted samples');

    // Delete style variant data
    await prisma.style_variants.deleteMany({});
    console.log('   ✓ Deleted style variants');

    // Delete style component and related data
    await prisma.style_accessories.deleteMany({});
    console.log('   ✓ Deleted style accessories');

    await prisma.style_components.deleteMany({});
    console.log('   ✓ Deleted style components');

    await prisma.style_garment_trims.deleteMany({});
    console.log('   ✓ Deleted style garment trims');

    await prisma.style_packaging.deleteMany({});
    console.log('   ✓ Deleted style packaging');

    await prisma.style_processes.deleteMany({});
    console.log('   ✓ Deleted style processes');

    await prisma.style_production_tracking.deleteMany({});
    console.log('   ✓ Deleted style production tracking');

    await prisma.style_value_additions.deleteMany({});
    console.log('   ✓ Deleted style value additions');

    await prisma.style_material_bom.deleteMany({});
    console.log('   ✓ Deleted style material BOM');

    // Delete style fabric data
    await prisma.style_fabrics.deleteMany({});
    console.log('   ✓ Deleted style fabrics');

    // Delete cad data
    await prisma.cad_size_breakdown.deleteMany({});
    console.log('   ✓ Deleted CAD size breakdown');

    // Delete costing data
    await prisma.style_costing_fabric_items.deleteMany({});
    console.log('   ✓ Deleted style costing fabric items');

    await prisma.style_costing.deleteMany({});
    console.log('   ✓ Deleted style costing');

    // Delete styles
    await prisma.styles.deleteMany({});
    console.log('   ✓ Deleted styles');

    // Step 2: Delete customer data
    console.log('\n👥 Deleting customer data...');

    // Delete customer accessory presets (no separate preset_items table)
    await prisma.customer_accessories_presets.deleteMany({});
    console.log('   ✓ Deleted accessory presets');

    await prisma.customer_size_category_presets.deleteMany({});
    console.log('   ✓ Deleted size category presets');

    // Delete customer GST numbers
    await prisma.customer_gst_numbers.deleteMany({});
    console.log('   ✓ Deleted customer GST numbers');

    // Delete label and packaging masters (depend on brand_categories)
    await prisma.label_master.deleteMany({});
    console.log('   ✓ Deleted label master');

    await prisma.packaging_master.deleteMany({});
    console.log('   ✓ Deleted packaging master');

    // Delete brand categories
    await prisma.brand_categories.deleteMany({});
    console.log('   ✓ Deleted brand categories');

    // Delete customers
    const customerCount = await prisma.customers.count();
    await prisma.customers.deleteMany({});
    console.log(`   ✓ Deleted ${customerCount} customers`);

    // Get final counts
    console.log('\n📊 Final Verification:');
    const counts = {
      styles: await prisma.styles.count(),
      customers: await prisma.customers.count(),
      orders: await prisma.orders.count(),
      quotations: await prisma.quotations.count(),
      invoices: await prisma.invoices.count(),
      workOrders: await prisma.work_orders.count(),
      samples: await prisma.samples.count(),
      brandCategories: await prisma.brand_categories.count(),
    };

    console.log(`   Styles: ${counts.styles}`);
    console.log(`   Customers: ${counts.customers}`);
    console.log(`   Orders: ${counts.orders}`);
    console.log(`   Quotations: ${counts.quotations}`);
    console.log(`   Invoices: ${counts.invoices}`);
    console.log(`   Work Orders: ${counts.workOrders}`);
    console.log(`   Samples: ${counts.samples}`);
    console.log(`   Brand Categories: ${counts.brandCategories}`);

    console.log('\n✅ Deletion completed successfully!');
    console.log('   You can now rebuild your customer and style data.\n');

  } catch (error) {
    console.error('\n❌ Error during deletion:', error);
    throw error;
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanCustomerData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
