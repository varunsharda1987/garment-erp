/**
 * B2B CONTRACT TEST — the House of Kasya B2B app's promises, executable.
 *
 * The B2B sales app (kasya-b2b-api, LIVE since 2026-07-23) is a pure API consumer of this
 * ERP. Its dependence on our payload/read-back shapes is documented in
 * docs/B2B_INTEGRATION_GUIDE.md (§3 push shape, §4 read-back fields, §5 frozen points).
 * This suite plays the B2B app's role against the real routes so any commit that breaks a
 * promise fails HERE, before deploy — not in the buyer app. UCIP (read-only consumer)
 * shelters under the same §5 points.
 *
 * If a test here fails, DO NOT relax the assertion to make it pass: either revert the
 * breaking change, or coordinate with the B2B app first and update the guide + this suite
 * together (they must always agree).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `B2BC${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let styleId: string;
let sizeSId: string;
let sizeMId: string;

const SO_STATUS_VALUES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

/** The §3 push payload, exactly as the B2B app sends it. */
function b2bPushPayload(overrides: Record<string, any> = {}) {
  return {
    customerId,
    buyerPoNumber: `${RUN}-PO-0012`,
    expectedShipDate: '2026-09-15T00:00:00.000Z', // full ISO — the B2B side's format
    remarks: `House of Kasya PO ${RUN}-PO-0012 (KASYA) — contract test`,
    items: [
      { styleId, colorId: null, sizeId: sizeSId, quantity: 2, unitPrice: 450 },
      { styleId, colorId: null, sizeId: sizeMId, quantity: 3, unitPrice: 450 },
    ],
    ...overrides,
  };
}

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
      name: `${RUN} House Of Kasya`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: testUserId,
    },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}A`, styleName: `${RUN} Pushed Style`, createdById: testUserId },
  });
  styleId = style.id;

  const sizeS = await prisma.size_options.create({
    data: { id: randomUUID(), styleId, sizeName: 'S', sizeCode: 'S' },
  });
  sizeSId = sizeS.id;
  const sizeM = await prisma.size_options.create({
    data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: 'M' },
  });
  sizeMId = sizeM.id;
});

afterAll(async () => {
  try {
    await prisma.sale_orders.deleteMany({
      where: { saleOrderNumber: { startsWith: 'SO' }, remarks: { contains: RUN } },
    });
    await prisma.style_variants.deleteMany({ where: { style: { styleCode: { startsWith: RUN } } } });
    await prisma.styles.deleteMany({ where: { styleCode: { startsWith: RUN } } });
    await prisma.customers.deleteMany({ where: { id: only(customerId) } });
    await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  } catch {
    // ignore cleanup errors
  }
  await prisma.$disconnect();
});

describe('§3 — the push payload the B2B app sends', () => {
  it('POST /sale-orders accepts the exact B2B shape (styleId/colorId/sizeId/quantity/unitPrice + buyerPoNumber + full-ISO date) → 201', async () => {
    const res = await request(app).post('/api/sale-orders').set(authHeader).send(b2bPushPayload());

    expect(res.status).toBe(201);
    const so = res.body?.data ?? res.body;
    expect(so.id).toBeTruthy();
    expect(so.saleOrderNumber).toBeTruthy();
    expect(so.status).toBe('DRAFT');

    // clean up via the contract's own delete path later tests rely on
    await request(app).delete(`/api/sale-orders/${so.id}`).set(authHeader);
  });

  it("§5.2 — expectedShipDate also accepts this ERP's own bare YYYY-MM-DD", async () => {
    const res = await request(app)
      .post('/api/sale-orders')
      .set(authHeader)
      .send(b2bPushPayload({ expectedShipDate: '2026-09-20' }));

    expect(res.status).toBe(201);
    const so = res.body?.data ?? res.body;
    await request(app).delete(`/api/sale-orders/${so.id}`).set(authHeader);
  });
});

describe('§4 — what the B2B app reads back from GET /sale-orders/:id', () => {
  let soId: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/sale-orders').set(authHeader).send(b2bPushPayload());
    soId = (res.body?.data ?? res.body).id;
  });

  afterAll(async () => {
    await prisma.sale_orders.deleteMany({ where: { id: only(soId) } });
  });

  it('returns the UNWRAPPED order object with every field the B2B app reads', async () => {
    const res = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader);
    expect(res.status).toBe(200);

    const so = res.body;
    // Unwrapped: the order itself IS the body (no {success,data} envelope)
    expect(so.id).toBe(soId);
    expect(so.data).toBeUndefined();

    // Status from the fixed 6-value list; terminal logic depends on these exact strings
    expect(SO_STATUS_VALUES).toContain(so.status);

    expect(so.saleOrderNumber).toBeTruthy();
    expect(so.saleDate).toBeTruthy();
    expect(so.expectedShipDate).toBeTruthy();
    expect(so.buyerPoNumber).toBe(`${RUN}-PO-0012`);

    // items[]: quantity / allocatedQty / dispatchedQty / unitPrice + nested identities
    expect(Array.isArray(so.items)).toBe(true);
    expect(so.items.length).toBe(2);
    for (const item of so.items) {
      expect(typeof item.quantity).toBe('number');
      expect(typeof item.allocatedQty).toBe('number');
      expect(typeof item.dispatchedQty).toBe('number');
      expect(item.unitPrice).toBeDefined();
      expect(item.style?.styleCode).toBe(`${RUN}A`);
      expect(item.style?.styleName).toBeTruthy();
      expect(item.size?.sizeName).toBeTruthy();
      expect(item.size?.sizeCode).toBeTruthy();
    }

    // Delivery-note / invoice counts: the serializer preserves the `_count` KEY but
    // camelizes its inner keys — the real emitted shape is `_count.deliveryNotes` /
    // `_count.invoices` (verified 2026-08-24; the guide previously mis-documented this,
    // and the B2B client's fallback chain missed both spellings — its modal counts were
    // silently 0. The B2B side reads `_count?.deliveryNotes` as of the same date.)
    expect(typeof so._count?.deliveryNotes).toBe('number');
    expect(typeof so._count?.invoices).toBe('number');

    // productionOrders[] — empty until the factory clicks Start Production
    expect(Array.isArray(so.productionOrders)).toBe(true);
  });

  it('PUT re-sends the identical shape and the ERP replaces the item set wholesale', async () => {
    const res = await request(app)
      .put(`/api/sale-orders/${soId}`)
      .set(authHeader)
      .send(b2bPushPayload({ items: [{ styleId, colorId: null, sizeId: sizeSId, quantity: 7, unitPrice: 500 }] }));
    expect(res.status).toBeLessThan(300);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader);
    expect(after.body.items.length).toBe(1);
    expect(after.body.items[0].quantity).toBe(7);
  });

  it('a client-sent status on PUT is stripped — status is never writable (landmine №2)', async () => {
    const res = await request(app)
      .put(`/api/sale-orders/${soId}`)
      .set(authHeader)
      .send(
        b2bPushPayload({
          status: 'DISPATCHED',
          items: [{ styleId, colorId: null, sizeId: sizeSId, quantity: 7, unitPrice: 500 }],
        })
      );
    expect(res.status).toBeLessThan(300);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader);
    expect(after.body.status).toBe('DRAFT');
  });
});

describe('§5.5 — DRAFT-only updates', () => {
  it('a confirmed order refuses a re-send (the B2B pre-flight relies on this rule existing)', async () => {
    const created = await request(app).post('/api/sale-orders').set(authHeader).send(b2bPushPayload());
    const soId = (created.body?.data ?? created.body).id;

    const confirm = await request(app).post(`/api/sale-orders/${soId}/confirm`).set(authHeader).send({});
    expect(confirm.status).toBeLessThan(300);

    const resend = await request(app).put(`/api/sale-orders/${soId}`).set(authHeader).send(b2bPushPayload());
    expect(resend.status).toBeGreaterThanOrEqual(400);

    const check = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader);
    expect(check.body.status).toBe('CONFIRMED');
    expect(check.body.items.length).toBe(2); // items untouched by the refused re-send

    await prisma.sale_orders.deleteMany({ where: { id: only(soId) } });
  });
});

describe('§5.4 — HTTP status semantics', () => {
  it('a deleted sale order returns 404 on GET (the B2B "Deleted in factory" signal)', async () => {
    const created = await request(app).post('/api/sale-orders').set(authHeader).send(b2bPushPayload());
    const soId = (created.body?.data ?? created.body).id;

    const del = await request(app).delete(`/api/sale-orders/${soId}`).set(authHeader);
    expect(del.status).toBeLessThan(300);

    const gone = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader);
    expect(gone.status).toBe(404);
  });
});

describe('§5.9 + §2 — the style auto-create path', () => {
  it('POST /styles accepts the minimal B2B auto-create payload', async () => {
    const res = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({
        styleCode: `${RUN}NEW`,
        styleName: `${RUN} Auto-created`,
        brandName: 'Kasya',
        customerName: `${RUN} House Of Kasya`,
        sellingPrice: 450,
        status: 'DRAFT',
      });
    expect([200, 201]).toContain(res.status);
  });

  it('a duplicate styleCode fails with the exact error text the B2B app sniffs', async () => {
    const res = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({
        styleCode: `${RUN}NEW`,
        styleName: `${RUN} Duplicate`,
        status: 'DRAFT',
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const message = JSON.stringify(res.body);
    expect(message).toContain('Style code already exists');
  });

  it('§5.8 — POST /styles/:id/variants is ADDITIVE (factory-added sizes survive a B2B re-send)', async () => {
    // Factory adds size S by hand
    const first = await request(app)
      .post(`/api/styles/${styleId}/variants`)
      .set(authHeader)
      .send({ variants: [{ size: 'S', sku: `${RUN}AS`, isActive: true }] });
    expect(first.status).toBeLessThan(300);

    // B2B re-send adds only its missing size M — S must survive
    const second = await request(app)
      .post(`/api/styles/${styleId}/variants`)
      .set(authHeader)
      .send({ variants: [{ size: 'M', sku: `${RUN}AM`, isActive: true }] });
    expect(second.status).toBeLessThan(300);

    const variants = await prisma.style_variants.findMany({ where: { styleId } });
    const skus = variants.map((v) => v.sku);
    expect(skus).toContain(`${RUN}AS`);
    expect(skus).toContain(`${RUN}AM`);
  });
});
