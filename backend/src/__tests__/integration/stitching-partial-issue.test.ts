/**
 * The Stitching page's flows, walked through the real endpoints (2026-09-30 bug hunt).
 *
 * 1. No stitching or finishing response carries a user's password hash. `dailyOutputs.createdBy: true`
 *    loaded the whole users row and the transforms passed it through untouched, so the first daily
 *    output recorded would have sent the recorder's password hash to every page that opened the issue.
 * 2. A cutting slip keeps what an issue did not take (stitching-slip-balance.helper). An issue that
 *    took only some sizes used to close the whole slip and the rest were lost (TS-20260930-0001:
 *    1,680 of 2,139 pcs). Then Receive, the per-size output cap, a short Complete, the list's slip to
 *    finishing and Size-wise Status on the same run.
 *
 * Runs against the real app on garment_erp_test; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';

const RUN = `SPI${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let workOrderId: string;
/** A second run for the leftover walk, so its Size-wise numbers are its own */
let splitWorkOrderId: string;
const sizeIds: Record<string, string> = {};

/** A cutting → stitching slip for this run, as the cutting page files it. */
async function cuttingSlip(tag: string, split: Record<string, number>, onWorkOrder = workOrderId) {
  const total = Object.values(split).reduce((sum, q) => sum + q, 0);
  return prisma.transfer_slips.create({
    data: {
      slipNumber: `${RUN}-${tag}`,
      workOrderId: onWorkOrder,
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
  splitWorkOrderId = randomUUID();
  for (const [id, suffix] of [
    [workOrderId, 'WO'],
    [splitWorkOrderId, 'WO2'],
  ]) {
    await prisma.work_orders.create({
      data: {
        id,
        workOrderNumber: `${RUN}-${suffix}`,
        styleId,
        status: 'IN_PRODUCTION',
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 7 * 86400000),
        totalQuantity: 100,
        createdById: userId,
      },
    });
  }
});

afterAll(async () => {
  const ids = onlyAll([workOrderId, splitWorkOrderId]);
  const wo = { workOrderId: { in: ids } };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['stage_receipts', () => prisma.stage_receipts.deleteMany({ where: wo })],
    ['finishing_daily_outputs', () => prisma.finishing_daily_outputs.deleteMany({ where: { finishingIssue: wo } })],
    ['finishing_issues', () => prisma.finishing_issues.deleteMany({ where: wo })],
    ['stitching_daily_outputs', () => prisma.stitching_daily_outputs.deleteMany({ where: { stitchingIssue: wo } })],
    // cascades stitching_issue_slip_skus
    ['stitching_issues', () => prisma.stitching_issues.deleteMany({ where: wo })],
    ['transfer_slips', () => prisma.transfer_slips.deleteMany({ where: wo })],
    ['cutting_batches', () => prisma.cutting_batches.deleteMany({ where: wo })], // cascades its sizes
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: wo })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: { in: ids } } })],
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

