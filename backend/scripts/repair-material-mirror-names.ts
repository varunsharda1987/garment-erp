/**
 * One-off repair: give every master's `materials` row the master's own name and code (2026-09-27).
 *
 * `materials` carries a copy of each master's code and name (materials.id === master.id), and that
 * copy is what the PO list, PO search, the PO page, the printed PO and GRN, MRP and stock read. A
 * master edit reaches it only through syncMasterToMaterials, and only when the edit CHANGES the
 * name — so renames made before the sync existed (46449e1d, 2026-08-02) were never copied, and
 * re-saving the already-correct master does not copy them either. The Purchase Orders audit
 * (2026-09-26) found 45 of 65 greige rows missing their quality (" (Super Dyeing)", " (Dyeing)",
 * " (Printing)"; 8 also "68X64" for "68×64") and 13 of 34 lace: 10 of 13 POs showed, searched and
 * PRINTED the old name.
 *
 * The rename goes through syncMasterToMaterials itself, so a thread's pack rows and a label's size
 * rows follow their base row exactly as they do on a master edit ("<name> - Size L",
 * "<name> - Cone 3-ply"). Size rows made before that convention (Dec-2025) read the bare label name.
 *
 * A master whose OWN name is a placeholder is not copied — it is listed under "master name needs
 * fixing first". LACE-0010 is one: "… | Red | LACE-0009 → ?" was baked in before generateLaceName
 * stopped printing "→ ?". Open it on the Lace master, Edit, Save without touching the name: the form
 * sends it blank, the name is regenerated ("… | Red | from LACE-0009"), and the save syncs the mirror.
 *
 * `findMirrorDrift` is also the invariant sweep (check-order-system-integrity D25): after --apply
 * and the placeholder fix it must find nothing.
 *
 *   npx ts-node scripts/repair-material-mirror-names.ts            (dry-run)
 *   npx ts-node scripts/repair-material-mirror-names.ts --apply
 *   npx ts-node scripts/repair-material-mirror-names.ts --types=GREIGE,LACE [--apply]   (only those types)
 */

import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import prisma from '../src/config/database';
import { BASE_MATERIAL_ROW, MASTER_CONFIG } from '../src/services/helpers/master-config';
import { syncMasterToMaterials } from '../src/services/helpers/material-sync.helper';
import { threadPackCode, threadPackLabel } from '../src/services/helpers/thread-pack.helper';

const SNAPSHOT = path.join(__dirname, 'repair-material-mirror-names-snapshot.json');

/**
 * A name nobody chose: blank, a bare "?" / "-" / "null" / "undefined", or the dangling "→ ?" the
 * lace namer printed for a dyed lace with no style yet.
 */
const PLACEHOLDER_NAMES = [/→\s*\?/, /^\s*$/, /^\s*(\?+|-+|null|undefined|n\/a)\s*$/i];
export const isPlaceholderName = (name: string | null | undefined): boolean =>
  name == null || PLACEHOLDER_NAMES.some((re) => re.test(name));

export interface MirrorRow {
  id: string;
  code: string;
  name: string;
}

/** One master whose materials rows read something else, or whose own name is a placeholder. */
export interface MirrorDrift {
  type: string;
  masterId: string;
  code: string;
  name: string | null;
  /** The same-id materials row, when its code or name differs from the master's */
  base: MirrorRow | null;
  /** A thread's pack rows / a label's size rows that do not read what the sync writes */
  derived: MirrorRow[];
  /**
   * fix          — syncMasterToMaterials will set it right
   * placeholder  — the master's own name is unset: fix the master first
   * unreachable  — the same-id row is not the base row the sync updates by FK
   */
  status: 'fix' | 'placeholder' | 'unreachable';
  reason?: string;
  /** The master's code is already held by ANOTHER materials row: only the name can be synced */
  codeTaken: boolean;
}

export interface MirrorDriftReport {
  perType: Array<{ type: string; masters: number; drifted: number }>;
  drift: MirrorDrift[];
  /** Masters with no materials row yet (created on first stock use by ensureMaterialRecord) */
  missing: Array<{ type: string; code: string }>;
}

/** This script's own client, or the caller's (check-order-system-integrity has its own) */
type Client = PrismaClient;

