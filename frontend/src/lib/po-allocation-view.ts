/**
 * How the PO page, its allocation card and the Allocate dialog name and read a PO's allocation
 * (GET /po-allocations/:poId). Pure helpers, so the three screens say the same thing.
 */
import { formatQuantity } from '@/lib/formatters';
import { qtyExceeds } from '@/lib/quantity';
import { unitShort } from '@/lib/units';
import type { LabelLineKey } from '@/lib/label-lines';
import type { PoAllocationLine, PoAllocationView } from '@/types/po-allocation.types';

/** A line's label key for `groupLabelLines` — a label's sizes under one heading */
export const allocationLabelKey = (line: PoAllocationLine): LabelLineKey | null => {
  const label = line.material?.label;
  return label
    ? { labelId: label.id, code: label.code, name: label.name, type: label.type, size: line.material?.size ?? null }
    : null;
};

/** "LBL-0004 · Size XS", or "BTN-0012 — 4-hole shirt button · Navy" */
export function allocationLineName(line: PoAllocationLine): string {
  const m = line.material;
  if (!m) return 'Line';
  if (m.label) return `${m.label.code} · ${m.size ? `Size ${m.size}` : 'All sizes'}`;
  return [`${m.code} — ${m.name}`, line.colorName].filter(Boolean).join(' · ');
}

/** The unit a line's figures are in: its material's (stock) unit */
export const allocationUnit = (line: PoAllocationLine): string | null => line.stockUnit ?? line.material?.unit ?? null;

/** A figure with its unit, up to 3 decimals: "2,304 pcs" */
export const allocationQty = (qty: number, unit: string | null | undefined): string => formatQuantity(qty, unit, 3);

/** "16 gross" when the line is bought in another unit than it is counted in, else null */
export function purchaseUnitNote(line: PoAllocationLine): string | null {
  if (line.stockUnitsPerUnit == null || unitShort(line.unit) === unitShort(allocationUnit(line))) return null;
  return allocationQty(line.orderedQty, line.unit);
}

/** Can another order still be linked here: the PO takes links, and some line has room and an order that fits */
export function hasFreeCandidates(view: PoAllocationView | undefined | null): boolean {
  if (!view?.po.linkable) return false;
  return view.lines.some((l) => l.linkable && qtyExceeds(l.freeToLink, 0) && l.candidates.some((c) => c.linkable));
}

/** Anything worth a card: a link, or an order that could be linked */
export function hasAllocationContent(view: PoAllocationView | undefined | null): boolean {
  if (!view) return false;
  return (
    view.lines.some((l) => l.links.length > 0) || (view.po.linkable && view.lines.some((l) => l.candidates.length > 0))
  );
}

/** The page banner: "3 running orders need these and are not linked" */
export function unlinkedOrdersText(count: number): string {
  return count === 1
    ? '1 running order needs these and is not linked'
    : `${count} running orders need these and are not linked`;
}
