/**
 * Seed Script: Create JOB_WORK warehouses for all DYEING_PRINTING processors
 *
 * Each processor gets a linked warehouse so greige shipped directly to
 * processors can be tracked with proper warehouse location.
 *
 * Safe to run multiple times - skips processors that already have a linked warehouse.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProcessorWarehouses() {
  console.log('=== Seeding Processor Warehouses ===\n');

  // Get admin user for createdById
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error('No admin user found. Cannot create warehouses without createdById.');
  }

  // Get all active DYEING_PRINTING processors
  const processors = await prisma.suppliers.findMany({
    where: {
      supplierCategories: { has: 'DYEING_PRINTING' },
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      contactPerson: true,
      phone: true,
    },
  });

  console.log(`Found ${processors.length} active DYEING_PRINTING processors\n`);

  // Get existing warehouses linked to processors (to skip duplicates)
  const existingLinked = await prisma.warehouses.findMany({
    where: { supplierId: { not: null } },
    select: { supplierId: true },
  });
  const linkedSupplierIds = new Set(existingLinked.map(w => w.supplierId));

  // Find the highest existing JOB_WORK warehouse code number
  const lastJwWarehouse = await prisma.warehouses.findFirst({
    where: { warehouseCode: { startsWith: 'WH-JW-' } },
    orderBy: { warehouseCode: 'desc' },
    select: { warehouseCode: true },
  });

  let nextNumber = 1;
  if (lastJwWarehouse) {
    const num = parseInt(lastJwWarehouse.warehouseCode.replace('WH-JW-', ''));
    if (!isNaN(num)) nextNumber = num + 1;
  }

  let created = 0;
  let skipped = 0;

  for (const processor of processors) {
    if (linkedSupplierIds.has(processor.id)) {
      console.log(`  SKIP: ${processor.code} - ${processor.name} (already has warehouse)`);
      skipped++;
      continue;
    }

    const warehouseCode = `WH-JW-${nextNumber.toString().padStart(4, '0')}`;
    const warehouseName = `${processor.name} - Processing Unit`;

    await prisma.warehouses.create({
      data: {
        warehouseCode,
        warehouseName,
        warehouseType: 'JOB_WORK',
        address: processor.address || null,
        contactPerson: processor.contactPerson || null,
        contactPhone: processor.phone || null,
        isActive: true,
        supplierId: processor.id,
        createdById: adminUser.id,
      },
    });

    console.log(`  CREATED: ${warehouseCode} - ${warehouseName}`);
    nextNumber++;
    created++;
  }

  console.log(`\n=== Done: ${created} created, ${skipped} skipped ===`);
}

seedProcessorWarehouses()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
