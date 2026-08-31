/**
 * Sale Order → Production Order link (HOK make-to-order flow).
 *
 * Pins the Start Production contract end-to-end against the real app + DB:
 *   create SO (buyerPoNumber round-trip) → confirm → start-production
 *   → orders.saleOrderId set, one order item per style, breakup sums match
 *   → duplicate guard (409), cost-sheet gate (400 naming the styleCode),
 *     missing-date backstop (400), SO cancel blocked while production active (422)
 *   → GET /production-status/by-order?saleOrderId= returns exactly the linked items
 *   → GET /sale-orders/:id exposes productionOrders[].
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SOP${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;

let customerId: string;
let styleAId: string; // has an APPROVED cost sheet
let styleBId: string; // has NO cost sheet
let sizeMId: string;
let sizeLId: string;
let sizeB1Id: string;
let costingId: string;

let soId: string; // main SO (style A, 2 sizes)
let so2Id: string; // cost-sheet-gate SO (style B)
let productionOrderId: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: {
      code: `${RUN}-CUST`,
      name: `${RUN} Buyer`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: testUserId,
    },
  });
  customerId = customer.id;

  const styleA = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}A`, styleName: `${RUN} Style A`, createdById: testUserId },
  });
  styleAId = styleA.id;
  const styleB = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}B`, styleName: `${RUN} Style B`, createdById: testUserId },
  });
  styleBId = styleB.id;

  const [m, l, b1] = await Promise.all([
    prisma.size_options.create({
      data: { id: randomUUID(), styleId: styleAId, sizeName: 'M', sizeCode: `${RUN}-M` },
    }),
    prisma.size_options.create({
      data: { id: randomUUID(), styleId: styleAId, sizeName: 'L', sizeCode: `${RUN}-L` },
    }),
    prisma.size_options.create({
      data: { id: randomUUID(), styleId: styleBId, sizeName: 'M', sizeCode: `${RUN}-BM` },
    }),
  ]);
  sizeMId = m.id;
  sizeLId = l.id;
  sizeB1Id = b1.id;

  // Approved cost sheet for style A only — the same predicate the Order form / start-production check
  const costing = await prisma.style_costing.create({
    data: {
      id: randomUUID(),
      styleId: styleAId,
      createdById: testUserId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      isApproved: true,
    },
  });
  costingId = costing.id;
});

afterAll(async () => {
  // FK-safe teardown (children first). Everything is scoped to this run's ids.
  const orders = await prisma.orders.findMany({
    where: { saleOrderId: { in: [soId, so2Id].filter(Boolean) } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length > 0) {
    const workOrders = await prisma.work_orders.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });
    const woIds = workOrders.map((w) => w.id);
    if (woIds.length > 0) {
      await prisma.production_tracking.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.work_order_breakup.deleteMany({ where: { workOrderId: { in: woIds } } });
      await prisma.work_orders.deleteMany({ where: { id: { in: woIds } } });
    }
    const items = await prisma.order_items.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });
    await prisma.order_item_breakup.deleteMany({
      where: { orderItemId: { in: items.map((i) => i.id) } },
    });
    await prisma.order_items.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orders.deleteMany({ where: { id: { in: orderIds } } });
  }
  await prisma.sale_order_items.deleteMany({
    where: { saleOrderId: { in: [soId, so2Id].filter(Boolean) } },
  });
  await prisma.sale_orders.deleteMany({ where: { id: { in: [soId, so2Id].filter(Boolean) } } });
  await prisma.style_costing.deleteMany({ where: { id: only(costingId) } });
  await prisma.size_options.deleteMany({ where: { id: { in: [sizeMId, sizeLId, sizeB1Id] } } });
  await prisma.styles.deleteMany({ where: { id: { in: [styleAId, styleBId] } } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('Sale Order → start production (make-to-order)', () => {
  it('creates a sale order with buyerPoNumber and persists it (round-trip)', async () => {
    const res = await request(app)
      .post('/api/sale-orders')
      .set(authHeader)
      .send({
        customerId,
        buyerPoNumber: `${RUN}-PO-01`,
        items: [
          { styleId: styleAId, sizeId: sizeMId, quantity: 5, unitPrice: 100 },
          { styleId: styleAId, sizeId: sizeLId, quantity: 7, unitPrice: 100 },
        ],
      })
      .expect(201);

    soId = res.body.data.id;
    const readBack = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(readBack.body.buyerPoNumber).toBe(`${RUN}-PO-01`);
    expect(readBack.body.productionOrders).toEqual([]);
  });

  it('rejects start-production while the SO is still DRAFT', async () => {
    const res = await request(app)
      .post(`/api/sale-orders/${soId}/start-production`)
      .set(authHeader)
      .send({})
      .expect(422);
    expect(res.body.message || res.body.error?.message).toMatch(/confirm/i);
  });

  it('rejects start-production when no delivery date exists anywhere', async () => {
    await request(app).post(`/api/sale-orders/${soId}/confirm`).set(authHeader).send({}).expect(200);

    // SO was created without buyerDeadline/expectedShipDate/deliveryDate and no override sent
    const res = await request(app)
      .post(`/api/sale-orders/${soId}/start-production`)
      .set(authHeader)
      .send({})
      .expect(400);
    expect(res.body.message || res.body.error?.message).toMatch(/expectedDeliveryDate/i);
  });

  it('creates the linked production order for the full SO quantity', async () => {
    const res = await request(app)
      .post(`/api/sale-orders/${soId}/start-production`)
      .set(authHeader)
      .send({ expectedDeliveryDate: '2026-12-01', priority: 'HIGH' })
      .expect(201);

    productionOrderId = res.body.data.id;
    expect(res.body.data.saleOrderId).toBe(soId);
    expect(res.body.data.orderNumber).toMatch(/^ORD/);
    expect(Number(res.body.data.totalQuantity)).toBe(12);

    // One order item per style; breakup carries the SO's size split
    const items = await prisma.order_items.findMany({
      where: { orderId: productionOrderId },
      include: { order_item_breakup: true },
    });
    expect(items).toHaveLength(1);
    expect(items[0].styleId).toBe(styleAId);
    expect(items[0].totalQuantity).toBe(12);
    const breakupQtys = items[0].order_item_breakup.map((b) => b.quantity).sort();
    expect(breakupQtys).toEqual([5, 7]);

    // Work order auto-created per item with matching breakup total
    const workOrders = await prisma.work_orders.findMany({ where: { orderId: productionOrderId } });
    expect(workOrders).toHaveLength(1);
    expect(workOrders[0].totalQuantity).toBe(12);
  });

  it('blocks a second production order for the same SO (duplicate guard)', async () => {
    const res = await request(app)
      .post(`/api/sale-orders/${soId}/start-production`)
      .set(authHeader)
      .send({ expectedDeliveryDate: '2026-12-01' })
      .expect(409);
    expect(res.body.message || res.body.error?.message).toMatch(/already exists/i);
  });

  it('blocks cancelling the SO while the linked production order is active', async () => {
    const res = await request(app).post(`/api/sale-orders/${soId}/cancel`).set(authHeader).expect(422);
    expect(res.body.message || res.body.error?.message).toMatch(/production order/i);
  });

  it('exposes the linked production order on the SO read-back', async () => {
    const res = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(res.body.productionOrders).toHaveLength(1);
    expect(res.body.productionOrders[0].id).toBe(productionOrderId);
    expect(Number(res.body.productionOrders[0].totalQuantity)).toBe(12);
  });

  it('production-status?saleOrderId= returns exactly the linked order items', async () => {
    const res = await request(app)
      .get(`/api/production-status/by-order?saleOrderId=${soId}`)
      .set(authHeader)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].orderId).toBe(productionOrderId);
    expect(res.body.data[0].quantity).toBe(12);
  });

  it('blocks start-production when a style has no approved cost sheet, naming it', async () => {
    const createRes = await request(app)
      .post('/api/sale-orders')
      .set(authHeader)
      .send({
        customerId,
        buyerPoNumber: `${RUN}-PO-02`,
        items: [{ styleId: styleBId, sizeId: sizeB1Id, quantity: 3, unitPrice: 50 }],
      })
      .expect(201);
    so2Id = createRes.body.data.id;

    await request(app).post(`/api/sale-orders/${so2Id}/confirm`).set(authHeader).send({}).expect(200);

    const res = await request(app)
      .post(`/api/sale-orders/${so2Id}/start-production`)
      .set(authHeader)
      .send({ expectedDeliveryDate: '2026-12-01' })
      .expect(400);
    expect(res.body.message || res.body.error?.message).toContain(`${RUN}B`);
  });
});
