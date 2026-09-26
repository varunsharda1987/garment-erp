/**
 * The pure rules of a PO's delivery plan (helpers/po-delivery-plan.helper.ts, 2026-09-26): a split's
 * places add up to each line within the one quantity tolerance, and received per place is in ACTUAL
 * units (fold-length rule) — awaiting QC counts what arrived, accepted counts what was accepted,
 * rejected and reversed count nothing.
 */
import {
  buildTargetPlan,
  foldReceipts,
  planFromItemDeliveries,
  receiptLineQty,
} from '../../services/helpers/po-delivery-plan.helper';

const items = [{ id: 'L1', orderedQuantity: 10000, label: 'GRG-0072' }];
const name = (id: string) => `WH ${id}`;

describe('buildTargetPlan', () => {
  it('accepts a split that adds up within the tolerance, dropping zero lines', () => {
    const plan = buildTargetPlan(
      {
        mode: 'SPLIT',
        points: [
          { warehouseId: 'dyer', lines: [{ poItemId: 'L1', quantity: 4000.002 }] },
          { warehouseId: 'store', lines: [{ poItemId: 'L1', quantity: 5999.999 }] },
        ],
      },
      items,
      name
    );
    expect(plan.mode).toBe('SPLIT');
    expect(plan.points.map((p) => p.warehouseName)).toEqual(['WH dyer', 'WH store']);
  });

  it('refuses a split that leaves part of a line unplaced, one place twice, or a single place', () => {
    const split = (a: number, b: number, second = 'store') =>
      buildTargetPlan(
        {
          mode: 'SPLIT',
          points: [
            { warehouseId: 'dyer', lines: [{ poItemId: 'L1', quantity: a }] },
            { warehouseId: second, lines: [{ poItemId: 'L1', quantity: b }] },
          ],
        },
        items,
        name
      );
    expect(() => split(4000, 5000)).toThrow(/1000 short of/);
    expect(() => split(4000, 6100)).toThrow(/100 more than/);
    expect(() => split(4000, 6000, 'dyer')).toThrow(/listed twice/);
    expect(() =>
      buildTargetPlan(
        { mode: 'SPLIT', points: [{ warehouseId: 'dyer', lines: [{ poItemId: 'L1', quantity: 10000 }] }] },
        items,
        name
      )
    ).toThrow(/at least two places/);
  });

  it('keeps ONE_PLACE and TO_BE_ADVISED simple', () => {
    expect(buildTargetPlan({ mode: 'TO_BE_ADVISED' }, items, name)).toEqual({ mode: 'TO_BE_ADVISED', points: [] });
    expect(buildTargetPlan({ mode: 'ONE_PLACE', warehouseId: 'store' }, items, name).points).toEqual([
      { warehouseId: 'store', warehouseName: 'WH store', lines: [] },
    ]);
  });
});

describe('planFromItemDeliveries', () => {
  it('turns per-line places into a plan, point 1 = the first place named', () => {
    expect(planFromItemDeliveries([{ id: 'L1' }])).toBeNull();
    expect(planFromItemDeliveries([{ id: 'L1', deliveries: [{ warehouseId: 'store', quantity: 5 }] }])).toEqual({
      mode: 'ONE_PLACE',
      warehouseId: 'store',
    });
    expect(
      planFromItemDeliveries([
        {
          id: 'L1',
          deliveries: [
            { warehouseId: 'dyer', quantity: 4 },
            { warehouseId: 'store', quantity: 6 },
          ],
        },
        { id: 'L2', deliveries: [{ warehouseId: 'store', quantity: 3 }] },
      ])
    ).toEqual({
      mode: 'SPLIT',
      points: [
        { warehouseId: 'dyer', lines: [{ poItemId: 'L1', quantity: 4 }] },
        {
          warehouseId: 'store',
          lines: [
            { poItemId: 'L1', quantity: 6 },
            { poItemId: 'L2', quantity: 3 },
          ],
        },
      ],
    });
  });
});

describe('receipts per place, in ACTUAL units', () => {
  const line = { poItemId: 'L1', receivedQuantity: 1000, acceptedQuantity: 900, foldLengthCm: 98 };

  it('counts what arrived while awaiting QC, what was accepted after, nothing when rejected', () => {
    expect(receiptLineQty('PENDING_QC', line)).toBe(980); // 1,000 counted at L=98
    expect(receiptLineQty('ACCEPTED', line)).toBe(882);
    expect(receiptLineQty('PARTIALLY_ACCEPTED', line)).toBe(882);
    expect(receiptLineQty('REJECTED', line)).toBe(0);
    expect(receiptLineQty('REVERSED', line)).toBe(0);
  });

  it('files a receipt under its planned place, else where it was booked', () => {
    const received = foldReceipts(
      [
        { status: 'ACCEPTED', warehouseId: 'annexe', poDeliveryPointId: 'P-store', grn_items: [line] },
        {
          status: 'PENDING_QC',
          warehouseId: 'store',
          poDeliveryPointId: null,
          grn_items: [{ ...line, foldLengthCm: null }],
        },
        { status: 'REJECTED', warehouseId: 'dyer', poDeliveryPointId: null, grn_items: [line] },
      ],
      new Map([['P-store', 'store']])
    );
    expect(received.get('store')?.get('L1')).toBe(1882);
    expect(received.has('annexe')).toBe(false);
    expect(received.has('dyer')).toBe(false);
  });
});
