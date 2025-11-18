// Complete Workflow Seed Script
// Populates all necessary master data for creating a style and work order

import { PrismaClient, CustomerType, CustomerCategory, SupplierCategory } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Populating Complete Workflow Data...\\n');
  console.log('============================================================');
  console.log('This will create all necessary master data for testing');
  console.log('============================================================\\n');

  try {
    // Get admin user
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Please create admin user first.');
    }

    console.log(`✅ Found admin user: ${adminUser.email}\\n`);

    // ========================================
    // 1. CUSTOMERS
    // ========================================
    console.log('👥 Creating Customers...');

    const customer1 = await prisma.customers.upsert({
      where: { code: 'CUST-DOM-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-DOM-001',
        name: 'Fashion Boutique Pvt Ltd',
        type: CustomerType.BUYER,
        category: CustomerCategory.DOMESTIC,
        contactPerson: 'Rajesh Kumar',
        email: 'rajesh@fashionboutique.in',
        phone: '9876543210',
        billingAddress: '123 MG Road, Mumbai',
        shippingAddress: '123 MG Road, Mumbai',
        gstNumber: '27AABCU9603R1ZM',
        creditLimit: 500000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const customer2 = await prisma.customers.upsert({
      where: { code: 'CUST-EXP-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-EXP-001',
        name: 'Global Fashions Inc',
        type: CustomerType.BUYER,
        category: CustomerCategory.EXPORT,
        contactPerson: 'Sarah Johnson',
        email: 'sarah@globalfashions.com',
        phone: '+1-555-0123',
        billingAddress: '100 Fifth Avenue, New York, USA',
        shippingAddress: '100 Fifth Avenue, New York, USA',
        creditLimit: 2000000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    console.log('✅ Created 2 customers\\n');

    // ========================================
    // 2. SUPPLIERS
    // ========================================
    console.log('🏢 Creating Suppliers...');

    // Fabric Supplier
    const fabricSupp = await prisma.suppliers.upsert({
      where: { code: 'SUPP-FAB-001' },
      update: {},
      create: {
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

    // Trims Supplier
    const trimsSupp = await prisma.suppliers.upsert({
      where: { code: 'SUPP-TRM-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-TRM-001',
        name: 'Button & Zipper Co',
        supplierCategory: SupplierCategory.TRIMS_ACCESSORIES,
        contactPerson: 'Vijay Shah',
        email: 'vijay@buttonzipper.in',
        phone: '9123456782',
        address: 'Industrial Area, Ludhiana, Punjab - 141001',
        gstNumber: '03AABCU9603R1ZR',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    // Dyeing Supplier
    const dyeSupp = await prisma.suppliers.upsert({
      where: { code: 'SUPP-DYE-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-DYE-001',
        name: 'Color Perfect Dyeing',
        supplierCategory: SupplierCategory.DYEING_PRINTING,
        contactPerson: 'Arvind Kumar',
        email: 'arvind@colorperfect.in',
        phone: '9123456784',
        address: 'Dyeing Hub, Tirupur, Tamil Nadu - 641601',
        gstNumber: '33AABCU9603R1ZT',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    // Embroidery Supplier
    const embSupp = await prisma.suppliers.upsert({
      where: { code: 'SUPP-EMB-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-EMB-001',
        name: 'Royal Embroidery Works',
        supplierCategory: SupplierCategory.EMBROIDERY,
        contactPerson: 'Deepak Singh',
        email: 'deepak@royalemb.in',
        phone: '9123456786',
        address: 'Embroidery Lane, Lucknow, Uttar Pradesh - 226001',
        gstNumber: '09AABCU9603R1ZV',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    // CMT Unit
    const cmtSupp = await prisma.suppliers.upsert({
      where: { code: 'SUPP-CMT-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-CMT-001',
        name: 'Precision Stitching Unit',
        supplierCategory: SupplierCategory.CMT_UNIT,
        contactPerson: 'Mahesh Reddy',
        email: 'mahesh@precisionst.in',
        phone: '9123456787',
        address: 'Garment City, Bangalore, Karnataka - 560001',
        gstNumber: '29AABCU9603R1ZW',
        isActive: true,
        createdById: adminUser.id,
        updatedAt: new Date(),
      }
    });

    console.log('✅ Created 5 suppliers (Fabric, Trims, Dyeing, Embroidery, CMT)\\n');

    // ========================================
    // 3. MATERIAL CATEGORIES
    // ========================================
    console.log('📦 Ensuring Material Categories...');

    const categories = [
      { code: 'FABRIC', name: 'Fabric' },
      { code: 'TRIMS', name: 'Trims & Accessories' },
      { code: 'PACKAGING', name: 'Packaging Materials' },
      { code: 'THREAD', name: 'Thread & Yarn' },
      { code: 'LABELS', name: 'Labels & Tags' },
    ];

    for (const cat of categories) {
      await prisma.material_categories.upsert({
        where: { code: cat.code },
        update: {},
        create: {
          id: randomUUID(),
          code: cat.code,
          name: cat.name,
          isActive: true,
          createdById: adminUser.id,
          updatedAt: new Date(),
        }
      });
    }

    console.log('✅ Created/Updated 5 material categories\\n');

    // ========================================
    // 4. MATERIALS
    // ========================================
    console.log('🧵 Creating Materials...');

    const fabricCat = await prisma.material_categories.findUnique({
      where: { code: 'FABRIC' }
    });

    const trimsCat = await prisma.material_categories.findUnique({
      where: { code: 'TRIMS' }
    });

    if (!fabricCat || !trimsCat) {
      throw new Error('Material categories not found');
    }

    // Fabric Material
    await prisma.materials.upsert({
      where: { code: 'FAB-COT-001' },
      update: {},
      create: {
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

    // Button Material
    await prisma.materials.upsert({
      where: { code: 'TRM-BTN-001' },
      update: {},
      create: {
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

    console.log('✅ Created 2 materials (Fabric, Buttons)\\n');

    // ========================================
    // 5. WAREHOUSES
    // ========================================
    console.log('🏭 Creating Warehouses...');

    await prisma.warehouses.upsert({
      where: { code: 'WH-RM-001' },
      update: {},
      create: {
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

    await prisma.warehouses.upsert({
      where: { code: 'WH-FG-001' },
      update: {},
      create: {
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

    console.log('✅ Created 2 warehouses\\n');

    console.log('\\n============================================================');
    console.log('🎉 Complete Workflow Data Seeding Successful!');
    console.log('============================================================\\n');
    console.log('📊 Summary:');
    console.log('   ✅ 2 Customers (Domestic + Export)');
    console.log('   ✅ 5 Suppliers (Fabric, Trims, Dyeing, Embroidery, CMT)');
    console.log('   ✅ 5 Material Categories');
    console.log('   ✅ 2 Materials (Fabric, Buttons)');
    console.log('   ✅ 2 Warehouses (Raw Materials, Finished Goods)');
    console.log('\\n🎯 Next Steps:');
    console.log('   1. Create a new Style');
    console.log('   2. Add BOM for the style');
    console.log('   3. Create Cost Sheet');
    console.log('   4. Create Customer Order');
    console.log('   5. Generate Work Order');
    console.log('   6. Track Production\\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
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
