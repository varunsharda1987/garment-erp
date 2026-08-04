/**
 * Apply code-uniqueness constraints DIRECTLY (material-identity Phase 2c).
 *
 * Why not `prisma migrate dev`: the live DB has long-standing migration-history drift
 * (features applied outside the ledger), so migrate dev demands a full reset — unacceptable
 * on production. This script applies EXACTLY the 28 unique indexes the updated schema.prisma
 * declares (27 master code fields + materials.code), dropping each field's now-redundant
 * plain index. Index names follow Prisma's own conventions (<table>_<field>_key /
 * <table>_<field>_idx) so a future history re-baseline matches cleanly.
 *
 * SAFE: pre-checks every field for duplicates (aborts before touching anything if found);
 * DDL is idempotent (IF NOT EXISTS / IF EXISTS); runs in one transaction.
 *
 * Usage:  npx ts-node scripts/migrations/apply-code-uniqueness.ts
 */
import prisma from '../../src/config/database';

const TARGETS: { table: string; field: string }[] = [
  { table: 'greige_master', field: 'greigeCode' },
  { table: 'fabric_master', field: 'fabricCode' },
  { table: 'lace_master', field: 'laceCode' },
  { table: 'thread_master', field: 'threadCode' },
  { table: 'button_master', field: 'buttonCode' },
  { table: 'zipper_master', field: 'zipperCode' },
  { table: 'elastic_master', field: 'elasticCode' },
  { table: 'label_master', field: 'labelCode' },
  { table: 'packaging_master', field: 'packagingCode' },
  { table: 'machine_part_master', field: 'partCode' },
  { table: 'other_material_master', field: 'materialCode' },
  { table: 'hook_eye_master', field: 'hookEyeCode' },
  { table: 'snap_button_master', field: 'snapButtonCode' },
  { table: 'buckle_master', field: 'buckleCode' },
  { table: 'belt_master', field: 'beltCode' },
  { table: 'velcro_master', field: 'velcroCode' },
  { table: 'drawstring_master', field: 'drawstringCode' },
  { table: 'ribbon_master', field: 'ribbonCode' },
  { table: 'sequin_master', field: 'sequinCode' },
  { table: 'bead_master', field: 'beadCode' },
  { table: 'motif_master', field: 'motifCode' },
  { table: 'interlining_master', field: 'interliningCode' },
  { table: 'padding_master', field: 'paddingCode' },
  { table: 'other_fastener_master', field: 'otherFastenerCode' },
  { table: 'other_tape_master', field: 'otherTapeCode' },
  { table: 'other_decorative_master', field: 'otherDecorativeCode' },
  { table: 'other_functional_master', field: 'otherFunctionalCode' },
  { table: 'materials', field: 'code' },
];

async function main() {
  console.log('=== CODE-UNIQUENESS CONSTRAINTS (28 fields) ===\n');

  // 1. Duplicate pre-check — abort before ANY change if a duplicate exists
  let dupes = 0;
  for (const t of TARGETS) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "${t.field}" AS code, COUNT(*)::int AS n FROM ${t.table} GROUP BY 1 HAVING COUNT(*) > 1`
    );
    if (rows.length) {
      dupes++;
      console.log(`✗ ${t.table}.${t.field} has duplicates:`);
      rows.forEach((r) => console.log(`    ${r.code} ×${r.n}`));
    }
  }
  if (dupes) {
    throw new Error(`${dupes} field(s) have duplicate codes — resolve them first (rename one of each pair), then re-run.`);
  }
  console.log('✓ No duplicate codes anywhere — safe to enforce.\n');

  // 2. Apply: unique index up, redundant plain index down (Prisma naming conventions)
  await prisma.$transaction(
    async (tx) => {
      for (const t of TARGETS) {
        await tx.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${t.table}_${t.field}_key" ON ${t.table} ("${t.field}")`
        );
        await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "${t.table}_${t.field}_idx"`);
        console.log(`  ✓ ${t.table}.${t.field} → UNIQUE`);
      }
    },
    { timeout: 120_000 }
  );

  // 3. Verify
  const [{ n }]: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS n FROM pg_indexes
    WHERE indexname = ANY($1) AND indexdef LIKE 'CREATE UNIQUE INDEX%'`,
    TARGETS.map((t) => `${t.table}_${t.field}_key`)
  );
  if (n !== TARGETS.length) {
    throw new Error(`Verify failed: ${n}/${TARGETS.length} unique indexes present`);
  }
  console.log(`\n✓ DONE — ${n}/${TARGETS.length} unique constraints live. Duplicate codes are now physically impossible.`);
}

main()
  .catch((e) => {
    console.error('\n✗ FAILED (nothing partially applied — DDL ran in one transaction):\n', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
