/**
 * Material Ledger, end to end against the real tables (2026-09-21).
 *
 * The unit suite pins the arithmetic on hand-built events. This one pins the part that arithmetic
 * cannot reach: that the loader actually FINDS a material's history, which is spread across a lot
 * table, a transaction table, challan lines and stock_movements depending on the door the stock
 * came through. A renamed relation or a changed `select` makes the page return an empty ledger
 * that looks perfectly healthy — no error, no warning, just a material that appears never to have
 * moved. Both such mistakes were caught by hand while building this; neither would fail a unit test.
 *
 * The invariant worth defending is the last assertion in each block: CLOSING EQUALS ON HAND. The
 * receipt is derived by balancing back from what is left, so if the loader misses a movement the
 * closing balance and the stock tables stop agreeing, and the drift badge fires. That is the whole
 * safety property of the design, and it is only testable against a real database.
 */

import { Unit } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { getMaterialLedger } from '../../services/material-ledger.service';
import greigeStockService from '../../services/greige-stock.service';
import { createChallan } from '../../services/challan.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';

const RUN = `MLG${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let warehouseId: string;
let otherWarehouseId: string;
let supplierId: string;
let greigeId: string;
let materialId: string;
let lotId: string;
let challanId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const RECEIVED = 100;
const ISSUED = 40;
const RETURNED = 15;
/** 100 in, 40 out, 15 back */
const EXPECTED_CLOSING = RECEIVED - ISSUED + RETURNED;

const RECEIVED_ON = new Date('2026-08-01T00:00:00Z');

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  const [warehouse, other] = await Promise.all([
    prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH`,
        warehouseName: `${RUN} Main Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    }),
    prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-W2`,
        warehouseName: `${RUN} Second Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    }),
  ]);
  warehouseId = warehouse.id;
  otherWarehouseId = other.id;

  const supplier = await prisma.suppliers.create({
    data: {
      code: `${RUN}-SUP`,
      name: `${RUN} Weavers`,
      supplierCategories: ['GREIGE_SUPPLIER'],
      isActive: true,
      createdById: userId,
    },
  });
  supplierId = supplier.id;

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GG`,
      greigeName: `${RUN} Poplin`,
      genericGreigeName: `${RUN} Poplin`,
      composition: '100% Cotton',
      greigeWidth: 52,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  // A received lot, dated in the past — the ledger must date the receipt from the lot, not from
  // when the rows happened to be written.
  const lot = await prisma.greige_stock.create({
    data: {
      greigeId,
      quantityAvailable: RECEIVED,
      greigeWidth: 52,
      receivedDate: RECEIVED_ON,
      purchaseCost: 40,
      weightedAvgCost: 40,
      supplierId,
      warehouseId,
      sourceType: 'MANUAL',
      createdById: userId,
    },
  });
  lotId = lot.id;

  materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(materialId, RECEIVED, warehouseId, 'METER');

  // --- an issue on a challan, the way stock actually leaves -----------------------------------
  const challan = await createChallan({
    challanType: 'OUTWARD',
    challanDate: new Date('2026-09-05T00:00:00Z'),
    fromType: 'WAREHOUSE',
    fromName: `${RUN} Main Store`,
    toType: 'DEPARTMENT',
    toName: `${RUN} Cutting Floor`,
    issuedById: userId,
    unit: Unit.METER,
    remarks: `${RUN} issue`,
    items: [
      {
        itemType: 'GREIGE',
        greigeStockId: lotId,
        description: `${RUN} greige issued`,
        quantity: ISSUED,
        unit: Unit.METER,
      },
    ],
  });
  challanId = challan.id;

  await greigeStockService.consumeGreigeStock(lotId, ISSUED, userId, undefined, {
    referenceType: 'CHALLAN',
    referenceId: challan.id,
    notes: `${RUN} issued to cutting`,
  });

  // --- and part of it comes back ---------------------------------------------------------------
  await greigeStockService.returnGreigeStock(lotId, RETURNED, userId, undefined, {
    referenceType: 'CHALLAN',
    referenceId: challan.id,
    notes: `${RUN} unused, returned to store`,
  });

  // The transactions above are stamped now(); date them so the window assertions mean something.
  const txns = await prisma.greige_stock_transaction.findMany({
    where: { stockId: lotId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, transactionType: true },
  });
  for (const t of txns) {
    await prisma.greige_stock_transaction.update({
      where: { id: t.id },
      data: {
        transactionDate: new Date(t.transactionType === 'RETURN' ? '2026-09-18T00:00:00Z' : '2026-09-05T00:00:00Z'),
      },
    });
  }
});

