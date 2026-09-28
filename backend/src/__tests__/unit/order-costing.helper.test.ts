/**
 * An order line's costing in the cost sheet's own terms (order-costing.helper, 2026-09-28). The actual
 * used to start from a never-set 0 — the first finished run would have read ≈ ₹0.
 */

import { actualTotalProductCost, totalProductCostOf } from '../../services/helpers/order-costing.helper';

// ESSKY085LS, cost sheet v1: subtotal 104.56, Value Loss 2 %, Markup 15 %, Total Product Cost 122.64
const ESSKY085LS = {
  subtotal: 104.56,
  valueLossAmount: 2.09,
  valueLossPercent: 2,
  markupAmount: 16,
  markupPercent: 15,
  totalProductCost: 122.64,
  totalCostPerPiece: 122.64,
  closedCost: 195,
};

describe('totalProductCostOf', () => {
  it('is the cost sheet Total Product Cost', () => {
    expect(totalProductCostOf(ESSKY085LS)).toBe(122.64);
    expect(totalProductCostOf({ totalCostPerPiece: 99 })).toBe(99);
    expect(totalProductCostOf(null)).toBe(0);
  });
});

describe('actualTotalProductCost', () => {
  it('carries a CMT difference through Value Loss and Markup, as the cost sheet builds it up', () => {
    // CMT costed at 50, came in at 52: +2 × 1.02 × 1.15 = +2.346 → 124.99
    expect(actualTotalProductCost(122.64, 50, 52, ESSKY085LS)).toBe(124.99);
  });

  it('is the Total Product Cost when the CMT came in as costed — never ≈ 0', () => {
    expect(actualTotalProductCost(122.64, 50, 50, ESSKY085LS)).toBe(122.64);
  });

  it('gives the same answer however often it runs (always from the estimate)', () => {
    const once = actualTotalProductCost(122.64, 50, 48, ESSKY085LS);
    expect(actualTotalProductCost(122.64, 50, 48, ESSKY085LS)).toBe(once);
  });
});
