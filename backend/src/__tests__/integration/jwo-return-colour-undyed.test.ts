/**
 * One colour of a job comes back UNDYED (2026-10-03, owner): DJ-EBEW-002-001 sent Red, Black and Teal greige to one
 * dyer; Teal can come back undyed while Red and Black are dyed. The colour leaves the job — its greige goes back on
 * the lot with an inward challan, its order goes back to "needs processing", and it counts in neither the bill nor
 * the dyer's loss. The last colour out finishing a job short asks first.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { createJobWorkOrderWithLines, type JwoLineInput } from '../../services/helpers/jwo-lines.helper';
import { createChallan } from '../../services/challan.service';

const RUN = `RCU${Date.now().toString(36).toUpperCase()}`;
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
const returnUndyed = (jobId: string, body: Record<string, unknown>) =>
  request(app)
    .post(`/api/job-work-orders/${jobId}/return-unprocessed`)
    .set(authHeader)
    .send({ returnDate: '2026-09-21', ...body });
const lotAvailable = async () =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityAvailable);

/** A dyeing job at the processor with one line per colour, each serving one requirement */
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
        jwoStatus: 'AT_PROCESSOR',
        greigeStockLotId: lotId,
        sentDate: new Date('2026-09-05T00:00:00Z'),
        createdById: userId,
      },
      lines
    )
  );
  jobIds.push(job.id);
  // The greige went out on an outward challan, as an issue writes it
  const outward = await createChallan({
    challanType: 'OUTWARD',
    challanDate: new Date('2026-09-05T00:00:00Z'),
    fromType: 'WAREHOUSE',
    fromId: warehouseId,
    fromName: `${RUN} Warehouse`,
    toType: 'VENDOR',
    toId: dyerId,
    toName: `${RUN} Dyer`,
    jobWorkOrderId: job.id,
    issuedById: userId,
    unit: 'METER',
    items: [
      {
        itemType: 'GREIGE',
        greigeStockId: lotId,
        description: 'Greige sent',
        quantity: colours.reduce((sum, c) => sum + c.sent, 0),
        unit: 'METER',
        jobWorkOrderId: job.id,
      },
    ],
  });
  await prisma.challans.update({ where: { id: outward.id }, data: { status: 'ISSUED' } });
  const rows = await prisma.job_work_order_lines.findMany({
    where: { jobWorkOrderId: job.id },
    include: { requirementLinks: true },
    orderBy: { lineNo: 'asc' },
  });
  return { jobId: job.id, lines: rows };
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
  // Everything this file's jobs send went out of this lot already
  lotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 0,
        quantityConsumed: 3000,
        greigeWidth: 63,
        receivedDate: new Date('2026-09-01T00:00:00Z'),
        purchaseCost: 50,
        weightedAvgCost: 50,
        warehouseId,
        createdById: userId,
      },
    })
  ).id;
  await syncStockLevelQuantity(await ensureMaterialRecord(greigeId, 'GREIGE'), 0, warehouseId, 'METER');
});

afterAll(async () => {
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jobIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: [...grnIds, ...jobIds] } } });
  const challanIds = (
    await prisma.challans.findMany({ where: { jobWorkOrderId: { in: jobIds } }, select: { id: true } })
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
  await prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: { in: jobIds } } });
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

