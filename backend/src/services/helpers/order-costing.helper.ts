/**
 * An order line's costing, in the cost sheet's OWN terms (2026-09-28, owner: a name must mean the same
 * thing on every page):
 *
 *   Subtotal                fabric + trims + accessories + processing + embroidery + CMT
 *   Value Loss (x %)        on the subtotal
 *   Total After Value Loss
 *   Markup (x %)            on the total after value loss
 *   Total Product Cost      = the cost sheet's calculated cost (stored as totalProductCost /
 *                             totalCostPerPiece; `sellingPricePerPiece` holds the same figure)
 *   Closed Cost per Piece   = the BUYER'S AGREED PRICE, excluding GST (style_costing.closedCost)
 *
 * The order line's ESTIMATED cost is the Total Product Cost; its ACTUAL cost is that same build-up with
 * the costed CMT replaced by the run's real CMT. The actual is compared with the Closed Cost (the
 * agreed price) to show the margin.
 *
 * Until now the actual's only writer (updateActualCMTCosts) started from a never-set 0 — the first
 * finished run would have read ≈ ₹0 — and re-running it subtracted the CMT twice. It is now always
 * derived from the estimate, so it gives the same answer however often it runs.
 */

import { addCurrency, roundToCent, toNumber } from '../../utils/currency';

/** The build-up the cost sheet stores (style_costing columns / order_item_costing.costingSnapshot). */
export interface CostBuildUp {
  subtotal?: unknown;
  valueLossAmount?: unknown;
  valueLossPercent?: unknown;
  markupAmount?: unknown;
  markupPercent?: unknown;
  totalCostPerPiece?: unknown;
  totalProductCost?: unknown;
  closedCost?: unknown;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The cost sheet's Total Product Cost (its calculated cost per piece). */
export function totalProductCostOf(sheet: CostBuildUp | null | undefined): number {
  if (!sheet) return 0;
  return num(sheet.totalProductCost) ?? num(sheet.totalCostPerPiece) ?? 0;
}

/**
 * The actual Total Product Cost once a run's real CMT is known: the costed Total Product Cost with the
 * CMT difference carried through Value Loss and Markup exactly as the cost sheet builds it up.
 */
export function actualTotalProductCost(
  estimatedTotalProductCost: number,
  estimatedCmt: number,
  actualCmt: number,
  sheet: CostBuildUp | null | undefined
): number {
  const lossFactor = 1 + (num(sheet?.valueLossPercent) ?? 0) / 100;
  const markupFactor = 1 + (num(sheet?.markupPercent) ?? 0) / 100;
  const delta = (actualCmt - estimatedCmt) * lossFactor * markupFactor;
  return toNumber(roundToCent(addCurrency(estimatedTotalProductCost, delta)));
}
