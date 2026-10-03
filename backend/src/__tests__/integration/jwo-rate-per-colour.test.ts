/**
 * A rate per colour (2026-10-03, owner): one job, Red at ₹10 and Black at ₹12 — each colour billed at its own rate.
 * The job's totals are Σ colour × its rate; a colour's rate can be typed before approval (the card's kept for the
 * record); a receipt of a colour is billed at that colour's rate; the loss is valued at the rate of the colour that
 * came back short; Close settles each colour on what came back of it.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import {
  createJobWorkOrderWithLines,
  jobLossRate,
  linesProcessingValue,
  lossRateOfLines,
  type JwoLineInput,
} from '../../services/helpers/jwo-lines.helper';
import { jobWorkOrderService } from '../../services/job-work-order.service';

const RUN = `RPC${Date.now().toString(36).toUpperCase()}`;
const WIDTH = 55;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let lotId: string;
const styleIds: string[] = [];
const jobIds: string[] = [];

const receive = (jobId: string, body: Record<string, unknown>) =>
  request(app)
    .post('/api/grn/jwo/receive')
    .set(authHeader)
    .send({
      jobWorkOrderId: jobId,
      receivedWidthInches: WIDTH,
      invoiceToFollow: true,
      warehouseId,
      receivedDate: '2026-09-20',
      ...body,
    });
const setRate = (jobId: string, lineId: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/job-work-orders/${jobId}/lines/${lineId}/rate`).set(authHeader).send(body);
const subtotalOf = async (jobId: string) =>
  Number((await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } })).subtotal);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH`,
        warehouseName: `${RUN} Warehouse`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  dyerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-DYE`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: `${RUN} Slub`,
        genericGreigeName: `${RUN} Slub`,
        composition: '100% Viscose',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  lotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 1500,
        quantityConsumed: 0,
        greigeWidth: 63,
        receivedDate: new Date('2026-09-01T00:00:00Z'),
        purchaseCost: 50,
        weightedAvgCost: 50,
        warehouseId,
        createdById: userId,
      },
    })
  ).id;
  await syncStockLevelQuantity(await ensureMaterialRecord(greigeId, 'GREIGE'), 1500, warehouseId, 'METER');
});

afterAll(async () => {
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jobIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: [...grnIds, ...jobIds] } } });
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jobIds } }, { items: { some: { jobWorkOrderId: { in: jobIds } } } }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.job_work_order_lines.updateMany({
    where: { jobWorkOrderId: { in: jobIds } },
    data: { outwardChallanId: null },
  });
  await prisma.job_work_orders.updateMany({
    where: { id: { in: jobIds } },
    data: { outwardChallanId: null, inwardChallanId: null },
  });
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  const fabricIds = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  const fabricLotIds = (
    await prisma.fabric_stock.findMany({ where: { fabricId: { in: fabricIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLotIds } } });
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  await prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: { in: jobIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jobIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.material_requirements.deleteMany({ where: { requirementNumber: { startsWith: RUN } } });
  const materialWhere = { OR: [{ fabricId: { in: fabricIds } }, { greigeId: only(greigeId) }] };
  await prisma.stock_movements.deleteMany({ where: { materials: materialWhere } });
  await prisma.stock_levels.deleteMany({ where: { materials: materialWhere } });
  await prisma.materials.deleteMany({ where: materialWhere });
  await prisma.style_fabrics.updateMany({ where: { fabricId: { in: fabricIds } }, data: { fabricId: null } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: fabricIds } } });
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.styles.deleteMany({ where: { id: { in: styleIds } } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('the money rules for colours priced apart (pure)', () => {
  const lines = [
    { qtyExpected: 900, ratePerUnit: 10, closedHow: null, received: 900 },
    { qtyExpected: 450, ratePerUnit: 13, closedHow: null, received: 400 },
    { qtyExpected: 300, ratePerUnit: 20, closedHow: 'RETURNED', received: 0 },
  ];
  it('bills each colour still worked on at its own rate — expected, or on actuals once settled', () => {
    expect(linesProcessingValue(lines, { agreedRatePerMeter: 11 }, false).toNumber()).toBe(900 * 10 + 450 * 13);
    expect(linesProcessingValue(lines, { agreedRatePerMeter: 11 }, true).toNumber()).toBe(900 * 10 + 400 * 13);
  });
  it('values the loss at the rate of the colours that came back short', () => {
    expect(lossRateOfLines(lines, { agreedRatePerMeter: 11 })).toBe(13);
    // nothing short yet: weighted by what each colour expects
    const none = lines.map((l) => ({ ...l, received: 0 }));
    expect(lossRateOfLines(none, { agreedRatePerMeter: 11 })).toBe(11);
  });
});

describe('one job, Red at ₹10 and Black at ₹12', () => {
  let jobId: string;
  let red: string;
  let black: string;

  beforeAll(async () => {
    const greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
    const lines: JwoLineInput[] = [];
    for (const [colour, sent, expected, rate] of [
      ['Red', 1000, 900, 10],
      ['Black', 500, 450, 12],
    ] as const) {
      const styleId = (
        await prisma.styles.create({
          data: { id: randomUUID(), styleCode: `${RUN}${colour}`, styleName: `${RUN} ${colour}`, createdById: userId },
        })
      ).id;
      styleIds.push(styleId);
      const requirementId = (
        await prisma.material_requirements.create({
          data: {
            requirementNumber: `${RUN}-${colour}`,
            source: 'MANUAL',
            requirementType: 'PROCESSING',
            materialId: greigeMaterialId,
            orderQuantity: 100,
            quantityPerUnit: 1,
            wastagePercent: 0,
            totalRequired: sent,
            shortfall: sent,
            unit: 'METER',
            status: 'PO_SENT',
            colorName: colour,
            requiredDate: new Date(),
            createdById: userId,
          },
        })
      ).id;
      lines.push({
        styleId,
        colorName: colour,
        sentWidthInches: 54,
        expectedShrinkage: 10,
        qtySent: sent,
        qtyExpected: expected,
        ratePerUnit: rate,
        rateSource: 'RATE_CARD',
        requirementLinks: [{ requirementId, allocatedQuantity: expected }],
      });
    }
    const job = await prisma.$transaction((tx) =>
      createJobWorkOrderWithLines(
        tx,
        {
          jobWorkNumber: `${RUN}-A`,
          processType: 'DYEING',
          processorId: dyerId,
          agreedRatePerMeter: 10.67,
          tolerancePercent: 3,
          gstRate: 5,
          uom: 'MTR',
          fabricType: 'GREIGE',
          jwoStatus: 'DRAFT',
          createdById: userId,
        },
        lines
      )
    );
    jobIds.push(job.id);
    jobId = job.id;
    const rows = await prisma.job_work_order_lines.findMany({
      where: { jobWorkOrderId: jobId },
      orderBy: { lineNo: 'asc' },
    });
    [red, black] = rows.map((r) => r.id);
  });

  it('the job bills each colour at its own rate', async () => {
    await jobWorkOrderService.computeCommercialTotals(jobId);
    expect(await subtotalOf(jobId)).toBe(900 * 10 + 450 * 12);
  });

  it("a colour's rate can be typed before approval — the card's rate is kept, the totals follow", async () => {
    const res = await setRate(jobId, black, { ratePerUnit: 14, reason: 'agreed on the phone' });
    expect(res.status).toBe(200);
    const again = await setRate(jobId, black, { ratePerUnit: 13 });
    expect(again.status).toBe(200);
    const line = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: black } });
    expect(Number(line.ratePerUnit)).toBe(13);
    expect(line.rateSource).toBe('MANUAL');
    expect(Number(line.costedRatePerUnit)).toBe(12);
    expect(await subtotalOf(jobId)).toBe(900 * 10 + 450 * 13);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(Number(job.agreedRatePerMeter)).toBeCloseTo((900 * 10 + 450 * 13) / 1350, 2);
  });

  it('is refused once the job is approved', async () => {
    await prisma.job_work_orders.update({ where: { id: jobId }, data: { jwoStatus: 'APPROVED' } });
    const res = await setRate(jobId, red, { ratePerUnit: 11 });
    expect(res.status).toBe(422);
  });

  it("each colour's receipt is billed at its own rate; the loss is valued at the short colour's rate", async () => {
    const issued = await request(app)
      .post(`/api/job-work-orders/${jobId}/issue`)
      .set(authHeader)
      .send({ sentDate: '2026-09-05', lots: [{ greigeStockLotId: lotId, qty: 1500 }] });
    expect(issued.status).toBe(200);

    expect((await receive(jobId, { lineId: red, qtyReceivedMeters: 900, isFinal: true })).status).toBe(201);
    const blackIn = await receive(jobId, {
      lineId: black,
      qtyReceivedMeters: 400,
      isFinal: true,
      shortCloseConfirmed: true,
    });
    expect(blackIn.status).toBe(201);

    const rows = await prisma.grn_items.findMany({
      where: { goods_receiving_notes: { jobWorkOrderId: jobId } },
      select: { jobWorkOrderLineId: true, actualRatePerUnit: true },
    });
    const rateOf = (lineId: string) => Number(rows.find((r) => r.jobWorkOrderLineId === lineId)!.actualRatePerUnit);
    expect(rateOf(red)).toBe(10);
    expect(rateOf(black)).toBe(13);

    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(job.qtyAbnormalLoss)).toBeGreaterThan(0);
    expect(await jobLossRate(prisma, jobId, job.agreedRatePerMeter)).toBe(13);
  });

  it('Close settles each colour on what came back of it, at its own rate', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${jobId}/close`)
      .set(authHeader)
      .send({ invoiceNumber: `${RUN}-INV` });
    expect(res.status).toBe(200);
    expect(await subtotalOf(jobId)).toBe(900 * 10 + 400 * 13);
  });
});
