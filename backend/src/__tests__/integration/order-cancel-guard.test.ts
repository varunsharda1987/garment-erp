/**
 * Deleting an order never cancels it, and an order whose production has started cannot be cancelled
 * (2026-09-28).
 *
 * On the Orders list every PENDING row showed Delete — and every order read PENDING, including
 * ORD2026080025 with WO2609-0087 IN_PRODUCTION and 1,704 m at Cutting. The delete check refused
 * ("active work orders"), the dialog quietly retitled itself "Cancel Order", and DELETE /orders/:id
 * ran cancelOrder — which cascades PENDING *and IN_PRODUCTION* runs to CANCELLED. Two clicks
 * cancelled a live run with its fabric on the floor.
 *
 * Now: DELETE /orders/:id is a 410; cancelling is POST /orders/:id/cancel and is refused once any
 * run is in production, has fabric issued to Cutting, or has a cutting batch.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `OCG${Date.now().toString(36).toUpperCase()}`;

let adminId: string;
let merchId: string;
let admin: Record<string, string>;
let merch: Record<string, string>;
let customerId: string;
let styleId: string;
let fabricId: string;
let stockId: string;
const orderIds: Record<'running' | 'cut' | 'idle', string> = { running: '', cut: '', idle: '' };
const runIds: Record<'running' | 'cut' | 'idle', string> = { running: '', cut: '', idle: '' };

async function makeOrderWithRun(key: 'running' | 'cut' | 'idle', runStatus: 'PENDING' | 'IN_PRODUCTION') {
  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}-${key.toUpperCase()}`,
      customerId,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: 100,
      totalAmount: 10000,
      createdById: adminId,
    },
  });
  const run = await prisma.work_orders.create({
    data: {
      id: randomUUID(),
      workOrderNumber: `${RUN}-WO-${key.toUpperCase()}`,
      orderId: order.id,
      styleId,
      status: runStatus,
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 20 * 86400000),
      totalQuantity: 100,
      createdById: adminId,
    },
  });
  orderIds[key] = order.id;
  runIds[key] = run.id;
}

beforeAll(async () => {
  const a = await createTestUser({
    email: `test-${RUN.toLowerCase()}-a@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = a.id;
  admin = getAuthHeader(a.id, 'ADMIN');
  const m = await createTestUser({
    email: `test-${RUN.toLowerCase()}-m@smoke.test`,
    role: 'MERCHANDISER',
    isActive: true,
    isApproved: true,
  });
  merchId = m.id;
  merch = getAuthHeader(m.id, 'MERCHANDISER');

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: adminId },
    })
  ).id;
  fabricId = (
    await prisma.fabric_master.create({
      data: { id: randomUUID(), fabricCode: `${RUN}-FAB`, fabricName: `${RUN} Fabric`, createdById: adminId },
    })
  ).id;
  stockId = (
    await prisma.fabric_stock.create({
      data: {
        id: randomUUID(),
        fabricId,
        finishedWidth: 58,
        cutableWidth: 58,
        quantityAvailable: 100,
        weightedAvgCost: 100,
        purchaseCost: 100,
        receivedDate: new Date(),
        createdById: adminId,
      },
    })
  ).id;

  await makeOrderWithRun('running', 'IN_PRODUCTION');
  await makeOrderWithRun('cut', 'PENDING');
  await makeOrderWithRun('idle', 'PENDING');

  // A run still reading PENDING but already cut from — the batch is the evidence.
  await prisma.cutting_batches.create({
    data: {
      id: randomUUID(),
      batchNumber: `${RUN}-CB`,
      workOrderId: runIds.cut,
      fabricStockId: stockId,
      cuttingDate: new Date(),
      actualFabricWidth: 58,
      cadAverageUsed: 1.5,
      cadWidthUsed: 58,
      layersPerLay: 1,
      numberOfLays: 1,
      fabricConsumed: 0,
      status: 'PENDING',
      createdById: adminId,
    },
  });
});

afterAll(async () => {
  const allRuns = Object.values(runIds).filter(Boolean);
  const allOrders = Object.values(orderIds).filter(Boolean);
  await prisma.cutting_batches.deleteMany({ where: { workOrderId: { in: allRuns } } });
  await prisma.work_orders.deleteMany({ where: { id: { in: allRuns } } });
  await prisma.orders.deleteMany({ where: { id: { in: allOrders } } });
  await prisma.fabric_stock.deleteMany({ where: { id: only(stockId) } });
  await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: { in: [adminId, merchId] } } });
  await prisma.$disconnect();
});

const cancel = (key: 'running' | 'cut' | 'idle') =>
  request(app)
    .post(`/api/orders/${orderIds[key]}/cancel`)
    .set(admin)
    .send({ cancellationReason: `${RUN} test` });

describe('Order delete / cancel guard', () => {
  it('DELETE /orders/:id no longer cancels — it is a 410 and changes nothing', async () => {
    const res = await request(app).delete(`/api/orders/${orderIds.running}`).set(admin);
    expect(res.status).toBe(410);

    const [order, run] = await Promise.all([
      prisma.orders.findUniqueOrThrow({ where: { id: orderIds.running } }),
      prisma.work_orders.findUniqueOrThrow({ where: { id: runIds.running } }),
    ]);
    expect(order.status).toBe('PENDING');
    expect(run.status).toBe('IN_PRODUCTION');
  });

  it('refuses to cancel an order whose run is in production, and names the run', async () => {
    const res = await cancel('running');
    expect(res.status).toBe(422);
    expect(res.body.message ?? res.body.error?.message ?? JSON.stringify(res.body)).toContain(`${RUN}-WO-RUNNING`);

    const run = await prisma.work_orders.findUniqueOrThrow({ where: { id: runIds.running } });
    expect(run.status).toBe('IN_PRODUCTION');
    const order = await prisma.orders.findUniqueOrThrow({ where: { id: orderIds.running } });
    expect(order.status).toBe('PENDING');
  });

  it('refuses to cancel an order whose run still reads PENDING but has a cutting batch', async () => {
    const res = await cancel('cut');
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toContain('1 cutting batch');

    const run = await prisma.work_orders.findUniqueOrThrow({ where: { id: runIds.cut } });
    expect(run.status).toBe('PENDING');
  });

  it('cancels an order whose run has not started — the run goes with it', async () => {
    const res = await cancel('idle');
    expect(res.status).toBe(200);

    const [order, run] = await Promise.all([
      prisma.orders.findUniqueOrThrow({ where: { id: orderIds.idle } }),
      prisma.work_orders.findUniqueOrThrow({ where: { id: runIds.idle } }),
    ]);
    expect(order.status).toBe('CANCELLED');
    expect(run.status).toBe('CANCELLED');
  });

  it('refuses to cancel an order twice', async () => {
    const res = await cancel('idle');
    expect(res.status).toBe(400);
  });

  it('tells a non-admin up front that only an administrator can delete', async () => {
    const res = await request(app).get(`/api/orders/${orderIds.idle}/can-delete`).set(merch);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ canDelete: false, code: 'ADMIN_ONLY' });
  });
});
