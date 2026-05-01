/**
 * Stock Levels Reconciliation Script
 *
 * Finds and fixes discrepancies between specialized stock tables (greige_stock,
 * fabric_stock, lace_stock, thread_stock) and the centralized stock_levels table.
 *
 * Usage:
 *   npx ts-node scripts/reconcile-stock-levels.ts --dry-run   # Preview changes
 *   npx ts-node scripts/reconcile-stock-levels.ts --fix       # Apply fixes
 */

import { PrismaClient, Prisma, Unit } from '@prisma/client';

const prisma = new PrismaClient();

interface Discrepancy {
  materialId: string;
  materialCode: string;
  materialType: string;
  specializedQty: number;
  stockLevelQty: number | null;
  difference: number;
  stockLevelExists: boolean;
}

async function getGreigeDiscrepancies(): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  // Aggregate greige_stock by greigeId
  const greigeStocks = await prisma.$queryRaw<Array<{
    greigeId: string;
    totalAvailable: Prisma.Decimal;
  }>>`
    SELECT "greigeId", SUM("quantityAvailable") as "totalAvailable"
    FROM greige_stock
    WHERE status = 'AVAILABLE'
    GROUP BY "greigeId"
  `;

  for (const gs of greigeStocks) {
    // Get the materials record for this greige
    const material = await prisma.materials.findFirst({
      where: { greigeId: gs.greigeId },
      include: { greige_master: { select: { greigeCode: true } } },
    });

    if (!material) continue;

    // Get stock_levels for this material
    const stockLevel = await prisma.stock_levels.findFirst({
      where: { materialId: material.id },
    });

    const specializedQty = Number(gs.totalAvailable);
    const stockLevelQty = stockLevel ? Number(stockLevel.quantity) : null;

    if (stockLevelQty === null || Math.abs(specializedQty - stockLevelQty) > 0.01) {
      discrepancies.push({
        materialId: material.id,
        materialCode: material.greige_master?.greigeCode || material.code,
        materialType: 'GREIGE',
        specializedQty,
        stockLevelQty,
        difference: specializedQty - (stockLevelQty || 0),
        stockLevelExists: stockLevel !== null,
      });
    }
  }

  return discrepancies;
}

async function getFabricDiscrepancies(): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  const fabricStocks = await prisma.$queryRaw<Array<{
    fabricId: string;
    totalAvailable: Prisma.Decimal;
  }>>`
    SELECT "fabricId", SUM("quantityAvailable") as "totalAvailable"
    FROM fabric_stock
    WHERE status = 'AVAILABLE'
    GROUP BY "fabricId"
  `;

  for (const fs of fabricStocks) {
    const material = await prisma.materials.findFirst({
      where: { fabricId: fs.fabricId },
      include: { fabric_master: { select: { fabricCode: true } } },
    });

    if (!material) continue;

    const stockLevel = await prisma.stock_levels.findFirst({
      where: { materialId: material.id },
    });

    const specializedQty = Number(fs.totalAvailable);
    const stockLevelQty = stockLevel ? Number(stockLevel.quantity) : null;

    if (stockLevelQty === null || Math.abs(specializedQty - stockLevelQty) > 0.01) {
      discrepancies.push({
        materialId: material.id,
        materialCode: material.fabric_master?.fabricCode || material.code,
        materialType: 'FABRIC',
        specializedQty,
        stockLevelQty,
        difference: specializedQty - (stockLevelQty || 0),
        stockLevelExists: stockLevel !== null,
      });
    }
  }

  return discrepancies;
}

async function getLaceDiscrepancies(): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  const laceStocks = await prisma.$queryRaw<Array<{
    laceId: string;
    totalAvailable: Prisma.Decimal;
  }>>`
    SELECT "laceId", SUM("quantityAvailable") as "totalAvailable"
    FROM lace_stock
    WHERE status = 'AVAILABLE'
    GROUP BY "laceId"
  `;

  for (const ls of laceStocks) {
    const material = await prisma.materials.findFirst({
      where: { laceId: ls.laceId },
      include: { lace_master: { select: { laceCode: true } } },
    });

    if (!material) continue;

    const stockLevel = await prisma.stock_levels.findFirst({
      where: { materialId: material.id },
    });

    const specializedQty = Number(ls.totalAvailable);
    const stockLevelQty = stockLevel ? Number(stockLevel.quantity) : null;

    if (stockLevelQty === null || Math.abs(specializedQty - stockLevelQty) > 0.01) {
      discrepancies.push({
        materialId: material.id,
        materialCode: material.lace_master?.laceCode || material.code,
        materialType: 'LACE',
        specializedQty,
        stockLevelQty,
        difference: specializedQty - (stockLevelQty || 0),
        stockLevelExists: stockLevel !== null,
      });
    }
  }

  return discrepancies;
}

