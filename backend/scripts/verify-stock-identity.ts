/**
 * verify-stock-identity.ts — READ-ONLY verification of the BH-0296 stock-identity state.
 *
 * Runs every check from docs/bug-hunt/REPAIR_PLAN.md Step 2 against the live DB:
 *   1. Negative stock_levels rows            (must be zero after repair)
 *   2. Duplicate materials rows per greige   (the GRG-xxxx / GRG-xxxx-RAW pairs)
 *   3. Phantom fabric_master rows            (FAB-RAW-* / isGeneric RAW)
 *   4. greige_stock vs stock_levels drift    (per material)
 *   5. fabric_stock vs stock_levels drift    (per material)
 *   6. Context row counts
 *
 * Usage: cd backend && npx ts-node scripts/verify-stock-identity.ts
 * KEEPER: this is also the "prove it" script after any stock repair — everything must be zero.
 */

import prisma from '../src/config/database';

async function main() {
  console.log('\n=== BH-0296 stock-identity verification (read-only) ===\n');

  // 1. Negative stock_levels
  const negatives = await prisma.$queryRaw<any[]>`
    SELECT m.code, sl.quantity::float AS quantity, sl.unit, sl."warehouseId"
    FROM stock_levels sl JOIN materials m ON m.id = sl."materialId"
    WHERE sl.quantity < 0`;
  console.log(`1. NEGATIVE stock_levels rows: ${negatives.length}`);
  negatives.forEach((r) => console.log(`   ${r.code}: ${r.quantity} ${r.unit}`));

  // 2. Duplicate materials per greige
  const dupes = await prisma.$queryRaw<any[]>`
    SELECT gm."greigeCode", COUNT(m.id)::int AS materials_rows,
           STRING_AGG(m.code, ' + ' ORDER BY m.code) AS codes
    FROM materials m JOIN greige_master gm ON gm.id = m."greigeId"
    GROUP BY gm."greigeCode" HAVING COUNT(m.id) > 1`;
  console.log(`\n2. DUPLICATE materials pairs (greige): ${dupes.length}`);
  dupes.forEach((r) => console.log(`   ${r.greigeCode}: ${r.codes}`));

  // 2b. Duplicate materials per fabric (should be zero per plan)
  const fabDupes = await prisma.$queryRaw<any[]>`
    SELECT fm."fabricCode", COUNT(m.id)::int AS materials_rows
    FROM materials m JOIN fabric_master fm ON fm.id = m."fabricId"
    GROUP BY fm."fabricCode" HAVING COUNT(m.id) > 1`;
  console.log(`   DUPLICATE materials pairs (fabric): ${fabDupes.length}`);
  fabDupes.forEach((r) => console.log(`   ${r.fabricCode}: ${r.materials_rows} rows`));

  // 3. Phantom fabric_master rows
  const phantoms = await prisma.$queryRaw<any[]>`
    SELECT fm.id, fm."fabricCode", fm."isActive",
           (SELECT COUNT(*)::int FROM fabric_stock fs WHERE fs."fabricId" = fm.id) AS stock_lots,
           (SELECT COUNT(*)::int FROM materials m WHERE m."fabricId" = fm.id) AS materials_rows
    FROM fabric_master fm
    WHERE fm.id LIKE 'FAB-RAW-%' OR (fm."isGeneric" = true AND fm."finishType" = 'RAW')`;
  console.log(`\n3. PHANTOM fabric_master rows (FAB-RAW-*/generic RAW): ${phantoms.length}`);
  phantoms.forEach((r) =>
    console.log(`   ${r.fabricCode} (${r.id}) — ${r.stock_lots} fabric_stock lots, ${r.materials_rows} materials rows`)
  );

  // 4. greige_stock vs stock_levels drift — ON-HAND semantics: processor-held lots
  // (processorId set / sourceType TRANSFER) are deliberately excluded, matching
  // derived_stock_view. Issued greige leaves on-hand and returns as fabric via GRN.
  const greigeDrift = await prisma.$queryRaw<any[]>`
    SELECT gm."greigeCode",
           ROUND(COALESCE(gs.actual, 0)::numeric, 2)::float AS greige_stock_actual,
           ROUND(COALESCE(sl.reported, 0)::numeric, 2)::float AS stock_levels_reports,
           ROUND((COALESCE(sl.reported, 0) - COALESCE(gs.actual, 0))::numeric, 2)::float AS discrepancy
    FROM greige_master gm
    JOIN materials m ON m."greigeId" = gm.id
    LEFT JOIN (SELECT "greigeId", SUM("quantityAvailable") AS actual
               FROM greige_stock
               WHERE status = 'AVAILABLE' AND "processorId" IS NULL
                 AND "sourceType" IS DISTINCT FROM 'TRANSFER'
               GROUP BY "greigeId") gs ON gs."greigeId" = gm.id
    LEFT JOIN (SELECT "materialId", SUM(quantity) AS reported
               FROM stock_levels GROUP BY "materialId") sl ON sl."materialId" = m.id
    WHERE ABS(COALESCE(sl.reported, 0) - COALESCE(gs.actual, 0)) > 0.01
    ORDER BY ABS(COALESCE(sl.reported, 0) - COALESCE(gs.actual, 0)) DESC`;
  console.log(`\n4. GREIGE drift (ledger vs greige_stock): ${greigeDrift.length} materials`);
  greigeDrift.forEach((r) =>
    console.log(
      `   ${r.greigeCode}: greige_stock=${r.greige_stock_actual}  ledger=${r.stock_levels_reports}  drift=${r.discrepancy}`
    )
  );

  // 5. fabric_stock vs stock_levels drift
  const fabricDrift = await prisma.$queryRaw<any[]>`
    SELECT fm."fabricCode",
           ROUND(COALESCE(fs.actual, 0)::numeric, 2)::float AS fabric_stock_actual,
           ROUND(COALESCE(sl.reported, 0)::numeric, 2)::float AS stock_levels_reports,
           ROUND((COALESCE(sl.reported, 0) - COALESCE(fs.actual, 0))::numeric, 2)::float AS discrepancy
    FROM fabric_master fm
    JOIN materials m ON m."fabricId" = fm.id
    LEFT JOIN (SELECT "fabricId", SUM("quantityAvailable") AS actual
               FROM fabric_stock WHERE status = 'AVAILABLE' GROUP BY "fabricId") fs ON fs."fabricId" = fm.id
    LEFT JOIN (SELECT "materialId", SUM(quantity) AS reported
               FROM stock_levels GROUP BY "materialId") sl ON sl."materialId" = m.id
    WHERE ABS(COALESCE(sl.reported, 0) - COALESCE(fs.actual, 0)) > 0.01
    ORDER BY ABS(COALESCE(sl.reported, 0) - COALESCE(fs.actual, 0)) DESC`;
  console.log(`\n5. FABRIC drift (ledger vs fabric_stock): ${fabricDrift.length} materials`);
  fabricDrift.forEach((r) =>
    console.log(
      `   ${r.fabricCode}: fabric_stock=${r.fabric_stock_actual}  ledger=${r.stock_levels_reports}  drift=${r.discrepancy}`
    )
  );

  // 6. Context counts
  const counts = await prisma.$queryRaw<any[]>`
    SELECT (SELECT COUNT(*)::int FROM greige_stock)  AS greige_lots,
           (SELECT COUNT(*)::int FROM fabric_stock)  AS fabric_lots,
           (SELECT COUNT(*)::int FROM stock_levels)  AS stock_level_rows,
           (SELECT COUNT(*)::int FROM stock_movements) AS stock_movements,
           (SELECT COUNT(*)::int FROM materials)     AS materials`;
  console.log(`\n6. Row counts:`, counts[0]);

  const clean =
    negatives.length === 0 && dupes.length === 0 && fabDupes.length === 0 && phantoms.length === 0 &&
    greigeDrift.length === 0 && fabricDrift.length === 0;
  console.log(`\n=== VERDICT: ${clean ? '✅ CLEAN — no identity/drift problems' : '⚠ ISSUES FOUND (see above)'} ===\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