describe('a cutting slip keeps what an issue did not take', () => {
  let slipId: string;
  let firstIssueId: string;
  let secondIssueId: string;

  const issue = (skuBreakdown: Array<{ size: string; qty: number }>, slipIds = [slipId]) =>
    request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send({
        workOrderId: splitWorkOrderId,
        issueDate: '2026-09-30',
        transferSlipIds: slipIds,
        skuBreakdown: skuBreakdown.map(({ size, qty }) => ({ colorId: null, sizeId: sizeIds[size], issuedQty: qty })),
      });

  const pendingSlip = async () => {
    const res = await request(app).get('/api/stitching/pending-transfer-slips').set(authHeader).expect(200);
    return (res.body.data as Array<{ id: string }>).find((s) => s.id === slipId) as
      | {
          totalGoodPieces: number;
          sentPieces: number;
          skuBreakdown: Array<{ sizeName: string; quantity: number; sentQty: number }>;
        }
      | undefined;
  };

  it('issuing only size S leaves M on the slip, still pending', async () => {
    slipId = (await cuttingSlip('SPLIT', { S: 6, M: 4 }, splitWorkOrderId)).id;
    const res = await issue([{ size: 'S', qty: 6 }]);
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 201 });
    firstIssueId = res.body.data.id;

    expect((await prisma.transfer_slips.findUniqueOrThrow({ where: { id: slipId } })).status).toBe('CREATED');
    const pending = await pendingSlip();
    expect(pending).toMatchObject({ totalGoodPieces: 4, sentPieces: 10 });
    expect(pending!.skuBreakdown).toEqual([expect.objectContaining({ sizeName: 'M', quantity: 4, sentQty: 4 })]);
  });

  it('refuses more than the slip has left', async () => {
    const res = await issue([{ size: 'S', qty: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/S: asked 1, only 0 left/);
  });

  it('the rest closes the slip; deleting that issue gives its pieces back', async () => {
    const res = await issue([{ size: 'M', qty: 4 }]);
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 201 });
    secondIssueId = res.body.data.id;
    expect((await prisma.transfer_slips.findUniqueOrThrow({ where: { id: slipId } })).status).toBe('RECEIVED');
    expect(await pendingSlip()).toBeUndefined();

    await request(app).delete(`/api/stitching/issues/${secondIssueId}`).set(authHeader).expect(200);
    expect((await prisma.transfer_slips.findUniqueOrThrow({ where: { id: slipId } })).status).toBe('CREATED');
    expect(await pendingSlip()).toMatchObject({ totalGoodPieces: 4 });
  });

  it('Receive records what this issue took from the slip, and leaves the slip open', async () => {
    const other = await cuttingSlip('OTHER', { M: 1 }, splitWorkOrderId);
    const wrong = await request(app)
      .post(`/api/stitching/issues/${firstIssueId}/receive`)
      .set(authHeader)
      .send({ transferSlipId: other.id });
    expect(wrong.status).toBe(400);

    await request(app).post(`/api/stitching/issues/${firstIssueId}/receive`).set(authHeader).send({}).expect(200);
    const receipt = await prisma.stage_receipts.findFirstOrThrow({
      where: { transferSlipId: slipId },
      include: { skuReceipts: true },
    });
    expect(receipt.hasDeviation).toBe(false);
    expect(receipt.skuReceipts).toEqual([
      expect.objectContaining({ sizeId: sizeIds.S, expectedQty: 6, receivedQty: 6, deviation: 0 }),
    ]);
    expect((await prisma.transfer_slips.findUniqueOrThrow({ where: { id: slipId } })).status).toBe('CREATED');
  });

  it('caps output per size, good + defect together', async () => {
    await request(app).post(`/api/stitching/issues/${firstIssueId}/start`).set(authHeader).send({}).expect(200);
    const output = (sizeKey: string, goodQty: number, defectQty: number) =>
      request(app)
        .post(`/api/stitching/issues/${firstIssueId}/daily-output`)
        .set(authHeader)
        .send({
          outputDate: '2026-09-30',
          skuOutputs: [{ colorId: null, sizeId: sizeIds[sizeKey], goodQty, defectQty }],
        });

    const over = await output('S', 5, 2);
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/S: 7 entered, only 6 of 6 left/);
    expect((await output('M', 1, 0)).status).toBe(400); // M is not on this issue
    const noDate = await request(app)
      .post(`/api/stitching/issues/${firstIssueId}/daily-output`)
      .set(authHeader)
      .send({ outputDate: '', skuOutputs: [{ colorId: null, sizeId: sizeIds.S, goodQty: 1, defectQty: 0 }] });
    expect(noDate.status).toBe(400);
    await output('S', 4, 1).expect(200);
  });

  it('a short Complete needs a reason, kept on the remarks', async () => {
    const refused = await request(app).post(`/api/stitching/issues/${firstIssueId}/complete`).set(authHeader).send({});
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/Only 5 of 6 pieces are recorded \(4 good, 1 defect\) — 1 not recorded/);

    const done = await request(app)
      .post(`/api/stitching/issues/${firstIssueId}/complete`)
      .set(authHeader)
      .send({ shortReason: 'one piece lost on the line' })
      .expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.remarks).toMatch(/Completed short: 1 of 6 pcs not recorded — one piece lost on the line/);
  });

  it('the list carries each issue’s slip to finishing', async () => {
    const listRow = async () => {
      const res = await request(app)
        .get('/api/stitching/issues')
        .query({ workOrderId: splitWorkOrderId })
        .set(authHeader)
        .expect(200);
      return (res.body.data as Array<{ id: string; transferSlip: unknown }>).find((i) => i.id === firstIssueId)!;
    };
    expect((await listRow()).transferSlip).toBeNull();
    const slip = await request(app)
      .post(`/api/stitching/issues/${firstIssueId}/generate-transfer-slip`)
      .set(authHeader)
      .send({})
      .expect(200);
    expect((await listRow()).transferSlip).toMatchObject({ slipNumber: slip.body.data.slipNumber });
  });

  it('Size-wise Status shows what waits, what was issued and what was stitched', async () => {
    const res = await request(app).get('/api/stitching/style-size-summary').set(authHeader).expect(200);
    const run = (res.body.data as Array<Record<string, unknown>>).find((r) => r.workOrderId === splitWorkOrderId);
    expect(run).toMatchObject({
      totalWaiting: 5, // M 4 on the split slip + M 1 on the other slip
      totalIssued: 6,
      totalWithContractor: 0,
      totalStitched: 4,
      totalDefects: 1,
      daysPendingPush: null, // its completed issue has gone to finishing
    });
    expect(run!.sizes).toEqual([
      expect.objectContaining({ sizeName: 'S', waiting: 0, issued: 6, withContractor: 0, stitched: 4, defects: 1 }),
      expect.objectContaining({ sizeName: 'M', waiting: 5, issued: 0, withContractor: 0, stitched: 0, defects: 0 }),
    ]);
  });
});

