/**
 * Goods held for an order never leave on a path that does not ask (2026-10-03).
 *
 * The issue screens refused goods held for other orders and took them only on "take them anyway" (po-allocation
 * D10); the generic stock paths did not ask at all. A Stock-Out drew lots oldest first and emptied the lot an
 * order's greige was held on; a transfer moved held metres to a new lot and stranded the hold; a lace issue note
 * refused the order's OWN holds.
 *
 * Walks, through the real services on garment_erp_test (tagged fixtures, torn down):
 *  - a Stock-Out takes FREE stock first, then refuses the held part (409 STOCK_HELD_FOR_ORDER) unless confirmed;
 *    confirmed, the hold shrinks and the holding order's need reopens;
 *  - a transfer never moves held metres;
 *  - a lace issue note may use lace held for its own order (the hold is consumed into it).
 */

import { randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import stockMovementService from '../../services/stockMovement.service';
import { createLaceIssueNote } from '../../services/laceIssueNote.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { reserveOnLots } from '../../services/helpers/stock-reservation.helper';

const RUN = `HSG${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let customerId: string;
let storeA: string;
let storeB: string;
let greigeId: string;
let greigeMaterialId: string;
let oldLot: string;
let newLot: string;
let laceId: string;
let laceLot: string;
let styleId: string;
let holderOrder: string;
let otherOrder: string;
let holderReq: string;
let laceReq: string;

const lotQty = async (id: string) =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id } })).quantityAvailable);
const heldOn = async (reqId: string) => {
  const rows = await prisma.stock_reservations.findMany({ where: { referenceId: reqId, status: 'ACTIVE' } });
  return rows.reduce((sum, r) => sum + Number(r.reservedQuantity) - Number(r.consumedQuantity), 0);
};
const stockOut = (qty: number, takeHeld = false) =>
  stockMovementService.createStockOut(
    {
      movementType: 'STOCK_OUT',
      materialId: greigeMaterialId,
      warehouseId: storeA,
      quantity: new Decimal(qty),
      unit: 'METER',
      performedById: userId,
    },
    undefined,
    { takeHeld, userId, reference: `${RUN} Stock-Out` }
  );

async function makeOrder(n: number) {
  const id = randomUUID();
  await prisma.orders.create({
    data: {
      id,
      orderNumber: `${RUN}ORD${n}`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 20 * DAY),
      totalQuantity: 10,
      totalAmount: 100,
      createdById: userId,
    },
  });
  return id;
}

async function stockRequirement(orderId: string, materialId: string, qty: number) {
  return (
    await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-MR${Math.random().toString(36).slice(2, 7)}`,
        source: 'MANUAL',
        unit: 'METER',
        materialId,
        orderId,
        orderQuantity: 1,
        quantityPerUnit: qty,
        wastagePercent: 0,
        totalRequired: qty,
        allocatedFromStock: qty,
        shortfall: 0,
        status: 'FULFILLED_STOCK',
        requiredDate: new Date(Date.now() + 10 * DAY),
        createdById: userId,
      },
    })
  ).id;
}

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  const mkStore = async (n: string) =>
    (
      await prisma.warehouses.create({
        data: {
          warehouseCode: `${RUN}-${n}`,
          warehouseName: `${RUN} Store ${n}`,
          warehouseType: 'RAW_MATERIAL',
          isActive: true,
          createdById: userId,
        },
      })
    ).id;
  storeA = await mkStore('A');
  storeB = await mkStore('B');

  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GRG`,
        greigeName: `${RUN} Cambric`,
        composition: '100% Cotton',
        greigeWidth: 44,
        createdById: userId,
      },
    })
  ).id;
  greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  const mkLot = async (qty: number, daysAgo: number) =>
    (
      await prisma.greige_stock.create({
        data: {
          greigeId,
          quantityAvailable: qty,
          quantityReserved: 0,
          quantityConsumed: 0,
          unit: 'METER',
          greigeWidth: 44,
          purchaseCost: 50,
          weightedAvgCost: 50,
          warehouseId: storeA,
          receivedDate: new Date(Date.now() - daysAgo * DAY),
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          sourceType: 'DIRECT',
          createdById: userId,
        },
      })
    ).id;
  oldLot = await mkLot(100, 10);
  newLot = await mkLot(50, 1);
  await prisma.stock_levels.create({
    data: { materialId: greigeMaterialId, warehouseId: storeA, quantity: 150, unit: 'METER' },
  });

  holderOrder = await makeOrder(1);
  otherOrder = await makeOrder(2);
  // Order 1 holds 80 m on the OLD lot (Use Stock)
  holderReq = await stockRequirement(holderOrder, greigeMaterialId, 80);
  await prisma.$transaction((tx) =>
    reserveOnLots(tx, {
      requirement: { id: holderReq, requirementNumber: `${RUN}-HOLD`, materialId: greigeMaterialId, unit: 'METER' },
      lots: [{ table: 'greige', lotId: oldLot, warehouseId: storeA, quantity: 80 }],
      userId,
      fallbackWarehouseId: storeA,
    })
  );

  // Lace: 30 m on one lot, all of it held for order 2
  laceId = (
    await prisma.lace_master.create({
      data: { laceCode: `${RUN}-LC`, laceName: `${RUN} Lace`, laceType: 'Cotton', width: 1 },
    })
  ).id;
  await ensureMaterialRecord(laceId, 'LACE');
  laceLot = (
    await prisma.lace_stock.create({
      data: {
        laceId,
        quantityAvailable: 30,
        quantityReserved: 0,
        purchaseCost: 10,
        weightedAvgCost: 10,
        warehouseId: storeA,
        receivedDate: new Date(),
        status: 'AVAILABLE',
        createdById: userId,
      },
    })
  ).id;
  laceReq = await stockRequirement(otherOrder, laceId, 30);
  await prisma.$transaction((tx) =>
    reserveOnLots(tx, {
      requirement: { id: laceReq, requirementNumber: `${RUN}-LHOLD`, materialId: laceId, unit: 'METER' },
      lots: [{ table: 'lace', lotId: laceLot, warehouseId: storeA, quantity: 30 }],
      userId,
      fallbackWarehouseId: storeA,
    })
  );
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Top`, createdById: userId },
    })
  ).id;
});

