/**
 * Repair cost-sheet fabric lines that are linked to each other's CAD rows (2026-09-30).
 *
 * A cost sheet ties each fabric line to the CAD row it was costed from (fabricCADId, on the
 * relational item AND on the sheet's JSON line). The page did not send that id, so the server
 * guessed by name and width; two CAD rows of one greige at one width tie, and the guess can cross
 * them. SP27CK130 (EBEW-002): the "Combined: Kurta, Pallazo" 2.46 m line was tied to the 0.46 m
 * row and the 0.46 m line to the Combined row. Metres and rates stay each line's own (they come
 * from the JSON), but the drift check, Correct CAD and the Order BOM follow the tie.
 *
 * A crossed PAIR is two items on one sheet where each item's metres equal the OTHER item's CAD
 * average (and not its own). The fix swaps the two ties: fabricCADId and every column the save
 * copied from the CAD row (the create/update item builders in styleCosting.controller.ts) — so each
 * line ends with exactly what it would have got from its own row at save time — re-derives
 * effectiveCad / totalCost from the line's own metres and rate, and swaps the JSON lines' ids.
 * No metres, rates or sheet totals change.
 *
 *   npx ts-node --files scripts/repair-crossed-cost-sheet-cad-links.ts                      (dry run: every crossed pair)
 *   npx ts-node --files scripts/repair-crossed-cost-sheet-cad-links.ts --sheet <id> --apply (one sheet)
 *   npx ts-node --files scripts/repair-crossed-cost-sheet-cad-links.ts --apply              (every pair listed)
 */

import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';
import prisma from '../src/config/database';
import { roundToCent } from '../src/utils/currency';

const APPLY = process.argv.includes('--apply');
const sheetArg = process.argv.indexOf('--sheet');
const ONLY_SHEET = sheetArg >= 0 ? process.argv[sheetArg + 1] : undefined;
const SNAPSHOT = path.join(__dirname, `repair-crossed-cost-sheet-cad-links-snapshot-${Date.now()}.json`);

/** cadMeters and cadAverage are both 4-decimal columns */
const sameMetres = (a: unknown, b: unknown) =>
  a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.00005;

/** Item columns the save copies from the paired CAD row (never from the line). */
const CAD_DERIVED = [
  'fabricCADId',
  'fabricId',
  'greigeId',
  'colorName',
  'width',
  'cadWastagePercent',
  'sourcingStrategy',
  'processorId',
  'rateCardId',
  'greigeCost',
  'processingCost',
] as const;

type Item = Awaited<ReturnType<typeof loadItems>>[number];
type JsonLine = Record<string, unknown>;

function loadItems() {
  return prisma.style_costing_fabric_items.findMany({
    where: { fabricCADId: { not: null }, ...(ONLY_SHEET && { costingId: ONLY_SHEET }) },
    include: { fabricCAD: { select: { cadAverage: true, componentName: true } } },
    orderBy: [{ costingId: 'asc' }, { id: 'asc' }],
  });
}

/** The JSON line an item was built from: same name and metres, tied to the item's CAD row (or untied). */
function jsonLineOf(lines: JsonLine[], item: Item): number[] {
  return lines
    .map((l, i) => ({ l, i }))
    .filter(
      ({ l }) =>
        l.fabricName === item.fabricName &&
        sameMetres(l.fabricAverage, item.cadMeters) &&
        (l.fabricCADId === item.fabricCADId || l.fabricCADId == null)
    )
    .map(({ i }) => i);
}

