/**
 * T2-1 Stage C: verify the repointed valuation readers now return the derived (corrected) totals.
 * Calls the REAL service methods. Expect getStockValuationReport().totalValue == derived 902137.46
 * (was ledger 872137.46) — the +30000 is the PKG-0001 stockValue-drift auto-correction. Read-only.
 */
import prisma from '../src/config/database';
import stockLevelService from '../src/services/stockLevel.service';
import warehouseService from '../src/services/warehouse.service';

async function main() {
  const report = await stockLevelService.getStockValuationReport();
  console.log('getStockValuationReport().totalValue =', report.totalValue.toFixed(2),
    Math.abs(report.totalValue - 902137.46) < 1 ? '✅ (derived/corrected)' : '❌');
  console.log('  rows =', report.stockLevels.length, '| totalQuantity =', report.totalQuantity.toFixed(2));

  // Per-warehouse summary for Kashaya Fabs (holds the packaging + button lots)
  const wh = await prisma.warehouses.findFirst({ where: { warehouseCode: 'WH-RM-0001' }, select: { id: true } });
  if (wh) {
    const sum = await warehouseService.getWarehouseStockSummary(wh.id);
    console.log('getWarehouseStockSummary(Kashaya).totalValue =', Number(sum.totalValue).toFixed(2),
      '| totalMaterials =', sum.totalMaterials);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
