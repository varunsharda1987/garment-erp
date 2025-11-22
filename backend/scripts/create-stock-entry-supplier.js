const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createStockEntrySupplier() {
  try {
    console.log('Creating "Stock Entry" supplier...\n');

    // Check if it already exists
    const existing = await prisma.suppliers.findFirst({
      where: {
        OR: [
          { code: 'STOCK-ENTRY' },
          { name: 'Stock Entry' }
        ]
      }
    });

    if (existing) {
      console.log('✅ Stock Entry supplier already exists:');
      console.log(`   ID: ${existing.id}`);
      console.log(`   Code: ${existing.code}`);
      console.log(`   Name: ${existing.name}`);
      return;
    }

    // Create the supplier
    const { randomUUID } = require('crypto');
    const now = new Date();
    const supplier = await prisma.suppliers.create({
      data: {
        id: randomUUID(),
        code: 'STOCK-ENTRY',
        name: 'Stock Entry',
        contactPerson: 'System',
        email: 'stock@system.local',
        phone: 'N/A',
        address: 'Internal Stock Entry',
        city: 'N/A',
        state: 'N/A',
        country: 'N/A',
        pincode: '000000',
        supplierCategory: 'FABRIC_SUPPLIER',
        isActive: true,
        notes: 'Automatically created supplier for generic stock entries without a specific supplier.',
        createdAt: now,
        updatedAt: now,
      }
    });

    console.log('✅ Stock Entry supplier created successfully:');
    console.log(`   ID: ${supplier.id}`);
    console.log(`   Code: ${supplier.code}`);
    console.log(`   Name: ${supplier.name}`);
  } catch (error) {
    console.error('Error creating Stock Entry supplier:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStockEntrySupplier();
