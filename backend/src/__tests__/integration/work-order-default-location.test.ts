/**
 * A production run with no Production Location lands on the company's own unit (the oldest active
 * WH-RM warehouse — Kashaya Fabs, Jaipur), because all production happens there (owner, 2026-09-25).
 * A location that is sent is kept, and clearing it on Edit still removes it.
 *
 * Runs against the LIVE database (there is no test DB); everything is tagged and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `WOLOC${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let styleId: string;
let sizeId: string;
let otherWarehouseId: string;
const workOrderIds: string[] = [];

const only = (id: string | undefined) => id ?? '__unset__';

const createRun = (extra: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/work-orders')
    .set(authHeader)
    .send({
      styleId,
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      totalQuantity: 10,
      colorSizeBreakup: [{ colorId: null, sizeId, quantity: 10 }],
      ...extra,
    });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: userId },
  });
  sizeId = randomUUID();
  await prisma.size_options.create({ data: { id: sizeId, styleId, sizeName: 'S', sizeCode: 'S' } });
  await prisma.style_variants.create({
    data: { id: randomUUID(), styleId, sku: `${RUN}-STY-S`, sizeId, sizeName: 'S' },
  });

  const other = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Outside Unit`,
      warehouseType: 'GENERAL',
      isActive: true,
      createdById: userId,
    },
  });
  otherWarehouseId = other.id;
});

afterAll(async () => {
  await prisma.production_tracking.deleteMany({ where: { workOrderId: { in: workOrderIds } } });
  await prisma.stage_receipts.deleteMany({ where: { workOrderId: { in: workOrderIds } } });
  await prisma.stage_transition_overrides.deleteMany({ where: { workOrderId: { in: workOrderIds } } });
  await prisma.work_orders.deleteMany({ where: { id: { in: workOrderIds } } }); // breakup cascades
  await prisma.style_variants.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.size_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(otherWarehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Production run location', () => {
  it('defaults to the company warehouse when none is sent', async () => {
    const company = await prisma.warehouses.findFirst({
      where: { isActive: true, warehouseCode: { startsWith: 'WH-RM' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    expect(company).not.toBeNull();

    const res = await createRun();
    expect(res.status).toBe(201);
    workOrderIds.push(res.body.data.id);

    const row = await prisma.work_orders.findUnique({ where: { id: res.body.data.id }, select: { warehouseId: true } });
    expect(row?.warehouseId).toBe(company!.id);
  });

  it('keeps a location that is sent', async () => {
    const res = await createRun({ warehouseId: otherWarehouseId });
    expect(res.status).toBe(201);
    workOrderIds.push(res.body.data.id);

    const row = await prisma.work_orders.findUnique({ where: { id: res.body.data.id }, select: { warehouseId: true } });
    expect(row?.warehouseId).toBe(otherWarehouseId);
  });

  it('clearing the location on Edit removes it', async () => {
    const id = workOrderIds[0];
    const res = await request(app).put(`/api/work-orders/${id}`).set(authHeader).send({ warehouseId: null });
    expect(res.status).toBe(200);

    const row = await prisma.work_orders.findUnique({ where: { id }, select: { warehouseId: true } });
    expect(row?.warehouseId).toBeNull();
  });
});
