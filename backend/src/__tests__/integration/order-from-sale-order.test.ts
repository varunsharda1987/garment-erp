/**
 * Orders → New made from a sale order, and the one date model (2026-09-25).
 *
 * Until then the Orders form never looked at sale orders and POST /orders silently dropped a
 * `saleOrderId`: SO2609-0382's 2,300 pcs of ESSKY082LS had to be typed again, and the order it made
 * was linked to nothing. Start Production copied the sale order lines' missing colour onto the run,
 * which can never record stitching output. Pinned here:
 *   - GET /sale-orders/open-for-style lists the customer's open sale orders carrying the style
 *   - POST /orders with saleOrderId links the order, fills the style's colour, and refuses a foreign
 *     customer / style, more than is open, a Delivery after the Buyer Deadline, a second order
 *   - PUT /orders/:id keeps a linked order within the Buyer Deadline
 *   - Start Production: the style's colour on every line, the buyer's PO date as Order Date
 *   - a sale order's Expected Ship Date may not be after its Buyer Deadline
 *
 * Posts what the pages post; real app + live dev DB; every fixture scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `OFS${Date.now().toString(36).toUpperCase()}`;
const SHIP = '2026-12-10';
const DEADLINE = '2026-12-20';
const PO_DATE = '2026-09-01';

let admin: Record<string, string>;
let adminId: string;
let customerA: string;
let customerB: string;
const styles: Record<string, { id: string; colours: string[]; sizeM: string; sizeL: string }> = {};
const costingIds: string[] = [];

/** A style (ACTIVE, approved cost sheet) with the given colours and sizes M, L */
async function makeStyle(key: string, colourNames: string[]) {
  const style = await prisma.styles.create({
    data: {
      id: randomUUID(),
      styleCode: `${RUN}${key}`,
      styleName: `${RUN} ${key}`,
      createdById: adminId,
      status: 'ACTIVE',
    },
  });
  const colours = [];
  for (const name of colourNames) {
    colours.push(
      (
        await prisma.color_options.create({
          data: {
            id: randomUUID(),
            styleId: style.id,
            colorName: `${RUN} ${name}`,
            colorCode: `${RUN}-${key}-${name}`,
          },
        })
      ).id
    );
  }
  const [m, l] = await Promise.all([
    prisma.size_options.create({
      data: { id: randomUUID(), styleId: style.id, sizeName: 'M', sizeCode: `${RUN}-${key}-M` },
    }),
    prisma.size_options.create({
      data: { id: randomUUID(), styleId: style.id, sizeName: 'L', sizeCode: `${RUN}-${key}-L` },
    }),
  ]);
  const costing = await prisma.style_costing.create({
    data: {
      id: randomUUID(),
      styleId: style.id,
      createdById: adminId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      isApproved: true,
    },
  });
  costingIds.push(costing.id);
  styles[key] = { id: style.id, colours, sizeM: m.id, sizeL: l.id };
}

/** A confirmed sale order, lines WITHOUT a colour (as the ESSKY ones), with the buyer's dates */
async function confirmedSo(customerId: string, key: string, lines: Array<{ size: 'M' | 'L'; quantity: number }>) {
  const st = styles[key];
  const created = await request(app)
    .post('/api/sale-orders')
    .set(admin)
    .send({
      customerId,
      expectedShipDate: SHIP,
      buyerDeadline: DEADLINE,
      orderDate: PO_DATE,
      items: lines.map((l) => ({
        styleId: st.id,
        sizeId: l.size === 'M' ? st.sizeM : st.sizeL,
        quantity: l.quantity,
        unitPrice: 200,
      })),
    })
    .expect(201);
  const id = created.body.data.id as string;
  await request(app).post(`/api/sale-orders/${id}/confirm`).set(admin).send({}).expect(200);
  return id;
}

/** POST /orders exactly as OrderForm posts it */
const postOrder = (body: Record<string, unknown>) =>
  request(app)
    .post('/api/orders')
    .set(admin)
    .send({ orderDate: PO_DATE, expectedDeliveryDate: SHIP, priority: 'MEDIUM', ...body });

