/**
 * Repair the stock_levels ledger for material-backed stock (GREIGE + FABRIC).
 *
 * Rebuilds the aggregate ledger from the authoritative per-lot tables:
 *   stock_levels.quantity(canonicalMaterial, warehouse) = SUM(quantityAvailable) of that master's
 *   lots in that warehouse (excluding processor/transfer/null-warehouse stock).
 * Phantom / duplicate / orphan ledger rows for these materials are zeroed. Canonical material =
 * the row whose id === masterId (createFromMaster convention). Missing canonicals are created.
 *
 * SAFE: default is DRY-RUN (prints every change, writes nothing). Pass --apply to write.
 * On --apply it snapshots every touched row to scripts/repair-stock-ledger-snapshot.json (rollback)
 * and does all writes in ONE transaction, writing stock_levels DIRECTLY (never syncStockLevelQuantity).
 *
 * Usage:  npx ts-node scripts/repair-stock-ledger.ts            (dry run)
 *         npx ts-node scripts/repair-stock-ledger.ts --apply     (write)
 */
import prisma from '../src/config/database';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const APPLY = process.argv.includes('--apply');
const EPS = new Prisma.Decimal('0.0005');
const D = (v: any) => new Prisma.Decimal(v ?? 0);
const round2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

type Cfg = {
  type: 'GREIGE' | 'FABRIC';
  stockModel: 'greige_stock' | 'fabric_stock';
  fk: 'greigeId' | 'fabricId';
  masterModel: 'greige_master' | 'fabric_master';
  codeField: string;
  nameField: string;
};
const TYPES: Cfg[] = [
  { type: 'GREIGE', stockModel: 'greige_stock', fk: 'greigeId', masterModel: 'greige_master', codeField: 'greigeCode', nameField: 'greigeName' },
  { type: 'FABRIC', stockModel: 'fabric_stock', fk: 'fabricId', masterModel: 'fabric_master', codeField: 'fabricCode', nameField: 'fabricName' },
];

const key = (mid: string, wh: string) => `${mid}|${wh}`;

async function authoritativeMap(cfg: Cfg): Promise<Map<string, Map<string, Prisma.Decimal>>> {
  let rows: any[];
  if (cfg.type === 'GREIGE') {
    rows = await prisma.$queryRaw<any[]>`
      SELECT "greigeId" AS master, "warehouseId" AS wh, SUM("quantityAvailable")::text AS qty
      FROM greige_stock
      WHERE "warehouseId" IS NOT NULL AND "processorId" IS NULL AND ("sourceType" IS DISTINCT FROM 'TRANSFER')
      GROUP BY "greigeId", "warehouseId"`;
  } else {
    rows = await prisma.$queryRaw<any[]>`
      SELECT fs."fabricId" AS master, fs."warehouseId" AS wh, SUM(fs."quantityAvailable")::text AS qty
      FROM fabric_stock fs JOIN fabric_master fm ON fm.id = fs."fabricId"
      WHERE fs."warehouseId" IS NOT NULL
        AND NOT (fm."finishType" = 'RAW' OR fm."isGeneric" = true OR fm."fabricCode" LIKE '%-RAW')
      GROUP BY fs."fabricId", fs."warehouseId"`;
  }
  const map = new Map<string, Map<string, Prisma.Decimal>>();
  for (const r of rows) {
    if (!map.has(r.master)) map.set(r.master, new Map());
    map.get(r.master)!.set(r.wh, D(r.qty));
  }
  return map;
}

