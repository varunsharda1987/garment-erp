/**
 * Sync Masters to Materials Script
 *
 * This one-time migration script creates materials records for all existing
 * fabric_master, greige_master, and lace_master records that don't have one.
 *
 * Uses the SAME ID as the master table for consistency.
 *
 * Usage: npx ts-node scripts/sync-masters-to-materials.ts
 */

import { PrismaClient, Unit } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryInfo {
  id: string;
  name: string;
}

const CATEGORIES: Record<string, CategoryInfo> = {
  FABRIC: { id: 'CAT-FABRIC', name: 'Fabric' },
  GREIGE: { id: 'CAT-GREIGE', name: 'Greige (Raw Fabric)' },
  LACE: { id: 'CAT-LACE', name: 'Lace' },
};

async function ensureCategories() {
  console.log('Ensuring categories exist...');

  for (const [type, { id, name }] of Object.entries(CATEGORIES)) {
    // First try to find by ID
    let existing = await prisma.material_categories.findUnique({ where: { id } });

    if (!existing) {
      // If not found by ID, try to find by name (case-insensitive)
      existing = await prisma.material_categories.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
    }

    if (existing) {
      // Update our category map to use the actual ID
      CATEGORIES[type].id = existing.id;
      console.log(`  Category already exists: ${existing.name} (${existing.id})`);
    } else {
      // Create new category
      const created = await prisma.material_categories.create({
        data: {
          id,
          name,
          description: `Auto-created category for ${type} materials`,
          level: 1,
          sortOrder: 0,
          isActive: true,
        },
      });
      CATEGORIES[type].id = created.id;
      console.log(`  Created category: ${name} (${id})`);
    }
  }
}

async function syncFabrics() {
  console.log('\nSyncing fabric_master to materials...');

  // Find all fabrics that don't have a materials record with matching ID
  const fabrics = await prisma.fabric_master.findMany({
    where: { isActive: true },
  });

  let created = 0;
  let skipped = 0;

  for (const fabric of fabrics) {
    // Check if materials record already exists with this ID
    const existing = await prisma.materials.findUnique({
      where: { id: fabric.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Also check if there's a materials record linked via fabricId
    const linkedMaterial = await prisma.materials.findFirst({
      where: { fabricId: fabric.id },
    });

    if (linkedMaterial) {
      // Update the linked material to use the same ID if different
      if (linkedMaterial.id !== fabric.id) {
        console.log(`  Warning: Fabric ${fabric.fabricCode} has mismatched material ID (${linkedMaterial.id} vs ${fabric.id})`);
      }
      skipped++;
      continue;
    }

    // Create materials record with same ID
    await prisma.materials.create({
      data: {
        id: fabric.id,
        code: fabric.fabricCode,
        name: fabric.fabricName,
        categoryId: CATEGORIES.FABRIC.id,
        materialType: 'FABRIC',
        unit: 'METER' as Unit,
        fabricId: fabric.id,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`  Fabrics: ${created} created, ${skipped} already exist`);
  return created;
}

async function syncGreige() {
  console.log('\nSyncing greige_master to materials...');

  const greigeList = await prisma.greige_master.findMany({
    where: { isActive: true },
  });

  let created = 0;
  let skipped = 0;

  for (const greige of greigeList) {
    const existing = await prisma.materials.findUnique({
      where: { id: greige.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const linkedMaterial = await prisma.materials.findFirst({
      where: { greigeId: greige.id },
    });

    if (linkedMaterial) {
      if (linkedMaterial.id !== greige.id) {
        console.log(`  Warning: Greige ${greige.greigeCode} has mismatched material ID (${linkedMaterial.id} vs ${greige.id})`);
      }
      skipped++;
      continue;
    }

    await prisma.materials.create({
      data: {
        id: greige.id,
        code: greige.greigeCode,
        name: greige.greigeName,
        categoryId: CATEGORIES.GREIGE.id,
        materialType: 'GREIGE',
        unit: 'METER' as Unit,
        greigeId: greige.id,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`  Greige: ${created} created, ${skipped} already exist`);
  return created;
}

async function syncLace() {
  console.log('\nSyncing lace_master to materials...');

  const laceList = await prisma.lace_master.findMany({
    where: { isActive: true },
  });

  let created = 0;
  let skipped = 0;

  for (const lace of laceList) {
    const existing = await prisma.materials.findUnique({
      where: { id: lace.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const linkedMaterial = await prisma.materials.findFirst({
      where: { laceId: lace.id },
    });

    if (linkedMaterial) {
      if (linkedMaterial.id !== lace.id) {
        console.log(`  Warning: Lace ${lace.laceCode} has mismatched material ID (${linkedMaterial.id} vs ${lace.id})`);
      }
      skipped++;
      continue;
    }

    await prisma.materials.create({
      data: {
        id: lace.id,
        code: lace.laceCode,
        name: lace.laceName,
        categoryId: CATEGORIES.LACE.id,
        materialType: 'LACE',
        unit: 'METER' as Unit,
        laceId: lace.id,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`  Lace: ${created} created, ${skipped} already exist`);
  return created;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Sync Masters to Materials Script');
  console.log('='.repeat(60));

  try {
    // 1. Ensure categories exist
    await ensureCategories();

    // 2. Sync each master type
    const fabricCount = await syncFabrics();
    const greigeCount = await syncGreige();
    const laceCount = await syncLace();

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Total materials created: ${fabricCount + greigeCount + laceCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
