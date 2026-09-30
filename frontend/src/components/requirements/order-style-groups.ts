/**
 * Requirements as label sets: Order → Style → Label → Size.
 *
 * MRP plans a sized label as one requirement per order size-breakup row — per COLOUR × size — so a two-colour
 * order lists XS twice. For ordering, a size is one line: rows of the same material within one order + style
 * are merged into one size row (it keeps every requirement, so selecting it selects them all). The size rows
 * are then grouped by label (lib/label-lines): base / SIZE_PENDING row first, sizes in size order.
 *
 * A requirement split into a balance row (MRP-12; a PO covering part of it) keeps its whole quantity as Required
 * and the balance row repeats that part, so a row holding both counts the parent's only (design M10).
 *
 * The sets themselves come soonest-needed first (earliest required date, then order number) — the page opens on
 * this view as a to-do list (2026-09-28).
 */
import { groupLabelLines, type GroupedLine } from '@/lib/label-lines';
import { requirementLabelKey } from '@/lib/label-line-keys';
import type { MaterialRequirement } from '@/types/mrp.types';

/** One material within one order + style: its requirements (one per colour) added up. */
export interface MergedRequirementRow {
  key: string;
  materialId: string;
  requirements: MaterialRequirement[];
  totalRequired: number;
  shortfall: number;
  unit: string;
  /** The first requirement — carries the label, size, material and order fields */
  head: MaterialRequirement;
}

export interface OrderStyleGroup {
  key: string;
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  styleId: string | null;
  styleCode: string | null;
  buyerStyleRef: string | null;
  styleName: string | null;
  /** The earliest required date of any requirement in the set (ISO), or null when none has one */
  earliestRequiredDate: string | null;
  lines: GroupedLine<MergedRequirementRow>[];
  requirements: MaterialRequirement[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function groupRequirementsByOrderStyle(requirements: readonly MaterialRequirement[]): OrderStyleGroup[] {
  const groups = new Map<string, { group: OrderStyleGroup; rows: Map<string, MergedRequirementRow> }>();
  for (const r of requirements) {
    const key = `${r.orderId ?? 'no-order'}|${r.orderItem?.styleId ?? 'no-style'}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        group: {
          key,
          orderId: r.orderId,
          orderNumber: r.order?.orderNumber ?? null,
          customerName: r.order?.customerName ?? null,
          styleId: r.orderItem?.styleId ?? null,
          styleCode: r.orderItem?.styleCode ?? null,
          buyerStyleRef: r.orderItem?.buyerStyleRef ?? null,
          styleName: r.orderItem?.styleName ?? null,
          earliestRequiredDate: null,
          lines: [],
          requirements: [],
        },
        rows: new Map(),
      };
      groups.set(key, entry);
    }
    entry.group.requirements.push(r);
    if (r.requiredDate && (!entry.group.earliestRequiredDate || r.requiredDate < entry.group.earliestRequiredDate)) {
      entry.group.earliestRequiredDate = r.requiredDate;
    }
    const row = entry.rows.get(r.materialId);
    if (row) {
      row.requirements.push(r);
      row.shortfall = round3(row.shortfall + Number(r.shortfall || 0));
    } else {
      entry.rows.set(r.materialId, {
        key: `${key}|${r.materialId}`,
        materialId: r.materialId,
        requirements: [r],
        totalRequired: round3(Number(r.totalRequired || 0)),
        shortfall: round3(Number(r.shortfall || 0)),
        unit: r.unit,
        head: r,
      });
    }
  }
  for (const { rows } of groups.values()) {
    for (const row of rows.values()) row.totalRequired = requiredOf(row.requirements);
  }
  return [...groups.values()]
    .map(({ group, rows }) => ({
      ...group,
      lines: groupLabelLines([...rows.values()], (row) => requirementLabelKey(row.head)),
    }))
    .sort(
      (a, b) =>
        compareNullsLast(a.earliestRequiredDate, b.earliestRequiredDate) ||
        compareNullsLast(a.orderNumber, b.orderNumber)
    );
}

/**
 * The garment part a requirement is for, from its componentName: "Kurta - GRG-0038 - …" → "Kurta"; a combined-cutting
 * marker "Kurta - Combined: Kurta, Pallazo" → "Kurta + Pallazo"; two BOM lines in one requirement → both, comma-joined.
 */
export function requirementPart(componentName: string | null | undefined): string | null {
  if (!componentName) return null;
  // Split between BOM lines only — the comma inside "Combined: Kurta, Pallazo" is not followed by "<part> - "
  const parts = componentName.split(/,\s*(?=[^,]* - )/).map((entry) => {
    const combined = entry.match(/Combined:\s*(.+)$/i);
    if (combined)
      return combined[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' + ');
    return entry.split(' - ')[0].trim();
  });
  const unique = distinct(parts.filter(Boolean));
  return unique.length > 0 ? unique.join(', ') : null;
}

/**
 * What tells a merged row's requirements apart, by requirement id: the part where parts differ, the colour where
 * colours differ, the requirement number where nothing does. Empty for a row of one requirement.
 */
export function requirementTags(reqs: readonly MaterialRequirement[]): Map<string, string> {
  const tags = new Map<string, string>();
  if (reqs.length < 2) return tags;
  const colourOf = (r: MaterialRequirement) => r.colorName?.trim() || null;
  const byPart = distinct(reqs.map((r) => requirementPart(r.componentName))).length > 1;
  const byColour = distinct(reqs.map(colourOf)).length > 1;
  for (const r of reqs) {
    const bits = [byPart ? requirementPart(r.componentName) : null, byColour ? (colourOf(r) ?? 'No colour') : null];
    tags.set(r.id, bits.filter(Boolean).join(' · ') || r.requirementNumber);
  }
  return tags;
}

/** The note under a merged row's requirement numbers: its colours when they differ, else how many requirements */
export function mergedRowNote(reqs: readonly MaterialRequirement[]): string | null {
  if (reqs.length < 2) return null;
  const colours = distinct(reqs.map((r) => r.colorName?.trim() || null)).length;
  return colours > 1 ? `${colours} colours` : `${reqs.length} requirements`;
}

const distinct = <T>(values: T[]) => [...new Set(values)];

/** Σ Required, leaving out a balance row whose parent is in the same row (its quantity is already the parent's) */
function requiredOf(reqs: readonly MaterialRequirement[]): number {
  const ids = new Set(reqs.map((r) => r.id));
  return round3(
    reqs
      .filter((r) => !(r.splitFromId && ids.has(r.splitFromId)))
      .reduce((total, r) => total + Number(r.totalRequired || 0), 0)
  );
}

/** Ascending; a missing value sorts after every real one. Equal → 0, so the sort keeps arrival order. */
const compareNullsLast = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
};