const itemFor = (key: string, m: number, l: number, colorId?: string) => {
  const st = styles[key];
  const colour = colorId ?? st.colours[0] ?? '';
  return {
    styleId: st.id,
    unitPrice: 200,
    totalQuantity: m + l,
    breakup: [
      { colorId: colour, sizeId: st.sizeM, quantity: m },
      { colorId: colour, sizeId: st.sizeL, quantity: l },
    ].filter((b) => b.quantity > 0),
  };
};

beforeAll(async () => {
  const a = await createTestUser({
    email: `admin-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = a.id;
  admin = getAuthHeader(a.id, 'ADMIN');
  customerA = (
    await prisma.customers.create({
      data: { code: `${RUN}-A`, name: `${RUN} Buyer A`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
    })
  ).id;
  customerB = (
    await prisma.customers.create({
      data: { code: `${RUN}-B`, name: `${RUN} Buyer B`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
    })
  ).id;
  await makeStyle('X', ['Black']); // form-filled orders
  await makeStyle('Y', ['Red', 'Blue']); // several colours
  await makeStyle('Z', ['Green']); // Start Production
  await makeStyle('W', ['Grey']); // not on the sale order
});

afterAll(async () => {
  const customerIds = [customerA, customerB];
  const orderIds = (
    await prisma.orders.findMany({ where: { customerId: { in: customerIds } }, select: { id: true } })
  ).map((o) => o.id);
  const woIds = (await prisma.work_orders.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map(
    (w) => w.id
  );
  const orderItemIds = (
    await prisma.order_items.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
  ).map((i) => i.id);
  const styleIds = Object.values(styles).map((s) => s.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_order_breakup', () => prisma.work_order_breakup.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: { in: woIds } } })],
    [
      'order_item_costing',
      () => prisma.order_item_costing.deleteMany({ where: { orderItemId: { in: orderItemIds } } }),
    ],
    [
      'order_item_breakup',
      () => prisma.order_item_breakup.deleteMany({ where: { orderItemId: { in: orderItemIds } } }),
    ],
    ['order_items', () => prisma.order_items.deleteMany({ where: { id: { in: orderItemIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: { in: customerIds } } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: { in: customerIds } } })],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: { id: { in: costingIds } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: styleIds } } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: { in: customerIds } } })],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { userId: only(adminId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(adminId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[order-from-sale-order teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('Orders → New made from a sale order', () => {
  let soId: string;

  it('lists the open sale orders of that customer carrying the style, with what is still open', async () => {
    soId = await confirmedSo(customerA, 'X', [
      { size: 'M', quantity: 10 },
      { size: 'L', quantity: 6 },
    ]);
    await confirmedSo(customerB, 'X', [{ size: 'M', quantity: 4 }]); // another buyer: not offered

    const res = await request(app)
      .get(`/api/sale-orders/open-for-style?customerId=${customerA}&styleId=${styles.X.id}`)
      .set(admin)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    const so = res.body.data[0];
    expect(so.id).toBe(soId);
    expect(so.styleCount).toBe(1);
    expect(so.lines.map((l: { open: number }) => l.open).sort()).toEqual([10, 6].sort());
    expect(so.lines[0].unitPrice).toBe(200);
    expect(so.lines[0].colorId).toBeNull();
  });

  it('refuses a foreign customer, a style the sale order lacks, more than is open, and a Delivery past the deadline', async () => {
    const foreignCustomer = await postOrder({ customerId: customerB, saleOrderId: soId, items: [itemFor('X', 10, 6)] });
    expect(foreignCustomer.status).toBe(422);
    expect(foreignCustomer.body.message).toMatch(/different customer/);

    const foreignStyle = await postOrder({ customerId: customerA, saleOrderId: soId, items: [itemFor('W', 1, 0)] });
    expect(foreignStyle.status).toBe(422);
    expect(foreignStyle.body.message).toMatch(/does not carry/);

    const tooMany = await postOrder({ customerId: customerA, saleOrderId: soId, items: [itemFor('X', 11, 6)] });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.message).toMatch(/more than the 16 pcs/);

    const late = await postOrder({
      customerId: customerA,
      saleOrderId: soId,
      expectedDeliveryDate: '2026-12-21',
      items: [itemFor('X', 10, 6)],
    });
    expect(late.status).toBe(400);
    expect(late.body.message).toMatch(/after .* Buyer Deadline/);

    expect(await prisma.orders.count({ where: { saleOrderId: soId } })).toBe(0);
  });

  it('links the order, gives a colourless size line the style colour, and keeps the PO date', async () => {
    // A size line sent without a colour (a size-only row) still lands in the style's only colour
    const res = await postOrder({ customerId: customerA, saleOrderId: soId, items: [itemFor('X', 10, 6, '')] });
    expect(res.status).toBe(201);
    const order = await prisma.orders.findUniqueOrThrow({
      where: { id: res.body.data.id },
      include: { order_items: { include: { order_item_breakup: true } } },
    });
    expect(order.saleOrderId).toBe(soId);
    expect(order.orderDate.toISOString().slice(0, 10)).toBe(PO_DATE);
    expect(order.totalQuantity).toBe(16);
    expect(order.order_items[0].order_item_breakup.every((b) => b.colorId === styles.X.colours[0])).toBe(true);

    // It is no longer offered, and a second order for it is refused
    const open = await request(app)
      .get(`/api/sale-orders/open-for-style?customerId=${customerA}&styleId=${styles.X.id}`)
      .set(admin)
      .expect(200);
    expect(open.body.data).toHaveLength(0);
    const second = await postOrder({ customerId: customerA, saleOrderId: soId, items: [itemFor('X', 1, 0)] });
    expect(second.status).toBe(409);

    // Editing keeps it within the Buyer Deadline
    const late = await request(app)
      .put(`/api/orders/${order.id}`)
      .set(admin)
      .send({ expectedDeliveryDate: '2026-12-25' });
    expect(late.status).toBe(400);
    expect(late.body.message).toMatch(/Buyer Deadline/);
  });

  it('an order saved without the link still goes through (the page only warns)', async () => {
    const res = await postOrder({ customerId: customerB, items: [itemFor('X', 2, 0)] });
    expect(res.status).toBe(201);
    const order = await prisma.orders.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(order.saleOrderId).toBeNull();
  });
});

describe('Start Production follows the model', () => {
  it("gives colourless lines the style's colour, dates the order as the buyer's PO, aims at the ship date", async () => {
    const soId = await confirmedSo(customerA, 'Z', [
      { size: 'M', quantity: 3 },
      { size: 'L', quantity: 2 },
    ]);
    const res = await request(app).post(`/api/sale-orders/${soId}/start-production`).set(admin).send({}).expect(201);
    const order = await prisma.orders.findUniqueOrThrow({
      where: { id: res.body.data.id },
      include: {
        order_items: { include: { order_item_breakup: true } },
        work_orders: { include: { work_order_breakup: true } },
      },
    });
    expect(order.order_items[0].order_item_breakup.every((b) => b.colorId === styles.Z.colours[0])).toBe(true);
    expect(order.orderDate.toISOString().slice(0, 10)).toBe(PO_DATE);
    expect(order.expectedDeliveryDate.toISOString().slice(0, 10)).toBe(SHIP);
    expect(order.work_orders.length).toBeGreaterThan(0);
    for (const wo of order.work_orders) {
      expect(wo.work_order_breakup.every((b) => b.colorId === styles.Z.colours[0])).toBe(true);
    }
  });

  it('refuses a colourless line on a style with several colours, naming it', async () => {
    const soId = await confirmedSo(customerA, 'Y', [{ size: 'M', quantity: 3 }]);
    const res = await request(app).post(`/api/sale-orders/${soId}/start-production`).set(admin).send({}).expect(400);
    expect(res.body.message).toMatch(/comes in 2 colours/);
    expect(await prisma.orders.count({ where: { saleOrderId: soId } })).toBe(0);
  });
});

describe("a sale order's own dates", () => {
  it('refuses an Expected Ship Date after the Buyer Deadline; the B2B shape (ship date only) passes', async () => {
    const bad = await request(app)
      .post('/api/sale-orders')
      .set(admin)
      .send({ customerId: customerA, expectedShipDate: '2026-12-21', buyerDeadline: DEADLINE, items: [] })
      .expect(400);
    expect(bad.body.message).toMatch(/after the Buyer Deadline/);

    // What the B2B app pushes: an ISO ship date and no deadline
    await request(app)
      .post('/api/sale-orders')
      .set(admin)
      .send({ customerId: customerA, expectedShipDate: new Date('2026-12-21').toISOString(), items: [] })
      .expect(201);
  });
});
