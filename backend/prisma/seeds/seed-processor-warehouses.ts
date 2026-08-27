/**
 * Seed Script: Create JOB_WORK warehouses for ALL processor suppliers
 *
 * Each processor gets a linked warehouse so materials shipped to them
 * can be tracked with proper warehouse location.
 *
 * Safe to run multiple times - skips processors that already have a linked warehouse.
 */

import { PrismaClient, SupplierCategory } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Supplier categories that are processors — they receive materials/garments
 * for processing and need a JOB_WORK warehouse for stock tracking.
 */
const PROCESSOR_CATEGORIES: SupplierCategory[] = [
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'SMOCKING',
  'CMT_UNIT',
  'FINISHING_CONTRACTOR',
  'STITCHING_CONTRACTOR',
  'WASHING',
  'DORI_PIPING_CONTRACTOR',
];

async function seedProcessorWarehouses() {
  console.log('=== Seeding Processor Warehouses ===\n');
  console.log(`Processor categories: ${PROCESSOR_CATEGORIES.join(', ')}\n`);

  // Get admin user for createdById
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error('No admin user found. Cannot create warehouses without createdById.');
  }

  // Get all active processors (suppliers with ANY processor category)
  const processors = await prisma.suppliers.findMany({
    where: {
      supplierCategories: { hasSome: PROCESSOR_CATEGORIES },
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      contactPerson: true,
      phone: true,
      supplierCategories: true,
    },
  });

  console.log(`Found ${processors.length} active processor suppliers\n`);

  // Get existing warehouses linked to processors (to skip duplicates)
  const existingLinked = await prisma.warehouses.findMany({
    where: { supplierId: { not: null } },
    select: { supplierId: true },
  });
  const linkedSupplierIds = new Set(existingLinked.map((w) => w.supplierId));

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

    const categories = processor.supplierCategories
      .filter((c) => PROCESSOR_CATEGORIES.includes(c))
      .join(', ');
    console.log(`  CREATED: ${warehouseCode} - ${warehouseName} [${categories}]`);
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
