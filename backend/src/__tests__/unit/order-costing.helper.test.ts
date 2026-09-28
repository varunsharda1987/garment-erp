/**
 * An order line's cost before markup vs its price (order-costing.helper, 2026-09-28). The estimate
 * used to be the PRICE, and the actual started from 0 — the first finished run would read ≈ ₹0.
 */

import { actualCostWithCmt, costBeforeMarkup } from '../../services/helpers/order-costing.helper';

// ESSKY085LS, cost sheet v1: parts 104.56, value loss 2 % = 2.09, markup 15 % = 16.00, price 122.64
const ESSKY085LS = {
  subtotal: 104.56,
  valueLossAmount: 2.09,
  valueLossPercent: 2,
  markupAmount: 16,
  totalCostPerPiece: 122.64,
};

describe('costBeforeMarkup', () => {
  it('is subtotal + value loss, not the price', () => {
    expect(costBeforeMarkup(ESSKY085LS)).toBe(106.65);
  });

  it('falls back to price − markup when there is no subtotal', () => {
    expect(costBeforeMarkup({ totalCostPerPiece: 122.64, markupAmount: 16 })).toBe(106.64);
  });

  it('falls back to the price itself when the sheet has no build-up', () => {
    expect(costBeforeMarkup({ totalCostPerPiece: 99 })).toBe(99);
    expect(costBeforeMarkup(null)).toBe(0);
  });
});

describe('actualCostWithCmt', () => {
  it('swaps the estimated CMT for the real one (with its value loss)', () => {
    // CMT costed at 50, came in at 52: +2 × 1.02 = +2.04
    expect(actualCostWithCmt(106.65, 50, 52, 2)).toBe(108.69);
  });

  it('is the estimate when the CMT came in as costed — never ≈ 0', () => {
    expect(actualCostWithCmt(106.65, 50, 50, 2)).toBe(106.65);
  });

  it('gives the same answer however often it runs (always from the estimate)', () => {
    const once = actualCostWithCmt(106.65, 50, 48, 2);
    expect(actualCostWithCmt(106.65, 50, 48, 2)).toBe(once);
  });
});