async function main() {
  console.log(APPLY ? '\n=== REPAIR: APPLY MODE (writing) ===' : '\n=== REPAIR: DRY RUN (no writes — pass --apply to write) ===');

  // Safety gate: raw greige stored in fabric_stock (FAB-RAW) cannot be placed by a ledger-only repair.
  const fabRaw = await prisma.$queryRaw<any[]>`
    SELECT COALESCE(SUM(fs."quantityAvailable"),0)::text AS q
    FROM fabric_stock fs JOIN fabric_master fm ON fm.id = fs."fabricId"
    WHERE fm."finishType" = 'RAW' OR fm."isGeneric" = true OR fm."fabricCode" LIKE '%-RAW'`;
  const fabRawQty = D(fabRaw[0]?.q);
  if (fabRawQty.greaterThan('0.01')) {
    console.error(`HALT: FAB-RAW fabric_stock holds ${fabRawQty} — a ledger-only repair can't place it. Aborting.`);
    process.exit(1);
  }
  console.log(`Safety gate — FAB-RAW fabric_stock residual: ${fabRawQty.toString()} (OK)\n`);

  const toCreateMaterials: { id: string; code: string; name: string; categoryId: string; unit: string; fk: string; type: string }[] = [];
  const writes: {
    materialId: string; warehouseId: string; before: any | null;
    quantity: Prisma.Decimal; unit: string; valuationRate: Prisma.Decimal | null; stockValue: Prisma.Decimal | null; action: string; type: string;
  }[] = [];
  const allAnomalies: string[] = [];

  for (const cfg of TYPES) {
    const auth = await authoritativeMap(cfg);
    const unitDefault = 'METER';
    const anyMat = await prisma.materials.findFirst({ where: { materialType: cfg.type as any }, select: { categoryId: true } });
    const categoryId = anyMat?.categoryId;

    // Universe: every material linked to these masters (canonical + phantoms + orphans)
    const linked: any[] = await prisma.materials.findMany({ where: { [cfg.fk]: { not: null } } as any, select: { id: true, [cfg.fk]: true } as any });
    const materialIds = new Set<string>(linked.map((m) => m.id));

    // Anomalies: linked material with id != master and not a FAB-RAW phantom — report, don't touch.
    for (const m of linked) {
      const master = (m as any)[cfg.fk];
      if (m.id !== master && !m.id.startsWith('FAB-RAW-')) allAnomalies.push(`${cfg.type}: material ${m.id} has ${cfg.fk}=${master} but id!=master and not FAB-RAW`);
    }

    // Ensure a canonical material (id === master) exists for every master with stock; queue creates.
    for (const master of auth.keys()) {
      materialIds.add(master);
      const has = await prisma.materials.findUnique({ where: { id: master }, select: { id: true } });
      if (!has) {
        if (!categoryId) { allAnomalies.push(`${cfg.type}: no category found to create material ${master}`); continue; }
        const mr: any = await (prisma as any)[cfg.masterModel].findUnique({ where: { id: master }, select: { id: true, [cfg.codeField]: true, [cfg.nameField]: true } });
        if (!mr) { allAnomalies.push(`${cfg.type}: master ${master} has stock but no master row`); continue; }
        toCreateMaterials.push({ id: master, code: mr[cfg.codeField], name: mr[cfg.nameField], categoryId, unit: unitDefault, fk: cfg.fk, type: cfg.type });
      }
    }

    // Current ledger for the whole universe
    const current: any[] = await prisma.stock_levels.findMany({
      where: { materialId: { in: [...materialIds] } },
      select: { id: true, materialId: true, warehouseId: true, quantity: true, unit: true, valuationRate: true, reorderLevel: true, minLevel: true, maxLevel: true, stockValue: true, lastUpdated: true },
    });
    const curMap = new Map<string, any>();
    for (const sl of current) curMap.set(key(sl.materialId, sl.warehouseId), sl);

    // Target: canonical(master, wh) -> sum; every other existing universe row -> 0.
    const target = new Map<string, Prisma.Decimal>();
    for (const [master, whMap] of auth) for (const [wh, qty] of whMap) target.set(key(master, wh), qty);
    for (const sl of current) { const k = key(sl.materialId, sl.warehouseId); if (!target.has(k)) target.set(k, D(0)); }

    // Diff -> write list (+ snapshot before-state)
    for (const [k, tgt] of target) {
      const [materialId, warehouseId] = k.split('|');
      const cur = curMap.get(k);
      const curQty = cur ? D(cur.quantity) : D(0);
      if (tgt.minus(curQty).abs().greaterThan(EPS)) {
        const valuationRate = cur?.valuationRate != null ? D(cur.valuationRate) : null;
        const stockValue = valuationRate ? round2(tgt.times(valuationRate)) : null;
        writes.push({
          materialId, warehouseId,
          before: cur ? { quantity: cur.quantity, unit: cur.unit, valuationRate: cur.valuationRate, reorderLevel: cur.reorderLevel, minLevel: cur.minLevel, maxLevel: cur.maxLevel, stockValue: cur.stockValue, lastUpdated: cur.lastUpdated } : null,
          quantity: tgt, unit: cur?.unit || unitDefault, valuationRate, stockValue,
          action: cur ? (tgt.isZero() ? 'zero' : 'update') : 'create', type: cfg.type,
        });
      }
    }
  }

  // ---- Report ----
  const byAction = (a: string) => writes.filter((w) => w.action === a);
  console.log(`Materials to create (missing canonical): ${toCreateMaterials.length}`);
  toCreateMaterials.forEach((m) => console.log(`   + ${m.type} material ${m.id} (${m.code})`));
  console.log(`\nLedger changes: ${writes.length}  (update ${byAction('update').length}, zero ${byAction('zero').length}, create ${byAction('create').length})`);
  for (const w of writes) {
    const from = w.before ? D(w.before.quantity).toString() : '(none)';
    console.log(`   ${w.action.padEnd(6)} ${w.type} ${w.materialId.slice(0, 8)} @ ${w.warehouseId.slice(0, 8)}: ${from} -> ${w.quantity.toString()}`);
  }
  if (allAnomalies.length) {
    console.log(`\nAnomalies (reported, NOT auto-fixed): ${allAnomalies.length}`);
    allAnomalies.forEach((a) => console.log(`   ! ${a}`));
  }

  if (!APPLY) {
    console.log(`\nDRY RUN complete — nothing written. Re-run with --apply to write.\n`);
    await prisma.$disconnect();
    return;
  }

  // ---- Apply ----
  const snapshot = { runId: `repair-${new Date().toISOString()}`, createdMaterials: toCreateMaterials.map((m) => m.id), writes: writes.map((w) => ({ materialId: w.materialId, warehouseId: w.warehouseId, action: w.action, before: w.before })) };
  const snapPath = path.join(__dirname, 'repair-stock-ledger-snapshot.json');
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot written: ${snapPath}`);

  await prisma.$transaction(async (tx) => {
    for (const m of toCreateMaterials) {
      await tx.materials.create({
        data: {
          id: m.id, code: m.code, name: m.name, categoryId: m.categoryId, materialType: m.type as any, unit: m.unit as any, isActive: true,
          greigeId: m.fk === 'greigeId' ? m.id : null, fabricId: m.fk === 'fabricId' ? m.id : null,
        } as any,
      });
    }
    for (const w of writes) {
      await tx.stock_levels.upsert({
        where: { materialId_warehouseId: { materialId: w.materialId, warehouseId: w.warehouseId } },
        update: { quantity: w.quantity, stockValue: w.stockValue, lastUpdated: new Date() },
        create: { materialId: w.materialId, warehouseId: w.warehouseId, quantity: w.quantity, unit: w.unit as any, valuationRate: w.valuationRate, stockValue: w.stockValue, lastUpdated: new Date() },
      });
    }
  });
  console.log(`APPLIED: created ${toCreateMaterials.length} materials, wrote ${writes.length} ledger rows.\n`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
