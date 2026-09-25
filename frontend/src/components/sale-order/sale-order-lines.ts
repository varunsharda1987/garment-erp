/**
 * Line order and season for the sale-order screens.
 *
 * Every sale-order screen lists lines through `sortSaleOrderLines` so sizes read XS → XXXL
 * wherever they appear (the order form, the detail page, Amend, the confirm preview). The size
 * rule itself is `compareSizes` — the one rule shared with the backend's `size_options.sortOrder`.
 */
import { compareSizes } from '@/utils/sku-generator';

/** What the sort needs from a line: saved items carry `size.sizeName`, form drafts `sizeName`. */
interface SortableLine {
  styleId: string;
  colorId?: string | null;
  sizeName?: string | null;
  size?: { sizeName: string } | null;
}

const sizeNameOf = (line: SortableLine) => line.sizeName ?? line.size?.sizeName ?? null;
const colourKey = (line: SortableLine) => `${line.styleId}|${line.colorId ?? ''}`;

/**
 * Lines grouped by style, then colour — each in the order it first appears, so the user's own line
 * order still leads — and inside a group sizes XS → XXXL with "Size TBD" last. Returns a new array.
 */
export function sortSaleOrderLines<T extends SortableLine>(lines: readonly T[]): T[] {
  const styleRank = new Map<string, number>();
  const colourRank = new Map<string, number>();
  for (const line of lines) {
    if (!styleRank.has(line.styleId)) styleRank.set(line.styleId, styleRank.size);
    if (!colourRank.has(colourKey(line))) colourRank.set(colourKey(line), colourRank.size);
  }
  return [...lines].sort((a, b) => {
    const byStyle = (styleRank.get(a.styleId) ?? 0) - (styleRank.get(b.styleId) ?? 0);
    if (byStyle !== 0) return byStyle;
    const byColour = (colourRank.get(colourKey(a)) ?? 0) - (colourRank.get(colourKey(b)) ?? 0);
    if (byColour !== 0) return byColour;
    const sizeA = sizeNameOf(a);
    const sizeB = sizeNameOf(b);
    if (!sizeA || !sizeB) return (sizeA ? 0 : 1) - (sizeB ? 0 : 1);
    return compareSizes(sizeA, sizeB);
  });
}

interface SeasonedStyle {
  season?: string | null;
  seasonMaster?: { code: string } | null;
}

/**
 * A sale order has no season of its own — it is the style's: the Season master code (WT26), else
 * the style's free-text season (styles saved before the master), else null.
 */
export function styleSeasonLabel(style?: SeasonedStyle | null): string | null {
  return style?.seasonMaster?.code || style?.season?.trim() || null;
}

/** The distinct seasons across an order's lines, in line order — for the list's Season column. */
export function orderSeasonLabels(items: readonly { style?: SeasonedStyle | null }[] | undefined): string[] {
  const labels: string[] = [];
  for (const item of items ?? []) {
    const label = styleSeasonLabel(item.style);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
