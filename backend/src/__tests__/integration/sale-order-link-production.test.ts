/**
 * A buyer's sale order meeting a production order that was raised BEFORE it (2026-09-24).
 *
 * Production orders are raised early, without sizes, so greige can be bought and dyed; the buyer's
 * PO arrives later as a sale order. All 8 Easybuy orders of Aug 2026 were like that and none was
 * linked — and Start Production would have made a SECOND production order beside each (its own
 * BOM, its own fabric plan). Pins:
 *  - Start Production refuses while an unlinked production order plans the style, naming it;
 *  - Link to Production Order links it and copies the PO's sizes WITH colour (the production order
 *    makes the PO exactly), creating the production run;
 *  - a size breakdown with no colour takes the style's only colour (a colourless run cannot record
 *    stitching output, so it never becomes finished goods);
 *  - Amend Quantities (admin only) corrects a CONFIRMED order's split, never below what is allocated,
 *    and the linked production order + its pending run follow.
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SLP${Date.now().toString(36).toUpperCase()}`;
const SIZES: Array<[string, number]> = [
  ['S', 30],
  ['M', 45],
  ['L', 26],
];
const PO_TOTAL = SIZES.reduce((s, [, q]) => s + q, 0); // 101
/** The buyer PO's Expected Ship Date — production must be finished by it (owner, 2026-09-25) */
const SHIP_DATE = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 15));
const PLANNED = 100;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let otherCustomerId: string;
let styleId: string;
let colourId: string;
const sizeIds: Record<string, string> = {};
let orderId: string;
let orderItemId: string;
let soId: string;
let merchHeader: Record<string, string>;
let merchId: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  const merch = await createTestUser({
    email: `test-${RUN.toLowerCase()}-m@smoke.test`,
    role: 'MERCHANDISER',
    isActive: true,
    isApproved: true,
  });
  merchId = merch.id;
  merchHeader = getAuthHeader(merch.id, 'MERCHANDISER');

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  otherCustomerId = (
    await prisma.customers.create({
      data: { code: `${RUN}X`, name: `${RUN} Other`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Top`, createdById: userId },
    })
  ).id;
  colourId = (await prisma.color_options.create({ data: { id: randomUUID(), styleId, colorName: 'Black' } })).id;
  for (const [name] of SIZES) {
    sizeIds[name] = (
      await prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: name, sizeCode: name } })
    ).id;
  }

  // The production order as raised in August: total only, no sizes, no sale order — and a delivery
  // date that has since PASSED (ORD2026080026 carried 20-Sep when its run was made on 24-Sep)
  orderId = randomUUID();
  await prisma.orders.create({
    data: {
      id: orderId,
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() - 5 * 86400000),
      totalQuantity: PLANNED,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderItemId = (
    await prisma.order_items.create({
      data: { id: randomUUID(), orderId, styleId, totalQuantity: PLANNED, unitPrice: 10, totalPrice: 10 * PLANNED },
    })
  ).id;

  // The buyer's PO, later, with sizes and colour
  const so = await request(app)
    .post('/api/sale-orders')
    .set(authHeader)
    .send({
      customerId,
      items: SIZES.map(([name, quantity]) => ({
        styleId,
        colorId: colourId,
        sizeId: sizeIds[name],
        quantity,
        unitPrice: 200,
      })),
    })
    .expect(201);
  soId = so.body.data.id;
  await prisma.sale_orders.update({
    where: { id: soId },
    data: { status: 'CONFIRMED', expectedShipDate: SHIP_DATE },
  });
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['material_requirements', () => prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } })],
    [
      'work_order_breakup',
      () => prisma.work_order_breakup.deleteMany({ where: { work_orders: { orderId: only(orderId) } } }),
    ],
    [
      'production_tracking',
      () => prisma.production_tracking.deleteMany({ where: { work_orders: { orderId: only(orderId) } } }),
    ],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { orderId: only(orderId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { orderNumber: { startsWith: RUN } } })],
    ['sale_order_items', () => prisma.sale_order_items.deleteMany({ where: { saleOrderId: only(soId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { id: only(soId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    [
      'customers',
      () => prisma.customers.deleteMany({ where: { id: { in: [only(customerId), only(otherCustomerId)] } } }),
    ],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { entityId: only(soId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: { in: [only(userId), only(merchId)] } } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[sale-order-link-production teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a sale order meets the production order raised before it', () => {
  it('Start Production refuses while an unlinked production order plans the style', async () => {
    const res = await request(app).post(`/api/sale-orders/${soId}/start-production`).set(authHeader).send({});
    expect(res.status).toBe(409);
    expect(res.body.message).toContain(`${RUN}ORD`);
    expect(await prisma.orders.count({ where: { order_items: { some: { styleId } } } })).toBe(1);
  });

  it('lists the unlinked order as linkable', async () => {
    const res = await request(app)
      .get(`/api/sale-orders/${soId}/linkable-production-orders`)
      .set(authHeader)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].orderNumber).toBe(`${RUN}ORD`);
    expect(res.body.data[0].sameCustomer).toBe(true);
    expect(res.body.data[0].hasSizes).toBe(false);
  });

  it('refuses to link an order for another customer', async () => {
    const foreign = randomUUID();
    await prisma.orders.create({
      data: {
        id: foreign,
        orderNumber: `${RUN}ORDX`,
        customerId: otherCustomerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 10,
        totalAmount: 100,
        createdById: userId,
      },
    });
    const res = await request(app)
      .post(`/api/sale-orders/${soId}/link-production-order`)
      .set(authHeader)
      .send({ orderId: foreign });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/different customer/);
  });

  it('links, copies the PO sizes with colour, and creates the production run', async () => {
    const res = await request(app)
      .post(`/api/sale-orders/${soId}/link-production-order`)
      .set(authHeader)
      .send({ orderId })
      .expect(200);
    // The fixture has no Order BOM: the MRP re-run is refused and SAID so, but the link and sizes stand
    expect(res.body.data.sized[0].error).toMatch(/No active Order BOM/);
    expect(res.body.message).toMatch(/No active Order BOM/);

    const order = await prisma.orders.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.saleOrderId).toBe(soId);
    expect(order.totalQuantity).toBe(PO_TOTAL); // the PO exactly, not the planned 100
    // The passed August date is replaced by the buyer PO's ship date — so the run CAN be created
    expect(order.expectedDeliveryDate.toISOString()).toBe(SHIP_DATE.toISOString());

    const breakup = await prisma.order_item_breakup.findMany({ where: { orderItemId } });
    expect(breakup).toHaveLength(SIZES.length);
    for (const b of breakup) expect(b.colorId).toBe(colourId);

    const run = await prisma.work_orders.findFirstOrThrow({
      where: { orderId },
      include: { work_order_breakup: true },
    });
    expect(run.totalQuantity).toBe(PO_TOTAL);
    for (const b of run.work_order_breakup) expect(b.colorId).toBe(colourId);
    expect(run.plannedEndDate?.toISOString()).toBe(SHIP_DATE.toISOString());
    expect(run.plannedEndDate!.getTime()).toBeGreaterThan(run.plannedStartDate!.getTime());

    // Linked now: the SO shows its production order and Start Production is refused as before
    const read = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(read.body.productionOrders.map((o: { orderNumber: string }) => o.orderNumber)).toContain(`${RUN}ORD`);
    const again = await request(app).post(`/api/sale-orders/${soId}/start-production`).set(authHeader).send({});
    expect(again.status).toBe(409);
  });

  it('refuses to create a production run whose delivery date has already passed', async () => {
    const pastId = randomUUID();
    const pastItemId = randomUUID();
    await prisma.orders.create({
      data: {
        id: pastId,
        orderNumber: `${RUN}ORDP`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() - 5 * 86400000),
        totalQuantity: 10,
        totalAmount: 100,
        createdById: userId,
      },
    });
    await prisma.order_items.create({
      data: { id: pastItemId, orderId: pastId, styleId, totalQuantity: 10, unitPrice: 10, totalPrice: 100 },
    });
    try {
      const res = await request(app)
        .put(`/api/orders/${pastId}/items/${pastItemId}/size-breakup`)
        .set(authHeader)
        .send({ breakup: [{ colorId: colourId, sizeId: sizeIds.S, quantity: 10 }] })
        .expect(200);
      // The sizes are saved; the run is refused, naming the date to fix
      expect(res.body.data.workOrders.created).toHaveLength(0);
      expect(res.body.data.workOrders.failed[0].reason).toMatch(/has already passed/);
      expect(await prisma.work_orders.count({ where: { orderId: pastId } })).toBe(0);
    } finally {
      await prisma.order_item_breakup.deleteMany({ where: { orderItemId: pastItemId } });
      await prisma.material_requirements.deleteMany({ where: { orderId: pastId } });
      await prisma.order_items.deleteMany({ where: { id: pastItemId } });
      await prisma.orders.deleteMany({ where: { id: pastId } });
    }
  });

  it("a size breakdown with no colour takes the style's only colour", async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${orderItemId}/size-breakup`)
      .set(authHeader)
      .send({ breakup: SIZES.map(([name, quantity]) => ({ colorId: null, sizeId: sizeIds[name], quantity })) })
      .expect(200);
    expect(res.body.data.breakup.every((b: { colorId: string }) => b.colorId === colourId)).toBe(true);
  });

  describe('Amend Quantities', () => {
    const lineFor = async (size: string) =>
      prisma.sale_order_items.findFirstOrThrow({ where: { saleOrderId: soId, sizeId: sizeIds[size] } });

    it('is refused to a non-admin', async () => {
      const m = await lineFor('M');
      const res = await request(app)
        .post(`/api/sale-orders/${soId}/amend-quantities`)
        .set(merchHeader)
        .send({ lines: [{ itemId: m.id, quantity: 50 }], reason: 'test' });
      expect(res.status).toBe(403);
    });

    it('refuses a line below what is already allocated', async () => {
      const s = await lineFor('S');
      await prisma.sale_order_items.update({ where: { id: s.id }, data: { allocatedQty: 20 } });
      try {
        const res = await request(app)
          .post(`/api/sale-orders/${soId}/amend-quantities`)
          .set(authHeader)
          .send({ lines: [{ itemId: s.id, quantity: 10 }], reason: 'test' });
        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/cannot go below 20/);
      } finally {
        await prisma.sale_order_items.update({ where: { id: s.id }, data: { allocatedQty: 0 } });
      }
    });

    it('corrects the split, the order money, and the linked production order + pending run', async () => {
      const m = await lineFor('M');
      const l = await lineFor('L');
      const res = await request(app)
        .post(`/api/sale-orders/${soId}/amend-quantities`)
        .set(authHeader)
        .send({
          lines: [
            { itemId: m.id, quantity: 40 },
            { itemId: l.id, quantity: 31 },
          ],
          reason: 'split corrected to the buyer PO',
        })
        .expect(200);
      expect(res.body.data.notFollowed).toEqual([]);

      expect((await lineFor('M')).quantity).toBe(40);
      expect(Number((await lineFor('L')).totalPrice)).toBe(31 * 200);
      const so = await prisma.sale_orders.findUniqueOrThrow({ where: { id: soId } });
      expect(Number(so.totalAmount)).toBe((30 + 40 + 31) * 200);
      expect(so.status).toBe('CONFIRMED');

      const breakup = await prisma.order_item_breakup.findMany({ where: { orderItemId } });
      const bySize = Object.fromEntries(breakup.map((b) => [b.sizeId, b.quantity]));
      expect(bySize[sizeIds.M]).toBe(40);
      expect(bySize[sizeIds.L]).toBe(31);
      const run = await prisma.work_orders.findFirstOrThrow({
        where: { orderId },
        include: { work_order_breakup: true },
      });
      expect(run.totalQuantity).toBe(101);
      expect(run.work_order_breakup.find((b) => b.sizeId === sizeIds.M)?.plannedQuantity).toBe(40);

      const audit = await prisma.audit_logs.findFirst({ where: { entityId: soId, entityType: 'SALE_ORDER' } });
      expect(JSON.stringify(audit?.newValues)).toContain('split corrected');
    });

    it('leaves a production order whose sizes differ from the sale order alone', async () => {
      // Hand-edit the order so it no longer mirrors the sale order
      await request(app)
        .put(`/api/orders/${orderId}/items/${orderItemId}/size-breakup`)
        .set(authHeader)
        .send({
          breakup: [
            { colorId: colourId, sizeId: sizeIds.S, quantity: 31 },
            { colorId: colourId, sizeId: sizeIds.M, quantity: 39 },
            { colorId: colourId, sizeId: sizeIds.L, quantity: 31 },
          ],
        })
        .expect(200);
      const m = await lineFor('M');
      const res = await request(app)
        .post(`/api/sale-orders/${soId}/amend-quantities`)
        .set(authHeader)
        .send({ lines: [{ itemId: m.id, quantity: 41 }], reason: 'another correction' })
        .expect(200);
      expect(res.body.data.notFollowed).toEqual([`${RUN}S`]);
      const mOrder = await prisma.order_item_breakup.findFirstOrThrow({ where: { orderItemId, sizeId: sizeIds.M } });
      expect(mOrder.quantity).toBe(39);
    });
  });
});
