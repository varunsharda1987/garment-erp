/**
 * Repair stock_levels.stockValue drift: recompute stockValue = quantity × valuationRate for any rated row where
 * the stored stockValue disagrees (classic F1 drift, e.g. mat-pkg-0001 stored 1500 vs 21000×1.5=31500).
 * The derived view already serves the correct value to readers; this fixes the now-internal ledger for hygiene
 * and so the writer-shim has a correct baseline. DEFAULT = dry-run; pass --apply to write. Idempotent.
 */
import prisma from '../src/config/database';
import { Decimal } from '@prisma/client/runtime/library';

const APPLY = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.stock_levels.findMany({
    where: { valuationRate: { not: null } },
    select: { id: true, materialId: true, warehouseId: true, quantity: true, valuationRate: true, stockValue: true },
  });

  const drift: any[] = [];
  for (const r of rows) {
    const expected = new Decimal(r.quantity.toString()).mul(r.valuationRate!.toString());
    const stored = r.stockValue ? new Decimal(r.stockValue.toString()) : new Decimal(0);
    if (expected.sub(stored).abs().gt('0.005')) {
      drift.push({ id: r.id, materialId: r.materialId, qty: Number(r.quantity), rate: Number(r.valuationRate), stored: Number(stored), expected: Number(expected) });
    }
  }

  const meta = await prisma.materials.findMany({ where: { id: { in: drift.map((d) => d.materialId) } }, select: { id: true, code: true } });
  const codeMap = new Map(meta.map((m) => [m.id, m.code]));

  console.log(`stockValue drift rows: ${drift.length}${APPLY ? ' (APPLYING)' : ' (dry-run)'}`);
  if (drift.length) console.table(drift.map((d) => ({ code: codeMap.get(d.materialId) ?? d.materialId, qty: d.qty, rate: d.rate, stored: d.stored, correct: d.expected })));

  if (APPLY && drift.length) {
    for (const d of drift) {
      await prisma.stock_levels.update({ where: { id: d.id }, data: { stockValue: new Decimal(d.expected) } });
    }
    console.log(`✅ repaired ${drift.length} row(s): stockValue = quantity × valuationRate`);
  } else if (!APPLY && drift.length) {
    console.log('\nRe-run with --apply to write the corrected stockValue.');
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