async function getThreadDiscrepancies(): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  const threadStocks = await prisma.$queryRaw<Array<{
    threadId: string;
    totalMeters: Prisma.Decimal;
  }>>`
    SELECT "threadId", SUM("metersAvailable") as "totalMeters"
    FROM thread_stock
    WHERE status = 'AVAILABLE'
    GROUP BY "threadId"
  `;

  for (const ts of threadStocks) {
    const material = await prisma.materials.findFirst({
      where: { threadId: ts.threadId },
      include: { thread_master: { select: { threadCode: true } } },
    });

    if (!material) continue;

    const stockLevel = await prisma.stock_levels.findFirst({
      where: { materialId: material.id },
    });

    const specializedQty = Number(ts.totalMeters);
    const stockLevelQty = stockLevel ? Number(stockLevel.quantity) : null;

    if (stockLevelQty === null || Math.abs(specializedQty - stockLevelQty) > 0.01) {
      discrepancies.push({
        materialId: material.id,
        materialCode: material.thread_master?.threadCode || material.code,
        materialType: 'THREAD',
        specializedQty,
        stockLevelQty,
        difference: specializedQty - (stockLevelQty || 0),
        stockLevelExists: stockLevel !== null,
      });
    }
  }

  return discrepancies;
}

async function fixDiscrepancies(discrepancies: Discrepancy[]): Promise<number> {
  let fixed = 0;

  for (const d of discrepancies) {
    try {
      if (d.stockLevelExists) {
        // Update existing stock_levels record
        await prisma.stock_levels.updateMany({
          where: { materialId: d.materialId },
          data: {
            quantity: d.specializedQty,
            lastUpdated: new Date(),
          },
        });
      } else {
        // Get default warehouse
        const warehouse = await prisma.warehouses.findFirst({
          where: { isActive: true },
          select: { id: true },
        });

        if (warehouse) {
          await prisma.stock_levels.create({
            data: {
              materialId: d.materialId,
              warehouseId: warehouse.id,
              quantity: d.specializedQty,
              unit: 'METER' as Unit,
              minLevel: 0,
              reorderLevel: 0,
            },
          });
        }
      }
      fixed++;
    } catch (err) {
      console.error(`Failed to fix ${d.materialCode}: ${err}`);
    }
  }

  return fixed;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--fix');

  console.log('\n=== Stock Levels Reconciliation ===\n');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'FIX (applying changes)'}\n`);

  // Gather all discrepancies
  console.log('Checking GREIGE stock...');
  const greigeDiscrepancies = await getGreigeDiscrepancies();

  console.log('Checking FABRIC stock...');
  const fabricDiscrepancies = await getFabricDiscrepancies();

  console.log('Checking LACE stock...');
  const laceDiscrepancies = await getLaceDiscrepancies();

  console.log('Checking THREAD stock...');
  const threadDiscrepancies = await getThreadDiscrepancies();

  const allDiscrepancies = [
    ...greigeDiscrepancies,
    ...fabricDiscrepancies,
    ...laceDiscrepancies,
    ...threadDiscrepancies,
  ];

  // Report
  console.log('\n--- Discrepancy Report ---\n');
  console.log(`GREIGE: ${greigeDiscrepancies.length} discrepancies`);
  console.log(`FABRIC: ${fabricDiscrepancies.length} discrepancies`);
  console.log(`LACE:   ${laceDiscrepancies.length} discrepancies`);
  console.log(`THREAD: ${threadDiscrepancies.length} discrepancies`);
  console.log(`TOTAL:  ${allDiscrepancies.length} discrepancies\n`);

  if (allDiscrepancies.length === 0) {
    console.log('✅ No discrepancies found. Stock levels are in sync.\n');
    await prisma.$disconnect();
    return;
  }

  // Show details
  console.log('Details:\n');
  console.log('| Type   | Code           | Specialized | stock_levels | Diff      |');
  console.log('|--------|----------------|-------------|--------------|-----------|');

  for (const d of allDiscrepancies.slice(0, 50)) {
    const specialized = d.specializedQty.toFixed(2).padStart(11);
    const stockLevel = d.stockLevelQty !== null ? d.stockLevelQty.toFixed(2).padStart(12) : 'MISSING'.padStart(12);
    const diff = d.difference.toFixed(2).padStart(9);
    console.log(`| ${d.materialType.padEnd(6)} | ${d.materialCode.padEnd(14)} | ${specialized} | ${stockLevel} | ${diff} |`);
  }

  if (allDiscrepancies.length > 50) {
    console.log(`... and ${allDiscrepancies.length - 50} more`);
  }

  // Fix if not dry run
  if (!isDryRun) {
    console.log('\n--- Applying Fixes ---\n');
    const fixed = await fixDiscrepancies(allDiscrepancies);
    console.log(`✅ Fixed ${fixed} of ${allDiscrepancies.length} discrepancies.\n`);
  } else {
    console.log('\n--- Dry Run Complete ---');
    console.log('Run with --fix to apply changes.\n');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
