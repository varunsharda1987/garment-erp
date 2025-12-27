/**
 * Seed script for SYSTEM_DEFAULT processor
 * Creates a special supplier for storing default processing rates
 * Run with: npx ts-node prisma/seeds/seed-system-default-processor.ts
 */

import { PrismaClient, SupplierCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSystemDefaultProcessor() {
  console.log('Creating SYSTEM_DEFAULT processor for default rates...\n');

  try {
    // Check if already exists
    const existing = await prisma.suppliers.findFirst({
      where: { code: 'SYSTEM_DEFAULT' },
    });

    if (existing) {
      console.log('[SKIP] SYSTEM_DEFAULT supplier already exists');
      console.log(`  ID: ${existing.id}`);
      console.log(`  Name: ${existing.name}`);
      return existing;
    }

    // Get an admin user to use as createdById
    const adminUser = await prisma.users.findFirst({
      where: {
        OR: [
          { role: 'ADMIN' },
          { email: { contains: 'admin' } },
        ],
      },
    });

    if (!adminUser) {
      throw new Error('No admin user found. Please create an admin user first.');
    }

    console.log(`Using admin user: ${adminUser.email} (${adminUser.id})`);

    // Create the supplier
    const supplier = await prisma.suppliers.create({
      data: {
        code: 'SYSTEM_DEFAULT',
        name: 'System Default Rates',
        supplierCategories: [SupplierCategory.DYEING_PRINTING],
        isActive: false, // Hidden from normal supplier lists
        createdById: adminUser.id,
      },
    });

    console.log('[OK] Created SYSTEM_DEFAULT supplier');
    console.log(`  ID: ${supplier.id}`);
    console.log(`  Name: ${supplier.name}`);
    console.log(`  Code: ${supplier.code}`);
    console.log(`  Categories: ${supplier.supplierCategories.join(', ')}`);
    console.log(`  isActive: ${supplier.isActive} (hidden from normal lists)`);

    return supplier;
  } catch (error: unknown) {
    console.error('[ERROR] Failed to create SYSTEM_DEFAULT supplier:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

seedSystemDefaultProcessor()
  .then((supplier) => {
    console.log('\n=== Summary ===');
    console.log('SYSTEM_DEFAULT processor created/verified successfully!');
    console.log('\nThis supplier is used to store default processing rates.');
    console.log('Configure default rates in the Processor Rate Card page.');
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
