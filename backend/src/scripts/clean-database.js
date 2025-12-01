const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('🧹 Starting database cleanup...\n');

    // Delete in correct order to respect foreign key constraints
    // Starting from the deepest dependencies and working backward

    console.log('Deleting style-related records...');

    // 1. Delete BOM items (references bill_of_materials)
    const deletedBomItems = await prisma.bom_items.deleteMany({});
    console.log(`✅ Deleted ${deletedBomItems.count} bom_items records`);

    // 2. Delete bill of materials (references styles)
    const deletedBom = await prisma.bill_of_materials.deleteMany({});
    console.log(`✅ Deleted ${deletedBom.count} bill_of_materials records`);

    // 3. Skip style_images if it doesn't exist
    // const deletedStyleImages = await prisma.style_images.deleteMany({});
    // console.log(`✅ Deleted ${deletedStyleImages.count} style_images records`);

    // 4. Delete work orders first (references order_items)
    console.log('\nDeleting work order records...');
    const deletedWorkOrders = await prisma.work_orders.deleteMany({});
    console.log(`✅ Deleted ${deletedWorkOrders.count} work_orders records`);

    // 5. Delete order-related records
    console.log('\nDeleting order-related records...');
    const deletedOrderItems = await prisma.order_items.deleteMany({});
    console.log(`✅ Deleted ${deletedOrderItems.count} order_items records`);

    const deletedOrders = await prisma.orders.deleteMany({});
    console.log(`✅ Deleted ${deletedOrders.count} orders records`);

    // 5. Delete quotation-related records
    console.log('\nDeleting quotation-related records...');
    const deletedQuotationItems = await prisma.quotation_items.deleteMany({});
    console.log(`✅ Deleted ${deletedQuotationItems.count} quotation_items records`);

    const deletedQuotations = await prisma.quotations.deleteMany({});
    console.log(`✅ Deleted ${deletedQuotations.count} quotations records`);

    // 6. Delete invoice-related records
    console.log('\nDeleting invoice-related records...');
    const deletedInvoiceItems = await prisma.invoice_items.deleteMany({});
    console.log(`✅ Deleted ${deletedInvoiceItems.count} invoice_items records`);

    const deletedInvoices = await prisma.invoices.deleteMany({});
    console.log(`✅ Deleted ${deletedInvoices.count} invoices records`);

    // 7. Delete delivery note records
    console.log('\nDeleting delivery note records...');
    const deletedDeliveryNoteItems = await prisma.delivery_note_items.deleteMany({});
    console.log(`✅ Deleted ${deletedDeliveryNoteItems.count} delivery_note_items records`);

    const deletedDeliveryNotes = await prisma.delivery_notes.deleteMany({});
    console.log(`✅ Deleted ${deletedDeliveryNotes.count} delivery_notes records`);

    // 8. Now delete styles (after all dependencies are removed)
    console.log('\nDeleting styles...');
    const deletedStyles = await prisma.styles.deleteMany({});
    console.log(`✅ Deleted ${deletedStyles.count} styles records`);

    // 9. Delete customer-related records
    console.log('\nDeleting customer-related records...');
    const deletedBrandCategories = await prisma.brand_categories.deleteMany({});
    console.log(`✅ Deleted ${deletedBrandCategories.count} brand_categories records`);

    const deletedGstNumbers = await prisma.customer_gst_numbers.deleteMany({});
    console.log(`✅ Deleted ${deletedGstNumbers.count} customer_gst_numbers records`);

    // 10. Finally delete customers
    const deletedCustomers = await prisma.customers.deleteMany({});
    console.log(`✅ Deleted ${deletedCustomers.count} customers records`);

    // Verify tables are empty
    console.log('\n📊 Verification:');
    const remainingCustomers = await prisma.customers.count();
    const remainingBrandCategories = await prisma.brand_categories.count();
    const remainingStyles = await prisma.styles.count();
    const remainingOrders = await prisma.orders.count();

    console.log(`   Customers: ${remainingCustomers}`);
    console.log(`   Brand Categories: ${remainingBrandCategories}`);
    console.log(`   Styles: ${remainingStyles}`);
    console.log(`   Orders: ${remainingOrders}`);

    if (remainingCustomers === 0 && remainingBrandCategories === 0) {
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
