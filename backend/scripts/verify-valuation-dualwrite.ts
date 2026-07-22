/**
 * T2-1 valuation dual-write verification (non-destructive).
 *  1. Mirror-integrity baseline: stock_levels.valuationRate == stock_settings.valuationRate (expect 0 divergent).
 *  2. Reader-immobility: SUM(stock_levels.stockValue) still 872137.46 (no reader was repointed).
 *  3. Forward-sync smoke test: run the REAL stockLevelService.increaseStock with a rate inside a $transaction,
 *     assert stock_settings.valuationRate now mirrors stock_levels.valuationRate (same weighted-avg), then
 *     force-rollback so NO data is mutated. Re-check after rollback that stock_settings is unchanged.
 */
import prisma from '../src/config/database';
import stockLevelService from '../src/services/stockLevel.service';
import { Decimal } from '@prisma/client/runtime/library';

async function main() {
  // 1. Mirror-integrity baseline
  const divergent: any[] = await prisma.$queryRawUnsafe(
    `SELECT sl."materialId", sl."warehouseId", sl."valuationRate" AS ledger, ss."valuationRate" AS settings
     FROM stock_levels sl LEFT JOIN stock_settings ss
       ON ss."materialId"=sl."materialId" AND ss."warehouseId"=sl."warehouseId"
     WHERE sl."valuationRate" IS NOT NULL AND (ss."valuationRate" IS DISTINCT FROM sl."valuationRate")`
  );
  console.log('1. MIRROR-INTEGRITY: divergent rate rows =', divergent.length, divergent.length ? '❌' : '✅ (in sync)');
  if (divergent.length) console.table(divergent);

  // 2. Reader-immobility
  const slVal: any[] = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM("stockValue"),0)::float AS total FROM stock_levels`
  );
  console.log('2. READER-IMMOBILITY: SUM(stock_levels.stockValue) =', slVal[0].total.toFixed(2),
    Math.abs(slVal[0].total - 872137.46) < 1 ? '✅ (unchanged — no reader repointed)' : '⚠ CHANGED');

  // 3. Forward-sync smoke test on a real rated row, rolled back
  const sample = await prisma.stock_levels.findFirst({
    where: { valuationRate: { not: null }, quantity: { gt: 0 } },
  });
  if (!sample) { console.log('3. FORWARD-SYNC: no rated stock_levels row to test — skipped'); await prisma.$disconnect(); return; }

  const key = { materialId_warehouseId: { materialId: sample.materialId, warehouseId: sample.warehouseId } };
  const ssBefore = await prisma.stock_settings.findUnique({ where: key });
  const testRate = new Decimal('4321.5'); // distinct rate to force a weighted-average shift

  let ledgerAfter = '', settingsAfter = '', matched = false;
  try {
    await prisma.$transaction(async (tx) => {
      await stockLevelService.increaseStock(sample.materialId, sample.warehouseId, new Decimal(3), sample.unit, testRate, tx);
      const sl = await tx.stock_levels.findFirst({ where: { materialId: sample.materialId, warehouseId: sample.warehouseId } });
      const ss = await tx.stock_settings.findUnique({ where: key });
      ledgerAfter = sl?.valuationRate?.toString() ?? 'null';
      settingsAfter = ss?.valuationRate?.toString() ?? 'null';
      matched = ledgerAfter === settingsAfter && settingsAfter !== 'null';
      throw new Error('__ROLLBACK__'); // non-destructive: undo everything
    });
  } catch (e: any) {
    if (e.message !== '__ROLLBACK__') throw e;
  }

  console.log('3. FORWARD-SYNC (rolled back, non-destructive):');
  console.log('   test material/warehouse:', sample.materialId, '/', sample.warehouseId);
  console.log('   stock_settings rate BEFORE:', ssBefore?.valuationRate?.toString() ?? 'null');
  console.log('   after +3 units @ 4321.5 IN-TX  ->  stock_levels rate:', ledgerAfter, '| stock_settings rate:', settingsAfter);
  console.log('   mirror match (settings === ledger, both updated):', matched ? '✅' : '❌');

  const ssPost = await prisma.stock_settings.findUnique({ where: key });
  const rolledBack = (ssPost?.valuationRate?.toString() ?? 'null') === (ssBefore?.valuationRate?.toString() ?? 'null');
  console.log('   stock_settings rate AFTER ROLLBACK:', ssPost?.valuationRate?.toString() ?? 'null',
    rolledBack ? '✅ (unchanged — test left no trace)' : '❌ MUTATED');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
