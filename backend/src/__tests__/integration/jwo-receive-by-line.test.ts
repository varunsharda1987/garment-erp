/**
 * Receiving a job work order one colour at a time (2026-10-02).
 *
 * PJ-ESSKY090LS-002 sent one lot of greige to the printer for two styles — ESSKY090LS Brown and ESSKY092LS Red —
 * and the Receive dialog offered no way to say which one came back. A job carries one LINE per fabric it brings
 * back (job_work_order_lines); a receipt now names its line, and:
 *  - books that line's own fabric (minted per line), with the line's style and colour on the lot and receipt row;
 *  - is capped on the line's expected quantity and credits only the line's orders;
 *  - "final delivery" closes the line; the job closes (and the loss is judged on the whole job) with its last line;
 *  - a closed line takes no more; reversing its final receipt reopens it; Close short closes every open line.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { createJobWorkOrderWithLines } from '../../services/helpers/jwo-lines.helper';

const RUN = `RBL${Date.now().toString(36).toUpperCase()}`;
const WIDTH = 55;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let printerId: string;
let greigeId: string;
let lotId: string;
let styleA: string;
let styleB: string;
let redReqId: string;
let blackReqId: string;
let jobId: string;
let redLineId: string;
let blackLineId: string;
let redFinalGrnId: string;

const receive = (body: Record<string, unknown>) =>
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

const linkReceived = async (requirementId: string) =>
  Number(
    (await prisma.requirement_jwo_links.findFirstOrThrow({ where: { requirementId, jobWorkOrderId: jobId } }))
      .receivedQuantity
  );
const line = (id: string) => prisma.job_work_order_lines.findUniqueOrThrow({ where: { id } });
const job = () => prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
const requirement = (id: string) =>
  prisma.material_requirements.findUniqueOrThrow({
    where: { id },
    select: { status: true, shortQuantity: true, shortCloseReason: true },
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
  printerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-PRN`,
        name: `${RUN} Printer`,
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
        greigeName: `${RUN} Crepe`,
        genericGreigeName: `${RUN} Crepe`,
        composition: '100% Viscose',
        greigeWidth: 71,
        createdById: userId,
      },
    })
  ).id;
  lotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 0,
        quantityConsumed: 1500,
        greigeWidth: 71,
        receivedDate: new Date('2026-09-01T00:00:00Z'),
        purchaseCost: 50,
        weightedAvgCost: 50,
        warehouseId,
        createdById: userId,
      },
    })
  ).id;
  const greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, 0, warehouseId, 'METER');

  const mkStyle = async (suffix: string) =>
    (
      await prisma.styles.create({
        data: { id: randomUUID(), styleCode: `${RUN}${suffix}`, styleName: `${RUN} ${suffix}`, createdById: userId },
      })
    ).id;
  styleA = await mkStyle('A');
  styleB = await mkStyle('B');

  const mkRequirement = async (colorName: string, qty: number) =>
    (
      await prisma.material_requirements.create({
        data: {
          requirementNumber: `${RUN}-MR-${colorName}`,
          source: 'MANUAL',
          requirementType: 'PROCESSING',
          materialId: greigeMaterialId,
          orderQuantity: 100,
          quantityPerUnit: 1,
          wastagePercent: 0,
          totalRequired: qty,
          shortfall: qty,
          unit: 'METER',
          status: 'PO_SENT',
          colorName,
          requiredDate: new Date(),
          createdById: userId,
        },
      })
    ).id;
  redReqId = await mkRequirement('Red', 900);
  blackReqId = await mkRequirement('Black', 450);

  // One printing job, greige issued all at once, two fabrics back: style A in Red, style B in Black
  const created = await prisma.$transaction((tx) =>
    createJobWorkOrderWithLines(
      tx,
      {
        jobWorkNumber: `${RUN}-PJ`,
        processType: 'PRINTING',
        processorId: printerId,
        agreedRatePerMeter: 20,
        tolerancePercent: 3,
        uom: 'MTR',
        fabricType: 'GREIGE',
        jwoStatus: 'AT_PROCESSOR',
        greigeStockLotId: lotId,
        sentDate: new Date('2026-09-05T00:00:00Z'),
        createdById: userId,
      },
      [
        {
          styleId: styleA,
          colorName: 'Red',
          sentWidthInches: 54,
          expectedShrinkage: 10,
          qtySent: 1000,
          qtyExpected: 900,
          requirementLinks: [{ requirementId: redReqId, allocatedQuantity: 900 }],
        },
        {
          styleId: styleB,
          colorName: 'Black',
          sentWidthInches: 54,
          expectedShrinkage: 10,
          qtySent: 500,
          qtyExpected: 450,
          requirementLinks: [{ requirementId: blackReqId, allocatedQuantity: 450 }],
        },
      ]
    )
  );
  jobId = created.id;
  const lines = await prisma.job_work_order_lines.findMany({
    where: { jobWorkOrderId: jobId },
    orderBy: { lineNo: 'asc' },
  });
  [redLineId, blackLineId] = lines.map((l) => l.id);
});

afterAll(async () => {
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: only(jobId) }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: [...grnIds, only(jobId)] } } });
  const challanIds = (
    await prisma.challans.findMany({ where: { jobWorkOrderId: only(jobId) }, select: { id: true } })
  ).map((c) => c.id);
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
  await prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: only(jobId) } });
  await prisma.job_work_orders.deleteMany({ where: { id: only(jobId) } });
  await prisma.material_requirements.deleteMany({ where: { requirementNumber: { startsWith: RUN } } });
  const materialWhere = { OR: [{ fabricId: { in: fabricIds } }, { greigeId: only(greigeId) }] };
  await prisma.stock_movements.deleteMany({ where: { materials: materialWhere } });
  await prisma.stock_levels.deleteMany({ where: { materials: materialWhere } });
  await prisma.materials.deleteMany({ where: materialWhere });
  await prisma.style_fabrics.updateMany({ where: { fabricId: { in: fabricIds } }, data: { fabricId: null } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: fabricIds } } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.styles.deleteMany({ where: { id: { in: [only(styleA), only(styleB)] } } });
  await prisma.suppliers.deleteMany({ where: { id: only(printerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('receiving a job work order one colour at a time', () => {
  it('asks which colour a delivery is when the job brings back several — nothing is written', async () => {
    const res = await receive({ qtyReceivedMeters: 500, isFinal: false });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/2 different fabrics — choose which one this receipt is/);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: jobId } })).toBe(0);
  });

  it('a part of the Red books the Red fabric for style A and credits only the Red order', async () => {
    const res = await receive({ lineId: redLineId, qtyReceivedMeters: 500, isFinal: false });
    expect(res.status).toBe(201);

    const red = await line(redLineId);
    expect(red.finishedFabricId).toBeTruthy();
    expect(red.closedAt).toBeNull();
    const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: res.body.data.id } });
    expect(item.jobWorkOrderLineId).toBe(redLineId);
    expect(item.colorName).toBe('Red');
    const lot = await prisma.fabric_stock.findFirstOrThrow({ where: { grnItemId: item.id } });
    expect(lot.fabricId).toBe(red.finishedFabricId);
    expect(lot.originStyleId).toBe(styleA);
    expect(Number(lot.quantityAvailable)).toBe(500);

    expect(await linkReceived(redReqId)).toBe(500);
    expect(await linkReceived(blackReqId)).toBe(0);
    const j = await job();
    expect(j.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(Number(j.qtyReceivedMeters)).toBe(500);
    expect(j.receivedDate).toBeNull();
  });

  it('caps the Red on its own expected quantity, naming the colour', async () => {
    const res = await receive({ lineId: redLineId, qtyReceivedMeters: 600, isFinal: false });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(
      /of .*A Red on top of the 500\.00 MTR already received exceeds the expected fabric 900\.00/
    );
  });

  it('previews the Red line’s ceiling, and the loss split on the whole job', async () => {
    const res = await request(app)
      .get(`/api/job-work-orders/${jobId}/receive-preview`)
      .query({ qty: 900, lineId: redLineId })
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.maxReceivable).toBeGreaterThanOrEqual(900);
    expect(res.body.data.maxReceivable).toBeLessThan(1350);
    expect(res.body.data.qtyExpected).toBe(1350);
  });

  it('the final Red closes the Red line only — the job stays open for the Black, with no short-close question', async () => {
    const res = await receive({ lineId: redLineId, qtyReceivedMeters: 400, isFinal: true });
    expect(res.status).toBe(201);
    redFinalGrnId = res.body.data.id;

    const red = await line(redLineId);
    expect(red.closedHow).toBe('FINAL');
    expect(red.closingGrnItemId).toBeTruthy();
    expect((await line(blackLineId)).closedAt).toBeNull();
    const j = await job();
    expect(j.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(j.receivedDate).toBeNull();
    expect(await linkReceived(redReqId)).toBe(900);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: redReqId } })).status).toBe('RECEIVED');
  });

  it('refuses more of a closed colour', async () => {
    const res = await receive({ lineId: redLineId, qtyReceivedMeters: 10, isFinal: true });
    expect(res.status).toBe(422);
    expect(res.body.details?.reason ?? res.body.message).toMatch(/JWO_LINE_CLOSED|already closed/);
  });

  it('the last colour closes the job — short on the whole job, so it must be confirmed', async () => {
    const unconfirmed = await receive({ lineId: blackLineId, qtyReceivedMeters: 300, isFinal: true });
    expect(unconfirmed.status).toBe(422);
    expect(unconfirmed.body.details.reason).toBe('SHORT_CLOSE_UNCONFIRMED');
    expect(unconfirmed.body.details.cumulative).toBe(1200);
    expect(unconfirmed.body.details.expected).toBe(1350);

    const res = await receive({
      lineId: blackLineId,
      qtyReceivedMeters: 300,
      isFinal: true,
      shortCloseConfirmed: true,
    });
    expect(res.status).toBe(201);
    const j = await job();
    expect(j.jwoStatus).toBe('STOCK_UPDATED');
    expect(j.receivedDate).not.toBeNull();
    expect(Number(j.qtyReceivedMeters)).toBe(1200);
    expect(Number(j.qtyAbnormalLoss)).toBeGreaterThan(0);
    expect(await linkReceived(blackReqId)).toBe(300);
    expect(await linkReceived(redReqId)).toBe(900);
    // The finished Black settles its order at what came back, the 150 m gap on record — MRP no longer counts it
    // as on order. The Red came back in full: received, nothing short.
    const blackReq = await requirement(blackReqId);
    expect(blackReq.status).toBe('RECEIVED');
    expect(Number(blackReq.shortQuantity)).toBe(150);
    expect(blackReq.shortCloseReason).toMatch(/final delivery in/);
    const redReq = await requirement(redReqId);
    expect(redReq.status).toBe('RECEIVED');
    expect(redReq.shortQuantity).toBeNull();

    // Two fabrics in stock, one per style
    const black = await line(blackLineId);
    const red = await line(redLineId);
    expect(black.finishedFabricId).toBeTruthy();
    expect(black.finishedFabricId).not.toBe(red.finishedFabricId);
    const blackLots = await prisma.fabric_stock.findMany({ where: { fabricId: black.finishedFabricId! } });
    expect(blackLots.map((l) => l.originStyleId)).toEqual([styleB]);

    // The job page: each line's received worked out from its receipts
    const detail = await request(app).get(`/api/job-work-orders/${jobId}`).set(authHeader);
    const byId = Object.fromEntries(detail.body.data.lines.map((l: { id: string }) => [l.id, l]));
    expect(Number(byId[redLineId].receivedQty)).toBe(900);
    expect(Number(byId[blackLineId].receivedQty)).toBe(300);
  });

  it('reversing the Red’s final receipt reopens the Red line and takes back only the Red order’s credit', async () => {
    const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: redFinalGrnId } });
    const res = await request(app)
      .patch(`/api/grn/${redFinalGrnId}/reverse`)
      .set(authHeader)
      .send({ reason: 'test — wrong roll count' });
    expect(res.status).toBe(200);

    expect((await line(redLineId)).closedAt).toBeNull();
    expect((await line(blackLineId)).closedHow).toBe('FINAL');
    expect(await prisma.fabric_stock.count({ where: { grnItemId: item.id } })).toBe(0);
    expect(await linkReceived(redReqId)).toBe(500);
    expect(await linkReceived(blackReqId)).toBe(300);
    const j = await job();
    expect(j.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(j.receivedDate).toBeNull();
    expect(Number(j.qtyReceivedMeters)).toBe(800);
    // The Red's order is on order again; the Black — still finished — keeps its settled short
    expect((await requirement(redReqId)).status).toBe('PARTIALLY_RECEIVED');
    expect(Number((await requirement(blackReqId)).shortQuantity)).toBe(150);
  });

  it('Close short closes the colours still open and finishes the job on its total', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${jobId}/close-short`)
      .set(authHeader)
      .send({ shortCloseConfirmed: true });
    expect(res.status).toBe(200);
    expect((await line(redLineId)).closedHow).toBe('SHORT');
    expect((await line(blackLineId)).closedHow).toBe('FINAL');
    const j = await job();
    expect(j.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(j.qtyReceivedMeters)).toBe(800);
    // Nothing more is coming of the Red: its order closes at the 500 m that came, 400 m short on record
    const redReq = await requirement(redReqId);
    expect(redReq.status).toBe('RECEIVED');
    expect(Number(redReq.shortQuantity)).toBe(400);
    expect(redReq.shortCloseReason).toMatch(/closed short/);
  });
});