/** The pack / size rows of one thread or label that do not read what syncMasterToMaterials writes. */
async function staleDerivedRows(
  client: Client,
  type: string,
  masterId: string,
  code: string,
  name: string
): Promise<MirrorRow[]> {
  if (type === 'THREAD') {
    const packs = await client.materials.findMany({
      where: { threadId: masterId, NOT: { threadPackagingType: null } },
      select: { id: true, code: true, name: true, threadPackagingType: true, threadPly: true },
    });
    return packs
      .filter(
        (p) =>
          p.name !== `${name} - ${threadPackLabel(p.threadPackagingType!, p.threadPly)}` ||
          p.code !== threadPackCode(code, p.threadPackagingType!, p.threadPly)
      )
      .map(({ id, code: c, name: n }) => ({ id, code: c, name: n }));
  }
  if (type === 'LABEL') {
    const sizes = await client.materials.findMany({
      where: { labelId: masterId, NOT: { sizeVariantId: null } },
      select: { id: true, code: true, name: true, label_size_variant: { select: { size: true } } },
    });
    // The sync renames a size row only; its code carries the size and is left as it is
    return sizes
      .filter((s) => s.label_size_variant && s.name !== `${name} - Size ${s.label_size_variant.size}`)
      .map(({ id, code: c, name: n }) => ({ id, code: c, name: n }));
  }
  return [];
}

/** Every master (all MASTER_CONFIG types) whose materials rows disagree with it. Read-only. */
export async function findMirrorDrift(client: Client = prisma): Promise<MirrorDriftReport> {
  const report: MirrorDriftReport = { perType: [], drift: [], missing: [] };

  for (const [type, config] of Object.entries(MASTER_CONFIG)) {
    const masters: Array<Record<string, string | null> & { id: string }> = await (client as any)[
      config.table
    ].findMany({
      select: { id: true, [config.codeField]: true, [config.nameField]: true },
      orderBy: { [config.codeField]: 'asc' },
    });
    const mirrors: any[] = await client.materials.findMany({
      where: { id: { in: masters.map((m) => m.id) } },
      select: {
        id: true,
        code: true,
        name: true,
        [config.fkField]: true,
        sizeVariantId: true,
        threadPackagingType: true,
      } as any,
    });
    const mirrorById = new Map(mirrors.map((m) => [m.id as string, m]));

    let drifted = 0;
    for (const master of masters) {
      const code = master[config.codeField] as string;
      const name = master[config.nameField];
      const mirror = mirrorById.get(master.id);
      if (!mirror) {
        report.missing.push({ type, code });
        continue;
      }
      const baseDiffers = mirror.code !== code || mirror.name !== name;
      const base: MirrorRow | null = baseDiffers ? { id: mirror.id, code: mirror.code, name: mirror.name } : null;
      const entry = { type, masterId: master.id, code, name, base, codeTaken: false };

      if (isPlaceholderName(name)) {
        drifted++;
        report.drift.push({ ...entry, derived: [], status: 'placeholder', reason: 'master name needs fixing first' });
        continue;
      }

      const derived = await staleDerivedRows(client, type, master.id, code, name!);
      if (!baseDiffers && derived.length === 0) continue;
      drifted++;

      // syncMasterToMaterials finds the row by its FK, base rows only. A same-id row it cannot reach
      // would be reported fixed and stay stale — list it instead.
      const reachable =
        mirror[config.fkField] === master.id &&
        mirror.sizeVariantId === BASE_MATERIAL_ROW.sizeVariantId &&
        mirror.threadPackagingType === BASE_MATERIAL_ROW.threadPackagingType;
      if (!reachable) {
        report.drift.push({
          ...entry,
          derived,
          status: 'unreachable',
          reason: `materials.${config.fkField} = ${mirror[config.fkField] ?? 'NULL'}, not this master's base row`,
        });
        continue;
      }

      const codeTaken =
        mirror.code !== code && (await client.materials.count({ where: { code, NOT: { id: master.id } } })) > 0;
      report.drift.push({ ...entry, derived, status: 'fix', codeTaken });
    }
    report.perType.push({ type, masters: masters.length, drifted });
  }

  return report;
}

