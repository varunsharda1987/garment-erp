/**
 * A dyed / printed fabric lot's rolls & thans beyond cutting — embroidery and smocking (2026-09-28,
 * plans/fabric-lot-rolls-thans.md Phase 2). Walks the real endpoints on a lot of five 100 m rolls:
 *
 *  1. Embroidery job from the lot, Issue dialog picks (POST /job-work-orders/:id/issue `fabricDetails`): the lot
 *     gives up what the named rolls come to, each goes CONSUMED with an issue row naming the job and its
 *     outward challan; picks more than 1% away from the order are refused and nothing moves.
 *  2. A job issued by quantity leaves the list out of step; "Record rolls sent" names them afterwards
 *     (GET fabric-piece-record / POST record-fabric-pieces) without moving the lot again — dated when the job
 *     took its cloth, refused beyond what it took (+1%) and for a piece listed after it left.
 *  3. A cancelled job whose cloth comes back to stock (dispose-inventory RETURNED_TO_STOCK) puts exactly its
 *     rolls back on the rack.
 *  4. Smocking send-out from the lot with picks: the quantity sent is what they come to, the challan line
 *     names the lot, a part roll stays PARTIAL; cancelling the send-out restores them.
 *
 * Tests run on the LIVE DB: every fixture is tagged with RUN and removed by id. Nothing posts {}.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { externalProcessService } from '../../services/external-process.service';

const RUN = `FLD${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

const ROLLS = 5;
const ROLL_METRES = 100;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let vendorId: string;
let fabricId: string;
let lotId: string;
let styleId: string;
let workOrderId: string;
const jobIds: string[] = [];

const piecesOf = () =>
  prisma.fabric_stock_details.findMany({
    where: { fabricStockId: lotId },
    orderBy: { sequenceNo: 'asc' },
    include: { issues: { orderBy: { issuedAt: 'asc' } } },
  });
const roll = async (n: number) => (await piecesOf()).find((p) => p.thanNo === `R-${n}`)!;
const lotQty = async () =>
  Number((await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityAvailable);
const lotView = async () => {
  const res = await request(app).get(`/api/stock/${lotId}/pieces`).set(authHeader);
  expect(res.status).toBe(200);
  return res.body.data;
};
const createJob = async (processType: 'EMBROIDERY' | 'SMOCKING', quantity: number) => {
  const res = await request(app)
    .post('/api/job-work-orders')
    .set(authHeader)
    .send({
      processType,
      processorId: vendorId,
      quantity,
      agreedRate: 5,
      ...(processType === 'EMBROIDERY' ? { fabricStockLotId: lotId } : {}),
    });
  if (res.status !== 201) throw new Error(`JWO create failed: ${JSON.stringify(res.body)}`);
  jobIds.push(res.body.data.id);
  return res.body.data.id as string;
};
const issue = (jobId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/job-work-orders/${jobId}/issue`).set(authHeader).send(body);

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
  vendorId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-EMB`,
        name: `${RUN} Embroiderer`,
        supplierCategories: ['EMBROIDERY'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  fabricId = (
    await prisma.fabric_master.create({
      data: { fabricCode: `${RUN}-FAB`, fabricName: `${RUN} Dyed Poplin`, createdById: userId },
    })
  ).id;
  lotId = (
    await prisma.fabric_stock.create({
      data: {
        fabricId,
        finishedWidth: 58,
        cutableWidth: 56,
        quantityAvailable: ROLLS * ROLL_METRES,
        weightedAvgCost: 60,
        purchaseCost: 60,
        receivedDate: new Date('2026-09-20T00:00:00Z'),
        warehouseId,
        createdById: userId,
      },
    })
  ).id;
  const materialId = await ensureMaterialRecord(fabricId, 'FABRIC');
  await syncStockLevelQuantity(materialId, ROLLS * ROLL_METRES, warehouseId, 'METER');
  // Five 100 m rolls, counted on the lot (no fold)
  await prisma.fabric_stock_details.createMany({
    data: Array.from({ length: ROLLS }, (_, i) => ({
      fabricStockId: lotId,
      sequenceNo: i + 1,
      meters: ROLL_METRES,
      metersRemaining: ROLL_METRES,
      detailType: 'ROLL',
      source: 'COUNT',
      thanNo: `R-${i + 1}`,
    })),
  });

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
        totalQuantity: 100,
        createdById: userId,
      },
    })
  ).id;
});

afterAll(async () => {
  // Per-step teardown by id, never one wrapping try/catch
  await prisma.fabric_issue_details.deleteMany({ where: { piece: { fabricStockId: only(lotId) } } });
  await prisma.fabric_stock_details.deleteMany({ where: { fabricStockId: only(lotId) } });

  await prisma.external_process_send_outs.deleteMany({ where: { jobWorkOrderId: { in: jobIds } } });
  const challanIds = (
    await prisma.challans.findMany({
      where: {
        OR: [{ jobWorkOrderId: { in: jobIds } }, { productionRunId: only(workOrderId) }, { toId: only(vendorId) }],
      },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.job_work_orders.updateMany({
    where: { id: { in: jobIds } },
    data: { outwardChallanId: null, inwardChallanId: null },
  });
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jobIds } } });
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: [...jobIds, only(lotId)] } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.production_tracking.deleteMany({ where: { workOrderId: only(workOrderId) } });
  await prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });

  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.fabric_stock.deleteMany({ where: { id: only(lotId) } });
  const matWhere = { fabricId: only(fabricId) };
  await prisma.stock_movements.deleteMany({ where: { materials: matWhere } });
  await prisma.stock_levels.deleteMany({ where: { materials: matWhere } });
  await prisma.materials.deleteMany({ where: matWhere });
  await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(vendorId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
});

describe("a fabric lot's rolls & thans — embroidery and smocking", () => {
  let pickedJob: string;
  let quantityJob: string;

  it('refuses picks more than 1% away from the order — nothing moves', async () => {
    pickedJob = await createJob('EMBROIDERY', 200);
    const [r1, r2] = [await roll(1), await roll(2)];
    const res = await issue(pickedJob, {
      fabricDetails: [
        { fabricStockDetailId: r1.id, metersToIssue: 100 },
        { fabricStockDetailId: r2.id, metersToIssue: 50 },
      ],
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LOT_QTY_MISMATCH');
    expect(await lotQty()).toBe(500);
    expect((await piecesOf()).every((p) => p.status === 'AVAILABLE' && p.issues.length === 0)).toBe(true);
  });

  it('Issue dialog picks: the lot gives up what the named rolls come to, each issued to the job on its challan', async () => {
    const [r1, r2] = [await roll(1), await roll(2)];
    const res = await issue(pickedJob, {
      fabricDetails: [
        { fabricStockDetailId: r1.id, metersToIssue: 100 },
        { fabricStockDetailId: r2.id, metersToIssue: 100 },
      ],
    });
    expect(res.status).toBe(200);
    expect(await lotQty()).toBe(300);
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: pickedJob } });
    expect(job.outwardChallanId).toBeTruthy();
    for (const n of [1, 2]) {
      const p = await roll(n);
      expect(p).toMatchObject({ status: 'CONSUMED' });
      expect(Number(p.metersRemaining)).toBe(0);
      expect(p.issues).toHaveLength(1);
      expect(p.issues[0]).toMatchObject({ jobWorkOrderId: pickedJob, challanId: job.outwardChallanId });
    }
    expect(await lotView()).toMatchObject({ listState: 'IN_STEP', listActual: 300, totalAvailable: 300 });

    // Named in full at issue: nothing is left to record against this job
    const status = await request(app).get(`/api/job-work-orders/${pickedJob}/fabric-piece-record`).set(authHeader);
    expect(status.status).toBe(200);
    expect(status.body.data.lot).toMatchObject({ takenActual: 200, recordedActual: 200, lotHasPieces: true });
  });

  it('a job issued by quantity leaves the list out of step; Record rolls sent names them without moving the lot', async () => {
    quantityJob = await createJob('EMBROIDERY', 100);
    const res = await issue(quantityJob, { vehicleNumber: `${RUN}-TRUCK` });
    expect(res.status).toBe(200);
    expect(await lotQty()).toBe(200);
    expect((await roll(3)).status).toBe('AVAILABLE');
    expect(await lotView()).toMatchObject({ listState: 'OUT_OF_STEP', listActual: 300, totalAvailable: 200 });

    const before = await request(app).get(`/api/job-work-orders/${quantityJob}/fabric-piece-record`).set(authHeader);
    expect(before.status).toBe(200);
    expect(before.body.data.lot).toMatchObject({
      fabricStockLotId: lotId,
      takenActual: 100,
      recordedActual: 0,
      lotHasPieces: true,
      piecesLeft: 3,
      pieceKind: 'ROLL',
    });

    const r3 = await roll(3);
    const recorded = await request(app)
      .post(`/api/job-work-orders/${quantityJob}/record-fabric-pieces`)
      .set(authHeader)
      .send({ details: [{ fabricStockDetailId: r3.id, metersToIssue: 100 }] });
    expect(recorded.status).toBe(200);
    expect(recorded.body.data.lot).toMatchObject({ recordedActual: 100 });
    expect(await lotQty()).toBe(200); // the metres already moved at issue
    const after = await roll(3);
    expect(after.status).toBe('CONSUMED');
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: quantityJob } });
    const draw = await prisma.fabric_stock_transaction.findFirstOrThrow({
      where: { stockId: lotId, transactionType: 'EMBROIDERY_SEND_OUT', referenceId: quantityJob },
    });
    expect(after.issues[0]).toMatchObject({ jobWorkOrderId: quantityJob, challanId: job.outwardChallanId });
    expect(after.issues[0].issuedAt.getTime()).toBe(draw.transactionDate.getTime());
    expect(await lotView()).toMatchObject({ listState: 'IN_STEP' });
  });

  it('refuses recording beyond what the job took, and a roll listed after it left', async () => {
    const r4 = await roll(4);
    const over = await request(app)
      .post(`/api/job-work-orders/${quantityJob}/record-fabric-pieces`)
      .set(authHeader)
      .send({ details: [{ fabricStockDetailId: r4.id, metersToIssue: 100 }] });
    expect(over.status).toBe(422);
    expect(over.body.code).toBe('THAN_RECORD_INVALID');
    expect((await roll(4)).status).toBe('AVAILABLE');

    // A roll counted after the job took its cloth was still on the rack
    const late = await prisma.fabric_stock_details.create({
      data: {
        fabricStockId: lotId,
        sequenceNo: ROLLS + 1,
        meters: 1,
        metersRemaining: 1,
        detailType: 'ROLL',
        source: 'COUNT',
        thanNo: `R-${ROLLS + 1}`,
      },
    });
    const refused = await request(app)
      .post(`/api/job-work-orders/${quantityJob}/record-fabric-pieces`)
      .set(authHeader)
      .send({ details: [{ fabricStockDetailId: late.id, metersToIssue: 1 }] });
    expect(refused.status).toBe(422);
    expect(refused.body.message).toMatch(/after .* took its cloth/);
    await prisma.fabric_stock_details.delete({ where: { id: late.id } });
  });

  it('a cancelled job whose cloth comes back to stock puts exactly its rolls back on the rack', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${pickedJob}/cancel`)
      .set(authHeader)
      .send({ reason: `${RUN} cancel` });
    expect(res.status).toBe(200);
    // Cancelling decides nothing about the cloth at the processor — the disposition does
    const back = await request(app)
      .post(`/api/job-work-orders/${pickedJob}/dispose-inventory`)
      .set(authHeader)
      .send({ disposition: 'RETURNED_TO_STOCK', notes: `${RUN} back to store` });
    expect(back.status).toBe(200);
    expect(await lotQty()).toBe(400);
    for (const n of [1, 2]) {
      const p = await roll(n);
      expect(p.status).toBe('AVAILABLE');
      expect(Number(p.metersRemaining)).toBe(100);
      expect(p.issues).toHaveLength(1); // stamped, never deleted
      expect(Number(p.issues[0].metersReturned)).toBe(100);
      expect(p.issues[0].returnedAt).not.toBeNull();
    }
    expect((await roll(3)).status).toBe('CONSUMED'); // the other job's
    expect(await lotView()).toMatchObject({ listState: 'IN_STEP', listActual: 400, totalAvailable: 400 });
  });

  it('smocking send-out picks: the quantity sent is what they come to; cancel restores them', async () => {
    const smockingJob = await createJob('SMOCKING', 150);
    const [r4, r5] = [await roll(4), await roll(5)];
    const sendOut = await externalProcessService.createSendOut({
      processType: 'SMOCKING',
      sourceType: 'FABRIC_STOCK',
      workOrderId,
      fabricStockId: lotId,
      supplierId: vendorId,
      quantitySent: 999, // the picks decide it
      unit: 'METER',
      agreedRate: 3,
      sendDate: new Date(),
      jobWorkOrderId: smockingJob,
      createdById: userId,
      fabricDetails: [
        { fabricStockDetailId: r4.id, metersToIssue: 100 },
        { fabricStockDetailId: r5.id, metersToIssue: 50 },
      ],
    });
    expect(Number(sendOut.quantitySent)).toBe(150);
    expect(await lotQty()).toBe(250);
    const saved = await prisma.external_process_send_outs.findUniqueOrThrow({ where: { id: sendOut.id } });
    const line = await prisma.challan_items.findFirstOrThrow({ where: { challanId: saved.outwardChallanId! } });
    expect(line.fabricStockId).toBe(lotId);
    const [a, b] = [await roll(4), await roll(5)];
    expect(a).toMatchObject({ status: 'CONSUMED' });
    expect(b).toMatchObject({ status: 'PARTIAL' });
    expect(Number(b.metersRemaining)).toBe(50);
    expect(a.issues[0]).toMatchObject({ jobWorkOrderId: smockingJob, challanId: saved.outwardChallanId });
    expect(await lotView()).toMatchObject({ listState: 'IN_STEP', listActual: 250 });

    await externalProcessService.cancelSendOut(sendOut.id, `${RUN} cancel`, userId);
    expect(await lotQty()).toBe(400);
    const [c, d] = [await roll(4), await roll(5)];
    expect(c).toMatchObject({ status: 'AVAILABLE' });
    expect(d).toMatchObject({ status: 'AVAILABLE' });
    expect(Number(d.metersRemaining)).toBe(100);
    expect(await lotView()).toMatchObject({ listState: 'IN_STEP', listActual: 400 });
  });
});
