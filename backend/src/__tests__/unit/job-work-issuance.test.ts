/**
 * Issuance consolidation — validateIssue blocker matrix (mocked prisma, no DB).
 *
 * The service is the single implementation of "issue material to processor"; these
 * tests pin the validation rules that the four old paths never had: greige identity,
 * width tolerance, R6, processor-held lots, quantity totals, the no-lot trap, and
 * multi-lot hygiene (one greige per issue, no lot listed twice).
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    job_work_orders: { findUnique: jest.fn() },
    greige_stock: { findUnique: jest.fn(), findMany: jest.fn() },
    greige_master: { findUnique: jest.fn() },
    fabric_stock: { findUnique: jest.fn() },
  },
}));

import prisma from '../../config/database';
import { validateIssue, validateDispatch, ISSUE_ERROR_CODES } from '../../services/job-work-issuance.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const GREIGE_ID = 'greige-38';
const OTHER_GREIGE_ID = 'greige-06';
const PROCESSOR_ID = 'proc-aryan';

function baseJwo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'jwo-1',
    jobWorkNumber: 'DJ-EBEW-003-001',
    sentDate: null,
    jwoStatus: 'APPROVED',
    status: 'READY_TO_SEND',
    fabricType: 'GREIGE',
    uom: 'MTR',
    qtySentMeters: 8792.09,
    greigeWidthInches: 63,
    statutoryDueDate: null,
    greigeStockLotId: null,
    fabricStockLotId: null,
    finishedFabricId: null,
    processorId: PROCESSOR_ID,
    purchaseOrderId: null,
    fabricId: null,
    processor: { id: PROCESSOR_ID, name: 'Aryan Dyeing' },
    style: { styleCode: 'EBEW-003', buyerStyleRef: null },
    fabric: null,
    labDip: null,
    requirementLinks: [
      { material_requirements: { id: 'req-1', materialId: GREIGE_ID, materials: { greigeId: GREIGE_ID } } },
    ],
    ...overrides,
  };
}

function baseLot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lot-1',
    greigeId: GREIGE_ID,
    greigeWidth: 63,
    quantityAvailable: 9000,
    quantityReserved: 0,
    processorId: null,
    sourceType: 'GRN',
    supplierId: 'weaver-1',
    purchaseCost: 50.5,
    weightedAvgCost: 50.5,
    warehouseId: 'wh-1',
    greige: { greigeCode: 'GRG-0038', greigeName: 'Viscose Slub 30×30 / 68×64 / 63"' },
    ...overrides,
  };
}

function arm(jwo: unknown, lotsById: Record<string, unknown> = {}) {
  db.job_work_orders.findUnique.mockResolvedValue(jwo);
  db.greige_master.findUnique.mockResolvedValue({
    id: GREIGE_ID,
    greigeCode: 'GRG-0038',
    greigeName: 'Viscose Slub 30×30 / 68×64 / 63"',
  });
  db.greige_stock.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(lotsById[where.id] ?? null)
  );
  db.fabric_stock.findUnique.mockResolvedValue(null);
}

const codes = (v: { blockers: Array<{ code: string }> }) => v.blockers.map((b) => b.code);

beforeEach(() => jest.clearAllMocks());

describe('validateIssue — blocker matrix', () => {
  it('happy path: right lot, right width, enough balance → no blockers, lots sorted desc', async () => {
    arm(baseJwo(), {
      'lot-1': baseLot({ quantityAvailable: 5000 }),
      'lot-2': baseLot({ id: 'lot-2', quantityAvailable: 4000 }),
    });
    const v = await validateIssue('jwo-1', {
      lots: [
        { greigeStockLotId: 'lot-2', qty: 3792.09 },
        { greigeStockLotId: 'lot-1', qty: 5000 },
      ],
    });
    expect(v.blockers).toEqual([]);
    expect(v.lots.map((l) => l.row.id)).toEqual(['lot-1', 'lot-2']); // largest first
    expect(v.expectedGreigeId).toBe(GREIGE_ID);
  });

  it('ALREADY_ISSUED when sentDate is set', async () => {
    arm(baseJwo({ sentDate: new Date('2026-08-18') }));
    const v = await validateIssue('jwo-1', {});
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.ALREADY_ISSUED);
  });

  it('ORDER_CANCELLED for cancelled orders', async () => {
    arm(baseJwo({ jwoStatus: 'CANCELLED' }));
    const v = await validateIssue('jwo-1', {});
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.ORDER_CANCELLED);
  });

  it('NO_GREIGE_LOT: the DJ-EBEW-003-001 trap — greige order, no lot anywhere', async () => {
    arm(baseJwo());
    const v = await validateIssue('jwo-1', {});
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.NO_GREIGE_LOT);
  });

  it('lot-less is LEGAL for non-greige service work (no blockers)', async () => {
    arm(baseJwo({ fabricType: 'FINISHED', uom: 'PCS', requirementLinks: [] }));
    const v = await validateIssue('jwo-1', {});
    expect(v.blockers).toEqual([]);
  });

  it('LOT_QTY_MISMATCH when lot quantities do not total qtySentMeters', async () => {
    arm(baseJwo(), { 'lot-1': baseLot() });
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 5000 }] });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.LOT_QTY_MISMATCH);
  });

  it('LOT_NOT_FOUND for a missing lot id', async () => {
    arm(baseJwo(), {});
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'ghost', qty: 8792.09 }] });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.LOT_NOT_FOUND);
  });

  it('LOT_AT_PROCESSOR for processor-held / TRANSFER lots', async () => {
    arm(baseJwo(), { 'lot-1': baseLot({ processorId: 'someone' }) });
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }] });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.LOT_AT_PROCESSOR);
  });

  it('R6: PURCHASED_ITEM_AS_COMPONENT when the lot came from the processor themselves', async () => {
    arm(baseJwo(), { 'lot-1': baseLot({ supplierId: PROCESSOR_ID }) });
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }] });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.PURCHASED_ITEM_AS_COMPONENT);
  });

  it('LOT_GREIGE_MISMATCH: 48" Poplin cannot serve a GRG-0038 order', async () => {
    arm(baseJwo(), {
      'lot-1': baseLot({ greigeId: OTHER_GREIGE_ID, greige: { greigeCode: 'GRG-0006', greigeName: 'Poplin' } }),
    });
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }] });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.LOT_GREIGE_MISMATCH);
  });

  it('LOT_WIDTH_MISMATCH beyond 1.0" tolerance — overridable with acknowledgeWidthMismatch', async () => {
    arm(baseJwo(), { 'lot-1': baseLot({ greigeWidth: 48 }) });
    const v1 = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }] });
    expect(codes(v1)).toContain(ISSUE_ERROR_CODES.LOT_WIDTH_MISMATCH);
    const v2 = await validateIssue('jwo-1', {
      lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }],
      acknowledgeWidthMismatch: true,
    });
    expect(codes(v2)).not.toContain(ISSUE_ERROR_CODES.LOT_WIDTH_MISMATCH);
  });

  it('width within ±1.0" passes without acknowledgement', async () => {
    arm(baseJwo(), { 'lot-1': baseLot({ greigeWidth: 63.5 }) });
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }] });
    expect(codes(v)).not.toContain(ISSUE_ERROR_CODES.LOT_WIDTH_MISMATCH);
  });

  it('INSUFFICIENT_GREIGE when the lot cannot cover its share', async () => {
    arm(baseJwo(), { 'lot-1': baseLot({ quantityAvailable: 100 }) });
    const v = await validateIssue('jwo-1', { lots: [{ greigeStockLotId: 'lot-1', qty: 8792.09 }] });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.INSUFFICIENT_GREIGE);
  });

  it('LOT_GREIGE_MIXED: two greiges in one issue — the only guard on a style-less stock order', async () => {
    // requirementLinks [] (with fabric/labDip null) leaves expectedGreigeId unresolvable, so
    // LOT_GREIGE_MISMATCH cannot fire and the cross-lot check is all that stands.
    arm(baseJwo({ requirementLinks: [] }), {
      'lot-1': baseLot({ quantityAvailable: 5000 }),
      'lot-2': baseLot({
        id: 'lot-2',
        greigeId: OTHER_GREIGE_ID,
        quantityAvailable: 4000,
        greige: { greigeCode: 'GRG-0006', greigeName: 'Poplin' },
      }),
    });
    const v = await validateIssue('jwo-1', {
      lots: [
        { greigeStockLotId: 'lot-1', qty: 5000 },
        { greigeStockLotId: 'lot-2', qty: 3792.09 },
      ],
    });
    expect(v.expectedGreigeId).toBeNull();
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.LOT_GREIGE_MIXED);
    expect(codes(v)).not.toContain(ISSUE_ERROR_CODES.LOT_GREIGE_MISMATCH);
  });

  it('LOT_DUPLICATE: the same lot listed twice would be consumed twice', async () => {
    arm(baseJwo(), { 'lot-1': baseLot({ quantityAvailable: 9000 }) });
    const v = await validateIssue('jwo-1', {
      lots: [
        { greigeStockLotId: 'lot-1', qty: 4392.09 },
        { greigeStockLotId: 'lot-1', qty: 4400 },
      ],
    });
    expect(codes(v)).toContain(ISSUE_ERROR_CODES.LOT_DUPLICATE);
  });

  it('two lots of the SAME greige stay clean — no mixed/duplicate false positive', async () => {
    arm(baseJwo(), {
      'lot-1': baseLot({ quantityAvailable: 5000 }),
      'lot-2': baseLot({ id: 'lot-2', quantityAvailable: 4000 }),
    });
    const v = await validateIssue('jwo-1', {
      lots: [
        { greigeStockLotId: 'lot-1', qty: 5000 },
        { greigeStockLotId: 'lot-2', qty: 3792.09 },
      ],
    });
    expect(v.blockers).toEqual([]);
  });

  it('falls back to the JWO-stamped lot when no explicit lots are passed', async () => {
    arm(baseJwo({ greigeStockLotId: 'lot-1' }), { 'lot-1': baseLot() });
    const v = await validateIssue('jwo-1', {});
    expect(v.blockers).toEqual([]);
    expect(v.lots).toHaveLength(1);
    expect(v.lots[0].qty).toBe(8792.09);
  });
});

/**
 * Consolidated dispatch — one truck to one processor carrying several orders.
 *
 * Each order still runs the full single-issue validation above; these are the rules that only
 * exist BECAUSE the orders travel together, and which no per-order check can see.
 */
