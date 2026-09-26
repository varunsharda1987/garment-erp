/**
 * One-off repair: give every consumption line its material's unit (2026-09-26).
 *
 * Until 2026-09-26 every trim picked on the Style form was saved `'pcs'` whatever its master was,
 * and the cost sheet, order BOM and requirement copied that forward — "Microdot Fusing" (METER)
 * read pcs on 36 style BOMs and MR2608-0111 asked for 2,300 PIECES of it. The writers now take
 * the unit from `materials.unit` (services/helpers/material-unit.helper.ts); this relabels the
 * rows written before that.
 *
 * Label only: the quantities on these rows are already in the material's unit (metres at a
 * per-metre rate), so no quantity, price or total changes. THREAD is skipped — the same rule the
 * writers use (`lineUnit`) leaves a thread line's unit untouched; its costing is not designed yet.
 *
 * The dry run doubles as the invariant sweep: after --apply it must report 0 rows.
 *
 *   npx ts-node scripts/repair-line-units.ts            (dry-run)
 *   npx ts-node scripts/repair-line-units.ts --apply
 *
 * Run --apply only AFTER the writer fix is deployed — a style re-save on the old code re-stamps 'pcs'.
 */

import fs from 'fs';
import path from 'path';
import type { Unit } from '@prisma/client';
import prisma from '../src/config/database';
import { normalizeUnit } from '../src/utils/units';
import { lineUnit, loadLineUnits } from '../src/services/helpers/material-unit.helper';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, 'repair-line-units-snapshot.json');

type Table = 'style_material_bom' | 'style_costing_trim_items' | 'order_bom_items' | 'material_requirements';

interface Fix {
  table: Table;
  id: string;
  label: string;
  materialType: string;
  before: string | null;
  after: string;
}

/** Rows whose stored unit reads differently from what the writers would store today. */
function mismatches(
  table: Table,
  rows: Array<Record<string, unknown> & { id: string; unit?: string | null; materialType?: string | null }>,
  units: Map<string, Unit>,
  label: (row: Record<string, unknown>) => string
): Fix[] {
  const fixes: Fix[] = [];
  for (const row of rows) {
    const after = lineUnit(row, units);
    const before = row.unit ?? null;
    // Same unit under another spelling ('pcs' vs PIECE) is not a mismatch; a THREAD 'lot' comes
    // back unchanged from lineUnit, so it never lands here
    if ((normalizeUnit(before) ?? before) === (normalizeUnit(after) ?? after)) continue;
    fixes.push({ table, id: row.id, label: label(row), materialType: String(row.materialType ?? '—'), before, after });
  }
  return fixes;
}

async function main() {
  const fixes: Fix[] = [];

  const styleBom = await prisma.style_material_bom.findMany({ include: { styles: { select: { styleCode: true } } } });
  fixes.push(
    ...mismatches('style_material_bom', styleBom, await loadLineUnits(styleBom), (r) => {
      const s = r.styles as { styleCode?: string } | null;
      return `${s?.styleCode ?? '?'} · ${String(r.componentName ?? '')}`;
    })
  );

  const costTrims = await prisma.style_costing_trim_items.findMany();
  fixes.push(
    ...mismatches('style_costing_trim_items', costTrims, await loadLineUnits(costTrims), (r) =>
      `sheet ${String(r.costingId).slice(0, 8)} · ${String(r.trimName ?? '')}`
    )
  );

  const orderBomItems = await prisma.order_bom_items.findMany();
  fixes.push(
    ...mismatches('order_bom_items', orderBomItems, await loadLineUnits(orderBomItems), (r) =>
      `order BOM ${String(r.orderBomId).slice(0, 8)} · ${String(r.componentName ?? '')}`
    )
  );

  // A requirement carries no materialType — read it from its material, then apply the same rule
  const requirements = await prisma.material_requirements.findMany({
    select: { id: true, requirementNumber: true, materialId: true, unit: true, materials: { select: { materialType: true } } },
  });
  const reqRows = requirements.map((r) => ({
    id: r.id,
    requirementNumber: r.requirementNumber,
    materialId: r.materialId,
    unit: r.unit as string,
    materialType: r.materials?.materialType ?? null,
  }));
  const reqFixes = mismatches('material_requirements', reqRows, await loadLineUnits(reqRows), (r) =>
    String(r.requirementNumber)
  ).filter((f) => normalizeUnit(f.after)); // the enum column only takes a stock unit
  fixes.push(...reqFixes);

  // Summary by table / type / before → after
  const groups = new Map<string, number>();
  for (const f of fixes) {
    const key = `${f.table.padEnd(26)} ${f.materialType.padEnd(12)} ${String(f.before).padEnd(6)} → ${f.after}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  for (const [key, n] of Array.from(groups.entries()).sort()) console.log(`  ${key}  ×${n}`);
  for (const f of fixes.filter((x) => x.table !== 'style_material_bom')) {
    console.log(`    ${f.table.padEnd(26)} ${f.label}  ${String(f.before)} → ${f.after}`);
  }
  console.log(`\n${fixes.length} line(s) whose unit disagrees with their material.`);
  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to write.');
    return;
  }
  if (fixes.length === 0) return;

  fs.writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: new Date().toISOString(), fixes }, null, 2));
  await prisma.$transaction(
    fixes.map((f) => {
      switch (f.table) {
        case 'style_material_bom':
          return prisma.style_material_bom.update({ where: { id: f.id }, data: { unit: f.after } });
        case 'style_costing_trim_items':
          return prisma.style_costing_trim_items.update({ where: { id: f.id }, data: { unit: f.after } });
        case 'order_bom_items':
          return prisma.order_bom_items.update({ where: { id: f.id }, data: { unit: f.after } });
        case 'material_requirements':
          return prisma.material_requirements.update({ where: { id: f.id }, data: { unit: f.after as Unit } });
      }
    })
  );
  console.log(`Relabelled ${fixes.length}. Snapshot: ${SNAPSHOT}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
