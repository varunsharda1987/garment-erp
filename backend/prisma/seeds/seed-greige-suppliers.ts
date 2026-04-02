/**
 * Seed Script: Create GREIGE_SUPPLIER entries
 * Safe to run multiple times — skips suppliers that already exist by name.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GREIGE_SUPPLIERS = [
  'Avant Garde',
  'Dipti Textiles',
  'Jagga Fabric',
  'Mansukh Prints',
  'Maha Laxmi Export',
  'Kamal Textiles',
  'Nyrah International',
  'Hardik International',
  'Bhuval Corporation',
  'Apparel Pvt Ltd',
  'VSM Weaves',
  'CS Yarns',
];

async function seedGreigeSuppliers() {
  console.log('=== Seeding Greige Suppliers ===\n');

  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error('No admin user found.');
  }

  // Find highest existing SUP-GRG code
  const lastCode = await prisma.suppliers.findFirst({
    where: { code: { startsWith: 'SUP-GRG-' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let nextNum = 1;
  if (lastCode) {
    const num = parseInt(lastCode.code.replace('SUP-GRG-', ''));
    if (!isNaN(num)) nextNum = num + 1;
  }

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const name of GREIGE_SUPPLIERS) {
    // Check if supplier with this name already exists
    const existing = await prisma.suppliers.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true, code: true, supplierCategories: true },
    });

    if (existing) {
      // If exists but doesn't have GREIGE_SUPPLIER category, add it
      if (!existing.supplierCategories.includes('GREIGE_SUPPLIER')) {
        await prisma.suppliers.update({
          where: { id: existing.id },
          data: {
            supplierCategories: {
              push: 'GREIGE_SUPPLIER',
            },
          },
        });
        console.log(`  UPDATED: ${existing.code} - ${existing.name} (added GREIGE_SUPPLIER category)`);
        updated++;
      } else {
        console.log(`  SKIP: ${existing.code} - ${existing.name} (already exists with GREIGE_SUPPLIER)`);
        skipped++;
      }
      continue;
    }

    const code = `SUP-GRG-${nextNum.toString().padStart(4, '0')}`;

    await prisma.suppliers.create({
      data: {
        code,
        name,
        supplierCategories: ['GREIGE_SUPPLIER'],
        isActive: true,
        rating: 0,
        createdById: adminUser.id,
      },
    });

    console.log(`  CREATED: ${code} - ${name}`);
    nextNum++;
    created++;
  }

  console.log(`\n=== Done: ${created} created, ${updated} updated, ${skipped} skipped ===`);
}

seedGreigeSuppliers()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
