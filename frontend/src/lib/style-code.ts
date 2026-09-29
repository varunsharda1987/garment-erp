/**
 * Style identity — the project's ONE rule for how a style is named on a screen or on paper.
 *
 * Why it exists (2026-09-29): screens and printouts led with our internal Style Code (EBWW-021,
 * STYFW-002) while the buyer, the team and the buyer's paperwork use the buyer's own code
 * (SP27DR27, IT00254). The owner: the buyer's code is the most important — show it first. It was
 * also labelled five ways ("Buyer Ref", "Buyer Style", "Buyer Reference", "Buyer Style Ref",
 * "Buyer Style Code"); it is now BUYER_STYLE_CODE_LABEL everywhere, and ours is STYLE_CODE_LABEL.
 *
 * The rule:
 *  - Buyer Style Code = the sale-order line's snapshot (the code as at the day the line was taken),
 *    else styles.buyerStyleRef, else the Style Code. In-house brands type their code AS the style
 *    code, so a style with no separate buyer code is still named by the code its buyer uses.
 *  - One line: 'SP27DR27 (EBWW-021)' — our code in brackets only when it differs.
 *  - Tables: a "Buyer Style Code" column first (`buyerStyleCode`), then "Style Code" (`ourStyleCode`).
 *
 * Saved codes never change: job work numbers, lab-dip and fabric codes, SKUs and
 * fabric_master.styleReference key on the raw Style Code. Text already saved stays as it was saved.
 * New fabric / lace names and new printed line text are built with `styleCodeLabel`.
 *
 * This file is identical to `frontend/src/lib/style-code.ts` (asserted by
 * `backend/src/__tests__/unit/style-code.test.ts`). It has no imports so both copies stay identical.
 */

export const BUYER_STYLE_CODE_LABEL = 'Buyer Style Code';
export const STYLE_CODE_LABEL = 'Style Code';

/** Anything carrying a style's two codes: a style record, a flattened row, a report line. */
export interface StyleCodes {
  styleCode?: string | null;
  buyerStyleRef?: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

// " - " inside a code collapses to "-": fabric names built from a label are split on ' - '.
function tidy(code: string): string {
  return code.replace(/\s+-\s+/g, '-');
}

/**
 * The buyer's code for a sale-order line: the line's own snapshot, else the style's current one.
 * null when neither is set — the raw value to store or send, never a display fallback.
 */
export function lineBuyerStyleRef(
  lineRef: string | null | undefined,
  styleRef: string | null | undefined
): string | null {
  return clean(lineRef) ?? clean(styleRef);
}

/**
 * The Buyer Style Code to show: the line's snapshot, else the style's buyer code, else our Style
 * Code. `fallback` when the style carries neither code.
 */
export function buyerStyleCode(style: StyleCodes | null | undefined, lineRef?: string | null, fallback = '—'): string {
  return clean(lineRef) ?? clean(style?.buyerStyleRef) ?? clean(style?.styleCode) ?? fallback;
}

/** Our Style Code — the second column beside "Buyer Style Code". `fallback` when missing. */
export function ourStyleCode(style: StyleCodes | null | undefined, fallback = '—'): string {
  return clean(style?.styleCode) ?? fallback;
}

/**
 * Our Style Code when it differs from the Buyer Style Code shown beside it; null when it would
 * only repeat it (no separate buyer code, the same code, or no style code at all).
 */
export function styleCodeIfDifferent(style: StyleCodes | null | undefined, lineRef?: string | null): string | null {
  const ours = clean(style?.styleCode);
  if (!ours) return null;
  const buyer = clean(lineRef) ?? clean(style?.buyerStyleRef);
  if (!buyer || buyer.toUpperCase() === ours.toUpperCase()) return null;
  return ours;
}

/**
 * A style on one line: 'SP27DR27 (EBWW-021)' — or the one code when there is no separate buyer
 * code, or it equals ours. `fallback` when the style carries neither code.
 */
export function styleCodeLabel(style: StyleCodes | null | undefined, lineRef?: string | null, fallback = '—'): string {
  const main = buyerStyleCode(style, lineRef, '');
  if (!main) return fallback;
  const ours = styleCodeIfDifferent(style, lineRef);
  return ours ? `${tidy(main)} (${tidy(ours)})` : tidy(main);
}

/**
 * LEGACY shape, our code first: 'EBWW-021 (SP27DR27)'. Never for display. ONLY for a value that
 * must keep the shape it has always been saved in — the invoice line description, which Tally
 * uses as the stock-item name (a new shape would open new stock items there).
 */
export function formatStyleCodeWithRef(styleCode: string, buyerStyleRef?: string | null): string {
  const ref = clean(buyerStyleRef);
  if (!ref) return styleCode;
  return `${styleCode} (${tidy(ref)})`;
}
