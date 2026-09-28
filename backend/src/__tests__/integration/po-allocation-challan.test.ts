/**
 * Challans and the work order's trim issue against goods held for orders (docs/plans/po-allocation-design.md §6.7,
 * owner decisions D2, D10; C9), over HTTP as the screens post them:
 *
 *  - a run's trim issue data counts what other orders hold as "held for other orders", never as free;
 *  - a trim issue for the order the goods arrived for uses that order's own hold;
 *  - issuing trims held for another order is refused (409 STOCK_HELD_FOR_ORDER, naming who holds them) and changes
 *    nothing; confirmed (takeHeld) it goes through, the order needing them last loses them first, and its need
 *    reopens as a PO_REQUIRED balance row;
 *  - trims given back on an inward challan are held for the order again, and a row on a PO keeps its PO status;
 *  - a Stock-Out internal issue that names its order uses that order's hold; naming none, every holder is
 *    "another order" (refused);
 *  - lace: an issue for the order uses its hold on the lot; an issue that would take another order's lace is
 *    refused, and confirmed it reopens that order's need; lace given back is held again.
 *
 * Tagged fixtures (RUN), everything torn down. The trim is booked in the oldest active store because the challan's
 * trim branch always draws from it; only this test's own material has rows there.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { allocatePoLines } from '../../services/helpers/po-allocation.helper';
import { applyLineReceipts } from '../../services/helpers/receipt-allocation.helper';
import {
  heldForRequirement,
  receiptHeldByRequirement,
  reserveOnLots,
} from '../../services/helpers/stock-reservation.helper';
import { getDerivedOnHandMap } from '../../services/helpers/derived-stock.helper';

jest.setTimeout(180000);

const RUN = `PAC${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let auth: Record<string, string>;
let supplierId: string;
let customerId: string;
let styleId: string;
let storeId: string; // the oldest active store — the trim branch's warehouse
let labWarehouseId: string; // this test's own store, for the lace lot
let trimMasterId: string;
let mT: string;
let laceId: string;
let laceMaterialId: string;
let laceLot: string;
let poId: string;
let lineId: string;
const materialIds: string[] = [];
const orderIds: string[] = [];
const orderItemIds: string[] = [];
const bomIds: string[] = [];
const workOrderIds: string[] = [];
const O: Record<string, string> = {};
const R: Record<string, string> = {};
const WO: Record<string, string> = {};

async function makeOrder(name: string, deliveryInDays: number) {
  const id = randomUUID();
  await prisma.orders.create({
    data: {
      id,
      orderNumber: `${RUN}-${name}`,
      customerId,
      status: 'IN_PRODUCTION',
      expectedDeliveryDate: new Date(Date.now() + deliveryInDays * DAY),
      totalQuantity: 100,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderIds.push(id);
  O[name] = id;
}

/** A running work order for the order, with an order BOM carrying the trim (what the trim issue data reads) */
async function makeRun(orderName: string) {
  const orderItemId = randomUUID();
  await prisma.order_items.create({
    data: { id: orderItemId, orderId: O[orderName], styleId, totalQuantity: 100, unitPrice: 10, totalPrice: 1000 },
  });
  orderItemIds.push(orderItemId);
  const bom = await prisma.order_bom.create({
    data: {
      orderId: O[orderName],
      styleId,
      orderItemId,
      createdById: userId,
      status: 'APPROVED',
      isActive: true,
      version: 1,
    },
  });
  bomIds.push(bom.id);
  await prisma.order_bom_items.create({
    data: {
      id: randomUUID(),
      orderBomId: bom.id,
      materialType: 'ACCESSORIES',
      materialId: mT,
      quantityPerGarment: 3,
      orderQuantity: 100,
      totalQuantity: 300,
      unit: 'PIECE',
      unitPrice: 1,
      totalCost: 300,
    },
  });
  const id = randomUUID();
  await prisma.work_orders.create({
    data: {
      id,
      workOrderNumber: `${RUN}-WO-${orderName}`,
      orderId: O[orderName],
      orderItemId,
      styleId,
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 20 * DAY),
      totalQuantity: 100,
      status: 'IN_PRODUCTION',
      createdById: userId,
    },
  });
  workOrderIds.push(id);
  WO[orderName] = id;
}

