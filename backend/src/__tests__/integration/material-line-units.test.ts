/**
 * A material line's unit is its material's unit (2026-09-26).
 *
 * "Microdot Fusing" is METER on its master, but every trim picked on the Style form was saved
 * `'pcs'` — and the cost sheet, order BOM and requirement copied it forward (111 lace / elastic /
 * interlining / drawstring lines; MR2608-0111 asked for 2,300 PIECES of fusing). Every style save
 * deletes and recreates its BOM rows, so a data fix alone came undone on the next save.
 *
 * Walks the writers with the payloads their pages send: Style create → re-save → "add material"
 * → cost-sheet save (posting unit 'pcs') → Order BOM item edit (posting 'pcs'). Each must store the
 * material's unit. THREAD keeps its 'lot' — thread costing is not designed yet (owner, 2026-09-26),
 * and a BUTTON stays PIECE: consumption is per piece even though buttons are bought by the gross.
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `MLU${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let interliningId: string;
let laceId: string;
let buttonId: string;
let orderId: string;
let orderBomId: string;
const styleIds: string[] = [];
const sheetIds: string[] = [];

const unitsOf = async (styleId: string) =>
  Object.fromEntries(
    (await prisma.style_material_bom.findMany({ where: { styleId }, select: { materialType: true, unit: true } })).map(
      (r) => [r.materialType, r.unit]
    )
  );

const trims = () => [
  { trimType: 'INTERLINING', masterId: interliningId, masterName: `${RUN} Microdot Fusing` },
  { trimType: 'LACE', masterId: laceId, masterName: `${RUN} Organza Lace` },
  { trimType: 'BUTTON', masterId: buttonId, masterName: `${RUN} Shirt Button` },
];

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
    data: { code: `${RUN}C`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  // Masters with their same-id materials twins — the twin is where the unit lives
  interliningId = (
    await prisma.interlining_master.create({
      data: { interliningCode: `${RUN}-IL`, interliningName: `${RUN} Microdot Fusing` },
    })
  ).id;
  await ensureMaterialRecord(interliningId, 'INTERLINING');
  laceId = (await prisma.lace_master.create({ data: { laceCode: `LACE-${RUN}`, laceName: `${RUN} Organza Lace` } })).id;
  await ensureMaterialRecord(laceId, 'LACE');
  buttonId = (
    await prisma.button_master.create({ data: { buttonCode: `BTN-${RUN}`, buttonName: `${RUN} Shirt Button` } })
  ).id;
  await ensureMaterialRecord(buttonId, 'BUTTON');
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['order_bom_items', () => prisma.order_bom_items.deleteMany({ where: { orderBomId: only(orderBomId) } })],
    ['order_bom', () => prisma.order_bom.deleteMany({ where: { id: only(orderBomId) } })],
    ['order_items', () => prisma.order_items.deleteMany({ where: { orderId: only(orderId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: only(orderId) } })],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: { id: { in: sheetIds } } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['style_material_bom', () => prisma.style_material_bom.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: styleIds } } })],
    [
      'materials',
      () =>
        prisma.materials.deleteMany({
          where: { id: { in: [interliningId, laceId, buttonId].filter((v): v is string => !!v) } },
        }),
    ],
    ['interlining_master', () => prisma.interlining_master.deleteMany({ where: { id: only(interliningId) } })],
    ['lace_master', () => prisma.lace_master.deleteMany({ where: { id: only(laceId) } })],
    ['button_master', () => prisma.button_master.deleteMany({ where: { id: only(buttonId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[material-line-units teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a material line takes its material unit', () => {
  it('Style create: metre trims are METER, a button is PIECE, thread keeps lot', async () => {
    const res = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({
        styleCode: `${RUN}S`,
        styleName: `${RUN} Kurta`,
        customerId,
        customerName: `${RUN} Buyer`,
        brandName: 'Kasya',
        trims: trims(),
      })
      .expect(201);
    styleIds.push(res.body.data.id);

    expect(await unitsOf(res.body.data.id)).toEqual({
      INTERLINING: 'METER',
      LACE: 'METER',
      BUTTON: 'PIECE',
      THREAD: 'lot', // auto-added Default Thread — untouched until thread costing is designed
    });
  });

  it('a re-save (which recreates every BOM row) keeps them — it no longer re-stamps pcs', async () => {
    await request(app).put(`/api/styles/${styleIds[0]}`).set(authHeader).send({ trims: trims() }).expect(200);
    expect(await unitsOf(styleIds[0])).toMatchObject({ INTERLINING: 'METER', LACE: 'METER', BUTTON: 'PIECE' });
  });

  it('"add material" needs no unit and takes the material one', async () => {
    const res = await request(app)
      .post(`/api/styles/${styleIds[0]}/materials`)
      .set(authHeader)
      .send({ materialCode: `LACE-${RUN}`, usageCategory: 'GARMENT_TRIM', quantityPerGarment: 0.75 })
      .expect(201);
    expect(res.body.bomEntry.unit).toBe('METER');

    // an edit re-derives it; the body cannot turn it back into pcs
    await request(app)
      .put(`/api/styles/${styleIds[0]}/materials/${res.body.bomEntry.id}`)
      .set(authHeader)
      .send({ quantityPerGarment: 0.8, unit: 'pcs' })
      .expect(200);
    const row = await prisma.style_material_bom.findUnique({ where: { id: res.body.bomEntry.id } });
    expect(row?.unit).toBe('METER');
  });

  it('cost sheet: a trim posted as pcs is stored in its material unit', async () => {
    const res = await request(app)
      .post('/api/style-costing')
      .set(authHeader)
      .send({
        styleId: styleIds[0],
        purpose: 'COSTING',
        fabricDetails: [
          { fabricName: 'Poplin', fabricWidth: 58, fabricAverage: 2.3, fabricRate: 100, fabricTotal: 230 },
        ],
        trimsDetails: [
          {
            trimName: `${RUN} Microdot Fusing`,
            materialType: 'INTERLINING',
            interliningId,
            unit: 'pcs', // what CostSheetForm copied from the BOM before the fix
            trimQuantity: 0.5,
            trimRate: 8,
            trimTotal: 4,
          },
          { trimName: 'Thread', materialType: 'THREAD', unit: 'lot', trimQuantity: 1, trimRate: 4, trimTotal: 4 },
        ],
        cmtCosts: {},
        embroideryDetails: [],
        accessoriesDetails: [],
      });
    expect(res.status).toBe(201);
    sheetIds.push(res.body.data.id);

    const rows = await prisma.style_costing_trim_items.findMany({ where: { costingId: res.body.data.id } });
    expect(rows.find((r) => r.materialType === 'INTERLINING')?.unit).toBe('METER');
    expect(rows.find((r) => r.materialType === 'THREAD')?.unit).toBe('lot');
    // label only — the money is untouched
    expect(Number(rows.find((r) => r.materialType === 'INTERLINING')?.trimTotal)).toBe(4);
  });

  it('Order BOM item edit: a pcs from the page is stored as the material unit', async () => {
    const order = await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 100,
        totalAmount: 1000,
        createdById: userId,
      },
    });
    orderId = order.id;
    await prisma.order_items.create({
      data: { id: randomUUID(), orderId, styleId: styleIds[0], totalQuantity: 100, unitPrice: 10, totalPrice: 1000 },
    });
    orderBomId = (
      await prisma.order_bom.create({
        data: { orderId, styleId: styleIds[0], createdById: userId, status: 'DRAFT', isActive: true },
      })
    ).id;

    const res = await request(app)
      .put(`/api/orders/${orderId}/bom`)
      .set(authHeader)
      .send({
        items: [
          {
            materialType: 'INTERLINING',
            interliningId,
            componentName: `${RUN} Microdot Fusing`,
            quantityPerGarment: 0.5,
            orderQuantity: 100,
            wastagePercent: 0,
            unit: 'pcs',
            unitPrice: 8,
            sortOrder: 0,
          },
          {
            materialType: 'THREAD',
            componentName: 'Thread',
            quantityPerGarment: 1,
            orderQuantity: 100,
            wastagePercent: 0,
            unit: 'lot',
            unitPrice: 4,
            sortOrder: 1,
          },
        ],
      });
    expect(res.status).toBe(200);

    const rows = await prisma.order_bom_items.findMany({ where: { orderBomId } });
    expect(rows.find((r) => r.materialType === 'INTERLINING')?.unit).toBe('METER');
    expect(rows.find((r) => r.materialType === 'THREAD')?.unit).toBe('lot');
  });
});

describe('a used material keeps its unit', () => {
  it('the Materials edit page gets where it is used, and a unit change is refused', async () => {
    const get = await request(app).get(`/api/materials/${interliningId}`).set(authHeader).expect(200);
    expect(get.body.data.unitInUse.length).toBeGreaterThan(0); // style BOM, cost sheet, order BOM lines above

    const res = await request(app)
      .put(`/api/materials/${interliningId}`)
      .set(authHeader)
      .send({ code: `${RUN}-IL`, name: `${RUN} Microdot Fusing`, unit: 'PIECE' });
    expect(res.status).toBe(409);
    expect(res.body.message ?? res.body.error?.message ?? JSON.stringify(res.body)).toMatch(/cannot change/);
    expect((await prisma.materials.findUnique({ where: { id: interliningId } }))?.unit).toBe('METER');
  });

  it('a manual requirement in a unit the material is not counted in is refused', async () => {
    const res = await request(app)
      .post('/api/mrp/requirements')
      .set(authHeader)
      .send({ materialId: interliningId, quantity: 2300, unit: 'PIECE', requiredDate: '2026-12-31' });
    expect(res.status).toBe(422);
    expect(await prisma.material_requirements.count({ where: { materialId: interliningId } })).toBe(0);
  });

  it('the Style page names a trim of any type from its materials record', async () => {
    const res = await request(app).get(`/api/styles/${styleIds[0]}`).set(authHeader).expect(200);
    const bom = (res.body.data.styleMaterialBom ?? []) as Array<{ materialType: string; materials?: { name: string } }>;
    expect(bom.find((b) => b.materialType === 'INTERLINING')?.materials?.name).toBe(`${RUN} Microdot Fusing`);
  });
});
