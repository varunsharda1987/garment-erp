/**
 * A greige lot's bale / than / roll list after the fact, and every issue screen offering it (2026-09-28).
 *
 * The owner issued PJ-ESSKY082LS-001 from GRG-0039 — a lot received as Total Meters, so it had no pieces
 * and no screen could offer a choice. This walks the real endpoints:
 *
 *  1. A lot with no list says so (available-details: piecesRecorded 0).
 *  2. "Record bales & thans" lists what is on hand: numbers past the lot's own, no stock moved, refused when
 *     more than 1% off the lot or while the lot still lists pieces; roll-wise pieces are ROLLs.
 *  3. The guard: pieces counted AFTER a job took its cloth can never be recorded against that job; a job
 *     issued after the count can.
 *  4. Send to Mill (dyeing and printing) takes named pieces the Issue dialog's way — or goes by quantity.
 *     The challan's packing list says Thans for thans and Rolls for rolls.
 *
 * Tests run on the LIVE DB: every fixture is tagged with RUN and removed by id.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { buildChallanDocData } from '../../services/document-data/challan.doc-data';

const RUN = `GLP${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

const FOLD = 98; // cm — actual = counted × 0.98
const LOT_A = 1078; // 11 thans of 100 counted = 1,100 counted × 0.98
const LOT_B = 500; // rolls, no fold
const LOT_C = 200; // an old list, used up

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let lotA: string;
let lotB: string;
let lotC: string;
const lotIds = () => [lotA, lotB, lotC].filter(Boolean);

const createJwo = async (quantity: number, processType: 'DYEING' | 'PRINTING' = 'DYEING') => {
  const res = await request(app)
    .post('/api/job-work-orders')
    .set(authHeader)
    .send({
      processType,
      processorId: dyerId,
      quantity,
      agreedRate: 20,
      expectedShrinkage: 10,
      colorName: 'Navy',
      ...(processType === 'PRINTING' ? { printingType: 'PIGMENT' } : {}),
    });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
};
const issueByQty = async (jwoId: string, lotId: string, qty: number) => {
  const res = await request(app)
    .post(`/api/job-work-orders/${jwoId}/issue`)
    .set(authHeader)
    .send({ lots: [{ greigeStockLotId: lotId, qty }] });
  expect(res.status).toBe(200);
};
const recordPieces = (lotId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/greige/stock/${lotId}/pieces`).set(authHeader).send(body);
const pieces = (lotId: string) =>
  prisma.greige_stock_details.findMany({
    where: { greigeStockId: lotId },
    orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }],
  });
const lotQty = async (lotId: string) =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityAvailable);
const makeLot = async (quantity: number, foldLengthCm: number | null) =>
  (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: quantity,
        greigeWidth: 48,
        foldLengthCm,
        receivedDate: new Date(),
        purchaseCost: 50,
        weightedAvgCost: 50,
        warehouseId,
        sourceType: 'MANUAL',
        createdById: userId,
      },
    })
  ).id;

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
        greigeName: `${RUN} Poplin`,
        genericGreigeName: `${RUN} Poplin`,
        composition: '100% Cotton',
        greigeWidth: 48,
        createdById: userId,
      },
    })
  ).id;

  lotA = await makeLot(LOT_A, FOLD);
  lotB = await makeLot(LOT_B, null);
  lotC = await makeLot(LOT_C, null);
  // Lot C once had a list, all of it gone: bale 3, than 5 — a count must number past it
  await prisma.greige_stock_details.create({
    data: {
      greigeStockId: lotC,
      baleNumber: 3,
      sequenceNo: 5,
      meters: 50,
      metersRemaining: 0,
      status: 'CONSUMED',
    },
  });

  const materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(materialId, LOT_A + LOT_B + LOT_C, warehouseId, 'METER');
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
  const pieceIds = (
    await prisma.greige_stock_details.findMany({ where: { greigeStockId: { in: lotIds() } }, select: { id: true } })
  ).map((p) => p.id);
  await prisma.greige_issue_details.deleteMany({ where: { greigeStockDetailId: { in: pieceIds } } });
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
  await prisma.audit_logs.deleteMany({ where: { entityType: 'GREIGE', entityId: { in: lotIds() } } });
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds() } } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: lotIds() } } });
  await prisma.greige_stock.deleteMany({ where: { id: { in: lotIds() } } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe("a greige lot's bale / than / roll list", () => {
  let jobBeforeCount: string;

  it('says plainly when a lot has no list', async () => {
    const res = await request(app).get(`/api/greige/stock/${lotA}/available-details`).set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ piecesRecorded: 0, pieceKind: null, receipt: null, sourceType: 'MANUAL' });
    expect(res.body.data.details).toHaveLength(0);
  });

  it('refuses a count more than 1% off the lot, and writes nothing', async () => {
    // A job takes one than's worth by quantity BEFORE the count — 980 m actual stays on the rack
    jobBeforeCount = await createJwo(98);
    await issueByQty(jobBeforeCount, lotA, 98);
    expect(await lotQty(lotA)).toBe(980);

    const off = await recordPieces(lotA, {
      entryMode: 'THAN_WISE',
      pieces: Array.from({ length: 10 }, () => ({ meters: 90 })), // 900 counted = 882 actual — 10% short
    });
    expect(off.status).toBe(422);
    expect(off.body.message).toContain('980');
    expect(off.body.message).toContain('Adjust Stock');
    expect(await prisma.greige_stock_details.count({ where: { greigeStockId: lotA } })).toBe(0);
  });

  it("lists the pieces on hand bale-wise — the lot's metres and ledger untouched", async () => {
    const ledgerBefore = await prisma.greige_stock_transaction.count({ where: { stockId: lotA } });
    const res = await recordPieces(lotA, {
      entryMode: 'BALE_WISE',
      pieces: [
        ...Array.from({ length: 5 }, (_, i) => ({ baleNumber: 1, baleNo: i === 0 ? '417' : '', meters: 100 })),
        ...Array.from({ length: 5 }, (_, i) => ({ baleNumber: 2, baleNo: '418', thanNo: `T-${i + 1}`, meters: '100' })),
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ recorded: 10, bales: 2, detailType: 'THAN', actualTotal: 980 });

    const rows = await pieces(lotA);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.status === 'AVAILABLE' && r.detailType === 'THAN')).toBe(true);
    expect(rows.filter((r) => r.baleNumber === 1).every((r) => r.baleNo === '417')).toBe(true); // bale's own label
    expect(rows.filter((r) => r.baleNumber === 2).map((r) => r.sequenceNo)).toEqual([1, 2, 3, 4, 5]);

    const lot = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotA } });
    expect(Number(lot.quantityAvailable)).toBe(980); // no stock moved
    expect(lot).toMatchObject({ thanCount: 10, baleCount: 2 });
    expect(await prisma.greige_stock_transaction.count({ where: { stockId: lotA } })).toBe(ledgerBefore);

    const details = await request(app).get(`/api/greige/stock/${lotA}/available-details`).set(authHeader);
    expect(details.body.data).toMatchObject({ piecesRecorded: 10, pieceKind: 'THAN' });
    expect(details.body.data.details[0]).toMatchObject({ detailType: 'THAN' });
  });

  it('refuses a second count while the lot still lists pieces', async () => {
    const again = await recordPieces(lotA, { entryMode: 'THAN_WISE', pieces: [{ meters: 100 }] });
    expect(again.status).toBe(422);
    expect(again.body.message).toContain('already lists 10 thans');
  });

  it('never lets a job that left before the count claim counted pieces', async () => {
    const status = await request(app).get(`/api/job-work-orders/${jobBeforeCount}/than-record`).set(authHeader);
    expect(status.status).toBe(200);
    expect(status.body.data.lots[0]).toMatchObject({ takenActual: 98, lotHasThans: false });

    const [first] = await pieces(lotA);
    const claim = await request(app)
      .post(`/api/job-work-orders/${jobBeforeCount}/record-thans`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotA, details: [{ greigeStockDetailId: first.id, metersToIssue: 100 }] }] });
    expect(claim.status).toBe(422);
    expect(claim.body.message).toContain('had no bale / than / roll list');
    expect((await prisma.greige_stock_details.findUniqueOrThrow({ where: { id: first.id } })).status).toBe('AVAILABLE');
  });

  it('lets a job issued after the count record those pieces', async () => {
    const jobAfter = await createJwo(98);
    await issueByQty(jobAfter, lotA, 98);
    const status = await request(app).get(`/api/job-work-orders/${jobAfter}/than-record`).set(authHeader);
    expect(status.body.data.lots[0]).toMatchObject({ lotHasThans: true, pieceKind: 'THAN' });

    const [first] = await pieces(lotA);
    const recorded = await request(app)
      .post(`/api/job-work-orders/${jobAfter}/record-thans`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotA, details: [{ greigeStockDetailId: first.id, metersToIssue: 100 }] }] });
    expect(recorded.status).toBe(200);
    expect((await prisma.greige_stock_details.findUniqueOrThrow({ where: { id: first.id } })).status).toBe('CONSUMED');
  });

  it('Send to Mill (dyeing) takes named thans the Issue dialog way, and the challan lists them as thans', async () => {
    const job = await createJwo(196); // two whole thans: 200 counted × 0.98
    const available = (await pieces(lotA)).filter((p) => p.status === 'AVAILABLE');
    const before = await lotQty(lotA);
    const sent = await request(app)
      .post(`/api/dyeing/process-pos/${job}/send`)
      .set(authHeader)
      .send({
        greigeStockLotId: lotA,
        details: available.slice(0, 2).map((p) => ({ greigeStockDetailId: p.id, metersToIssue: 100 })),
      });
    expect(sent.status).toBe(200);
    expect(await lotQty(lotA)).toBe(before - 196);

    const jwo = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: job } });
    const issued = await prisma.greige_issue_details.findMany({ where: { jobWorkOrderId: job } });
    expect(issued).toHaveLength(2);
    expect(issued.every((r) => r.challanId === jwo.outwardChallanId)).toBe(true);

    const doc = await buildChallanDocData(jwo.outwardChallanId!);
    expect(doc.thanListLabels).toMatchObject({ count: 'Thans', total: 'Thans despatched' });
    expect(doc.thanListTotal!.count).toBe(2);
  });

  it('lists a roll-wise count as rolls (0.8% off is allowed) and prints them as rolls', async () => {
    const res = await recordPieces(lotB, {
      entryMode: 'ROLL_WISE',
      pieces: [100, 100, 100, 100, 96].map((meters, i) => ({ thanNo: `R-${i + 1}`, meters })), // 496 of 500
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ recorded: 5, detailType: 'ROLL' });
    const rows = await pieces(lotB);
    expect(rows.every((r) => r.detailType === 'ROLL' && r.baleNumber === null)).toBe(true);
    const lot = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotB } });
    expect(lot.thanCount).toBeNull();

    const job = await createJwo(200, 'PRINTING');
    const sent = await request(app)
      .post(`/api/printing/process-pos/${job}/send`)
      .set(authHeader)
      .send({
        greigeStockLotId: lotB,
        details: rows.slice(0, 2).map((p) => ({ greigeStockDetailId: p.id, metersToIssue: 100 })),
      });
    expect(sent.status).toBe(200);
    const jwo = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: job } });
    const doc = await buildChallanDocData(jwo.outwardChallanId!);
    expect(doc.thanListLabels).toMatchObject({ pieceNo: 'Roll No. (tag metres)', total: 'Rolls despatched' });
    expect(doc.thanList).toHaveLength(1);
    expect(doc.thanList![0]).toMatchObject({ bale: 'Rolls', count: 2 });
    expect(doc.thanList![0].thans).toContain('R-1');
  });

  it('Send to Mill without pieces still goes by quantity', async () => {
    const job = await createJwo(100);
    const before = await lotQty(lotB);
    const sent = await request(app)
      .post(`/api/dyeing/process-pos/${job}/send`)
      .set(authHeader)
      .send({ greigeStockLotId: lotB });
    expect(sent.status).toBe(200);
    expect(await lotQty(lotB)).toBe(before - 100);
    expect(await prisma.greige_issue_details.count({ where: { jobWorkOrderId: job } })).toBe(0);
  });

  it("numbers a count past the lot's old, used-up list", async () => {
    const res = await recordPieces(lotC, {
      entryMode: 'BALE_WISE',
      pieces: [
        { baleNumber: 1, meters: 100 },
        { baleNumber: 1, meters: 100 },
      ],
    });
    expect(res.status).toBe(201);
    const fresh = (await pieces(lotC)).filter((p) => p.status === 'AVAILABLE');
    expect(fresh.map((p) => p.baleNumber)).toEqual([4, 4]); // past the old bale 3
    expect(fresh.map((p) => p.sequenceNo)).toEqual([1, 2]);
  });
});