afterAll(async () => {
  const orders = onlyAll([holderOrder, otherOrder]);
  const materials = onlyAll([greigeMaterialId, laceId]);
  const greigeLots = onlyAll([oldLot, newLot]);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['lace issue notes', () => prisma.lace_issue_note.deleteMany({ where: { stockId: only(laceLot) } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materials } } })],
    ['greige txns', () => prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: greigeLots } } })],
    ['greige lots', () => prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } })],
    ['lace txns', () => prisma.lace_stock_transaction.deleteMany({ where: { stockId: only(laceLot) } })],
    ['lace lots', () => prisma.lace_stock.deleteMany({ where: { laceId: only(laceId) } })],
    ['movements', () => prisma.stock_movements.deleteMany({ where: { materialId: { in: materials } } })],
    ['transactions', () => prisma.stock_transactions.deleteMany({ where: { materialId: { in: materials } } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materials } } })],
    ['stock settings', () => prisma.stock_settings.deleteMany({ where: { materialId: { in: materials } } })],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { orderId: { in: orders } } })],
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orders } } })],
    ['style', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materials } } })],
    ['greige', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['lace', () => prisma.lace_master.deleteMany({ where: { id: only(laceId) } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: { in: onlyAll([storeA, storeB]) } } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[held-stock-gates teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a Stock-Out takes free stock first and asks before taking held goods', () => {
  it('50 m out: the old lot gives only its free 20 m, the new lot the rest — the hold stays whole', async () => {
    await stockOut(50);
    expect(await lotQty(oldLot)).toBeCloseTo(80, 2);
    expect(await lotQty(newLot)).toBeCloseTo(20, 2);
    expect(await heldOn(holderReq)).toBeCloseTo(80, 2);
  });

  it('40 m more needs 20 m of order 1’s goods: refused with STOCK_HELD_FOR_ORDER', async () => {
    await expect(stockOut(40)).rejects.toMatchObject({
      statusCode: 409,
      details: { code: 'STOCK_HELD_FOR_ORDER' },
    });
    expect(await lotQty(newLot)).toBeCloseTo(20, 2); // nothing moved
  });

  it('confirmed: 20 m taken from the hold, and order 1’s need reopens', async () => {
    await stockOut(40, true);
    expect(await lotQty(newLot)).toBeCloseTo(0, 2);
    expect(await lotQty(oldLot)).toBeCloseTo(60, 2);
    expect(await heldOn(holderReq)).toBeCloseTo(60, 2);
    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: holderReq } });
    expect(Number(req.allocatedFromStock)).toBeCloseTo(60, 2);
  });
});

describe('a transfer never moves held metres', () => {
  it('everything left is held: refused', async () => {
    await expect(
      stockMovementService.createStockTransfer({
        materialId: greigeMaterialId,
        fromWarehouseId: storeA,
        toWarehouseId: storeB,
        quantity: new Decimal(10),
        unit: 'METER',
        performedById: userId,
      })
    ).rejects.toMatchObject({ details: { code: 'STOCK_HELD_NOT_MOVABLE' } });
    expect(await lotQty(oldLot)).toBeCloseTo(60, 2);
  });
});

describe('a lace issue note may use lace held for its own order', () => {
  it('order 2 issues 20 m of the 30 m held for it — its hold is consumed into the issue', async () => {
    const note = await createLaceIssueNote({
      orderId: otherOrder,
      styleId,
      stockId: laceLot,
      laceId,
      issuedQuantity: 20,
      issuedById: userId,
    });
    expect(Number(note.issuedQuantity)).toBe(20);
    expect(await heldOn(laceReq)).toBeCloseTo(10, 2);
  });

  it('another order cannot take the 10 m still held without confirming', async () => {
    await expect(
      createLaceIssueNote({
        orderId: holderOrder,
        styleId,
        stockId: laceLot,
        laceId,
        issuedQuantity: 5,
        issuedById: userId,
      })
    ).rejects.toMatchObject({ details: { code: 'STOCK_HELD_FOR_ORDER' } });
  });
});
