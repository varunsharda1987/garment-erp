/**
 * T2-1 valuation precondition check: is stock_settings.valuationRate (what derived_stock_view serves)
 * still in sync with the live stock_levels.valuationRate (what the WAC writers actually update)?
 * If they diverge, valuation readers must NOT be repointed until the WAC write is redirected to
 * stock_settings — otherwise costing reads a stale rate. Read-only.
 */
import prisma from '../src/config/database';

async function main() {
  const slRate: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", "warehouseId", "valuationRate", "stockValue" FROM stock_levels WHERE "valuationRate" IS NOT NULL`
  );
  const ssRate: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", "warehouseId", "valuationRate" FROM stock_settings WHERE "valuationRate" IS NOT NULL`
  );
  const dvVal: any[] = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM("stockValue"),0)::float AS total FROM derived_stock_view`
  );
  const slVal: any[] = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM("stockValue"),0)::float AS total FROM stock_levels`
  );

  const key = (r: any) => `${r.materialId}|${r.warehouseId}`;
  const ssMap = new Map(ssRate.map((r) => [key(r), Number(r.valuationRate)]));

  let matched = 0;
  const divergent: Array<{ key: string; sl: number; ss: number | undefined }> = [];
  for (const r of slRate) {
    const sl = Number(r.valuationRate);
    const ss = ssMap.get(key(r));
    if (ss !== undefined && Math.abs(sl - ss) < 0.005) matched++;
    else divergent.push({ key: key(r), sl, ss });
  }

  console.log('=== T2-1 valuation sync check (stock_levels WAC rate vs stock_settings snapshot) ===');
  console.log('stock_levels rows with valuationRate:', slRate.length);
  console.log('stock_settings rows with valuationRate:', ssRate.length);
  console.log('rates that MATCH (in sync):', matched);
  console.log('rates that DIVERGE or missing in settings:', divergent.length);
  if (divergent.length) console.table(divergent.slice(0, 25));
  console.log('\nTotal stockValue — stock_levels ledger:', slVal[0].total.toFixed(2));
  console.log('Total stockValue — derived_stock_view:', dvVal[0].total.toFixed(2));
  console.log('(derived stockValue = derived qty × stock_settings rate; ledger = hand-maintained)');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
