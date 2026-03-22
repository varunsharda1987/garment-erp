/**
 * Migration Script: Migrate Trim Masters to Multi-Supplier Support
 *
 * This script migrates existing single-supplier data (supplierId, pricePerXxx)
 * from the master tables to the new junction tables (xxx_suppliers).
 *
 * For each trim type:
 * 1. Find all records with a supplierId
 * 2. Create a junction table record with the supplier and price data
 * 3. Mark as isPreferred=true, isActive=true
 *
 * Run with: npx ts-node src/scripts/migrate-trim-suppliers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateButtonSuppliers() {
  console.log('\n=== Migrating Button Suppliers ===');

  const buttons = await prisma.button_master.findMany({
    where: {
      supplierId: { not: null },
    },
    select: {
      id: true,
      buttonName: true,
      supplierId: true,
      pricePerPiece: true,
      pricePerGross: true,
    },
  });

  console.log(`Found ${buttons.length} buttons with suppliers to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const button of buttons) {
    // Check if already migrated
    const existing = await prisma.button_suppliers.findFirst({
      where: {
        buttonId: button.id,
        supplierId: button.supplierId!,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.button_suppliers.create({
      data: {
        buttonId: button.id,
        supplierId: button.supplierId!,
        isPreferred: true,
        isActive: true,
        pricePerPiece: button.pricePerPiece,
        pricePerGross: button.pricePerGross,
        notes: 'Migrated from single-supplier system',
      },
    });
    migrated++;
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
}

async function migrateZipperSuppliers() {
  console.log('\n=== Migrating Zipper Suppliers ===');

  const zippers = await prisma.zipper_master.findMany({
    where: {
      supplierId: { not: null },
    },
    select: {
      id: true,
      zipperName: true,
      supplierId: true,
      pricePerPiece: true,
    },
  });

  console.log(`Found ${zippers.length} zippers with suppliers to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const zipper of zippers) {
    const existing = await prisma.zipper_suppliers.findFirst({
      where: {
        zipperId: zipper.id,
        supplierId: zipper.supplierId!,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.zipper_suppliers.create({
      data: {
        zipperId: zipper.id,
        supplierId: zipper.supplierId!,
        isPreferred: true,
        isActive: true,
        pricePerPiece: zipper.pricePerPiece,
        notes: 'Migrated from single-supplier system',
      },
    });
    migrated++;
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
}

async function migrateThreadSuppliers() {
  console.log('\n=== Migrating Thread Suppliers ===');

  const threads = await prisma.thread_master.findMany({
    where: {
      supplierId: { not: null },
    },
    select: {
      id: true,
      threadName: true,
      supplierId: true,
      pricePerCone: true,
    },
  });

  console.log(`Found ${threads.length} threads with suppliers to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const thread of threads) {
    const existing = await prisma.thread_suppliers.findFirst({
      where: {
        threadId: thread.id,
        supplierId: thread.supplierId!,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.thread_suppliers.create({
      data: {
        threadId: thread.id,
        supplierId: thread.supplierId!,
        isPreferred: true,
        isActive: true,
        pricePerCone: thread.pricePerCone,
        notes: 'Migrated from single-supplier system',
      },
    });
    migrated++;
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
}

async function migrateElasticSuppliers() {
  console.log('\n=== Migrating Elastic Suppliers ===');

  const elastics = await prisma.elastic_master.findMany({
    where: {
      supplierId: { not: null },
    },
    select: {
      id: true,
      elasticName: true,
      supplierId: true,
      pricePerMeter: true,
    },
  });

  console.log(`Found ${elastics.length} elastics with suppliers to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const elastic of elastics) {
    const existing = await prisma.elastic_suppliers.findFirst({
      where: {
        elasticId: elastic.id,
        supplierId: elastic.supplierId!,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.elastic_suppliers.create({
      data: {
        elasticId: elastic.id,
        supplierId: elastic.supplierId!,
        isPreferred: true,
        isActive: true,
        pricePerMeter: elastic.pricePerMeter,
        notes: 'Migrated from single-supplier system',
      },
    });
    migrated++;
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
}

async function migrateLabelSuppliers() {
  console.log('\n=== Migrating Label Suppliers ===');

  const labels = await prisma.label_master.findMany({
    where: {
      supplierId: { not: null },
    },
    select: {
      id: true,
      labelName: true,
      supplierId: true,
      pricePerPiece: true,
      pricePerHundred: true,
    },
  });

  console.log(`Found ${labels.length} labels with suppliers to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const label of labels) {
    const existing = await prisma.label_suppliers.findFirst({
      where: {
        labelId: label.id,
        supplierId: label.supplierId!,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.label_suppliers.create({
      data: {
        labelId: label.id,
        supplierId: label.supplierId!,
        isPreferred: true,
        isActive: true,
        pricePerPiece: label.pricePerPiece,
        pricePerHundred: label.pricePerHundred,
        notes: 'Migrated from single-supplier system',
      },
    });
    migrated++;
  }

  console.log(`  Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
}

async function main() {
  console.log('==============================================');
  console.log('Trim Masters Multi-Supplier Migration Script');
  console.log('==============================================');
  console.log('\nThis script migrates existing single-supplier data');
  console.log('to the new multi-supplier junction tables.\n');

  try {
    await migrateButtonSuppliers();
    await migrateZipperSuppliers();
    await migrateThreadSuppliers();
    await migrateElasticSuppliers();
    await migrateLabelSuppliers();

    console.log('\n==============================================');
    console.log('Migration completed successfully!');
    console.log('==============================================');
  } catch (error) {
    console.error('\nMigration failed with error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