describe('an open issue can be corrected, and an all-defect issue can be finished', () => {
  let issueId: string;
  let contractorId: string;
  let otherSupplierId: string;

  beforeAll(async () => {
    contractorId = (
      await prisma.suppliers.create({
        data: {
          code: `${RUN}-STC`,
          name: `${RUN} Stitcher`,
          supplierCategories: ['STITCHING_CONTRACTOR'],
          createdById: userId,
        },
      })
    ).id;
    otherSupplierId = (
      await prisma.suppliers.create({
        data: {
          code: `${RUN}-FAB`,
          name: `${RUN} Fabric Mill`,
          supplierCategories: ['FABRIC_SUPPLIER'],
          createdById: userId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.stitching_issues.updateMany({ where: { id: issueId }, data: { contractorId: null } });
    await prisma.suppliers.deleteMany({ where: { id: { in: onlyAll([contractorId, otherSupplierId]) } } });
  });

  it('Edit changes the contractor (stitching contractors only) and can clear the expected date', async () => {
    const slip = await cuttingSlip('DEFECT', { S: 2 });
    const created = await request(app)
      .post('/api/stitching/issues')
      .set(authHeader)
      .send({
        workOrderId,
        issueDate: '2026-09-30',
        expectedCompletionDate: '2026-10-07',
        transferSlipIds: [slip.id],
        skuBreakdown: [{ colorId: null, sizeId: sizeIds.S, issuedQty: 2 }],
      });
    expect({ status: created.status, body: created.body }).toMatchObject({ status: 201 });
    issueId = created.body.data.id;

    const wrong = await request(app)
      .put(`/api/stitching/issues/${issueId}`)
      .set(authHeader)
      .send({ contractorId: otherSupplierId });
    expect(wrong.status).toBe(400);

    const edited = await request(app)
      .put(`/api/stitching/issues/${issueId}`)
      .set(authHeader)
      .send({ contractorId, expectedCompletionDate: null, issueDate: '2026-09-29' })
      .expect(200);
    expect(edited.body.data.contractor).toMatchObject({ id: contractorId });
    expect(edited.body.data.expectedCompletionDate).toBeNull();
  });

  it('an issue whose pieces all came out defective completes, and sends nothing to finishing', async () => {
    await request(app).post(`/api/stitching/issues/${issueId}/receive`).set(authHeader).send({}).expect(200);
    await request(app).post(`/api/stitching/issues/${issueId}/start`).set(authHeader).send({}).expect(200);
    await request(app)
      .post(`/api/stitching/issues/${issueId}/daily-output`)
      .set(authHeader)
      .send({ outputDate: '2026-09-30', skuOutputs: [{ colorId: null, sizeId: sizeIds.S, goodQty: 0, defectQty: 2 }] })
      .expect(200);
    await request(app).post(`/api/stitching/issues/${issueId}/complete`).set(authHeader).send({}).expect(200);

    const slip = await request(app)
      .post(`/api/stitching/issues/${issueId}/generate-transfer-slip`)
      .set(authHeader)
      .send({});
    expect(slip.status).toBe(400);
    expect(slip.body.message).toMatch(/no good pieces/);

    // Size-wise does not keep it "idle" waiting for a slip that can never exist
    const summary = await request(app).get('/api/stitching/style-size-summary').set(authHeader).expect(200);
    const run = (summary.body.data as Array<{ workOrderId: string; daysPendingPush: number | null }>).find(
      (r) => r.workOrderId === workOrderId
    );
    expect(run?.daysPendingPush ?? null).toBeNull();
  });
});

describe('a cutting batch reaches stitching on several slips, never more than it cut', () => {
  let batchId: string;
  const contractorIds: string[] = [];

  beforeAll(async () => {
    const lot = await prisma.fabric_stock.findFirstOrThrow({ select: { id: true } });
    batchId = (
      await prisma.cutting_batches.create({
        data: {
          batchNumber: `${RUN}-CB`,
          workOrderId,
          cuttingDate: new Date(),
          fabricStockId: lot.id,
          actualFabricWidth: 52,
          cadAverageUsed: 1,
          cadWidthUsed: 52,
          layersPerLay: 1,
          numberOfLays: 1,
          fabricConsumed: 1,
          status: 'IN_PROGRESS',
          createdById: userId,
          skuOutputs: {
            create: [
              { colorId: null, sizeId: sizeIds.S, orderQty: 10, maxCuttable: 10, toCut: 10, cutQty: 10, goodPcs: 10 },
              { colorId: null, sizeId: sizeIds.M, orderQty: 6, maxCuttable: 6, toCut: 6, cutQty: 6, goodPcs: 6 },
            ],
          },
        },
      })
    ).id;
    for (const n of [1, 2]) {
      contractorIds.push(
        (
          await prisma.suppliers.create({
            data: {
              code: `${RUN}-CT${n}`,
              name: `${RUN} Tailor ${n}`,
              supplierCategories: ['STITCHING_CONTRACTOR'],
              createdById: userId,
            },
          })
        ).id
      );
    }
  });

  afterAll(async () => {
    await prisma.transfer_slips.updateMany({ where: { cuttingBatchId: batchId }, data: { issuedToId: null } });
    await prisma.suppliers.deleteMany({ where: { id: { in: onlyAll(contractorIds) } } });
  });

  const issue = (issuedToId: string, rows: Array<[string, number]>) =>
    request(app)
      .post(`/api/cutting/batches/${batchId}/issue-to-stitching`)
      .set(authHeader)
      .send({
        issuedToId,
        // a blank colour sent as undefined (omitted) is the same colour as null
        skuOutputs: rows.map(([size, quantity]) => ({ sizeId: sizeIds[size], quantity })),
      });

  it('two contractors each get part of the batch while it is cut', async () => {
    const first = await issue(contractorIds[0], [['S', 4]]);
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 201 });
    const second = await issue(contractorIds[1], [
      ['S', 3],
      ['M', 2],
    ]);
    expect({ status: second.status, body: second.body }).toMatchObject({ status: 201 });

    const over = await issue(contractorIds[1], [['S', 4]]);
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/S: 4 asked, only 3 left/);
  });

  it('Generate Transfer Slip sends the rest once the batch is completed, then nothing is left', async () => {
    await prisma.cutting_batches.update({ where: { id: batchId }, data: { status: 'COMPLETED' } });
    const listed = await request(app).get('/api/cutting/batches').query({ workOrderId }).set(authHeader).expect(200);
    expect(
      (listed.body.data as Array<{ id: string; piecesLeftToStitching: number }>).find((b) => b.id === batchId)
    ).toMatchObject({ piecesLeftToStitching: 7 });

    const rest = await request(app)
      .post(`/api/cutting/batches/${batchId}/generate-transfer-slip`)
      .set(authHeader)
      .send({})
      .expect(200);
    const slip = await prisma.transfer_slips.findUniqueOrThrow({
      where: { id: rest.body.data.transferSlipId },
      include: { skuBreakdown: true },
    });
    expect(slip.totalGoodPieces).toBe(7);
    expect(slip.skuBreakdown.map((s) => [s.sizeId, s.quantity]).sort()).toEqual(
      [
        [sizeIds.S, 3],
        [sizeIds.M, 4],
      ].sort()
    );

    const again = await request(app)
      .post(`/api/cutting/batches/${batchId}/generate-transfer-slip`)
      .set(authHeader)
      .send({});
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already on a slip to stitching/);

    const total = await prisma.transfer_slip_skus.aggregate({
      where: { transferSlip: { cuttingBatchId: batchId } },
      _sum: { quantity: true },
    });
    expect(total._sum.quantity).toBe(16); // exactly the batch's good pieces
  });
});

