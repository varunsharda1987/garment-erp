/**
 * A delivery note fills the sale order it ships against (2026-09-25).
 *
 * Until then only POST /dispatch/sale-order-dispatch raised `sale_order_items.dispatchedQty`, and
 * nothing called it: the Delivery Note page posts to POST /dispatch/delivery-notes, which linked the
 * production order only. No sale order could reach PARTIALLY_DISPATCHED, and the B2B app's
 * "Dispatched" column stayed 0. These tests post exactly what the page posts:
 *   { orderId, customerId, deliveryDate, items: [{ styleId, colorId, sizeId, quantity }] }   — linked order
 *   { saleOrderId, customerId, deliveryDate, items: [...] }                                   — sale-order mode
 *
 * Pinned here:
 *   - the note, and each item, is booked on the sale order line; its reservations go first
 *   - a note never takes pieces reserved for ANOTHER sale order (integrity check D7)
 *   - deleting a pending note hands the pieces back to the line and the shelf
 *   - a line ordered without a colour matches the style's colour
 *   - caps: ordered exactly, or ordered + the buyer's over-shipment allowance (customers field)
 *
 * Runs against the real app + live dev DB; every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `DNS${Date.now().toString(36).toUpperCase()}`;
const DELIVERY_DATE = '2026-12-01'; // what <input type="date"> posts

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let styleId: string;
let colorId: string;
let sizeMId: string;
let sizeLId: string;
let costingId: string;

const createdSoIds: string[] = [];
const createdStockIds: string[] = [];
const createdLocationIds: string[] = [];

async function confirmedOrder(items: Array<{ colorId: string | null; sizeId: string; quantity: number }>) {
  const created = await request(app)
    .post('/api/sale-orders')
    .set(authHeader)
    .send({ customerId, items: items.map((i) => ({ styleId, ...i, unitPrice: 100 })) })
    .expect(201);
  const soId = created.body.data.id as string;
  createdSoIds.push(soId);
  await request(app).post(`/api/sale-orders/${soId}/confirm`).set(authHeader).send({}).expect(200);
  const lines = await prisma.sale_order_items.findMany({ where: { saleOrderId: soId } });
  return { soId, lines };
}

/** A finished-goods lot; each gets its own location (the SKU is unique per location). */
let lotSeq = 0;
async function fgLot(quantity: number, sizeId: string) {
  lotSeq += 1;
  const location = await prisma.locations.create({
    data: {
      id: randomUUID(),
      locationCode: `${RUN}-LOC-${lotSeq}`,
      locationName: `${RUN} Warehouse ${lotSeq}`,
      locationType: 'WAREHOUSE',
    },
  });
  createdLocationIds.push(location.id);
  const stock = await prisma.finished_goods_stock.create({
    data: { id: randomUUID(), styleId, colorId, sizeId, quantity, locationId: location.id },
  });
  createdStockIds.push(stock.id);
  return stock;
}

const reserve = (saleOrderItemId: string, fgStockId: string, quantity: number) =>
  request(app)
    .post('/api/sale-orders/allocate-stock')
    .set(authHeader)
    .send({ saleOrderItemId, fgStockId, quantity })
    .expect(201);

