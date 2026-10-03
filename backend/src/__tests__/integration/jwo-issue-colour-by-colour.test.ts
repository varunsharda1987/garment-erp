/**
 * Greige sent colour by colour, and a colour dropped (2026-10-03, owner): one job for Red, Black and Teal — Red's
 * greige goes first on its own challan, comes back; Black goes later on another challan; Teal is never sent and is
 * dropped, its order back to "needs processing". The job finishes on Red + Black with no loss for Teal.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { createJobWorkOrderWithLines, type JwoLineInput } from '../../services/helpers/jwo-lines.helper';

const RUN = `ICB${Date.now().toString(36).toUpperCase()}`;
const WIDTH = 55;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
const lotIds: string[] = [];
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
const issue = (jobId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/job-work-orders/${jobId}/issue`).set(authHeader).send(body);
const drop = (jobId: string, lineId: string, body: Record<string, unknown> = {}) =>
  request(app).post(`/api/job-work-orders/${jobId}/lines/${lineId}/drop`).set(authHeader).send(body);
const lotAvailable = async (id: string) =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id } })).quantityAvailable);

/** An approved dyeing job, nothing sent yet, one line per colour, each serving one requirement */
async function raiseJob(suffix: string, colours: Array<{ colour: string; sent: number; expected: number }>) {
  const greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  const lines: JwoLineInput[] = [];
  for (const c of colours) {
    const styleId = (
      await prisma.styles.create({
        data: {
          id: randomUUID(),
          styleCode: `${RUN}${suffix}${c.colour}`,
          styleName: `${RUN} ${c.colour}`,
          createdById: userId,
        },
      })
    ).id;
    styleIds.push(styleId);
    const requirementId = (
      await prisma.material_requirements.create({
        data: {
          requirementNumber: `${RUN}-${suffix}-${c.colour}`,
          source: 'MANUAL',
          requirementType: 'PROCESSING',
          materialId: greigeMaterialId,
          orderQuantity: 100,
          quantityPerUnit: 1,
          wastagePercent: 0,
          totalRequired: c.sent,
          shortfall: c.sent,
          unit: 'METER',
          status: 'PO_SENT',
          colorName: c.colour,
          requiredDate: new Date(),
          createdById: userId,
        },
      })
    ).id;
    lines.push({
      styleId,
      colorName: c.colour,
      sentWidthInches: 54,
      expectedShrinkage: 10,
      qtySent: c.sent,
      qtyExpected: c.expected,
      requirementLinks: [{ requirementId, allocatedQuantity: c.expected }],
    });
  }
  const job = await prisma.$transaction((tx) =>
    createJobWorkOrderWithLines(
      tx,
      {
        jobWorkNumber: `${RUN}-${suffix}`,
        processType: 'DYEING',
        processorId: dyerId,
        agreedRatePerMeter: 10,
        tolerancePercent: 3,
        uom: 'MTR',
        fabricType: 'GREIGE',
        jwoStatus: 'APPROVED',
        createdById: userId,
      },
      lines
    )
  );
  jobIds.push(job.id);
  const rows = await prisma.job_work_order_lines.findMany({
    where: { jobWorkOrderId: job.id },
    include: { requirementLinks: true },
    orderBy: { lineNo: 'asc' },
  });
  return { jobId: job.id, lines: rows.map((l) => ({ id: l.id, reqId: l.requirementLinks[0].requirementId })) };
}

