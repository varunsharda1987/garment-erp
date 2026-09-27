/**
 * Regenerate lace master names with the ONE naming rule (helpers/lace-name.helper.ts), then carry each
 * new name to its materials mirror (materials.id === lace_master.id) via syncMasterToMaterials.
 *
 * Why (2026-09-27): the rule left out the lace's design ("Scallop", "Triangle", "Kingri") although the
 * form promised a name "from color, design, composition". The mirrors still held the older hand-made
 * names that carried the design, so syncing them to the design-less master names would have dropped the
 * words people use. The owner asked for the design in the name; this rebuilds the generated names with
 * it. LACE-0010 still stored the retired "LACE-0009 → ?" placeholder; it is rebuilt the same way.
 *
 * Only names this rule produced ("{laceCode} | …") are rebuilt. A name a person typed (e.g.
 * "Golden Samosa Gota Patti Lace") is left alone and listed.
 *
 *   npx ts-node scripts/regenerate-lace-names.ts           (dry run — nothing written)
 *   npx ts-node scripts/regenerate-lace-names.ts --apply   (snapshot, then write + sync)
 *   add --except=LACE-0003 to leave named laces untouched
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { generateLaceName, isGeneratedLaceName } from '../src/services/helpers/lace-name.helper';
import { syncMasterToMaterials } from '../src/services/helpers/material-sync.helper';

function snapshotPath(): string {
  const base = path.join(__dirname, 'regenerate-lace-names-snapshot');
  let file = `${base}.json`;
  for (let n = 2; fs.existsSync(file); n++) file = `${base}-${n}.json`;
  return file;
}

async function main() {
  const apply = process.argv.includes('--apply');
  // --except=LACE-0003,… leaves those laces as they are (e.g. a design still to be confirmed)
  const exceptArg = process.argv.find((x) => x.startsWith('--except='));
  const except = new Set(exceptArg ? exceptArg.slice('--except='.length).split(',').map((c) => c.trim()) : []);
  const laces = await prisma.lace_master.findMany({
    select: {
      id: true,
      laceCode: true,
      laceName: true,
      laceType: true,
      design: true,
      composition: true,
      width: true,
      color: true,
      isGreige: true,
      sourceGreigeLaceId: true,
      processedForStyleCode: true,
    },
    orderBy: { laceCode: 'asc' },
  });
  const codeById = new Map(laces.map((l) => [l.id, l.laceCode]));
  const mirrors = new Map(
    (
      await prisma.materials.findMany({
        where: { id: { in: laces.map((l) => l.id) } },
        select: { id: true, name: true },
      })
    ).map((m) => [m.id, m.name])
  );

  const changes: { id: string; laceCode: string; from: string; to: string; mirror: string | null }[] = [];
  const typed: { laceCode: string; name: string }[] = [];
  for (const l of laces) {
    if (except.has(l.laceCode)) continue;
    if (!isGeneratedLaceName(l.laceCode, l.laceName)) {
      typed.push({ laceCode: l.laceCode, name: l.laceName });
      continue;
    }
    const to = await generateLaceName({
      laceCode: l.laceCode,
      laceType: l.laceType,
      design: l.design,
      composition: l.composition,
      width: l.width ? Number(l.width) : null,
      color: l.isGreige ? null : l.color,
      isGreige: l.isGreige,
      sourceGreigeLaceCode: l.sourceGreigeLaceId ? (codeById.get(l.sourceGreigeLaceId) ?? null) : null,
      processedForStyleCode: l.processedForStyleCode,
    });
    const mirror = mirrors.get(l.id) ?? null;
    if (to !== l.laceName || (mirror !== null && mirror !== to)) {
      changes.push({ id: l.id, laceCode: l.laceCode, from: l.laceName, to, mirror });
    }
  }

  console.log(`\n${apply ? 'APPLY' : 'DRY RUN'} — lace names rebuilt with the design\n`);
  for (const c of changes) {
    console.log(`  ${c.laceCode.padEnd(16)} "${c.from}"`);
    console.log(`  ${''.padEnd(16)} → "${c.to}"${c.mirror !== null && c.mirror !== c.from ? `   (materials now: "${c.mirror}")` : ''}`);
  }
  if (typed.length) {
    console.log(`\nLeft alone — typed by a person, not generated (${typed.length}):`);
    for (const t of typed) console.log(`  ${t.laceCode.padEnd(16)} "${t.name}"`);
  }
  console.log(`\n${changes.length} lace(s) to rename; ${typed.length} typed name(s) left alone.`);
  if (!apply) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
    return;
  }
  if (changes.length === 0) return;

  const snapshot = snapshotPath();
  fs.writeFileSync(
    snapshot,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        note: 'lace_master.laceName and materials.name before regenerate-lace-names --apply',
        rows: changes.map((c) => ({ id: c.id, laceCode: c.laceCode, laceName: c.from, materialsName: c.mirror })),
      },
      null,
      2
    )
  );

  // One lace at a time, not in a transaction: syncMasterToMaterials logs and swallows its own errors,
  // which inside a transaction would silently abort every later statement.
  for (const c of changes) {
    await prisma.lace_master.update({ where: { id: c.id }, data: { laceName: c.to } });
    await syncMasterToMaterials(c.id, 'LACE', { name: c.to });
  }
  const after = await prisma.materials.findMany({
    where: { id: { in: changes.map((c) => c.id) } },
    select: { id: true, name: true },
  });
  const left = changes.filter((c) => after.find((m) => m.id === c.id)?.name !== c.to && mirrors.has(c.id));
  for (const c of left) console.log(`  STILL DIFFERENT materials row for ${c.laceCode}`);
  console.log(`\nRenamed ${changes.length} lace(s); ${changes.length - left.length} mirror(s) in step. Snapshot: ${snapshot}`);
  if (left.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
