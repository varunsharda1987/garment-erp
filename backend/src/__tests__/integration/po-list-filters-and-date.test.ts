/**
 * Purchase Orders list API + the settable PO date (PO list bug hunt, 2026-09-27).
 *
 * - PO date (owner decision): settable on create / edit, a past date allowed, never after today (IST);
 *   omitted = now. It was @default(now()) and never settable, so 8-9 of 10 received POs were "dated"
 *   after their goods arrived — and the printed PO and the greige live-rate ranking read it.
 * - "Delivery: to be advised" returned 5 RECEIVED legacy POs: only a PO still waiting for goods can
 *   need a place. The status condition is ANDed, so an explicit status filter still narrows.
 * - ?orderId= matched only purchase_orders.orderId, which MRP-generated POs never set — their link to
 *   the order is requirement_po_links → material_requirements.orderId. Style search likewise.
 * - The query schema passed any poCategories / sortBy / date to Prisma → 400 "Invalid data provided
 *   to database". Each is now checked and named.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { toDateInputValue } from '../../utils/date';

const RUN = `POLF${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let authHeader: Record<string, string>;
let userId: string;
let supplierId: string;
let materialId: string;
let customerId: string;
let styleId: string;
let orderId: string;
let orderItemId: string;

const poIds: string[] = [];

const dayOf = (d: Date | string | null | undefined) => (d ? toDateInputValue(d) : '');

async function makePO(suffix: string, status: 'SENT' | 'RECEIVED', extra: { orderId?: string } = {}) {
  const po = await prisma.purchase_orders.create({
    data: {
      id: randomUUID(),
      poNumber: `${RUN}-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 20 * DAY),
      status,
      poCategory: 'TRIMS',
      createdById: userId,
      orderId: extra.orderId,
    },
  });
  poIds.push(po.id);
  return po.id;
}

const createPo = async (body: Record<string, unknown>) => {
  const res = await request(app)
    .post('/api/purchase-orders')
    .set(authHeader)
    .send({
      supplierId,
      expectedDeliveryDate: new Date(Date.now() + 10 * DAY).toISOString(),
      poCategory: 'TRIMS',
      items: [{ materialId, orderedQuantity: 10, unit: 'METER', unitPrice: 5 }],
      ...body,
    });
  if (res.status === 201) poIds.push(res.body.data.id);
  return res;
};

const list = (query: Record<string, string>) =>
  request(app)
    .get('/api/purchase-orders')
    .query({ limit: '100', ...query })
    .set(authHeader);

const numbersIn = (res: request.Response): string[] =>
  (res.body.data ?? []).map((p: { poNumber: string }) => p.poNumber);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}SUP`, name: `${RUN} Supplier`, createdById: userId } })
  ).id;

  const categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  materialId = (
    await prisma.materials.create({
      data: {
        id: randomUUID(),
        code: `${RUN}-MAT`,
        name: `${RUN} Material`,
        categoryId,
        materialType: 'OTHER',
        unit: 'METER',
      },
    })
  ).id;

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}-ORD`,
        customerId,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 30 * DAY),
        totalQuantity: 100,
        totalAmount: 10000,
        createdById: userId,
      },
    })
  ).id;
  orderItemId = (
    await prisma.order_items.create({
      data: { id: randomUUID(), orderId, styleId, totalQuantity: 100, unitPrice: 100, totalPrice: 10000 },
    })
  ).id;
});

afterAll(async () => {
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: only(materialId) }, select: { id: true } })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  if (poIds.length > 0) {
    await prisma.po_delivery_plan_revisions.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.po_delivery_points.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } });
  }
  await prisma.order_items.deleteMany({ where: { id: only(orderItemId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('PO date is settable — past allowed, never after today', () => {
  let poId: string;

  it('keeps a past PO date typed on create', async () => {
    const yesterday = toDateInputValue(new Date(Date.now() - DAY));
    const res = await createPo({ poDate: yesterday });
    expect(res.status).toBe(201);
    poId = res.body.data.id;

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(dayOf(po.poDate)).toBe(yesterday);
    // The number is still today's series — the typed date never feeds it
    expect(po.poNumber).toMatch(/^PO\d{4}-\d{4}$/);
  });

  it('dates a PO created without one today', async () => {
    const res = await createPo({});
    expect(res.status).toBe(201);
    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(dayOf(po.poDate)).toBe(toDateInputValue(new Date()));
  });

  it('refuses a PO date after today on create', async () => {
    const res = await createPo({ poDate: toDateInputValue(new Date(Date.now() + 2 * DAY)) });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.details)).toMatch(/poDate/);
  });

  it('changes the PO date on edit, and refuses a future one', async () => {
    const tenDaysAgo = toDateInputValue(new Date(Date.now() - 10 * DAY));
    const ok = await request(app).put(`/api/purchase-orders/${poId}`).set(authHeader).send({ poDate: tenDaysAgo });
    expect(ok.status).toBe(200);
    expect(dayOf((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).poDate)).toBe(tenDaysAgo);

    const future = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set(authHeader)
      .send({ poDate: toDateInputValue(new Date(Date.now() + 2 * DAY)) });
    expect(future.status).toBe(400);
    expect(dayOf((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).poDate)).toBe(tenDaysAgo);
  });

  it('leaves the PO date alone when an edit does not send one', async () => {
    const before = (await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).poDate;
    const res = await request(app).put(`/api/purchase-orders/${poId}`).set(authHeader).send({ remarks: 'edited' });
    expect(res.status).toBe(200);
    const after = (await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).poDate;
    expect(after.getTime()).toBe(before.getTime());
  });

  it('answers an edit of a sent PO with a 422 naming it, not a 500', async () => {
    const sentId = await makePO('S', 'SENT');
    const res = await request(app).put(`/api/purchase-orders/${sentId}`).set(authHeader).send({ remarks: 'late edit' });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_NOT_EDITABLE');
  });

  it('answers an unknown PO with a 404, not a 500', async () => {
    const res = await request(app).get(`/api/purchase-orders/${randomUUID()}`).set(authHeader);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Purchase order not found');
  });
});

describe('"Delivery: to be advised" lists only POs still waiting for goods', () => {
  beforeAll(async () => {
    await makePO('T-OPEN', 'SENT');
    await makePO('T-DONE', 'RECEIVED');
  });

  it('leaves out a finished PO with an empty delivery place', async () => {
    const res = await list({ delivery: 'TO_BE_ADVISED', search: RUN });
    expect(res.status).toBe(200);
    expect(numbersIn(res)).toContain(`${RUN}-T-OPEN`);
    expect(numbersIn(res)).not.toContain(`${RUN}-T-DONE`);
  });

  it('still narrows by an explicit status rather than overwriting it', async () => {
    const res = await list({ delivery: 'TO_BE_ADVISED', status: 'RECEIVED', search: RUN });
    expect(res.status).toBe(200);
    expect(numbersIn(res)).toEqual([]);
  });
});

describe('?orderId= and style search reach an MRP PO through its requirement links', () => {
  beforeAll(async () => {
    // An MRP-shaped PO: no orderId / styleId of its own — the order is on the requirement
    const mrpPoId = await makePO('M-MRP', 'SENT');
    const line = await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId: mrpPoId,
        materialId,
        orderedQuantity: 10,
        receivedQuantity: 0,
        unitPrice: 5,
        totalPrice: 50,
        unit: 'METER',
      },
    });
    const req = await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-R1`,
        source: 'WORK_ORDER',
        unit: 'METER',
        materialId,
        orderId,
        orderItemId,
        orderQuantity: 100,
        quantityPerUnit: 0.1,
        wastagePercent: 0,
        totalRequired: 10,
        shortfall: 10,
        status: 'PO_SENT',
        requiredDate: new Date(Date.now() + 30 * DAY),
        createdById: userId,
      },
    });
    await prisma.requirement_po_links.create({
      data: {
        requirementId: req.id,
        purchaseOrderId: mrpPoId,
        purchaseOrderItemId: line.id,
        allocatedQuantity: 10,
        receivedQuantity: 0,
      },
    });
    // A manual PO carrying the order on its own column
    await makePO('M-MANUAL', 'SENT', { orderId });
  });

  it('finds both homes of the order', async () => {
    const res = await list({ orderId });
    expect(res.status).toBe(200);
    expect(numbersIn(res).sort()).toEqual([`${RUN}-M-MANUAL`, `${RUN}-M-MRP`]);
  });

  it('finds the MRP PO by the style it is bought for', async () => {
    const res = await list({ search: `${RUN}-STY` });
    expect(res.status).toBe(200);
    expect(numbersIn(res)).toEqual([`${RUN}-M-MRP`]);
  });
});

describe('The list query refuses what Prisma would choke on', () => {
  it('checks every poCategories value against the POCategory enum', async () => {
    expect((await list({ poCategories: 'GREIGE,NOT_A_CATEGORY' })).status).toBe(400);
    expect((await list({ poCategories: 'GREIGE,TRIMS,THREAD', search: RUN })).status).toBe(200);
  });

  it('sorts only by a real column', async () => {
    expect((await list({ sortBy: 'password' })).status).toBe(400);
    expect((await list({ sortBy: 'poDate', sortOrder: 'asc', search: RUN })).status).toBe(200);
  });

  it('checks the dates', async () => {
    expect((await list({ startDate: 'yesterday-ish' })).status).toBe(400);
    const res = await list({ startDate: toDateInputValue(new Date(Date.now() - DAY)), search: RUN });
    expect(res.status).toBe(200);
  });

  it('returns lines in the PO page order with the label fields for grouping', async () => {
    const res = await list({ search: `${RUN}-M-MRP` });
    expect(res.status).toBe(200);
    // The serializer names purchase_order_items `items`
    const material = res.body.data[0]?.items?.[0]?.materials;
    expect(material).toBeDefined();
    expect(material).toHaveProperty('labelId');
  });
});
