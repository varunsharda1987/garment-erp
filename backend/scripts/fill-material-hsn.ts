/**
 * Give every active material its 6-digit HSN code (2026-09-28).
 *
 * None of the active materials carried an HSN code or a GST rate, and tax_masters is empty, so every PO
 * line was taxed at gst.service's last-resort 5% — buttons, zippers, poly bags and cartons included,
 * which are 18% in our own HSN master. The owner: the code must be 6 digits, and a new material must
 * carry one. The rule that picks the code lives in ONE place, services/helpers/material-hsn.helper.ts
 * (the Material form's create path calls the same rule); this script runs it over what is already there.
 *
 * Owner decision (28-Sep-2026): the table comes FIRST and nothing is written until the owner /
 * accountant has read it. So the dry run is the deliverable: per material, the proposed 6-digit code,
 * the rate it will get, and the evidence it came from (label type, composition, GSM, dyed / printed …).
 * A material with no usable evidence is listed under "Needs a person" and never guessed.
 *
 * The 6-digit codes are not in the HSN master yet (it holds 4-digit headings). --seed-codes adds every
 * code the rule can give (MATERIAL_HSN_CODES) at its heading's rate, so the HSN/SAC page lists them, the
 * Material form can pick them and the PO GST resolver matches them exactly. It refuses when a heading
 * row is missing, and never touches a row that is already there (its rate is the accountant's).
 *
 * --apply = --seed-codes, then writes materials.hsnCode ONLY (never gstRate: the rate follows from the
 * HSN master, and a material's own gstRate would override every later change to it), only on rows still
 * without one, through fillMaterialHsnIfBlank — the same writer a new material goes through. One
 * transaction, after saving the old values to fill-material-hsn-snapshot-<time>.json next to this script.
 * --only lets the owner approve one material type at a time.
 *
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts                         (dry run)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --out <file.md>         (dry run, table to <file.md>)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --only LABEL,PACKAGING  (dry run, those types)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --seed-codes            (add the 6-digit codes only)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --apply --only BUTTON   (codes + materials, after approval)
 */

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HSNSACType, MaterialType, Prisma } from '@prisma/client';
import prisma from '../src/config/database';
import {
  MATERIAL_HSN_CODES,
  fillMaterialHsnIfBlank,
  loadMaterialHsnFacts,
  proposeMaterialHsn,
} from '../src/services/helpers/material-hsn.helper';
import { formatDateTime24 } from '../src/utils/date';

const APPLY = process.argv.includes('--apply');
const SEED = APPLY || process.argv.includes('--seed-codes');

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const OUT = argValue('--out') ?? path.join(os.tmpdir(), 'fill-material-hsn-dry-run.md');
const ONLY: MaterialType[] | null = (() => {
  const raw = argValue('--only');
  if (raw === null) return null;
  const types = raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  const unknown = types.filter((t) => !(t in MaterialType));
  if (unknown.length > 0 || types.length === 0) {
    throw new Error(`--only takes material types, e.g. --only LABEL,PACKAGING (unknown: ${unknown.join(', ') || 'none given'})`);
  }
  return types as MaterialType[];
})();

interface Line {
  id: string;
  code: string;
  name: string;
  type: MaterialType;
  hsn: string | null;
  rate: number | null;
  reason: string;
  detail: string;
}

const join = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join('; ');

// ─── HSN master: what is there, what seeding would add ──────────────────────────────────────────

interface HsnRow {
  code: string;
  section: string | null;
  unit: string | null;
  rate: Prisma.Decimal;
  isActive: boolean;
}

interface SeedPlan {
  /** Codes the rule can give that the HSN master does not have yet, with the heading row they copy */
  toAdd: Array<{ code: string; heading: HsnRow; description: string }>;
  present: string[];
  /** Present but switched off — fillMaterialHsnIfBlank will not use them until someone switches them back on */
  inactive: string[];
  /** Headings with no active row: seeding refuses */
  missingHeadings: string[];
}

