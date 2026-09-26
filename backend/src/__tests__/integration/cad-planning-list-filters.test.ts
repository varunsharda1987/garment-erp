/**
 * CAD Planning list filter bar (Buyer / Brand / Category / Orders / CAD progress).
 *
 * Read-only over live styles — the only row written is the test user. What this pins:
 *  - the tab badges (/status-counts) count exactly what the table (/styles) returns under the
 *    same filters — they share cad-list-filter.helper, and this is what keeps them sharing it
 *  - /filter-options counts are real: each option's count equals the styles the filter returns
 *  - "Costing CAD missing" etc. agree with the row's own Progress ticks (cadDetails purposes)
 *  - every filter is a clean partition: HAS_X + NO_X, open + none, add up to the unfiltered tab
 *  - repeated keys OR inside one filter; filters still apply during an all-status search
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CADF${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;

interface Option {
  value: string;
  label?: string;
  count: number;
}

interface ListRow {
  id: string;
  cadStatus: string;
  cadDetails: Array<{ purpose: string | null }>;
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
});

afterAll(async () => {
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
});

const qs = (params: Record<string, string | string[] | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
  }
  return sp.toString();
};

async function listTotal(params: Record<string, string | string[] | undefined>): Promise<number> {
  const res = await request(app)
    .get(`/api/cad-planning/styles?${qs({ limit: '1', ...params })}`)
    .set(authHeader)
    .expect(200);
  return res.body.data.pagination.total;
}

async function listRows(params: Record<string, string | string[] | undefined>): Promise<ListRow[]> {
  const res = await request(app)
    .get(`/api/cad-planning/styles?${qs({ limit: '200', ...params })}`)
    .set(authHeader)
    .expect(200);
  // Serializer maps 'styles' -> 'style' (RELATION_MAPPINGS)
  return res.body.data.style;
}

async function counts(params: Record<string, string | string[] | undefined>) {
  const res = await request(app)
    .get(`/api/cad-planning/status-counts?${qs(params)}`)
    .set(authHeader)
    .expect(200);
  return res.body.data as { PENDING: number; IN_PROGRESS: number; APPROVED: number };
}

async function options() {
  const res = await request(app).get('/api/cad-planning/filter-options').set(authHeader).expect(200);
  return res.body.data as { buyers: Option[]; brands: Option[]; productCategories: Option[] };
}

describe('filter-options', () => {
  it('lists buyers, brands and categories with labels and counts', async () => {
    const opts = await options();
    expect(opts.buyers.length).toBeGreaterThan(0);
    expect(opts.brands.length).toBeGreaterThan(0);
    for (const o of [...opts.buyers, ...opts.productCategories]) {
      expect(typeof o.label).toBe('string');
      expect(o.count).toBeGreaterThan(0);
    }
    // blank brand names are not offered — ticking one could never be undone from the UI
    expect(opts.brands.every((b) => b.value.trim() !== '')).toBe(true);
  });

  it("each option's count is the number of styles its filter returns (both tabs)", async () => {
    const opts = await options();
    const cases: Array<[string, Option]> = [
      ...opts.buyers.map((o): [string, Option] => ['customerId', o]),
      ...opts.brands.map((o): [string, Option] => ['brandName', o]),
      ...opts.productCategories.slice(0, 5).map((o): [string, Option] => ['productCategoryId', o]),
    ];
    for (const [key, opt] of cases) {
      const c = await counts({ [key]: opt.value });
      expect({ key, value: opt.value, total: c.PENDING + c.IN_PROGRESS + c.APPROVED }).toEqual({
        key,
        value: opt.value,
        total: opt.count,
      });
    }
  });
});

describe('tab badges agree with the table', () => {
  const FILTER_SETS: Array<Record<string, string | undefined>> = [
    {},
    { orders: 'open' },
    { orders: 'none' },
    { cadProgress: 'NO_CAD' },
    { cadProgress: 'NO_COSTING' },
    { cadProgress: 'HAS_RAW_MATERIAL_CALCULATION' },
    { cadProgress: 'NO_PRODUCTION', orders: 'open' },
  ];

  it.each(FILTER_SETS)('Pending tab total = PENDING + IN_PROGRESS badge (%o)', async (filters) => {
    const c = await counts(filters);
    expect(await listTotal({ status: 'PENDING', ...filters })).toBe(c.PENDING + c.IN_PROGRESS);
  });

  it.each(FILTER_SETS)('Approved tab never exceeds its badge (%o)', async (filters) => {
    const c = await counts(filters);
    // The Approved list also requires a CAD row with layer length — a subset of cadStatus=APPROVED
    expect(await listTotal({ status: 'APPROVED', ...filters })).toBeLessThanOrEqual(c.APPROVED);
  });
});

describe('filters partition the tab', () => {
  it.each(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'])('HAS_%s + NO_%s = all', async (purpose) => {
    for (const status of ['PENDING', 'APPROVED']) {
      const all = await listTotal({ status });
      const has = await listTotal({ status, cadProgress: `HAS_${purpose}` });
      const missing = await listTotal({ status, cadProgress: `NO_${purpose}` });
      expect({ status, sum: has + missing }).toEqual({ status, sum: all });
    }
  });

  it('open order + no open order = all', async () => {
    const all = await listTotal({ status: 'PENDING' });
    const open = await listTotal({ status: 'PENDING', orders: 'open' });
    const none = await listTotal({ status: 'PENDING', orders: 'none' });
    expect(open + none).toBe(all);
  });

  it('repeated keys OR inside one filter', async () => {
    const opts = await options();
    const two = opts.brands.slice(0, 2).map((b) => b.value);
    if (two.length < 2) return;
    const each = await Promise.all(two.map((b) => listTotal({ status: 'PENDING', brandName: b })));
    expect(await listTotal({ status: 'PENDING', brandName: two })).toBe(each[0] + each[1]);
  });
});

describe('CAD progress matches the row Progress ticks', () => {
  const PURPOSES = ['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'] as const;

  it.each(PURPOSES)('HAS_%s rows tick it; NO_%s rows do not', async (purpose) => {
    for (const status of ['PENDING', 'APPROVED']) {
      const has = await listRows({ status, cadProgress: `HAS_${purpose}` });
      const missing = await listRows({ status, cadProgress: `NO_${purpose}` });
      for (const r of has)
        expect({ id: r.id, ticked: r.cadDetails.some((d) => d.purpose === purpose) }).toEqual({
          id: r.id,
          ticked: true,
        });
      for (const r of missing)
        expect({ id: r.id, ticked: r.cadDetails.some((d) => d.purpose === purpose) }).toEqual({
          id: r.id,
          ticked: false,
        });
    }
  });

  it('NO_CAD rows have no CAD rows at all', async () => {
    const rows = await listRows({ status: 'PENDING', cadProgress: 'NO_CAD' });
    for (const r of rows) expect({ id: r.id, n: r.cadDetails.length }).toEqual({ id: r.id, n: 0 });
  });
});

describe('search + filters', () => {
  it('filters still apply during an all-status search', async () => {
    const opts = await options();
    const brand = opts.brands[0].value;
    const searched = await listTotal({ search: 'a', searchAll: 'true' });
    const searchedAndFiltered = await listTotal({ search: 'a', searchAll: 'true', brandName: brand });
    expect(searchedAndFiltered).toBeLessThanOrEqual(searched);
    const c = await counts({ orders: 'open' });
    const searchedOpen = await listTotal({ search: 'a', searchAll: 'true', orders: 'open' });
    expect(searchedOpen).toBeLessThanOrEqual(c.PENDING + c.IN_PROGRESS + c.APPROVED);
  });

  it('refuses an unknown CAD progress value instead of ignoring it', async () => {
    await request(app).get('/api/cad-planning/styles?cadProgress=BOGUS').set(authHeader).expect(400);
    await request(app).get('/api/cad-planning/status-counts?orders=maybe').set(authHeader).expect(400);
  });
});
