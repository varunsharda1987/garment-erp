import { describe, it, expect } from 'vitest';
import {
  describePlan,
  deliveryUndecidedSoon,
  fillBalanceIntoFirst,
  lineBalance,
  splitProblems,
  toSplitRequest,
  type SplitPointDraft,
} from '../delivery-plan';

const lines = [{ id: 'L1', label: 'GRG-0072', ordered: 10000 }];
const pt = (warehouseId: string, qty: string): SplitPointDraft => ({ key: warehouseId, warehouseId, qty: { L1: qty } });
const name = (id: string) => `WH ${id}`;

describe('split delivery editor rules', () => {
  it('shows what is still unplaced, and what is over', () => {
    expect(lineBalance(lines[0], [pt('dyer', '4000'), pt('store', '5000')])).toEqual({
      placed: 9000,
      unplaced: 1000,
      over: 0,
    });
    expect(lineBalance(lines[0], [pt('dyer', '4000'), pt('store', '6100')]).over).toBe(100);
    // within the one quantity tolerance is placed
    expect(lineBalance(lines[0], [pt('dyer', '4000.002'), pt('store', '5999.999')]).unplaced).toBe(0);
  });

  it('puts the balance into point 1 — the rule the server uses on a draft line change', () => {
    const filled = fillBalanceIntoFirst(lines, [pt('dyer', '3000'), pt('store', '6000')]);
    expect(filled[0].qty.L1).toBe('4000');
    expect(filled[1].qty.L1).toBe('6000');
  });

  it('lists every problem in words', () => {
    expect(splitProblems(lines, [pt('dyer', '4000'), pt('store', '6000')], name)).toEqual([]);
    expect(splitProblems(lines, [pt('dyer', '10000')], name)).toContain('A split needs at least two places.');
    expect(splitProblems(lines, [pt('dyer', '4000'), pt('dyer', '6000')], name)).toContain('WH dyer is listed twice.');
    expect(splitProblems(lines, [pt('dyer', '4000'), pt('store', '')], name)).toEqual(
      expect.arrayContaining(['WH store has nothing to receive.', 'GRG-0072: 6000 not placed yet.'])
    );
    expect(
      splitProblems(lines, [pt('dyer', '4000'), { key: 'x', warehouseId: '', qty: { L1: '6000' } }], name)
    ).toContain('Pick a place for every column.');
  });

  it('sends numbers, leaving out blank lines', () => {
    expect(
      toSplitRequest(
        [pt('dyer', '4000.5'), { key: 's', warehouseId: 'store', qty: { L1: '5999.5', L2: '' } }],
        ' late '
      )
    ).toEqual({
      mode: 'SPLIT',
      points: [
        { warehouseId: 'dyer', lines: [{ poItemId: 'L1', quantity: 4000.5 }] },
        { warehouseId: 'store', lines: [{ poItemId: 'L1', quantity: 5999.5 }] },
      ],
      reason: 'late',
    });
  });

  it('describes a plan for the history', () => {
    expect(describePlan({ mode: 'TO_BE_ADVISED', points: [] })).toBe('To be advised');
    expect(
      describePlan({
        mode: 'SPLIT',
        points: [
          { warehouseId: 'a', warehouseName: 'Aryan Dyeing', lines: [{ poItemId: 'L1', quantity: 4000 }] },
          { warehouseId: 'b', warehouseName: 'Kashaya Fabs', lines: [{ poItemId: 'L1', quantity: 6000 }] },
        ],
      })
    ).toBe('Split: Aryan Dyeing 4,000 · Kashaya Fabs 6,000');
  });

  it('flags a sent PO still "to be advised" within 3 days of its due date', () => {
    const today = new Date('2026-09-26T10:00:00+05:30');
    const po = {
      deliveryPoints: [],
      deliveryLocationId: null,
      status: 'SENT',
      expectedDeliveryDate: '2026-09-28',
    } as never;
    expect(deliveryUndecidedSoon(po, today)).toBe(true);
    expect(deliveryUndecidedSoon({ ...(po as object), expectedDeliveryDate: '2026-10-05' } as never, today)).toBe(
      false
    );
    expect(deliveryUndecidedSoon({ ...(po as object), deliveryLocationId: 'store' } as never, today)).toBe(false);
    expect(deliveryUndecidedSoon({ ...(po as object), status: 'DRAFT' } as never, today)).toBe(false);
  });
});
