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
  // The receipt below is dated RECEIVED_ON to prove the user's date flows through — and a return may
  // not be dated before the send (refused since 2026-09-19), so the fixture's send is backdated too.
  await prisma.job_work_orders.update({ where: { id: jwoId }, data: { sentDate: new Date('2026-09-01T00:00:00Z') } });
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
        // 900 thans at L=100 (no fold loss) — the job should carry these, as it does on the Dyeing page.
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
      .send({ jobWorkOrderId: orphanJwoId, qtyReceivedMeters: 500, warehouseId });

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
      .send({ jobWorkOrderId: gapJwoId, qtyReceivedMeters: 500, warehouseId });
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
        .send({ jobWorkOrderId: atomicJwoId, qtyReceivedMeters: 500, warehouseId });
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

  it('bale-wise: the quantity is the sum of the thans, the than count is the row count, and the bales are kept', async () => {
    const baleJwoId = await raiseAtProcessorJob();
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({
        jobWorkOrderId: baleJwoId,
        entryMode: 'BALE_WISE',
        details: [
          { detailType: 'THAN', baleNumber: 1, sequenceNo: 1, meters: 168 },
          { detailType: 'THAN', baleNumber: 1, sequenceNo: 2, meters: 166 },
          { detailType: 'THAN', baleNumber: 2, sequenceNo: 3, meters: 166 },
        ],
        warehouseId,
      });
    expect(res.status).toBe(201);
    const items = await prisma.grn_items.findMany({
      where: { grnId: res.body.data.id },
      include: { grn_item_details: true },
    });
    expect(Number(items[0].receivedQuantity)).toBe(500);
    expect(items[0].thanCount).toBe(3);
    expect(items[0].grn_item_details.map((d) => d.baleNumber).sort()).toEqual([1, 1, 2]);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: baleJwoId } });
    expect(Number(jwo!.qtyReceivedMeters)).toBe(500);
    expect(jwo!.thanCount).toBe(3);
  });

  it('a total typed beside a than count keeps both — the count is stored, the metres are the quantity', async () => {
    const countJwoId = await raiseAtProcessorJob();
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: countJwoId, qtyReceivedMeters: 500, thanCount: 12, foldLengthCm: 100, warehouseId });
    expect(res.status).toBe(201);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: countJwoId } });
    expect(Number(jwo!.qtyReceivedMeters)).toBe(500); // not 12 × 100 / 100
    expect(jwo!.thanCount).toBe(12);
  });

  it('refuses a return dated before the day the greige was sent', async () => {
    const earlyJwoId = await raiseAtProcessorJob();
    await prisma.job_work_orders.update({
      where: { id: earlyJwoId },
      data: { sentDate: new Date('2026-09-19T10:00:00Z') },
    });
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: earlyJwoId, qtyReceivedMeters: 450, receivedDate: '2026-08-27', warehouseId });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/27-Aug-2026 is before the day the greige was sent \(19-Sep-2026\)/);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: earlyJwoId } })).toBe(0);
  });

  // ---- Receiving in parts (2026-09-19): DJ-ESSKY085LS-002 came back in two deliveries ------------
  let partsFixture: { jwoId: string; grn1: string; grn2: string; lot1Id: string; lot2Id: string; challan1Id: string };

  it('receives a return in two parts — each part books its own lot and challan; only the final one closes the job', async () => {
    const partsJwoId = await raiseAtProcessorJob(); // 500 sent, nothing expected to shrink

    // Part 1 — more to come.
    const part1 = await request(app).post('/api/grn/jwo/receive').set(authHeader).send({
      jobWorkOrderId: partsJwoId,
      qtyReceivedMeters: 300,
      thanCount: 3,
      isFinal: false,
      receivedDate: '2026-09-18',
      warehouseId,
      receivedChallan: 'CH-489',
    });
    expect(part1.status).toBe(201);
    const grn1 = part1.body.data.id as string;

    let jwo = await prisma.job_work_orders.findUnique({ where: { id: partsJwoId } });
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(300);
    expect(jwo!.thanCount).toBe(3);
    // Not "received" until the last part: no date, no shrinkage, no loss split yet.
    expect(jwo!.receivedDate).toBeNull();
    expect(jwo!.actualShrinkage).toBeNull();
    expect(jwo!.qtyNormalLoss).toBeNull();
    expect(jwo!.grnId).toBe(grn1);
    const item1 = await prisma.grn_items.findFirst({ where: { grnId: grn1 } });
    const lot1 = await prisma.fabric_stock.findFirst({ where: { grnItemId: item1!.id } });
    expect(lot1).not.toBeNull();
    expect(Number(lot1!.quantityAvailable)).toBe(300);
    expect(lot1!.fabricId).toBe(jwo!.finishedFabricId);
    expect(lot1!.receivedDate.toISOString().slice(0, 10)).toBe('2026-09-18');
    const challan1 = await prisma.challans.findFirst({ where: { grnId: grn1 } });
    expect(challan1).not.toBeNull();
    expect(challan1!.challanType).toBe('INWARD');
    expect(challan1!.id).toBe(jwo!.inwardChallanId);

    // Part 2 — the final delivery. 190 brings the total to 490: 2 % short, inside the 3 % tolerance, so
    // it closes without the short-close confirmation (the short cases are pinned further down).
    const part2 = await request(app).post('/api/grn/jwo/receive').set(authHeader).send({
      jobWorkOrderId: partsJwoId,
      qtyReceivedMeters: 190,
      thanCount: 2,
      isFinal: true,
      receivedDate: '2026-09-19',
      warehouseId,
      receivedChallan: 'CH-497',
    });
    expect(part2.status).toBe(201);
    const grn2 = part2.body.data.id as string;

    jwo = await prisma.job_work_orders.findUnique({ where: { id: partsJwoId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(490); // cumulative, not the last part
    expect(jwo!.thanCount).toBe(5);
    expect(jwo!.receivedDate!.toISOString().slice(0, 10)).toBe('2026-09-19');
    expect(Number(jwo!.actualShrinkage)).toBeCloseTo(2, 2); // (500 − 490) / 500 — on the TOTAL
    expect(jwo!.qtyNormalLoss).not.toBeNull(); // the loss split ran once, on the total
    expect(jwo!.grnId).toBe(grn2);
    const item2 = await prisma.grn_items.findFirst({ where: { grnId: grn2 } });
    const lot2 = await prisma.fabric_stock.findFirst({ where: { grnItemId: item2!.id } });
    expect(lot2).not.toBeNull();
    expect(Number(lot2!.quantityAvailable)).toBe(190);
    expect(Number(lot1!.quantityAvailable)).toBe(300); // part 1's lot is untouched
    expect(
      await prisma.challans.count({
        where: { jobWorkOrderId: partsJwoId, challanType: 'INWARD', status: { not: 'CANCELLED' } },
      })
    ).toBe(2);
    expect(
      await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: partsJwoId, status: 'ACCEPTED' } })
    ).toBe(2);

    // The job page lists every receipt, oldest first.
    const page = await request(app).get(`/api/job-work-orders/${partsJwoId}`).set(authHeader);
    expect(page.status).toBe(200);
    expect(page.body.data.receivingGRNs.map((r: { id: string }) => r.id)).toEqual([grn1, grn2]);

    // A third receipt is refused — the job has been received in full.
    const third = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: partsJwoId, qtyReceivedMeters: 10, warehouseId });
    expect(third.status).toBe(422);
    expect(third.body.message).toMatch(/already been received/i);

    partsFixture = { jwoId: partsJwoId, grn1, grn2, lot1Id: lot1!.id, lot2Id: lot2!.id, challan1Id: challan1!.id };
  });

  it('reverses one part at a time: the final part re-opens the job as partial, a middle part leaves it final on the reduced total, the last one resets it', async () => {
    const { jwoId: id, grn1, grn2, lot1Id, lot2Id, challan1Id } = partsFixture;

    // Reverse the FINAL part. Before the grnItemId / challans.grnId links, this found the lot by the
    // job's single receivedDate and the challan by the job's single inwardChallanId.
    const r2 = await request(app)
      .patch(`/api/grn/${grn2}/reverse`)
      .set(authHeader)
      .send({ reason: 'Second delivery counted twice' });
    expect(r2.status).toBe(200);
    expect(await prisma.fabric_stock.findUnique({ where: { id: lot2Id } })).toBeNull();
    expect(await prisma.fabric_stock.findUnique({ where: { id: lot1Id } })).not.toBeNull(); // the sibling stays
    let jwo = await prisma.job_work_orders.findUnique({ where: { id } });
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(300);
    expect(jwo!.thanCount).toBe(3);
    expect(jwo!.receivedDate).toBeNull();
    expect(jwo!.actualShrinkage).toBeNull();
    expect(jwo!.qtyNormalLoss).toBeNull();
    expect(jwo!.grnId).toBe(grn1); // the latest remaining receipt
    expect(jwo!.inwardChallanId).toBe(challan1Id);
    expect((await prisma.challans.findFirst({ where: { grnId: grn2 } }))!.status).toBe('CANCELLED');
    expect((await prisma.challans.findUnique({ where: { id: challan1Id } }))!.status).not.toBe('CANCELLED');

    // Receivable again: a new final part closes it on the new total.
    const again = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: id, qtyReceivedMeters: 190, isFinal: true, warehouseId });
    expect(again.status).toBe(201);
    jwo = await prisma.job_work_orders.findUnique({ where: { id } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(490);

    // Reverse the FIRST part while the job is final: it stays final on what remains, and the split
    // is re-run on that total. Before 2026-09-19 this silently did nothing (the job's grnId no
    // longer named this receipt).
    const r1 = await request(app)
      .patch(`/api/grn/${grn1}/reverse`)
      .set(authHeader)
      .send({ reason: 'First delivery was the wrong shade' });
    expect(r1.status).toBe(200);
    expect(await prisma.fabric_stock.findUnique({ where: { id: lot1Id } })).toBeNull();
    jwo = await prisma.job_work_orders.findUnique({ where: { id } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(190);
    expect(jwo!.receivedDate).not.toBeNull();
    expect(Number(jwo!.actualShrinkage)).toBeCloseTo(62, 2); // (500 − 190) / 500
    expect(jwo!.grnId).toBe(again.body.data.id);
    expect((await prisma.challans.findUnique({ where: { id: challan1Id } }))!.status).toBe('CANCELLED');

    // Reverse the only remaining receipt: the full pre-receive reset, as for a single receipt.
    const r3 = await request(app)
      .patch(`/api/grn/${again.body.data.id}/reverse`)
      .set(authHeader)
      .send({ reason: 'Start over' });
    expect(r3.status).toBe(200);
    jwo = await prisma.job_work_orders.findUnique({ where: { id } });
    expect(jwo!.jwoStatus).toBe('ISSUED');
    expect(jwo!.qtyReceivedMeters).toBeNull();
    expect(jwo!.grnId).toBeNull();
    expect(jwo!.inwardChallanId).toBeNull();
  });

  it('caps the parts together: a part that would take the job past the maximum is refused, naming what is already in', async () => {
    const capJwoId = await raiseAtProcessorJob(); // 500 expected back; the cap is that plus the over-receipt tolerance
    const first = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: capJwoId, qtyReceivedMeters: 300, isFinal: false, warehouseId });
    expect(first.status).toBe(201);

    const tooMuch = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: capJwoId, qtyReceivedMeters: 400, isFinal: true, warehouseId });
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.message).toMatch(/300\.00 MTR already received/);

    // Nothing half-made: still one receipt, still partial.
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: capJwoId } })).toBe(1);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: capJwoId } });
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(300);
  });

  // ---- Presses that arrive together (2026-09-25): a stalled server answered DJ-ESSKY076LS-001's first
  //      press "Response timeout" while still working; the user pressed again and, when the stall cleared,
  //      six receipts were filed for one delivery — every one had read "0 received so far", so the cap
  //      never fired. The job row is now locked first: one job's receipts run one at a time. ---------------
  const receiptTrail = async (jobId: string) => {
    const receipts = await prisma.goods_receiving_notes.findMany({
      where: { jobWorkOrderId: jobId },
      select: { id: true, grn_items: { select: { id: true } } },
    });
    const itemIds = receipts.flatMap((r) => r.grn_items.map((i) => i.id));
    const lots = await prisma.fabric_stock.findMany({ where: { grnItemId: { in: itemIds } } });
    const challans = await prisma.challans.count({ where: { jobWorkOrderId: jobId, challanType: 'INWARD' } });
    return { receipts: receipts.length, lots, challans };
  };
  it('files ONE receipt when the same final delivery arrives three times at once — the others find it already received', async () => {
    const jobId = await raiseAtProcessorJob(); // 500 expected back
    const press = () =>
      request(app)
        .post('/api/grn/jwo/receive')
        .set(authHeader)
        .send({ jobWorkOrderId: jobId, qtyReceivedMeters: 490, thanCount: 5, isFinal: true, warehouseId });

    const results = await Promise.all([press(), press(), press()]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 422, 422]);
    for (const r of results.filter((x) => x.status === 422)) {
      expect(r.body.message).toMatch(/already been received/);
    }
    const trail = await receiptTrail(jobId);
    expect(trail.receipts).toBe(1);
    expect(trail.lots).toHaveLength(1);
    expect(Number(trail.lots[0].quantityAvailable)).toBe(490);
    expect(trail.challans).toBe(1);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jobId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(490);
    expect(jwo!.thanCount).toBe(5);
    // Stock rose once — the refused presses rolled back with their transactions. stock_levels for the
    // fabric that arrived equals its lots (three increments would read 1,470 here).
    const { fabricId } = trail.lots[0];
    const level = await prisma.stock_levels.findUnique({
      where: { materialId_warehouseId: { materialId: fabricId, warehouseId } },
    });
    const lotsOfFabric = await prisma.fabric_stock.aggregate({
      where: { fabricId, warehouseId },
      _sum: { quantityAvailable: true },
    });
    expect(Number(level?.quantity)).toBeCloseTo(Number(lotsOfFabric._sum.quantityAvailable), 3);
  });

  it('runs two parts that arrive together one after the other — the second reads the first and the cap refuses it', async () => {
    const jobId = await raiseAtProcessorJob(); // 500 expected; 300 + 300 is over the cap
    const press = () =>
      request(app)
        .post('/api/grn/jwo/receive')
        .set(authHeader)
        .send({ jobWorkOrderId: jobId, qtyReceivedMeters: 300, isFinal: false, warehouseId });

    const results = await Promise.all([press(), press()]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(results.find((r) => r.status === 422)!.body.message).toMatch(/300\.00 MTR already received/);
    const trail = await receiptTrail(jobId);
    expect(trail.receipts).toBe(1);
    expect(trail.lots).toHaveLength(1);
    expect(trail.challans).toBe(1);
    // The job's running total is the lots it booked — not the last writer's view of an empty job.
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jobId } });
    expect(Number(jwo!.qtyReceivedMeters)).toBe(300);
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
  });

  it('reverses a job-work receipt without writing a stock movement — its lot was the receipt, and the lot is gone', async () => {
    const jobId = await raiseAtProcessorJob();
    const received = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ jobWorkOrderId: jobId, qtyReceivedMeters: 490, isFinal: true, warehouseId });
    expect(received.status).toBe(201);
    const grnId = received.body.data.id as string;

    const reversed = await request(app)
      .patch(`/api/grn/${grnId}/reverse`)
      .set(authHeader)
      .send({ reason: 'Pressed twice' });
    expect(reversed.status).toBe(200);
    // The receipt wrote no STOCK_IN, so an out-row here had nothing to cancel: the fabric Material
    // Ledger showed it as a phantom "adjustment out" folded into the oldest surviving lot.
    expect(await prisma.stock_movements.count({ where: { referenceId: grnId } })).toBe(0);
    expect((await receiptTrail(jobId)).lots).toHaveLength(0);
  });

  it('returns a job unprocessed ONCE when the press arrives twice at once — the second finds it cancelled', async () => {
    // Until 2026-09-25 the guards read the job outside the transaction, so both presses saw "at
    // processor", both credited the material and both filed an inward challan.
    const jobId = await raiseAtProcessorJob();
    const press = () =>
      request(app)
        .post(`/api/job-work-orders/${jobId}/return-unprocessed`)
        .set(authHeader)
        .send({ returnedQty: 500, remarks: `${RUN} double press` });

    const results = await Promise.all([press(), press()]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    expect(results.find((r) => r.status === 422)!.body.message).toMatch(/cancelled/);
    expect(await prisma.challans.count({ where: { jobWorkOrderId: jobId, challanType: 'INWARD' } })).toBe(1);
    expect((await prisma.job_work_orders.findUnique({ where: { id: jobId } }))!.jwoStatus).toBe('CANCELLED');
  });

  // ---- Closing short needs saying so (2026-09-19): the first real receipt closed DJ-ESSKY085LS-002 at
  //      852.10 of 1,686.59 m by an unintended tick, and locked the second delivery out. ---------------
  const receive = (body: Record<string, unknown>) =>
    request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({ warehouseId, ...body });

  it('refuses a final receipt that leaves the total short beyond the tolerance unless the short close is confirmed', async () => {
    const shortJwoId = await raiseAtProcessorJob(); // 500 expected, 3 % tolerance → anything under 485 is a short close

    const unconfirmed = await receive({ jobWorkOrderId: shortJwoId, qtyReceivedMeters: 300, isFinal: true });
    expect(unconfirmed.status).toBe(422);
    expect(unconfirmed.body.error).toBe('BUSINESS_ERROR');
    expect(unconfirmed.body.details?.reason).toBe('SHORT_CLOSE_UNCONFIRMED');
    expect(unconfirmed.body.message).toMatch(/short/);
    expect(unconfirmed.body.message).toMatch(/nothing more is expected/i);
    expect(unconfirmed.body.message).toMatch(/300\.00 MTR received in total against 500\.00 MTR/);
    expect(Number(unconfirmed.body.details.shortfall)).toBeCloseTo(200, 2);
    // Nothing written: no receipt, job untouched.
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: shortJwoId } })).toBe(0);
    let jwo = await prisma.job_work_orders.findUnique({ where: { id: shortJwoId } });
    expect(jwo!.jwoStatus).toBe('AT_PROCESSOR');

    // The stale-client shape — no isFinal at all, which the server defaults to "final" — is refused
    // the same way. This is the door the owner's first receipt may have come through.
    const stale = await receive({ jobWorkOrderId: shortJwoId, qtyReceivedMeters: 300 });
    expect(stale.status).toBe(422);
    expect(stale.body.details?.reason).toBe('SHORT_CLOSE_UNCONFIRMED');

    // Said out loud → goes through, and the loss is booked against the processor.
    const confirmed = await receive({
      jobWorkOrderId: shortJwoId,
      qtyReceivedMeters: 300,
      isFinal: true,
      shortCloseConfirmed: true,
    });
    expect(confirmed.status).toBe(201);
    jwo = await prisma.job_work_orders.findUnique({ where: { id: shortJwoId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(300);
    expect(Number(jwo!.qtyAbnormalLoss)).toBeGreaterThan(0);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: shortJwoId } })).toBe(1);
  });

  it('asks nothing when the total is within tolerance, when the receipt is a part, or when the final part completes the total', async () => {
    // Within the 3 % allowance: an ordinary shrinkage variance, no confirmation.
    const withinJwoId = await raiseAtProcessorJob();
    const within = await receive({ jobWorkOrderId: withinJwoId, qtyReceivedMeters: 490, isFinal: true });
    expect(within.status).toBe(201);
    expect((await prisma.job_work_orders.findUnique({ where: { id: withinJwoId } }))!.jwoStatus).toBe('STOCK_UPDATED');

    // A part is never a short close — more is coming by definition.
    const partsJwoId = await raiseAtProcessorJob();
    const part = await receive({ jobWorkOrderId: partsJwoId, qtyReceivedMeters: 300, isFinal: false });
    expect(part.status).toBe(201);
    expect((await prisma.job_work_orders.findUnique({ where: { id: partsJwoId } }))!.jwoStatus).toBe(
      'PARTIALLY_RECEIVED'
    );

    // The final part that completes the total closes without a flag, isFinal omitted or not.
    const completing = await receive({ jobWorkOrderId: partsJwoId, qtyReceivedMeters: 200 });
    expect(completing.status).toBe(201);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: partsJwoId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(500);
  });

  // ---- Close short — nothing more is coming: the mirror mistake (box unticked, nothing more came) ----
  const closeShort = (id: string, body: Record<string, unknown>) =>
    request(app).post(`/api/job-work-orders/${id}/close-short`).set(authHeader).send(body);

  it('closes a part-received job on what came, behind the same confirmation, without filing another receipt', async () => {
    // Nothing received at all: there is nothing to close on.
    const bareJwoId = await raiseAtProcessorJob();
    const bare = await closeShort(bareJwoId, { shortCloseConfirmed: true });
    expect(bare.status).toBe(422);
    expect(bare.body.message).toMatch(/nothing has been received/i);

    // One part in (300 of 500), more was expected.
    const jobId = await raiseAtProcessorJob();
    const part = await receive({
      jobWorkOrderId: jobId,
      qtyReceivedMeters: 300,
      isFinal: false,
      receivedDate: '2026-09-18',
      receivedChallan: 'CH-489',
    });
    expect(part.status).toBe(201);
    const grnId1 = part.body.data.id as string;

    // Unconfirmed → refused, job untouched.
    const unconfirmed = await closeShort(jobId, {});
    expect(unconfirmed.status).toBe(422);
    expect(unconfirmed.body.details?.reason).toBe('SHORT_CLOSE_UNCONFIRMED');
    expect(unconfirmed.body.message).toMatch(/nothing more/i);
    expect(unconfirmed.body.message).toMatch(/300\.00 MTR in total against 500\.00 MTR/);
    let jwo = await prisma.job_work_orders.findUnique({ where: { id: jobId } });
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(jwo!.receivedDate).toBeNull();

    // Confirmed → the job closes on the 300 already in: dated the day the last goods arrived, shrinkage
    // and the loss split on that total, no new receipt / lot / challan.
    const lotsBefore = await prisma.fabric_stock.count({ where: { fabricId: jwo!.finishedFabricId! } });
    const confirmed = await closeShort(jobId, {
      shortCloseConfirmed: true,
      remarks: 'Dyer confirmed the rest was ruined',
    });
    expect(confirmed.status).toBe(200);
    expect(Number(confirmed.body.lossSplit.qtyAbnormalLoss)).toBeGreaterThan(0);
    jwo = await prisma.job_work_orders.findUnique({ where: { id: jobId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(300);
    expect(jwo!.receivedDate!.toISOString().slice(0, 10)).toBe('2026-09-18');
    expect(Number(jwo!.actualShrinkage)).toBeCloseTo(40, 2); // (500 − 300) / 500
    expect(Number(jwo!.qtyAbnormalLoss)).toBeGreaterThan(0);
    expect(jwo!.remarks).toMatch(/CLOSED SHORT/);
    expect(jwo!.remarks).toMatch(/Dyer confirmed the rest was ruined/);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: jobId } })).toBe(1);
    expect(
      await prisma.challans.count({
        where: { jobWorkOrderId: jobId, challanType: 'INWARD', status: { not: 'CANCELLED' } },
      })
    ).toBe(1);
    expect(await prisma.fabric_stock.count({ where: { fabricId: jwo!.finishedFabricId! } })).toBe(lotsBefore);

    // Closed means closed: no further receipt. (Close Order's debit-note gate is a hard block only for
    // PO-backed jobs — a PO-less job closes with a warning — so it is not asserted here; the abnormal
    // loss it would warn about is on the row.)
    const late = await receive({ jobWorkOrderId: jobId, qtyReceivedMeters: 50 });
    expect(late.status).toBe(422);
    expect(late.body.message).toMatch(/already been received/i);

    // Reversing the only receipt afterwards is the full pre-receive reset — close short adds no new state.
    const reversed = await request(app)
      .patch(`/api/grn/${grnId1}/reverse`)
      .set(authHeader)
      .send({ reason: 'Recorded on the wrong job' });
    expect(reversed.status).toBe(200);
    jwo = await prisma.job_work_orders.findUnique({ where: { id: jobId } });
    expect(jwo!.jwoStatus).toBe('ISSUED');
    expect(jwo!.receivedDate).toBeNull();
    expect(jwo!.grnId).toBeNull();
  });

  it('closes a part-received job that is within tolerance without asking', async () => {
    const jobId = await raiseAtProcessorJob();
    const part = await receive({ jobWorkOrderId: jobId, qtyReceivedMeters: 490, isFinal: false });
    expect(part.status).toBe(201);
    const closed = await closeShort(jobId, {});
    expect(closed.status).toBe(200);
    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jobId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(490);
    expect(Number(jwo!.qtyAbnormalLoss)).toBe(0);
  });
});