const fgQty = async (id: string) => (await prisma.finished_goods_stock.findUniqueOrThrow({ where: { id } })).quantity;
const line = (id: string) => prisma.sale_order_items.findUniqueOrThrow({ where: { id } });
const soStatus = async (id: string) =>
  (await request(app).get(`/api/sale-orders/${id}`).set(authHeader).expect(200)).body.status;

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
    data: { code: `${RUN}-CUST`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: testUserId },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}A`, styleName: `${RUN} Style A`, createdById: testUserId },
  });
  styleId = style.id;

  // ONE colour: a sale order line ordered without a colour ships in it
  const color = await prisma.color_options.create({
    data: { id: randomUUID(), styleId, colorName: `${RUN} Indigo`, colorCode: `${RUN}-IND` },
  });
  colorId = color.id;

  const [m, l] = await Promise.all([
    prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: `${RUN}-M` } }),
    prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: 'L', sizeCode: `${RUN}-L` } }),
  ]);
  sizeMId = m.id;
  sizeLId = l.id;

  // Start Production needs an approved cost sheet for the style
  const costing = await prisma.style_costing.create({
    data: {
      id: randomUUID(),
      styleId,
      createdById: testUserId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      isApproved: true,
    },
  });
  costingId = costing.id;
});

afterAll(async () => {
  const orderIds = (
    await prisma.orders.findMany({ where: { saleOrderId: { in: createdSoIds } }, select: { id: true } })
  ).map((o) => o.id);
  const woIds = (await prisma.work_orders.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map(
    (w) => w.id
  );
  const orderItemIds = (
    await prisma.order_items.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
  ).map((i) => i.id);

  // Children first, each step independent: one failure must not strand the rest in the live DB.
  const steps: Array<[string, () => Promise<unknown>]> = [
    // items and fg allocations cascade from the note
    ['delivery_notes', () => prisma.delivery_notes.deleteMany({ where: { customerId: only(customerId) } })],
    [
      'fg_stock_allocations',
      () => prisma.fg_stock_allocations.deleteMany({ where: { fgStockId: { in: createdStockIds } } }),
    ],
    ['finished_goods_stock', () => prisma.finished_goods_stock.deleteMany({ where: { id: { in: createdStockIds } } })],
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_order_breakup', () => prisma.work_order_breakup.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: { in: woIds } } })],
    [
      'order_item_breakup',
      () => prisma.order_item_breakup.deleteMany({ where: { orderItemId: { in: orderItemIds } } }),
    ],
    ['order_items', () => prisma.order_items.deleteMany({ where: { id: { in: orderItemIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: only(customerId) } })],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: { id: only(costingId) } })],
    ['locations', () => prisma.locations.deleteMany({ where: { id: { in: createdLocationIds } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { id: only(colorId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { id: { in: [sizeMId, sizeLId] } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[delivery-note-sale-order teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a delivery note for a production order linked to a sale order', () => {
  let soId: string;
  let lineId: string;
  let orderId: string;
  let noteId: string;
  let lotA: { id: string };
  let lotB: { id: string };
  let otherLineId: string;

  it("is booked against the sale order: its reservation first, never another order's", async () => {
    ({ soId } = await confirmedOrder([{ colorId, sizeId: sizeMId, quantity: 100 }]));
    lineId = (await prisma.sale_order_items.findFirstOrThrow({ where: { saleOrderId: soId } })).id;

    const started = await request(app)
      .post(`/api/sale-orders/${soId}/start-production`)
      .set(authHeader)
      .send({ expectedDeliveryDate: '2026-12-31', quantityMode: 'FULL' })
      .expect(201);
    orderId = started.body.data.id;

    // This order holds 30 on lot A; ANOTHER sale order holds 10 of lot B's 30
    lotA = await fgLot(30, sizeMId);
    lotB = await fgLot(30, sizeMId);
    await reserve(lineId, lotA.id, 30);
    const other = await confirmedOrder([{ colorId, sizeId: sizeMId, quantity: 10 }]);
    otherLineId = other.lines[0].id;
    await reserve(otherLineId, lotB.id, 10);

    // 55 asked: its own 30 + lot B's free 20 = 50. The other order's 10 are never offered, so the
    // note is refused (short stock, 2026-09-25) and nothing is written.
    const short = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        orderId,
        customerId,
        deliveryDate: DELIVERY_DATE,
        items: [{ styleId, colorId, sizeId: sizeMId, quantity: 55 }],
      })
      .expect(422);
    expect(short.body.details.code).toBe('FG_STOCK_SHORT');
    expect(short.body.details.shortfalls).toEqual([expect.objectContaining({ requested: 55, deducted: 50 })]);
    expect(await fgQty(lotA.id)).toBe(30);
    expect(await fgQty(lotB.id)).toBe(30);
    expect((await line(lineId)).dispatchedQty).toBe(0);

    const res = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        orderId,
        customerId,
        deliveryDate: DELIVERY_DATE,
        items: [{ styleId, colorId, sizeId: sizeMId, quantity: 50 }],
      })
      .expect(201);
    noteId = res.body.data.id;

    const note = await prisma.delivery_notes.findUniqueOrThrow({
      where: { id: noteId },
      include: { delivery_note_items: true },
    });
    expect(note.saleOrderId).toBe(soId);
    expect(note.orderId).toBe(orderId);
    expect(note.delivery_note_items[0].saleOrderItemId).toBe(lineId);

    // 30 from its own reservation, 20 free from lot B — lot B's other 10 are the other order's
    expect(await fgQty(lotA.id)).toBe(0);
    expect(await fgQty(lotB.id)).toBe(10);
    expect(res.body.fgShortfalls).toBeUndefined();

    const booked = await line(lineId);
    expect(booked.dispatchedQty).toBe(50);
    expect(booked.allocatedQty).toBe(0);
    const reservation = await prisma.fg_stock_allocations.findFirstOrThrow({ where: { saleOrderItemId: lineId } });
    expect(reservation.status).toBe('CONSUMED');

    const untouched = await prisma.fg_stock_allocations.findFirstOrThrow({ where: { saleOrderItemId: otherLineId } });
    expect(untouched.status).toBe('ALLOCATED');
    expect(untouched.allocatedQty).toBe(10);

    expect(await soStatus(soId)).toBe('PARTIALLY_DISPATCHED');
  });

  it('deleting the pending note hands the pieces back to the line and the shelf', async () => {
    await request(app).delete(`/api/dispatch/delivery-notes/${noteId}`).set(authHeader).expect(200);

    expect((await line(lineId)).dispatchedQty).toBe(0);
    expect(await fgQty(lotA.id)).toBe(30);
    expect(await fgQty(lotB.id)).toBe(30);
    expect(await soStatus(soId)).not.toMatch(/DISPATCHED/);
  });

  it('with no allowance, a size cannot ship past what was ordered', async () => {
    const res = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        orderId,
        customerId,
        deliveryDate: DELIVERY_DATE,
        items: [{ styleId, colorId, sizeId: sizeMId, quantity: 101 }],
      })
      .expect(400);
    expect(res.body.message).toMatch(/exceeds ordered quantity/i);
    expect((await line(lineId)).dispatchedQty).toBe(0);
  });

  it('a production order not linked to the named sale order is refused', async () => {
    const other = await confirmedOrder([{ colorId, sizeId: sizeMId, quantity: 5 }]);
    const res = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        orderId,
        saleOrderId: other.soId,
        customerId,
        deliveryDate: DELIVERY_DATE,
        items: [{ styleId, colorId, sizeId: sizeMId, quantity: 1 }],
      })
      .expect(400);
    expect(res.body.message).toMatch(/not linked to that sale order/i);
  });
});

describe('a sale order sold from stock (sale-order mode, no production order)', () => {
  it("ships a line ordered without a colour in the style's colour", async () => {
    const { soId, lines } = await confirmedOrder([{ colorId: null, sizeId: sizeLId, quantity: 10 }]);
    const lot = await fgLot(10, sizeLId);

    const res = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        saleOrderId: soId,
        customerId,
        deliveryDate: DELIVERY_DATE,
        items: [{ styleId, colorId, sizeId: sizeLId, quantity: 4 }],
      })
      .expect(201);

    const note = await prisma.delivery_notes.findUniqueOrThrow({
      where: { id: res.body.data.id },
      include: { delivery_note_items: true },
    });
    expect(note.orderId).toBeNull();
    expect(note.saleOrderId).toBe(soId);
    expect(note.delivery_note_items[0].saleOrderItemId).toBe(lines[0].id);
    expect((await line(lines[0].id)).dispatchedQty).toBe(4);
    expect(await fgQty(lot.id)).toBe(6);
    expect(await soStatus(soId)).toBe('PARTIALLY_DISPATCHED');
  });

  it('refuses a size the sale order does not carry', async () => {
    const { soId } = await confirmedOrder([{ colorId, sizeId: sizeMId, quantity: 3 }]);
    const res = await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({
        saleOrderId: soId,
        customerId,
        deliveryDate: DELIVERY_DATE,
        items: [{ styleId, colorId, sizeId: sizeLId, quantity: 1 }],
      })
      .expect(400);
    expect(res.body.message).toMatch(/has no line for/i);
  });

  it('refuses a note that names neither a production order nor a sale order', async () => {
    await request(app)
      .post('/api/dispatch/delivery-notes')
      .set(authHeader)
      .send({ customerId, deliveryDate: DELIVERY_DATE, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 1 }] })
      .expect(400);
  });
});

describe("the buyer's over-shipment allowance", () => {
  it('ordered exactly without one; ordered + the allowance with one, on both caps', async () => {
    const { soId } = await confirmedOrder([{ colorId, sizeId: sizeMId, quantity: 100 }]);
    const send = (quantity: number) =>
      request(app)
        .post('/api/dispatch/delivery-notes')
        .set(authHeader)
        .send({
          saleOrderId: soId,
          customerId,
          deliveryDate: DELIVERY_DATE,
          items: [{ styleId, colorId, sizeId: sizeMId, quantity }],
          // No finished goods in this fixture — these tests are about the caps, not stock
          adminOverride: true,
          overrideReason: 'Cap test: no finished goods recorded',
        });

    const refused = await send(101).expect(400);
    expect(refused.body.message).toMatch(/at most 100 pcs may ship/);

    // Set on the Customer page — the same PUT it sends
    await request(app)
      .put(`/api/customers/${customerId}`)
      .set(authHeader)
      .send({ overShipAllowancePercent: 5 })
      .expect(200);
    const customer = await prisma.customers.findUniqueOrThrow({ where: { id: customerId } });
    expect(Number(customer.overShipAllowancePercent)).toBe(5);

    const over = await send(106).expect(400);
    expect(over.body.message).toMatch(/at most 105 pcs may ship \(100 ordered \+ 5 allowed over\)/);
    await send(105).expect(201);
    // Every line shipped in full (and then some): the order is DISPATCHED, and takes no further note
    expect(await soStatus(soId)).toBe('DISPATCHED');
  });

  it("the production order's own cap takes the same allowance", async () => {
    const { soId } = await confirmedOrder([{ colorId, sizeId: sizeMId, quantity: 100 }]);
    const started = await request(app)
      .post(`/api/sale-orders/${soId}/start-production`)
      .set(authHeader)
      .send({ expectedDeliveryDate: '2026-12-31', quantityMode: 'FULL' })
      .expect(201);
    const send = (quantity: number) =>
      request(app)
        .post('/api/dispatch/delivery-notes')
        .set(authHeader)
        .send({
          orderId: started.body.data.id,
          customerId,
          deliveryDate: DELIVERY_DATE,
          items: [{ styleId, colorId, sizeId: sizeMId, quantity }],
          // No finished goods in this fixture — these tests are about the caps, not stock
          adminOverride: true,
          overrideReason: 'Cap test: no finished goods recorded',
        });

    const over = await send(106).expect(400);
    expect(over.body.message).toMatch(/up to 105 with the buyer's over-shipment allowance/);
    await send(105).expect(201);
  });

  it('a blank allowance on the Customer page saves as 0', async () => {
    await request(app)
      .put(`/api/customers/${customerId}`)
      .set(authHeader)
      .send({ overShipAllowancePercent: '' })
      .expect(200);
    const customer = await prisma.customers.findUniqueOrThrow({ where: { id: customerId } });
    expect(Number(customer.overShipAllowancePercent)).toBe(0);
  });
});
