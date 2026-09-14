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
  { label: 'styles', path: '/api/styles' },

  // 2026-09-14 sweep: the rest of the lists and every master a picker reads. Owner: "this
  // problem i have faced at other search bars as well".
  { label: 'customers', path: '/api/customers' },
  { label: 'suppliers', path: '/api/suppliers' },
  { label: 'materials', path: '/api/materials' },
  { label: 'colours', path: '/api/colors' },
  { label: 'colour typeahead', path: '/api/colors/search' },
  { label: 'agents', path: '/api/agents' },
  { label: 'agencies', path: '/api/agencies' },
  { label: 'seasons', path: '/api/seasons' },
  { label: 'product categories', path: '/api/product-categories' },
  { label: 'warehouses', path: '/api/warehouses' },
  { label: 'component masters', path: '/api/component-masters' },
  { label: 'component groups', path: '/api/component-groups' },
  { label: 'size categories', path: '/api/size-categories' },
  // Manufacturing
  { label: 'cutting batches', path: '/api/cutting/batches' },
  { label: 'stitching issues', path: '/api/stitching/issues' },
  { label: 'finishing issues', path: '/api/finishing/issues' },
  { label: 'samples', path: '/api/samples' },
  { label: 'cost sheets', path: '/api/style-costing' },
  // Stock
  { label: 'finished goods stock', path: '/api/fg-stock' },
  { label: 'lace stock', path: '/api/lace-stock' },
  { label: 'lace issue notes', path: '/api/lace-issue-notes' },
  { label: 'lace defects', path: '/api/lace-defects' },
  // Trim + fabric masters
  { label: 'lace master', path: '/api/materials/lace' },
  { label: 'button master', path: '/api/materials/button' },
  { label: 'thread master', path: '/api/materials/thread' },
  { label: 'zipper master', path: '/api/materials/zipper' },
  { label: 'elastic master', path: '/api/materials/elastic' },
  { label: 'machine part master', path: '/api/materials/machine-part' },
  { label: 'other material master', path: '/api/materials/other' },
  { label: 'embroidery master', path: '/api/embroidery' },
  // Finance
  { label: 'credit notes', path: '/api/credit-notes' },
  { label: 'debit notes', path: '/api/debit-notes' },
  { label: 'chart of accounts', path: '/api/chart-of-accounts' },
  { label: 'bank accounts', path: '/api/bank-accounts' },
  { label: 'cost centres', path: '/api/cost-centers' },
  { label: 'expense types', path: '/api/expense-types' },
  { label: 'payment terms', path: '/api/payment-terms' },
  { label: 'tax masters', path: '/api/tax-masters' },
  { label: 'HSN/SAC masters', path: '/api/hsn-sac-masters' },
  { label: 'TDS', path: '/api/tds' },
  { label: 'TCS', path: '/api/tcs' },
  // Testing
  { label: 'testing labs', path: '/api/testing-labs' },
  { label: 'test templates', path: '/api/test-templates' },
  { label: 'fabric physical tests', path: '/api/fabric-physical-tests' },
  { label: 'garment physical tests', path: '/api/garment-physical-tests' },
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

