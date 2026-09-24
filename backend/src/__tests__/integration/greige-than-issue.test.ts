/**
 * Issuing greige to a processor THAN BY THAN (2026-09-24).
 *
 * The picker and the "issue with details" endpoint were built in August but never switched on — and
 * the endpoint refused every call (the controller read `lotsWithDetails`, the schema says `lots`). So
 * DJ-KMC-002/003 left their lot by quantity and all 109 thans still read AVAILABLE. This walks the
 * real endpoints on a lot at fold length 98 (than tags are COUNTED metres; lot and job are ACTUAL):
 *
 *  1. Issue naming thans: the thans are consumed and recorded against the job and its challan.
 *  2. A job issued by quantity can name its thans afterwards (no second stock movement), but not
 *     more than it took.
 *  3. Cancelling a job (returned to stock) gives its thans back.
 *  4. One truck, two jobs, one lot: allowed when each names different thans.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { buildChallanDocData } from '../../services/document-data/challan.doc-data';

const RUN = `GTI${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

const FOLD = 98; // cm — actual = counted × 0.98
const THAN_COUNTED = 100; // every than is tagged 100 m → 98 m actual
const THANS = 6; // 2 bales × 3 thans
const LOT_ACTUAL = THANS * THAN_COUNTED * (FOLD / 100); // 588

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let lotId: string;
let thanIds: string[] = [];

const createJwo = async (quantity: number) => {
  const res = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    quantity,
    agreedRate: 20,
    expectedShrinkage: 10,
    colorName: 'Navy',
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
};
const than = (i: number) => prisma.greige_stock_details.findUniqueOrThrow({ where: { id: thanIds[i] } });
const lotAvailable = async () =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityAvailable);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const warehouse = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Warehouse`,
      warehouseType: 'RAW_MATERIAL',
      isActive: true,
      createdById: userId,
    },
  });
  warehouseId = warehouse.id;
  const dyer = await prisma.suppliers.create({
    data: {
      code: `${RUN}-DYE`,
      name: `${RUN} Dyer`,
      supplierCategories: ['DYEING_PRINTING'],
      isActive: true,
      createdById: userId,
    },
  });
  dyerId = dyer.id;
  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GG`,
      greigeName: `${RUN} Poplin`,
      genericGreigeName: `${RUN} Poplin`,
      composition: '100% Cotton',
      greigeWidth: 48,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const lot = await prisma.greige_stock.create({
    data: {
      greigeId,
      quantityAvailable: LOT_ACTUAL,
      greigeWidth: 48,
      foldLengthCm: FOLD,
      thanCount: THANS,
      baleCount: 2,
      receivedDate: new Date(),
      purchaseCost: 50,
      weightedAvgCost: 50,
      warehouseId,
      createdById: userId,
    },
  });
  lotId = lot.id;
  for (let i = 0; i < THANS; i++) {
    const row = await prisma.greige_stock_details.create({
      data: {
        greigeStockId: lotId,
        baleNumber: i < 3 ? 1 : 2,
        sequenceNo: (i % 3) + 1,
        baleNo: i < 3 ? '417' : '418',
        thanNo: `T-${1000 + i}`,
        meters: THAN_COUNTED,
        metersRemaining: THAN_COUNTED,
        status: 'AVAILABLE',
      },
    });
    thanIds.push(row.id);
  }
  const materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(materialId, LOT_ACTUAL, warehouseId, 'METER');
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jwoIds } }, { toId: only(dyerId) }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.greige_issue_details.deleteMany({ where: { greigeStockDetailId: { in: thanIds } } });
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.updateMany({ where: { id: { in: jwoIds } }, data: { outwardChallanId: null } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  const minted = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  const matWhere = { OR: [{ fabricId: { in: minted } }, { greigeId: only(greigeId) }] };
  await prisma.stock_movements.deleteMany({ where: { materials: matWhere } });
  await prisma.stock_levels.deleteMany({ where: { materials: matWhere } });
  await prisma.materials.deleteMany({ where: matWhere });
  await prisma.fabric_master.deleteMany({ where: { id: { in: minted } } });
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('issuing greige than by than', () => {
  let namedJob: string;

  it('issues named thans: the thans are consumed and recorded against the job and challan', async () => {
    namedJob = await createJwo(196); // two whole thans: 200 counted × 0.98
    const res = await request(app)
      .post(`/api/job-work-orders/${namedJob}/issue-with-details`)
      .set(authHeader)
      .send({
        lots: [
          {
            greigeStockLotId: lotId,
            details: [
              { greigeStockDetailId: thanIds[0], metersToIssue: 100 },
              { greigeStockDetailId: thanIds[1], metersToIssue: 100 },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);

    expect(await lotAvailable()).toBe(LOT_ACTUAL - 196);
    for (const i of [0, 1]) {
      const t = await than(i);
      expect(t.status).toBe('CONSUMED');
      expect(Number(t.metersRemaining)).toBe(0);
    }
    const jwo = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: namedJob } });
    const issued = await prisma.greige_issue_details.findMany({ where: { jobWorkOrderId: namedJob } });
    expect(issued).toHaveLength(2);
    expect(issued.every((r) => r.challanId === jwo.outwardChallanId)).toBe(true);

    // The printed challan carries a packing list: the thans by bale, with their printed numbers
    const doc = await buildChallanDocData(jwo.outwardChallanId!);
    expect(doc.thanList).toHaveLength(1);
    expect(doc.thanList![0]).toMatchObject({ bale: '417', count: 2 });
    expect(doc.thanList![0].thans).toContain('T-1000');
    expect(doc.thanListTotal!.count).toBe(2);
  });

  it('lets a job issued by quantity name its thans afterwards, never more than it took', async () => {
    const qtyJob = await createJwo(98); // one than's worth
    const issued = await request(app)
      .post(`/api/job-work-orders/${qtyJob}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: 98 }] });
    expect(issued.status).toBe(200);
    expect((await than(2)).status).toBe('AVAILABLE'); // issue by quantity names no than
    const afterIssue = await lotAvailable();

    const before = await request(app).get(`/api/job-work-orders/${qtyJob}/than-record`).set(authHeader);
    expect(before.status).toBe(200);
    expect(before.body.data.lots[0]).toMatchObject({ takenActual: 98, recordedActual: 0, lotHasThans: true });

    const recorded = await request(app)
      .post(`/api/job-work-orders/${qtyJob}/record-thans`)
      .set(authHeader)
      .send({
        lots: [{ greigeStockLotId: lotId, details: [{ greigeStockDetailId: thanIds[2], metersToIssue: 100 }] }],
      });
    expect(recorded.status).toBe(200);
    expect((await than(2)).status).toBe('CONSUMED');
    expect(await lotAvailable()).toBe(afterIssue); // naming thans moves no stock
    expect(recorded.body.data.lots[0]).toMatchObject({ takenActual: 98, recordedActual: 98 });

    const over = await request(app)
      .post(`/api/job-work-orders/${qtyJob}/record-thans`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, details: [{ greigeStockDetailId: thanIds[3], metersToIssue: 50 }] }] });
    expect(over.status).toBe(422);
    expect((await than(3)).status).toBe('AVAILABLE');
  });

  it('gives a cancelled job its thans back', async () => {
    const cancelled = await request(app)
      .post(`/api/job-work-orders/${namedJob}/cancel`)
      .set(authHeader)
      .send({ reason: 'Shade not approved' });
    expect(cancelled.status).toBe(200);
    const disposed = await request(app)
      .post(`/api/job-work-orders/${namedJob}/dispose-inventory`)
      .set(authHeader)
      .send({ disposition: 'RETURNED_TO_STOCK', notes: 'Came back undyed' });
    expect(disposed.status).toBe(200);

    for (const i of [0, 1]) {
      const t = await than(i);
      expect(t.status).toBe('AVAILABLE');
      expect(Number(t.metersRemaining)).toBe(THAN_COUNTED);
    }
    expect(await prisma.greige_issue_details.count({ where: { jobWorkOrderId: namedJob } })).toBe(0);
  });

  it('dispatches two jobs from one lot on one truck when each names different thans', async () => {
    const jobA = await createJwo(49); // half of than 4: 50 counted
    const jobB = await createJwo(98); // all of than 5
    const res = await request(app)
      .post('/api/job-work-orders/dispatch')
      .set(authHeader)
      .send({
        processorId: dyerId,
        orders: [
          {
            jwoId: jobA,
            lots: [
              { greigeStockLotId: lotId, qty: 49, details: [{ greigeStockDetailId: thanIds[3], metersToIssue: 50 }] },
            ],
          },
          {
            jwoId: jobB,
            lots: [
              { greigeStockLotId: lotId, qty: 98, details: [{ greigeStockDetailId: thanIds[4], metersToIssue: 100 }] },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);

    const partial = await than(3);
    expect(partial.status).toBe('PARTIAL');
    expect(Number(partial.metersRemaining)).toBe(50);
    expect((await than(4)).status).toBe('CONSUMED');
    expect(await prisma.greige_issue_details.count({ where: { jobWorkOrderId: jobA } })).toBe(1);
    expect(await prisma.greige_issue_details.count({ where: { jobWorkOrderId: jobB } })).toBe(1);
  });

  it('records thans for two same-day jobs to one processor together, all or nothing', async () => {
    const jobC = await createJwo(98);
    const jobD = await createJwo(98);
    for (const job of [jobC, jobD]) {
      const issued = await request(app)
        .post(`/api/job-work-orders/${job}/issue`)
        .set(authHeader)
        .send({ lots: [{ greigeStockLotId: lotId, qty: 98 }] });
      expect(issued.status).toBe(200);
    }

    // Same processor, same day, same lot, thans unnamed → offered as a sibling to fit together
    const status = await request(app).get(`/api/job-work-orders/${jobC}/than-record`).set(authHeader);
    expect(status.status).toBe(200);
    expect(status.body.data.siblings).toHaveLength(1);
    expect(status.body.data.siblings[0]).toMatchObject({ jwoId: jobD });
    expect(status.body.data.siblings[0].lots[0]).toMatchObject({ greigeStockLotId: lotId, takenActual: 98 });

    const batch = (thanForD: string) =>
      request(app)
        .post('/api/job-work-orders/record-thans-batch')
        .set(authHeader)
        .send({
          jobs: [
            {
              jwoId: jobC,
              lots: [{ greigeStockLotId: lotId, details: [{ greigeStockDetailId: thanIds[0], metersToIssue: 100 }] }],
            },
            {
              jwoId: jobD,
              lots: [{ greigeStockLotId: lotId, details: [{ greigeStockDetailId: thanForD, metersToIssue: 100 }] }],
            },
          ],
        });

    // The same than on both jobs: refused, and the first job's half is rolled back too
    const clash = await batch(thanIds[0]);
    expect(clash.status).toBe(422);
    expect((await than(0)).status).toBe('AVAILABLE');
    expect(await prisma.greige_issue_details.count({ where: { jobWorkOrderId: jobC } })).toBe(0);

    const ok = await batch(thanIds[1]);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toHaveLength(2);
    expect((await than(0)).status).toBe('CONSUMED');
    expect((await than(1)).status).toBe('CONSUMED');

    const after = await request(app).get(`/api/job-work-orders/${jobC}/than-record`).set(authHeader);
    expect(after.body.data.siblings).toHaveLength(0);
  });
});