function planSeed(master: Map<string, HsnRow>): SeedPlan {
  const plan: SeedPlan = { toAdd: [], present: [], inactive: [], missingHeadings: [] };
  for (const c of MATERIAL_HSN_CODES) {
    const own = master.get(c.code);
    if (own) {
      plan.present.push(c.code);
      if (!own.isActive) plan.inactive.push(c.code);
      continue;
    }
    const heading = master.get(c.heading);
    if (!heading || !heading.isActive) {
      if (!plan.missingHeadings.includes(c.heading)) plan.missingHeadings.push(c.heading);
      continue;
    }
    plan.toAdd.push({ code: c.code, heading, description: c.description });
  }
  return plan;
}

/** The rate a code gets: its own row once seeded, else the heading row it will be seeded from (gst.service's order). */
function codeRate(code: string, master: Map<string, HsnRow>): { rate: number; note: string | null } | null {
  const own = master.get(code);
  if (own) return { rate: Number(own.rate), note: own.isActive ? null : `${code} is switched off on HSN/SAC Codes` };
  const heading = master.get(code.slice(0, 4));
  if (heading?.isActive) return { rate: Number(heading.rate), note: `new code — added at heading ${code.slice(0, 4)}'s rate` };
  return null;
}

// ─── Output ─────────────────────────────────────────────────────────────────────────────────────

