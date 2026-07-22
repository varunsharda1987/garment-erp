/**
 * Repair residual stock_levels.quantity drift so the internal shim matches the per-lot truth (derived_stock_view).
 * The external readers are all derived now, but the stock movement WRITERS still read stock_levels.quantity for
 * insufficient-stock checks — so a drifted row (e.g. BTN-0001 ledger 75 vs derived 300 from the Kashaya lot
 * assignment) could wrongly block a valid issue. UPDATE-IN-PLACE ONLY for (material,warehouse) rows that exist in
 * BOTH stock_levels and the derived view and disagree; also recomputes stockValue = quantity × valuationRate.
 * Does NOT create or delete rows (that is the larger repair-ledger job, already done for greige/fabric).
 * DEFAULT = dry-run; pass --apply to write. Idempotent.
 */
import prisma from '../src/config/database';
import { Decimal } from '@prisma/client/runtime/library';

const APPLY = process.argv.includes('--apply');

async function main() {
  const derived: any[] = await prisma.$queryRawUnsafe(
    `SELECT "materialId", "warehouseId", quantity::float AS q FROM derived_stock_view`
  );
  const dMap = new Map(derived.map((r) => [`${r.materialId}|${r.warehouseId}`, Number(r.q)]));

  const rows = await prisma.stock_levels.findMany({
    select: { id: true, materialId: true, warehouseId: true, quantity: true, valuationRate: true, stockValue: true },
  });

  const drift: any[] = [];
  for (const r of rows) {
    const key = `${r.materialId}|${r.warehouseId}`;
    if (!dMap.has(key)) continue; // only rows present in BOTH — no create/delete
    const derivedQty = dMap.get(key)!;
    if (Math.abs(Number(r.quantity) - derivedQty) > 0.0005) {
      drift.push({ id: r.id, materialId: r.materialId, warehouseId: r.warehouseId, ledger: Number(r.quantity), derived: derivedQty, valuationRate: r.valuationRate });
    }
  }

  const meta = await prisma.materials.findMany({ where: { id: { in: drift.map((d) => d.materialId) } }, select: { id: true, code: true } });
  const codeMap = new Map(meta.map((m) => [m.id, m.code]));

  console.log(`quantity drift rows (present in both): ${drift.length}${APPLY ? ' (APPLYING)' : ' (dry-run)'}`);
  if (drift.length) console.table(drift.map((d) => ({ code: codeMap.get(d.materialId) ?? d.materialId, ledger: d.ledger, derived: d.derived, delta: d.derived - d.ledger })));

  if (APPLY && drift.length) {
    for (const d of drift) {
      const qty = new Decimal(d.derived);
      const stockValue = d.valuationRate ? qty.mul(d.valuationRate.toString()) : null;
      await prisma.stock_levels.update({ where: { id: d.id }, data: { quantity: qty, stockValue, lastUpdated: new Date() } });
    }
    console.log(`✅ repaired ${drift.length} row(s): stock_levels.quantity = derived on-hand`);
  } else if (!APPLY && drift.length) {
    console.log('\nRe-run with --apply to sync the shim to the per-lot truth.');
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