async function makeRequirement(
  name: string,
  materialId: string,
  orderName: string,
  need: number,
  extra: Record<string, unknown> = {}
) {
  const id = randomUUID();
  await prisma.material_requirements.create({
    data: {
      id,
      requirementNumber: `${RUN}-${name}`,
      source: 'MANUAL',
      unit: 'PIECE',
      materialId,
      orderId: O[orderName],
      orderQuantity: 1,
      quantityPerUnit: need,
      wastagePercent: 0,
      totalRequired: need,
      shortfall: need,
      status: 'PO_REQUIRED',
      requiredDate: new Date(Date.now() + 25 * DAY),
      createdById: userId,
      ...extra,
    },
  });
  R[name] = id;
}

const req = (name: string) => prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
const receiptHeld = async (name: string) => (await receiptHeldByRequirement(prisma, [R[name]])).get(R[name]) ?? 0;
const onHand = async (materialId: string) => (await getDerivedOnHandMap([materialId])).get(materialId) ?? 0;
const lotFigures = async (id: string) => {
  const lot = await prisma.lace_stock.findUniqueOrThrow({ where: { id } });
  return [Number(lot.quantityAvailable), Number(lot.quantityReserved)];
};
const trimLine = (quantity: number) => ({
  items: [{ materialId: mT, quantity, unit: 'PIECE', description: `${RUN} trim` }],
});

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  auth = getAuthHeader(userId, 'ADMIN');
  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}-SUP`, name: `${RUN} Supplier`, createdById: userId } })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  storeId = (
    await prisma.warehouses.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
  ).id;
  labWarehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ST`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        createdById: userId,
      },
    })
  ).id;

  trimMasterId = (
    await prisma.other_material_master.create({
      data: { materialCode: `${RUN}-TRIM`, materialName: `${RUN} Trim` },
    })
  ).id;
  mT = await ensureMaterialRecord(trimMasterId, 'OTHER_MATERIAL');
  materialIds.push(mT);
  laceId = (await prisma.lace_master.create({ data: { laceCode: `${RUN}-LACE`, laceName: `${RUN} Lace` } })).id;
  laceMaterialId = await ensureMaterialRecord(laceId, 'LACE');
  materialIds.push(laceMaterialId);

  await makeOrder('O1', 10);
  await makeOrder('O2', 20);
  await makeOrder('O3', 30);
  await makeRun('O1');
  await makeRun('O3');

  // A sent PO for 1,000 of the trim, linked to O1 and O2 for 300 each
  poId = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id: poId,
      poNumber: `${RUN}-PO`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 15 * DAY),
      status: 'SENT',
      poCategory: 'TRIMS',
      createdById: userId,
    },
  });
  lineId = randomUUID();
  await prisma.purchase_order_items.create({
    data: { id: lineId, poId, materialId: mT, orderedQuantity: 1000, unitPrice: 1, totalPrice: 1000, unit: 'PIECE' },
  });
  await makeRequirement('r1', mT, 'O1', 300);
  await makeRequirement('r2', mT, 'O2', 300);
  await allocatePoLines(
    poId,
    [
      { purchaseOrderItemId: lineId, requirementId: R.r1, quantity: 300 },
      { purchaseOrderItemId: lineId, requirementId: R.r2, quantity: 300 },
    ],
    userId
  );

  // 600 arrive in the store: all of it is O1's and O2's
  await prisma.goods_receiving_notes.create({
    data: {
      id: randomUUID(),
      grnNumber: `${RUN}-GRN`,
      poId,
      supplierId,
      warehouseId: storeId,
      status: 'ACCEPTED',
      receivedById: userId,
      approvedById: userId,
      receivingDate: new Date(),
      grn_items: {
        create: [
          {
            id: randomUUID(),
            poItemId: lineId,
            materialId: mT,
            orderedQuantity: 600,
            receivedQuantity: 600,
            acceptedQuantity: 600,
            stockQuantity: 600,
            unit: 'PIECE',
          },
        ],
      },
    },
  });
  await prisma.other_material_stock.create({
    data: {
      otherMaterialId: trimMasterId,
      quantityAvailable: 600,
      purchaseCost: 1,
      weightedAvgCost: 1,
      receivedDate: new Date(),
      warehouseId: storeId,
    },
  });
  await prisma.stock_levels.create({ data: { materialId: mT, warehouseId: storeId, quantity: 600, unit: 'PIECE' } });
  await prisma.$transaction((tx) => applyLineReceipts(tx, [lineId], { event: 'approve', userId }), {
    timeout: 30000,
  });
});

