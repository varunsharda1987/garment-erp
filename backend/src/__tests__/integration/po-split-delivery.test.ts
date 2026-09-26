/**
 * PO delivery points — split delivery (direct-to-processor plan, Phase 3, 2026-09-26).
 *
 * The trigger: PO2609-0004, 10,000 m of Cotton Flex from Hardik, part to a dyer and the rest to Kashaya
 * Fabs. A PO now delivers to ONE place, to several places with a quantity each (po_delivery_points), or
 * is "to be advised". helpers/po-delivery-plan.helper.ts is the one writer; every change after sending is
 * a revision with a reason; received per place is derived from the receipts that name it.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { buildPurchaseOrderDocData } from '../../services/document-data/purchase-order.doc-data';
import { buildPoDeliveryInstructionDocData } from '../../services/document-data/po-delivery-instruction.doc-data';
import { documentFacadeService } from '../../services/document-facade.service';
import { companyProfileService } from '../../services/company-profile.service';
import { writeFileSync } from 'fs';
import { join } from 'path';

const RUN = `PSD${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';
const DAY = 24 * 60 * 60 * 1000;

let userId: string;
let authHeader: Record<string, string>;
let supplierId: string;
let dyerId: string;
let unitId: string;
let storeId: string;
let otherStoreId: string;
let greigeId: string;
let materialId: string;
const poIds: string[] = [];

async function createPo(body: Record<string, unknown>) {
  const res = await request(app)
    .post('/api/purchase-orders')
    .set(authHeader)
    .send({
      supplierId,
      expectedDeliveryDate: new Date(Date.now() + 5 * DAY).toISOString(),
      poCategory: 'GREIGE',
      ...body,
    });
  if (res.status === 201) poIds.push(res.body.data.id);
  return res;
}

const markSent = (poId: string) => prisma.purchase_orders.update({ where: { id: poId }, data: { status: 'SENT' } });

const receive = (poId: string, poItemId: string, qty: number, extra: Record<string, unknown> = {}) =>
  grnService.createGRN(
    {
      poId,
      receivingDate: new Date(),
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
      ...extra,
    } as never,
    userId
  );

const changeDelivery = (poId: string, body: Record<string, unknown>) =>
  request(app).put(`/api/purchase-orders/${poId}/delivery-plan`).set(authHeader).send(body);

const progressOf = async (poId: string) =>
  (await request(app).get(`/api/purchase-orders/${poId}/delivery-progress`).set(authHeader)).body.data;

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
  dyerId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-DY`, name: `${RUN} Dyer`, supplierCategories: ['DYEING_PRINTING'], createdById: userId },
    })
  ).id;
  unitId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-JW`,
        warehouseName: `${RUN} Dyer - Processing Unit`,
        warehouseType: 'JOB_WORK',
        supplierId: dyerId,
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  const mkStore = async (tag: string) =>
    (
      await prisma.warehouses.create({
        data: {
          warehouseCode: `${RUN}-${tag}`,
          warehouseName: `${RUN} ${tag}`,
          warehouseType: 'RAW_MATERIAL',
          createdById: userId,
        },
      })
    ).id;
  storeId = await mkStore('Store');
  otherStoreId = await mkStore('Annexe');
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
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const challanIds = (
    await prisma.challans.findMany({ where: { directSupplyGrnId: { in: grnIds } }, select: { id: true } })
  ).map((c) => c.id);
  const lotIds = (
    await prisma.greige_stock.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: lotIds } } });
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.greige_stock.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.fabric_procurement.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.stock_movements.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_transactions.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_levels.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  await prisma.po_delivery_plan_revisions.deleteMany({ where: { poId: { in: poIds } } });
  await prisma.po_delivery_points.deleteMany({ where: { poId: { in: poIds } } });
  await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } });
  await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } });
  const minted = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  await prisma.materials.deleteMany({ where: { OR: [{ greigeId: only(greigeId) }, { fabricId: { in: minted } }] } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: minted } } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({ where: { id: { in: [only(unitId), only(storeId), only(otherStoreId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerId), only(supplierId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('a PO split between a dyer and our store', () => {
  let poId: string;
  let poItemId: string;
  let dyerPointId: string;
  let storePointId: string;

  it('refuses a split whose places do not add up to the line', async () => {
    const res = await createPo({
      items: [
        {
          materialId,
          orderedQuantity: 10000,
          unit: 'METER',
          unitPrice: 67,
          deliveries: [
            { warehouseId: unitId, quantity: 4000 },
            { warehouseId: storeId, quantity: 5000 },
          ],
        },
      ],
    });
    expect(res.status).toBe(400);
  });

  it('creates 10,000 m as 4,000 to the dyer and 6,000 to the store; the header mirrors point 1', async () => {
    const res = await createPo({
      items: [
        {
          materialId,
          orderedQuantity: 10000,
          unit: 'METER',
          unitPrice: 67,
          deliveries: [
            { warehouseId: unitId, quantity: 4000 },
            { warehouseId: storeId, quantity: '6000' }, // a form posts strings
          ],
        },
      ],
    });
    expect(res.status).toBe(201);
    poId = res.body.data.id;
    poItemId = res.body.data.items[0].id;
    const points = res.body.data.deliveryPoints;
    expect(points.map((p: { warehouseId: string }) => p.warehouseId)).toEqual([unitId, storeId]);
    expect(Number(points[1].lines[0].quantity)).toBe(6000);
    dyerPointId = points[0].id;
    storePointId = points[1].id;
    expect(res.body.data.deliveryLocationId).toBe(unitId);
    expect(res.body.data.deliveryLocationType).toBe('PROCESSOR');
    expect(res.body.data.deliveryPlanRevisions).toHaveLength(0); // composing a draft is not an amendment
  });

  it('keeps the split adding up when a draft line changes (the difference goes to point 1)', async () => {
    const res = await request(app)
      .put(`/api/purchase-orders/${poId}/items/${poItemId}`)
      .set(authHeader)
      .send({ orderedQuantity: 10500 });
    expect(res.status).toBe(200);
    const lines = await prisma.po_delivery_point_lines.findMany({
      where: { deliveryPoint: { poId } },
      include: { deliveryPoint: true },
    });
    const byPlace = Object.fromEntries(lines.map((l) => [l.deliveryPoint.warehouseId, Number(l.quantity)]));
    expect(byPlace).toEqual({ [unitId]: 4500, [storeId]: 6000 });
    await request(app)
      .put(`/api/purchase-orders/${poId}/items/${poItemId}`)
      .set(authHeader)
      .send({ orderedQuantity: 10000 });
    await markSent(poId);
  });

  it('refuses a change after sending without a reason', async () => {
    const res = await changeDelivery(poId, {
      mode: 'SPLIT',
      points: [
        { warehouseId: unitId, lines: [{ poItemId, quantity: 3000 }] },
        { warehouseId: storeId, lines: [{ poItemId, quantity: 7000 }] },
      ],
    });
    expect(res.status).toBe(422);
    expect(res.body.details.code).toBe('DELIVERY_REASON_REQUIRED');
  });

  it('refuses a receipt that names no place, and one at a place not on the PO', async () => {
    await expect(receive(poId, poItemId, 1000)).rejects.toMatchObject({ details: { code: 'DELIVERY_POINT_REQUIRED' } });
    await expect(receive(poId, poItemId, 1000, { warehouseId: otherStoreId })).rejects.toMatchObject({
      details: { code: 'DELIVERY_POINT_REQUIRED' },
    });
  });

  it('books a receipt against its place, the warehouse defaulting from it', async () => {
    const grn = await receive(poId, poItemId, 3000, { poDeliveryPointId: storePointId });
    expect(grn.poDeliveryPointId).toBe(storePointId);
    expect(grn.warehouseId).toBe(storeId);
    expect(grn.deliveryWarnings).toEqual([]);
    // Inferred from the warehouse when it is exactly one place
    const inferred = await receive(poId, poItemId, 500, { warehouseId: storeId });
    expect(inferred.poDeliveryPointId).toBe(storePointId);

    const progress = await progressOf(poId);
    expect(progress.mode).toBe('SPLIT');
    const store = progress.points.find((p: { warehouseId: string }) => p.warehouseId === storeId);
    expect(store.lines[0]).toMatchObject({ planned: 6000, received: 3500, pending: 2500, complete: false });
    const dyer = progress.points.find((p: { warehouseId: string }) => p.warehouseId === unitId);
    expect(dyer.lines[0]).toMatchObject({ planned: 4000, received: 0, pending: 4000 });
  });

  it('warns — never blocks — when a place receives more than planned, or goods land elsewhere', async () => {
    const over = await receive(poId, poItemId, 3000, { poDeliveryPointId: storePointId });
    expect(over.deliveryWarnings.join(' ')).toMatch(/planned for 6000; with this receipt it has 6500/);
    const elsewhere = await receive(poId, poItemId, 100, {
      poDeliveryPointId: storePointId,
      warehouseId: otherStoreId,
    });
    expect(elsewhere.warehouseId).toBe(otherStoreId);
    expect(elsewhere.deliveryWarnings.join(' ')).toMatch(/booked at another place/);
    // Reject both so the store is back to 3,500 received
    await prisma.goods_receiving_notes.updateMany({
      where: { id: { in: [over.id, elsewhere.id] } },
      data: { status: 'REJECTED' },
    });
  });

  it('holds the receipt rules on every change', async () => {
    const reason = 'Dyer confirmed a smaller lot';
    // The store received 3,500: it cannot be dropped, nor planned below that
    let res = await changeDelivery(poId, {
      mode: 'SPLIT',
      points: [
        { warehouseId: unitId, lines: [{ poItemId, quantity: 7000 }] },
        { warehouseId: otherStoreId, lines: [{ poItemId, quantity: 3000 }] },
      ],
      reason,
    });
    expect(res.status).toBe(422);
    expect(['DELIVERY_PLACE_HAS_RECEIPTS', 'DELIVERY_POINT_HAS_GRN']).toContain(res.body.details.code);
    res = await changeDelivery(poId, {
      mode: 'SPLIT',
      points: [
        { warehouseId: unitId, lines: [{ poItemId, quantity: 7000 }] },
        { warehouseId: storeId, lines: [{ poItemId, quantity: 3000 }] },
      ],
      reason,
    });
    expect(res.body.details.code).toBe('DELIVERY_POINT_BELOW_RECEIVED');
    res = await changeDelivery(poId, { mode: 'TO_BE_ADVISED', reason });
    expect(res.body.details.code).toBe('DELIVERY_TBA_AFTER_RECEIPT');
    res = await changeDelivery(poId, { mode: 'ONE_PLACE', warehouseId: storeId, reason });
    expect(res.body.details.code).toBe('DELIVERY_UNSPLIT_AFTER_RECEIPT');
    // The old single-place door refuses a split PO
    res = await request(app)
      .patch(`/api/purchase-orders/${poId}/delivery-location`)
      .set(authHeader)
      .send({ deliveryLocationId: storeId, reason });
    expect(res.body.details.code).toBe('DELIVERY_PO_IS_SPLIT');
  });

  it('re-splits with a reason, writing a revision; a new place joins as point 3', async () => {
    const res = await changeDelivery(poId, {
      mode: 'SPLIT',
      points: [
        { warehouseId: unitId, lines: [{ poItemId, quantity: 3000 }] },
        { warehouseId: storeId, lines: [{ poItemId, quantity: 5000 }] },
        { warehouseId: otherStoreId, lines: [{ poItemId, quantity: 2000 }] },
      ],
      reason: 'Annexe takes 2,000 m',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.deliveryPoints.map((p: { id: string }) => p.id).slice(0, 2)).toEqual([
      dyerPointId,
      storePointId,
    ]);
    const revisions = res.body.data.deliveryPlanRevisions;
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({
      revisionNumber: 1,
      kind: 'SPLIT',
      poStatus: 'PARTIALLY_RECEIVED',
      reason: 'Annexe takes 2,000 m',
    });
    expect(revisions[0].before.points).toHaveLength(2);
    expect(revisions[0].after.points).toHaveLength(3);
  });

  it('prints every place with its quantities, the job-work note, and the amendment', async () => {
    await companyProfileService.getDefault();
    const doc = await buildPurchaseOrderDocData(poId);
    expect(doc.isSplit).toBe(true);
    expect(doc.deliverTo).toBe('Split across 3 places — see 03 Delivery Points');
    expect(doc.termsSectionNo).toBe('04');
    expect(doc.amendmentLine).toMatch(/^Amendment 1 · .* — supersedes earlier copies$/);
    expect(doc.shipTos.map((t) => [t.seq, t.isProcessor, t.lines[0].qty])).toEqual([
      [1, true, '3,000.00'],
      [2, false, '5,000.00'],
      [3, false, '2,000.00'],
    ]);
    const instruction = await buildPoDeliveryInstructionDocData(poId);
    expect(instruction.docNo).toMatch(/-DI-A1$/);
    expect(instruction.shipTos).toHaveLength(3);
    // KF_PREVIEW_DIR=<folder> writes both PDFs for a look
    if (process.env.KF_PREVIEW_DIR) {
      writeFileSync(
        join(process.env.KF_PREVIEW_DIR, 'po-split.pdf'),
        await documentFacadeService.generatePurchaseOrderPDF(poId)
      );
      writeFileSync(
        join(process.env.KF_PREVIEW_DIR, 'po-delivery-instruction.pdf'),
        await documentFacadeService.generatePoDeliveryInstructionPDF(poId)
      );
    }
  });

  it("books the dyer's delivery as held there without asking — the plan says it goes there", async () => {
    const grn = await receive(poId, poItemId, 3000, { poDeliveryPointId: dyerPointId });
    expect(grn.warehouseId).toBe(unitId);
    await grnService.approveGRN(grn.id, userId, unitId); // no directDeliveryConfirmed
    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, warehouseId: unitId } });
    expect(lot).toMatchObject({ sourceType: 'DIRECT', processorId: dyerId });
    expect(await prisma.challans.count({ where: { directSupplyGrnId: grn.id } })).toBe(1);
    const dyer = (await progressOf(poId)).points.find((p: { warehouseId: string }) => p.warehouseId === unitId);
    expect(dyer.lines[0]).toMatchObject({ planned: 3000, received: 3000, complete: true });
  });
});

describe('one place, to be advised, and splitting after a receipt', () => {
  let poId: string;
  let poItemId: string;

  it('goes from "to be advised" to one place with a revision, and receipts link to the place when split later', async () => {
    const res = await createPo({ items: [{ materialId, orderedQuantity: 5000, unit: 'METER', unitPrice: 60 }] });
    expect(res.status).toBe(201);
    poId = res.body.data.id;
    poItemId = res.body.data.items[0].id;
    expect(res.body.data.deliveryLocationId).toBeNull();
    await markSent(poId);

    let change = await changeDelivery(poId, {
      mode: 'ONE_PLACE',
      warehouseId: storeId,
      reason: 'Supplier ready to dispatch',
    });
    expect(change.status).toBe(200);
    expect(change.body.data.deliveryLocationId).toBe(storeId);
    expect(change.body.data.deliveryPlanRevisions[0]).toMatchObject({ kind: 'ONE_PLACE', revisionNumber: 1 });

    const grn = await receive(poId, poItemId, 2000, { warehouseId: storeId });
    expect(grn.poDeliveryPointId).toBeNull();

    // Back to "to be advised" is refused after a receipt; moving the whole PO elsewhere too
    change = await changeDelivery(poId, { mode: 'TO_BE_ADVISED', reason: 'x' });
    expect(change.body.details.code).toBe('DELIVERY_TBA_AFTER_RECEIPT');
    change = await changeDelivery(poId, { mode: 'ONE_PLACE', warehouseId: unitId, reason: 'x' });
    expect(change.body.details.code).toBe('DELIVERY_PLACE_HAS_RECEIPTS');

    // A split keeps what the store received, and the earlier receipt now names the store's point
    change = await changeDelivery(poId, {
      mode: 'SPLIT',
      points: [
        { warehouseId: storeId, lines: [{ poItemId, quantity: 2000 }] },
        { warehouseId: unitId, lines: [{ poItemId, quantity: 3000 }] },
      ],
      reason: 'Rest straight to the dyer',
    });
    expect(change.status).toBe(200);
    const storePoint = change.body.data.deliveryPoints.find((p: { warehouseId: string }) => p.warehouseId === storeId);
    expect((await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: grn.id } })).poDeliveryPointId).toBe(
      storePoint.id
    );
    expect(change.body.data.deliveryPlanRevisions.map((r: { revisionNumber: number }) => r.revisionNumber)).toEqual([
      2, 1,
    ]);
  });

  it('lets the old single-place door work on an unsplit draft, and requires a reason once sent', async () => {
    const res = await createPo({ items: [{ materialId, orderedQuantity: 100, unit: 'METER', unitPrice: 60 }] });
    const id = res.body.data.id;
    let amend = await request(app)
      .patch(`/api/purchase-orders/${id}/delivery-location`)
      .set(authHeader)
      .send({ deliveryLocationId: storeId });
    expect(amend.status).toBe(200);
    expect(amend.body.data.deliveryPlanRevisions[0]).toMatchObject({ poStatus: 'DRAFT', reason: null });
    await markSent(id);
    amend = await request(app)
      .patch(`/api/purchase-orders/${id}/delivery-location`)
      .set(authHeader)
      .send({ deliveryLocationId: unitId });
    expect(amend.body.details.code).toBe('DELIVERY_REASON_REQUIRED');
  });
});
