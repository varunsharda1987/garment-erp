/**
 * Every widened list search, exercised against the real routes.
 *
 * Search fields are declared as STRING PATHS (`'items[].style.styleCode'`), which TypeScript
 * cannot check — a typo or a renamed relation only shows up when Prisma is handed the query, as a
 * 500 on a screen nobody tests by hand. This suite types a term into every list endpoint and
 * insists on a 200, which is exactly what a bad path would break.
 *
 * It also pins the behaviour the audit was about: multi-word queries, and searching by a column
 * the page displays.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `LSC${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;

/** Every list endpoint whose search was widened, with the query key it reads. */
const LIST_ENDPOINTS: Array<{ label: string; path: string }> = [
  { label: 'sale orders', path: '/api/sale-orders' },
  { label: 'sale order typeahead', path: '/api/sale-orders/search' },
  { label: 'orders (production)', path: '/api/orders' },
  { label: 'invoices', path: '/api/invoices' },
  { label: 'quotations', path: '/api/quotations' },
  { label: 'purchase orders', path: '/api/purchase-orders' },
  { label: 'GRN', path: '/api/grn' },
  { label: 'job work orders', path: '/api/job-work-orders' },
  { label: 'work orders', path: '/api/work-orders' },
  { label: 'delivery notes', path: '/api/dispatch/delivery-notes' },
  { label: 'ASN', path: '/api/dispatch/asn' },
];

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
});

afterAll(async () => {
  try {
    await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  } catch (err) {
    console.error('[listSearchCoverage teardown] could not clean users:', err);
  }
  await prisma.$disconnect();
});

describe('every widened search field path is valid Prisma', () => {
  it.each(LIST_ENDPOINTS)('$label accepts a search term', async ({ path }) => {
    // A bad field path makes Prisma throw, which the error middleware turns into a 500.
    const res = await request(app).get(`${path}?search=${RUN}-no-such-record&limit=5`).set(authHeader);

    expect(res.status).toBe(200);
  });

  it.each(LIST_ENDPOINTS)('$label accepts a MULTI-WORD search term', async ({ path }) => {
    // Multi-word queries build one AND clause per word; this proves the nesting survives that.
    const res = await request(app).get(`${path}?search=${RUN}%20second%20third&limit=5`).set(authHeader);

    expect(res.status).toBe(200);
  });
});

describe('searching a sale order by the things the list shows', () => {
  let customerId: string;
  let styleId: string;
  let soId: string;

  beforeAll(async () => {
    const customer = await prisma.customers.create({
      data: {
        code: `${RUN}-CUST`,
        name: `${RUN} Acme Trading`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    });
    customerId = customer.id;

    const style = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode: `${RUN}STYLE`,
        styleName: `${RUN} Nightgown`,
        buyerStyleRef: `${RUN}BUYERREF`,
        createdById: testUserId,
      },
    });
    styleId = style.id;

    const created = await request(app)
      .post('/api/sale-orders')
      .set(authHeader)
      .send({ customerId, items: [{ styleId, quantity: 5, unitPrice: 100 }] })
      .expect(201);
    soId = created.body.data.id;
  });

  afterAll(async () => {
    const steps: Array<[string, () => Promise<unknown>]> = [
      ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
      ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: only(customerId) } })],
      ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
      ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ];
    for (const [label, run] of steps) {
      try {
        await run();
      } catch (err) {
        console.error(`[listSearchCoverage teardown] could not clean ${label}:`, err);
      }
    }
  });

  const findIds = async (term: string) => {
    const res = await request(app)
      .get(`/api/sale-orders?search=${encodeURIComponent(term)}&limit=100`)
      .set(authHeader)
      .expect(200);
    return res.body.data.map((row: { id: string }) => row.id);
  };

  it('finds it by style code — the Style(s) column the list renders', async () => {
    expect(await findIds(`${RUN}STYLE`)).toContain(soId);
  });

  it("finds it by the buyer's style code", async () => {
    expect(await findIds(`${RUN}BUYERREF`)).toContain(soId);
  });

  it('finds it by customer name', async () => {
    expect(await findIds('Acme Trading')).toContain(soId);
  });

  it('finds it by a customer word and a style word TOGETHER', async () => {
    // The audit's headline failure: matching the whole phrase against each field meant
    // "acme <style>" — a customer and a style — found nothing at all.
    expect(await findIds(`Acme ${RUN}STYLE`)).toContain(soId);
  });

  it('finds it when a word is skipped from the middle of the customer name', async () => {
    expect(await findIds(`${RUN} Trading`)).toContain(soId);
  });

  it('does NOT return it when one of the words matches nothing', async () => {
    // Every word must match something — otherwise the extra word would not narrow anything.
    expect(await findIds(`Acme ${RUN}-NOTHING-MATCHES`)).not.toContain(soId);
  });

  it('the typeahead finds it by style code too, not just the list', async () => {
    const res = await request(app)
      .get(`/api/sale-orders/search?search=${RUN}STYLE&limit=50`)
      .set(authHeader)
      .expect(200);
    expect(res.body.map((row: { id: string }) => row.id)).toContain(soId);
  });
});
