/**
 * One-off repair: delete the blank trim masters the AI-actions registry test saved (2026-09-26).
 *
 * `ai-actions-registry.test.ts` probed every AI action's endpoint with `POST {}`, expecting a refusal.
 * Lace, Button, Zipper, Elastic, Label and Packaging ACCEPT `{}` (name optional, auto-generated), so
 * every run against the live database saved one blank record in each — 15 runs from 20-Aug to 23-Sep:
 * "LACE-00xx | Lace | Unspecified", "Button", "Zipper", "Elastic", "Label", "Packaging PKG-000x".
 * The test now probes with `[]`, which every create schema refuses.
 *
 * A row is deleted only if it carries the blank signature — the auto-generated name, every other
 * column null / false / its schema default, no creator, never edited, created 20-Aug..24-Sep — AND
 * nothing anywhere points at it: every Prisma relation of the master and of its materials rows, plus
 * a scan of every *id column and every JSON column in the database for its id. One failure refuses
 * the whole run.
 *
 * Repair path = the SANCTIONED endpoint per type, driven as the admin user against the live API:
 *   DELETE /materials/<type>/:id   (BOM guard, then its materials row(s), then the master)
 *
 *   npx ts-node scripts/repair-blank-trim-masters.ts            (dry run)
 *   npx ts-node scripts/repair-blank-trim-masters.ts --apply
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const SNAPSHOT = path.join(__dirname, 'repair-blank-trim-masters-snapshot.json');
const FROM = new Date('2026-08-20T00:00:00Z');
const TO = new Date('2026-09-24T00:00:00Z');

type Target = {
  type: string;
  model: string;
  route: string;
  codeField: string;
  nameField: string;
  blankName: (code: string) => string;
  // Relation on the master that holds its materials rows (its own identity, not a usage)
  materialsRelation: string;
};

const TARGETS: Target[] = [
  {
    type: 'LACE',
    model: 'lace_master',
    route: 'lace',
    codeField: 'laceCode',
    nameField: 'laceName',
    blankName: (c) => `${c} | Lace | Unspecified`,
    materialsRelation: 'materials',
  },
  {
    type: 'BUTTON',
    model: 'button_master',
    route: 'button',
    codeField: 'buttonCode',
    nameField: 'buttonName',
    blankName: () => 'Button',
    materialsRelation: 'materials',
  },
  {
    type: 'ZIPPER',
    model: 'zipper_master',
    route: 'zipper',
    codeField: 'zipperCode',
    nameField: 'zipperName',
    blankName: () => 'Zipper',
    materialsRelation: 'materials',
  },
  {
    type: 'ELASTIC',
    model: 'elastic_master',
    route: 'elastic',
    codeField: 'elasticCode',
    nameField: 'elasticName',
    blankName: () => 'Elastic',
    materialsRelation: 'materials',
  },
  {
    type: 'LABEL',
    model: 'label_master',
    route: 'label',
    codeField: 'labelCode',
    nameField: 'labelName',
    blankName: () => 'Label',
    materialsRelation: 'materials',
  },
  {
    type: 'PACKAGING',
    model: 'packaging_master',
    route: 'packaging',
    codeField: 'packagingCode',
    nameField: 'packagingName',
    blankName: (c) => `Packaging ${c}`,
    materialsRelation: 'materials',
  },
];

const IDENTITY_COLUMNS = new Set(['id', 'createdAt', 'updatedAt', 'isActive']);

function modelOf(name: string) {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === name);
  if (!m) throw new Error(`No Prisma model ${name}`);
  return m;
}

/** Columns that are set although the row is blank — each must be null / false / its schema default. */
function nonBlankColumns(modelName: string, row: Record<string, unknown>, t: Target): string[] {
  const bad: string[] = [];
  for (const f of modelOf(modelName).fields) {
    if (f.kind === 'object' || IDENTITY_COLUMNS.has(f.name) || f.name === t.codeField || f.name === t.nameField)
      continue;
    const v = row[f.name];
    if (v === null || v === undefined || v === false) continue;
    const def = f.hasDefaultValue && typeof f.default !== 'object' ? f.default : undefined;
    if (def !== undefined && String(v) === String(def)) continue;
    bad.push(`${f.name}=${JSON.stringify(v)}`);
  }
  return bad;
}

function listRelations(modelName: string) {
  return modelOf(modelName)
    .fields.filter((f) => f.kind === 'object' && f.isList)
    .map((f) => f.name);
}

/** Every text/uuid *id column and every json column in the database, for the raw reference scan. */
async function scanColumns() {
  return prisma.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string }>>`
    SELECT c.table_name, c.column_name, c.data_type
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       AND ((c.data_type IN ('text', 'character varying', 'uuid') AND lower(c.column_name) LIKE '%id')
            OR c.data_type IN ('json', 'jsonb'))`;
}

