/**
 * An ASN must not be filed promising a quantity it does not describe (silent-data-loss finding #9).
 *
 * ASNCreateForm builds an editable SKU table. When an order item has no size/colour breakup it
 * pushed a synthetic line with `colorId: ''` and `sizeId: ''`, counted its quantity into the header
 * total, and then on submit filtered out every line whose ids were blank — while still sending the
 * full `plannedDispatchQty`. `asn_skus.colorId` and `.sizeId` are NOT NULL, so those lines could
 * never have been stored anyway.
 *
 * The result was an ASN filed with the buyer promising e.g. 2,300 pcs and containing ZERO SKU lines.
 * The success toast and the redirect were identical to a correct save, and the detail page hid the
 * SKU card entirely when it was empty — so nothing anywhere said the breakdown had been dropped.
 * Every order item in this database takes that branch (order_item_breakup is empty).
 *
 * The server now refuses each way that can happen, so a header quantity always describes the lines
 * filed with it.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `ASNB${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let orderId: string;
let styleId: string;
let colorId: string;
let sizeId: string;

const asnIds: string[] = [];

const createASN = (body: Record<string, unknown>) => request(app).post('/api/dispatch/asn').set(authHeader).send(body);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  // Colour/size options are per-style, and this database has none — create our own so the fixture
  // never borrows another style's rows.
  colorId = (
    await prisma.color_options.create({
      data: { id: randomUUID(), styleId, colorName: `${RUN} Navy` },
    })
  ).id;
  sizeId = (
    await prisma.size_options.create({
      data: { id: randomUUID(), styleId, sizeName: `${RUN}-M`, sizeCode: 'M' },
    })
  ).id;

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}-ORD`,
      customerId,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: 100,
      totalAmount: 10000,
      createdById: userId,
    },
  });
  orderId = order.id;

  await prisma.order_items.create({
    data: {
      id: randomUUID(),
      orderId,
      styleId,
      totalQuantity: 100,
      unitPrice: 100,
      totalPrice: 10000,
    },
  });
});

afterAll(async () => {
  if (asnIds.length > 0) {
    await prisma.asn_skus.deleteMany({ where: { asnId: { in: asnIds } } });
    await prisma.asn_applications.deleteMany({ where: { id: { in: asnIds } } });
  }
  await prisma.order_items.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.color_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.size_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

const base = {
  cartonsPlanned: 5,
  requestedShipDate: new Date(Date.now() + 20 * 86400000).toISOString(),
};

describe('Creating an ASN', () => {
  it('accepts a header-only ASN when the order genuinely has no breakup', async () => {
    // This is the honest outcome for the sizes-later workflow, and it must keep working: the header
    // total IS the whole truth when there is no SKU-level information to record.
    const res = await createASN({ ...base, orderId, plannedDispatchQty: 100 });
    expect(res.status).toBe(201);
    if (res.body?.data?.id) asnIds.push(res.body.data.id);
  });

  it('refuses a breakdown whose quantities do not add up to the header', async () => {
    // The reported bug in its purest form: lines saying one thing, header saying another.
    const res = await createASN({
      ...base,
      orderId,
      plannedDispatchQty: 100,
      skus: [{ colorId, sizeId, plannedQty: 40 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/do not add up/i);
  });

  it('accepts a breakdown that does add up', async () => {
    const res = await createASN({
      ...base,
      orderId,
      plannedDispatchQty: 60,
      skus: [{ colorId, sizeId, plannedQty: 60 }],
    });
    expect(res.status).toBe(201);
    if (res.body?.data?.id) asnIds.push(res.body.data.id);

    const stored = await prisma.asn_skus.count({ where: { asnId: res.body.data.id } });
    expect(stored).toBe(1);
  });

  it('rejects a SKU line with no colour or size instead of dropping it', async () => {
    // The form used to send exactly this shape and the server used to strip it to nothing. It is
    // now a 400 at the Zod boundary, because those columns are NOT NULL.
    const res = await createASN({
      ...base,
      orderId,
      plannedDispatchQty: 100,
      skus: [{ colorId: '', sizeId: '', plannedQty: 100 }],
    });
    expect(res.status).toBe(400);

    // ...and nothing was filed.
    const filed = await prisma.asn_applications.count({
      where: { orderId, plannedDispatchQty: 100, skuBreakdown: { none: {} } },
    });
    expect(filed).toBe(1); // only the legitimate header-only ASN from the first test
  });

  it('rejects a zero-quantity SKU line', async () => {
    const res = await createASN({
      ...base,
      orderId,
      plannedDispatchQty: 0,
      skus: [{ colorId, sizeId, plannedQty: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate SKU lines rather than dying on the unique index', async () => {
    const res = await createASN({
      ...base,
      orderId,
      plannedDispatchQty: 80,
      skus: [
        { colorId, sizeId, plannedQty: 40 },
        { colorId, sizeId, plannedQty: 40 },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/duplicate/i);
  });
});
