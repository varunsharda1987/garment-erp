/**
 * A label bought in sizes, as the PO form sees it.
 *
 * Each size of a label is its own materials row (`LBL-0004-XS` …, `labelId` = the label, `sizeVariantId` set),
 * besides the label's base row (id = the label). The PO form offers such a label ONCE and orders it one line
 * per size; the label set dialog orders several labels that way at once. The rules both share live here.
 */
import { compareSizes } from '@/utils/sku-generator';

/** A materials row as the PO form loads it (GET /materials). */
export interface LabelMaterialRow {
  id: string;
  code: string;
  name: string;
  labelId?: string | null;
  sizeVariantId?: string | null;
  labelSizeVariant?: { size: string } | null;
}

/** The size a materials row is for, or null for anything that is not a label's size row. */
export function sizeOf(m: LabelMaterialRow): string | null {
  return (m.sizeVariantId && m.labelSizeVariant?.size) || null;
}

/**
 * Index a material list by sized label: each label's size rows in size order, and the list a picker should
 * offer — every material, except a sized label's rows collapse into one entry (its base row when loaded,
 * else its first size row).
 */
export function indexSizedLabels<M extends LabelMaterialRow>(materials: readonly M[]) {
  const sizeRowsByLabel = new Map<string, M[]>();
  for (const m of materials) {
    if (m.labelId && sizeOf(m)) sizeRowsByLabel.set(m.labelId, [...(sizeRowsByLabel.get(m.labelId) ?? []), m]);
  }
  for (const rows of sizeRowsByLabel.values()) rows.sort((a, b) => compareSizes(sizeOf(a)!, sizeOf(b)!));
  const sizedRowsOf = (m: LabelMaterialRow) => (m.labelId ? sizeRowsByLabel.get(m.labelId) : undefined);

  const pickerMaterials: M[] = [];
  const offered = new Set<string>();
  for (const m of materials) {
    const sized = sizedRowsOf(m);
    if (!sized) {
      pickerMaterials.push(m);
    } else if (!offered.has(m.labelId!)) {
      offered.add(m.labelId!);
      pickerMaterials.push(materials.find((x) => x.id === m.labelId) ?? sized[0]);
    }
  }
  return { sizeRowsByLabel, sizedRowsOf, pickerMaterials };
}

/** A label's own code and name, from any of its rows (a size row's are "LBL-0004-XS" / "… - Size XS" or "… (XS)"). */
export function labelDisplay(m: LabelMaterialRow): { code: string; name: string } {
  const size = sizeOf(m);
  if (!size) return { code: m.code, name: m.name };
  return {
    code: m.code.endsWith(`-${size}`) ? m.code.slice(0, -(size.length + 1)) : m.code,
    name: m.name.replace(/ - Size .+$/, '').replace(/ \([^)]+\)$/, ''),
  };
}

/**
 * Set the quantities of one label's size rows on a list of lines: a size already on the list is updated in
 * place, a size set to 0 loses its line, a size never ends up on two lines, and a new size is inserted after
 * the label's last line on the list (at the end when it has none) — so a label's sizes stay together.
 */
export function mergeLabelQuantities<L extends { materialId?: string }, M extends { id: string }>(
  lines: readonly L[],
  rows: readonly M[],
  qtyByMaterialId: Record<string, number>,
  update: (line: L, qty: number) => L,
  create: (row: M, qty: number) => L
): L[] {
  const owned = new Set(rows.map((r) => r.id));
  const next: L[] = [];
  const kept = new Set<string>();
  let insertAt = -1;
  for (const line of lines) {
    if (!line.materialId || !owned.has(line.materialId)) {
      next.push(line);
      continue;
    }
    const qty = qtyByMaterialId[line.materialId] ?? 0;
    if (kept.has(line.materialId) || !(qty > 0)) continue;
    kept.add(line.materialId);
    next.push(update(line, qty));
    insertAt = next.length;
  }
  const added = rows
    .filter((r) => !kept.has(r.id) && (qtyByMaterialId[r.id] ?? 0) > 0)
    .map((r) => create(r, qtyByMaterialId[r.id]));
  if (insertAt < 0) return [...next, ...added];
  return [...next.slice(0, insertAt), ...added, ...next.slice(insertAt)];
}

/**
 * Labels needed for a number of garments: garments × labels per garment, plus the BOM's extra %, rounded UP
 * to whole pieces (computed to 3 decimals first, so 105.0000001 is 105, not 106).
 */
export function labelPieces(garments: number, qtyPerGarment: number, extraPercent: number): number {
  const exact = Math.round(garments * qtyPerGarment * (1 + (extraPercent || 0) / 100) * 1000) / 1000;
  return exact > 0 ? Math.ceil(exact) : 0;
}
