/**
 * AUDIT (read-only) for the materials-id unification.
 *
 * Prints the full migration plan and writes the baseline file the verify step diffs
 * against. Run BEFORE the migration; every blocker it reports must be resolved first.
 *
 * Usage:  npx ts-node scripts/migrations/unify-material-ids-audit.ts
 *
 * Writes: scripts/migrations/unify-material-ids-audit.json (baselines + plan snapshot)
 */
import prisma from '../../src/config/database';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildIdMap,
  checkFkCascade,
  collectBaselines,
  DANGLING_COLUMNS,
} from './unify-material-ids-lib';

async function main() {
  console.log('=== MATERIALS-ID UNIFICATION AUDIT (read-only) ===\n');
  let blockers = 0;

  // 1. FK cascade hard gate
  const fk = await checkFkCascade(prisma);
  if (fk.ok) {
    console.log(`✓ All ${fk.rows.length} FKs into materials(id) are ON UPDATE CASCADE`);
  } else {
    blockers++;
    console.log('✗ BLOCKER: FKs without ON UPDATE CASCADE (single-UPDATE rename unsafe):');
    fk.rows
      .filter((r: any) => r.update_rule !== 'CASCADE')
      .forEach((r: any) => console.log(`    ${r.table_name}: update_rule=${r.update_rule}`));
  }

  // 2. Census by type × id-class
  const census: any[] = await prisma.$queryRawUnsafe(`
    SELECT "materialType",
           CASE WHEN id LIKE 'mat-%' THEN 'mat-*'
                WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'uuid'
                ELSE 'other' END AS id_class, COUNT(*)::int AS n
    FROM materials GROUP BY 1,2 ORDER BY 1,2`);
  console.log('\nCensus (materialType × id-class):');
  census.forEach((r) => console.log(`  ${String(r.materialType).padEnd(18)} ${String(r.id_class).padEnd(6)} ${r.n}`));

  // 3. The id map
  const audit = await buildIdMap(prisma);
  const renames = audit.map.filter((m) => m.action === 'RENAME');
  const merges = audit.map.filter((m) => m.action === 'MERGE');
  console.log(`\nPlan: ${renames.length} RENAME, ${merges.length} MERGE, ${audit.conforming} already conforming, ${audit.orphans.length} orphan/GENERIC (untouched)`);

  console.log('\nRENAMES:');
  renames.forEach((m) => console.log(`  ${m.oldId}  →  ${m.newId}   (${m.reason})`));
  if (merges.length) {
    console.log('\nMERGES (target row already exists — children repointed, loser deleted):');
    merges.forEach((m) => console.log(`  ${m.oldId}  ⇒  ${m.newId}   (${m.reason})`));
  }
  const backfills = audit.map.filter((m) => m.backfillSizeVariantId);
  if (backfills.length) {
    console.log(`\nsizeVariantId backfills (label size rows missing the stamp): ${backfills.length}`);
    backfills.forEach((m) => console.log(`  ${m.oldId} → sizeVariantId ${m.backfillSizeVariantId}`));
  }

  if (audit.duplicateTargets.length) {
    blockers++;
    console.log('\n✗ BLOCKER: multiple rows resolve to the SAME target id:');
    audit.duplicateTargets.forEach((t) => console.log(`    ${t}`));
  }
  if (audit.unresolved.length) {
    blockers++;
    console.log('\n✗ BLOCKER: unresolved rows:');
    audit.unresolved.forEach((u) => console.log(`    ${u.id} (${u.materialType} ${u.code}): ${u.problem}`));
  }

  // 4. Orphans (allowlist) — flag any with live stock
  if (audit.orphans.length) {
    console.log('\nOrphan/GENERIC rows (no master FK — carried over untouched, allowlisted):');
    for (const o of audit.orphans) {
      const [{ n }]: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM stock_levels WHERE "materialId" = $1 AND quantity <> 0`,
        o.id
      );
      console.log(`  ${o.id} (${o.materialType} ${o.code})${n > 0 ? '  ⚠ HAS NON-ZERO STOCK' : ''}`);
    }
  }

  // 5. Dangling-column census (values that are in the map)
  const mapOldIds = audit.map.map((m) => m.oldId);
  console.log('\nDangling columns holding ids to migrate:');
  for (const d of DANGLING_COLUMNS) {
    if (mapOldIds.length === 0) {
      console.log(`  ${d.table}.${d.column}: 0`);
      continue;
    }
    const [{ n }]: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM ${d.table} WHERE "${d.column}" = ANY($1)`,
      mapOldIds
    );
    console.log(`  ${d.table}.${d.column}: ${n} row(s)`);
  }

  // 5b. JSON blobs containing ids to migrate (rewritten quote-delimited by the migration)
  let blobHits = 0;
  for (const oldId of mapOldIds) {
    const [{ n }]: any[] = await prisma.$queryRawUnsafe(
      `SELECT (SELECT COUNT(*) FROM style_costing WHERE "trimsDetails"::text LIKE $1 OR "accessoriesDetails"::text LIKE $1 OR "fabricDetails"::text LIKE $1)::int
       + (SELECT COUNT(*) FROM order_item_costing WHERE costing_snapshot::text LIKE $1)::int AS n`,
      `%"${oldId}"%`
    );
    blobHits += n;
  }
  console.log(`\nJSON blob rows containing migrating ids (style_costing + order_item_costing): ${blobHits}`);

  // 6. Baselines for verify
  const baselines = await collectBaselines(prisma);
  console.log(`\nBaselines: stock total ${baselines.stockTotal}, mat-* rows ${baselines.matStarCount}, materials rows ${baselines.rowCounts.materials}`);

  const outPath = path.join(__dirname, 'unify-material-ids-audit.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        blockers,
        plan: { renames: renames.length, merges: merges.length, conforming: audit.conforming },
        map: audit.map,
        orphanAllowlist: audit.orphans.map((o) => o.id),
        baselines,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`\nAudit written to ${outPath}`);

  if (blockers > 0) {
    console.log(`\n✗ ${blockers} BLOCKER(S) — do NOT run the migration until resolved.`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ No blockers — safe to proceed (backup → dry-run → --apply → verify).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
