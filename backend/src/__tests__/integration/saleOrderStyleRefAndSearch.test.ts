/**
 * The buyer's style code on a sale-order line, and finding orders by it.
 *
 * `styles.buyerStyleRef` is one editable field with no history, so re-coding a style used to
 * rewrite the past — every reprint of an old document showed the NEW code. Each line now captures
 * the code as at the day it was taken. What this pins:
 *   - a new line captures the style's current code
 *   - an explicit value is honoured (so re-saving an order does NOT re-stamp it with today's code)
 *   - re-coding the style afterwards leaves existing orders alone, and new orders get the new code
 *   - search finds an order by style code, by the captured code, and by the buyer's CURRENT code
 *   - the Season filter finds an order by its styles' season (master link, or older free text)
 *
 * Runs against the real app + live dev DB; every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SRF${Date.now().toString(36).toUpperCase()}`;
const ORIGINAL_REF = `${RUN}-BUYER-OLD`;
const RECODED_REF = `${RUN}-BUYER-NEW`;

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let styleId: string;
let plainStyleId: string;
let sizeId: string;
let seasonId: string | undefined;

const createdSoIds: string[] = [];

async function createOrder(body: Record<string, unknown>) {
  const res = await request(app)
    .post('/api/sale-orders')
    .set(authHeader)
    .send({ customerId, ...body })
    .expect(201);
  createdSoIds.push(res.body.data.id);
  return res.body.data;
}

const lineOf = async (soId: string) => prisma.sale_order_items.findFirstOrThrow({ where: { saleOrderId: soId } });

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
    data: {
      id: randomUUID(),
      styleCode: `${RUN}A`,
      styleName: `${RUN} Coded Style`,
      buyerStyleRef: ORIGINAL_REF,
      createdById: testUserId,
    },
  });
  styleId = style.id;

  const plain = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}B`, styleName: `${RUN} Uncoded Style`, createdById: testUserId },
  });
  plainStyleId = plain.id;

  const size = await prisma.size_options.create({
    data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: `${RUN}-M` },
  });
  sizeId = size.id;
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: only(customerId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { id: only(sizeId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: [styleId, plainStyleId] } } })],
    ['season_master', () => prisma.season_master.deleteMany({ where: { id: only(seasonId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[saleOrderStyleRefAndSearch teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe("capturing the buyer's style code on the line", () => {
  it("captures the style's current code when the line does not send one", async () => {
    const so = await createOrder({ items: [{ styleId, sizeId, quantity: 2, unitPrice: 100 }] });

    expect(so.items[0].buyerStyleRef).toBe(ORIGINAL_REF);
    expect((await lineOf(so.id)).buyerStyleRef).toBe(ORIGINAL_REF);
  });

  it('honours a code sent explicitly on the line, overriding the style master', async () => {
    const so = await createOrder({
      items: [{ styleId, sizeId, quantity: 2, unitPrice: 100, buyerStyleRef: `${RUN}-PER-LINE` }],
    });

    expect((await lineOf(so.id)).buyerStyleRef).toBe(`${RUN}-PER-LINE`);
  });

  it('leaves it null for a style that has no buyer code', async () => {
    const so = await createOrder({ items: [{ styleId: plainStyleId, quantity: 1, unitPrice: 50 }] });

    expect((await lineOf(so.id)).buyerStyleRef).toBeNull();
  });

  it('re-coding the style does NOT change an order already taken, but a new order gets the new code', async () => {
    const before = await createOrder({ items: [{ styleId, sizeId, quantity: 3, unitPrice: 100 }] });
    expect((await lineOf(before.id)).buyerStyleRef).toBe(ORIGINAL_REF);

    // The buyer re-codes the style.
    await prisma.styles.update({ where: { id: only(styleId) }, data: { buyerStyleRef: RECODED_REF } });

    // The existing order still reads the code it was taken under...
    const readBack = await request(app).get(`/api/sale-orders/${before.id}`).set(authHeader).expect(200);
    expect(readBack.body.items[0].buyerStyleRef).toBe(ORIGINAL_REF);

    // ...and a NEW order picks up the new one.
    const after = await createOrder({ items: [{ styleId, sizeId, quantity: 4, unitPrice: 100 }] });
    expect((await lineOf(after.id)).buyerStyleRef).toBe(RECODED_REF);

    // Restore for the search tests below.
    await prisma.styles.update({ where: { id: only(styleId) }, data: { buyerStyleRef: RECODED_REF } });
  });

  it('re-saving an order round-trips the captured code instead of re-stamping it', async () => {
    // The style now reads RECODED_REF. An edit that sends the line's own code back must keep it —
    // this is what stops a routine edit quietly rewriting the order's history.
    const so = createdSoIds[0];
    const original = await lineOf(so);
    expect(original.buyerStyleRef).toBe(ORIGINAL_REF);

    await request(app)
      .put(`/api/sale-orders/${so}`)
      .set(authHeader)
      .send({
        items: [
          {
            styleId,
            sizeId,
            quantity: 9,
            unitPrice: 100,
            buyerStyleRef: original.buyerStyleRef,
          },
        ],
      })
      .expect(200);

    const after = await lineOf(so);
    expect(after.quantity).toBe(9);
    expect(after.buyerStyleRef).toBe(ORIGINAL_REF);
  });
});

describe('finding a sale order', () => {
  const searchFor = async (term: string) => {
    const res = await request(app)
      .get(`/api/sale-orders?search=${encodeURIComponent(term)}&limit=100`)
      .set(authHeader)
      .expect(200);
    return res.body.data.map((so: { id: string }) => so.id);
  };

  it('finds orders by our own style code — the Style(s) column was not searchable at all before', async () => {
    const ids = await searchFor(`${RUN}A`);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(createdSoIds).toContain(id);
  });

  it('finds an order by the code CAPTURED on its line, after the style was re-coded', async () => {
    const ids = await searchFor(ORIGINAL_REF);
    expect(ids).toContain(createdSoIds[0]);
  });

  it("finds orders by the style's CURRENT buyer code too", async () => {
    const ids = await searchFor(RECODED_REF);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('finds orders by style name and by customer code', async () => {
    expect((await searchFor('Coded Style')).length).toBeGreaterThan(0);
    expect((await searchFor(`${RUN}-CUST`)).length).toBeGreaterThan(0);
  });

  it('still finds orders by sale-order number and buyer PO', async () => {
    const so = await createOrder({
      buyerPoNumber: `${RUN}-PO-77`,
      items: [{ styleId, sizeId, quantity: 1, unitPrice: 100 }],
    });

    expect(await searchFor(so.saleOrderNumber)).toContain(so.id);
    expect(await searchFor(`${RUN}-PO-77`)).toContain(so.id);
  });

  it('returns nothing for a term that matches no order', async () => {
    expect(await searchFor(`${RUN}-NOTHING-MATCHES-THIS`)).toHaveLength(0);
  });
});

describe('the Season filter', () => {
  // A sale order has no season of its own — it is its styles'. Style A carries the season through
  // the Season master link; style B only as free text, the way styles saved before the master do.
  let linkedSoId: string;
  let textSoId: string;
  const SEASON_CODE = `${RUN}S`;
  const SEASON_NAME = `${RUN} Winter`;

  const listIds = async (query: string) => {
    const res = await request(app).get(`/api/sale-orders?${query}&limit=100`).set(authHeader).expect(200);
    return res.body.data.map((so: { id: string }) => so.id);
  };

  beforeAll(async () => {
    // Inactive, so the live Season dropdown never offers this fixture while the suite runs
    const season = await prisma.season_master.create({
      data: { code: SEASON_CODE, name: SEASON_NAME, year: 2099, seasonType: 'AW', isActive: false },
    });
    seasonId = season.id;
    await prisma.styles.update({ where: { id: styleId }, data: { seasonId: season.id, season: season.name } });
    await prisma.styles.update({ where: { id: plainStyleId }, data: { season: SEASON_NAME.toLowerCase() } });

    linkedSoId = (await createOrder({ items: [{ styleId, sizeId, quantity: 2, unitPrice: 100 }] })).id;
    textSoId = (await createOrder({ items: [{ styleId: plainStyleId, quantity: 3, unitPrice: 50 }] })).id;
  });

  it("finds orders by the style's Season master link AND by the free-text season older styles carry", async () => {
    const ids = await listIds(`seasonId=${seasonId}`);
    expect(ids).toEqual(expect.arrayContaining([linkedSoId, textSoId]));
    for (const id of ids) expect(createdSoIds).toContain(id);
  });

  it('combines with the other filters (customer)', async () => {
    const ids = await listIds(`seasonId=${seasonId}&customerId=${customerId}`);
    expect(ids).toEqual(expect.arrayContaining([linkedSoId, textSoId]));
  });

  it('the search box finds an order by the season code shown in the Season column', async () => {
    const res = await request(app)
      .get(`/api/sale-orders?search=${encodeURIComponent(SEASON_CODE)}&limit=100`)
      .set(authHeader)
      .expect(200);
    expect(res.body.data.map((so: { id: string }) => so.id)).toContain(linkedSoId);
  });

  it('a season no order carries returns nothing (never "all orders")', async () => {
    expect(await listIds('seasonId=cnoseasonhasthisid00000000')).toHaveLength(0);
  });

  it('the list rows carry the style season the Season column renders', async () => {
    const res = await request(app).get(`/api/sale-orders?seasonId=${seasonId}&limit=100`).set(authHeader).expect(200);
    const row = res.body.data.find((so: { id: string }) => so.id === linkedSoId);
    expect(row.items[0].style.seasonMaster).toEqual({ code: SEASON_CODE, name: SEASON_NAME });
  });
});
