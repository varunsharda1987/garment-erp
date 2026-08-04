/**
 * Seed `code_sequences` from existing data for every generator migrated to the atomic
 * helper WITHOUT a visible format change (master/entity codes like AGY-001, batch codes).
 * For those, the sequence MUST continue after the current max or new codes would collide.
 * Document numbers whose format changed (unified PREFIX2607-NNNN) start fresh and need
 * no seeding — the new strings can't collide with the old format.
 *
 * Idempotent: upserts GREATEST(existing, max-found). Safe to re-run any time.
 * Run: npx ts-node scripts/seed-code-sequences.ts
 */
import prisma from '../src/config/database';

interface SeedEntry {
  /** code_sequences.prefix key (exactly what the generator passes to the helper) */
  prefix: string;
  /** table + column holding existing codes */
  table: string;
  column: string;
  /** regex with ONE capture group extracting the numeric suffix from an existing code */
  suffixRegex: string;
}

// Populated from the generator-migration agents' seedEntries output (2026-07-23).
const SEEDS: SeedEntry[] = [
  { prefix: "BTN", table: "button_master", column: "buttonCode", suffixRegex: "^BTN-(\\d+)$" },
  { prefix: "ELA", table: "elastic_master", column: "elasticCode", suffixRegex: "^ELA-(\\d+)$" },
  { prefix: "LBL", table: "label_master", column: "labelCode", suffixRegex: "^LBL-(\\d+)$" },
  { prefix: "LACE", table: "lace_master", column: "laceCode", suffixRegex: "^LACE-(\\d+)$" },
  { prefix: "PART", table: "machine_part_master", column: "partCode", suffixRegex: "^PART-(\\d+)$" },
  { prefix: "OTH", table: "other_material_master", column: "materialCode", suffixRegex: "^OTH-(\\d+)$" },
  { prefix: "THR", table: "thread_master", column: "threadCode", suffixRegex: "^THR-(\\d+)$" },
  { prefix: "ZIP", table: "zipper_master", column: "zipperCode", suffixRegex: "^ZIP-(\\d+)$" },
  { prefix: "PKG", table: "packaging_master", column: "packagingCode", suffixRegex: "^PKG-(\\d+)$" },
  { prefix: "GRG", table: "greige_master", column: "greigeCode", suffixRegex: "^GRG-(\\d+)$" },
  { prefix: "LD-LACE", table: "lace_lab_dip", column: "labDipNumber", suffixRegex: "^LD-LACE-(\\d+)$" },
  { prefix: "EMB-202607", table: "embroidery_master", column: "embroideryCode", suffixRegex: "^EMB-202607-(\\d+)$" },
  { prefix: "HE", table: "hook_eye_master", column: "hookEyeCode", suffixRegex: "^HE-(\\d+)$" },
  { prefix: "SB", table: "snap_button_master", column: "snapButtonCode", suffixRegex: "^SB-(\\d+)$" },
  { prefix: "BK", table: "buckle_master", column: "buckleCode", suffixRegex: "^BK-(\\d+)$" },
  { prefix: "BT", table: "belt_master", column: "beltCode", suffixRegex: "^BT-(\\d+)$" },
  { prefix: "VL", table: "velcro_master", column: "velcroCode", suffixRegex: "^VL-(\\d+)$" },
  { prefix: "DS", table: "drawstring_master", column: "drawstringCode", suffixRegex: "^DS-(\\d+)$" },
  { prefix: "RB", table: "ribbon_master", column: "ribbonCode", suffixRegex: "^RB-(\\d+)$" },
  { prefix: "SQ", table: "sequin_master", column: "sequinCode", suffixRegex: "^SQ-(\\d+)$" },
  { prefix: "BD", table: "bead_master", column: "beadCode", suffixRegex: "^BD-(\\d+)$" },
  { prefix: "MT", table: "motif_master", column: "motifCode", suffixRegex: "^MT-(\\d+)$" },
  { prefix: "IL", table: "interlining_master", column: "interliningCode", suffixRegex: "^IL-(\\d+)$" },
  { prefix: "PD", table: "padding_master", column: "paddingCode", suffixRegex: "^PD-(\\d+)$" },
  { prefix: "OF", table: "other_fastener_master", column: "otherFastenerCode", suffixRegex: "^OF-(\\d+)$" },
  { prefix: "OT", table: "other_tape_master", column: "otherTapeCode", suffixRegex: "^OT-(\\d+)$" },
  { prefix: "OD", table: "other_decorative_master", column: "otherDecorativeCode", suffixRegex: "^OD-(\\d+)$" },
  { prefix: "OX", table: "other_functional_master", column: "otherFunctionalCode", suffixRegex: "^OX-(\\d+)$" },
  { prefix: "AGY", table: "agencies", column: "code", suffixRegex: "^AGY-(\\d+)$" },
  { prefix: "AGT", table: "agents", column: "code", suffixRegex: "^AGT-(\\d+)$" },
  { prefix: "CLR", table: "color_master", column: "colorCode", suffixRegex: "^CLR(\\d+)$" },
  { prefix: "GPT", table: "garment_physical_tests", column: "testNumber", suffixRegex: "^GPT-(?:.*-)?(\\d+)$" },
  { prefix: "WH-RM", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-RM-(\\d+)$" },
  { prefix: "WH-FG", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-FG-(\\d+)$" },
  { prefix: "WH-WIP", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-WIP-(\\d+)$" },
  { prefix: "WH-GEN", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-GEN-(\\d+)$" },
  { prefix: "WH-TRN", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-TRN-(\\d+)$" },
  { prefix: "WH-JW", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-JW-(\\d+)$" },
  { prefix: "WH", table: "warehouses", column: "warehouseCode", suffixRegex: "^WH-(\\d+)$" },
  { prefix: "CH2607", table: "challans", column: "challanNumber", suffixRegex: "^CH2607-(\\d+)$" },
  { prefix: "PB2607", table: "processing_batch", column: "batchNumber", suffixRegex: "^PB2607-(\\d+)$" },
  { prefix: "DEL2607", table: "processing_delivery", column: "deliveryNumber", suffixRegex: "^DEL2607-(\\d+)$" },
  { prefix: "LIS2607", table: "lace_issue_note", column: "issueNumber", suffixRegex: "^LIS2607-(\\d+)$" },
];

async function main() {
  let seeded = 0;
  for (const s of SEEDS) {
    const re = new RegExp(s.suffixRegex);
    let rows: Array<Record<string, string>>;
    try {
      rows = await prisma.$queryRawUnsafe(`SELECT "${s.column}" AS code FROM "${s.table}" WHERE "${s.column}" IS NOT NULL`);
    } catch (e) {
      console.warn(`skip ${s.prefix}: cannot read ${s.table}.${s.column} — ${(e as Error).message.split('\n')[0]}`);
      continue;
    }
    let max = 0;
    for (const r of rows) {
      const m = (r.code || '').match(re);
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    }
    if (max === 0) {
      console.log(`${s.prefix}: no existing codes match — nothing to seed`);
      continue;
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT (prefix) DO UPDATE SET
         "lastValue" = GREATEST(code_sequences."lastValue", EXCLUDED."lastValue"),
         "updatedAt" = NOW()`,
      s.prefix,
      max
    );
    console.log(`${s.prefix}: seeded lastValue >= ${max} (from ${rows.length} rows of ${s.table}.${s.column})`);
    seeded++;
  }
  console.log(`done — ${seeded}/${SEEDS.length} prefixes seeded`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
