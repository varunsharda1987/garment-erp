const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createStockEntrySupplier() {
  try {
    console.log('Creating "Stock Entry" supplier...\n');

    // Check if it already exists
    const existing = await prisma.$queryRaw`
      SELECT * FROM suppliers
      WHERE code = 'STOCK-ENTRY' OR name = 'Stock Entry'
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      console.log('✅ Stock Entry supplier already exists:');
      console.log(`   ID: ${existing[0].id}`);
      console.log(`   Code: ${existing[0].code}`);
      console.log(`   Name: ${existing[0].name}`);
      return;
    }

    // Get a system user to assign as creator
    const systemUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!systemUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    // Create the supplier using raw SQL
    const { randomUUID } = require('crypto');
    const id = randomUUID();
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO suppliers (
        id, code, name, "contactPerson", email, phone,
        address, "gstNumber",
        "supplierCategory", "isActive",
        "createdAt", "updatedAt", "createdById"
      ) VALUES (
        ${id},
        'STOCK-ENTRY',
        'Stock Entry',
        'System',
        'stock@system.local',
        'N/A',
        'Internal Stock Entry',
        null,
        'FABRIC_SUPPLIER'::"SupplierCategory",
        true,
        ${now},
        ${now},
        ${systemUser.id}
      )
    `;

    console.log('✅ Stock Entry supplier created successfully:');
    console.log(`   ID: ${id}`);
    console.log(`   Code: STOCK-ENTRY`);
    console.log(`   Name: Stock Entry`);
  } catch (error) {
    console.error('Error creating Stock Entry supplier:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStockEntrySupplier();
