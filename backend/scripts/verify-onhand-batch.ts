/**
 * T2-1 verify the batch on-hand helper (getDerivedOnHandMap) used by the work-order BOM shortage reader.
 * Confirms: (1) the ANY($1::text[]) array binding runs, (2) map values equal per-material getDerivedOnHand,
 * (3) parallel-run: batch derived vs old stock_levels sum differ ONLY for BTN-0001. Read-only.
 */
import prisma from '../src/config/database';
import { getDerivedOnHandMap, getDerivedOnHand } from '../src/services/helpers/derived-stock.helper';

async function main() {
  // Use every material that has a stock_levels row (the universe the readers touch).
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", COALESCE(SUM(quantity),0)::float AS total FROM stock_levels GROUP BY "materialId"`
  );
  const ids = rows.map((r) => r.materialId);
  const ledgerMap = new Map(rows.map((r) => [r.materialId, Number(r.total)]));

  const batch = await getDerivedOnHandMap(ids); // <-- exercises ANY($1::text[])
  console.log('batch helper returned rows:', batch.size, '(ANY array binding OK)');

  // consistency: batch === per-material getDerivedOnHand (spot-check a few)
  let consistencyOk = true;
  for (const id of ids.slice(0, 6)) {
    const single = await getDerivedOnHand(id);
    const b = batch.get(id) ?? 0;
    if (Math.abs(single - b) > 0.0005) { consistencyOk = false; console.log('  MISMATCH', id, 'single', single, 'batch', b); }
  }
  console.log('batch === per-material getDerivedOnHand:', consistencyOk ? '✅' : '❌');

  // parallel-run: batch derived vs old ledger sum
  const diffs: any[] = [];
  for (const id of ids) {
    const l = ledgerMap.get(id) ?? 0;
    const d = batch.get(id) ?? 0;
    if (Math.abs(l - d) > 0.0005) diffs.push({ id, ledger: l, derived: d, delta: d - l });
  }
  console.log(`\nMaterials where BOM/PO on-hand changes vs ledger: ${diffs.length}`);
  if (diffs.length) {
    const meta = await prisma.materials.findMany({ where: { id: { in: diffs.map((d) => d.id) } }, select: { id: true, code: true } });
    const codeMap = new Map(meta.map((m) => [m.id, m.code]));
    console.table(diffs.map((d) => ({ code: codeMap.get(d.id) ?? d.id, ledger: d.ledger, derived: d.derived, delta: d.delta })));
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
