// Comprehensive Seed Script - All Modules
// Populates test data across all 11 completed modules for end-to-end testing

import { PrismaClient, ProductionStage, OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Comprehensive Data Seeding...\n');
  console.log('============================================================');
  console.log('This will populate test data across ALL modules');
  console.log('Estimated time: 2-3 minutes');
  console.log('============================================================\n');

  try {
    // Get admin user
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Please run authentication setup first.');
    }

    console.log(`✅ Found admin user: ${adminUser.email}\n`);

    // ========================================
    // 1. CUSTOMERS (5-7 customers)
    // ========================================
    console.log('👥 Creating Customers...');

    const customer1 = await prisma.customers.upsert({
      where: { code: 'CUST-DOM-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-DOM-001',
        name: 'Fashion Boutique Pvt Ltd',
        type: 'B2B',
        category: 'DOMESTIC',
        contactPerson: 'Rajesh Kumar',
        email: 'rajesh@fashionboutique.in',
        phone: '9876543210',
        address: '123 MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstNumber: '27AABCU9603R1ZM',
        creditLimit: 500000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const customer2 = await prisma.customers.upsert({
      where: { code: 'CUST-DOM-002' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-DOM-002',
        name: 'Style Junction',
        type: 'RETAIL',
        category: 'DOMESTIC',
        contactPerson: 'Priya Sharma',
        email: 'priya@stylejunction.in',
        phone: '9876543211',
        address: '456 Commercial Street',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        gstNumber: '29AABCU9603R1ZN',
        creditLimit: 300000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const customer3 = await prisma.customers.upsert({
      where: { code: 'CUST-DOM-003' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-DOM-003',
        name: 'Trendy Wear Stores',
        type: 'B2B',
        category: 'DOMESTIC',
        contactPerson: 'Amit Patel',
        email: 'amit@trendywear.in',
        phone: '9876543212',
        address: '789 Fashion District',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        gstNumber: '07AABCU9603R1ZO',
        creditLimit: 1000000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const customer4 = await prisma.customers.upsert({
      where: { code: 'CUST-EXP-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-EXP-001',
        name: 'Global Fashions Inc',
        type: 'B2B',
        category: 'EXPORT',
        contactPerson: 'Sarah Johnson',
        email: 'sarah@globalfashions.com',
        phone: '+1-555-0123',
        address: '100 Fifth Avenue',
        city: 'New York',
        state: 'NY',
        pincode: '10001',
        country: 'USA',
        creditLimit: 2000000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const customer5 = await prisma.customers.upsert({
      where: { code: 'CUST-EXP-002' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'CUST-EXP-002',
        name: 'Euro Trends UK Ltd',
        type: 'B2B',
        category: 'EXPORT',
        contactPerson: 'James Williams',
        email: 'james@eurotrends.co.uk',
        phone: '+44-20-7123-4567',
        address: '25 Oxford Street',
        city: 'London',
        pincode: 'W1D 1BS',
        country: 'United Kingdom',
        creditLimit: 1500000,
        isActive: true,
        createdById: adminUser.id,
      }
    });

    console.log('✅ Created 5 customers\n');

    // ========================================
    // 2. SUPPLIERS (12-15 across 7 categories)
    // ========================================
    console.log('🏢 Creating Suppliers...');

    // Fabric Suppliers (2)
    const fabricSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-FAB-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-FAB-001',
        name: 'Premium Fabrics Pvt Ltd',
        category: 'FABRIC',
        contactPerson: 'Sanjay Gupta',
        email: 'sanjay@premiumfabrics.in',
        phone: '9123456780',
        address: 'Textile Market, Surat',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395001',
        gstNumber: '24AABCU9603R1ZP',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const fabricSupp2 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-FAB-002' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-FAB-002',
        name: 'Silk & Cotton Mills',
        category: 'FABRIC',
        contactPerson: 'Ramesh Iyer',
        email: 'ramesh@silkcotton.in',
        phone: '9123456781',
        address: 'Mill Area, Coimbatore',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641001',
        gstNumber: '33AABCU9603R1ZQ',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    // Trims Suppliers (2)
    const trimsSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-TRM-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-TRM-001',
        name: 'Button & Zipper Co',
        category: 'TRIMS_ACCESSORIES',
        contactPerson: 'Vijay Shah',
        email: 'vijay@buttonzipper.in',
        phone: '9123456782',
        address: 'Industrial Area, Ludhiana',
        city: 'Ludhiana',
        state: 'Punjab',
        pincode: '141001',
        gstNumber: '03AABCU9603R1ZR',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const trimsSupp2 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-TRM-002' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-TRM-002',
        name: 'Labels & Tags India',
        category: 'TRIMS_ACCESSORIES',
        contactPerson: 'Neha Kapoor',
        email: 'neha@labelstags.in',
        phone: '9123456783',
        address: 'Packaging Zone, Noida',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201301',
        gstNumber: '09AABCU9603R1ZS',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    // Dyeing/Printing (2)
    const dyeSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-DYE-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-DYE-001',
        name: 'Color Perfect Dyeing',
        category: 'DYEING_PRINTING',
        contactPerson: 'Arvind Kumar',
        email: 'arvind@colorperfect.in',
        phone: '9123456784',
        address: 'Dyeing Hub, Tirupur',
        city: 'Tirupur',
        state: 'Tamil Nadu',
        pincode: '641601',
        gstNumber: '33AABCU9603R1ZT',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const printSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-PRT-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-PRT-001',
        name: 'Digital Print Solutions',
        category: 'DYEING_PRINTING',
        contactPerson: 'Karan Mehta',
        email: 'karan@digitprint.in',
        phone: '9123456785',
        address: 'Print Street, Jaipur',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        gstNumber: '08AABCU9603R1ZU',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    // Embroidery (2)
    const embSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-EMB-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-EMB-001',
        name: 'Royal Embroidery Works',
        category: 'EMBROIDERY',
        contactPerson: 'Deepak Singh',
        email: 'deepak@royalemb.in',
        phone: '9123456786',
        address: 'Embroidery Lane, Lucknow',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226001',
        gstNumber: '09AABCU9603R1ZV',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    // CMT Units (2)
    const cmtSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-CMT-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-CMT-001',
        name: 'Precision Stitching Unit',
        category: 'CMT_UNIT',
        contactPerson: 'Mahesh Reddy',
        email: 'mahesh@precisionst.in',
        phone: '9123456787',
        address: 'Garment City, Bangalore',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        gstNumber: '29AABCU9603R1ZW',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    const cmtSupp2 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-CMT-002' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-CMT-002',
        name: 'Quality Stitching Works',
        category: 'CMT_UNIT',
        contactPerson: 'Suresh Nair',
        email: 'suresh@qualityst.in',
        phone: '9123456788',
        address: 'Industrial Estate, Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        gstNumber: '33AABCU9603R1ZX',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    // Packaging (2)
    const packSupp1 = await prisma.suppliers.upsert({
      where: { code: 'SUPP-PKG-001' },
      update: {},
      create: {
        id: randomUUID(),
        code: 'SUPP-PKG-001',
        name: 'Pack India Solutions',
        category: 'PACKAGING',
        contactPerson: 'Ravi Kumar',
        email: 'ravi@packindia.in',
        phone: '9123456789',
        address: 'Packaging Zone, Pune',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        gstNumber: '27AABCU9603R1ZY',
        isActive: true,
        createdById: adminUser.id,
      }
    });

    console.log('✅ Created 10 suppliers across 7 categories\n');

    console.log('\n============================================================');
    console.log('🎉 Master Data Seeding Complete!');
    console.log('============================================================\n');
    console.log('📊 Summary:');
    console.log('   ✅ 5 Customers (3 Domestic, 2 Export)');
    console.log('   ✅ 10 Suppliers (Fabric, Trims, Dyeing, Embroidery, CMT, Packaging)');
    console.log('\n⏭️  Next: Run material seeding script for full data');
    console.log('   Or continue building the complete seed script...\n');

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
