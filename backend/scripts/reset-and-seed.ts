// Reset Database and Seed Fresh Data
// This script will clear all data and create a fresh set of master data

import { PrismaClient, CustomerType, CustomerCategory, SupplierCategory } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Resetting Database...\n');
  console.log('============================================================');

  try {
    // Delete in correct order (respecting foreign keys)
    console.log('Deleting all data...');

    await prisma.style_production_tracking.deleteMany({});
    await prisma.production_tracking.deleteMany({});
    await prisma.production_plans.deleteMany({});
    await prisma.work_order_breakup.deleteMany({});
    await prisma.work_orders.deleteMany({});
    await prisma.order_item_breakup.deleteMany({});
    await prisma.order_items.deleteMany({});
    await prisma.orders.deleteMany({});
    await prisma.style_costing.deleteMany({});
    await prisma.bom_items.deleteMany({});
    await prisma.bill_of_materials.deleteMany({});
    await prisma.size_options.deleteMany({});
    await prisma.color_options.deleteMany({});
    await prisma.style_accessories.deleteMany({});
    await prisma.style_fabrics.deleteMany({});
    await prisma.style_garment_trims.deleteMany({});
    await prisma.style_packaging.deleteMany({});
    await prisma.style_processes.deleteMany({});
    await prisma.style_value_additions.deleteMany({});
    await prisma.style_components.deleteMany({});
    await prisma.styles.deleteMany({});
    await prisma.stock_count_items.deleteMany({});
    await prisma.stock_counts.deleteMany({});
    await prisma.stock_transactions.deleteMany({});
    await prisma.stock_reservations.deleteMany({});
    await prisma.stock_movements.deleteMany({});
    await prisma.stock_levels.deleteMany({});
    await prisma.inventory_stock.deleteMany({});
    await prisma.finished_goods_stock.deleteMany({});
    await prisma.materials.deleteMany({});
    await prisma.material_categories.deleteMany({});
    await prisma.warehouses.deleteMany({});
    await prisma.suppliers.deleteMany({});
    await prisma.customers.deleteMany({});

    console.log('✅ All data deleted\n');

    // Get admin user (don't delete users)
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Please create admin user first.');
    }

    console.log(`✅ Found admin user: ${adminUser.email}\n`);

    // ========================================
    // 1. CUSTOMERS
    // ========================================
    console.log('👥 Creating Customers...');

    const customer1 = await prisma.customers.create({
      data: {
        id: randomUUID(),
        code: 'CUST-DOM-001',
        name: 'Fashion Boutique Pvt Ltd',
        type: CustomerType.BUYER,
        category: CustomerCategory.DOMESTIC,
        contactPerson: 'Rajesh Kumar',
        email: 'rajesh@fashionboutique.in',
        phone: '9876543210',
        billingAddress: '123 MG Road, Mumbai - 400001',
        shippingAddress: '123 MG Road, Mumbai - 400001',
        gstNumber: '27AABCU9603R1ZM',
        creditLimit: 500000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    console.log('✅ Created 1 customer\n');

    // ========================================
    // 2. SUPPLIERS
    // ========================================
    console.log('🏢 Creating Suppliers...');

    const fabricSupp = await prisma.suppliers.create({
      data: {
        id: randomUUID(),
        code: 'SUPP-FAB-001',
        name: 'Premium Fabrics Pvt Ltd',
        supplierCategory: SupplierCategory.FABRIC,
        contactPerson: 'Sanjay Gupta',
        email: 'sanjay@premiumfabrics.in',
        phone: '9123456780',
        address: 'Textile Market, Surat, Gujarat - 395001',
        gstNumber: '24AABCU9603R1ZP',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const trimsSupp = await prisma.suppliers.create({
      data: {
        id: randomUUID(),
        code: 'SUPP-TRM-001',
        name: 'Button & Zipper Co',
        supplierCategory: SupplierCategory.TRIMS_ACCESSORIES,
        contactPerson: 'Vijay Shah',
        email: 'vijay@buttonzipper.in',
        phone: '9123456782',
        address: 'Industrial Area, Ludhiana - 141001',
        gstNumber: '03AABCU9603R1ZR',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 2 suppliers\n');

    // ========================================
    // 3. MATERIAL CATEGORIES
    // ========================================
    console.log('📦 Creating Material Categories...');

    const fabricCat = await prisma.material_categories.create({
      data: {
        id: randomUUID(),
        code: 'FABRIC',
        name: 'Fabric',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const trimsCat = await prisma.material_categories.create({
      data: {
        id: randomUUID(),
        code: 'TRIMS',
        name: 'Trims & Accessories',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 2 material categories\n');

    // ========================================
    // 4. MATERIALS
    // ========================================
    console.log('🧵 Creating Materials...');

    await prisma.materials.create({
      data: {
        id: randomUUID(),
        code: 'FAB-COT-001',
        name: 'Cotton Twill Fabric',
        categoryId: fabricCat.id,
        unit: 'METER',
        unitPrice: 150.00,
        minStockLevel: 500,
        maxStockLevel: 5000,
        supplierId: fabricSupp.id,
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    await prisma.materials.create({
      data: {
        id: randomUUID(),
        code: 'TRM-BTN-001',
        name: 'Metal Buttons - 20mm',
        categoryId: trimsCat.id,
        unit: 'PIECES',
        unitPrice: 2.50,
        minStockLevel: 1000,
        maxStockLevel: 10000,
        supplierId: trimsSupp.id,
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 2 materials\n');

    // ========================================
    // 5. WAREHOUSES
    // ========================================
    console.log('🏭 Creating Warehouses...');

    await prisma.warehouses.create({
      data: {
        id: randomUUID(),
        code: 'WH-RM-001',
        name: 'Raw Materials Warehouse',
        location: 'Bangalore Main Unit',
        warehouseType: 'RAW_MATERIALS',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    await prisma.warehouses.create({
      data: {
        id: randomUUID(),
        code: 'WH-FG-001',
        name: 'Finished Goods Warehouse',
        location: 'Bangalore Dispatch',
        warehouseType: 'FINISHED_GOODS',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 2 warehouses\n');

    // ========================================
    // 6. STYLES (Simple test style)
    // ========================================
    console.log('👔 Creating Test Style...');

    const testStyle = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode: 'TEST-001',
        styleName: 'Test Garment',
        category: 'ETHNIC',
        gender: 'UNISEX',
        season: 'ALL_SEASON',
        description: 'Simple test garment for order testing',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    // Add colors
    const color1 = await prisma.color_options.create({
      data: {
        id: randomUUID(),
        styleId: testStyle.id,
        colorName: 'Red',
        colorCode: '#FF0000',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const color2 = await prisma.color_options.create({
      data: {
        id: randomUUID(),
        styleId: testStyle.id,
        colorName: 'Blue',
        colorCode: '#0000FF',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    // Add sizes
    const sizeS = await prisma.size_options.create({
      data: {
        id: randomUUID(),
        styleId: testStyle.id,
        sizeName: 'Small',
        sizeCode: 'S',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const sizeM = await prisma.size_options.create({
      data: {
        id: randomUUID(),
        styleId: testStyle.id,
        sizeName: 'Medium',
        sizeCode: 'M',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    const sizeL = await prisma.size_options.create({
      data: {
        id: randomUUID(),
        styleId: testStyle.id,
        sizeName: 'Large',
        sizeCode: 'L',
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 1 style with 2 colors and 3 sizes\n');

    console.log('\n============================================================');
    console.log('🎉 Database Reset and Seeding Complete!');
    console.log('============================================================\n');
    console.log('📊 Summary:');
    console.log('   ✅ 1 Customer (Fashion Boutique)');
    console.log('   ✅ 2 Suppliers (Fabric, Trims)');
    console.log('   ✅ 2 Material Categories');
    console.log('   ✅ 2 Materials');
    console.log('   ✅ 2 Warehouses');
    console.log('   ✅ 1 Style (TEST-001) with 2 colors × 3 sizes');
    console.log('\n🎯 Next: Try creating an order with the TEST-001 style\n');

  } catch (error) {
    console.error('❌ Reset/Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
