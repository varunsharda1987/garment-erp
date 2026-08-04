/**
 * repair-stock-warehouses.ts — repair the NULL-warehouse-lot drift (GRG-0006 class, 2026-08-02).
 *
 * What it does (all rule-based, no hardcoded rows):
 *   1. Every greige_stock lot with warehouseId NULL gets its real warehouse:
 *      - processor-held lots (processorId set) → that processor's warehouse (warehouses.supplierId)
 *      - company-held lots → the default company warehouse (WH-RM-*, oldest active)
 *   2. stock_levels for every greige-backed material is rebuilt from the lots
 *      (SUM quantityAvailable of AVAILABLE lots per material+warehouse — the lots are the
 *      physical truth; the ledger is the derived cache, per docs/bug-hunt/REPAIR_PLAN.md).
 *      Existing rows are updated, missing rows created; surplus ledger rows are REPORTED,
 *      never silently deleted.
 *
 * Usage:
 *   npx ts-node scripts/repair-stock-warehouses.ts           # DRY RUN — prints the plan only
 *   npx ts-node scripts/repair-stock-warehouses.ts --apply   # executes inside ONE transaction
 *
 * Prerequisites: code fixes committed (challan transfer + createGreigeStock stamp warehouseId),
 * and a pg_dump backup (backups/garment_erp_pre_stock_repair_*.dump).
 * Prove afterwards with: npx ts-node scripts/verify-stock-identity.ts
 */

import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`\n=== Stock warehouse repair — ${APPLY ? 'APPLY' : 'DRY RUN'} ===\n`);

  // Default company warehouse (same rule as material-sync.helper getDefaultWarehouseId)
  const defaultWh =
    (await prisma.warehouses.findFirst({
      where: { isActive: true, warehouseCode: { startsWith: 'WH-RM' } },
      orderBy: { createdAt: 'asc' },
    })) ||
    (await prisma.warehouses.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!defaultWh) throw new Error('No active warehouse found — cannot repair.');
  console.log(`Default company warehouse: ${defaultWh.warehouseCode} (${defaultWh.id})`);

  // ---- Step 1: plan warehouse backfill for NULL-warehouse greige lots ----
  const nullLots = await prisma.greige_stock.findMany({
    where: { warehouseId: null },
    include: { greige: { select: { greigeCode: true } } },
  });
  const lotPlan: Array<{ lotId: string; code: string; qty: number; targetWhId: string; targetWhCode: string; reason: string }> = [];
  for (const lot of nullLots) {
    let target = defaultWh;
    let reason = 'company-held → default warehouse';
    if (lot.processorId) {
      const procWh = await prisma.warehouses.findFirst({ where: { supplierId: lot.processorId } });
      if (procWh) {
        target = procWh;
        reason = 'processor-held → processor warehouse';
      } else {
        reason = `processor-held but NO warehouse for supplier ${lot.processorId} → default warehouse`;
      }
    }
    lotPlan.push({
      lotId: lot.id,
      code: lot.greige?.greigeCode ?? '?',
      qty: Number(lot.quantityAvailable),
      targetWhId: target.id,
      targetWhCode: target.warehouseCode,
      reason,
    });
  }
  console.log(`\nStep 1 — backfill warehouseId on ${lotPlan.length} NULL-warehouse lots:`);
  lotPlan.forEach((p) => console.log(`  ${p.code} lot ${p.lotId.slice(0, 8)}… qty=${p.qty} → ${p.targetWhCode} (${p.reason})`));

  // ---- Step 2: rebuild greige stock_levels from lots (using the PLANNED warehouses) ----
  // ON-HAND semantics (matches derived_stock_view): processor-held lots are excluded —
  // greige at a job-worker has LEFT on-hand and comes back as fabric via GRN.
  const lots = await prisma.greige_stock.findMany({
    where: { status: 'AVAILABLE', processorId: null, NOT: { sourceType: 'TRANSFER' } },
    select: { id: true, greigeId: true, warehouseId: true, quantityAvailable: true },
  });
  const planned = new Map(lotPlan.map((p) => [p.lotId, p.targetWhId]));
  const expected = new Map<string, number>(); // `${greigeId}|${warehouseId}` -> qty
  for (const lot of lots) {
    const wh = lot.warehouseId ?? planned.get(lot.id);
    if (!wh) continue;
    const key = `${lot.greigeId}|${wh}`;
    expected.set(key, (expected.get(key) ?? 0) + Number(lot.quantityAvailable));
  }

  const greigeIds = [...new Set(lots.map((l) => l.greigeId))];
  const materials = await prisma.materials.findMany({
    where: { greigeId: { in: greigeIds } },
    select: { id: true, code: true, greigeId: true, unit: true },
  });
  const matByGreige = new Map(materials.map((m) => [m.greigeId as string, m]));

  const ledger = await prisma.stock_levels.findMany({
    where: { materialId: { in: materials.map((m) => m.id) } },
  });
  const ledgerByKey = new Map(ledger.map((r) => [`${r.materialId}|${r.warehouseId}`, r]));

  const updates: Array<{ id: string; code: string; wh: string; from: number; to: number }> = [];
  const creates: Array<{ materialId: string; code: string; warehouseId: string; qty: number }> = [];
  const seen = new Set<string>();
  for (const [key, qty] of expected) {
    const [greigeId, warehouseId] = key.split('|');
    const mat = matByGreige.get(greigeId);
    if (!mat) {
      console.log(`  ⚠ greige ${greigeId} has NO materials row — run ensureMaterialRecord for it first`);
      continue;
    }
    const lkey = `${mat.id}|${warehouseId}`;
    seen.add(lkey);
    const row = ledgerByKey.get(lkey);
    if (row) {
      if (Math.abs(Number(row.quantity) - qty) > 0.001) {
        updates.push({ id: row.id, code: mat.code, wh: warehouseId, from: Number(row.quantity), to: qty });
      }
    } else {
      creates.push({ materialId: mat.id, code: mat.code, warehouseId, qty });
    }
  }
  const surplus = ledger.filter((r) => !seen.has(`${r.materialId}|${r.warehouseId}`));

  console.log(`\nStep 2 — ledger rebuild (greige materials, from lots):`);
  updates.forEach((u) => console.log(`  UPDATE ${u.code} @ ${u.wh.slice(0, 8)}…: ${u.from} → ${u.to}`));
  creates.forEach((c) => console.log(`  CREATE ${c.code} @ ${c.warehouseId.slice(0, 8)}…: ${c.qty} METER`));
  surplus.forEach((s) => console.log(`  ⚠ SURPLUS ledger row (no matching lots — NOT touched): material ${s.materialId} @ ${s.warehouseId} qty=${Number(s.quantity)}`));
  if (!updates.length && !creates.length) console.log('  (ledger already matches lots)');

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to execute.\n');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const p of lotPlan) {
      await tx.greige_stock.update({ where: { id: p.lotId }, data: { warehouseId: p.targetWhId } });
    }
    for (const u of updates) {
      await tx.stock_levels.update({ where: { id: u.id }, data: { quantity: u.to, lastUpdated: new Date() } });
    }
    for (const c of creates) {
      await tx.stock_levels.create({
        data: { materialId: c.materialId, warehouseId: c.warehouseId, quantity: c.qty, unit: 'METER', lastUpdated: new Date() },
      });
    }
  });
  console.log(`\n✅ APPLIED: ${lotPlan.length} lots backfilled, ${updates.length} ledger rows updated, ${creates.length} created.`);
  console.log('Now prove it: npx ts-node scripts/verify-stock-identity.ts\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
