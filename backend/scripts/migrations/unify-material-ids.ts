/**
 * MIGRATION: unify materials.id with master ids (material-identity project, 2026-08).
 *
 * Renames every legacy `mat-<code>` materials.id to the master's uuid (label size rows →
 * label_size_variants.id). ON UPDATE CASCADE propagates renames to all relation-bearing
 * children in one UPDATE; MERGE cases (a same-id row already exists — only possible for
 * LABELs) repoint children explicitly, then delete the loser row LAST (RESTRICT FKs prove
 * no child still references it). Dangling columns (no Prisma relation) and JSON blobs are
 * rewritten from the id map. A permanent `material_id_map` table records every change.
 *
 * SAFE: default is DRY-RUN (prints the plan, writes nothing). Pass --apply to write.
 * On --apply: snapshots every touched materials row + map to
 * scripts/migrations/unify-material-ids-snapshot.json, then runs EVERYTHING in ONE
 * transaction with in-tx asserts (stock totals, zero mat-* residue) — any failure rolls
 * back the whole migration.
 *
 * PRE-REQS (runbook): Phase 0+1 code deployed (no new mat-* rows) → audit clean →
 * app STOPPED (pm2 stop) → pg_dump backup taken.
 *
 * Usage:  npx ts-node scripts/migrations/unify-material-ids.ts           (dry run)
 *         npx ts-node scripts/migrations/unify-material-ids.ts --apply   (write)
 */
import prisma from '../../src/config/database';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildIdMap,
  checkFkCascade,
  collectBaselines,
  DANGLING_COLUMNS,
  RELATION_CHILDREN,
  MapEntry,
} from './unify-material-ids-lib';

const APPLY = process.argv.includes('--apply');

// Children with a UNIQUE constraint involving materialId need conflict-aware merging;
// the rest are plain repoints.
const PLAIN_REPOINT_CHILDREN = RELATION_CHILDREN.filter(
  (t) => !['stock_levels', 'inventory_stock', 'material_suppliers', 'stock_count_items'].includes(t)
);