async function api(method: string, route: string, token: string) {
  const res = await fetch(`${API}${route}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

async function main() {
  const found: Array<{ t: Target; row: any; materials: any[] }> = [];
  let refused = false;

  for (const t of TARGETS) {
    const delegate = (prisma as any)[t.model];
    const candidates: any[] = await delegate.findMany({
      where: { createdAt: { gte: FROM, lt: TO } },
      orderBy: { [t.codeField]: 'asc' },
    });
    const blanks = candidates.filter((r) => r[t.nameField] === t.blankName(r[t.codeField]));
    console.log(`\n${t.type}: ${blanks.length} blank candidate(s)`);

    const relations = listRelations(t.model);
    for (const row of blanks) {
      const counted = await delegate.findUnique({
        where: { id: row.id },
        select: { _count: { select: Object.fromEntries(relations.map((r) => [r, true])) } },
      });
      const materials = await prisma.materials.findMany({
        where: { OR: [{ id: row.id }, { [`${t.route}Id`]: row.id }] },
      });
      const matRelations = listRelations('materials');
      const matRefs: string[] = [];
      for (const m of materials) {
        const c: any = await prisma.materials.findUnique({
          where: { id: m.id },
          select: { _count: { select: Object.fromEntries(matRelations.map((r) => [r, true])) } },
        });
        for (const [k, n] of Object.entries(c._count)) if ((n as number) > 0) matRefs.push(`materials.${k}=${n}`);
      }
      const masterRefs = Object.entries(counted._count)
        .filter(([k, n]) => (n as number) > 0 && k !== t.materialsRelation)
        .map(([k, n]) => `${k}=${n}`);
      const setCols = nonBlankColumns(t.model, row, t);
      const checks: Array<[string, boolean]> = [
        [`every other column is empty${setCols.length ? ` (set: ${setCols.join(', ')})` : ''}`, setCols.length === 0],
        ['never edited', row.updatedAt.getTime() - row.createdAt.getTime() < 5000],
        [`no master relation in use${masterRefs.length ? ` (${masterRefs.join(', ')})` : ''}`, masterRefs.length === 0],
        [`no materials relation in use${matRefs.length ? ` (${matRefs.join(', ')})` : ''}`, matRefs.length === 0],
      ];
      const failed = checks.filter(([, ok]) => !ok);
      console.log(
        `  ${failed.length ? 'FAIL' : 'ok  '} ${row[t.codeField]}  ${JSON.stringify(row[t.nameField])}  ` +
          `${row.createdAt.toISOString().slice(0, 19)}  materials rows: ${materials.length}` +
          (failed.length ? `\n         ${failed.map(([l]) => l).join('\n         ')}` : '')
      );
      if (failed.length) refused = true;
      else found.push({ t, row, materials });
    }
  }

  // Raw scan: anything in any table that still names one of these ids, beyond the rows themselves
  const ids = found.map((f) => f.row.id);
  const ownRows = new Set<string>(); // "table.column" pairs that legitimately hold the id
  for (const { t } of found) {
    ownRows.add(`${t.model}.id`);
    ownRows.add(`materials.id`);
    ownRows.add(`materials.${t.route}Id`);
  }
  const strays: string[] = [];
  if (ids.length) {
    for (const col of await scanColumns()) {
      const key = `${col.table_name}.${col.column_name}`;
      if (ownRows.has(key)) continue;
      const q =
        col.data_type === 'json' || col.data_type === 'jsonb'
          ? `SELECT count(*)::int n FROM "${col.table_name}" WHERE "${col.column_name}"::text LIKE ANY($1)`
          : `SELECT count(*)::int n FROM "${col.table_name}" WHERE "${col.column_name}"::text = ANY($1)`;
      const arg = col.data_type === 'json' || col.data_type === 'jsonb' ? ids.map((id) => `%${id}%`) : ids;
      const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(q, arg);
      if (n > 0) strays.push(`${key}=${n}`);
    }
    console.log(
      `\nRaw scan of every *id and JSON column: ${strays.length ? `FOUND ${strays.join(', ')}` : 'no other reference'}`
    );
  }

  if (refused || strays.length) throw new Error('A row is not in the expected state — refusing to touch any of them.');
  console.log(`\n${found.length} blank record(s) qualify.`);
  if (found.length === 0) return;
  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to delete them via the live API.');
    return;
  }

  const previous = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : null;
  const runs = previous?.runs ?? [];
  runs.push({
    takenAt: new Date().toISOString(),
    rows: found.map((f) => ({ type: f.t.type, master: f.row, materials: f.materials })),
  });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ runs }, null, 2));
  console.log(`Snapshot written: ${SNAPSHOT}`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });
  console.log(`Acting as ${admin.email} (${admin.role})`);

  let removed = 0;
  for (const { t, row, materials } of found) {
    await api('DELETE', `/materials/${t.route}/${row.id}`, token);
    const masterGone = !(await (prisma as any)[t.model].findUnique({ where: { id: row.id } }));
    const matLeft = await prisma.materials.count({ where: { id: { in: materials.map((m) => m.id) } } });
    const ok = masterGone && matLeft === 0;
    if (ok) removed++;
    console.log(
      `  ${t.type} ${row[t.codeField]}: ${ok ? 'removed' : `STILL PRESENT (master ${!masterGone}, materials ${matLeft})`}`
    );
  }
  console.log(`\nRemoved ${removed} of ${found.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
