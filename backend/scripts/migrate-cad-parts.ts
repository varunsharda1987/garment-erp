/**
 * Migration Script: Populate cad_pattern_parts bridge table
 *
 * This script migrates existing single patternPartId data from fabric_width_cad
 * to the new cad_pattern_parts bridge table for multi-part selection support.
 *
 * Run with: npx ts-node scripts/migrate-cad-parts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCADParts() {
  console.log('Starting CAD parts migration...\n');

  // Find all CAD rows with patternPartId set
  const cadRowsWithParts = await prisma.fabric_width_cad.findMany({
    where: {
      patternPartId: { not: null },
    },
    select: {
      id: true,
      patternPartId: true,
    },
  });

  console.log(`Found ${cadRowsWithParts.length} CAD rows with patternPartId\n`);

  if (cadRowsWithParts.length === 0) {
    console.log('No rows to migrate.');
    return;
  }

  // Check how many already have entries in cad_pattern_parts
  const existingEntries = await prisma.cad_pattern_parts.findMany({
    where: {
      cadId: { in: cadRowsWithParts.map((r) => r.id) },
    },
    select: { cadId: true },
  });

  const existingCadIds = new Set(existingEntries.map((e) => e.cadId));
  const rowsToMigrate = cadRowsWithParts.filter((r) => !existingCadIds.has(r.id));

  console.log(`Already migrated: ${existingCadIds.size} rows`);
  console.log(`To migrate: ${rowsToMigrate.length} rows\n`);

  if (rowsToMigrate.length === 0) {
    console.log('All rows already migrated.');
    return;
  }

  // Create cad_pattern_parts entries
  const result = await prisma.cad_pattern_parts.createMany({
    data: rowsToMigrate.map((row) => ({
      cadId: row.id,
      patternPartId: row.patternPartId!,
    })),
    skipDuplicates: true,
  });

  console.log(`✅ Created ${result.count} cad_pattern_parts entries\n`);

  // Verify migration
  const totalEntries = await prisma.cad_pattern_parts.count();
  console.log(`Total cad_pattern_parts entries: ${totalEntries}`);
}

async function main() {
  try {
    await migrateCADParts();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
