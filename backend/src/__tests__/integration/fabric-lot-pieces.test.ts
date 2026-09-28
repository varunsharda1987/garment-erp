/**
 * A dyed / printed fabric lot keeps its rolls & thans, and cutting picks them (2026-09-28,
 * plans/fabric-lot-rolls-thans.md). Walks the real endpoints:
 *
 *  1. Receive from processor — Roll-wise with Roll No. tags at L=98: the receipt keeps the tags and the lot
 *     lists ROLL pieces (source RECEIPT, linked to the receipt piece, the lot's fold 98). Than-wise without
 *     tags gives THAN pieces; Total Meters gives none (NO_LIST).
 *  2. Record rolls & thans on a no-list lot (±1% of on hand, else PIECES_OFF_LOT) and Check rolls & thans
 *     (keep what is on the rack, drop the rest, add what is not listed) — neither moves the lot's metres.
 *  3. Issue to cutting with the page's payload (lots[].details): the picks go CONSUMED with an issue row
 *     naming the challan, its line and the batch; the lot drops by the picks' ACTUAL metres; the challan
 *     print lists them. A whole lot without details takes its whole list; a part quantity without details
 *     marks nothing and the list reads OUT_OF_STEP.
 *  4. Back from cutting: deleting a batch restores exactly the pieces it took (rows stamped, never deleted);
 *     completion brings the ticked rolls back whole and the rest of the typed metres as ONE end piece, and
 *     refuses rolls ticked for more than the metres returned.
 *  5. Adjust Stock that empties a lot takes its whole list; a job-work receipt whose pieces went out cannot
 *     be reversed.
 *
 * Tests run on the LIVE DB: every fixture is tagged with RUN and removed by id. Nothing posts {}.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { buildChallanDocData } from '../../services/document-data/challan.doc-data';

const RUN = `FLP${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

const GREIGE_QTY = 5000;
const SEND_QTY = 1000;
const SENT_ON = new Date('2026-09-01T00:00:00Z');
const RECEIVED_ON = '2026-09-20';

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let greigeLotId: string;
let styleId: string;
let workOrderId: string;
const jwo: Record<'A' | 'B' | 'C' | 'D', string> = { A: '', B: '', C: '', D: '' };
const lot: Record<'A' | 'B' | 'C' | 'D', string> = { A: '', B: '', C: '', D: '' };
const batchIds: string[] = [];

const receive = (jwoId: string, body: Record<string, unknown>) =>
  request(app)
    .post('/api/grn/jwo/receive')
    .set(authHeader)
    .send({
      jobWorkOrderId: jwoId,
      receivedDate: RECEIVED_ON,
      warehouseId,
      invoiceToFollow: true,
      // One delivery of several: the job stays receivable and no short close is asked about
      isFinal: false,
      ...body,
    });
const receiptOf = (jwoId: string) =>
  prisma.goods_receiving_notes.findFirstOrThrow({
    where: { jobWorkOrderId: jwoId },
    include: {
      grn_items: { include: { grn_item_details: { orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }] } } },
    },
  });
const lotOf = async (jwoId: string) => {
  const grn = await receiptOf(jwoId);
  return prisma.fabric_stock.findFirstOrThrow({ where: { grnItemId: grn.grn_items[0].id } });
};
const piecesOf = (lotId: string) =>
  prisma.fabric_stock_details.findMany({
    where: { fabricStockId: lotId },
    orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }],
    include: { issues: { orderBy: { issuedAt: 'asc' } } },
  });
const lotQty = async (lotId: string) =>
  Number((await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityAvailable);
const lotView = async (lotId: string) => {
  const res = await request(app).get(`/api/stock/${lotId}/pieces`).set(authHeader);
  expect(res.status).toBe(200);
  return res.body.data;
};
const record = (lotId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/stock/${lotId}/pieces`).set(authHeader).send(body);
const makeBatch = async (fabricStockId: string, status: 'PENDING' | 'IN_PROGRESS') => {
  const b = await prisma.cutting_batches.create({
    data: {
      id: randomUUID(),
      batchNumber: `${RUN}-CB${batchIds.length + 1}`,
      workOrderId,
      fabricStockId,
      cuttingDate: new Date(),
      actualFabricWidth: 58,
      cadAverageUsed: 1.5,
      cadWidthUsed: 58,
      layersPerLay: 1,
      numberOfLays: 1,
      fabricConsumed: 0,
      status,
      createdById: userId,
    },
  });
  // The Cutting Chart plans each lot on the batch — completion accounts for the batch's own fabric rows
  await prisma.cutting_batch_fabrics.create({ data: { batchId: b.id, fabricStockId } });
  batchIds.push(b.id);
  return b;
};
const issueToCutting = async (
  batchId: string,
  lots: Array<{
    lotId: string;
    quantity: number;
    details?: Array<{ fabricStockDetailId: string; metersToIssue: number }>;
  }>
) => {
  const rows = await prisma.fabric_stock.findMany({ where: { id: { in: lots.map((l) => l.lotId) } } });
  return request(app)
    .post(`/api/work-orders/${workOrderId}/issue-fabric`)
    .set(authHeader)
    .send({
      cuttingBatchId: batchId,
      // Exactly what FabricIssuanceSection posts: one line per lot, the picks when the lot has a list
      lots: lots.map((l) => ({
        fabricStockId: l.lotId,
        fabricId: rows.find((r) => r.id === l.lotId)!.fabricId,
        quantity: l.quantity,
        description: `${RUN} issue`,
        ...(l.details ? { details: l.details } : {}),
      })),
    });
};

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
        greigeWidth: 58,
        createdById: userId,
      },
    })
  ).id;
  greigeLotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: GREIGE_QTY,
        greigeWidth: 58,
        receivedDate: SENT_ON,
        purchaseCost: 40,
        weightedAvgCost: 40,
        warehouseId,
        sourceType: 'MANUAL',
        createdById: userId,
      },
    })
  ).id;
  const greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, GREIGE_QTY, warehouseId, 'METER');

  // Four dyeing jobs, each sent 1,000 m — one per lot below
  for (const key of ['A', 'B', 'C', 'D'] as const) {
    const created = await request(app)
      .post('/api/job-work-orders')
      .set(authHeader)
      .send({
        processType: 'DYEING',
        processorId: dyerId,
        quantity: SEND_QTY,
        agreedRate: 20,
        expectedShrinkage: 10,
        colorName: `Navy ${key}`,
      });
    if (created.status !== 201) throw new Error(`JWO create failed: ${JSON.stringify(created.body)}`);
    jwo[key] = created.body.data.id;
    const issued = await request(app)
      .post(`/api/job-work-orders/${jwo[key]}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: greigeLotId, qty: SEND_QTY }] });
    if (issued.status !== 200) throw new Error(`JWO issue failed: ${JSON.stringify(issued.body)}`);
    await prisma.job_work_orders.update({ where: { id: jwo[key] }, data: { sentDate: SENT_ON } });
  }

  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  workOrderId = (
    await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: `${RUN}-WO`,
        styleId,
        status: 'IN_PRODUCTION',
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 20 * 86400000),
        totalQuantity: 200,
        createdById: userId,
      },
    })
  ).id;
});

afterAll(async () => {
  // Per-step teardown by id, never one wrapping try/catch
  const jwoIds = Object.values(jwo).filter(Boolean);
  const fabricLotIds = (
    await prisma.fabric_stock.findMany({
      where: {
        OR: [{ id: { in: Object.values(lot).filter(Boolean) } }, { fabricMaster: { greigeId: only(greigeId) } }],
      },
      select: { id: true },
    })
  ).map((l) => l.id);
  await prisma.fabric_issue_details.deleteMany({ where: { piece: { fabricStockId: { in: fabricLotIds } } } });
  await prisma.fabric_stock_details.deleteMany({ where: { fabricStockId: { in: fabricLotIds } } });

  const challanIds = (
    await prisma.challans.findMany({
      where: {
        OR: [{ productionRunId: only(workOrderId) }, { jobWorkOrderId: { in: jwoIds } }, { toId: only(dyerId) }],
      },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.cutting_batches.updateMany({
    where: { workOrderId: only(workOrderId) },
    data: { returnChallanId: null },
  });
  await prisma.job_work_orders.updateMany({
    where: { id: { in: jwoIds } },
    data: { outwardChallanId: null, inwardChallanId: null },
  });
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.fabric_stock_allocation.deleteMany({ where: { cuttingBatchId: { in: batchIds } } });
  await prisma.cutting_batches.deleteMany({ where: { workOrderId: only(workOrderId) } });
  await prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });

  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: [...grnIds, ...fabricLotIds] } } });
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.greige_issue_details.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });

  const mintedIds = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLotIds } } });
  const matWhere = { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] };
  await prisma.stock_movements.deleteMany({ where: { materials: matWhere } });
  await prisma.stock_levels.deleteMany({ where: { materials: matWhere } });
  await prisma.materials.deleteMany({ where: matWhere });
  await prisma.fabric_master.deleteMany({ where: { id: { in: mintedIds } } });

  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(greigeLotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(greigeLotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe("a dyed fabric lot's rolls & thans", () => {
  it('Receive from processor, Roll-wise with Roll No. tags at L=98: the receipt and the lot keep them', async () => {
    const res = await receive(jwo.A, {
      entryMode: 'ROLL_WISE',
      foldLengthCm: 98,
      details: [1, 2, 3, 4, 5].map((i) => ({ detailType: 'ROLL', sequenceNo: i, meters: 100, thanNo: ` R-${i} ` })),
    });
    expect(res.status).toBe(201);

    const line = (await receiptOf(jwo.A)).grn_items[0];
    expect(line.entryMode).toBe('ROLL_WISE');
    expect(line.rollCount).toBe(5);
    expect(line.thanCount).toBeNull();
    expect(line.grn_item_details.map((d) => d.thanNo)).toEqual(['R-1', 'R-2', 'R-3', 'R-4', 'R-5']);
    expect(line.grn_item_details.every((d) => d.detailType === 'ROLL' && d.baleNumber === null)).toBe(true);

    const fabricLot = await lotOf(jwo.A);
    lot.A = fabricLot.id;
    expect(Number(fabricLot.quantityAvailable)).toBe(490); // 500 counted × 0.98
    expect(Number(fabricLot.foldLengthCm)).toBe(98);
    const pieces = await piecesOf(lot.A);
    expect(pieces).toHaveLength(5);
    expect(pieces.map((p) => p.thanNo)).toEqual(['R-1', 'R-2', 'R-3', 'R-4', 'R-5']);
    expect(pieces.every((p) => p.detailType === 'ROLL' && p.source === 'RECEIPT' && p.status === 'AVAILABLE')).toBe(
      true
    );
    expect(pieces.map((p) => p.grnItemDetailId)).toEqual(line.grn_item_details.map((d) => d.id));
    expect(pieces.every((p) => Number(p.metersRemaining) === 100)).toBe(true);

    const view = await lotView(lot.A);
    expect(view).toMatchObject({ piecesRecorded: 5, pieceKind: 'ROLL', listState: 'IN_STEP', foldLengthCm: 98 });
    expect(view.lotLabel).toContain(' · GRN');
    expect(view.details).toHaveLength(5);
  });

  it('Than-wise without tags gives THAN pieces; Total Meters gives none', async () => {
    const thans = await receive(jwo.B, {
      entryMode: 'THAN_WISE',
      foldLengthCm: 100,
      details: Array.from({ length: 10 }, (_, i) => ({ detailType: 'THAN', sequenceNo: i + 1, meters: 90 })),
    });
    expect(thans.status).toBe(201);
    lot.B = (await lotOf(jwo.B)).id;
    const pieces = await piecesOf(lot.B);
    expect(pieces).toHaveLength(10);
    expect(pieces.every((p) => p.detailType === 'THAN' && p.thanNo === null)).toBe(true);
    expect(await lotQty(lot.B)).toBe(900);

    const total = await receive(jwo.C, { entryMode: 'TOTAL_METERS', qtyReceivedMeters: 800 });
    expect(total.status).toBe(201);
    lot.C = (await lotOf(jwo.C)).id;
    expect(await piecesOf(lot.C)).toHaveLength(0);
    expect(await lotView(lot.C)).toMatchObject({ piecesRecorded: 0, listState: 'NO_LIST', totalAvailable: 800 });

    const four = await receive(jwo.D, {
      entryMode: 'THAN_WISE',
      foldLengthCm: 100,
      details: [1, 2, 3, 4].map((i) => ({ detailType: 'THAN', sequenceNo: i, meters: 100, thanNo: `T-${i}` })),
    });
    expect(four.status).toBe(201);
    lot.D = (await lotOf(jwo.D)).id;
  });

  it('Record rolls & thans on a no-list lot: within 1% only, and the metres never move', async () => {
    const off = await record(lot.C, {
      entryMode: 'THAN_WISE',
      pieces: Array.from({ length: 8 }, () => ({ meters: 90 })), // 720 vs 800 on hand
    });
    expect(off.status).toBe(422);
    expect(off.body.details?.reason).toBe('PIECES_OFF_LOT');
    expect(await piecesOf(lot.C)).toHaveLength(0);

    const ok = await record(lot.C, {
      entryMode: 'THAN_WISE',
      pieces: Array.from({ length: 8 }, (_, i) => ({ meters: 100, thanNo: `C-${i + 1}` })),
    });
    expect(ok.status).toBe(201);
    expect(ok.body.message).toMatch(/^8 thans recorded on /);
    const pieces = await piecesOf(lot.C);
    expect(pieces).toHaveLength(8);
    expect(pieces.every((p) => p.source === 'COUNT' && p.status === 'AVAILABLE')).toBe(true);
    expect(await lotQty(lot.C)).toBe(800);
    expect(await prisma.fabric_stock_transaction.count({ where: { stockId: lot.C } })).toBe(0);
    expect(await lotView(lot.C)).toMatchObject({ listState: 'IN_STEP', piecesRecorded: 8 });
  });

  it('Check rolls & thans: keeps what is on the rack, drops the rest, adds what is not listed', async () => {
    const before = await piecesOf(lot.B);
    const refusedEmpty = await record(lot.B, { entryMode: 'THAN_WISE', keepPieceIds: [], pieces: [] });
    expect(refusedEmpty.status).toBe(400);

    const offBy = await record(lot.B, { entryMode: 'THAN_WISE', keepPieceIds: before.slice(0, 5).map((p) => p.id) });
    expect(offBy.status).toBe(422); // 450 vs 900
    expect(offBy.body.details?.reason).toBe('PIECES_OFF_LOT');

    const checked = await record(lot.B, {
      entryMode: 'THAN_WISE',
      keepPieceIds: before.slice(0, 8).map((p) => p.id),
      pieces: [{ meters: 180, thanNo: 'B-NEW' }],
    });
    expect(checked.status).toBe(201);
    expect(checked.body.message).toBe('List checked — 8 kept, 2 not on the rack, 1 added');
    const after = await piecesOf(lot.B);
    const dropped = after.filter((p) => p.status === 'CONSUMED');
    expect(dropped.map((p) => p.id).sort()).toEqual(
      before
        .slice(8)
        .map((p) => p.id)
        .sort()
    );
    expect(
      dropped.every((p) => /^Not on the rack at the count of /.test(p.remarks ?? '') && p.issues.length === 0)
    ).toBe(true);
    const added = after.filter((p) => p.source === 'COUNT');
    expect(added).toHaveLength(1);
    expect(added[0].sequenceNo).toBe(11); // numbered past the receipt's ten
    expect(await lotQty(lot.B)).toBe(900);
    expect(await lotView(lot.B)).toMatchObject({ listState: 'IN_STEP' });
  });

  describe('issue to cutting and back', () => {
    let batch1: string;
    let issueChallanId: string;

    it("the page's picks go to cutting: CONSUMED, one issue row each, the lot down by their ACTUAL metres", async () => {
      batch1 = (await makeBatch(lot.A, 'PENDING')).id;
      const [r1, r2] = await piecesOf(lot.A);
      const res = await issueToCutting(batch1, [
        {
          lotId: lot.A,
          quantity: 999, // a wrong screen figure: the server takes the quantity from the picks
          details: [
            { fabricStockDetailId: r1.id, metersToIssue: 100 },
            { fabricStockDetailId: r2.id, metersToIssue: 100 },
          ],
        },
      ]);
      expect(res.status).toBe(201);
      issueChallanId = res.body.data.id;
      expect(await lotQty(lot.A)).toBe(294); // 490 − 200 counted × 0.98
      const line = await prisma.challan_items.findFirstOrThrow({ where: { challanId: issueChallanId } });
      expect(Number(line.quantity)).toBe(196);

      const pieces = await piecesOf(lot.A);
      const out = pieces.filter((p) => p.status === 'CONSUMED');
      expect(out.map((p) => p.thanNo)).toEqual(['R-1', 'R-2']);
      for (const p of out) {
        expect(p.issues).toHaveLength(1);
        expect(p.issues[0]).toMatchObject({
          challanId: issueChallanId,
          challanItemId: line.id,
          cuttingBatchId: batch1,
          returnedAt: null,
        });
        expect(Number(p.issues[0].metersIssued)).toBe(100);
      }
      expect(await lotView(lot.A)).toMatchObject({ listState: 'IN_STEP' });

      const doc = await buildChallanDocData(issueChallanId);
      expect(doc.thanListLabels).toMatchObject({ pieceNo: 'Roll No. (tag metres)', total: 'Rolls despatched' });
      expect(doc.thanList).toHaveLength(1);
      expect(doc.thanList![0].thans).toBe('R-1 (100.00), R-2 (100.00)');
      expect(doc.thanListTotal?.actualNote).toContain('= 196.00 m actual');
    });

    it('refuses picks the lot no longer lists', async () => {
      const [r1] = await piecesOf(lot.A);
      const res = await issueToCutting(batch1, [
        { lotId: lot.A, quantity: 98, details: [{ fabricStockDetailId: r1.id, metersToIssue: 100 }] },
      ]);
      expect(res.status).toBe(422);
      expect(res.body.details?.reason).toBe('PIECE_NOT_ON_LOT');
      expect(await lotQty(lot.A)).toBe(294);
    });

    it('deleting the batch puts back exactly the rolls it took; the rows are stamped, not deleted', async () => {
      const res = await request(app).delete(`/api/cutting/batches/${batch1}`).set(authHeader);
      expect(res.status).toBe(200);
      expect(await lotQty(lot.A)).toBe(490);
      const pieces = await piecesOf(lot.A);
      expect(pieces.every((p) => p.status === 'AVAILABLE' && Number(p.metersRemaining) === 100)).toBe(true);
      const rows = pieces.flatMap((p) => p.issues);
      expect(rows).toHaveLength(2);
      const back = await prisma.challans.findFirstOrThrow({
        where: { productionRunId: workOrderId, fromName: 'Cutting' },
      });
      for (const r of rows) {
        expect(r.returnChallanId).toBe(back.id);
        expect(r.returnedAt).not.toBeNull();
        expect(Number(r.metersReturned)).toBe(100);
      }
      expect(await lotView(lot.A)).toMatchObject({ listState: 'IN_STEP' });
      const doc = await buildChallanDocData(back.id);
      expect(doc.thanListLabels?.total).toBe('Rolls returned');
    });

    it('a whole lot issued without picks takes its whole list; a part quantity marks nothing', async () => {
      const batch2 = (await makeBatch(lot.D, 'PENDING')).id;
      const whole = await issueToCutting(batch2, [{ lotId: lot.D, quantity: 400 }]);
      expect(whole.status).toBe(201);
      expect(await lotQty(lot.D)).toBe(0);
      const pieces = await piecesOf(lot.D);
      expect(pieces.every((p) => p.status === 'CONSUMED' && p.issues.length === 1)).toBe(true);
      expect(pieces.every((p) => p.issues[0].cuttingBatchId === batch2)).toBe(true);

      // A part of a lot, for a batch planned from it (a batch takes only the fabrics it cuts)
      const batchC = (await makeBatch(lot.C, 'PENDING')).id;
      const part = await issueToCutting(batchC, [{ lotId: lot.C, quantity: 300 }]);
      expect(part.status).toBe(201);
      expect(await lotQty(lot.C)).toBe(500);
      const c = await piecesOf(lot.C);
      expect(c.every((p) => p.status === 'AVAILABLE' && p.issues.length === 0)).toBe(true);
      expect(await lotView(lot.C)).toMatchObject({ listState: 'OUT_OF_STEP', listActual: 800, totalAvailable: 500 });
    });

    describe('cutting completion', () => {
      let batch3: string;
      let batch3Number: string;

      beforeAll(async () => {
        const b = await makeBatch(lot.A, 'IN_PROGRESS');
        batch3 = b.id;
        batch3Number = b.batchNumber;
        const [r1, r2, r3] = await piecesOf(lot.A);
        const res = await issueToCutting(batch3, [
          {
            lotId: lot.A,
            quantity: 294,
            details: [r1, r2, r3].map((p) => ({ fabricStockDetailId: p.id, metersToIssue: 100 })),
          },
        ]);
        expect(res.status).toBe(201);
        expect(await lotQty(lot.A)).toBe(196);
      });

      it('refuses rolls ticked as back whole for more than the metres returned — nothing comes back', async () => {
        const [r1, r2] = await piecesOf(lot.A);
        const res = await request(app)
          .post(`/api/cutting/batches/${batch3}/complete`)
          .set(authHeader)
          .send({ fabricReturns: [{ fabricStockId: lot.A, returnedQuantity: 100, wholePieceIds: [r1.id, r2.id] }] });
        expect(res.status).toBe(422);
        expect(res.body.details?.reason).toBe('PIECES_EXCEED_RETURN');
        expect(await lotQty(lot.A)).toBe(196);
        expect((await prisma.cutting_batches.findUniqueOrThrow({ where: { id: batch3 } })).status).toBe('IN_PROGRESS');
      });

      it('2 rolls back whole + 37.5 m more: both rolls restored, one 37.5 m end piece', async () => {
        const [r1, r2] = await piecesOf(lot.A);
        const res = await request(app)
          .post(`/api/cutting/batches/${batch3}/complete`)
          .set(authHeader)
          .send({
            fabricReturns: [{ fabricStockId: lot.A, returnedQuantity: 196 + 37.5, wholePieceIds: [r1.id, r2.id] }],
          });
        expect(res.status).toBe(200);
        expect(await lotQty(lot.A)).toBe(429.5);
        const pieces = await piecesOf(lot.A);
        expect(pieces.find((p) => p.id === r1.id)).toMatchObject({ status: 'AVAILABLE' });
        expect(pieces.find((p) => p.id === r2.id)).toMatchObject({ status: 'AVAILABLE' });
        const r3 = pieces.find((p) => p.thanNo === 'R-3')!;
        expect(r3.status).toBe('CONSUMED'); // cut
        expect(r3.issues[0].returnedAt).toBeNull();
        const ends = pieces.filter((p) => p.source === 'END');
        expect(ends).toHaveLength(1);
        expect(ends[0]).toMatchObject({ detailType: 'ROLL', status: 'AVAILABLE', remarks: `End from ${batch3Number}` });
        expect(Number(ends[0].meters)).toBe(38.27); // 37.5 actual at fold 98
        expect(await lotView(lot.A)).toMatchObject({ listState: 'IN_STEP' });

        const batch = await prisma.cutting_batches.findUniqueOrThrow({ where: { id: batch3 } });
        const doc = await buildChallanDocData(batch.returnChallanId!);
        const printed = doc.thanList!.map((l) => l.thans).join(' | ');
        expect(printed).toContain('R-1 (100.00)');
        expect(printed).toContain('End (38.27) (end)');
      });

      it('metres only, nothing ticked (the usual case): one end piece of those metres', async () => {
        const b = await makeBatch(lot.B, 'IN_PROGRESS');
        const issued = await issueToCutting(b.id, [{ lotId: lot.B, quantity: 900 }]);
        expect(issued.status).toBe(201);
        expect(await lotQty(lot.B)).toBe(0);
        const res = await request(app)
          .post(`/api/cutting/batches/${b.id}/complete`)
          .set(authHeader)
          .send({ fabricReturns: [{ fabricStockId: lot.B, returnedQuantity: 120 }] });
        expect(res.status).toBe(200);
        expect(await lotQty(lot.B)).toBe(120);
        const left = (await piecesOf(lot.B)).filter((p) => p.status !== 'CONSUMED');
        expect(left).toHaveLength(1);
        expect(left[0]).toMatchObject({ source: 'END', detailType: 'THAN', remarks: `End from ${b.batchNumber}` });
        expect(Number(left[0].meters)).toBe(120);
      });
    });
  });

  it('Adjust Stock that empties a lot takes its whole list, with the lot write and ledger row', async () => {
    const res = await request(app)
      .post('/api/stock/adjust')
      .set(authHeader)
      .send({ stockId: lot.C, adjustmentType: 'DECREASE', quantity: 500, reason: 'DAMAGED' });
    expect(res.status).toBe(200);
    expect(await lotQty(lot.C)).toBe(0);
    const pieces = await piecesOf(lot.C);
    expect(pieces.every((p) => p.status === 'CONSUMED' && p.issues.length === 1)).toBe(true);
    expect(pieces.every((p) => p.issues[0].challanId === null && p.issues[0].cuttingBatchId === null)).toBe(true);
    expect(
      await prisma.fabric_stock_transaction.count({ where: { stockId: lot.C, transactionType: 'ADJUSTMENT_OUT' } })
    ).toBe(1);
    expect(await lotView(lot.C)).toMatchObject({ listState: 'IN_STEP' });
  });

  it('a job-work receipt whose rolls went out cannot be reversed', async () => {
    const grn = await receiptOf(jwo.A);
    const res = await request(app)
      .patch(`/api/grn/${grn.id}/reverse`)
      .set(authHeader)
      .send({ reason: `${RUN} reversal attempt` });
    expect(res.status).toBe(422);
    expect(res.body.details?.reason).toBe('GRN_LOT_ALREADY_USED');
    expect(await prisma.fabric_stock.count({ where: { id: lot.A } })).toBe(1);
  });
});