afterAll(async () => {
  // Per-step teardown, never one wrapping try/catch — a single catch hides the first failure and
  // leaves fixtures in the live data.
  await prisma.challan_items.deleteMany({ where: { challanId: only(challanId) } });
  await prisma.challans.deleteMany({ where: { id: only(challanId) } });
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.stock_movements.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_levels.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  // createGreigeStock mints a fabric_procurement for manual entries; this fixture creates the lot
  // directly, but delete defensively so a future change to that path cannot strand a row.
  await prisma.fabric_procurement.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.warehouses.deleteMany({ where: { id: { in: [only(warehouseId), only(otherWarehouseId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('material ledger against real tables', () => {
  it('finds the whole history of a material from its lot and its transactions', async () => {
    const ledger = await getMaterialLedger(materialId, {});

    expect(ledger.material.code).toBe(`${RUN}-GG`);
    expect(ledger.material.kind).toBe('GREIGE');

    const shape = ledger.rows.map((r) => `${r.kind}:${r.qty}`);
    expect(shape).toEqual([`RECEIPT:${RECEIVED}`, `ISSUE:${ISSUED}`, `RETURN:${RETURNED}`]);
    expect(ledger.rows.map((r) => r.balance)).toEqual([100, 60, 75]);
    expect(ledger.totals.closing).toBe(EXPECTED_CLOSING);
  });

  it('ties the closing balance to what the stock tables actually hold', async () => {
    const ledger = await getMaterialLedger(materialId, {});

    // The safety property of the whole design: if the loader missed a movement these diverge.
    expect(ledger.onHand.lotsAvailable).toBe(EXPECTED_CLOSING);
    expect(ledger.onHand.stockLevels).toBe(EXPECTED_CLOSING);
    expect(ledger.onHand.ledgerClosingAllTime).toBe(EXPECTED_CLOSING);
    expect(ledger.onHand.drift).toBe(false);
  });

  it('names the document and the party behind each movement', async () => {
    const ledger = await getMaterialLedger(materialId, {});

    const receipt = ledger.rows.find((r) => r.kind === 'RECEIPT')!;
    expect(receipt.source.type).toBe('STOCK_IN');
    expect(receipt.warehouse?.name).toBe(`${RUN} Main Store`);

    const issue = ledger.rows.find((r) => r.kind === 'ISSUE')!;
    expect(issue.source.type).toBe('CHALLAN');
    expect(issue.source.number).toBeTruthy(); // resolved from the challan, not left as a raw id
    expect(issue.source.destination).toBe(`${RUN} Cutting Floor`);
    expect(issue.source.route).toBe(`/manufacturing/challans/${challanId}`);
  });

  it('dates the receipt from the lot, not from when the rows were written', async () => {
    const ledger = await getMaterialLedger(materialId, {});
    const receipt = ledger.rows.find((r) => r.kind === 'RECEIPT')!;
    expect(new Date(receipt.date).toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('puts everything before the window into an opening balance', async () => {
    const ledger = await getMaterialLedger(materialId, { from: new Date('2026-09-10T00:00:00Z') });

    // The August receipt and the 5 Sept issue are both behind us: 100 − 40.
    expect(ledger.opening).toBe(60);
    expect(ledger.rows.map((r) => r.kind)).toEqual(['RETURN']);
    expect(ledger.totals.closing).toBe(EXPECTED_CLOSING);
    // A window never changes what is physically on the shelf.
    expect(ledger.onHand.ledgerClosingAllTime).toBe(EXPECTED_CLOSING);
  });

  it('reports no opening balance when no start date was asked for', async () => {
    expect((await getMaterialLedger(materialId, {})).opening).toBeNull();
  });

  it('shows nothing for a warehouse this material never sat in', async () => {
    const ledger = await getMaterialLedger(materialId, { warehouseId: otherWarehouseId });

    expect(ledger.rows).toHaveLength(0);
    expect(ledger.totals.closing).toBe(0);
    expect(ledger.onHand.lotsAvailable).toBe(0);
    expect(ledger.filters.warehouseName).toBe(`${RUN} Second Store`);
  });

  it('keeps the full history when filtered to the warehouse it did sit in', async () => {
    const ledger = await getMaterialLedger(materialId, { warehouseId });
    expect(ledger.rows).toHaveLength(3);
    expect(ledger.totals.closing).toBe(EXPECTED_CLOSING);
    expect(ledger.onHand.drift).toBe(false);
  });

  it('refuses a material that does not exist', async () => {
    await expect(getMaterialLedger('00000000-0000-0000-0000-000000000000', {})).rejects.toThrow(/not found/i);
  });
});
