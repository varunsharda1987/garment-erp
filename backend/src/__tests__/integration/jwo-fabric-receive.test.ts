/**
 * Receiving dyed FABRIC back from the dyer, through the GRN door (2026-09-15).
 *
 * The fabric twin of jwo-lace-receive. It pins the two defects found in the order-system audit:
 *
 *  T0-A  A greige→fabric job has NO `fabricId` — it sent greige, not fabric — and its finished
 *        master may not exist yet (MRP defers the mint when lineage is missing at creation). GRN
 *        creation used to refuse every such job ("has no fabric reference") while approval, two
 *        hundred lines later, would have resolved `finishedFabricId` and received it fine. Both
 *        sites now call resolveOrMintJwoArrivingMaterial: the GRN item names the fabric ARRIVING,
 *        minted at creation from the greige lot's lineage and stamped on the job.
 *
 *  T0-B  When nothing is resolvable, approval used to log a warning and `return` — leaving the
 *        GRN accepted with no fabric_stock, no status update and no MRP callback, which the user
 *        saw as a successful receipt. It now throws, and creation refuses the job up front.
 *
 * Cost follows the fabric path's existing rule — processing rate + greige rate per metre — which
 * the lace suite documents as under-valuing shrunk cloth. That is a known, separate matter and is
 * deliberately NOT changed here; this suite pins what the path does today.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';

const RUN = `FRC${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let lotId: string;
let jwoId: string;
let grnId: string;
let finishedFabricId: string;
let orphanJwoId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const LOT_QTY = 1200;
const SEND_QTY = 1000;
const RECEIVE_QTY = 900; // 1,000 sent at 10% shrinkage
const GREIGE_COST = 40;
const DYEING_RATE = 20;
/** A date that is not "now" — proves the user's date flows to the GRN, the job, the lot and the challan. */
const RECEIVED_ON = '2026-09-10';
/** Fabric path: processing rate + source greige cost per metre (see header) */
const EXPECTED_COST_PER_M = DYEING_RATE + GREIGE_COST;

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

  // The generic greige name is what the minted fabric is named after — carrying RUN in it makes
  // every auto-created master findable for teardown.
  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GG`,
      greigeName: `${RUN} Poplin`,
      genericGreigeName: `${RUN} Poplin`,
      composition: '100% Cotton',
      greigeWidth: 52,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const lot = await prisma.greige_stock.create({
    data: {
      greigeId,
      quantityAvailable: LOT_QTY,
      greigeWidth: 52,
      receivedDate: new Date(),
      purchaseCost: GREIGE_COST,
      weightedAvgCost: GREIGE_COST,
      warehouseId,
      createdById: userId,
    },
  });
  lotId = lot.id;
  // Keep the central ledger honest — the lot was created below the service layer.
  const greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, LOT_QTY, warehouseId, 'METER');

  // A manual greige dyeing job: no fabricId (it sends greige, not fabric), no lab dip, no
  // requirement. The shade rides on the order — the only place a style-less job can carry it.
  const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    quantity: SEND_QTY,
    agreedRate: DYEING_RATE,
    expectedShrinkage: 10,
    colorName: 'Navy',
  });
  if (created.status !== 201) throw new Error(`JWO create failed: ${JSON.stringify(created.body)}`);
  jwoId = created.body.data.id;

  const issued = await request(app)
    .post(`/api/job-work-orders/${jwoId}/issue`)
    .set(authHeader)
    .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_QTY }] });
  if (issued.status !== 200) throw new Error(`JWO issue failed: ${JSON.stringify(issued.body)}`);
});

afterAll(async () => {
  // Per-step teardown, never one wrapping try/catch: the September sale-order hunt found 19 fake
  // customers in the live dropdown because a single catch had hidden the first failing delete.
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  const challanIds = (
    await prisma.challans.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });

  // Everything minted from this run's greige: fabric masters, their lots, ledgers and materials.
  const mintedIds = (
    await prisma.fabric_master.findMany({
      where: { OR: [{ fabricName: { contains: RUN } }, { greigeId: only(greigeId) }] },
      select: { id: true },
    })
  ).map((f) => f.id);
  const fabricLotIds = (
    await prisma.fabric_stock.findMany({ where: { fabricId: { in: mintedIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLotIds } } });
  await prisma.stock_movements.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.stock_levels.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.materials.deleteMany({ where: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: mintedIds } } });

  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('receiving dyed fabric on a job work order GRN', () => {
  it('starts from the T0-A shape: greige sent, no fabricId, no finished fabric yet', async () => {
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.greigeStockLotId).toBe(lotId);
    expect(jwo!.fabricId).toBeNull(); // it sent greige — there is no source FABRIC
    expect(jwo!.finishedFabricId).toBeNull(); // the generic issue path does not mint (yet)
    expect(jwo!.uom).toBe('MTR');
  });

  it('refuses the JWO-page receive and points at the GRN door', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${jwoId}/receive`)
      .set(authHeader)
      .send({ qtyReceived: RECEIVE_QTY });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RECEIVE_VIA_GRN');
    expect(res.body.message).toMatch(/fabric/i);
  });

  it('T0-A: one action accepts the fabricId-null job — mints the finished fabric and books it into stock', async () => {
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({
        jobWorkOrderId: jwoId,
        qtyReceivedMeters: RECEIVE_QTY,
        // 900 folds of 100 cm — the job should carry these, as it does on the Dyeing page.
        // (foldLengthCm is Decimal(5,2) on every table: max 999.99 cm.)
        thanCount: 900,
        foldLengthCm: 100,
        receivedDate: RECEIVED_ON,
        warehouseId,
        receivedChallan: `${RUN}-VCH`,
        processingQC: { qualityGrade: 'A' },
      });

    // Before 2026-09-15 this was a 4xx: "has no fabric reference — cannot create a GRN item".
    expect(res.status).toBe(201);
    grnId = res.body.data.id;
    // Filed accepted at birth: there is no PENDING_QC moment a user could leave the job in.
    expect(res.body.data.status).toBe('ACCEPTED');
    // The date the user gave is the receipt's date, not the moment of the click.
    expect(String(res.body.data.receivingDate).slice(0, 10)).toBe(RECEIVED_ON);
    // The split is returned so the dialog can name the consequence the moment it commits.
    expect(res.body.lossSplit).toBeDefined();

    // The mint is stamped on the job at creation, so every later reader agrees.
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.finishedFabricId).toBeTruthy();
    finishedFabricId = jwo!.finishedFabricId!;

    const master = await prisma.fabric_master.findUnique({ where: { id: finishedFabricId } });
    expect(master).not.toBeNull();
    expect(master!.greigeId).toBe(greigeId);
    expect(master!.fabricCode).toMatch(/^FAB-STK-/); // style-less job → stock code
    expect(master!.fabricName).toMatch(/Solid\/Dyed/); // the DYED finish label
    expect(master!.fabricName).toMatch(/Navy/); // the shade carried on the order

    // The receipt item names the material ARRIVING — the finished fabric — never the greige sent.
    const items = await prisma.grn_items.findMany({ where: { grnId } });
    expect(items).toHaveLength(1);
    expect(items[0].materialId).toBe(finishedFabricId); // materials.id === master.id
    expect(Number(items[0].receivedQuantity)).toBe(RECEIVE_QTY);
    // Ordered basis is the expected fabric back (billable), not the 1,000 m sent.
    expect(Number(items[0].orderedQuantity)).toBeCloseTo(RECEIVE_QTY, 2);

    // …and the same call booked the stock — everything the two-step approval used to do.
    const lots = await prisma.fabric_stock.findMany({ where: { fabricId: finishedFabricId } });
    expect(lots).toHaveLength(1);
    expect(Number(lots[0].quantityAvailable)).toBe(RECEIVE_QTY);
    expect(Number(lots[0].purchaseCost)).toBeCloseTo(EXPECTED_COST_PER_M, 2); // 60
    expect(Number(lots[0].weightedAvgCost)).toBeCloseTo(EXPECTED_COST_PER_M, 2);
    expect(lots[0].warehouseId).toBe(warehouseId);
    expect(lots[0].status).toBe('AVAILABLE');
    expect(lots[0].fabricFinishType).toBe('DYED');
    expect(lots[0].qualityGrade).toBe('A'); // the grade typed in the dialog lands on the lot

    // The central ledger carries the finished fabric now.
    const level = await prisma.stock_levels.findFirst({ where: { materialId: finishedFabricId, warehouseId } });
    expect(Number(level!.quantity)).toBe(RECEIVE_QTY);

    // (Same `jwo` read as above — one call did both halves, so one read sees both.)
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(RECEIVE_QTY);
    expect(jwo!.finishedFabricId).toBe(finishedFabricId); // the booking agreed with the mint
    expect(jwo!.grnId).toBe(grnId);

    // The four things the Dyeing page recorded that this path used to drop (2026-09-15).
    expect(jwo!.receivedDate!.toISOString().slice(0, 10)).toBe(RECEIVED_ON);
    expect(Number(jwo!.actualShrinkage)).toBeCloseTo(10, 2); // (1,000 − 900) / 1,000
    expect(jwo!.thanCount).toBe(900);
    expect(Number(jwo!.foldLengthCm)).toBe(100);
    expect(Number(jwo!.calculatedActualMeters)).toBe(RECEIVE_QTY);
    // The inward challan — the GST document for goods back from a job worker — is raised in-tx.
    expect(jwo!.inwardChallanId).toBeTruthy();
    const inward = await prisma.challans.findUnique({
      where: { id: jwo!.inwardChallanId! },
      include: { items: true },
    });
    expect(inward!.challanType).toBe('INWARD');
    expect(inward!.jobWorkOrderId).toBe(jwoId);
    expect(inward!.challanDate.toISOString().slice(0, 10)).toBe(RECEIVED_ON);
    expect(inward!.items).toHaveLength(1);
    expect(inward!.items[0].fabricId).toBe(finishedFabricId);
    expect(Number(inward!.items[0].quantity)).toBe(RECEIVE_QTY);
    // The stock lot carries the same date, which is what reversal matches on.
    expect(lots[0].receivedDate.toISOString().slice(0, 10)).toBe(RECEIVED_ON);
  });

  it('a second receipt on the same job is refused — never a second master, never a second lot', async () => {
    // The two-step path allowed a second PENDING_QC receipt before approval. One action leaves
    // the job received, so a retry after a slow response must be refused, not double-booked.
    const mastersBefore = await prisma.fabric_master.count({ where: { greigeId } });
    const lotsBefore = await prisma.fabric_stock.count({ where: { fabricId: finishedFabricId } });
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: jwoId, qtyReceivedMeters: 100, warehouseId });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/already been received/i);
    expect(await prisma.fabric_master.count({ where: { greigeId } })).toBe(mastersBefore);
    expect(await prisma.fabric_stock.count({ where: { fabricId: finishedFabricId } })).toBe(lotsBefore);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: jwoId } })).toBe(1);
  });

  it('takes the lot back when the receipt is reversed', async () => {
    const res = await request(app)
      .patch(`/api/grn/${grnId}/reverse`)
      .set(authHeader)
      .send({ reason: 'Wrong shade — sent back to the dyer' });
    expect(res.status).toBe(200);

    const lots = await prisma.fabric_stock.findMany({ where: { fabricId: finishedFabricId } });
    expect(lots).toHaveLength(0);

    const level = await prisma.stock_levels.findFirst({ where: { materialId: finishedFabricId, warehouseId } });
    expect(Number(level?.quantity ?? 0)).toBe(0);

    // Reversal cancels the inward challan and clears the receipt fields it wrote.
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.inwardChallanId).toBeNull();
    expect(jwo!.actualShrinkage).toBeNull();
    expect(jwo!.thanCount).toBeNull();
    const cancelled = await prisma.challans.findFirst({ where: { jobWorkOrderId: jwoId, challanType: 'INWARD' } });
    expect(cancelled!.status).toBe('CANCELLED');
  });

  it('T0-B: a job with no lineage at all is refused at the door, never silently approved', async () => {
    // No greige lot, no lab dip, no requirement, no fabricId: the finished fabric cannot be
    // identified. Fixture pushes it straight to at-processor — this bypasses setJwoStatus on
    // purpose, to reach the receive gate without an issue that would ADD the lineage.
    const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: 500,
      agreedRate: DYEING_RATE,
    });
    expect(created.status).toBe(201);
    orphanJwoId = created.body.data.id;
    await prisma.job_work_orders.update({
      where: { id: orphanJwoId },
      data: { jwoStatus: 'AT_PROCESSOR', uom: 'MTR', qtySentMeters: 500 },
    });

    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: orphanJwoId, qtyReceivedMeters: 450, warehouseId });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/no greige lineage/i);

    // Nothing half-made: no GRN row, no minted master, job untouched.
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: orphanJwoId } })).toBe(0);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: orphanJwoId } });
    expect(jwo!.finishedFabricId).toBeNull();
    expect(jwo!.jwoStatus).toBe('AT_PROCESSOR');
  });

  it('T0-B: refuses that same no-lineage job on the JWO page too, saying how to make it receivable', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${orphanJwoId}/receive`)
      .set(authHeader)
      .send({ qtyReceived: 450 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RECEIVE_VIA_GRN');
    // Both doors refuse this shape, so this message is the only one that can get the user unstuck.
    expect(res.body.message).toMatch(/greige lot or requirement/i);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: orphanJwoId } });
    expect(jwo!.jwoStatus).toBe('AT_PROCESSOR');
    expect(jwo!.receivedDate).toBeNull();
  });

  it('refuses a metre job with no greige lot and no requirement — and the GRN still takes it', async () => {
    // The shape that slipped the old guard, which fired only on LACE || greigeStockLotId ||
    // requirementLinks. A hand-raised metre job matched none of them, so it was stamped RECEIVED
    // with no stock and then locked out of the GRN as "already received" — the lot was lost.
    const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: 500,
      agreedRate: DYEING_RATE,
    });
    expect(created.status).toBe(201);
    const gapJwoId = created.body.data.id;
    await prisma.job_work_orders.update({
      where: { id: gapJwoId },
      // fabricId alone is enough for the GRN to resolve a master (legacy parity), while
      // greigeStockLotId and requirementLinks stay empty — exactly the gap.
      data: { jwoStatus: 'AT_PROCESSOR', uom: 'MTR', qtySentMeters: 500, fabricId: finishedFabricId },
    });

    const refused = await request(app)
      .post(`/api/job-work-orders/${gapJwoId}/receive`)
      .set(authHeader)
      .send({ qtyReceived: 450 });
    expect(refused.status).toBe(422);
    expect(refused.body.code).toBe('RECEIVE_VIA_GRN');

    // It refused without touching the job, so the real door is still open — this is the half that
    // proves the lot is recoverable rather than stranded.
    const afterRefusal = await prisma.job_work_orders.findUnique({ where: { id: gapJwoId } });
    expect(afterRefusal!.jwoStatus).toBe('AT_PROCESSOR');
    expect(afterRefusal!.receivedDate).toBeNull();

    const viaGrn = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: gapJwoId, qtyReceivedMeters: 450, warehouseId });
    expect(viaGrn.status).toBe(201);
    // Booked. The job carries whichever master the identity ladder resolved — it may mint a
    // properly-identified finished fabric from jwo.fabric's greige rather than reuse fabricId
    // verbatim — so the lot is looked up through the job, not through the fabricId we planted.
    const booked = await prisma.job_work_orders.findUnique({ where: { id: gapJwoId } });
    expect(booked!.jwoStatus).toBe('STOCK_UPDATED');
    expect(booked!.finishedFabricId).toBeTruthy();
    expect(await prisma.fabric_stock.count({ where: { fabricId: booked!.finishedFabricId! } })).toBe(1);
  });

  it('sends a PO-backed metre job to the PO GRN, not the job-work GRN', async () => {
    const po = await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber: `${RUN}-PO`,
        supplierId: dyerId,
        poDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000),
        status: 'ACKNOWLEDGED',
        poCategory: 'PROCESSING',
        createdById: userId,
      },
    });

    const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: 500,
      agreedRate: DYEING_RATE,
    });
    expect(created.status).toBe(201);
    await prisma.job_work_orders.update({
      where: { id: created.body.data.id },
      data: { jwoStatus: 'AT_PROCESSOR', uom: 'MTR', qtySentMeters: 500, purchaseOrderId: po.id },
    });

    const res = await request(app)
      .post(`/api/job-work-orders/${created.body.data.id}/receive`)
      .set(authHeader)
      .send({ qtyReceived: 450 });

    expect(res.status).toBe(422);
    // A different code from the PO-less case: this job's stock comes in on the PO's own GRN, so
    // pointing it at "Receive against Job Work Order" would send the user somewhere it cannot appear.
    expect(res.body.code).toBe('RECEIVE_VIA_PO_GRN');
    expect(res.body.message).toMatch(/purchase order/i);

    await prisma.job_work_orders.updateMany({ where: { purchaseOrderId: po.id }, data: { purchaseOrderId: null } });
    await prisma.purchase_orders.delete({ where: { id: po.id } });
  });

  // A fresh at-processor job carrying just enough lineage (fabricId) for the receipt to resolve.
  const raiseAtProcessorJob = async () => {
    const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: 500,
      agreedRate: DYEING_RATE,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    await prisma.job_work_orders.update({
      where: { id },
      data: { jwoStatus: 'AT_PROCESSOR', uom: 'MTR', qtySentMeters: 500, fabricId: finishedFabricId },
    });
    return id;
  };

  it('refuses a receipt that carries no quantity at the door — nothing is written', async () => {
    const zeroJwoId = await raiseAtProcessorJob();
    const lotsBefore = await prisma.fabric_stock.count();

    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: zeroJwoId, warehouseId }); // no metres, no than × fold

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/quantity/i);
    // The old path could accept a receipt and leave stock empty; now a zero receipt leaves nothing.
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: zeroJwoId } })).toBe(0);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: zeroJwoId } });
    expect(jwo!.jwoStatus).toBe('AT_PROCESSOR');
    expect(await prisma.fabric_stock.count()).toBe(lotsBefore);
  });

  it('the create-only door is closed: POST /api/grn/jwo answers 410 and points at the job', async () => {
    const res = await request(app)
      .post('/api/grn/jwo')
      .set(authHeader)
      .send({ jobWorkOrderId: jwoId, qtyReceivedMeters: 10, warehouseId });
    expect(res.status).toBe(410);
    expect(res.body.message).toMatch(/Receive from processor/);
  });

  it('previews the loss split before commit, from the same function the receipt books with', async () => {
    const preview = (qty: number) =>
      request(app).get(`/api/job-work-orders/${jwoId}/receive-preview`).query({ qty }).set(authHeader);

    const full = await preview(RECEIVE_QTY);
    expect(full.status).toBe(200);
    expect(full.body.data.qtyExpected).toBeCloseTo(RECEIVE_QTY, 2);
    expect(full.body.data.isOverTolerance).toBe(false);
    expect(full.body.data.maxReceivable).toBeGreaterThanOrEqual(RECEIVE_QTY);

    // 200 m short of the contract is beyond any plausible tolerance: the dialog must warn.
    const short = await preview(RECEIVE_QTY - 200);
    expect(short.status).toBe(200);
    expect(short.body.data.qtyExpected).toBeCloseTo(RECEIVE_QTY, 2);
    expect(short.body.data.isOverTolerance).toBe(true);
    expect(short.body.data.debitNoteRequired).toBe(true);
    expect(short.body.data.qtyAbnormalLoss).toBeGreaterThan(0);

    const bad = await preview(0);
    expect(bad.status).toBe(400);
  });

  it('is all-or-nothing: a failure after the receipt row is created leaves no row, no lot, no challan', async () => {
    const atomicJwoId = await raiseAtProcessorJob();
    const lotsBefore = await prisma.fabric_stock.count({ where: { fabricId: finishedFabricId } });

    // Fail the booking half, AFTER createGRNFromJWO has written the receipt row inside the tx.
    const target = grnService as unknown as { approvePolessJwoGrnInTx: (...args: unknown[]) => Promise<void> };
    const spy = jest
      .spyOn(target, 'approvePolessJwoGrnInTx')
      .mockRejectedValueOnce(new Error('simulated failure after create'));
    try {
      const res = await request(app)
        .post('/api/grn/jwo/receive')
        .set(authHeader)
        .send({ jobWorkOrderId: atomicJwoId, qtyReceivedMeters: 450, warehouseId });
      expect(res.status).toBeGreaterThanOrEqual(400);
    } finally {
      spy.mockRestore();
    }

    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: atomicJwoId } })).toBe(0);
    expect(await prisma.challans.count({ where: { jobWorkOrderId: atomicJwoId, challanType: 'INWARD' } })).toBe(0);
    expect(await prisma.fabric_stock.count({ where: { fabricId: finishedFabricId } })).toBe(lotsBefore);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: atomicJwoId } });
    expect(jwo!.jwoStatus).toBe('AT_PROCESSOR');
    expect(jwo!.grnId).toBeNull();
    expect(jwo!.receivedDate).toBeNull();
  });
});
