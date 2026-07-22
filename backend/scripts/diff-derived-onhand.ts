/**
 * T2-1 Stage B3 parallel-run diff: for every material, compare the OLD on-hand total
 * (SUM stock_levels.quantity across warehouses) against the DERIVED total
 * (SUM derived_stock_view.quantity). This is exactly the figure the MRP / material-requirement /
 * production-blocking readers compute via stock_levels.aggregate(_sum.quantity) with no warehouse scope.
 * Any row printed = a material whose MRP/production decision changes when repointed. Read-only.
 */
import prisma from '../src/config/database';

async function main() {
  // OLD: ledger total per material
  const ledger: Array<{ materialId: string; total: any }> = await prisma.$queryRawUnsafe(
    `SELECT "materialId", COALESCE(SUM(quantity),0)::float AS total FROM stock_levels GROUP BY "materialId"`
  );
  // DERIVED: view total per material
  const derived: Array<{ materialId: string; total: any }> = await prisma.$queryRawUnsafe(
    `SELECT "materialId", COALESCE(SUM(quantity),0)::float AS total FROM derived_stock_view GROUP BY "materialId"`
  );

  const ledgerMap = new Map(ledger.map((r) => [r.materialId, Number(r.total)]));
  const derivedMap = new Map(derived.map((r) => [r.materialId, Number(r.total)]));
  const allIds = new Set([...ledgerMap.keys(), ...derivedMap.keys()]);

  const materials = await prisma.materials.findMany({
    where: { id: { in: [...allIds] } },
    select: { id: true, code: true, name: true, materialType: true },
  });
  const metaMap = new Map(materials.map((m) => [m.id, m]));

  const diffs: Array<{ id: string; code: string; type: string; ledger: number; derived: number; delta: number }> = [];
  for (const id of allIds) {
    const l = ledgerMap.get(id) ?? 0;
    const d = derivedMap.get(id) ?? 0;
    if (Math.abs(l - d) > 0.0005) {
      const m = metaMap.get(id);
      diffs.push({ id, code: m?.code ?? '(no material row)', type: m?.materialType ?? '?', ledger: l, derived: d, delta: d - l });
    }
  }

  console.log(`\n=== T2-1 Stage B3 on-hand parallel-run diff (total across warehouses) ===`);
  console.log(`Materials with ledger on-hand: ${ledgerMap.size}`);
  console.log(`Materials with derived on-hand: ${derivedMap.size}`);
  console.log(`Materials where ledger === derived: ${allIds.size - diffs.length} / ${allIds.size}`);
  console.log(`\nMaterials whose MRP/production on-hand CHANGES when repointed: ${diffs.length}`);
  if (diffs.length) {
    console.table(
      diffs
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .map((d) => ({ code: d.code, type: d.type, ledger: d.ledger, derived: d.derived, delta: d.delta }))
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