const pct = (rate: number | null) => (rate === null ? '—' : `${rate}%`);
const md = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function mdTable(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(md).join(' | ')} |`),
  ].join('\n');
}

function textTable(head: string[], rows: string[][]): string {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

async function main() {
  const materials = await prisma.materials.findMany({
    where: {
      isActive: true,
      OR: [{ hsnCode: null }, { hsnCode: '' }],
      ...(ONLY ? { materialType: { in: ONLY } } : {}),
    },
    select: { id: true, code: true, hsnCode: true, gstRate: true },
    orderBy: { code: 'asc' },
  });
  const facts = await loadMaterialHsnFacts(materials.map((m) => m.id));

  const master = new Map<string, HsnRow>(
    (
      await prisma.hsn_sac_masters.findMany({
        select: { code: true, section: true, unit: true, defaultGstRate: true, isActive: true },
      })
    ).map((h) => [h.code, { code: h.code, section: h.section, unit: h.unit, rate: h.defaultGstRate, isActive: h.isActive }])
  );
  const plan = planSeed(master);

  // What these lines are taxed at today: no HSN → tax_masters → gst.service's last resort
  const now = new Date();
  const taxMaster = await prisma.tax_masters.findFirst({
    where: { taxType: 'GST', isActive: true, applicableFrom: { lte: now }, OR: [{ applicableTo: null }, { applicableTo: { gte: now } }] },
    orderBy: { taxRate: 'asc' },
  });
  const rateToday = taxMaster ? `${Number(taxMaster.taxRate)}% (tax_masters ${taxMaster.taxCode})` : '5% (gst.service last resort — tax_masters is empty)';

  const lines: Line[] = [];
  for (const mat of materials) {
    const f = facts.get(mat.id);
    if (!f) continue;
    const p = proposeMaterialHsn(f);
    let hsn = p.code;
    let reason = p.reason;
    let detail = p.evidence ?? '';
    let rate: number | null = null;
    if (hsn) {
      const found = codeRate(hsn, master);
      if (!found) {
        reason = `${reason} — but heading ${hsn.slice(0, 4)} is not in the HSN master (add it on HSN/SAC Codes, then re-run)`;
        hsn = null;
      } else {
        rate = found.rate;
        detail = join(detail, found.note);
      }
    }
    // A material's own GST rate beats its HSN (gst.service step 2) — say so rather than print a rate it will not get
    if (mat.gstRate !== null) {
      detail = join(detail, `the material's own GST rate ${Number(mat.gstRate)}% applies, not the HSN's`);
      rate = Number(mat.gstRate);
    }
    lines.push({ id: mat.id, code: f.code, name: f.name, type: f.materialType, hsn, rate, reason, detail });
  }

  // Summary: type | proposed HSN | rate | count | reason — biggest types first
  const typeCount = new Map<string, number>();
  for (const l of lines) typeCount.set(l.type, (typeCount.get(l.type) ?? 0) + 1);
  const groups = new Map<string, { type: string; hsn: string; rate: string; count: number; reason: string }>();
  for (const l of lines) {
    const key = `${l.type}\u0000${l.hsn ?? ''}\u0000${l.reason}`;
    const g = groups.get(key) ?? { type: l.type, hsn: l.hsn ?? '—', rate: pct(l.rate), count: 0, reason: l.reason };
    g.count += 1;
    groups.set(key, g);
  }
  const summary = Array.from(groups.values()).sort(
    (a, b) =>
      (typeCount.get(b.type) ?? 0) - (typeCount.get(a.type) ?? 0) || a.type.localeCompare(b.type) || b.count - a.count || a.hsn.localeCompare(b.hsn)
  );
  const summaryHead = ['Type', 'HSN', 'Rate', 'Count', 'Reason'];
  const summaryRows = summary.map((g) => [g.type, g.hsn, g.rate, String(g.count), g.reason]);

  const byTypeThenCode = (a: Line, b: Line) =>
    (typeCount.get(b.type) ?? 0) - (typeCount.get(a.type) ?? 0) || a.type.localeCompare(b.type) || a.code.localeCompare(b.code);
  const proposed = lines.filter((l) => l.hsn);
  const unproposed = lines.filter((l) => !l.hsn).sort(byTypeThenCode);
  const rateCounts = new Map<string, number>();
  for (const l of proposed) rateCounts.set(pct(l.rate), (rateCounts.get(pct(l.rate)) ?? 0) + 1);
  const rateLine = Array.from(rateCounts.entries())
    .sort()
    .map(([r, n]) => `${n} at ${r}`)
    .join(', ');

  const usedBy = new Map<string, number>();
  for (const l of proposed) usedBy.set(l.hsn as string, (usedBy.get(l.hsn as string) ?? 0) + 1);
  const seedLine =
    `${MATERIAL_HSN_CODES.length} codes the rule can give: ${plan.present.length} already on HSN/SAC Codes, ${plan.toAdd.length} to add` +
    (plan.missingHeadings.length > 0 ? `; headings MISSING (seeding refuses until they are added): ${plan.missingHeadings.join(', ')}` : '') +
    (plan.inactive.length > 0 ? `; switched off: ${plan.inactive.join(', ')}` : '');

  const report = [
    '# HSN dry run — proposed 6-digit codes for materials with none',
    '',
    `Generated on ${formatDateTime24(now)} by \`backend/scripts/fill-material-hsn.ts\`${ONLY ? ` (--only ${ONLY.join(',')})` : ''}. **Nothing has been written.**`,
    '',
    `- ${lines.length} active material(s) have no HSN code. Today every PO line for them is taxed at ${rateToday}.`,
    `- A 6-digit code is proposed for ${proposed.length} (${rateLine || 'none'}); ${unproposed.length} need a person.`,
    '- The rule is `backend/src/services/helpers/material-hsn.helper.ts`; where the master could not decide between two subheadings the reason says what was assumed.',
    `- Rate = the HSN master's rate for the code; a code not there yet is added at its 4-digit heading's rate (${seedLine}).`,
    '- Applying writes the HSN code only; the rate follows from the HSN master.',
    '',
    '## Summary by material type',
    '',
    mdTable(summaryHead, summaryRows),
    '',
    `## Needs a person (${unproposed.length})`,
    '',
    unproposed.length > 0
      ? mdTable(['Code', 'Name', 'Type', 'Why', 'Evidence'], unproposed.map((l) => [l.code, l.name, l.type, l.reason, l.detail || '—']))
      : 'None.',
    '',
    `## Every material (${lines.length})`,
    '',
    mdTable(
      ['Code', 'Name', 'Type', 'HSN', 'Rate', 'Reason'],
      [...lines].sort(byTypeThenCode).map((l) => [l.code, l.name, l.type, l.hsn ?? '—', pct(l.rate), join(l.reason, l.detail)])
    ),
    '',
    `## Codes --seed-codes adds to HSN/SAC Codes (${plan.toAdd.length})`,
    '',
    plan.toAdd.length > 0
      ? mdTable(
          ['Code', 'Heading', 'Rate', 'Used by', 'Description'],
          plan.toAdd.map((c) => [c.code, c.heading.code, `${Number(c.heading.rate)}%`, String(usedBy.get(c.code) ?? 0), c.description])
        )
      : 'None — every code is already there.',
    '',
    '## To apply (after approval)',
    '',
    '`cd backend && npx ts-node scripts/fill-material-hsn.ts --apply` (or type by type: `--apply --only BUTTON,ZIPPER`). It adds the',
    'codes above to HSN/SAC Codes, then writes the HSN code on rows that still have none, in one transaction, and saves the old',
    'values to `backend/scripts/fill-material-hsn-snapshot-<time>.json` first.',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, report);

  console.log(`\n${lines.length} active material(s) without an HSN code. Today their PO lines are taxed at ${rateToday}.\n`);
  console.log(textTable(summaryHead, summaryRows));
  console.log(`\nProposed: ${proposed.length} (${rateLine || 'none'}). Needs a person: ${unproposed.length}.`);
  console.log(seedLine);
  console.log(`Full table (summary, needs a person, every material, codes to add): ${OUT}`);

  if (!SEED) {
    console.log('\nDry run — nothing written. After approval: --seed-codes, or --apply [--only TYPE,...]');
    return;
  }
  if (plan.missingHeadings.length > 0) {
    throw new Error(
      `Refused: heading row(s) ${plan.missingHeadings.join(', ')} are not on HSN/SAC Codes (or switched off), so their 6-digit codes have no rate to copy. Add them first.`
    );
  }

  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const snapshot = path.join(__dirname, `fill-material-hsn-snapshot-${stamp}.json`);
  const before = new Map(materials.map((m) => [m.id, m]));
  fs.writeFileSync(
    snapshot,
    JSON.stringify(
      {
        takenAt: now.toISOString(),
        mode: APPLY ? 'apply' : 'seed-codes',
        only: ONLY,
        codesAdded: plan.toAdd.map((c) => ({ code: c.code, heading: c.heading.code, defaultGstRate: Number(c.heading.rate) })),
        rows: APPLY
          ? proposed.map((l) => ({
              id: l.id,
              code: l.code,
              materialType: l.type,
              hsnCodeBefore: before.get(l.id)?.hsnCode ?? null,
              gstRateBefore: before.get(l.id)?.gstRate == null ? null : Number(before.get(l.id)?.gstRate),
              hsnCodeProposed: l.hsn,
              reason: join(l.reason, l.detail),
            }))
          : [],
      },
      null,
      2
    )
  );

  const result = await prisma.$transaction(
    async (tx) => {
      for (const c of plan.toAdd) {
        // update: {} — a row that appeared since the read keeps its own rate and wording
        await tx.hsn_sac_masters.upsert({
          where: { code: c.code },
          create: {
            code: c.code,
            type: HSNSACType.HSN,
            description: c.description,
            chapter: c.code.slice(0, 2),
            section: c.heading.section,
            defaultGstRate: c.heading.rate,
            unit: c.heading.unit,
            isActive: true,
          },
          update: {},
        });
      }
      let written = 0;
      let kept = 0;
      if (APPLY) {
        for (const l of proposed) {
          // The same writer a new material goes through: blank rows only, codes the master has only
          const onRow = await fillMaterialHsnIfBlank(l.id, tx);
          if (onRow === l.hsn) written += 1;
          else kept += 1;
        }
      }
      return { written, kept };
    },
    { timeout: 300_000, maxWait: 30_000 }
  );

  console.log(`\nAdded ${plan.toAdd.length} code(s) to HSN/SAC Codes. Snapshot: ${snapshot}`);
  if (APPLY) {
    console.log(`Wrote the HSN code on ${result.written} of ${proposed.length} material(s).`);
    if (result.kept > 0) console.log(`${result.kept} had an HSN code by the time of writing — left as they were.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
