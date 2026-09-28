/**
 * A production order's status is DERIVED from its runs and delivery notes (order-status.helper,
 * 2026-09-28). Nothing moved it before — all 10 orders read PENDING while two were being cut.
 */

import { deriveOrderStatus, type OrderStatusFacts } from '../../services/helpers/order-status.helper';

type Run = OrderStatusFacts['runs'][number];

const run = (over: Partial<Run> = {}): Run => ({
  number: 'WO-1',
  status: 'PENDING',
  totalQuantity: 100,
  orderItemId: 'item-1',
  started: false,
  ...over,
});

const facts = (over: Partial<OrderStatusFacts> = {}): OrderStatusFacts => ({
  runs: [],
  items: [{ id: 'item-1', quantity: 100 }],
  shipments: [],
  ...over,
});

describe('deriveOrderStatus', () => {
  it('no run → PENDING', () => {
    expect(deriveOrderStatus(facts()).status).toBe('PENDING');
  });

  it('a PENDING run → PENDING', () => {
    expect(deriveOrderStatus(facts({ runs: [run()] })).status).toBe('PENDING');
  });

  it('a run IN_PRODUCTION → IN_PRODUCTION, naming the run', () => {
    const d = deriveOrderStatus(facts({ runs: [run({ number: 'WO2609-0087', status: 'IN_PRODUCTION' })] }));
    expect(d.status).toBe('IN_PRODUCTION');
    expect(d.reason).toContain('WO2609-0087');
  });

  it('a SPLIT parent that had started keeps the order IN_PRODUCTION while its children are PENDING', () => {
    const d = deriveOrderStatus(
      facts({
        runs: [
          run({ number: 'P', status: 'SPLIT', started: true }),
          run({ number: 'C1', totalQuantity: 60 }),
          run({ number: 'C2', totalQuantity: 40 }),
        ],
      })
    );
    expect(d.status).toBe('IN_PRODUCTION');
  });

  it('a SPLIT parent that never started does not count as started', () => {
    const d = deriveOrderStatus(facts({ runs: [run({ status: 'SPLIT' }), run({ totalQuantity: 100 })] }));
    expect(d.status).toBe('PENDING');
  });

  it('all runs COMPLETED but not the whole order planned → still IN_PRODUCTION', () => {
    const d = deriveOrderStatus(
      facts({
        items: [
          { id: 'item-1', quantity: 100 },
          { id: 'item-2', quantity: 50 },
        ],
        runs: [run({ status: 'COMPLETED' })],
      })
    );
    expect(d.status).toBe('IN_PRODUCTION');
  });

  it('all live runs COMPLETED and the order fully planned → COMPLETED (SPLIT parent not double-counted)', () => {
    const d = deriveOrderStatus(
      facts({
        runs: [
          run({ status: 'SPLIT', started: true, totalQuantity: 100 }),
          run({ status: 'COMPLETED', totalQuantity: 60 }),
          run({ status: 'DISPATCHED', totalQuantity: 40 }),
        ],
      })
    );
    expect(d.status).toBe('COMPLETED');
  });

  it('legacy runs with no order-line link cover the unplanned remainder', () => {
    const d = deriveOrderStatus(
      facts({
        runs: [
          run({ status: 'COMPLETED', totalQuantity: 60 }),
          run({ status: 'COMPLETED', orderItemId: null, totalQuantity: 40 }),
        ],
      })
    );
    expect(d.status).toBe('COMPLETED');
  });

  it('every shipment group shipped → DISPATCHED, even with runs still open (shipment facts rank first)', () => {
    const d = deriveOrderStatus(
      facts({
        runs: [run({ status: 'IN_PRODUCTION' })],
        shipments: [
          { label: 'S', ordered: 50, shipped: 50 },
          { label: 'M', ordered: 50, shipped: 52 },
        ],
      })
    );
    expect(d.status).toBe('DISPATCHED');
  });

  it('one SKU short → not DISPATCHED', () => {
    const d = deriveOrderStatus(
      facts({
        runs: [run({ status: 'COMPLETED' })],
        shipments: [
          { label: 'S', ordered: 50, shipped: 50 },
          { label: 'M', ordered: 50, shipped: 49 },
        ],
      })
    );
    expect(d.status).toBe('COMPLETED');
  });

  it('shipped within quantity dust counts as shipped', () => {
    const d = deriveOrderStatus(facts({ shipments: [{ label: 'S', ordered: 10, shipped: 9.998 }] }));
    expect(d.status).toBe('DISPATCHED');
  });

  it('every started run cancelled → back to PENDING (cancelled runs are not in the facts)', () => {
    expect(deriveOrderStatus(facts({ runs: [] })).status).toBe('PENDING');
    expect(deriveOrderStatus(facts({ runs: [run()] })).reason).toBe('no production run has started');
  });
});
