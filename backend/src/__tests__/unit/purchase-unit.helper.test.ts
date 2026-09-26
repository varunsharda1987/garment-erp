/**
 * purchase-unit.helper — buttons are counted per piece but bought by the gross (owner, 2026-09-26).
 */

import { purchaseUnitFor, stockRate, toPurchaseQty, toStockQty } from '../../services/helpers/purchase-unit.helper';
import { COUNT_UNIT_FACTORS } from '../../utils/units';

describe('purchase unit', () => {
  it('buttons and snap buttons are bought by the gross (144); everything else in its own unit', () => {
    expect(purchaseUnitFor('BUTTON')).toEqual({ unit: 'GROSS', stockUnitsPerUnit: 144 });
    expect(purchaseUnitFor('SNAP_BUTTON')).toEqual({ unit: 'GROSS', stockUnitsPerUnit: 144 });
    expect(purchaseUnitFor('ZIPPER')).toBeNull();
    expect(purchaseUnitFor('LACE')).toBeNull();
    expect(purchaseUnitFor(null)).toBeNull();
  });

  it('the factors live in the unit registry', () => {
    expect(COUNT_UNIT_FACTORS.GROSS).toEqual({ of: 'PIECE', per: 144 });
    expect(COUNT_UNIT_FACTORS.DOZEN).toEqual({ of: 'PIECE', per: 12 });
  });

  it('pieces → gross rounds UP to whole gross', () => {
    expect(toPurchaseQty(2300, 144)).toBe(16);
    expect(toPurchaseQty(2304, 144)).toBe(16); // exactly 16 — not 17
    expect(toPurchaseQty(2304.001, 144)).toBe(16); // dust is not another gross
    expect(toPurchaseQty(2305, 144)).toBe(17);
    expect(toPurchaseQty(1, 144)).toBe(1);
  });

  it('gross → pieces comes back whole', () => {
    expect(toStockQty(16, 144)).toBe(2304);
    expect(toStockQty(15.972, 144)).toBe(2300); // 2,299.968 would be stock dust
    expect(toStockQty(12.5, null)).toBe(12.5); // same unit: untouched
    expect(toStockQty(12.5, 1)).toBe(12.5);
  });

  it('a gross rate becomes a per-piece rate to 4 decimals', () => {
    expect(stockRate(18, 144)).toBe(0.125);
    expect(stockRate(100, 144)).toBe(0.6944);
    expect(stockRate(8, null)).toBe(8);
  });
});
