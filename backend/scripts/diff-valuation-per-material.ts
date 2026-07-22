/**
 * T2-1 Stage C precondition: per-material valuation parallel-run diff — ledger stockValue
 * (SUM stock_levels.stockValue) vs derived stockValue (SUM derived_stock_view.stockValue). Any row printed is a
 * material whose valuation READERS (valuation report, warehouse summary, per-warehouse/per-material totals,
 * summary-by-type) will show a different number after Stage C repoints. Read-only.
 */
import prisma from '../src/config/database';

async function main() {
  const ledger: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", COALESCE(SUM("stockValue"),0)::float AS v, COALESCE(SUM("valuationRate"),0)::float AS r
     FROM stock_levels GROUP BY "materialId"`
  );
  const derived: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", COALESCE(SUM("stockValue"),0)::float AS v FROM derived_stock_view GROUP BY "materialId"`
  );
  const lMap = new Map(ledger.map((r) => [r.materialId, Number(r.v)]));
  const rateMap = new Map(ledger.map((r) => [r.materialId, Number(r.r)]));
  const dMap = new Map(derived.map((r) => [r.materialId, Number(r.v)]));
  const ids = new Set([...lMap.keys(), ...dMap.keys()]);

  const meta = await prisma.materials.findMany({ where: { id: { in: [...ids] } }, select: { id: true, code: true, materialType: true } });
  const codeMap = new Map(meta.map((m) => [m.id, m]));

  const diffs: any[] = [];
  let lTot = 0, dTot = 0;
  for (const id of ids) {
    const l = lMap.get(id) ?? 0, d = dMap.get(id) ?? 0;
    lTot += l; dTot += d;
    if (Math.abs(l - d) > 0.005) {
      const m = codeMap.get(id);
      diffs.push({ code: m?.code ?? id, type: m?.materialType ?? '?', hasRate: (rateMap.get(id) ?? 0) > 0, ledgerValue: l, derivedValue: d, delta: d - l });
    }
  }
  console.log('=== T2-1 Stage C valuation parallel-run diff (per material) ===');
  console.log('Materials where valuation CHANGES on repoint:', diffs.length, 'of', ids.size);
  if (diffs.length) console.table(diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)));
  console.log('Ledger total stockValue:', lTot.toFixed(2), '| Derived total stockValue:', dTot.toFixed(2), '| delta:', (dTot - lTot).toFixed(2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
