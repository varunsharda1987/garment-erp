/**
 * Cost-sheet lace round-trip (2026-08-29).
 *
 * The lace request contract uses the frontend/DB field names (width, quantityPerGarment,
 * costPerMeter, totalCost) — the original LaceDetailSchema invented a parallel lace* naming
 * (laceWidth/laceAverage/laceRate/laceTotal) that no client ever sent, so EVERY lace-bearing
 * cost-sheet save 400'd once route validation was enforced (STYSW-001, 2026-08-29). This
 * suite locks the canonical names end-to-end:
 *   create with lace → totals include lace → GET returns laceItems → laceDetails: []
 *   explicitly deletes the rows → N/A rows pass validation and are excluded from totals.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `CSL8${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;
let laceMasterId: string;
const createdSheetIds: string[] = [];

function lacePayload(overrides: Record<string, unknown> = {}) {
  return {
    laceId: laceMasterId,
    laceName: `${RUN} Organza Lace`,
    colorName: 'Off White',
    width: 0.75,
    quantityPerGarment: 4,
    wastagePercent: 5,
    effectiveQuantity: 4.2,
    sourcingStrategy: 'READY_LACE',
    readyLaceCost: 10,
    costPerMeter: 10,
    totalCost: 42,
    isNotApplicable: false,
    ...overrides,
  };
}

// Each sheet gets a unique fabric width — same style+purpose+width-combination is refused
// as a duplicate, and these tests intentionally create several sheets on one style
let widthCounter = 60;
function sheetPayload(overrides: Record<string, unknown> = {}) {
  widthCounter += 1;
  return {
    styleId,
    purpose: 'COSTING',
    fabricDetails: [
      { fabricName: 'Poplin', fabricWidth: widthCounter, fabricAverage: 2.3, fabricRate: 100, fabricTotal: 230 },
    ],
    trimsDetails: [{ trimName: 'Main Label', trimQuantity: 1, trimRate: 2, trimTotal: 2 }],
    cmtCosts: {},
    embroideryDetails: [],
    accessoriesDetails: [],
    ...overrides,
  };
}

async function createSheet(overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/style-costing').set(authHeader).send(sheetPayload(overrides));
  if (res.body?.data?.id) createdSheetIds.push(res.body.data.id);
  return res;
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

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: testUserId },
  });
  styleId = style.id;

  const lace = await prisma.lace_master.create({
    data: { laceCode: `${RUN}-LACE`, laceName: `${RUN} Organza Lace` },
  });
  laceMasterId = lace.id;
});

afterAll(async () => {
  if (createdSheetIds.length > 0) {
    await prisma.style_costing.deleteMany({ where: { id: { in: createdSheetIds } } }); // cascades lace items
  }
  await prisma.lace_master.deleteMany({ where: { id: laceMasterId } });
  await prisma.styles.deleteMany({ where: { id: styleId } });
  await prisma.users.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
});

describe('cost-sheet lace round-trip (canonical field names)', () => {
  it('creates a sheet with a lace row using the frontend field names and folds it into totals', async () => {
    const res = await createSheet({ laceDetails: [lacePayload()] });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.laceTotal)).toBe(42);
    // 230 fabric + 2 trim + 42 lace
    expect(Number(res.body.data.subtotal)).toBeCloseTo(274, 2);

    const rows = await prisma.style_costing_lace_items.findMany({ where: { costingId: res.body.data.id } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].quantityPerGarment)).toBe(4);
    expect(Number(rows[0].costPerMeter)).toBe(10);
    expect(Number(rows[0].totalCost)).toBe(42);
    expect(rows[0].colorName).toBe('Off White'); // previously hardcoded to null
    expect(Number(rows[0].readyLaceCost)).toBe(10);
    expect(rows[0].isNotApplicable).toBe(false);
  });

  it('returns saved lace rows as laceItems on GET (edit round-trip)', async () => {
    const created = await createSheet({ laceDetails: [lacePayload()] });
    const res = await request(app).get(`/api/style-costing/${created.body.data.id}`).set(authHeader).expect(200);
    expect(res.body.data.laceItems).toHaveLength(1);
    expect(Number(res.body.data.laceItems[0].costPerMeter)).toBe(10);
  });

  it('laceDetails: [] on update explicitly deletes the stored rows and zeroes laceTotal', async () => {
    const created = await createSheet({ laceDetails: [lacePayload()] });
    const id = created.body.data.id;

    const res = await request(app)
      .put(`/api/style-costing/${id}`)
      .set(authHeader)
      .send({ laceDetails: [] })
      .expect(200);
    expect(Number(res.body.data.laceTotal)).toBe(0);
    expect(Number(res.body.data.subtotal)).toBeCloseTo(232, 2); // lace removed from money totals

    const rows = await prisma.style_costing_lace_items.findMany({ where: { costingId: id } });
    expect(rows).toHaveLength(0);
  });

  it('an omitted laceDetails on update preserves the stored rows and their total', async () => {
    const created = await createSheet({ laceDetails: [lacePayload()] });
    const id = created.body.data.id;

    const res = await request(app)
      .put(`/api/style-costing/${id}`)
      .set(authHeader)
      .send({ markupPercent: 20 })
      .expect(200);
    expect(Number(res.body.data.laceTotal)).toBe(42);

    const rows = await prisma.style_costing_lace_items.findMany({ where: { costingId: id } });
    expect(rows).toHaveLength(1);
  });

  it('an N/A lace row with zero values passes validation and is excluded from totals', async () => {
    const res = await createSheet({
      laceDetails: [
        lacePayload({
          quantityPerGarment: 0,
          effectiveQuantity: 0,
          costPerMeter: 0,
          totalCost: 0,
          readyLaceCost: 0,
          isNotApplicable: true,
        }),
      ],
    });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.laceTotal)).toBe(0);

    const rows = await prisma.style_costing_lace_items.findMany({ where: { costingId: res.body.data.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].isNotApplicable).toBe(true); // survives the round-trip
  });

  it('a live (non-N/A) lace row with zero rate is rejected', async () => {
    const res = await createSheet({
      laceDetails: [lacePayload({ costPerMeter: 0, totalCost: 0 })],
    });
    expect(res.status).toBe(400);
  });
});
