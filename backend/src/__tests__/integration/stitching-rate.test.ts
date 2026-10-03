/**
 * The stitching rate on a stitching issue (owner, 2026-10-03), walked through the real endpoints.
 *
 * An issue to a stitching contractor recorded no price — what costing assumed was taken as what was paid.
 * Now the issue form shows the last rate given for the style and the costing rate, and the rate given to the
 * operators is typed (required). The contractor's commission (one company setting) is added on top and
 * frozen on the issue; the cost sheet's stitching cost INCLUDES it. The contractor is owed GOOD pieces ×
 * rate + commission (stitching-rate.helper), shown on the issue and on the Contractor Statement.
 *
 * Runs against the real app on garment_erp_test; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { systemSettingsService } from '../../services/system-settings.service';

const RUN = `SRT${Date.now().toString(36).toUpperCase()}`;
const COSTING_STITCHING = 33; // per piece, commission included

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let sizeId: string;
let workOrderId: string;
let contractorId: string;
let costSheetId: string;
let issueId: string;
let commission: number;

const round2 = (n: number) => Math.round(n * 100) / 100;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  commission = await systemSettingsService.getNumberDefault('STITCHING_CONTRACTOR_COMMISSION_PERCENT');

  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Kurta`, createdById: userId },
    })
  ).id;
  sizeId = (
    await prisma.size_options.create({
      data: { id: randomUUID(), styleId, sizeName: 'S', sizeCode: 'S', sortOrder: 1 },
    })
  ).id;
  workOrderId = randomUUID();
  await prisma.work_orders.create({
    data: {
      id: workOrderId,
      workOrderNumber: `${RUN}-WO`,
      styleId,
      status: 'IN_PRODUCTION',
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 7 * 86400000),
      totalQuantity: 10,
      createdById: userId,
    },
  });
  contractorId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-CT`,
        name: `${RUN} Tailor`,
        supplierCategories: ['STITCHING_CONTRACTOR'],
        createdById: userId,
      },
    })
  ).id;
  costSheetId = (
    await prisma.style_costing.create({
      data: {
        id: randomUUID(),
        styleId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        version: 1,
        isApproved: true,
        approvalStatus: 'APPROVED',
        stitchingCost: COSTING_STITCHING,
        createdById: userId,
      },
    })
  ).id;
});

afterAll(async () => {
  const wo = { workOrderId: only(workOrderId) };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['stage_receipts', () => prisma.stage_receipts.deleteMany({ where: wo })],
    ['stitching_daily_outputs', () => prisma.stitching_daily_outputs.deleteMany({ where: { stitchingIssue: wo } })],
    ['stitching_issues', () => prisma.stitching_issues.deleteMany({ where: wo })],
    ['transfer_slips', () => prisma.transfer_slips.deleteMany({ where: wo })],
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: wo })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } })],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: { id: only(costSheetId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(contractorId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[stitching-rate teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

async function cuttingSlip(tag: string, quantity: number) {
  return prisma.transfer_slips.create({
    data: {
      slipNumber: `${RUN}-${tag}`,
      workOrderId,
      fromStage: 'CUTTING',
      toStage: 'STITCHING',
      fromDepartment: 'Cutting',
      toDepartment: 'Stitching',
      totalGoodPieces: quantity,
      preparedById: userId,
      skuBreakdown: { create: [{ colorId: null, sizeId, quantity }] },
    },
  });
}

describe('the stitching rate on an issue', () => {
  let slipId: string;

  beforeAll(async () => {
    slipId = (await cuttingSlip('A', 10)).id;
  });

  const payload = (extra: Record<string, unknown>) => ({
    workOrderId,
    issueDate: '2026-10-03',
    contractorId,
    transferSlipIds: [slipId],
    skuBreakdown: [{ colorId: null, sizeId, issuedQty: 10 }],
    ...extra,
  });

  it('the form is shown the costing rate split into operators + commission, and no last rate yet', async () => {
    const res = await request(app).get('/api/stitching/rate-guide').query({ workOrderId }).set(authHeader).expect(200);
    expect(res.body.data.commissionPercent).toBe(commission);
    expect(res.body.data.costing).toMatchObject({
      costSheetId,
      label: 'Raw Mat v1',
      totalPerPiece: COSTING_STITCHING,
      operatorRatePerPiece: round2(COSTING_STITCHING / (1 + commission / 100)),
    });
    expect(res.body.data.lastGiven).toBeNull();
  });

  it('an issue without the rate given is refused', async () => {
    const res = await request(app).post('/api/stitching/issues').set(authHeader).send(payload({}));
    expect(res.status).toBe(400);
    const blank = await request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send(payload({ operatorRatePerPiece: '' }));
    expect(blank.status).toBe(400);
    expect(await prisma.stitching_issues.count({ where: { workOrderId } })).toBe(0);
  });

  it('the issue keeps the rate given, the commission of its day and the costing rate of its day', async () => {
    // The page posts the input's value; a number or a numeric string are both read
    const res = await request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send(payload({ operatorRatePerPiece: '25' }));
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 201 });
    issueId = res.body.data.id;

    const row = await prisma.stitching_issues.findUniqueOrThrow({ where: { id: issueId } });
    expect(Number(row.operatorRatePerPiece)).toBe(25);
    expect(Number(row.commissionPercent)).toBe(commission);
    expect(Number(row.costingRatePerPiece)).toBe(COSTING_STITCHING);
    expect(row.costingSheetId).toBe(costSheetId);

    const perPiece = round2(25 + (25 * commission) / 100);
    expect(res.body.data.payment).toMatchObject({
      operatorRatePerPiece: 25,
      totalPerPiece: perPiece,
      costingRatePerPiece: COSTING_STITCHING,
      differencePerPiece: round2(perPiece - COSTING_STITCHING),
      goodPieces: 0,
      owed: { operatorAmount: 0, commissionAmount: 0, totalAmount: 0 },
    });
    expect(res.body.data.costingSheet).toMatchObject({ id: costSheetId, label: 'Raw Mat v1' });
  });

  it('the contractor is owed for the GOOD pieces only, commission on top', async () => {
    await request(app).post(`/api/stitching/issues/${issueId}/receive`).set(authHeader).send({}).expect(200);
    await request(app).post(`/api/stitching/issues/${issueId}/start`).set(authHeader).send({}).expect(200);
    await request(app)
      .post(`/api/stitching/issues/${issueId}/daily-output`)
      .set(authHeader)
      .send({ outputDate: '2026-10-03', skuOutputs: [{ colorId: null, sizeId, goodQty: 8, defectQty: 2 }] })
      .expect(200);

    const res = await request(app).get(`/api/stitching/issues/${issueId}`).set(authHeader).expect(200);
    const operatorAmount = 8 * 25;
    const commissionAmount = round2((operatorAmount * commission) / 100);
    expect(res.body.data.payment).toMatchObject({
      goodPieces: 8,
      defectPieces: 2,
      owed: { operatorAmount, commissionAmount, totalAmount: round2(operatorAmount + commissionAmount) },
    });
  });

  it('the next issue of this style is shown this rate as the last one given', async () => {
    const res = await request(app).get('/api/stitching/rate-guide').query({ workOrderId }).set(authHeader).expect(200);
    expect(res.body.data.lastGiven).toMatchObject({
      issueId,
      operatorRatePerPiece: 25,
      commissionPercent: commission,
      contractorName: `${RUN} Tailor`,
    });
  });

  it('the Contractor Statement lists the issue for the days its pieces were stitched', async () => {
    const inside = await request(app)
      .get('/api/stitching/contractor-statement')
      .query({ contractorId, fromDate: '2026-10-03', toDate: '2026-10-03' })
      .set(authHeader)
      .expect(200);
    expect(inside.body.data.rows).toHaveLength(1);
    expect(inside.body.data.rows[0]).toMatchObject({ id: issueId, issuedPieces: 10, goodPieces: 8 });
    expect(inside.body.data.totals.totalAmount).toBe(round2(200 + (200 * commission) / 100));

    const after = await request(app)
      .get('/api/stitching/contractor-statement')
      .query({ contractorId, fromDate: '2026-10-04' })
      .set(authHeader)
      .expect(200);
    expect(after.body.data.rows).toHaveLength(0);
    expect(after.body.data.totals.totalAmount).toBe(0);
  });

  it('a corrected rate changes what is owed; the commission stays the one of the issue day', async () => {
    const res = await request(app)
      .put(`/api/stitching/issues/${issueId}`)
      .set(authHeader)
      .send({ operatorRatePerPiece: '26' })
      .expect(200);
    const operatorAmount = 8 * 26;
    expect(res.body.data.payment.owed).toMatchObject({
      operatorAmount,
      totalAmount: round2(operatorAmount + (operatorAmount * commission) / 100),
    });
    // A blank rate in an edit is "no change", never a cleared rate
    await request(app)
      .put(`/api/stitching/issues/${issueId}`)
      .set(authHeader)
      .send({ operatorRatePerPiece: '' })
      .expect(200);
    const row = await prisma.stitching_issues.findUniqueOrThrow({ where: { id: issueId } });
    expect(Number(row.operatorRatePerPiece)).toBe(26);
  });
});
