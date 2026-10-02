/**
 * Samples follow the customer's sample requirements (owner, 2026-10-02).
 *
 * Kashaya Fabs needed no samples, yet cutting was refused for one: "no requirement rows" read as
 * FIT + Size Set required, and a Size Set could not be raised until a FIT and a PP were approved,
 * whatever the customer asked for. Pinned here, through the real endpoints and the real gate:
 *   - a customer requiring only a Size Set raises it directly — no FIT, no PP
 *   - a stock run (no order) follows the STYLE's buyer, and waits for that Size Set alone
 *   - a customer with nothing ticked: no sample holds up cutting, and none is auto-created
 *   - a sample goes To make → Sent → verdict
 *
 * Runs on garment_erp_test (setup.ts); tagged fixtures, deleted in afterAll.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { productionBlockingValidationService as gates } from '../../services/productionBlockingValidation.service';
import { sampleService } from '../../services/sample.service';

const RUN = `SRC${Date.now().toString(36).toUpperCase()}`;
const SAMPLE_BLOCKERS = ['FIT_SAMPLE_NOT_APPROVED', 'PP_SAMPLE_NOT_APPROVED', 'SIZE_SET_SAMPLE_NOT_APPROVED'];

let adminId: string;
let adminHeader: Record<string, string>;
let warehouseId: string;
let sizeSetOnlyCustomerId: string;
let openCustomerId: string;
const styleIds: string[] = [];
const workOrderIds: string[] = [];

const expectStatus = (res: request.Response, status: number) => {
  if (res.status !== status) throw new Error(`expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
};

/** A style for `customerId` with one size, and a stock run (no order) of it. */
async function styleWithStockRun(customerId: string, tag: string) {
  const styleId = randomUUID();
  styleIds.push(styleId);
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-${tag}`, styleName: `${RUN} ${tag}`, customerId, createdById: adminId },
  });
  const sizeId = randomUUID();
  await prisma.size_options.create({ data: { id: sizeId, styleId, sizeName: 'M', sizeCode: 'M' } });
  await prisma.style_variants.create({
    data: { id: randomUUID(), styleId, sku: `${RUN}-${tag}-M`, sizeId, sizeName: 'M' },
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
  workOrderIds.push(created.body.data.id);
  return { styleId, workOrderId: created.body.data.id as string };
}

const sampleBlockers = async (workOrderId: string) =>
  (await gates.validateStageTransition(workOrderId, 'IN_CUTTING', false)).blockers
    .map((b) => b.type)
    .filter((t) => SAMPLE_BLOCKERS.includes(t));

const raiseSample = (customerId: string, styleId: string, sampleType: string) =>
  request(app)
    .post('/api/samples')
    .set(adminHeader)
    .send({ customerId, styleId, sampleType, requiredDate: new Date(Date.now() + 3 * 86400000).toISOString() });

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}@samples.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');

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

  // As Kashaya Fabs is saved on live: FIT and PP un-ticked (with the screen's hidden blocksProduction),
  // Size Set Required + Blocks.
  const sizeSetOnly = await prisma.customers.create({
    data: {
      code: `${RUN}-SS`,
      name: `${RUN} Size Set Only`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: adminId,
      customer_sample_requirements: {
        create: [
          { sampleType: 'FIT_SAMPLE', isRequired: false, blocksProduction: true },
          { sampleType: 'PP_SAMPLE', isRequired: false, blocksProduction: true },
          { sampleType: 'SIZE_SET_SAMPLE', isRequired: true, blocksProduction: true },
        ],
      },
    },
  });
  sizeSetOnlyCustomerId = sizeSetOnly.id;

  const open = await prisma.customers.create({
    data: {
      code: `${RUN}-OP`,
      name: `${RUN} Nothing Ticked`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: adminId,
    },
  });
  openCustomerId = open.id;
});

afterAll(async () => {
  const customerIds = [sizeSetOnlyCustomerId, openCustomerId].filter(Boolean).map((id) => only(id));
  const steps: Array<[string, () => Promise<unknown>]> = [
    [
      'production_tracking',
      () => prisma.production_tracking.deleteMany({ where: { workOrderId: { in: workOrderIds } } }),
    ],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: { in: workOrderIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: { in: customerIds } } })],
    ['style_variants', () => prisma.style_variants.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: styleIds } } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: { in: customerIds } } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(adminId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[sample-requirements-follow-customer teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a customer that requires only a Size Set Sample', () => {
  let styleId: string;
  let workOrderId: string;

  beforeAll(async () => {
    ({ styleId, workOrderId } = await styleWithStockRun(sizeSetOnlyCustomerId, 'SS'));
  });

  it("a stock run follows the style's buyer: cutting waits for the Size Set alone", async () => {
    expect(await sampleBlockers(workOrderId)).toEqual(['SIZE_SET_SAMPLE_NOT_APPROVED']);
  });

  it('raises the Size Set directly — no FIT or PP first', async () => {
    const check = await request(app)
      .get('/api/stage-validation/check-sample-creation')
      .query({ styleId, sampleType: 'SIZE_SET_SAMPLE', customerId: sizeSetOnlyCustomerId })
      .set(adminHeader);
    expectStatus(check, 200);
    expect(check.body.data.canCreate).toBe(true);

    const res = await raiseSample(sizeSetOnlyCustomerId, styleId, 'SIZE_SET_SAMPLE');
    expectStatus(res, 201);
    expect(res.body.data.status).toBe('REQUESTED');
  });

  it('To make → Sent → Approved clears the gate', async () => {
    const sample = await prisma.samples.findFirstOrThrow({ where: { styleId, sampleType: 'SIZE_SET_SAMPLE' } });
    expectStatus(await request(app).post(`/api/samples/${sample.id}/send`).set(adminHeader).send({}), 200);
    expectStatus(
      await request(app).post(`/api/samples/${sample.id}/feedback`).set(adminHeader).send({ status: 'APPROVED' }),
      200
    );
    expect(await sampleBlockers(workOrderId)).toEqual([]);
  });
});

describe('a customer with nothing ticked', () => {
  it('no sample holds up cutting', async () => {
    const { workOrderId } = await styleWithStockRun(openCustomerId, 'OP');
    expect(await sampleBlockers(workOrderId)).toEqual([]);
  });

  it('orders auto-create no samples, as the customer screen says', async () => {
    expect(await sampleService.getCustomerSampleRequirements(openCustomerId)).toEqual([]);
  });

  it('a PP sample needs no FIT first', async () => {
    const res = await raiseSample(openCustomerId, styleIds[styleIds.length - 1], 'PP_SAMPLE');
    expectStatus(res, 201);
  });
});