async function greigeLot(qty: number) {
  const id = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: qty,
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
  lotIds.push(id);
  await syncStockLevelQuantity(await ensureMaterialRecord(greigeId, 'GREIGE'), qty, warehouseId, 'METER');
  return id;
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
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  await prisma.greige_stock.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.styles.deleteMany({ where: { id: { in: styleIds } } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('greige sent colour by colour, one colour dropped', () => {
  let jobId: string;
  let red: { id: string; reqId: string };
  let black: { id: string; reqId: string };
  let teal: { id: string; reqId: string };
  let lot1: string;
  let lot2: string;

  beforeAll(async () => {
    lot1 = await greigeLot(1200);
    lot2 = await greigeLot(1000);
    const raised = await raiseJob('A', [
      { colour: 'Red', sent: 1000, expected: 900 },
      { colour: 'Black', sent: 500, expected: 450 },
      { colour: 'Teal', sent: 500, expected: 450 },
    ]);
    jobId = raised.jobId;
    [red, black, teal] = raised.lines;
  });

  it("the issue preview asks for one colour's greige when a colour is named", async () => {
    const res = await request(app).get(`/api/job-work-orders/${jobId}/issue-preview?lineId=${red.id}`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.requiredQty).toBe(1000);
    expect(res.body.data.colourLabel).toMatch(/Red/);
    const whole = await request(app).get(`/api/job-work-orders/${jobId}/issue-preview`).set(authHeader);
    expect(whole.body.data.requiredQty).toBe(2000);
  });

  it('Red goes alone: its own challan, components and §143 date; the other colours stay to be sent', async () => {
    const res = await issue(jobId, {
      lineId: red.id,
      sentDate: '2026-09-05',
      lots: [{ greigeStockLotId: lot1, qty: 1000 }],
    });
    expect(res.status).toBe(200);
    expect(await lotAvailable(lot1)).toBe(200);

    const redLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: red.id } });
    expect(redLine.sentDate).not.toBeNull();
    expect(redLine.outwardChallanId).not.toBeNull();
    expect(redLine.statutoryDueDate).not.toBeNull();
    for (const other of [black, teal]) {
      expect((await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: other.id } })).sentDate).toBeNull();
    }

    const challan = await prisma.challans.findUniqueOrThrow({
      where: { id: redLine.outwardChallanId as string },
      include: { items: true },
    });
    expect(challan.status).toBe('ISSUED');
    expect(challan.items).toHaveLength(1);
    expect(challan.items[0].jobWorkOrderLineId).toBe(red.id);
    expect(Number(challan.items[0].quantity)).toBe(1000);

    const components = await prisma.job_work_order_components.findMany({ where: { jobWorkOrderId: jobId } });
    expect(components).toHaveLength(1);
    expect(components[0].lineId).toBe(red.id);
    expect(components[0].componentName).toMatch(/Red/);

    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('ISSUED');
    expect(job.sentDate).not.toBeNull();
  });

  it('Red cannot go twice; a colour not sent takes no receipt; the whole job cannot come back as one', async () => {
    const again = await issue(jobId, {
      lineId: red.id,
      sentDate: '2026-09-05',
      lots: [{ greigeStockLotId: lot1, qty: 200 }],
    });
    expect(again.status).toBe(422);
    expect(again.body.code).toBe('ALREADY_ISSUED');

    const blackReceipt = await receive(jobId, { lineId: black.id, qtyReceivedMeters: 100, isFinal: false });
    expect(blackReceipt.status).toBe(422);
    expect(blackReceipt.body.message).toMatch(/not been sent/);

    const wholeReturn = await request(app)
      .post(`/api/job-work-orders/${jobId}/return-unprocessed`)
      .set(authHeader)
      .send({ returnedQty: 100 });
    expect(wholeReturn.status).toBe(422);
    expect(wholeReturn.body.message).toMatch(/colour by colour/);
  });

  it('Red comes back in full: its own challan is received while the job waits for the rest', async () => {
    expect((await receive(jobId, { lineId: red.id, qtyReceivedMeters: 900, isFinal: true })).status).toBe(201);
    const redLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: red.id } });
    expect(
      (await prisma.challans.findUniqueOrThrow({ where: { id: redLine.outwardChallanId as string } })).status
    ).toBe('RECEIVED');
    expect((await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } })).jwoStatus).toBe(
      'PARTIALLY_RECEIVED'
    );
  });

  it('Black goes later on its own challan; the job stays part-received', async () => {
    const res = await issue(jobId, {
      lineId: black.id,
      sentDate: '2026-09-10',
      lots: [{ greigeStockLotId: lot2, qty: 500 }],
    });
    expect(res.status).toBe(200);
    const blackLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: black.id } });
    const redLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: red.id } });
    expect(blackLine.outwardChallanId).not.toBeNull();
    expect(blackLine.outwardChallanId).not.toBe(redLine.outwardChallanId);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(job.outwardChallanId).toBe(redLine.outwardChallanId);
    const components = await prisma.job_work_order_components.findMany({
      where: { jobWorkOrderId: jobId },
      orderBy: { sortOrder: 'asc' },
    });
    expect(components.map((c) => c.lineId)).toEqual([red.id, black.id]);
    expect(components[1].componentName).toMatch(/^Greige lot 2 .*Black/);
  });

  it('Close short is refused while Teal was never sent', async () => {
    const res = await request(app).post(`/api/job-work-orders/${jobId}/close-short`).set(authHeader).send({});
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Teal/);
  });

  it('a sent colour cannot be dropped; Teal can — its order goes back to needs processing', async () => {
    expect((await drop(jobId, red.id)).status).toBe(422);

    const res = await drop(jobId, teal.id, { remarks: 'buyer cancelled Teal' });
    expect(res.status).toBe(200);
    expect(res.body.data.jobClosed).toBe(false);
    const tealLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: teal.id } });
    expect(tealLine.closedHow).toBe('DROPPED');
    expect(await prisma.requirement_jwo_links.count({ where: { requirementId: teal.reqId } })).toBe(0);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: teal.reqId } })).status).toBe(
      'PO_REQUIRED'
    );
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(Number(job.qtySentMeters)).toBe(1500);
    expect(Number(job.qtyBillable)).toBe(1350);
  });

  it("Black in full finishes the job on Red + Black with no loss for Teal; Black's challan is received", async () => {
    expect((await receive(jobId, { lineId: black.id, qtyReceivedMeters: 450, isFinal: true })).status).toBe(201);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(job.qtyAbnormalLoss ?? 0)).toBe(0);
    const blackLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: black.id } });
    expect(
      (await prisma.challans.findUniqueOrThrow({ where: { id: blackLine.outwardChallanId as string } })).status
    ).toBe('RECEIVED');
  });
});

