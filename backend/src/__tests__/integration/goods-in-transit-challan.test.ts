/**
 * Goods-in-transit challan (2026-09-29): our Rule 45 challan for goods a supplier despatches STRAIGHT to a
 * processor, issued BEFORE they arrive — then adopted by the receipt filed the day they really arrive.
 *
 * Owner: a dyer will not inward goods without our challan. PO2609-0004's delivery to Shree Bhavya was received
 * AHEAD of arrival (GRN2609-1581 dated 03-Oct, filed 29-Sep) only to get CH2609-2129 out. Walked through the real
 * endpoints and services:
 *
 *  1. Issued on a split PO's dyer point: IN_TRANSIT, no lot; prints its bales / thans, the supplier's invoice, the
 *     despatch day and "one year of the day they reach you"; not with the processor yet (Processor Statement).
 *  2. Refused: more than can still come there, a piece list more than 1% off, a place that is our store, a date
 *     in the future.
 *  3. A receipt at that dyer must name it (or say it is not against it); cannot be dated before it; cannot take
 *     it as ready fabric. Against it (same day, one than short) the receipt CLAIMS it; the print keeps its list;
 *     a second receipt and a hand "receive" are refused.
 *  4. Approval into our store is refused; into the dyer's unit it ADOPTS the challan: ISSUED, the DIRECT lot
 *     linked, arrivedQty, the clock from arrival; the print keeps the despatched list plus "Received by job
 *     worker"; ITC-04 and the Processor Statement show what arrived.
 *  5. Reversing an untouched receipt RELEASES the challan (on the way again), never cancels it; once a job drew
 *     cloth under it, reversal is refused.
 *  6. A PO with goods on the way cannot be cancelled, nor its place dropped; a challan whose truck never came is
 *     cancelled; rejecting a receipt releases its claim; a line that never came reads 0 arrived.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { purchaseOrderService } from '../../services/purchaseOrder.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { applyDeliveryPlan } from '../../services/helpers/po-delivery-plan.helper';
import { jobWorkStatutoryService } from '../../services/job-work-statutory.service';
import { getProcessorStatement } from '../../services/processor-statement.service';
import { buildChallanDocData } from '../../services/document-data/challan.doc-data';
import { toDateInputValue } from '../../utils/date';

const RUN = `GIT${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';
const DAY = 24 * 60 * 60 * 1000;
const TODAY = toDateInputValue(new Date());
const YESTERDAY = toDateInputValue(new Date(Date.now() - DAY));
const TWO_DAYS_AGO = toDateInputValue(new Date(Date.now() - 2 * DAY));

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

/** A sent greige PO: lines of `qtys` metres; split between the given places, else one place */
async function makePo(
  qtys: number[],
  split: Array<{ warehouseId: string; share: number[] }> | null,
  oneplace?: string
) {
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
        deliveryLocationId: split ? split[0].warehouseId : (oneplace ?? null),
        deliveryLocationType: 'PROCESSOR',
        createdById: userId,
      },
    })
  ).id;
  poIds.push(poId);
  const itemIds: string[] = [];
  for (const qty of qtys) {
    itemIds.push(
      (
        await prisma.purchase_order_items.create({
          data: {
            id: randomUUID(),
            poId,
            materialId,
            orderedQuantity: qty,
            receivedQuantity: 0,
            unitPrice: 60,
            totalPrice: qty * 60,
            unit: 'METER',
          },
        })
      ).id
    );
  }
  const pointIds: string[] = [];
  if (split) {
    for (const [i, p] of split.entries()) {
      pointIds.push(
        (
          await prisma.po_delivery_points.create({
            data: {
              poId,
              warehouseId: p.warehouseId,
              sequence: i + 1,
              lines: { create: p.share.map((quantity, j) => ({ poItemId: itemIds[j], quantity })) },
            },
          })
        ).id
      );
    }
  }
  return { poId, itemIds, pointIds };
}

const issue = (body: Record<string, unknown>) =>
  request(app).post('/api/challans/goods-in-transit').set(authHeader).send(body);

