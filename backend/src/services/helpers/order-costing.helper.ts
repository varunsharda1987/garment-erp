/**
 * An order line's COST per piece versus its PRICE (2026-09-28).
 *
 * The cost sheet's `totalCostPerPiece` (= `totalProductCost` = `sellingPricePerPiece`) is its final
 * PRICE: subtotal (fabric + trims + accessories + processing + embroidery + CMT) + value loss % +
 * markup %. ESSKY085LS: 104.56 + 2.09 (2 %) + 16.00 (15 %) = 122.64. The order snapshot copied that
 * price into `estimatedCostPerPiece`, so the estimate carried the markup — and the actual cost, whose
 * only writer (updateActualCMTCosts) started from a never-set 0, would have come out near ₹0 on the
 * first finished run: a −100 % "variance" on every order.
 *
 * Here: the estimate is the cost BEFORE markup (subtotal + value loss), and the actual is that same
 * cost with the estimated CMT swapped for the run's real CMT — always computed from the estimate, so
 * running it again never subtracts the CMT twice.
 */

import { addCurrency, roundToCent, subtractCurrency, toNumber } from '../../utils/currency';

/** The price build-up the cost sheet stores (style_costing columns / order_item_costing.costingSnapshot). */
export interface CostBuildUp {
  subtotal?: unknown;
  valueLossAmount?: unknown;
  valueLossPercent?: unknown;
  markupAmount?: unknown;
  totalCostPerPiece?: unknown;
  totalProductCost?: unknown;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Cost per piece before markup: subtotal + value loss. Falls back to price − markup, then to the
 * price itself when the sheet carries no build-up (never invents a figure).
 */
export function costBeforeMarkup(sheet: CostBuildUp | null | undefined): number {
  if (!sheet) return 0;
  const subtotal = num(sheet.subtotal);
  if (subtotal !== null && subtotal > 0) {
    return toNumber(roundToCent(addCurrency(subtotal, num(sheet.valueLossAmount) ?? 0)));
  }
  const price = num(sheet.totalCostPerPiece) ?? num(sheet.totalProductCost) ?? 0;
  const markup = num(sheet.markupAmount);
  return markup !== null && markup > 0 && markup < price
    ? toNumber(roundToCent(subtractCurrency(price, markup)))
    : price;
}

/**
 * The actual cost per piece once a run's real CMT is known: the estimate with the estimated CMT
 * replaced — the value-loss allowance applies to the CMT difference too.
 */
export function actualCostWithCmt(
  estimatedCost: number,
  estimatedCmt: number,
  actualCmt: number,
  valueLossPercent: number | null
): number {
  const lossFactor = 1 + (valueLossPercent ?? 0) / 100;
  const cmtDelta = (actualCmt - estimatedCmt) * lossFactor;
  return toNumber(roundToCent(addCurrency(estimatedCost, cmtDelta)));
}

/** The value-loss percent a snapshot was priced with (null when it carries none). */
export function valueLossPercentOf(sheet: CostBuildUp | null | undefined): number | null {
  return sheet ? num(sheet.valueLossPercent) : null;
}
