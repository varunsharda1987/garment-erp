/**
 * Job-work issue of greige held for another order (docs/plans/po-allocation-design.md §6.7, owner decision D10;
 * C9), through the real endpoints:
 *
 *  1. An issue that needs greige another order holds is refused with a 409 STOCK_HELD_FOR_ORDER that names who
 *     holds it — and nothing moves. The job's own order's hold is not in the way (an order may use its own).
 *  2. Sent again with takeHeld, it goes: the other order's hold shrinks by what was taken and its need reopens
 *     (less from stock, more to buy, audit-logged); the job's own hold is used up by the issue.
 *  3. The job cancelled and its cloth returned to stock: the job's order holds it again. What was taken from the
 *     other order comes back free — that order's need was already reopened.
 *  4. Send to Mill (the Dyeing / Printing lists) asks the same question and takes the same answer: a 409, then
 *     sent again with takeHeld.
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { heldForRequirement } from '../../services/helpers/stock-reservation.helper';
import { linkRequirementToLine, theOnlyLine } from '../../services/helpers/jwo-lines.helper';

jest.setTimeout(120000);

const RUN = `PAJ${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let customerId: string;
let greigeId: string;
let materialId: string;
let lotId: string;
let jwoId: string;
const orderIds: string[] = [];
const O: Record<string, string> = {};
const R: Record<string, string> = {};

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

async function makeRequirement(
  name: string,
  orderName: string,
  data: {
    requirementType?: 'MATERIAL' | 'PROCESSING';
    linkedRequirementId?: string;
    need: number;
    fromStock: number;
    status: 'FULFILLED_STOCK' | 'PARTIAL_STOCK' | 'PO_SENT';
  }
) {
  const id = randomUUID();
  await prisma.material_requirements.create({
    data: {
      id,
      requirementNumber: `${RUN}-${name}`,
      source: 'MANUAL',
      unit: 'METER',
      materialId,
      orderId: O[orderName],
      orderQuantity: 1,
      quantityPerUnit: data.need,
      wastagePercent: 0,
      totalRequired: data.need,
      allocatedFromStock: data.fromStock,
      shortfall: data.need - data.fromStock,
      status: data.status,
      requirementType: data.requirementType ?? 'MATERIAL',
      linkedRequirementId: data.linkedRequirementId ?? null,
      requiredDate: new Date(Date.now() + 20 * DAY),
      createdById: userId,
    },
  });
  R[name] = id;
  return id;
}

/** A Use Stock hold on the lot, as MRP's Use Stock writes it: the row, and the lot's reserved figure with it */
async function holdOnLot(requirementId: string, qty: number) {
  await prisma.stock_reservations.create({
    data: {
      materialId,
      warehouseId,
      reservationType: 'ORDER',
      referenceType: 'MATERIAL_REQUIREMENT',
      referenceId: requirementId,
      referenceNumber: `${RUN}-hold`,
      reservedQuantity: qty,
      unit: 'METER',
      status: 'ACTIVE',
      reservedById: userId,
      greigeStockId: lotId,
    },
  });
  await prisma.greige_stock.update({ where: { id: lotId }, data: { quantityReserved: { increment: qty } } });
}

