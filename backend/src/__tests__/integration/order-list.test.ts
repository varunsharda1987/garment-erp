/**
 * The Orders list (2026-09-28 bug hunt).
 *
 * - One BOM per STYLE: the list returned `take: 1` BOM, so a two-style order showed one arbitrary
 *   style's BOM and never offered Create BOM for the other.
 * - Stable paging: orders created the same day share one orderDate; skip/take over tied rows could
 *   repeat or drop an order between pages. The list now breaks ties on orderNumber.
 * - Export writes the rows the list shows — search included — with its Customer / Delivery Date
 *   columns filled (they exported blank).
 * - Hard delete refuses, with the reason, an order that still has records pointing at it (here a
 *   cutting batch on a PENDING run) instead of failing with "Referenced record does not exist".
 * - Create BOM without a cost sheet id lets the server pick; with no approved sheet it says so.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `OLT${Date.now().toString(36).toUpperCase()}`;

let adminId: string;
let admin: Record<string, string>;
let customerId: string;
const styleIds: string[] = [];
const orderIds: string[] = [];
const itemIds: string[] = [];
let runId: string;
let fabricId: string;
let stockId: string;

beforeAll(async () => {
  const a = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = a.id;
  admin = getAuthHeader(a.id, 'ADMIN');

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
    })
  ).id;
  for (const s of ['A', 'B']) {
    styleIds.push(
      (
        await prisma.styles.create({
          data: { id: randomUUID(), styleCode: `${RUN}-STY${s}`, styleName: `${RUN} Style ${s}`, createdById: adminId },
        })
      ).id
    );
  }

  // Three orders on the SAME orderDate (a bare date, as the form sends), numbered 1..3.
  const sameDay = new Date('2026-09-01T00:00:00.000Z');
  for (const n of [1, 2, 3]) {
    const order = await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}-ORD${n}`,
        customerId,
        orderDate: sameDay,
        expectedDeliveryDate: new Date('2026-10-15T00:00:00.000Z'),
        totalQuantity: 200,
        totalAmount: 20000,
        createdById: adminId,
      },
    });
    orderIds.push(order.id);
  }

  // Order 1 carries two styles. Style A: BOM v1 (DRAFT) and v2 (APPROVED). Style B: none.
  for (const styleId of styleIds) {
    const item = await prisma.order_items.create({
      data: {
        id: randomUUID(),
        orderId: orderIds[0],
        styleId,
        totalQuantity: 100,
        unitPrice: 100,
        totalPrice: 10000,
      },
    });
    itemIds.push(item.id);
  }
  for (const [version, status] of [
    [1, 'DRAFT'],
    [2, 'APPROVED'],
  ] as const) {
    await prisma.order_bom.create({
      data: { orderId: orderIds[0], styleId: styleIds[0], version, status, createdById: adminId },
    });
  }

  // Order 2 has a PENDING run that has been cut from — hard delete must refuse it by name.
  runId = (
    await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: `${RUN}-WO`,
        orderId: orderIds[1],
        styleId: styleIds[0],
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 20 * 86400000),
        totalQuantity: 100,
        createdById: adminId,
      },
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
  await prisma.cutting_batches.create({
    data: {
      id: randomUUID(),
      batchNumber: `${RUN}-CB`,
      workOrderId: runId,
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
  await prisma.cutting_batches.deleteMany({ where: { workOrderId: only(runId) } });
  await prisma.work_orders.deleteMany({ where: { id: only(runId) } });
  await prisma.fabric_stock.deleteMany({ where: { id: only(stockId) } });
  await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
  await prisma.order_bom.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order_items.deleteMany({ where: { id: { in: itemIds } } });
  await prisma.orders.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.styles.deleteMany({ where: { id: { in: styleIds } } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(adminId) } });
  await prisma.$disconnect();
});

const list = (query: string) => request(app).get(`/api/orders${query}`).set(admin);

describe('Orders list', () => {
  it('returns the latest active BOM of EACH style, not one BOM per order', async () => {
    const res = await list(`?search=${RUN}-ORD1&limit=5`);
    expect(res.status).toBe(200);
    const order = res.body.data.find((o: { orderNumber: string }) => o.orderNumber === `${RUN}-ORD1`);
    expect(order.orderBoms).toHaveLength(1); // style B has none — the page offers Create BOM for it
    expect(order.orderBoms[0]).toMatchObject({ styleId: styleIds[0], version: 2, status: 'APPROVED' });
  });

  it('pages same-day orders without repeating or dropping one', async () => {
    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await list(`?search=${RUN}-ORD&limit=1&page=${page}`);
      expect(res.status).toBe(200);
      seen.push(...res.body.data.map((o: { orderNumber: string }) => o.orderNumber));
    }
    expect(seen).toEqual([`${RUN}-ORD3`, `${RUN}-ORD2`, `${RUN}-ORD1`]);
  });

  it('exports what the list shows — search honoured, customer and delivery date filled', async () => {
    const res = await request(app)
      .post('/api/export/orders')
      .set(admin)
      .send({ format: 'csv', filters: { search: `${RUN}-ORD2` } });
    expect(res.status).toBe(200);
    const csv = res.text;
    expect(csv).toContain(`${RUN}-ORD2`);
    expect(csv).not.toContain(`${RUN}-ORD1`);
    expect(csv).toContain(`${RUN} Customer`);
    expect(csv).toMatch(/2026-10-15|15-Oct-2026|15\/10\/2026|10\/15\/2026/);
  });

  it('refuses a hard delete up front when a run has been cut from, and says why', async () => {
    const check = await request(app).get(`/api/orders/${orderIds[1]}/can-delete`).set(admin);
    expect(check.status).toBe(200);
    expect(check.body.canDelete).toBe(false);
    expect(check.body.reason).toContain('cutting batch');

    const del = await request(app).delete(`/api/orders/${orderIds[1]}/hard-delete`).set(admin);
    expect(del.status).toBe(422);
    expect(await prisma.orders.count({ where: { id: orderIds[1] } })).toBe(1);
  });

  it('Create BOM with no cost sheet named: the server picks, and says when there is none', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderIds[0]}/bom`)
      .set(admin)
      .send({ styleId: styleIds[1], orderItemId: itemIds[1] });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toContain('no approved raw-material cost sheet');
  });
});