afterAll(async () => {
  const challanWhere = {
    OR: [
      { orderId: { in: orderIds } },
      { productionRunId: { in: workOrderIds } },
      { items: { some: { materialId: { in: materialIds } } } },
      ...(laceLot ? [{ items: { some: { laceStockId: only(laceLot) } } }] : []),
    ],
  };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['challans', () => prisma.challans.deleteMany({ where: challanWhere })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: only(poId) } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: only(poId) } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: only(poId) } })],
    ['movements', () => prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock transactions', () => prisma.stock_transactions.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['trim lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(trimMasterId) } })],
    ['lace ledger', () => prisma.lace_stock_transaction.deleteMany({ where: { stock: { laceId: only(laceId) } } })],
    ['lace lots', () => prisma.lace_stock.deleteMany({ where: { laceId: only(laceId) } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: only(poId) } })],
    ['po', () => prisma.purchase_orders.deleteMany({ where: { id: only(poId) } })],
    [
      'balance rows',
      () =>
        prisma.material_requirements.deleteMany({
          where: { materialId: { in: materialIds }, splitFromId: { not: null } },
        }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['work orders', () => prisma.work_orders.deleteMany({ where: { id: { in: workOrderIds } } })],
    ['bom items', () => prisma.order_bom_items.deleteMany({ where: { orderBomId: { in: bomIds } } })],
    ['boms', () => prisma.order_bom.deleteMany({ where: { id: { in: bomIds } } })],
    ['order items', () => prisma.order_items.deleteMany({ where: { id: { in: orderItemIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['style', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['warehouse', () => prisma.warehouses.deleteMany({ where: { id: only(labWarehouseId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['trim master', () => prisma.other_material_master.deleteMany({ where: { id: only(trimMasterId) } })],
    ['lace master', () => prisma.lace_master.deleteMany({ where: { id: only(laceId) } })],
    ['supplier', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-challan teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('trims held for orders, at the work order issue', () => {
  it('the arrived goods are held for the linked orders', async () => {
    expect([await receiptHeld('r1'), await receiptHeld('r2')]).toEqual([300, 300]);
    expect((await req('r1')).status).toBe('RECEIVED');
  });

  it("a run's issue data shows what other orders hold, and does not count it as free", async () => {
    const res = await request(app).get(`/api/work-orders/${WO.O1}/trim-issuance-data`).set(auth);
    expect(res.status).toBe(200);
    const line = res.body.data.items.find((i: { materialId: string }) => i.materialId === mT);
    // O1's own 300 are its to issue; O2's 300 are not
    expect([line.availableStock, line.heldForOthers]).toEqual([300, 300]);
  });

  it('an issue for the order the goods arrived for uses its own hold', async () => {
    const res = await request(app).post(`/api/work-orders/${WO.O1}/issue-trims`).set(auth).send(trimLine(200));
    expect(res.status).toBe(201);
    expect([await receiptHeld('r1'), await receiptHeld('r2')]).toEqual([100, 300]);
    expect(await onHand(mT)).toBe(400);
  });

  it('an issue of goods held for other orders is refused, naming who holds them, and changes nothing', async () => {
    const res = await request(app).post(`/api/work-orders/${WO.O3}/issue-trims`).set(auth).send(trimLine(250));
    expect(res.status).toBe(409);
    expect(res.body.details.code).toBe('STOCK_HELD_FOR_ORDER');
    expect(res.body.details.heldFor).toEqual([
      { requirementNumber: `${RUN}-r2`, orderNumber: `${RUN}-O2`, styleCode: null, qty: 300, unit: 'PIECE' },
      { requirementNumber: `${RUN}-r1`, orderNumber: `${RUN}-O1`, styleCode: null, qty: 100, unit: 'PIECE' },
    ]);
    expect(await onHand(mT)).toBe(400);
    expect([await receiptHeld('r1'), await receiptHeld('r2')]).toEqual([100, 300]);
    // The refused challan does not linger as a draft
    const left = await prisma.challans.count({ where: { productionRunId: WO.O3, status: { not: 'CANCELLED' } } });
    expect(left).toBe(0);
  });

  it('taken anyway: the order needing them last loses them, and its need reopens to be bought again', async () => {
    const res = await request(app)
      .post(`/api/work-orders/${WO.O3}/issue-trims`)
      .set(auth)
      .send({ ...trimLine(250), takeHeld: true });
    expect(res.status).toBe(201);
    expect(await onHand(mT)).toBe(150);
    // O2 (delivers after O1) loses 250 of its 300; O1 keeps its 100
    expect([await receiptHeld('r1'), await receiptHeld('r2')]).toEqual([100, 50]);
    const balance = await prisma.material_requirements.findFirstOrThrow({ where: { splitFromId: R.r2 } });
    expect([balance.status, Number(balance.shortfall), balance.orderId]).toEqual(['PO_REQUIRED', 250, O.O2]);
    const audit = await prisma.audit_logs.findFirst({
      where: { entityType: 'material_requirement', entityId: R.r2, userId },
    });
    expect(audit?.newValues).toMatchObject({ event: 'HELD_GOODS_TAKEN', takenFor: `${RUN}-O3`, fromReceiptHold: 250 });

    // What is left on the shelf is all held for others as far as O3 is concerned
    const data = await request(app).get(`/api/work-orders/${WO.O3}/trim-issuance-data`).set(auth);
    const line = data.body.data.items.find((i: { materialId: string }) => i.materialId === mT);
    expect([line.availableStock, line.heldForOthers]).toEqual([0, 150]);
  });

  it('trims given back on an inward challan are held for the order again; its PO row keeps its PO status', async () => {
    const created = await request(app)
      .post('/api/challans')
      .set(auth)
      .send({
        challanType: 'INWARD',
        orderId: O.O1,
        fromType: 'DEPARTMENT',
        fromName: 'Stitching',
        toType: 'WAREHOUSE',
        toName: 'Trim Store',
        items: [
          {
            itemType: 'TRIM',
            materialId: mT,
            materialRequirementId: R.r1,
            description: `${RUN} trim back`,
            quantity: 50,
            unit: 'PIECE',
          },
        ],
      });
    expect(created.status).toBe(201);
    const res = await request(app)
      .put(`/api/challans/${created.body.data.id}/receive`)
      .set(auth)
      .send({ items: [{ challanItemId: created.body.data.items[0].id, receivedQty: 50 }] });
    expect(res.status).toBe(200);
    expect(await onHand(mT)).toBe(200);
    expect(await receiptHeld('r1')).toBe(150);
    expect((await req('r1')).status).toBe('RECEIVED');
  });

  it("a Stock-Out internal issue that names its order uses that order's hold — nobody else loses theirs", async () => {
    // As the Stock-Out screen posts it; every one of the 200 on the shelf is held (O1 150, O2 50)
    const stockOut = (orderName: string | null) => ({
      challanType: 'INTERNAL',
      ...(orderName ? { orderId: O[orderName] } : {}),
      fromType: 'WAREHOUSE',
      fromName: 'Main Store',
      toType: 'DEPARTMENT',
      toName: 'Stitching',
      unit: 'PIECE',
      items: [{ itemType: 'TRIM', materialId: mT, description: `${RUN} trim`, quantity: 50, unit: 'PIECE' }],
    });
    const balancesOfR2 = () => prisma.material_requirements.count({ where: { splitFromId: R.r2 } });
    const balancesBefore = await balancesOfR2();

    // Naming no order, every holder is "another order"
    const anon = await request(app).post('/api/challans/quick-issue').set(auth).send(stockOut(null));
    expect(anon.status).toBe(409);
    expect(anon.body.details.code).toBe('STOCK_HELD_FOR_ORDER');

    // For O2: its own 50 go out, O1 keeps its 150, and no order's need reopens
    const named = await request(app).post('/api/challans/quick-issue').set(auth).send(stockOut('O2'));
    expect(named.status).toBe(201);
    expect(named.body.data.orderId).toBe(O.O2);
    expect(await onHand(mT)).toBe(150);
    expect([await receiptHeld('r1'), await receiptHeld('r2')]).toEqual([150, 0]);
    expect(await balancesOfR2()).toBe(balancesBefore);
  });
});

describe('lace held for an order, at the challan issue', () => {
  beforeAll(async () => {
    const lot = await prisma.lace_stock.create({
      data: {
        laceId,
        quantityAvailable: 100,
        weightedAvgCost: 10,
        purchaseCost: 10,
        receivedDate: new Date(),
        warehouseId: labWarehouseId,
        lotNumber: `${RUN}-L1`,
      },
    });
    laceLot = lot.id;
    await prisma.stock_levels.create({
      data: { materialId: laceMaterialId, warehouseId: labWarehouseId, quantity: 100, unit: 'METER' },
    });
    // O2 took 50 m of the lot from stock (Use Stock)
    await makeRequirement('rL', laceMaterialId, 'O2', 50, {
      unit: 'METER',
      status: 'FULFILLED_STOCK',
      allocatedFromStock: 50,
      shortfall: 0,
    });
    await prisma.$transaction((tx) =>
      reserveOnLots(tx, {
        requirement: { id: R.rL, requirementNumber: `${RUN}-rL`, materialId: laceMaterialId, unit: 'METER' },
        lots: [{ table: 'lace', lotId: laceLot, warehouseId: labWarehouseId, quantity: 50 }],
        userId,
        fallbackWarehouseId: labWarehouseId,
      })
    );
  });

  const laceChallan = async (
    orderName: string | null,
    qty: number,
    challanType: 'INTERNAL' | 'INWARD' = 'INTERNAL'
  ) => {
    const res = await request(app)
      .post('/api/challans')
      .set(auth)
      .send({
        challanType,
        ...(orderName ? { orderId: O[orderName] } : {}),
        fromType: challanType === 'INWARD' ? 'DEPARTMENT' : 'WAREHOUSE',
        fromName: challanType === 'INWARD' ? 'Stitching' : `${RUN} Store`,
        toType: challanType === 'INWARD' ? 'WAREHOUSE' : 'DEPARTMENT',
        toName: challanType === 'INWARD' ? `${RUN} Store` : 'Stitching',
        items: [{ itemType: 'LACE', laceStockId: laceLot, description: `${RUN} lace`, quantity: qty, unit: 'METER' }],
      });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; items: Array<{ id: string }> };
  };

  it('an issue for the order uses its hold on the lot', async () => {
    const challan = await laceChallan('O2', 30);
    const res = await request(app).put(`/api/challans/${challan.id}/issue`).set(auth);
    expect(res.status).toBe(200);
    expect(await heldForRequirement(prisma, R.rL)).toBe(20);
    expect(await lotFigures(laceLot)).toEqual([70, 20]);
  });

  it("an issue that would take another order's lace is refused; taken anyway, that order's need reopens", async () => {
    const challan = await laceChallan(null, 60);
    const refused = await request(app).put(`/api/challans/${challan.id}/issue`).set(auth).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.details).toEqual({
      code: 'STOCK_HELD_FOR_ORDER',
      heldFor: [{ requirementNumber: `${RUN}-rL`, orderNumber: `${RUN}-O2`, styleCode: null, qty: 20, unit: 'METER' }],
    });
    expect(await lotFigures(laceLot)).toEqual([70, 20]);

    const taken = await request(app).put(`/api/challans/${challan.id}/issue`).set(auth).send({ takeHeld: true });
    expect(taken.status).toBe(200);
    expect(await lotFigures(laceLot)).toEqual([10, 10]);
    const rL = await req('rL');
    expect([rL.status, Number(rL.allocatedFromStock), Number(rL.shortfall)]).toEqual(['PARTIAL_STOCK', 40, 10]);
    expect(await heldForRequirement(prisma, R.rL)).toBe(10);
  });

  it('lace given back to the lot is held for the order again', async () => {
    const challan = await laceChallan('O2', 10, 'INWARD');
    const res = await request(app)
      .put(`/api/challans/${challan.id}/receive`)
      .set(auth)
      .send({ items: [{ challanItemId: challan.items[0].id, receivedQty: 10 }] });
    expect(res.status).toBe(200);
    expect(await heldForRequirement(prisma, R.rL)).toBe(20);
    expect(await lotFigures(laceLot)).toEqual([20, 20]);
  });
});