describe('the style picker: what typing reaches, and how the list is ordered', () => {
  // Why this exists (2026-09-14): with 1,116 styles the picker showed the 50 newest and searched
  // the whole phrase, so "LNG 229" found nothing and an older LNG never appeared under "LNG".
  const codes = { active: `${RUN}PICKB`, activeEarlier: `${RUN}PICKA`, draft: `${RUN}PICKDRAFT` };
  const styleIds: string[] = [];

  beforeAll(async () => {
    for (const [code, extra] of [
      [codes.active, { styleName: `${RUN} Slip Dress`, buyerStyleRef: `${RUN}PICKREF`, customerName: `${RUN} Acme` }],
      [codes.activeEarlier, { styleName: `${RUN} Camisole`, customerName: `${RUN} Acme` }],
      [codes.draft, { styleName: `${RUN} Unfinished`, status: 'DRAFT' as const }],
    ] as const) {
      const style = await prisma.styles.create({
        data: { id: randomUUID(), styleCode: code, status: 'ACTIVE', createdById: testUserId, ...extra },
      });
      styleIds.push(style.id);
    }
  });

  afterAll(async () => {
    try {
      await prisma.styles.deleteMany({ where: { id: { in: styleIds.map((id) => only(id)) } } });
    } catch (err) {
      console.error('[listSearchCoverage teardown] could not clean picker styles:', err);
    }
  });

  const findCodes = async (query: string) => {
    const res = await request(app).get(`/api/styles?${query}`).set(authHeader).expect(200);
    return res.body.data.map((row: { styleCode: string }) => row.styleCode) as string[];
  };

  it('finds a style by its code split into two words ("LNG 229")', async () => {
    expect(await findCodes(`search=${RUN}%20PICKB&limit=50`)).toContain(codes.active);
  });

  it("finds it by the buyer's code", async () => {
    expect(await findCodes(`search=${RUN}PICKREF&limit=50`)).toContain(codes.active);
  });

  it('finds it by a customer word and a code word together', async () => {
    const found = await findCodes(`search=Acme%20PICKB&limit=50`);
    expect(found).toContain(codes.active);
    expect(found).not.toContain(codes.activeEarlier);
  });

  it('lists alphabetically by code when asked to (the picker order)', async () => {
    const found = await findCodes(`search=${RUN}PICK&sortBy=styleCode&sortOrder=asc&limit=50`);
    expect(found.indexOf(codes.activeEarlier)).toBeLessThan(found.indexOf(codes.active));
  });

  it('refuses an unknown sort column instead of handing it to the database', async () => {
    await request(app).get('/api/styles?sortBy=password&limit=5').set(authHeader).expect(400);
  });

  it('the materials picker gets the page ordered by code (352 rows exceed one page)', async () => {
    // Collation-proof: the database's own ordering, not JavaScript's, decides "alphabetical" —
    // so prove the sort is honoured by its two directions mirroring each other and differing
    // from the default newest-first order, rather than by re-sorting in JS.
    const codesFor = async (query: string) => {
      const res = await request(app).get(`/api/materials?${query}`).set(authHeader).expect(200);
      return res.body.data.map((row: { code: string }) => row.code) as string[];
    };
    const asc = await codesFor('sortBy=code&sortOrder=asc&limit=25');
    const desc = await codesFor('sortBy=code&sortOrder=desc&limit=25');
    const newestFirst = await codesFor('limit=25');
    expect(asc.length).toBeGreaterThan(1);
    const all = await codesFor('sortBy=code&sortOrder=asc&limit=1000');
    expect(all.slice(0, asc.length)).toEqual(asc);
    expect([...all].reverse().slice(0, desc.length)).toEqual(desc);
    expect(asc).not.toEqual(newestFirst);
  });

  it('the materials list refuses an unknown sort column', async () => {
    await request(app).get('/api/materials?sortBy=password&limit=5').set(authHeader).expect(400);
  });

  it('status=ACTIVE leaves drafts out — the sale-order picker relies on this', async () => {
    const all = await findCodes(`search=${RUN}PICK&limit=50`);
    const activeOnly = await findCodes(`search=${RUN}PICK&status=ACTIVE&limit=50`);
    expect(all).toContain(codes.draft);
    expect(activeOnly).not.toContain(codes.draft);
    expect(activeOnly).toContain(codes.active);
  });
});

describe('the master pickers search word by word, not by phrase', () => {
  // The endpoints above only prove the field paths are valid Prisma. This proves the SEMANTICS
  // the 2026-09-14 sweep was for, on a master the Customer picker reads: words in any order,
  // each matching a different field, and a word that matches nothing excludes the row.
  let customerId: string;

  beforeAll(async () => {
    const customer = await prisma.customers.create({
      data: {
        code: `${RUN}-WORDS`,
        name: `${RUN} Northern Mills`,
        billingName: `${RUN} Northern Mills Private Limited`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    try {
      await prisma.customers.deleteMany({ where: { id: only(customerId) } });
    } catch (err) {
      console.error('[listSearchCoverage teardown] could not clean word-search customer:', err);
    }
  });

  const findsIt = async (term: string) => {
    const res = await request(app)
      .get(`/api/customers?search=${encodeURIComponent(term)}&limit=100`)
      .set(authHeader)
      .expect(200);
    return res.body.data.some((row: { id: string }) => row.id === customerId);
  };

  it('finds it by a code word and a name word together', async () => {
    expect(await findsIt(`WORDS Northern`)).toBe(true);
  });

  it('finds it with the words in the other order', async () => {
    expect(await findsIt(`Northern WORDS`)).toBe(true);
  });

  it('finds it when a word is skipped from the middle of the name', async () => {
    expect(await findsIt(`${RUN} Mills`)).toBe(true);
  });

  it('still finds it by one word alone, as phrase search did', async () => {
    expect(await findsIt(`${RUN}-WORDS`)).toBe(true);
  });

  it('excludes it as soon as one word matches nothing', async () => {
    expect(await findsIt(`Northern ${RUN}-NOTHING-MATCHES`)).toBe(false);
  });
});