async function mergeLoserIntoWinner(tx: any, m: MapEntry) {
  const { oldId: loser, newId: winner } = m;

  // a. stock_levels — @@unique([materialId, warehouseId]): sum quantities per warehouse
  const loserLevels: any[] = await tx.stock_levels.findMany({ where: { materialId: loser } });
  for (const ll of loserLevels) {
    const wl = await tx.stock_levels.findUnique({
      where: { materialId_warehouseId: { materialId: winner, warehouseId: ll.warehouseId } },
    });
    if (wl) {
      const rate = wl.valuationRate ?? ll.valuationRate;
      const newQty = Number(wl.quantity) + Number(ll.quantity);
      await tx.stock_levels.update({
        where: { id: wl.id },
        data: {
          quantity: newQty,
          valuationRate: rate,
          stockValue: rate != null ? Number(rate) * newQty : wl.stockValue,
          lastUpdated: new Date(),
        },
      });
      await tx.stock_levels.delete({ where: { id: ll.id } });
    } else {
      await tx.stock_levels.update({ where: { id: ll.id }, data: { materialId: winner } });
    }
  }

  // b. stock_settings (dangling, unique per material/warehouse in practice) — keep the row
  //    with a non-null valuationRate on conflict
  await tx.$executeRawUnsafe(
    `UPDATE stock_settings s SET "materialId" = $2
     WHERE s."materialId" = $1
       AND NOT EXISTS (SELECT 1 FROM stock_settings t WHERE t."materialId" = $2 AND t."warehouseId" IS NOT DISTINCT FROM s."warehouseId")`,
    loser,
    winner
  );
  await tx.$executeRawUnsafe(`DELETE FROM stock_settings WHERE "materialId" = $1`, loser);

  // c. inventory_stock — merge per locationId
  const loserInv: any[] = await tx.inventory_stock.findMany({ where: { materialId: loser } });
  for (const li of loserInv) {
    const wi = await tx.inventory_stock.findFirst({
      where: { materialId: winner, locationId: li.locationId },
    });
    if (wi) {
      await tx.inventory_stock.update({
        where: { id: wi.id },
        data: { quantity: Number(wi.quantity) + Number(li.quantity) },
      });
      await tx.inventory_stock.delete({ where: { id: li.id } });
    } else {
      await tx.inventory_stock.update({ where: { id: li.id }, data: { materialId: winner } });
    }
  }

  // d. material_suppliers — @@unique([materialId, supplierId]); dedupe explicitly
  //    (NEVER rely on the delete-cascade: that silently drops supplier links)
  const loserSup: any[] = await tx.material_suppliers.findMany({ where: { materialId: loser } });
  for (const ls of loserSup) {
    const exists = await tx.material_suppliers.findFirst({
      where: { materialId: winner, supplierId: ls.supplierId },
    });
    if (exists) {
      await tx.material_suppliers.delete({ where: { id: ls.id } });
    } else {
      await tx.material_suppliers.update({ where: { id: ls.id }, data: { materialId: winner } });
    }
  }

  // e. stock_count_items — unique per (stockCountId, materialId); winner's row wins
  const loserCounts: any[] = await tx.stock_count_items.findMany({ where: { materialId: loser } });
  for (const lc of loserCounts) {
    const exists = await tx.stock_count_items.findFirst({
      where: { stockCountId: lc.stockCountId, materialId: winner },
    });
    if (exists) {
      await tx.stock_count_items.delete({ where: { id: lc.id } });
    } else {
      await tx.stock_count_items.update({ where: { id: lc.id }, data: { materialId: winner } });
    }
  }

  // f. Plain repoints (no unique on materialId)
  for (const table of PLAIN_REPOINT_CHILDREN) {
    await tx.$executeRawUnsafe(
      `UPDATE ${table} SET "materialId" = $2 WHERE "materialId" = $1`,
      loser,
      winner
    );
  }
  for (const d of DANGLING_COLUMNS) {
    if (d.table === 'stock_settings') continue; // handled above
    await tx.$executeRawUnsafe(
      `UPDATE ${d.table} SET "${d.column}" = $2 WHERE "${d.column}" = $1`,
      loser,
      winner
    );
  }

  // g. Winner scalar backfill — copy loser's values where winner's are NULL
  const [loserRow, winnerRow] = await Promise.all([
    tx.materials.findUnique({ where: { id: loser } }),
    tx.materials.findUnique({ where: { id: winner } }),
  ]);
  const backfill: any = {};
  for (const f of ['hsnCode', 'gstRate', 'reorderLevel', 'image', 'categoryData'] as const) {
    if (winnerRow[f] == null && loserRow[f] != null) backfill[f] = loserRow[f];
  }
  if (Object.keys(backfill).length) {
    await tx.materials.update({ where: { id: winner }, data: backfill });
  }

  // h. Delete the loser LAST — surviving RESTRICT FKs abort the tx if a child was missed
  await tx.materials.delete({ where: { id: loser } });
}

