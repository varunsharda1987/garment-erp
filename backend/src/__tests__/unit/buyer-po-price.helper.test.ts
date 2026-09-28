/**
 * A production order line is priced at the buyer PO price (buyer-po-price.helper, owner 2026-09-28).
 */

import { buyerPoUnitPrice, lineValue } from '../../services/helpers/buyer-po-price.helper';

describe('buyerPoUnitPrice', () => {
  it('uses the shared price of the style’s PO lines', () => {
    expect(
      buyerPoUnitPrice([
        { quantity: 300, unitPrice: 200 },
        { quantity: 500, unitPrice: '200.00' },
      ])
    ).toEqual({ unitPrice: 200 });
  });

  it('averages mixed prices by quantity, and says so', () => {
    const r = buyerPoUnitPrice([
      { quantity: 100, unitPrice: 200 },
      { quantity: 300, unitPrice: 220 },
    ]);
    expect(r?.unitPrice).toBe(215);
    expect(r?.note).toMatch(/Weighted avg/);
  });

  it('gives no price when the PO has none', () => {
    expect(buyerPoUnitPrice([])).toBeNull();
    expect(buyerPoUnitPrice([{ quantity: 10, unitPrice: 0 }])).toBeNull();
  });
});

describe('lineValue', () => {
  it('prices to the paisa', () => {
    expect(lineValue(2300, 200)).toBe(460000);
    expect(lineValue(3, 1.15)).toBe(3.45);
  });
});
