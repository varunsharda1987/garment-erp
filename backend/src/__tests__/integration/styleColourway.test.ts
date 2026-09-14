/**
 * A style's Primary Color has to become a colourway, because the colourway row is what the rest of
 * the system reads.
 *
 * Until 2026-09-14 `color_options` had no writer at all: the Style form's Primary Color went to
 * `styles.colorId` (a FK to the colour catalogue) and stopped there, so the table was empty for all
 * 1,130 styles. That is not cosmetic — ten tables carry a NOT-NULL FK to `color_options`, so with it
 * empty no finished-goods stock could exist, which in turn meant the sale order's Allocate button
 * could never find anything to reserve.
 *
 * These tests pin both halves: the mirroring itself, and the thing it unblocks.
 *
 * Runs against the real app + live dev DB, so every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SCW${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let indigoId: string;
let scarletId: string;

const createdStyleIds: string[] = [];
const createdLocationIds: string[] = [];
const createdStockIds: string[] = [];
const createdSoIds: string[] = [];

/** Create a style through the API, exactly as the Style form does. */
async function createStyle(suffix: string, colorId?: string | null) {
  const res = await request(app)
    .post('/api/styles')
    .set(authHeader)
    .send({
      styleCode: `${RUN}${suffix}`,
      styleName: `${RUN} ${suffix}`,
      customerName: `${RUN} Buyer`,
      brandName: 'Kasya',
      ...(colorId !== undefined ? { colorId } : {}),
    })
    .expect(201);
  const id = res.body.data.id as string;
  createdStyleIds.push(id);
  return id;
}

const colourwaysOf = (styleId: string) =>
  prisma.color_options.findMany({
    where: { styleId },
    select: { id: true, colorName: true, colorCode: true, colorMasterId: true, isActive: true },
  });

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

  const [indigo, scarlet] = await Promise.all([
    prisma.color_master.create({ data: { colorCode: `${RUN}-IND`, colorName: `${RUN} Indigo` } }),
    prisma.color_master.create({ data: { colorCode: `${RUN}-SCA`, colorName: `${RUN} Scarlet` } }),
  ]);
  indigoId = indigo.id;
  scarletId = scarlet.id;
});

