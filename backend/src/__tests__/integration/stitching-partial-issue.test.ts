/**
 * The Stitching page's flows, walked through the real endpoints (2026-09-30 bug hunt).
 *
 * 1. No stitching or finishing response carries a user's password hash. `dailyOutputs.createdBy: true`
 *    loaded the whole users row and the transforms passed it through untouched, so the first daily
 *    output recorded would have sent the recorder's password hash to every page that opened the issue.
 *
 * Runs against the real app on garment_erp_test; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SPI${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let workOrderId: string;
const sizeIds: Record<string, string> = {};

/** A cutting → stitching slip for this run, as the cutting page files it. */
async function cuttingSlip(tag: string, split: Record<string, number>) {
  const total = Object.values(split).reduce((sum, q) => sum + q, 0);
  return prisma.transfer_slips.create({
    data: {
      slipNumber: `${RUN}-${tag}`,
      workOrderId,
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
      fromDepartment: 'Cutting',
      toDepartment: 'Stitching',
      totalGoodPieces: total,
      preparedById: userId,
      skuBreakdown: {
        create: Object.entries(split).map(([size, quantity]) => ({ colorId: null, sizeId: sizeIds[size], quantity })),
      },
    },
  });
}

/** Every key anywhere in a JSON value. */
function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, keys));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      allKeys(v, keys);
    }
  }
  return keys;
}

function expectNoSecrets(body: unknown) {
  const keys = allKeys(body);
  expect(keys.has('password')).toBe(false);
  expect(keys.has('tokenVersion')).toBe(false);
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Top`, createdById: userId },
    })
  ).id;
  for (const [name, order] of [
    ['S', 1],
    ['M', 2],
  ] as const) {
    sizeIds[name] = (
      await prisma.size_options.create({
        data: { id: randomUUID(), styleId, sizeName: name, sizeCode: name, sortOrder: order },
      })
    ).id;
  }
  workOrderId = randomUUID();
  await prisma.work_orders.create({
    data: {
      id: workOrderId,
      workOrderNumber: `${RUN}-WO`,
      styleId,
      status: 'IN_PRODUCTION',
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 7 * 86400000),
      totalQuantity: 100,
      createdById: userId,
    },
  });
});

afterAll(async () => {
  const wo = { workOrderId: only(workOrderId) };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['stage_receipts', () => prisma.stage_receipts.deleteMany({ where: wo })],
    [
      'finishing_daily_outputs',
      () =>
        prisma.finishing_daily_outputs.deleteMany({ where: { finishingIssue: { workOrderId: only(workOrderId) } } }),
    ],
    ['finishing_issues', () => prisma.finishing_issues.deleteMany({ where: wo })],
    [
      'stitching_daily_outputs',
      () =>
        prisma.stitching_daily_outputs.deleteMany({ where: { stitchingIssue: { workOrderId: only(workOrderId) } } }),
    ],
    ['stitching_issues', () => prisma.stitching_issues.deleteMany({ where: wo })],
    ['transfer_slips', () => prisma.transfer_slips.deleteMany({ where: wo })],
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: wo })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[stitching-partial-issue teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('no stitching or finishing response carries a password hash', () => {
  it('list, detail and record-output responses name the user only', async () => {
    const slip = await cuttingSlip('LEAK', { S: 3, M: 2 });
    const created = await request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send({
        workOrderId,
        issueDate: '2026-09-30',
        transferSlipIds: [slip.id],
        skuBreakdown: [
          { colorId: null, sizeId: sizeIds.S, issuedQty: 3 },
          { colorId: null, sizeId: sizeIds.M, issuedQty: 2 },
        ],
      });
    expect({ status: created.status, body: created.body }).toMatchObject({ status: 201 });
    const issueId = created.body.data.id;
    expectNoSecrets(created.body);

    await request(app).post(`/api/stitching/issues/${issueId}/receive`).set(authHeader).send({}).expect(200);
    await request(app).post(`/api/stitching/issues/${issueId}/start`).set(authHeader).send({}).expect(200);
    const output = await request(app)
      .post(`/api/stitching/issues/${issueId}/daily-output`)
      .set(authHeader)
      .send({
        outputDate: '2026-09-30',
        skuOutputs: [
          { colorId: null, sizeId: sizeIds.S, goodQty: 3, defectQty: 0 },
          { colorId: null, sizeId: sizeIds.M, goodQty: 2, defectQty: 0 },
        ],
      })
      .expect(200);
    expectNoSecrets(output.body);
    expect(output.body.data.createdBy).toEqual({ id: userId, name: expect.any(String) });

    const detail = await request(app).get(`/api/stitching/issues/${issueId}`).set(authHeader).expect(200);
    expectNoSecrets(detail.body);
    expect(detail.body.data.dailyOutputs[0].createdBy).toEqual({ id: userId, name: expect.any(String) });

    const list = await request(app).get('/api/stitching/issues').query({ workOrderId }).set(authHeader).expect(200);
    expectNoSecrets(list.body);

    // Finishing: the same issue carried on — its outputs name their recorder the same way
    await request(app).post(`/api/stitching/issues/${issueId}/complete`).set(authHeader).send({}).expect(200);
    const toFinishing = await request(app)
      .post(`/api/stitching/issues/${issueId}/generate-transfer-slip`)
      .set(authHeader)
      .send({})
      .expect(200);
    const fin = await request(app)
      .post('/api/finishing/issues')
      .set(authHeader)
      .send({
        workOrderId,
        issueDate: '2026-09-30',
        skuBreakdown: [
          { colorId: null, sizeId: sizeIds.S, issuedQty: 3 },
          { colorId: null, sizeId: sizeIds.M, issuedQty: 2 },
        ],
      });
    expect({ status: fin.status, body: fin.body }).toMatchObject({ status: 201 });
    const finId = fin.body.data.id;
    await request(app)
      .post(`/api/finishing/issues/${finId}/receive`)
      .set(authHeader)
      .send({ transferSlipId: toFinishing.body.data.transferSlipId, receivedQty: 5 })
      .expect(200);
    await request(app).post(`/api/finishing/issues/${finId}/start`).set(authHeader).send({}).expect(200);
    const finOutput = await request(app)
      .post(`/api/finishing/issues/${finId}/record-output`)
      .set(authHeader)
      .send({
        outputDate: '2026-09-30',
        skuOutputs: [
          { colorId: null, sizeId: sizeIds.S, finishedQty: 3, defectQty: 0 },
          { colorId: null, sizeId: sizeIds.M, finishedQty: 2, defectQty: 0 },
        ],
      })
      .expect(200);
    expectNoSecrets(finOutput.body);
    const finDetail = await request(app).get(`/api/finishing/issues/${finId}`).set(authHeader).expect(200);
    expectNoSecrets(finDetail.body);
    expect(finDetail.body.data.dailyOutputs[0].createdBy).toEqual({ id: userId, name: expect.any(String) });
    const finList = await request(app).get('/api/finishing/issues').query({ workOrderId }).set(authHeader).expect(200);
    expectNoSecrets(finList.body);
  });
});
