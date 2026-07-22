/**
 * T2-1 Stage C (C1): re-backfill stock_settings.valuationRate from every stock_levels row that carries a rate,
 * so the derived valuation is complete before the valuation readers repoint. Idempotent + additive
 * (only mirrors ledger rate → settings; never nulls or touches reorder/min/max). Safe to re-run.
 */
import prisma from '../src/config/database';

async function main() {
  const rows = await prisma.stock_levels.findMany({
    where: { valuationRate: { not: null } },
    select: { materialId: true, warehouseId: true, valuationRate: true },
  });
  let created = 0, updated = 0, unchanged = 0;
  for (const r of rows) {
    const key = { materialId_warehouseId: { materialId: r.materialId, warehouseId: r.warehouseId } };
    const existing = await prisma.stock_settings.findUnique({ where: key });
    if (!existing) {
      await prisma.stock_settings.create({ data: { materialId: r.materialId, warehouseId: r.warehouseId, valuationRate: r.valuationRate } });
      created++;
    } else if ((existing.valuationRate?.toString() ?? null) !== (r.valuationRate?.toString() ?? null)) {
      await prisma.stock_settings.update({ where: key, data: { valuationRate: r.valuationRate } });
      updated++;
    } else unchanged++;
  }
  console.log(`REBACKFILL created=${created} updated=${updated} unchanged=${unchanged} (rated ledger rows=${rows.length})`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