async function receive(input: {
  poId: string;
  poItemId: string;
  warehouseId: string;
  pointId?: string;
  qty: number;
  details?: Array<{ detailType: 'THAN'; baleNumber?: number; sequenceNo: number; meters: number }>;
  transitChallanId?: string;
  notAgainstTransitChallan?: boolean;
  receivingDate?: string;
  readyFabric?: boolean;
}) {
  return grnService.createGRN(
    {
      poId: input.poId,
      warehouseId: input.warehouseId,
      poDeliveryPointId: input.pointId ?? null,
      receivingDate: input.receivingDate ?? TODAY,
      invoiceNumber: `${RUN}-INV`,
      invoiceDate: TWO_DAYS_AGO,
      transitChallanId: input.transitChallanId,
      notAgainstTransitChallan: input.notAgainstTransitChallan,
      items: [
        {
          poItemId: input.poItemId,
          materialId,
          receivedQuantity: input.qty,
          acceptedQuantity: input.qty,
          rejectedQuantity: 0,
          unit: 'METER',
          weaverNotKnown: true,
          ...(input.details ? { entryMode: 'BALE_WISE' as const, details: input.details } : {}),
          ...(input.readyFabric ? { receivedAsReadyFabric: true } : {}),
        },
      ],
    },
    userId
  );
}

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
      where: {
        OR: [
          { purchaseOrderId: { in: poIds } },
          { jobWorkOrderId: { in: jwoIds } },
          { directSupplyGrnId: { in: grnIds } },
          { toId: { in: [only(dyerA), only(dyerB)] } },
        ],
      },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.job_work_orders.updateMany({
    where: { id: { in: jwoIds } },
    data: { grnId: null, inwardChallanId: null, outwardChallanId: null },
  });
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
    const grns = (await prisma.goods_receiving_notes.findMany({ where: { poId: id }, select: { id: true } })).map(
      (g) => g.id
    );
    await prisma.grn_item_details.deleteMany({ where: { grn_items: { grnId: { in: grns } } } });
    await prisma.grn_items.deleteMany({ where: { grnId: { in: grns } } });
    await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grns } } });
    await prisma.po_delivery_plan_revisions.deleteMany({ where: { poId: id } });
    await prisma.po_delivery_points.deleteMany({ where: { poId: id } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: id } });
    await prisma.purchase_orders.deleteMany({ where: { id } });
  }
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: challanIds } } });
  await prisma.materials.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({ where: { id: { in: [only(unitA), only(unitB), only(storeId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerA), only(dyerB), only(supplierId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('a challan issued while the goods are on the way to a dyer, adopted by the receipt on arrival', () => {
  let poId: string;
  let itemId: string;
  let pointA: string;
  let pointStore: string;
  let challanId: string;
  let grnId: string;

  const BALES = [
    { detailType: 'THAN' as const, baleNumber: 1, sequenceNo: 1, meters: 200 },
    { detailType: 'THAN' as const, baleNumber: 1, sequenceNo: 2, meters: 200 },
    { detailType: 'THAN' as const, baleNumber: 2, sequenceNo: 3, meters: 200 },
  ];

  it('issues it on the dyer point: IN_TRANSIT, no lot, its bales / thans, the invoice and the despatch day', async () => {
    ({
      poId,
      itemIds: [itemId],
      pointIds: [pointA, pointStore],
    } = await makePo(
      [1000],
      [
        { warehouseId: unitA, share: [600] },
        { warehouseId: storeId, share: [400] },
      ]
    ));

    const res = await issue({
      poId,
      poDeliveryPointId: pointA,
      dispatchedOn: YESTERDAY,
      invoiceNumber: '308',
      invoiceDate: TWO_DAYS_AGO,
      vehicleNumber: 'RJ14 AB 1234',
      ewayBillNumber: '341009876543',
      lines: [{ poItemId: itemId, quantity: 600, entryMode: 'BALE_WISE', pieces: BALES }],
    });
    expect(res.status).toBe(201);
    challanId = res.body.data.id;

    const challan = await prisma.challans.findUniqueOrThrow({
      where: { id: challanId },
      include: { items: { include: { pieces: true } } },
    });
    expect(challan).toMatchObject({
      status: 'IN_TRANSIT',
      toId: dyerA,
      purchaseOrderId: poId,
      poDeliveryPointId: pointA,
      directSupplyGrnId: null,
      expectedDate: null,
      supplierInvoiceNumber: '308',
      ewayBillNumber: '341009876543',
      vehicleNumber: 'RJ14 AB 1234',
    });
    expect(toDateInputValue(challan.challanDate)).toBe(TODAY);
    expect(toDateInputValue(challan.supplierDispatchedAt!)).toBe(YESTERDAY);
    expect(challan.items).toHaveLength(1);
    expect(challan.items[0]).toMatchObject({
      poItemId: itemId,
      entryMode: 'BALE_WISE',
      greigeStockId: null,
      arrivedQty: null,
    });
    expect(Number(challan.items[0].quantity)).toBe(600);
    expect(challan.items[0].pieces).toHaveLength(3);
    expect(await prisma.greige_stock.count({ where: { greigeId } })).toBe(0);

    const doc = await buildChallanDocData(challanId);
    expect(doc.movementLabel).toMatch(/On the way direct/);
    expect(doc.returnFromReceipt).toBe(true);
    expect(doc.transit).toMatchObject({ supplierInvoice: expect.stringContaining('308'), receivedByJobWorker: null });
    expect(doc.thanListTotal).toMatchObject({ count: 3, metres: '600.00' });
    expect(doc.thanList).toEqual([
      expect.objectContaining({ bale: '1', baleNote: 'Full bale', count: 2 }),
      expect.objectContaining({ bale: '2', baleNote: 'Full bale', count: 1 }),
    ]);

    // Not with the dyer yet
    const statement = await getProcessorStatement(dyerA, new Date(Date.now() - 5 * DAY), new Date());
    expect(statement.sections.flatMap((s) => s.rows).some((r) => r.material.id === greigeId)).toBe(false);

    const listed = await request(app).get(`/api/challans/goods-in-transit?poId=${poId}`).set(authHeader);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({ id: challanId, transitState: 'OPEN', warehouseId: unitA }),
    ]);
    const page = await request(app).get(`/api/challans/${challanId}`).set(authHeader);
    expect(page.body.data.transitState).toBe('OPEN');
    expect(page.body.data.packingList.thanListTotal.count).toBe(3);
  });

  it('refuses more than can still come there, a piece list more than 1% off, our store, a future date', async () => {
    const over = await issue({
      poId,
      poDeliveryPointId: pointA,
      dispatchedOn: TODAY,
      lines: [{ poItemId: itemId, quantity: 500 }],
    });
    expect(over.body.details?.code ?? over.body.code).toBe('TRANSIT_EXCEEDS_PENDING');

    const off = await issue({
      poId,
      poDeliveryPointId: pointStore,
      dispatchedOn: TODAY,
      lines: [{ poItemId: itemId, quantity: 400, pieces: [{ detailType: 'THAN', sequenceNo: 1, meters: 300 }] }],
    });
    // the store point is refused before its pieces are even looked at
    expect(off.body.details?.code ?? off.body.code).toBe('TRANSIT_NOT_PROCESSOR');

    const future = await issue({
      poId,
      poDeliveryPointId: pointA,
      dispatchedOn: toDateInputValue(new Date(Date.now() + 2 * DAY)),
      lines: [{ poItemId: itemId, quantity: 10 }],
    });
    expect(future.body.details?.code ?? future.body.code).toBe('TRANSIT_DISPATCH_IN_FUTURE');
  });

  it('a receipt at the dyer must name it, cannot predate it, cannot take it as ready fabric', async () => {
    await expect(
      receive({ poId, poItemId: itemId, warehouseId: unitA, pointId: pointA, qty: 400 })
    ).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'TRANSIT_CHALLAN_UNCONFIRMED' }),
    });
    await expect(
      receive({
        poId,
        poItemId: itemId,
        warehouseId: unitA,
        pointId: pointA,
        qty: 400,
        transitChallanId: challanId,
        receivingDate: YESTERDAY,
      })
    ).rejects.toMatchObject({ details: expect.objectContaining({ code: 'RECEIPT_BEFORE_TRANSIT_CHALLAN' }) });
    await expect(
      receive({
        poId,
        poItemId: itemId,
        warehouseId: unitA,
        pointId: pointA,
        qty: 400,
        transitChallanId: challanId,
        readyFabric: true,
      })
    ).rejects.toMatchObject({ details: expect.objectContaining({ code: 'TRANSIT_READY_FABRIC' }) });
    // our store's receipt of the same PO is none of its business
    expect(await prisma.goods_receiving_notes.count({ where: { poId } })).toBe(0);
  });

  it('a receipt the same day, one than short, CLAIMS it — the print keeps its list; nothing else can take it', async () => {
    const grn = await receive({
      poId,
      poItemId: itemId,
      warehouseId: unitA,
      pointId: pointA,
      qty: 400,
      details: BALES.slice(0, 2),
      transitChallanId: challanId,
    });
    grnId = grn.id;
    const claimed = await prisma.challans.findUniqueOrThrow({ where: { id: challanId } });
    expect(claimed).toMatchObject({ status: 'IN_TRANSIT', directSupplyGrnId: grnId });

    const doc = await buildChallanDocData(challanId);
    expect(doc.returnFromReceipt).toBe(true);
    expect(doc.thanListTotal).toMatchObject({ count: 3, metres: '600.00' });

    await expect(
      receive({ poId, poItemId: itemId, warehouseId: unitA, pointId: pointA, qty: 200, transitChallanId: challanId })
    ).rejects.toMatchObject({ details: expect.objectContaining({ code: 'TRANSIT_CHALLAN_TAKEN' }) });

    const item = await prisma.challan_items.findFirstOrThrow({ where: { challanId } });
    const hand = await request(app)
      .put(`/api/challans/${challanId}/receive`)
      .set(authHeader)
      .send({ items: [{ challanItemId: item.id, receivedQty: 400 }] });
    expect(hand.status).toBe(422);
  });

  it('approval into our store is refused; into the dyer it ADOPTS the challan', async () => {
    await expect(grnService.approveGRN(grnId, userId, storeId)).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'TRANSIT_CHALLAN_WRONG_PLACE' }),
    });
    await grnService.approveGRN(grnId, userId, unitA);

    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, grnItem: { grnId } } });
    expect(lot).toMatchObject({
      sourceType: 'DIRECT',
      processorId: dyerA,
      warehouseId: unitA,
      sourceChallanId: challanId,
    });
    expect(Number(lot.quantityAvailable)).toBe(400);

    const adopted = await prisma.challans.findUniqueOrThrow({ where: { id: challanId }, include: { items: true } });
    expect(adopted.status).toBe('ISSUED');
    expect(adopted.items[0]).toMatchObject({ greigeStockId: lot.id });
    expect(Number(adopted.items[0].arrivedQty)).toBe(400);
    expect(Number(adopted.items[0].quantity)).toBe(600); // what was despatched, never changed
    const dueBack = new Date(`${TODAY}T00:00:00.000Z`);
    dueBack.setUTCFullYear(dueBack.getUTCFullYear() + 1);
    expect(adopted.expectedDate?.toISOString()).toBe(dueBack.toISOString());
    // no second challan was made at receipt
    expect(await prisma.challans.count({ where: { directSupplyGrnId: grnId } })).toBe(1);

    const doc = await buildChallanDocData(challanId);
    expect(doc.returnFromReceipt).toBe(false);
    expect(doc.movementLabel).toMatch(/Delivered direct/);
    expect(doc.thanListTotal).toMatchObject({ count: 3, metres: '600.00' });
    expect(doc.transit?.receivedByJobWorker).toMatch(/^400\.00 m on .* \(GRN/);

    const itc = await jobWorkStatutoryService.getITC04Extract(
      new Date(Date.now() - 5 * DAY),
      new Date(Date.now() + DAY)
    );
    const row = itc.tableA.items.find((i) => i.challanId === challanId)!;
    expect(row.quantity).toBe(400);
    expect(row.taxableValue).toBe(24000);

    const statement = await getProcessorStatement(dyerA, new Date(Date.now() - 5 * DAY), new Date(Date.now() + DAY));
    const line = statement.sections.flatMap((s) => s.rows).find((r) => r.material.id === greigeId)!;
    expect(line.sent).toBe(400);
  });

  it('reversing an untouched receipt RELEASES the challan — on the way again, never cancelled', async () => {
    await grnService.reverseGRN(grnId, userId, 'mistyped — wrong thans');
    const released = await prisma.challans.findUniqueOrThrow({ where: { id: challanId }, include: { items: true } });
    expect(released).toMatchObject({ status: 'IN_TRANSIT', directSupplyGrnId: null, expectedDate: null });
    expect(released.items[0]).toMatchObject({ greigeStockId: null, arrivedQty: null });
    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, grnItem: { grnId } } });
    expect(Number(lot.quantityAvailable)).toBe(0);
    expect(lot.sourceChallanId).toBeNull();
  });

  it('received again in full; once a job drew cloth under it, reversal is refused', async () => {
    const grn = await receive({
      poId,
      poItemId: itemId,
      warehouseId: unitA,
      pointId: pointA,
      qty: 600,
      details: BALES,
      transitChallanId: challanId,
    });
    await grnService.approveGRN(grn.id, userId, unitA);
    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, grnItem: { grnId: grn.id } } });
    const jwo = await createJwo(dyerA, 200);
    const drawn = await request(app)
      .post(`/api/job-work-orders/${jwo}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lot.id, qty: 200 }] });
    expect(drawn.status).toBe(200);
    expect(drawn.body.challanCreated).toBe(false);
    await expect(grnService.reverseGRN(grn.id, userId, 'try')).rejects.toBeTruthy();
    expect((await prisma.challans.findUniqueOrThrow({ where: { id: challanId } })).status).not.toBe('IN_TRANSIT');
  });
});

describe('goods on the way hold their PO and their place; a truck that never came; a rejected receipt; a line that never came', () => {
  let poId: string;
  let items: string[];
  let challanId: string;

  it('a one-place PO to dyer B, two lines: cancel / close short / dropping the place are refused while it is open', async () => {
    ({ poId, itemIds: items } = await makePo([300, 200], null, unitB));
    const res = await issue({
      poId,
      dispatchedOn: TODAY,
      lines: [
        { poItemId: items[0], quantity: 300 },
        { poItemId: items[1], quantity: 200 },
      ],
    });
    expect(res.status).toBe(201);
    challanId = res.body.data.id;

    await expect(purchaseOrderService.cancelPurchaseOrder(poId, 'not needed', 'ADMIN', userId)).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'PO_HAS_GOODS_IN_TRANSIT' }),
    });
    await expect(purchaseOrderService.shortClosePurchaseOrder(poId, 'enough', 'ADMIN', userId)).rejects.toBeTruthy();
    await expect(
      prisma.$transaction((tx) =>
        applyDeliveryPlan(
          tx,
          poId,
          { mode: 'ONE_PLACE', warehouseId: storeId },
          { revision: true, reason: 'test', userId }
        )
      )
    ).rejects.toMatchObject({ details: expect.objectContaining({ code: 'DELIVERY_PLACE_IN_TRANSIT' }) });
  });

  it('rejecting a receipt against it releases the claim', async () => {
    const grn = await receive({ poId, poItemId: items[0], warehouseId: unitB, qty: 300, transitChallanId: challanId });
    expect((await prisma.challans.findUniqueOrThrow({ where: { id: challanId } })).directSupplyGrnId).toBe(grn.id);
    await grnService.rejectGRN(grn.id, userId, 'wrong lot');
    expect(await prisma.challans.findUniqueOrThrow({ where: { id: challanId } })).toMatchObject({
      status: 'IN_TRANSIT',
      directSupplyGrnId: null,
    });
  });

  it('a line that never came reads 0 arrived and is left out of ITC-04', async () => {
    const grn = await receive({ poId, poItemId: items[0], warehouseId: unitB, qty: 300, transitChallanId: challanId });
    await grnService.approveGRN(grn.id, userId, unitB);
    const lines = await prisma.challan_items.findMany({ where: { challanId }, orderBy: { poItemId: 'asc' } });
    const byItem = new Map(lines.map((l) => [l.poItemId, l]));
    expect(Number(byItem.get(items[0])!.arrivedQty)).toBe(300);
    expect(Number(byItem.get(items[1])!.arrivedQty)).toBe(0);
    const itc = await jobWorkStatutoryService.getITC04Extract(
      new Date(Date.now() - 5 * DAY),
      new Date(Date.now() + DAY)
    );
    const rows = itc.tableA.items.filter((i) => i.challanId === challanId);
    expect(rows.map((r) => r.quantity)).toEqual([300]);
  });

  it('a challan whose truck never came is cancelled and drops out of ITC-04; an arrived one cannot be', async () => {
    const res = await issue({ poId, dispatchedOn: TODAY, lines: [{ poItemId: items[1], quantity: 200 }] });
    expect(res.status).toBe(201);
    const second = res.body.data.id as string;
    const cancelled = await request(app)
      .patch(`/api/challans/${second}/cancel-transit`)
      .set(authHeader)
      .send({ reason: 'truck went to our store' });
    expect(cancelled.status).toBe(200);
    expect((await prisma.challans.findUniqueOrThrow({ where: { id: second } })).status).toBe('CANCELLED');
    const itc = await jobWorkStatutoryService.getITC04Extract(
      new Date(Date.now() - 5 * DAY),
      new Date(Date.now() + DAY)
    );
    expect(itc.tableA.items.some((i) => i.challanId === second)).toBe(false);

    const refused = await request(app)
      .patch(`/api/challans/${challanId}/cancel-transit`)
      .set(authHeader)
      .send({ reason: 'try' });
    expect(refused.status).toBe(422);
  });
});
