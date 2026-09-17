/**
 * The admin override on a production gate is admin-only, needs a reason, and is always audited.
 *
 * Found by the first end-to-end cutting walk (cutting-first-run, 2026-09-16): push-to-cutting and
 * stage tracking took `adminOverride: true` from ANY caller, skipped every gate (samples, tests, BOM,
 * Production CAD), and wrote the audit row only when a reason happened to be sent. Sample creation
 * had checked the role all along. This pins the corrected contract (plan T4-A):
 *   - a non-admin who MAY write work orders reaches the gate (422) but cannot override it (403)
 *   - an admin cannot override without a written reason (400)
 *   - an admin override succeeds and leaves exactly one stage_transition_overrides row
 *   - the same rule on POST /work-orders/:id/tracking
 *
 * Runs against the LIVE database. The PRODUCTION_MANAGER × workOrders switch is set ON for the run
 * (so the request reaches the handler) and restored to whatever it was, in afterAll.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `OVR${Date.now().toString(36).toUpperCase()}`;
const ROLE = 'PRODUCTION_MANAGER' as const;
const KEY = 'workOrders';
const REASON = 'Customer urgency — approved by production head (test run)';

let adminId: string;
let adminHeader: Record<string, string>;
let pmId: string;
let pmHeader: Record<string, string>;
let originalAllowed: boolean | null = null;
let warehouseId: string;
let styleId: string;
let sizeId: string;
let workOrderId: string;

const expectStatus = (res: request.Response, status: number) => {
  if (res.status !== status) {
    throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
};

async function setSwitch(allowed: boolean) {
  await request(app)
    .patch('/api/permissions/toggle')
    .set(adminHeader)
    .send({ role: ROLE, permissionKey: KEY, allowed })
    .expect(200);
}

const overrideRows = () => prisma.stage_transition_overrides.findMany({ where: { workOrderId: only(workOrderId) } });
const woStatus = async () => (await prisma.work_orders.findUnique({ where: { id: workOrderId } }))!.status;

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}-admin@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');

  const pm = await createTestUser({
    email: `test-${RUN.toLowerCase()}-pm@smoke.test`,
    role: ROLE,
    isActive: true,
    isApproved: true,
  });
  pmId = pm.id;
  pmHeader = getAuthHeader(pm.id, ROLE);

  const row = await prisma.role_permissions.findUnique({
    where: { role_permissionKey: { role: ROLE, permissionKey: KEY } },
  });
  originalAllowed = row?.allowed ?? null;
  await setSwitch(true);

  const warehouse = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Warehouse`,
      warehouseType: 'RAW_MATERIAL',
      isActive: true,
      createdById: adminId,
    },
  });
  warehouseId = warehouse.id;

  // A style with a size and nothing else: no samples, no CAD — every gate is closed.
  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: adminId },
  });
  sizeId = randomUUID();
  await prisma.size_options.create({ data: { id: sizeId, styleId, sizeName: 'M', sizeCode: 'M' } });
  await prisma.style_variants.create({
    data: { id: randomUUID(), styleId, sku: `${RUN}-STY-M`, sizeId, sizeName: 'M' },
  });

  const created = await request(app)
    .post('/api/work-orders')
    .set(adminHeader)
    .send({
      styleId,
      warehouseId,
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      totalQuantity: 10,
      colorSizeBreakup: [{ colorId: null, sizeId, quantity: 10 }],
    });
  expectStatus(created, 201);
  workOrderId = created.body.data.id;
});

afterAll(async () => {
  try {
    if (originalAllowed !== null) await setSwitch(originalAllowed);
  } catch (err) {
    console.error('work-order-override-guard: could not restore the permission switch', err);
  }
  if (workOrderId) {
    await prisma.production_tracking.deleteMany({ where: { workOrderId } });
    await prisma.stage_transition_overrides.deleteMany({ where: { workOrderId } });
    await prisma.work_orders.deleteMany({ where: { id: workOrderId } }); // breakup cascades
  }
  await prisma.style_variants.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.size_options.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: { in: [adminId, pmId].map((id) => only(id)) } } });
  await prisma.$disconnect();
});

describe('admin override on a production gate', () => {
  it('a production manager reaches the gate — and is stopped by it', async () => {
    const res = await request(app).post(`/api/work-orders/${workOrderId}/push-to-cutting`).set(pmHeader).send({});
    expectStatus(res, 422);
    expect(res.body.message).toMatch(/Size Set Sample/);
    expect(await woStatus()).toBe('PENDING');
  });

  it('a production manager cannot override the gate, even with a reason', async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/push-to-cutting`)
      .set(pmHeader)
      .send({ adminOverride: true, overrideReason: REASON });
    expectStatus(res, 403);
    expect(res.body.error).toBe('ADMIN_ONLY');
    expect(await woStatus()).toBe('PENDING');
    expect(await overrideRows()).toHaveLength(0);
  });

  it('an admin cannot override without a written reason', async () => {
    const none = await request(app)
      .post(`/api/work-orders/${workOrderId}/push-to-cutting`)
      .set(adminHeader)
      .send({ adminOverride: true });
    expectStatus(none, 400);

    const tooShort = await request(app)
      .post(`/api/work-orders/${workOrderId}/push-to-cutting`)
      .set(adminHeader)
      .send({ adminOverride: true, overrideReason: 'urgent' });
    expectStatus(tooShort, 400);

    expect(await woStatus()).toBe('PENDING');
    expect(await overrideRows()).toHaveLength(0);
  });

  it('the same rule guards stage tracking', async () => {
    const pm = await request(app)
      .post(`/api/work-orders/${workOrderId}/tracking`)
      .set(pmHeader)
      .send({ productionStage: 'IN_STITCHING', quantityCompleted: 5, adminOverride: true, overrideReason: REASON });
    expectStatus(pm, 403);
    expect(pm.body.error).toBe('ADMIN_ONLY');

    const noReason = await request(app)
      .post(`/api/work-orders/${workOrderId}/tracking`)
      .set(adminHeader)
      .send({ productionStage: 'IN_STITCHING', quantityCompleted: 5, adminOverride: true });
    expectStatus(noReason, 400);

    // Creating the run writes its own opening tracking row; the stage we tried must not be there.
    expect(await prisma.production_tracking.count({ where: { workOrderId, productionStage: 'IN_STITCHING' } })).toBe(0);
    expect(await overrideRows()).toHaveLength(0);
  });

  it('an admin override with a reason goes through and is audited exactly once', async () => {
    const res = await request(app)
      .post(`/api/work-orders/${workOrderId}/push-to-cutting`)
      .set(adminHeader)
      .send({ adminOverride: true, overrideReason: REASON });
    expectStatus(res, 200);
    expect(await woStatus()).toBe('IN_PRODUCTION');

    const rows = await overrideRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].blockType).toBe('STAGE_TRANSITION');
    expect(rows[0].toStage).toBe('IN_CUTTING');
    expect(rows[0].overrideReason).toBe(REASON);
    expect(rows[0].overriddenById).toBe(adminId);
  });
});
