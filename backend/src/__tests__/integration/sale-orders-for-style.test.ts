/**
 * GET /sale-orders/for-style — the style's open sale orders with its pieces on each (2026-09-29).
 *
 * Fabric Costing → Raw Mat Calculation left Order Quantity empty for SP27CK130 although SO2609-1593
 * ordered 2,600 pcs of it: the page only ever read a SAVED costing's quantity. Its "Sale orders"
 * picker now fills the box from this endpoint. Pinned here:
 *   - every customer's open sale orders carrying the style, one row each, this style's lines added up
 *   - a DRAFT is listed (the page leaves it unticked); cancelled / delivered orders are not
 *   - a style on no sale order gives [], a malformed style id is refused
 *
 * Posts what the pages post; real app + the test database; every fixture scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SOFS${Date.now().toString(36).toUpperCase()}`;

let admin: Record<string, string>;
let adminId: string;
let customerA: string;
let customerB: string;
const styles: Record<string, { id: string; sizeM: string; sizeL: string }> = {};
const costingIds: string[] = [];

/** A style (ACTIVE, approved Raw Mat costing) with sizes M, L */
async function makeStyle(key: string) {
  const style = await prisma.styles.create({
    data: {
      id: randomUUID(),
      styleCode: `${RUN}${key}`,
      styleName: `${RUN} ${key}`,
      createdById: adminId,
      status: 'ACTIVE',
    },
  });
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
  styles[key] = { id: style.id, sizeM: m.id, sizeL: l.id };
}

/** A sale order as the Sale Order form posts it; confirmed unless `draft` */
async function saleOrder(
  customerId: string,
  key: string,
  lines: Array<{ size: 'M' | 'L'; quantity: number }>,
  opts: { draft?: boolean; ship?: string } = {}
) {
  const st = styles[key];
  const created = await request(app)
    .post('/api/sale-orders')
    .set(admin)
    .send({
      customerId,
      expectedShipDate: opts.ship ?? '2026-12-10',
      items: lines.map((l) => ({
        styleId: st.id,
        sizeId: l.size === 'M' ? st.sizeM : st.sizeL,
        quantity: l.quantity,
        unitPrice: 200,
      })),
    })
    .expect(201);
  const id = created.body.data.id as string;
  if (!opts.draft) await request(app).post(`/api/sale-orders/${id}/confirm`).set(admin).send({}).expect(200);
  return id;
}

const forStyle = (styleId: string) => request(app).get(`/api/sale-orders/for-style?styleId=${styleId}`).set(admin);

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
  await makeStyle('X'); // on several sale orders
  await makeStyle('W'); // on none
});

afterAll(async () => {
  const customerIds = [customerA, customerB];
  const styleIds = Object.values(styles).map((s) => s.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: { in: customerIds } } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: { in: customerIds } } })],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: { id: { in: costingIds } } })],
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
      console.error(`[sale-orders-for-style teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('GET /sale-orders/for-style', () => {
  it("lists every customer's open sale orders carrying the style, the style's lines added up", async () => {
    const soA = await saleOrder(
      customerA,
      'X',
      [
        { size: 'M', quantity: 10 },
        { size: 'L', quantity: 6 },
      ],
      { ship: '2026-11-15' }
    );
    const soB = await saleOrder(customerB, 'X', [{ size: 'M', quantity: 4 }], { ship: '2026-12-01' });
    const draft = await saleOrder(customerA, 'X', [{ size: 'L', quantity: 3 }], { draft: true, ship: '2026-12-20' });
    const cancelled = await saleOrder(customerA, 'X', [{ size: 'M', quantity: 5 }]);
    const delivered = await saleOrder(customerA, 'X', [{ size: 'M', quantity: 7 }]);
    await prisma.sale_orders.update({ where: { id: cancelled }, data: { status: 'CANCELLED' } });
    await prisma.sale_orders.update({ where: { id: delivered }, data: { status: 'DELIVERED' } });

    const res = await forStyle(styles.X.id).expect(200);
    const rows = res.body.data as Array<{ id: string; status: string; quantity: number; customerName: string }>;

    // Earliest ship date first; cancelled and delivered orders are gone
    expect(rows.map((r) => r.id)).toEqual([soA, soB, draft]);
    expect(rows.map((r) => r.quantity)).toEqual([16, 4, 3]);
    expect(rows[1].customerName).toBe(`${RUN} Buyer B`);
    expect(rows[0].status).toBe('CONFIRMED');
    expect(rows[2].status).toBe('DRAFT');
  });

  it('gives [] for a style on no sale order, and refuses a malformed style id', async () => {
    const none = await forStyle(styles.W.id).expect(200);
    expect(none.body.data).toEqual([]);
    await forStyle('not-a-uuid').expect(400);
  });
});
