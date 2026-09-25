/**
 * Greige a supplier delivers STRAIGHT to a processor (direct-to-processor plan, Phase 2, 2026-09-25).
 *
 * Owner: part of a greige PO goes straight to the dyer, part to Kashaya Fabs — "it has to be done
 * for the entire system". The team already did it in Aug-2026 (GRN2608-0071..0075 into dyers'
 * units), but the ERP booked that greige as if it were in our store: no job-work challan, missing
 * from the Processor Statement, and a later job raised a second "dispatch" challan for cloth that
 * never moved. This walks the corrected flow through the real services and endpoints:
 *
 *  1. Approving a receipt into a dyer's unit asks "delivered straight there?" — implicit when the
 *     PO's Deliver To is that unit.
 *  2. The lot is OURS, HELD by that dyer (sourceType DIRECT), on-hand at the unit, and a Rule 45
 *     challan covering it is ISSUED in the same transaction, dated the receipt day.
 *  3. A job at that dyer DRAWS it where it lies: no new challan, the lot goes down (it can never be
 *     allocated twice), and the one-year clock runs from the day the dyer got it.
 *  4. A job at ANOTHER dyer cannot take it; a truck dispatch cannot carry it.
 *  5. Cancelling the job ("At Processor") puts the metres back on the held lot.
 *  6. Reversing the receipt cancels the challan — refused once some of it was drawn.
 *  7. The issue screens place every lot: at this dyer first (drawn where it lies), our stores, and
 *     another dyer's cloth only as "elsewhere"; the truck lists store lots only; the sent date is
 *     never after today, nor before the cloth got where it is.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { jobWorkStatutoryService } from '../../services/job-work-statutory.service';
import { getProcessorStatement } from '../../services/processor-statement.service';
import { buildChallanDocData } from '../../services/document-data/challan.doc-data';
import { buildJobWorkOrderDocData } from '../../services/document-data/job-work-order.doc-data';
import { formatDate } from '../../utils/date';
import { recomputeCoveringChallansForJwo } from '../../services/helpers/jwo-challan-lifecycle.helper';

const RUN = `DDV${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';
const DAY = 24 * 60 * 60 * 1000;

let userId: string;
let authHeader: Record<string, string>;
let supplierId: string;
let dyerA: string;
let dyerB: string;
let unitA: string;
let unitB: string;
let storeId: string;
let greigeId: string;
let materialId: string;
const poIds: string[] = [];

const RECEIVED_ON = new Date(Date.now() - 20 * DAY); // the dyer got it 20 days ago

async function makePo(qty: number, deliveryLocationId: string | null) {
  const poId = (
    await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber: `${RUN}-PO${poIds.length + 1}`,
        supplierId,
        poDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * DAY),
        status: 'SENT',
        poCategory: 'GREIGE',
        deliveryLocationId,
        deliveryLocationType: deliveryLocationId ? 'PROCESSOR' : null,
        createdById: userId,
      },
    })
  ).id;
  poIds.push(poId);
  const poItemId = (
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId,
        materialId,
        orderedQuantity: qty,
        receivedQuantity: 0,
        unitPrice: 55,
        totalPrice: qty * 55,
        unit: 'METER',
      },
    })
  ).id;
  return { poId, poItemId };
}

async function receiveInto(unit: string, qty: number, deliveryLocationId: string | null = null) {
  const { poId, poItemId } = await makePo(qty, deliveryLocationId);
  const grn = await grnService.createGRN(
    {
      poId,
      warehouseId: unit,
      receivingDate: RECEIVED_ON,
      items: [
        {
          poItemId,
          materialId,
          receivedQuantity: qty,
          acceptedQuantity: qty,
          rejectedQuantity: 0,
          unit: 'METER',
          weaverNotKnown: true,
        },
      ],
    },
    userId
  );
  const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: grn.id } });
  return { grnId: grn.id, grnItemId: item.id };
}

const onHandAt = async (warehouseId: string) =>
  Number((await prisma.stock_levels.findFirst({ where: { materialId, warehouseId } }))?.quantity ?? 0);

async function createJwo(processorId: string, quantity: number) {
  const res = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId,
    quantity,
    agreedRate: 18,
    expectedShrinkage: 6,
    colorName: 'Teal',
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  authHeader = getAuthHeader(userId, 'ADMIN');
  supplierId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-SUP`, name: `${RUN} Hardik`, supplierCategories: ['GREIGE_SUPPLIER'], createdById: userId },
    })
  ).id;
  const mkDyer = async (tag: string) =>
    (
      await prisma.suppliers.create({
        data: {
          code: `${RUN}-${tag}`,
          name: `${RUN} Dyer ${tag}`,
          supplierCategories: ['DYEING_PRINTING'],
          createdById: userId,
        },
      })
    ).id;
  dyerA = await mkDyer('A');
  dyerB = await mkDyer('B');
  const mkUnit = async (dyer: string, tag: string) =>
    (
      await prisma.warehouses.create({
        data: {
          warehouseCode: `${RUN}-JW${tag}`,
          warehouseName: `${RUN} Dyer ${tag} - Processing Unit`,
          warehouseType: 'JOB_WORK',
          supplierId: dyer,
          isActive: true,
          createdById: userId,
        },
      })
    ).id;
  unitA = await mkUnit(dyerA, 'A');
  unitB = await mkUnit(dyerB, 'B');
  storeId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ST`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        createdById: userId,
      },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GRG`,
        greigeName: `${RUN} Cotton Flex 63"`,
        genericGreigeName: `${RUN} Cotton Flex`,
        composition: '100% Cotton',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({
      where: { processorId: { in: [only(dyerA), only(dyerB)] } },
      select: { id: true },
    })
  ).map((j) => j.id);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jwoIds } }, { directSupplyGrnId: { in: grnIds } }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  const lotIds = (
    await prisma.greige_stock.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.greige_issue_details.deleteMany({ where: { greigeStockDetail: { greigeStockId: { in: lotIds } } } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: lotIds } } });
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  await prisma.greige_stock.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.fabric_procurement.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.stock_movements.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_transactions.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_levels.deleteMany({ where: { materialId: only(materialId) } });
  for (const id of poIds) {
    await prisma.goods_receiving_notes.deleteMany({ where: { poId: only(id) } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: only(id) } });
    await prisma.purchase_orders.deleteMany({ where: { id: only(id) } });
  }
  const minted = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  await prisma.materials.deleteMany({ where: { OR: [{ greigeId: only(greigeId) }, { fabricId: { in: minted } }] } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: minted } } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({ where: { id: { in: [only(unitA), only(unitB), only(storeId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerA), only(dyerB), only(supplierId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('greige delivered straight to a processor', () => {
  let lotId: string;
  let challanId: string;
  let firstGrnId: string;

  it('asks "delivered straight there?" before booking a receipt at a processor\'s unit', async () => {
    const { grnId } = await receiveInto(unitA, 3000);
    firstGrnId = grnId;
    await expect(grnService.approveGRN(grnId, userId, unitA)).rejects.toMatchObject({
      details: expect.objectContaining({ reason: 'DIRECT_DELIVERY_UNCONFIRMED' }),
    });
    const lots = await prisma.greige_stock.count({ where: { greigeId } });
    expect(lots).toBe(0); // refused before anything was written
  });

  it('books it as ours, HELD by the dyer, with a Rule 45 challan dated the receipt day', async () => {
    const before = await onHandAt(unitA);
    await grnService.approveGRN(firstGrnId, userId, unitA, undefined, { directDeliveryConfirmed: true });

    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, grnItem: { grnId: firstGrnId } } });
    lotId = lot.id;
    expect(lot.sourceType).toBe('DIRECT');
    expect(lot.processorId).toBe(dyerA);
    expect(lot.warehouseId).toBe(unitA);
    expect(Number(lot.quantityAvailable)).toBe(3000);
    expect(await onHandAt(unitA)).toBeCloseTo(before + 3000, 2); // on-hand at the dyer's unit

    const challan = await prisma.challans.findFirstOrThrow({
      where: { directSupplyGrnId: firstGrnId },
      include: { items: true },
    });
    challanId = challan.id;
    expect(lot.sourceChallanId).toBe(challan.id);
    expect(challan.challanType).toBe('OUTWARD');
    expect(challan.status).toBe('ISSUED');
    expect(challan.toType).toBe('VENDOR');
    expect(challan.toId).toBe(dyerA);
    expect(challan.fromName).toBe(`Supplied directly by ${RUN} Hardik`);
    expect(challan.reasonForTransport).toMatch(/Rule 45/);
    expect(new Date(challan.challanDate).toDateString()).toBe(RECEIVED_ON.toDateString());
    expect(challan.items).toHaveLength(1);
    expect(challan.items[0].greigeStockId).toBe(lot.id);
    expect(Number(challan.items[0].quantity)).toBe(3000);
    expect(Number(challan.totalDeclaredValue)).toBe(165000); // 3,000 × ₹55

    // on the stock view at the unit, like any stock we own
    const view = (await prisma.$queryRawUnsafe(
      `SELECT quantity::float AS q FROM derived_stock_view WHERE "materialId" = $1 AND "warehouseId" = $2`,
      materialId,
      unitA
    )) as Array<{ q: number }>;
    expect(view[0]?.q).toBeCloseTo(3000, 2);
  });

  it("needs no tick when the PO's Deliver To is that unit", async () => {
    const { grnId } = await receiveInto(unitA, 500, unitA);
    await grnService.approveGRN(grnId, userId, unitA);
    expect(await prisma.challans.count({ where: { directSupplyGrnId: grnId } })).toBe(1);
  });

  it("refuses it on another dyer's job", async () => {
    const jwoB = await createJwo(dyerB, 1000);
    const res = await request(app)
      .post(`/api/job-work-orders/${jwoB}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: 1000 }] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LOT_AT_WRONG_PROCESSOR');
    expect(res.body.message).toContain(`${RUN} Dyer A`);
  });

  let jwoA: string;
  it('a job at that dyer draws it where it lies: no new challan, the lot goes down, the clock runs from arrival', async () => {
    const before = await onHandAt(unitA);
    jwoA = await createJwo(dyerA, 1200);
    const res = await request(app)
      .post(`/api/job-work-orders/${jwoA}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: 1200 }] });
    expect(res.status).toBe(200);
    // the screen is told nothing travelled, and under which challan the cloth already sits
    expect(res.body.challanCreated).toBe(false);
    expect(res.body.drawnAt).toBe(`${RUN} Dyer A`);
    expect(res.body.message).toMatch(/allocated at .* under challan .* nothing dispatched/);

    const lot = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } });
    expect(Number(lot.quantityAvailable)).toBe(1800);
    expect(Number(lot.quantityConsumed)).toBe(1200);
    expect(await onHandAt(unitA)).toBeCloseTo(before - 1200, 2);

    const jwo = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jwoA } });
    expect(jwo.outwardChallanId).toBeNull(); // nothing travelled
    const covering = await prisma.challans.findUniqueOrThrow({ where: { id: challanId } });
    expect(jwo.challanNumber).toBe(covering.challanNumber);
    expect(await prisma.challans.count({ where: { jobWorkOrderId: jwoA } })).toBe(0);
    // one-year return period from the day the dyer received it
    const expectedDue = new Date(RECEIVED_ON);
    expectedDue.setFullYear(expectedDue.getFullYear() + 1);
    expect(new Date(jwo.statutoryDueDate!).toDateString()).toBe(expectedDue.toDateString());

    const draw = await prisma.greige_stock_transaction.findFirst({
      where: { stockId: lotId, referenceType: 'JOB_WORK_ORDER', referenceId: jwoA },
    });
    expect(draw).not.toBeNull();
  });

  it('§143 ages the drawn job from the day the dyer got the cloth; what is still held ages too, with its challan', async () => {
    const report = await jobWorkStatutoryService.getSection143Ageing();
    const job = report.items.find((i) => i.jobWorkOrderId === jwoA)!;
    expect(job).toBeDefined();
    expect(job.clockFrom.toDateString()).toBe(RECEIVED_ON.toDateString()); // not the day it was issued
    expect(job.daysOutstanding).toBeGreaterThanOrEqual(19);
    expect(job.balanceQty).toBe(1200);

    const covering = await prisma.challans.findUniqueOrThrow({ where: { id: challanId } });
    const held = report.held.items.find((i) => i.greigeStockId === lotId)!;
    expect(held).toMatchObject({ quantity: 1800, processorName: `${RUN} Dyer A` });
    expect(held.coveringChallanNumber).toBe(covering.challanNumber);
    expect(held.daysHeld).toBeGreaterThanOrEqual(19);

    // the Rule 45 challan is in ITC-04 Table A for the quarter the dyer received the goods
    const itc = await jobWorkStatutoryService.getITC04Extract(new Date(RECEIVED_ON.getTime() - DAY), new Date());
    expect(itc.tableA.items.some((i) => i.challanId === challanId)).toBe(true);
  });

  it("the dyer's statement shows the delivery as SENT from the day it arrived; the drawn job sends nothing twice", async () => {
    const from = new Date(RECEIVED_ON.getTime() - DAY);
    const statementA = await getProcessorStatement(dyerA, from, new Date());
    const row = statementA.sections.flatMap((sec) => sec.rows).find((r) => r.material.id === greigeId)!;
    expect(row).toBeDefined();
    expect(row.sent).toBe(3500); // 3,000 m + 500 m delivered straight there
    expect(row.received).toBe(0);
    expect(row.closing).toBe(3500); // all of it still with the dyer, on the job or not
    const job = row.jobs.find((j) => j.jwoId === jwoA)!;
    expect(job.virtual).toBe(true);
    expect(job.sentQty).toBe(1200);
    expect(job.balance).toBe(1200); // the job holds what it took; the other 2,300 m is on no job
    expect(statementA.warnings.some((w) => w.includes(job.jobWorkNumber))).toBe(false);

    const statementB = await getProcessorStatement(dyerB, from, new Date());
    expect(statementB.sections.flatMap((sec) => sec.rows).some((r) => r.material.id === greigeId)).toBe(false);
  });

  it('the printouts say where the goods came from and that nothing is "to follow"', async () => {
    const covering = await prisma.challans.findUniqueOrThrow({ where: { id: challanId } });
    const challanDoc = await buildChallanDocData(challanId);
    expect(challanDoc.despatchedFrom).toBe(`Supplied directly by ${RUN} Hardik`);
    expect(challanDoc.movementLabel).toMatch(/Delivered direct/);
    const dueBack = new Date(RECEIVED_ON);
    dueBack.setFullYear(dueBack.getFullYear() + 1);
    expect(challanDoc.returnByDate).toBe(formatDate(dueBack));
    expect(challanDoc.deemedFromDate).toBe(formatDate(RECEIVED_ON));

    const jobDoc = await buildJobWorkOrderDocData(jwoA);
    expect(jobDoc.issuedRemark).toBe(
      `Goods already with you under our challan ${covering.challanNumber} dated ${formatDate(covering.challanDate)}`
    );
    expect(jobDoc.challanRef).toContain(covering.challanNumber);
  });

  let storeLotId: string;
  it('the issue screen lists cloth at the dyer first, then our store; another dyer sees it only as elsewhere', async () => {
    const { grnId } = await receiveInto(storeId, 700);
    await grnService.approveGRN(grnId, userId, storeId);
    storeLotId = (await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, grnItem: { grnId } } })).id;

    type Lot = { id: string; greigeId: string; location?: Record<string, unknown> };
    const mine = (lots: Lot[] | undefined) => (lots ?? []).filter((l) => l.greigeId === greigeId);

    const jwoAt = await createJwo(dyerA, 400);
    const atA = (await request(app).get(`/api/job-work-orders/${jwoAt}/issue-preview`).set(authHeader)).body.data;
    const heldRow = mine(atA.atProcessor).find((l: Lot) => l.id === lotId)!;
    expect(heldRow.location).toMatchObject({
      category: 'AT_THIS_PROCESSOR',
      drawnWhereItLies: true,
      holderName: `${RUN} Dyer A`,
    });
    expect(heldRow.location!.coveringChallanNumber).toBeTruthy();
    expect(mine(atA.atMainWarehouse).map((l: Lot) => l.id)).toEqual([storeLotId]);
    expect(mine(atA.atMainWarehouse)[0].location).toMatchObject({
      category: 'OUR_STORE',
      warehouseName: `${RUN} Store`,
    });
    // the dyer's cloth is offered before the store's
    const order = mine(atA.availableLots).map((l: Lot) => l.id);
    expect(order.indexOf(lotId)).toBeLessThan(order.indexOf(storeLotId));
    expect(mine(atA.elsewhere)).toHaveLength(0);

    const jwoAtB = await createJwo(dyerB, 400);
    const atB = (await request(app).get(`/api/job-work-orders/${jwoAtB}/issue-preview`).set(authHeader)).body.data;
    expect(mine(atB.availableLots).map((l: Lot) => l.id)).toEqual([storeLotId]);
    expect(mine(atB.elsewhere).find((l: Lot) => l.id === lotId)?.location).toMatchObject({
      category: 'AT_OTHER_PROCESSOR',
      holderName: `${RUN} Dyer A`,
    });

    // the truck offers store lots only, and says what is already at the dyer
    await prisma.job_work_orders.update({ where: { id: jwoAt }, data: { jwoStatus: 'APPROVED' } });
    const trucks = (await request(app).get(`/api/job-work-orders/dispatchable?processorId=${dyerA}`).set(authHeader))
      .body.data;
    const onTruck = trucks.find((o: { id: string }) => o.id === jwoAt);
    expect(mine(onTruck.availableLots).map((l: Lot) => l.id)).toEqual([storeLotId]);
    expect(mine(onTruck.atProcessor).map((l: Lot) => l.id)).toContain(lotId);
  });

  it('the sent date is never after today, nor before the cloth got where it is', async () => {
    const jwo = await createJwo(dyerA, 100);
    const issue = (sentDate: Date, lot: string) =>
      request(app)
        .post(`/api/job-work-orders/${jwo}/issue`)
        .set(authHeader)
        .send({ sentDate: sentDate.toISOString(), lots: [{ greigeStockLotId: lot, qty: 100 }] });

    const beforeArrival = await issue(new Date(RECEIVED_ON.getTime() - 2 * DAY), lotId);
    expect(beforeArrival.status).toBe(422);
    expect(beforeArrival.body.code).toBe('SENT_BEFORE_ARRIVAL');

    const beforeReceipt = await issue(new Date(RECEIVED_ON.getTime() - 2 * DAY), storeLotId);
    expect(beforeReceipt.status).toBe(422);
    expect(beforeReceipt.body.code).toBe('SENT_DATE_BEFORE_RECEIPT');

    const tomorrow = await issue(new Date(Date.now() + 2 * DAY), storeLotId);
    expect(tomorrow.status).toBe(422);
    expect(tomorrow.body.code).toBe('SENT_DATE_IN_FUTURE');
    expect((await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jwo } })).sentDate).toBeNull();
  });

  it('the covering challan follows the jobs that draw from it: issued, partly received, received', async () => {
    const statusOf = async (id: string) => (await prisma.challans.findUniqueOrThrow({ where: { id } })).status;
    expect(await statusOf(challanId)).toBe('ISSUED'); // a job drew from it, nothing has come back

    await prisma.job_work_orders.update({ where: { id: jwoA }, data: { jwoStatus: 'PARTIALLY_RECEIVED' } });
    await recomputeCoveringChallansForJwo(prisma, jwoA);
    expect(await statusOf(challanId)).toBe('PARTIALLY_RECEIVED');
    // recomputed from scratch, so undoing the receipt moves it back
    await prisma.job_work_orders.update({ where: { id: jwoA }, data: { jwoStatus: 'ISSUED' } });
    await recomputeCoveringChallansForJwo(prisma, jwoA);
    expect(await statusOf(challanId)).toBe('ISSUED');

    // The 500 m delivery: one job takes all of it and comes back — nothing of it is left at the dyer
    const small = await prisma.greige_stock.findFirstOrThrow({
      where: { greigeId, processorId: dyerA, sourceType: 'DIRECT', id: { not: lotId } },
    });
    const jwoAll = await createJwo(dyerA, 500);
    const issued = await request(app)
      .post(`/api/job-work-orders/${jwoAll}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: small.id, qty: 500 }] });
    expect(issued.status).toBe(200);
    await prisma.job_work_orders.update({ where: { id: jwoAll }, data: { jwoStatus: 'STOCK_UPDATED' } });
    await recomputeCoveringChallansForJwo(prisma, jwoAll);
    expect(await statusOf(small.sourceChallanId!)).toBe('RECEIVED');
  });

  it('cannot allocate the same metres twice', async () => {
    const jwo2 = await createJwo(dyerA, 2500);
    const res = await request(app)
      .post(`/api/job-work-orders/${jwo2}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: 2500 }] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_GREIGE');
  });

  it('keeps held greige off a truck dispatch', async () => {
    const jwo3 = await createJwo(dyerA, 300);
    const res = await request(app)
      .post('/api/job-work-orders/dispatch')
      .set(authHeader)
      .send({ processorId: dyerA, orders: [{ jwoId: jwo3, lots: [{ greigeStockLotId: lotId, qty: 300 }] }] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LOT_NOT_ON_TRUCK');
  });

  it('refuses reversing the receipt once some of it was drawn', async () => {
    await expect(grnService.reverseGRN(firstGrnId, userId, `${RUN} test`)).rejects.toThrow(/already been used/);
    expect((await prisma.challans.findUniqueOrThrow({ where: { id: challanId } })).status).toBe('ISSUED');
  });

  it('cancelling the job "At Processor" puts the metres back on the held lot', async () => {
    const cancelled = await request(app)
      .post(`/api/job-work-orders/${jwoA}/cancel`)
      .set(authHeader)
      .send({ reason: 'Shade changed before dyeing' });
    expect(cancelled.status).toBe(200);
    const disposed = await request(app)
      .post(`/api/job-work-orders/${jwoA}/dispose-inventory`)
      .set(authHeader)
      .send({ disposition: 'AT_PROCESSOR', notes: 'Greige stays with the dyer' });
    expect(disposed.status).toBe(200);
    const lot = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } });
    expect(Number(lot.quantityAvailable)).toBe(3000);
    expect(lot.processorId).toBe(dyerA);
    // nothing of it is on a job now, and nothing came back: the covering challan is plainly issued
    expect((await prisma.challans.findUniqueOrThrow({ where: { id: challanId } })).status).toBe('ISSUED');
  });

  it('reversing an untouched receipt cancels its challan and empties the lot', async () => {
    await grnService.reverseGRN(firstGrnId, userId, `${RUN} wrong delivery`);
    expect((await prisma.challans.findUniqueOrThrow({ where: { id: challanId } })).status).toBe('CANCELLED');
    const lot = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } });
    expect(Number(lot.quantityAvailable)).toBe(0);
    expect(lot.status).toBe('EXHAUSTED');
  });
});
