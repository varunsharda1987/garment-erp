/**
 * Cleanup Orphan Materials Script
 *
 * This script finds and optionally deletes materials that exist in the materials table
 * but don't have corresponding entries in their master tables (label_master, lace_master, etc.)
 *
 * Usage:
 *   node -r dotenv/config scripts/cleanup-orphan-materials.js        # Dry run (report only)
 *   node -r dotenv/config scripts/cleanup-orphan-materials.js --delete  # Actually delete
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DELETE_MODE = process.argv.includes('--delete');

async function findOrphanMaterials() {
  console.log('='.repeat(60));
  console.log('Orphan Materials Report');
  console.log('='.repeat(60));
  console.log(`Mode: ${DELETE_MODE ? 'DELETE' : 'DRY RUN (report only)'}\n`);

  const orphans = {
    LABEL: [],
    LACE: [],
    BUTTON: [],
    THREAD: [],
    ZIPPER: [],
    ELASTIC: [],
    PACKAGING: [],
  };

  // Find LABEL materials without label_master entry
  const labelMaterials = await prisma.materials.findMany({
    where: { materialType: 'LABEL', isActive: true },
    select: { id: true, code: true, name: true, labelId: true }
  });

  for (const mat of labelMaterials) {
    if (!mat.labelId) {
      orphans.LABEL.push(mat);
    } else {
      const master = await prisma.label_master.findUnique({ where: { id: mat.labelId } });
      if (!master) orphans.LABEL.push(mat);
    }
  }

  // Find LACE materials without lace_master entry
  const laceMaterials = await prisma.materials.findMany({
    where: { materialType: 'LACE', isActive: true },
    select: { id: true, code: true, name: true, laceId: true }
  });

  for (const mat of laceMaterials) {
    if (!mat.laceId) {
      orphans.LACE.push(mat);
    } else {
      const master = await prisma.lace_master.findUnique({ where: { id: mat.laceId } });
      if (!master) orphans.LACE.push(mat);
    }
  }

  // Find BUTTON materials without button_master entry
  const buttonMaterials = await prisma.materials.findMany({
    where: { materialType: 'BUTTON', isActive: true },
    select: { id: true, code: true, name: true, buttonId: true }
  });

  for (const mat of buttonMaterials) {
    if (!mat.buttonId) {
      orphans.BUTTON.push(mat);
    } else {
      const master = await prisma.button_master.findUnique({ where: { id: mat.buttonId } });
      if (!master) orphans.BUTTON.push(mat);
    }
  }

  // Find THREAD materials without thread_master entry
  const threadMaterials = await prisma.materials.findMany({
    where: { materialType: 'THREAD', isActive: true },
    select: { id: true, code: true, name: true, threadId: true }
  });

  for (const mat of threadMaterials) {
    if (!mat.threadId) {
      orphans.THREAD.push(mat);
    } else {
      const master = await prisma.thread_master.findUnique({ where: { id: mat.threadId } });
      if (!master) orphans.THREAD.push(mat);
    }
  }

  // Find ZIPPER materials without zipper_master entry
  const zipperMaterials = await prisma.materials.findMany({
    where: { materialType: 'ZIPPER', isActive: true },
    select: { id: true, code: true, name: true, zipperId: true }
  });

  for (const mat of zipperMaterials) {
    if (!mat.zipperId) {
      orphans.ZIPPER.push(mat);
    } else {
      const master = await prisma.zipper_master.findUnique({ where: { id: mat.zipperId } });
      if (!master) orphans.ZIPPER.push(mat);
    }
  }

  // Find ELASTIC materials without elastic_master entry
  const elasticMaterials = await prisma.materials.findMany({
    where: { materialType: 'ELASTIC', isActive: true },
    select: { id: true, code: true, name: true, elasticId: true }
  });

  for (const mat of elasticMaterials) {
    if (!mat.elasticId) {
      orphans.ELASTIC.push(mat);
    } else {
      const master = await prisma.elastic_master.findUnique({ where: { id: mat.elasticId } });
      if (!master) orphans.ELASTIC.push(mat);
    }
  }

  // Find PACKAGING materials without packaging_master entry
  const packagingMaterials = await prisma.materials.findMany({
    where: { materialType: 'PACKAGING', isActive: true },
    select: { id: true, code: true, name: true, packagingId: true }
  });

  for (const mat of packagingMaterials) {
    if (!mat.packagingId) {
      orphans.PACKAGING.push(mat);
    } else {
      const master = await prisma.packaging_master.findUnique({ where: { id: mat.packagingId } });
      if (!master) orphans.PACKAGING.push(mat);
    }
  }

  // Report findings
  let totalOrphans = 0;
  for (const [type, items] of Object.entries(orphans)) {
    if (items.length > 0) {
      console.log(`\n${type} Orphans (${items.length}):`);
      items.forEach(m => {
        console.log(`  - ${m.code}: ${m.name} (id: ${m.id})`);
      });
      totalOrphans += items.length;
    }
  }

  if (totalOrphans === 0) {
    console.log('\n✅ No orphan materials found. Data integrity is good!');
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total Orphan Materials: ${totalOrphans}`);
  console.log('='.repeat(60));

  // Delete if requested
  if (DELETE_MODE) {
    console.log('\n🗑️  Deleting orphan materials...\n');

    for (const [type, items] of Object.entries(orphans)) {
      if (items.length > 0) {
        const ids = items.map(m => m.id);

        // First delete related stock_levels
        await prisma.stock_levels.deleteMany({
          where: { materialId: { in: ids } }
        });

        // Delete material_suppliers
        await prisma.material_suppliers.deleteMany({
          where: { materialId: { in: ids } }
        });

        // Delete the materials
        const result = await prisma.materials.deleteMany({
          where: { id: { in: ids } }
        });

        console.log(`  Deleted ${result.count} ${type} orphan materials`);
      }
    }

    console.log('\n✅ Cleanup complete!');
  } else {
    console.log('\n⚠️  This was a dry run. No data was deleted.');
    console.log('   Run with --delete flag to actually delete orphan materials:');
    console.log('   node -r dotenv/config scripts/cleanup-orphan-materials.js --delete');
  }
}

findOrphanMaterials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
