/**
 * What the Production Runs pages (list, detail, create, edit, Split Run) rely on — found 2026-09-25:
 *   - the response keys the pages read: `breakup`, `warehouse`, `createdBy` (the pages read the Prisma
 *     names, so the size grid, Split Run rows, location and creator never showed)
 *   - refusals arrive as 4xx with their message, not "An unexpected error occurred"
 *   - a run is never planned to end before it starts (create, edit, split)
 *   - the edit form can clear the location and remarks
 *   - a split keeps the make-to-stock source, and only a PENDING run can be split
 *
 * Runs against the LIVE database on tagged fixtures, torn down in afterAll.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `WOP${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let adminId: string;
let adminHeader: Record<string, string>;
let warehouseId: string;
let styleId: string;
let sizeM: string;
let sizeL: string;
let spoId: string;
let spoItemId: string;
let workOrderId: string;
const createdRunIds: string[] = [];

const expectStatus = (res: request.Response, status: number) => {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
};

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}-admin@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');

  const warehouse = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Floor`,
      warehouseType: 'RAW_MATERIAL',
      isActive: true,
      createdById: adminId,
    },
  });
  warehouseId = warehouse.id;

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: adminId },
  });
  sizeM = randomUUID();
  sizeL = randomUUID();
  await prisma.size_options.createMany({
    data: [
      { id: sizeM, styleId, sizeName: 'M', sizeCode: 'M' },
      { id: sizeL, styleId, sizeName: 'L', sizeCode: 'L' },
    ],
  });

  spoId = randomUUID();
  await prisma.stock_production_orders.create({
    data: { id: spoId, spoNumber: `${RUN}-SPO`, styleId, totalQuantity: 30, createdById: adminId },
  });
  spoItemId = randomUUID();
  await prisma.stock_production_order_items.create({
    data: { id: spoItemId, stockProductionOrderId: spoId, sizeId: sizeM, quantity: 30 },
  });

  const created = await request(app)
    .post('/api/work-orders')
    .set(adminHeader)
    .send({
      stockProductionOrderId: spoId,
      stockProductionOrderItemId: spoItemId,
      styleId,
      warehouseId,
      plannedStartDate: iso(0),
      plannedEndDate: iso(10),
      totalQuantity: 30,
      remarks: 'fixture remarks',
      colorSizeBreakup: [
        { colorId: null, sizeId: sizeM, quantity: 20 },
        { colorId: null, sizeId: sizeL, quantity: 10 },
      ],
    });
  expectStatus(created, 201);
  workOrderId = created.body.data.id;
  createdRunIds.push(workOrderId);
});

afterAll(async () => {
  const ids = createdRunIds.map((id) => only(id));
  if (ids.length) {
    await prisma.production_tracking.deleteMany({ where: { workOrderId: { in: ids } } });
    await prisma.work_orders.deleteMany({ where: { id: { in: ids } } }); // breakup cascades
  }
  await prisma.stock_production_order_items.deleteMany({ where: { stockProductionOrderId: only(spoId) } });
  await prisma.stock_production_orders.deleteMany({ where: { id: only(spoId) } });
  await prisma.size_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(adminId) } });
  await prisma.$disconnect();
});

describe('Production Runs pages — API contract', () => {
  it('sends the relation keys the pages read (breakup, warehouse, createdBy)', async () => {
    const res = await request(app).get(`/api/work-orders/${workOrderId}`).set(adminHeader);
    expectStatus(res, 200);
    const wo = res.body.data;
    expect(wo.breakup).toHaveLength(2);
    expect(wo.breakup[0].sizeOptions.sizeName).toMatch(/^[ML]$/);
    expect(wo.warehouse.warehouseName).toBe(`${RUN} Floor`);
    expect(wo.createdBy.id).toBe(adminId);

    const list = await request(app).get('/api/work-orders').query({ search: RUN }).set(adminHeader);
    expectStatus(list, 200);
    const row = list.body.data.find((w: { id: string }) => w.id === workOrderId);
    expect(row.warehouse.warehouseName).toBe(`${RUN} Floor`);
  });

  it('a run that does not exist is a 404 with a message, not a 500', async () => {
    const res = await request(app).get(`/api/work-orders/${randomUUID()}`).set(adminHeader);
    expectStatus(res, 404);
    expect(res.body.message).toBe('Work order not found');
  });

  it('refuses a new run that ends before it starts', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set(adminHeader)
      .send({
        styleId,
        plannedStartDate: iso(5),
        plannedEndDate: iso(1),
        totalQuantity: 5,
        colorSizeBreakup: [{ colorId: null, sizeId: sizeM, quantity: 5 }],
      });
    if (res.status === 201) createdRunIds.push(res.body.data.id);
    expectStatus(res, 400);
    expect(res.body.message).toMatch(/cannot be before the planned start date/);
  });

  it('refuses an edit that moves the end before the start', async () => {
    const res = await request(app)
      .put(`/api/work-orders/${workOrderId}`)
      .set(adminHeader)
      .send({ plannedEndDate: iso(-3) });
    expectStatus(res, 400);
    expect(res.body.message).toMatch(/cannot be before the planned start date/);
  });

  it('the edit form can clear the location and the remarks', async () => {
    const res = await request(app)
      .put(`/api/work-orders/${workOrderId}`)
      .set(adminHeader)
      .send({ warehouseId: null, remarks: null });
    expectStatus(res, 200);
    const row = await prisma.work_orders.findUnique({ where: { id: workOrderId } });
    expect(row?.warehouseId).toBeNull();
    expect(row?.remarks).toBeNull();
  });

  it('refuses a split whose dispatch date is before the run starts', async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/split`)
      .set(adminHeader)
      .send({ plannedDispatchDate: iso(-5), breakupToSplit: [{ colorId: null, sizeId: sizeL, quantity: 10 }] });
    if (res.status === 201) createdRunIds.push(res.body.data.id);
    expectStatus(res, 400);
    expect(res.body.message).toMatch(/Planned dispatch date .* cannot be before the planned start date/);
  });

  it('a split keeps the make-to-stock source', async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/split`)
      .set(adminHeader)
      .send({ plannedDispatchDate: iso(8), breakupToSplit: [{ colorId: null, sizeId: sizeL, quantity: 10 }] });
    expectStatus(res, 201);
    createdRunIds.push(res.body.data.id);

    const child = await prisma.work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(child?.stockProductionOrderId).toBe(spoId);
    expect(child?.stockProductionOrderItemId).toBe(spoItemId);
    expect(child?.totalQuantity).toBe(10);
    const parent = await prisma.work_orders.findUnique({ where: { id: workOrderId } });
    expect(parent?.totalQuantity).toBe(20);
  });

  it('only a PENDING run can be split — the refusal says so', async () => {
    await prisma.work_orders.update({ where: { id: workOrderId }, data: { status: 'IN_PRODUCTION' } });
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/split`)
      .set(adminHeader)
      .send({ plannedDispatchDate: iso(8), breakupToSplit: [{ colorId: null, sizeId: sizeM, quantity: 5 }] });
    if (res.status === 201) createdRunIds.push(res.body.data.id);
    expectStatus(res, 422);
    expect(res.body.message).toBe('Can only split work orders in PENDING status');
  });
});
