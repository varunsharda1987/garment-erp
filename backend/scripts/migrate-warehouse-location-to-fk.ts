/**
 * Migrate warehouseLocation (text) to warehouseId (FK)
 *
 * Phase 2.3 of Stock Architecture Refactor
 *
 * This script:
 * 1. Builds a mapping from warehouseLocation text → warehouseId
 * 2. Updates warehouseId in all specialized stock tables based on warehouseLocation
 * 3. Reports unmapped locations for manual review
 *
 * Usage:
 *   npx ts-node scripts/migrate-warehouse-location-to-fk.ts --dry-run   # Preview changes
 *   npx ts-node scripts/migrate-warehouse-location-to-fk.ts --apply     # Apply changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPECIALIZED_TABLES = [
  'greige_stock',
  'fabric_stock',
  'lace_stock',
  'thread_stock',
  'button_stock',
  'zipper_stock',
  'elastic_stock',
  'label_stock',
  'packaging_stock',
  // machine_part_stock and other_material_stock are new, no existing data to migrate
];

interface WarehouseMapping {
  id: string;
  code: string;
  name: string;
  variations: string[]; // Possible text variations that map to this warehouse
}

/**
 * Build mapping from warehouse text patterns to warehouse IDs
 */
async function buildWarehouseLocationMap(): Promise<Map<string, string>> {
  const warehouses = await prisma.warehouses.findMany({
    where: { isActive: true },
    select: { id: true, warehouseCode: true, warehouseName: true },
  });

  const mapping = new Map<string, string>();

  for (const wh of warehouses) {
    // Add exact matches
    mapping.set(wh.warehouseCode.toLowerCase().trim(), wh.id);
    mapping.set(wh.warehouseName.toLowerCase().trim(), wh.id);

    // Add common variations
    const variations = [
      wh.warehouseCode,
      wh.warehouseName,
      `${wh.warehouseCode} - ${wh.warehouseName}`,
      `${wh.warehouseName} (${wh.warehouseCode})`,
      wh.warehouseCode.replace(/-/g, ' '),
      wh.warehouseName.replace(/warehouse/gi, '').trim(),
      wh.warehouseName.replace(/godown/gi, '').trim(),
    ];

    for (const v of variations) {
      if (v) {
        mapping.set(v.toLowerCase().trim(), wh.id);
      }
    }
  }

  console.log(`\nBuilt mapping for ${warehouses.length} warehouses:`);
  warehouses.forEach((wh) => console.log(`  - ${wh.warehouseCode}: ${wh.warehouseName}`));

  return mapping;
}

interface MigrationStats {
  table: string;
  total: number;
  alreadyMapped: number;
  mapped: number;
  unmapped: number;
  unmappedLocations: string[];
}

/**
 * Migrate warehouseLocation to warehouseId for a specific table
 */
async function migrateTable(
  tableName: string,
  locationMap: Map<string, string>,
  dryRun: boolean
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    table: tableName,
    total: 0,
    alreadyMapped: 0,
    mapped: 0,
    unmapped: 0,
    unmappedLocations: [],
  };

  // Get all records with warehouseLocation but no warehouseId
  const records = await (prisma as any)[tableName].findMany({
    where: {
      warehouseId: null,
      warehouseLocation: { not: null },
    },
    select: {
      id: true,
      warehouseLocation: true,
    },
  });

  // Count records that already have warehouseId
  const alreadyMapped = await (prisma as any)[tableName].count({
    where: {
      warehouseId: { not: null },
    },
  });

  stats.total = records.length + alreadyMapped;
  stats.alreadyMapped = alreadyMapped;

  for (const record of records) {
    const location = record.warehouseLocation?.toLowerCase().trim();
    const warehouseId = location ? locationMap.get(location) : null;

    if (warehouseId) {
      if (!dryRun) {
        await (prisma as any)[tableName].update({
          where: { id: record.id },
          data: { warehouseId },
        });
      }
      stats.mapped++;
    } else if (record.warehouseLocation) {
      stats.unmapped++;
      if (!stats.unmappedLocations.includes(record.warehouseLocation)) {
        stats.unmappedLocations.push(record.warehouseLocation);
      }
    }
  }

  return stats;
}

/**
 * Get default warehouse for records with no location
 */
async function getDefaultWarehouse(): Promise<string | null> {
  const defaultWh = await prisma.warehouses.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, warehouseCode: true, warehouseName: true },
  });

  if (defaultWh) {
    console.log(`\nDefault warehouse (for null locations): ${defaultWh.warehouseCode} - ${defaultWh.warehouseName}`);
    return defaultWh.id;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--apply');

  console.log('\n=== Warehouse Location to FK Migration ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'APPLY (making changes)'}\n`);

  // Build mapping
  const locationMap = await buildWarehouseLocationMap();
  const defaultWarehouseId = await getDefaultWarehouse();

  // Migrate each table
  const allStats: MigrationStats[] = [];

  for (const table of SPECIALIZED_TABLES) {
    console.log(`\nProcessing ${table}...`);
    const stats = await migrateTable(table, locationMap, dryRun);
    allStats.push(stats);
  }

  // Summary
  console.log('\n\n=== Migration Summary ===\n');
  console.log('| Table           | Total | Already | Mapped | Unmapped |');
  console.log('|-----------------|-------|---------|--------|----------|');

  let totalMapped = 0;
  let totalUnmapped = 0;
  const allUnmappedLocations: string[] = [];

  for (const s of allStats) {
    console.log(
      `| ${s.table.padEnd(15)} | ${String(s.total).padStart(5)} | ${String(s.alreadyMapped).padStart(7)} | ${String(s.mapped).padStart(6)} | ${String(s.unmapped).padStart(8)} |`
    );
    totalMapped += s.mapped;
    totalUnmapped += s.unmapped;
    allUnmappedLocations.push(...s.unmappedLocations);
  }

  console.log(`\nTotal mapped: ${totalMapped}`);
  console.log(`Total unmapped: ${totalUnmapped}`);

  // Report unmapped locations
  if (allUnmappedLocations.length > 0) {
    const unique = [...new Set(allUnmappedLocations)];
    console.log(`\n⚠️  Unmapped locations (need manual warehouse creation or mapping):`);
    unique.forEach((loc) => console.log(`  - "${loc}"`));
    console.log('\nTo fix: Create these warehouses in the system, or update the mapping logic.');
  }

  if (dryRun) {
    console.log('\n--- Dry Run Complete ---');
    console.log('Run with --apply to make changes.\n');
  } else {
    console.log('\n✅ Migration complete.\n');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