afterAll(async () => {
  // Children first, each step independent: one failure must not strand the rest in the live DB.
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['sale_order_items', () => prisma.sale_order_items.deleteMany({ where: { saleOrderId: { in: createdSoIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { id: { in: createdSoIds } } })],
    ['finished_goods_stock', () => prisma.finished_goods_stock.deleteMany({ where: { id: { in: createdStockIds } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { styleId: { in: createdStyleIds } } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: { in: createdStyleIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: createdStyleIds } } })],
    ['locations', () => prisma.locations.deleteMany({ where: { id: { in: createdLocationIds } } })],
    ['color_master', () => prisma.color_master.deleteMany({ where: { id: { in: [indigoId, scarletId] } } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[styleColourway teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe("a style's Primary Color becomes its colourway", () => {
  it('creating a style with a colour produces exactly one colourway, linked to the catalogue', async () => {
    const styleId = await createStyle('A', indigoId);

    const colours = await colourwaysOf(styleId);
    expect(colours).toHaveLength(1);
    expect(colours[0].colorName).toBe(`${RUN} Indigo`);
    expect(colours[0].colorCode).toBe(`${RUN}-IND`);
    // The FK that was never written by any code path before — without it the colourway is
    // disconnected from the colour catalogue the rest of the app picks from.
    expect(colours[0].colorMasterId).toBe(indigoId);
  });

  it('creating a style without a colour produces none — blank stays blank', async () => {
    const styleId = await createStyle('B');
    expect(await colourwaysOf(styleId)).toEqual([]);
  });

  it('setting the colour later, on update, creates it', async () => {
    const styleId = await createStyle('C');
    expect(await colourwaysOf(styleId)).toEqual([]);

    await request(app).put(`/api/styles/${styleId}`).set(authHeader).send({ colorId: indigoId }).expect(200);

    const colours = await colourwaysOf(styleId);
    expect(colours).toHaveLength(1);
    expect(colours[0].colorMasterId).toBe(indigoId);
  });

  it('saving the same style again does not duplicate the colourway', async () => {
    const styleId = await createStyle('D', indigoId);
    await request(app).put(`/api/styles/${styleId}`).set(authHeader).send({ colorId: indigoId }).expect(200);
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ styleName: `${RUN} D renamed` })
      .expect(200);

    expect(await colourwaysOf(styleId)).toHaveLength(1);
  });

  it('changing the colour adds the new one and KEEPS the old', async () => {
    // Stock, delivery notes and placed order lines point at the old colourway with NOT-NULL FKs —
    // removing it would orphan them.
    const styleId = await createStyle('E', indigoId);
    await request(app).put(`/api/styles/${styleId}`).set(authHeader).send({ colorId: scarletId }).expect(200);

    const colours = await colourwaysOf(styleId);
    expect(colours).toHaveLength(2);
    expect(colours.map((c) => c.colorMasterId).sort()).toEqual([indigoId, scarletId].sort());
  });

  it('clearing the Primary Color leaves the colourway alone', async () => {
    const styleId = await createStyle('F', indigoId);
    await request(app).put(`/api/styles/${styleId}`).set(authHeader).send({ colorId: null }).expect(200);

    const colours = await colourwaysOf(styleId);
    expect(colours).toHaveLength(1);
    const style = await prisma.styles.findUniqueOrThrow({ where: { id: styleId }, select: { colorId: true } });
    expect(style.colorId).toBeNull();
  });

  it('GET /styles/:id returns it as colorOptions — what the Sale Order dialog reads', async () => {
    const styleId = await createStyle('G', indigoId);

    const res = await request(app).get(`/api/styles/${styleId}`).set(authHeader).expect(200);

    expect(res.body.data.colorOptions).toHaveLength(1);
    expect(res.body.data.colorOptions[0].colorName).toBe(`${RUN} Indigo`);
    // The dialog preselects the colourway whose colorMasterId equals the style's own colorId
    expect(res.body.data.colorOptions[0].colorMasterId).toBe(res.body.data.colorId);
  });
});

describe('what the colourway unblocks', () => {
  let styleId: string;
  let colourId: string;
  let sizeId: string;

  beforeAll(async () => {
    styleId = await createStyle('H', indigoId);
    colourId = (await colourwaysOf(styleId))[0].id;
    const size = await prisma.size_options.create({
      data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: `${RUN}-M` },
    });
    sizeId = size.id;
  });

  it('finished-goods stock can finally exist for the style', async () => {
    // finished_goods_stock.colorId is NOT NULL, so with no colourway this row was impossible —
    // which is why the table held 0 rows and sale-order Allocate could never find anything.
    const location = await prisma.locations.create({
      data: {
        id: randomUUID(),
        locationCode: `${RUN}-LOC`,
        locationName: `${RUN} Warehouse`,
        locationType: 'WAREHOUSE',
      },
    });
    createdLocationIds.push(location.id);

    const stock = await prisma.finished_goods_stock.create({
      data: { id: randomUUID(), styleId, colorId: colourId, sizeId, quantity: 10, locationId: location.id },
    });
    createdStockIds.push(stock.id);

    expect(stock.colorId).toBe(colourId);
  });

  it('a sale-order line accepts that colour and reads it back', async () => {
    const created = await request(app)
      .post('/api/sale-orders')
      .set(authHeader)
      .send({ customerId, items: [{ styleId, colorId: colourId, sizeId, quantity: 5, unitPrice: 100 }] })
      .expect(201);
    const soId = created.body.data.id as string;
    createdSoIds.push(soId);

    // GET /sale-orders/:id returns the order unwrapped (res.json(so)), unlike the 201 create
    const read = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(read.body.items[0].colorId).toBe(colourId);
    expect(read.body.items[0].color.colorName).toBe(`${RUN} Indigo`);
  });
});
