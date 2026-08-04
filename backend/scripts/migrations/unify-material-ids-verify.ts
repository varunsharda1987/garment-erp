/**
 * VERIFY (read-only) — run immediately after unify-material-ids.ts --apply.
 * Diffs the live DB against the audit baselines and proves the identity invariant.
 *
 * Usage:  npx ts-node scripts/migrations/unify-material-ids-verify.ts
 */
import prisma from '../../src/config/database';
import * as fs from 'fs';
import * as path from 'path';
import { collectBaselines, DANGLING_COLUMNS, RELATION_CHILDREN } from './unify-material-ids-lib';
import { MASTER_CONFIG } from '../../src/services/helpers/master-config';

async function main() {
  console.log('=== MATERIALS-ID UNIFICATION VERIFY (read-only) ===\n');
  const auditPath = path.join(__dirname, 'unify-material-ids-audit.json');
  if (!fs.existsSync(auditPath)) throw new Error('Run unify-material-ids-audit.ts first (baseline missing).');
  const auditFile = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const allowlist: Set<string> = new Set(auditFile.orphanAllowlist || []);
  let failures = 0;
  const fail = (msg: string) => { failures++; console.log(`✗ ${msg}`); };
  const pass = (msg: string) => console.log(`✓ ${msg}`);

  // 1. Zero mat-* residue outside the allowlist
  const residue: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM materials WHERE id LIKE 'mat-%'`);
  const bad = residue.filter((r) => !allowlist.has(r.id));
  bad.length ? fail(`${bad.length} mat-* ids remain: ${bad.map((r) => r.id).join(', ')}`) : pass('No mat-* ids outside the allowlist');

  // 2. Identity invariant: id === COALESCE(sizeVariantId, <its type FK>) for every FK-linked row
  const fkChecks = Object.values(MASTER_CONFIG)
    .filter((c) => c.fkField !== 'labelId')
    .map((c) => `("${c.fkField}" IS NOT NULL AND id <> "${c.fkField}")`)
    .join(' OR ');
  const nonConforming: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, code, "materialType" FROM materials
    WHERE ("sizeVariantId" IS NOT NULL AND id <> "sizeVariantId")
       OR ("sizeVariantId" IS NULL AND "labelId" IS NOT NULL AND id <> "labelId")
       OR ("sizeVariantId" IS NULL AND (${fkChecks}))`);
  nonConforming.length
    ? fail(`${nonConforming.length} rows violate id === master-id: ${nonConforming.slice(0, 10).map((r) => `${r.id}(${r.code})`).join(', ')}`)
    : pass('Identity invariant holds: materials.id === master/variant id for every linked row');

  // 3. FK integrity on every referencing table (relation children + dangling columns)
  for (const t of RELATION_CHILDREN) {
    const [{ n }]: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n FROM ${t} c
      WHERE c."materialId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = c."materialId")`);
    if (n > 0) fail(`${t}: ${n} rows point at a missing material`);
  }
  for (const d of DANGLING_COLUMNS) {
    const [{ n }]: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS n FROM ${d.table} c
      WHERE c."${d.column}" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = c."${d.column}")`);
    if (n > 0) fail(`${d.table}.${d.column} (dangling): ${n} rows point at a missing material`);
  }
  pass('FK + dangling-column integrity checked');

  // 4. Stock totals vs baseline
  const now = await collectBaselines(prisma);
  const base = auditFile.baselines;
  Number(now.stockTotal) === Number(base.stockTotal)
    ? pass(`stock_levels total unchanged (${now.stockTotal})`)
    : fail(`stock_levels total drifted: ${base.stockTotal} → ${now.stockTotal}`);
  for (const [wh, qty] of Object.entries(base.stockPerWarehouse)) {
    if (Number(now.stockPerWarehouse[wh] ?? 0) !== Number(qty)) {
      fail(`warehouse ${wh} stock drifted: ${qty} → ${now.stockPerWarehouse[wh] ?? 0}`);
    }
  }

  // 5. Row-count reconciliation (materials may shrink by the MERGE deletions; children
  //    may shrink only by documented merge dedupes — report any delta for review)
  for (const [table, count] of Object.entries(base.rowCounts) as [string, number][]) {
    const delta = (now.rowCounts[table] ?? 0) - count;
    if (delta !== 0) console.log(`  ℹ ${table}: ${count} → ${now.rowCounts[table]} (${delta > 0 ? '+' : ''}${delta})${table === 'materials' ? ' (merge deletions expected)' : ' — review against the merge log'}`);
  }

  // 6. material_id_map sanity
  const [{ n: mapCount }]: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM material_id_map`);
  mapCount >= (auditFile.map?.length ?? 0)
    ? pass(`material_id_map holds ${mapCount} entries`)
    : fail(`material_id_map has ${mapCount} entries, expected >= ${auditFile.map?.length}`);

  // 7. Spot-resolve 5 old ids through the map
  const spots: any[] = await prisma.$queryRawUnsafe(`SELECT old_id, new_id FROM material_id_map LIMIT 5`);
  for (const s of spots) {
    const [{ n }]: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM materials WHERE id = $1`, s.new_id);
    if (n !== 1) fail(`map target ${s.new_id} (from ${s.old_id}) not found in materials`);
  }

  console.log(failures === 0 ? '\n✓ ALL CHECKS PASSED — safe to pm2 start.' : `\n✗ ${failures} CHECK(S) FAILED — investigate before restarting (pg_restore is the rollback).`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
