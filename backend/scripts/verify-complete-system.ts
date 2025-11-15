import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySystem() {
  try {
    console.log('=== COMPLETE SYSTEM DATA AUDIT ===\n');

    // Foundation Layer
    console.log('📌 FOUNDATION LAYER:');
    const users = await prisma.users.count();
    const materialCategories = await prisma.material_categories.count();
    const suppliers = await prisma.suppliers.count();
    const materials = await prisma.materials.count();
    const warehouses = await prisma.warehouses.count();

    console.log(`   Users: ${users}`);
    console.log(`   Material Categories: ${materialCategories}`);
    console.log(`   Suppliers: ${suppliers}`);
    console.log(`   Materials: ${materials}`);
    console.log(`   Warehouses: ${warehouses}`);

    // Business Data Layer
    console.log('\n📦 BUSINESS DATA LAYER:');
    const customers = await prisma.customers.count();
    const styles = await prisma.styles.count();
    const styleComponents = await prisma.style_components.count();
    const colorOptions = await prisma.color_options.count();
    const sizeOptions = await prisma.size_options.count();

    console.log(`   Customers: ${customers}`);
    console.log(`   Styles: ${styles}`);
    console.log(`   Style Components: ${styleComponents}`);
    console.log(`   Color Options: ${colorOptions}`);
    console.log(`   Size Options: ${sizeOptions}`);

    // Planning Layer
    console.log('\n📋 PLANNING LAYER:');
    const boms = await prisma.bill_of_materials.count();
    const bomItems = await prisma.bom_items.count();
    const costSheets = await prisma.style_costing.count();
    const orders = await prisma.orders.count();
    const orderItems = await prisma.order_items.count();

    console.log(`   BOMs: ${boms}`);
    console.log(`   BOM Items: ${bomItems}`);
    console.log(`   Cost Sheets: ${costSheets}`);
    console.log(`   Orders: ${orders}`);
    console.log(`   Order Items: ${orderItems}`);

    // Production Layer
    console.log('\n🏭 PRODUCTION LAYER:');
    const locations = await prisma.locations.count();
    const workOrders = await prisma.work_orders.count();
    const productionTracking = await prisma.production_tracking.count();
    const styleProductionTracking = await prisma.style_production_tracking.count();

    console.log(`   Production Locations: ${locations}`);
    console.log(`   Work Orders: ${workOrders}`);
    console.log(`   Production Tracking Updates: ${productionTracking}`);
    console.log(`   Style Production Tracking (Main Dashboard): ${styleProductionTracking}`);

    // Inventory Layer
    console.log('\n📊 INVENTORY LAYER:');
    const stockLevels = await prisma.stock_levels.count();
    const stockMovements = await prisma.stock_movements.count();
    const stockCounts = await prisma.stock_counts.count();

    console.log(`   Stock Levels: ${stockLevels}`);
    console.log(`   Stock Movements: ${stockMovements}`);
    console.log(`   Stock Counts: ${stockCounts}`);

    // Financial Layer
    console.log('\n💰 FINANCIAL LAYER:');
    const chartOfAccounts = await prisma.chart_of_accounts.count();
    const taxMasters = await prisma.tax_masters.count();
    const currencies = await prisma.currencies.count();
    const paymentTerms = await prisma.payment_terms.count();

    console.log(`   Chart of Accounts: ${chartOfAccounts}`);
    console.log(`   Tax Masters: ${taxMasters}`);
    console.log(`   Currencies: ${currencies}`);
    console.log(`   Payment Terms: ${paymentTerms}`);

    // Critical Issues Check
    console.log('\n⚠️  CRITICAL ISSUES CHECK:');
    const issues = [];

    if (styleProductionTracking === 0) {
      issues.push('❌ Main Dashboard EMPTY (style_production_tracking has no data)');
    }
    if (boms === 0) {
      issues.push('⚠️  No BOMs created (bill_of_materials table empty)');
    }
    if (costSheets === 0) {
      issues.push('⚠️  No Cost Sheets created (style_costing table empty)');
    }
    if (suppliers < 10) {
      issues.push(`⚠️  Limited suppliers (${suppliers} - recommend 15-20)`);
    }
    if (materials < 20) {
      issues.push(`⚠️  Limited materials (${materials} - recommend 30-50)`);
    }

    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   ${issue}`));
    } else {
      console.log('   ✅ All critical data populated!');
    }

    // Summary
    console.log('\n📈 SUMMARY:');
    const totalRecords = users + materialCategories + suppliers + materials + warehouses +
                        customers + styles + styleComponents + colorOptions + sizeOptions +
                        boms + bomItems + costSheets + orders + orderItems +
                        locations + workOrders + productionTracking + styleProductionTracking +
                        stockLevels + stockMovements + stockCounts +
                        chartOfAccounts + taxMasters + currencies + paymentTerms;

    console.log(`   Total Records: ${totalRecords}`);
    console.log(`   Issues Found: ${issues.length}`);

    return {
      totalRecords,
      issues,
      counts: {
        users, materialCategories, suppliers, materials, warehouses,
        customers, styles, boms, costSheets, orders, workOrders,
        styleProductionTracking
      }
    };

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifySystem()
  .then((result) => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed!');
    process.exit(1);
  });