const lot = () => prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } });
const req = (name: string) => prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
const held = (name: string) => heldForRequirement(prisma, R[name]);
const issue = (body: Record<string, unknown>) =>
  request(app).post(`/api/job-work-orders/${jwoId}/issue`).set(authHeader).send(body);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  dyerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-DYE`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: `${RUN} Poplin`,
        genericGreigeName: `${RUN} Poplin`,
        composition: '100% Cotton',
        greigeWidth: 48,
        createdById: userId,
      },
    })
  ).id;
  materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  lotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 1000,
        greigeWidth: 48,
        receivedDate: new Date(Date.now() - DAY),
        purchaseCost: 50,
        weightedAvgCost: 50,
        warehouseId,
        createdById: userId,
      },
    })
  ).id;
  await syncStockLevelQuantity(materialId, 1000, warehouseId, 'METER');

  // B needs the cloth first and holds 600 m of the lot; A (the job's order) holds 300 m of it and needs 500 m
  await makeOrder('A', 30);
  await makeOrder('B', 10);
  await makeRequirement('rB', 'B', { need: 600, fromStock: 600, status: 'FULFILLED_STOCK' });
  await holdOnLot(R.rB, 600);
  await makeRequirement('rA', 'A', { need: 500, fromStock: 300, status: 'PARTIAL_STOCK' });
  await holdOnLot(R.rA, 300);
  await makeRequirement('rAp', 'A', {
    requirementType: 'PROCESSING',
    linkedRequirementId: R.rA,
    need: 500,
    fromStock: 0,
    status: 'PO_SENT',
  });

  const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    quantity: 500,
    agreedRate: 20,
    expectedShrinkage: 10,
    colorName: 'Navy',
  });
  expect(created.status).toBe(201);
  jwoId = created.body.data.id;
  await linkRequirementToLine(prisma, {
    requirementId: R.rAp,
    jobWorkOrderId: jwoId,
    lineId: (await theOnlyLine(prisma, jwoId, 'Linking')).id,
    allocatedQuantity: 500,
  });
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jwoIds } }, { toId: only(dyerId) }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  const minted = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  const matWhere = { OR: [{ fabricId: { in: minted } }, { greigeId: only(greigeId) }] };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: only(materialId) } })],
    ['challan items', () => prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } })],
    ['components', () => prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } })],
    [
      'jwo challan pointers',
      () => prisma.job_work_orders.updateMany({ where: { id: { in: jwoIds } }, data: { outwardChallanId: null } }),
    ],
    ['challans', () => prisma.challans.deleteMany({ where: { id: { in: challanIds } } })],
    ['jwo links', () => prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } })],
    ['jwos', () => prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } })],
    [
      'balance rows',
      () =>
        prisma.material_requirements.deleteMany({
          where: { materialId: only(materialId), splitFromId: { not: null } },
        }),
    ],
    [
      'processing rows',
      () =>
        prisma.material_requirements.deleteMany({
          where: { materialId: only(materialId), linkedRequirementId: { not: null } },
        }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: only(materialId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock movements', () => prisma.stock_movements.deleteMany({ where: { materials: matWhere } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materials: matWhere } })],
    ['materials', () => prisma.materials.deleteMany({ where: matWhere })],
    ['fabric masters', () => prisma.fabric_master.deleteMany({ where: { id: { in: minted } } })],
    ['lot ledger', () => prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } })],
    ['lot', () => prisma.greige_stock.deleteMany({ where: { id: only(lotId) } })],
    ['greige', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['dyer', () => prisma.suppliers.deleteMany({ where: { id: only(dyerId) } })],
    ['warehouse', () => prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-jobwork teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('issuing greige held for another order to a job work order', () => {
  it('refuses with 409 STOCK_HELD_FOR_ORDER naming who holds it, and moves nothing', async () => {
    // 1,000 on the lot: 600 held for B, 300 for A. A's job may use A's 300 and the free 100 — 400, not 500
    const res = await issue({ lots: [{ greigeStockLotId: lotId, qty: 500 }] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STOCK_HELD_FOR_ORDER');
    expect(res.body.heldFor).toEqual([
      expect.objectContaining({ requirementNumber: `${RUN}-rB`, orderNumber: `${RUN}-B`, qty: 600 }),
    ]);
    expect(res.body.message).toContain(`${RUN}-B`);

    const jwo = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jwoId } });
    expect(jwo.sentDate).toBeNull();
    expect(Number((await lot()).quantityAvailable)).toBe(1000);
    expect(Number((await lot()).quantityReserved)).toBe(900);
    expect(await held('rB')).toBe(600);
    expect(await held('rA')).toBe(300);
  });

  it('issues with takeHeld: the other order loses what was taken and its need reopens', async () => {
    const res = await issue({ lots: [{ greigeStockLotId: lotId, qty: 500 }], takeHeld: true });
    expect(res.status).toBe(200);

    const after = await lot();
    expect(Number(after.quantityAvailable)).toBe(500);
    // B keeps 500; A's own 300 was used by the issue
    expect(Number(after.quantityReserved)).toBe(500);
    expect(await held('rB')).toBe(500);
    expect(await held('rA')).toBe(0);

    // B's need reopens in place: 100 less from stock, 100 more to buy
    const rB = await req('rB');
    expect(Number(rB.allocatedFromStock)).toBe(500);
    expect(Number(rB.shortfall)).toBe(100);
    expect(rB.status).toBe('PARTIAL_STOCK');

    const audit = await prisma.audit_logs.findMany({
      where: { entityType: 'material_requirement', entityId: R.rB },
      select: { newValues: true },
    });
    expect(audit.map((a) => a.newValues)).toContainEqual(
      expect.objectContaining({ event: 'HELD_GOODS_TAKEN', takenFor: `${RUN}-A`, fromUseStock: 100 })
    );
  });

  it('gives the job’s order its hold back when the job is cancelled and the cloth returns to stock', async () => {
    const cancelled = await request(app)
      .post(`/api/job-work-orders/${jwoId}/cancel`)
      .set(authHeader)
      .send({ reason: 'Shade changed' });
    expect(cancelled.status).toBe(200);
    // The cancel frees the job's requirement; the order's hold stays used up until the cloth is back
    expect(await prisma.requirement_jwo_links.count({ where: { jobWorkOrderId: jwoId } })).toBe(0);
    expect(await held('rA')).toBe(0);

    const disposed = await request(app)
      .post(`/api/job-work-orders/${jwoId}/dispose-inventory`)
      .set(authHeader)
      .send({ disposition: 'RETURNED_TO_STOCK', notes: 'Came back undyed' });
    expect(disposed.status).toBe(200);

    const after = await lot();
    expect(Number(after.quantityAvailable)).toBe(1000);
    // A holds its 300 again; the 100 taken from B came back free (B's need was already reopened)
    expect(await held('rA')).toBe(300);
    expect(await held('rB')).toBe(500);
    expect(Number(after.quantityReserved)).toBe(800);
  });

  it('Send to Mill asks the same: a 409 naming who holds it, then goes with takeHeld', async () => {
    // The lot is back to 1,000: A holds 300, B 500, 200 free. A new 600 m job for A needs 100 of B's
    const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: 600,
      agreedRate: 20,
      expectedShrinkage: 10,
      colorName: 'Navy',
    });
    expect(created.status).toBe(201);
    const job = created.body.data.id as string;
    await linkRequirementToLine(prisma, {
      requirementId: R.rAp,
      jobWorkOrderId: job,
      lineId: (await theOnlyLine(prisma, job, 'Linking')).id,
      allocatedQuantity: 600,
    });
    const send = (body: Record<string, unknown>) =>
      request(app).post(`/api/dyeing/process-pos/${job}/send`).set(authHeader).send(body);

    const refused = await send({ greigeStockLotId: lotId });
    expect(refused.status).toBe(409);
    expect(refused.body.details).toMatchObject({
      code: 'STOCK_HELD_FOR_ORDER',
      heldFor: [expect.objectContaining({ requirementNumber: `${RUN}-rB`, orderNumber: `${RUN}-B` })],
    });
    expect((await prisma.job_work_orders.findUniqueOrThrow({ where: { id: job } })).sentDate).toBeNull();
    expect(Number((await lot()).quantityAvailable)).toBe(1000);

    const sent = await send({ greigeStockLotId: lotId, takeHeld: true });
    expect(sent.status).toBe(200);
    expect(Number((await lot()).quantityAvailable)).toBe(400);
    expect(await held('rA')).toBe(0);
    expect(await held('rB')).toBe(400);
  });
});