describe('validateDispatch — rules that only exist across orders', () => {
  const OTHER_PROCESSOR_ID = 'proc-other';

  function armMulti(jwos: Record<string, unknown>, lotsById: Record<string, unknown> = {}) {
    db.job_work_orders.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(jwos[where.id] ?? null)
    );
    db.greige_master.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === GREIGE_ID
          ? { id: GREIGE_ID, greigeCode: 'GRG-0038', greigeName: 'Viscose Slub 30×30 / 68×64 / 63"' }
          : { id: OTHER_GREIGE_ID, greigeCode: 'GRG-0006', greigeName: 'Poplin 40×40 / 88×66 / 63"' }
      )
    );
    db.greige_stock.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(lotsById[where.id] ?? null)
    );
    db.fabric_stock.findUnique.mockResolvedValue(null);
  }

  /** Two orders for the same processor, each covered by its own lot — the real bulk-dye case. */
  function twoGoodOrders() {
    armMulti(
      {
        'jwo-1': baseJwo({ id: 'jwo-1', jobWorkNumber: 'DJ-EBEW-003-001', qtySentMeters: 5000 }),
        'jwo-2': baseJwo({ id: 'jwo-2', jobWorkNumber: 'DJ-LNG226-001', qtySentMeters: 3000 }),
      },
      {
        'lot-1': baseLot({ id: 'lot-1', quantityAvailable: 6000 }),
        'lot-2': baseLot({ id: 'lot-2', quantityAvailable: 4000 }),
      }
    );
    return {
      userId: 'u1',
      processorId: PROCESSOR_ID,
      orders: [
        { jwoId: 'jwo-1', lots: [{ greigeStockLotId: 'lot-1', qty: 5000 }] },
        { jwoId: 'jwo-2', lots: [{ greigeStockLotId: 'lot-2', qty: 3000 }] },
      ],
    };
  }

  it('two orders, one processor, distinct lots → dispatchable', async () => {
    const v = await validateDispatch(twoGoodOrders());
    expect(v.dispatchBlockers).toEqual([]);
    expect(v.orderBlockers).toEqual([]);
    expect(v.canDispatch).toBe(true);
    expect(v.validations).toHaveLength(2);
  });

  it('PROCESSOR_MISMATCH: a truck goes to ONE destination', async () => {
    const input = twoGoodOrders();
    armMulti(
      {
        'jwo-1': baseJwo({ id: 'jwo-1', qtySentMeters: 5000 }),
        'jwo-2': baseJwo({
          id: 'jwo-2',
          jobWorkNumber: 'DJ-LNG226-001',
          qtySentMeters: 3000,
          processorId: OTHER_PROCESSOR_ID,
        }),
      },
      { 'lot-1': baseLot({ quantityAvailable: 6000 }), 'lot-2': baseLot({ id: 'lot-2', quantityAvailable: 4000 }) }
    );
    const v = await validateDispatch(input);
    expect(v.dispatchBlockers.map((b) => b.code)).toContain(ISSUE_ERROR_CODES.PROCESSOR_MISMATCH);
    expect(v.canDispatch).toBe(false);
  });

  it('LOT_REUSED_ACROSS_ORDERS: one physical lot cannot leave twice', async () => {
    const input = twoGoodOrders();
    input.orders[1].lots = [{ greigeStockLotId: 'lot-1', qty: 3000 }];
    const v = await validateDispatch(input);
    expect(v.dispatchBlockers.map((b) => b.code)).toContain(ISSUE_ERROR_CODES.LOT_REUSED_ACROSS_ORDERS);
    expect(v.dispatchBlockers[0].message).toContain('DJ-EBEW-003-001');
    expect(v.dispatchBlockers[0].message).toContain('DJ-LNG226-001');
  });

  it('the same lot listed twice within ONE order stays LOT_DUPLICATE, not a cross-order reuse', async () => {
    armMulti(
      { 'jwo-1': baseJwo({ id: 'jwo-1', qtySentMeters: 5000 }) },
      { 'lot-1': baseLot({ quantityAvailable: 6000 }) }
    );
    const v = await validateDispatch({
      userId: 'u1',
      processorId: PROCESSOR_ID,
      orders: [
        {
          jwoId: 'jwo-1',
          lots: [
            { greigeStockLotId: 'lot-1', qty: 2500 },
            { greigeStockLotId: 'lot-1', qty: 2500 },
          ],
        },
      ],
    });
    expect(v.dispatchBlockers.map((b) => b.code)).not.toContain(ISSUE_ERROR_CODES.LOT_REUSED_ACROSS_ORDERS);
    expect(v.orderBlockers[0].blockers.map((b) => b.code)).toContain(ISSUE_ERROR_CODES.LOT_DUPLICATE);
    expect(v.canDispatch).toBe(false);
  });

  it("a single order's own blockers are reported against that order, named", async () => {
    const input = twoGoodOrders();
    // jwo-2 is already on its way — it must not ride a second truck
    armMulti(
      {
        'jwo-1': baseJwo({ id: 'jwo-1', qtySentMeters: 5000 }),
        'jwo-2': baseJwo({
          id: 'jwo-2',
          jobWorkNumber: 'DJ-LNG226-001',
          qtySentMeters: 3000,
          sentDate: new Date('2026-08-18'),
        }),
      },
      { 'lot-1': baseLot({ quantityAvailable: 6000 }), 'lot-2': baseLot({ id: 'lot-2', quantityAvailable: 4000 }) }
    );
    const v = await validateDispatch(input);
    expect(v.orderBlockers).toHaveLength(1);
    expect(v.orderBlockers[0].jwoId).toBe('jwo-2');
    expect(v.orderBlockers[0].jobWorkNumber).toBe('DJ-LNG226-001');
    expect(v.orderBlockers[0].blockers.map((b) => b.code)).toContain(ISSUE_ERROR_CODES.ALREADY_ISSUED);
    expect(v.canDispatch).toBe(false);
  });

  it('NO_ORDERS for an empty truck', async () => {
    const v = await validateDispatch({ userId: 'u1', processorId: PROCESSOR_ID, orders: [] });
    expect(v.dispatchBlockers.map((b) => b.code)).toEqual([ISSUE_ERROR_CODES.NO_ORDERS]);
    expect(v.canDispatch).toBe(false);
  });
});
