/**
 * The price of a production order line = the BUYER PO price (owner, 2026-09-28).
 *
 * A production order made for a sale order is priced at what the buyer's PO says for that style —
 * never at the cost sheet's Total Product Cost (which is the calculated COST). Start Production did
 * this; an order typed by hand and LINKED to its sale order afterwards kept the price typed in, and
 * all nine linked orders read the Total Product Cost (ORD2026080025 ₹122.64 against a ₹200 PO).
 *
 * order_items carries one unitPrice while the sale order is priced per size line: a shared price is
 * used as is; mixed prices give the quantity-weighted average (decimal-safe).
 */

import { divideCurrency, multiplyCurrency, roundToCent } from '../../utils/currency';

export interface BuyerPoLine {
  quantity: number;
  unitPrice: unknown;
}

export function buyerPoUnitPrice(lines: BuyerPoLine[]): { unitPrice: number; note?: string } | null {
  const priced = lines.filter((l) => Number(l.unitPrice) > 0 && l.quantity > 0);
  if (priced.length === 0) return null;
  const prices = new Set(priced.map((l) => Number(l.unitPrice)));
  if (prices.size === 1) return { unitPrice: [...prices][0] };
  const totalQty = priced.reduce((sum, l) => sum + l.quantity, 0);
  const totalValue = priced.reduce(
    (dec, l) => dec.plus(multiplyCurrency(l.quantity, Number(l.unitPrice))),
    multiplyCurrency(0, 0)
  );
  return {
    unitPrice: roundToCent(divideCurrency(totalValue, totalQty)).toNumber(),
    note: `Weighted avg of ${prices.size} SO line prices`,
  };
}

/** A line's value at a unit price, to the paisa. */
export function lineValue(quantity: number, unitPrice: number): number {
  return roundToCent(multiplyCurrency(quantity, unitPrice)).toNumber();
}