async function main() {
  console.log(`=== MATERIALS-ID UNIFICATION ${APPLY ? '(APPLY)' : '(DRY RUN — pass --apply to write)'} ===\n`);

  // Gates (re-checked live, not trusted from the audit file)
  const fk = await checkFkCascade(prisma);
  if (!fk.ok) throw new Error('FK cascade gate FAILED — see audit. Aborting.');

  const audit = await buildIdMap(prisma);
  if (audit.duplicateTargets.length || audit.unresolved.length) {
    throw new Error('Audit blockers present (duplicate targets / unresolved rows). Run the audit. Aborting.');
  }
  const renames = audit.map.filter((m) => m.action === 'RENAME');
  const merges = audit.map.filter((m) => m.action === 'MERGE');
  console.log(`Plan: ${renames.length} renames, ${merges.length} merges, ${audit.orphans.length} orphans untouched.`);

  if (audit.map.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  if (!APPLY) {
    audit.map.forEach((m) =>
      console.log(`  ${m.action.padEnd(6)} ${m.oldId} → ${m.newId}  (${m.reason})`)
    );
    console.log('\nDry run complete. Re-run with --apply (AFTER pm2 stop + pg_dump backup).');
    return;
  }

  const before = await collectBaselines(prisma);

  // Snapshot every touched materials row (surgical rollback aid; pg_dump is the real rollback)
  const touched = await prisma.materials.findMany({
    where: { id: { in: audit.map.map((m) => m.oldId) } },
  });
  const snapPath = path.join(__dirname, 'unify-material-ids-snapshot.json');
  fs.writeFileSync(
    snapPath,
    JSON.stringify({ at: new Date().toISOString(), map: audit.map, rows: touched }, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v, 2) + '\n'
  );
  console.log(`Snapshot written: ${snapPath}`);

  await prisma.$transaction(
    async (tx) => {
      // 1. Permanent id map (audit_logs resolvability + provenance)
      await tx.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS material_id_map (
          old_id TEXT PRIMARY KEY,
          new_id TEXT NOT NULL,
          material_type TEXT,
          action TEXT NOT NULL CHECK (action IN ('RENAME','MERGE')),
          migrated_at TIMESTAMPTZ DEFAULT now()
        )`);
      for (const m of audit.map) {
        await tx.$executeRawUnsafe(
          `INSERT INTO material_id_map (old_id, new_id, material_type, action)
           VALUES ($1, $2, $3, $4) ON CONFLICT (old_id) DO NOTHING`,
          m.oldId, m.newId, m.materialType, m.action
        );
      }

      // 2. Backfill sizeVariantId on parse-resolved label size rows (before rename so the
      //    identity check `id = COALESCE(sizeVariantId, …)` holds afterwards)
      for (const m of audit.map.filter((x) => x.backfillSizeVariantId)) {
        await tx.materials.update({
          where: { id: m.oldId },
          data: { sizeVariantId: m.backfillSizeVariantId },
        });
      }

      // 3. MERGE phase
      for (const m of merges) {
        console.log(`  MERGE ${m.oldId} ⇒ ${m.newId}`);
        await mergeLoserIntoWinner(tx, m);
      }

      // 4. RENAME phase — one UPDATE; ON UPDATE CASCADE rewrites all relation children
      const renamed = await tx.$executeRawUnsafe(`
        UPDATE materials m SET id = map.new_id
        FROM material_id_map map
        WHERE m.id = map.old_id AND map.action = 'RENAME'`);
      console.log(`  RENAMED ${renamed} materials rows (children followed via cascade)`);

      // 5. Dangling columns from the FULL map (harmless re-run for MERGE rows)
      for (const d of DANGLING_COLUMNS) {
        const n = await tx.$executeRawUnsafe(`
          UPDATE ${d.table} t SET "${d.column}" = map.new_id
          FROM material_id_map map WHERE t."${d.column}" = map.old_id`);
        if (n > 0) console.log(`  ${d.table}.${d.column}: ${n} row(s) re-keyed`);
      }

      // 5b. JSON blobs — QUOTE-DELIMITED replace ("mat-x" → "uuid") so a base label id can
      //     never corrupt a size-row id that contains it as a prefix (mat-lbl-0007 ⊂ mat-lbl-0007-m)
      for (const m of audit.map) {
        await tx.$executeRawUnsafe(
          `UPDATE style_costing SET
             "trimsDetails"       = REPLACE("trimsDetails"::text,       $1, $2)::jsonb,
             "accessoriesDetails" = REPLACE("accessoriesDetails"::text, $1, $2)::jsonb,
             "fabricDetails"      = REPLACE("fabricDetails"::text,      $1, $2)::jsonb
           WHERE "trimsDetails"::text LIKE $3 OR "accessoriesDetails"::text LIKE $3 OR "fabricDetails"::text LIKE $3`,
          `"${m.oldId}"`, `"${m.newId}"`, `%"${m.oldId}"%`
        );
        await tx.$executeRawUnsafe(
          `UPDATE order_item_costing SET costing_snapshot = REPLACE(costing_snapshot::text, $1, $2)::jsonb
           WHERE costing_snapshot::text LIKE $3`,
          `"${m.oldId}"`, `"${m.newId}"`, `%"${m.oldId}"%`
        );
      }

      // 6. materialType drift fix: OTHER → OTHER_MATERIAL for master-backed rows
      const drift = await tx.$executeRawUnsafe(`
        UPDATE materials SET "materialType" = 'OTHER_MATERIAL'
        WHERE "materialType" = 'OTHER' AND "otherMaterialId" IS NOT NULL`);
      if (drift > 0) console.log(`  materialType OTHER → OTHER_MATERIAL: ${drift} row(s)`);

      // 7. Backfill BASE label materials rows where only size rows exist (Phase 3 prerequisite:
      //    every label needs a base row with id = label_master.id, sizeVariantId NULL)
      const baseBackfill = await tx.$executeRawUnsafe(`
        INSERT INTO materials (id, code, name, "categoryId", "materialType", unit, "isActive", "labelId", "createdAt", "updatedAt")
        SELECT lm.id, lm."labelCode", lm."labelName",
               (SELECT id FROM material_categories WHERE name = 'Label' LIMIT 1),
               'LABEL', 'PIECE', lm."isActive", lm.id, now(), now()
        FROM label_master lm
        WHERE EXISTS (SELECT 1 FROM materials sz WHERE sz."labelId" = lm.id AND sz."sizeVariantId" IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM materials b WHERE b."labelId" = lm.id AND b."sizeVariantId" IS NULL)`);
      if (baseBackfill > 0) console.log(`  Base label rows backfilled: ${baseBackfill}`);

      // 8. Preset LABEL items: populate materialId from labelId (valid now that base rows exist)
      const presetFill = await tx.$executeRawUnsafe(`
        UPDATE customer_accessories_preset_items
        SET "materialId" = "labelId"
        WHERE "materialType" = 'LABEL' AND "labelId" IS NOT NULL AND "materialId" IS NULL
          AND EXISTS (SELECT 1 FROM materials mm WHERE mm.id = "labelId")`);
      if (presetFill > 0) console.log(`  Preset LABEL items materialId backfilled: ${presetFill}`);

      // 9. IN-TX ASSERTS — any failure aborts and rolls back EVERYTHING
      const allowlist = new Set(audit.orphans.map((o) => o.id));
      const residue: any[] = await tx.$queryRawUnsafe(
        `SELECT id FROM materials WHERE id LIKE 'mat-%'`
      );
      const badResidue = residue.filter((r) => !allowlist.has(r.id));
      if (badResidue.length > 0) {
        throw new Error(`ASSERT FAILED: ${badResidue.length} mat-* ids remain: ${badResidue.map((r) => r.id).join(', ')}`);
      }

      const [{ t: afterTotal }]: any[] = await tx.$queryRawUnsafe(
        `SELECT COALESCE(SUM(quantity), 0)::text AS t FROM stock_levels`
      );
      if (Number(afterTotal) !== Number(before.stockTotal)) {
        throw new Error(`ASSERT FAILED: stock_levels total changed ${before.stockTotal} → ${afterTotal}`);
      }

      for (const d of DANGLING_COLUMNS) {
        const [{ n }]: any[] = await tx.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS n FROM ${d.table} t
          WHERE t."${d.column}" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = t."${d.column}")`);
        if (n > 0) throw new Error(`ASSERT FAILED: ${n} dangling refs left in ${d.table}.${d.column}`);
      }

      console.log('\n  All in-transaction asserts passed.');
    },
    { timeout: 300_000, maxWait: 60_000 }
  );

  console.log('\n✓ COMMITTED. Run unify-material-ids-verify.ts next, then pm2 start.');
}

main()
  .catch((e) => {
    console.error('\n✗ MIGRATION FAILED (transaction rolled back — nothing was applied):\n', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