async function main() {
  const items = await loadItems();
  const bySheet = new Map<string, Item[]>();
  for (const it of items) bySheet.set(it.costingId, [...(bySheet.get(it.costingId) ?? []), it]);

  const pairs: Array<{ sheetId: string; a: Item; b: Item }> = [];
  for (const [sheetId, list] of bySheet) {
    for (const a of list) {
      for (const b of list) {
        if (a.id >= b.id || !a.fabricCAD || !b.fabricCAD) continue;
        const crossed =
          sameMetres(a.cadMeters, b.fabricCAD.cadAverage) &&
          sameMetres(b.cadMeters, a.fabricCAD.cadAverage) &&
          !sameMetres(a.cadMeters, b.cadMeters) &&
          !sameMetres(a.cadMeters, a.fabricCAD.cadAverage);
        if (crossed) pairs.push({ sheetId, a, b });
      }
    }
  }

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — cost-sheet fabric lines tied to each other's CAD rows${ONLY_SHEET ? ` (sheet ${ONLY_SHEET})` : ''}:`);
  if (pairs.length === 0) console.log('  none');

  const sheets = await prisma.style_costing.findMany({
    where: { id: { in: [...new Set(pairs.map((p) => p.sheetId))] } },
    select: {
      id: true,
      purpose: true,
      version: true,
      approvalStatus: true,
      fabricDetails: true,
      styles: { select: { styleCode: true, buyerStyleRef: true } },
    },
  });
  const sheetById = new Map(sheets.map((s) => [s.id, s]));

  const plan: Array<{ sheetId: string; a: Item; b: Item; jsonA: number; jsonB: number }> = [];
  for (const p of pairs) {
    const sheet = sheetById.get(p.sheetId)!;
    const lines = (Array.isArray(sheet.fabricDetails) ? sheet.fabricDetails : []) as JsonLine[];
    const ja = jsonLineOf(lines, p.a);
    const jb = jsonLineOf(lines, p.b);
    const style = sheet.styles?.buyerStyleRef || sheet.styles?.styleCode;
    const orderBoms = await prisma.order_bom.count({ where: { sourceCostSheetId: p.sheetId } });
    console.log(
      `  ${style}  ${sheet.purpose} v${sheet.version} ${sheet.approvalStatus}  ${p.sheetId}${orderBoms ? `  (${orderBoms} order BOM(s))` : ''}\n` +
        `     "${p.a.fabricName}" ${Number(p.a.cadMeters)} m  is tied to the ${Number(p.a.fabricCAD!.cadAverage)} m row\n` +
        `     "${p.b.fabricName}" ${Number(p.b.cadMeters)} m  is tied to the ${Number(p.b.fabricCAD!.cadAverage)} m row`
    );
    if (ja.length !== 1 || jb.length !== 1) {
      console.log(`     LEFT AS IS — the sheet's own lines could not be told apart (${ja.length}/${jb.length} candidates)`);
      continue;
    }
    plan.push({ ...p, jsonA: ja[0], jsonB: jb[0] });
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${plan.length} pair(s) would be untangled. Re-run with --apply (optionally --sheet <id>).`);
    return;
  }
  if (plan.length === 0) return;

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        sheets: [...new Set(plan.map((p) => p.sheetId))].map((id) => ({ id, fabricDetails: sheetById.get(id)!.fabricDetails })),
        items: plan.flatMap((p) => [p.a, p.b]),
      },
      null,
      2
    )
  );

  await prisma.$transaction(async (tx) => {
    const lineUpdates = new Map<string, JsonLine[]>();
    for (const { sheetId, a, b, jsonA, jsonB } of plan) {
      for (const [item, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const data: Record<string, unknown> = {};
        for (const col of CAD_DERIVED) data[col] = other[col];
        const effectiveCad = Number(item.cadMeters) * (1 + Number(other.cadWastagePercent ?? 0) / 100);
        data.effectiveCad = effectiveCad;
        data.totalCost = roundToCent(effectiveCad * Number(item.costPerMeter)).toNumber();
        await tx.style_costing_fabric_items.update({
          where: { id: item.id },
          data: data as Prisma.style_costing_fabric_itemsUncheckedUpdateInput,
        });
      }
      const lines =
        lineUpdates.get(sheetId) ??
        ((sheetById.get(sheetId)!.fabricDetails as unknown as JsonLine[]).map((l) => ({ ...l })) as JsonLine[]);
      lines[jsonA] = { ...lines[jsonA], fabricCADId: b.fabricCADId };
      lines[jsonB] = { ...lines[jsonB], fabricCADId: a.fabricCADId };
      lineUpdates.set(sheetId, lines);
    }
    for (const [sheetId, lines] of lineUpdates) {
      await tx.style_costing.update({
        where: { id: sheetId },
        data: { fabricDetails: lines as unknown as Prisma.InputJsonValue },
      });
    }
  });

  console.log(`\nApplied — ${plan.length} pair(s) untangled. Snapshot: ${SNAPSHOT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