async function main() {
  const apply = process.argv.includes('--apply');
  // --types=GREIGE,LACE limits the repair to those master types (the report still lists every type)
  const typesArg = process.argv.find((a) => a.startsWith('--types='));
  const onlyTypes = typesArg ? typesArg.slice('--types='.length).split(',').map((t) => t.trim().toUpperCase()) : null;
  const { perType, drift: allDrift, missing } = await findMirrorDrift();
  const drift = onlyTypes ? allDrift.filter((d) => onlyTypes.includes(d.type)) : allDrift;
  if (onlyTypes) console.log(`
Limited to: ${onlyTypes.join(', ')}`);
  const fixes = drift.filter((d) => d.status === 'fix');
  const renames = fixes.filter((d) => d.base);
  const derivedOnly = fixes.filter((d) => !d.base);
  const placeholders = drift.filter((d) => d.status === 'placeholder');
  const unreachable = drift.filter((d) => d.status === 'unreachable');

  console.log(`\n${apply ? 'APPLY' : 'DRY RUN'} — materials rows whose name/code differs from their master\n`);
  for (const t of perType.filter((x) => x.masters > 0)) {
    console.log(`  ${t.type.padEnd(18)} ${String(t.drifted).padStart(4)} of ${String(t.masters).padStart(4)} masters`);
  }

  if (renames.length > 0) console.log(`\nTo rename — ${renames.length} (code · materials name now → master name):`);
  for (const f of renames) {
    const base = f.base!;
    const codeNote =
      base.code !== f.code ? `  [code ${base.code} → ${f.code}${f.codeTaken ? ': TAKEN, name only' : ''}]` : '';
    const derivedNote = f.derived.length ? `  [+${f.derived.length} pack/size row(s)]` : '';
    console.log(`  ${f.type.padEnd(8)} ${f.code.padEnd(12)} "${base.name}" → "${f.name}"${codeNote}${derivedNote}`);
  }

  if (derivedOnly.length > 0) {
    console.log(`\nSize / pack rows only — the base row is right (${derivedOnly.length} master(s)):`);
    for (const f of derivedOnly) {
      const sample = f.derived[0];
      const suffix = f.type === 'LABEL' ? ' - Size <size>' : ' - <pack>';
      console.log(
        `  ${f.type.padEnd(8)} ${f.code.padEnd(12)} ${f.derived.length} row(s), e.g. ${sample.code} "${sample.name}" → "${f.name}${suffix}"`
      );
    }
  }

  if (placeholders.length > 0) {
    console.log('\nNOT renamed — master name needs fixing first (its materials row keeps its current name):');
    for (const s of placeholders) {
      console.log(`  ${s.type.padEnd(8)} ${s.code.padEnd(12)} master "${s.name ?? ''}"  (materials: "${s.base?.name ?? s.name}")`);
    }
    console.log('  Fix: open the master, Edit, and save a real name (Lace: Save without touching the name — it is');
    console.log('  regenerated and synced). Then re-run this script.');
  }
  if (unreachable.length > 0) {
    console.log('\nNOT renamed — the same-id materials row is not the one syncMasterToMaterials updates:');
    for (const s of unreachable) console.log(`  ${s.type.padEnd(8)} ${s.code.padEnd(12)} ${s.reason}`);
  }
  if (missing.length > 0) {
    const byType = new Map<string, number>();
    for (const m of missing) byType.set(m.type, (byType.get(m.type) ?? 0) + 1);
    console.log(`\nFor information: ${missing.length} master(s) with no materials row yet (created on first stock use):`);
    for (const [type, n] of byType) console.log(`  ${type.padEnd(18)} ${n}`);
  }

  const derivedTotal = fixes.reduce((n, f) => n + f.derived.length, 0);
  console.log(
    `\n${renames.length} materials row(s) to rename, +${derivedTotal} size/pack row(s) ` +
      `(${fixes.length} master(s) to sync); ${placeholders.length} placeholder master name(s) skipped; ` +
      `${unreachable.length} unreachable.`
  );
  if (!apply) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
    return;
  }
  if (fixes.length === 0) return;

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        note: 'materials rows before repair-material-mirror-names --apply (id, code, name)',
        rows: fixes.flatMap((f) => [
          ...(f.base ? [{ type: f.type, masterId: f.masterId, ...f.base }] : []),
          ...f.derived.map((d) => ({ type: f.type, masterId: f.masterId, derived: true, ...d })),
        ]),
      },
      null,
      2
    )
  );

  // One master at a time and not in a transaction: syncMasterToMaterials logs and swallows its own
  // errors, which inside a transaction would silently abort every later statement. Each master is
  // checked afterwards by looking for its drift again.
  for (const f of fixes) {
    await syncMasterToMaterials(f.masterId, f.type, f.codeTaken ? { name: f.name! } : { name: f.name!, code: f.code });
  }
  const after = await findMirrorDrift();
  const left = after.drift.filter((d) => d.status === 'fix' && fixes.some((f) => f.masterId === d.masterId));
  for (const d of left) {
    console.log(`  STILL DIFFERENT ${d.type} ${d.code}${d.codeTaken ? ' (code taken — name only by design)' : ''}`);
  }
  console.log(`\nSynced ${fixes.length - left.length} of ${fixes.length} master(s). Snapshot: ${SNAPSHOT}`);
  if (left.some((d) => !d.codeTaken)) process.exitCode = 1;
}

// Run only when invoked directly: check-order-system-integrity imports findMirrorDrift for D25
if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