describe('dropping colours of a job never sent', () => {
  it('dropping every colour cancels the job and frees every order', async () => {
    const { jobId, lines } = await raiseJob('B', [
      { colour: 'Pink', sent: 200, expected: 180 },
      { colour: 'Grey', sent: 200, expected: 180 },
    ]);
    const first = await drop(jobId, lines[0].id);
    expect(first.status).toBe(200);
    expect(first.body.data.jobClosed).toBe(false);
    expect(Number((await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } })).qtySentMeters)).toBe(200);

    const last = await drop(jobId, lines[1].id);
    expect(last.status).toBe(200);
    expect(last.body.data.jobClosed).toBe(true);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('CANCELLED');
    expect(await prisma.requirement_jwo_links.count({ where: { jobWorkOrderId: jobId } })).toBe(0);
  });

  it('a whole-job issue sends every colour on one challan, each line stamped', async () => {
    const lot = await greigeLot(400);
    const { jobId, lines } = await raiseJob('C', [
      { colour: 'Lime', sent: 250, expected: 225 },
      { colour: 'Plum', sent: 150, expected: 135 },
    ]);
    const res = await issue(jobId, { sentDate: '2026-09-05', lots: [{ greigeStockLotId: lot, qty: 400 }] });
    expect(res.status).toBe(200);
    const rows = await prisma.job_work_order_lines.findMany({ where: { jobWorkOrderId: jobId } });
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(rows.every((l) => l.sentDate != null && l.outwardChallanId === job.outwardChallanId)).toBe(true);
    // one colour of it can no longer be dropped — it went
    expect((await drop(jobId, lines[0].id)).status).toBe(422);
  });
});