describe('one colour of a job comes back undyed', () => {
  let jobId: string;
  let red: { id: string; reqId: string };
  let black: { id: string; reqId: string };
  let teal: { id: string; reqId: string };

  beforeAll(async () => {
    const raised = await raiseJob('A', [
      { colour: 'Red', sent: 1000, expected: 900 },
      { colour: 'Black', sent: 500, expected: 450 },
      { colour: 'Teal', sent: 500, expected: 450 },
    ]);
    jobId = raised.jobId;
    [red, black, teal] = raised.lines.map((l) => ({ id: l.id, reqId: l.requirementLinks[0].requirementId }));
  });

  it('Teal back undyed: greige on the lot, inward challan for Teal, its order back to needs processing, out of the bill', async () => {
    const before = await lotAvailable();
    const res = await returnUndyed(jobId, { lineId: teal.id, returnedQty: 500, remarks: 'shade cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.data.jobClosed).toBe(false);

    expect(await lotAvailable()).toBe(before + 500);
    const tealLine = await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: teal.id } });
    expect(tealLine.closedHow).toBe('RETURNED');
    expect(Number(tealLine.qtyReturned)).toBe(500);

    const challan = await prisma.challans.findFirstOrThrow({
      where: { id: res.body.data.inwardChallanId },
      include: { items: true },
    });
    expect(challan.challanType).toBe('INWARD');
    expect(challan.items).toHaveLength(1);
    expect(challan.items[0].jobWorkOrderLineId).toBe(teal.id);
    expect(Number(challan.items[0].quantity)).toBe(500);

    // Teal's order is free for a new job; Red's and Black's stay on this one
    expect(await prisma.requirement_jwo_links.count({ where: { requirementId: teal.reqId } })).toBe(0);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: teal.reqId } })).status).toBe(
      'PO_REQUIRED'
    );
    expect(await prisma.requirement_jwo_links.count({ where: { jobWorkOrderId: jobId } })).toBe(2);

    // The job still went out with all 2,000 m, but now expects back only Red + Black
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('AT_PROCESSOR');
    expect(Number(job.qtySentMeters)).toBe(2000);
    expect(Number(job.qtyBillable)).toBe(1350);
  });

  it('a returned colour takes no receipt, and cannot come back twice', async () => {
    const receipt = await receive(jobId, { lineId: teal.id, qtyReceivedMeters: 100, isFinal: false });
    expect(receipt.status).toBe(422);
    expect(receipt.body.message).toMatch(/came back unprocessed/);
    const again = await returnUndyed(jobId, { lineId: teal.id, returnedQty: 10 });
    expect(again.status).toBe(422);
    expect(again.body.message).toMatch(/already finished/);
  });

  it('the whole-job return is refused once a colour came back on its own', async () => {
    const res = await returnUndyed(jobId, { returnedQty: 100 });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/colour by colour/);
  });

  it('Red and Black in full: the job closes with no loss for the Teal greige that came back', async () => {
    expect((await receive(jobId, { lineId: red.id, qtyReceivedMeters: 900, isFinal: true })).status).toBe(201);
    const blackIn = await receive(jobId, { lineId: black.id, qtyReceivedMeters: 450, isFinal: true });
    expect(blackIn.status).toBe(201);

    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(job.qtyAbnormalLoss ?? 0)).toBe(0);
    // shrinkage on the 1,500 m really dyed, not the 2,000 m sent
    expect(Number(job.actualShrinkage)).toBeCloseTo(10, 1);
  });

  it('a colour already received cannot come back undyed', async () => {
    const res = await returnUndyed(jobId, { lineId: red.id, returnedQty: 10 });
    expect(res.status).toBe(422);
  });
});

describe('the last colour out coming back undyed finishes the job', () => {
  it('asks first when the colours that came back are short, then finishes it on what was dyed', async () => {
    const { jobId, lines } = await raiseJob('B', [
      { colour: 'Navy', sent: 500, expected: 450 },
      { colour: 'Olive', sent: 500, expected: 450 },
    ]);
    const [navy, olive] = lines;
    // Navy's final delivery is well short (300 of 450) — the job is not finishing yet, so no question
    expect((await receive(jobId, { lineId: navy.id, qtyReceivedMeters: 300, isFinal: true })).status).toBe(201);

    const asked = await returnUndyed(jobId, { lineId: olive.id, returnedQty: 500 });
    expect(asked.status).toBe(422);
    expect(asked.body.details.reason).toBe('SHORT_CLOSE_UNCONFIRMED');
    expect((await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: olive.id } })).closedAt).toBeNull();

    const confirmed = await returnUndyed(jobId, { lineId: olive.id, returnedQty: 500, shortCloseConfirmed: true });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.jobClosed).toBe(true);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('STOCK_UPDATED');
    // loss judged on Navy alone: 450 expected, 300 back
    expect(Number(job.qtyAbnormalLoss)).toBeGreaterThan(0);
    expect(Number(job.qtyBillable)).toBe(450);
  });

  it('every colour back undyed cancels the job, nothing received', async () => {
    const { jobId, lines } = await raiseJob('C', [
      { colour: 'Pink', sent: 200, expected: 180 },
      { colour: 'Grey', sent: 200, expected: 180 },
    ]);
    expect((await returnUndyed(jobId, { lineId: lines[0].id, returnedQty: 200 })).status).toBe(200);
    const last = await returnUndyed(jobId, { lineId: lines[1].id, returnedQty: 200 });
    expect(last.status).toBe(200);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.jwoStatus).toBe('CANCELLED');
    expect(await prisma.requirement_jwo_links.count({ where: { jobWorkOrderId: jobId } })).toBe(0);
  });
});
