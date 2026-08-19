/**
 * Issuance consolidation — validateIssue blocker matrix (mocked prisma, no DB).
 *
 * The service is the single implementation of "issue material to processor"; these
 * tests pin the validation rules that the four old paths never had: greige identity,
 * width tolerance, R6, processor-held lots, quantity totals, and the no-lot trap.
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
import { validateIssue, ISSUE_ERROR_CODES } from '../../services/job-work-issuance.service';

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

  it('falls back to the JWO-stamped lot when no explicit lots are passed', async () => {
    arm(baseJwo({ greigeStockLotId: 'lot-1' }), { 'lot-1': baseLot() });
    const v = await validateIssue('jwo-1', {});
    expect(v.blockers).toEqual([]);
    expect(v.lots).toHaveLength(1);
    expect(v.lots[0].qty).toBe(8792.09);
  });
});