describe('a finishing issue uses up its stitching slip', () => {
  let slipId: string;
  let firstId: string;

  const pending = async () => {
    const res = await request(app).get('/api/finishing/available-transfer-slips').set(authHeader).expect(200);
    return (res.body.data as Array<{ id: string; totalGoodPieces: number; sentPieces: number }>).find(
      (s) => s.id === slipId
    );
  };
  const create = (rows: Array<[string, number]>) =>
    request(app)
      .post('/api/finishing/issues')
      .set(authHeader)
      .send({
        workOrderId,
        issueDate: '2026-09-30',
        transferSlipIds: [slipId],
        skuBreakdown: rows.map(([size, qty]) => ({ colorId: null, sizeId: sizeIds[size], issuedQty: qty })),
      });

  it('issuing part of it leaves the rest pending; the same pieces cannot be issued twice', async () => {
    slipId = (
      await prisma.transfer_slips.create({
        data: {
          slipNumber: `${RUN}-TOFIN`,
          workOrderId,
          fromStage: 'STITCHING',
          toStage: 'FINISHING',
          fromDepartment: 'Stitching',
          toDepartment: 'Finishing',
          totalGoodPieces: 8,
          preparedById: userId,
          skuBreakdown: {
            create: [
              { colorId: null, sizeId: sizeIds.S, quantity: 5 },
              { colorId: null, sizeId: sizeIds.M, quantity: 3 },
            ],
          },
        },
      })
    ).id;

    const first = await create([['S', 5]]);
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 201 });
    firstId = first.body.data.id;
    expect(await pending()).toMatchObject({ totalGoodPieces: 3, sentPieces: 8 });

    const twice = await create([['S', 1]]);
    expect(twice.status).toBe(400);
    expect(twice.body.message).toMatch(/S: asked 1, only 0 left/);

    const rest = await create([['M', 3]]);
    expect({ status: rest.status, body: rest.body }).toMatchObject({ status: 201 });
    expect((await prisma.transfer_slips.findUniqueOrThrow({ where: { id: slipId } })).status).toBe('RECEIVED');
    expect(await pending()).toBeUndefined();

    // Deleting a pending issue gives its pieces back
    await request(app).delete(`/api/finishing/issues/${rest.body.data.id}`).set(authHeader).expect(200);
    expect(await pending()).toMatchObject({ totalGoodPieces: 3 });
  });

  it('Receive records what the issue took from the slip, and leaves the slip open', async () => {
    await request(app).post(`/api/finishing/issues/${firstId}/receive`).set(authHeader).send({}).expect(200);
    const receipt = await prisma.stage_receipts.findFirstOrThrow({
      where: { transferSlipId: slipId, stage: 'FINISHING' },
      include: { skuReceipts: true },
    });
    expect(receipt.hasDeviation).toBe(false);
    expect(receipt.skuReceipts).toEqual([
      expect.objectContaining({ sizeId: sizeIds.S, expectedQty: 5, receivedQty: 5 }),
    ]);
    expect((await prisma.transfer_slips.findUniqueOrThrow({ where: { id: slipId } })).status).toBe('CREATED');
  });
});

describe('Create Work Order points to an order still waiting for its run', () => {
  let orderId: string;

  afterAll(async () => {
    await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  });

  it('lists the style’s open orders with no production run', async () => {
    const customer = await prisma.customers.findFirstOrThrow({ select: { id: true } });
    orderId = randomUUID();
    await prisma.orders.create({
      data: {
        id: orderId,
        orderNumber: `${RUN}ORD`,
        customerId: customer.id,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 12,
        totalAmount: 120,
        createdById: userId,
        order_items: {
          create: { id: randomUUID(), styleId, totalQuantity: 12, unitPrice: 10, totalPrice: 120 },
        },
      },
    });
    const res = await request(app).get('/api/orders/waiting-for-run').query({ styleId }).set(authHeader).expect(200);
    expect(res.body.data).toEqual([expect.objectContaining({ orderId, orderNumber: `${RUN}ORD`, quantity: 12 })]);
  });
});
