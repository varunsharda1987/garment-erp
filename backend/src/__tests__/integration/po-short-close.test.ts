/**
 * Short-closing a partially-received purchase order.
 *
 * A supplier delivers 40 of 100 and tells us the balance is not coming. Until now the only exits
 * from PARTIALLY_RECEIVED were RECEIVED (claims it all arrived — corrupts any three-way match) and
 * CANCELLED (claims nothing arrived — misrepresents the supplier ledger, payments and GST). This
 * suite pins the third, honest exit: SHORT_CLOSED.
 *
 * The load-bearing guard here is NOT the new endpoint — it is `updateReceivingStatus`. That method
 * re-derives PO status after every GRN event (create / approve / reject / reverse) and its upgrade
 * branch used a RAW update with no status filter and no state-machine consultation. A QC verdict
 * landing after the close would silently flip the PO back to PARTIALLY_RECEIVED or RECEIVED,
 * erasing the audit answer and re-admitting the PO to the GRN whitelist. Removing the status
 * filter from that write makes "survives a later QC verdict" fail.
 *
 * Short-close ends a procurement DEMAND. It moves no stock and it is not a way to erase goods —
 * material short-returned by a processor stays abnormal loss recovered by debit note, which the
 * open-JWO guard below protects.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { purchaseOrderService } from '../../services/purchaseOrder.service';
import { grnService } from '../../services/grn.service';
import { supplierService } from '../../services/supplier.service';
import { checkForDuplicatePOs } from '../../services/unified-po-creation.service';

const RUN = `POSC${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let categoryId: string;
let materialId: string;

const supplierIds: string[] = [];
const poIds: string[] = [];
const extraUserIds: string[] = [];
const extraMaterialIds: string[] = [];

async function makeSupplier(suffix: string) {
  const supplier = await prisma.suppliers.create({
    data: { code: `${RUN}${suffix}`, name: `${RUN} ${suffix} Supplier`, createdById: userId },
  });
  supplierIds.push(supplier.id);
  return supplier.id;
}

async function makePO(opts: {
  suffix: string;
  supplierId: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'PENDING_GREIGE';
  poCategory?: 'GREIGE' | 'PROCESSING' | 'TRIMS';
  linkedGreigePOId?: string;
}) {
  const po = await prisma.purchase_orders.create({
    data: {
      id: randomUUID(),
      poNumber: `${RUN}-${opts.suffix}`,
      supplierId: opts.supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 20 * 86400000),
      status: opts.status,
      poCategory: opts.poCategory,
      linkedGreigePOId: opts.linkedGreigePOId,
      createdById: userId,
    },
  });
  poIds.push(po.id);
  return po.id;
}

async function makeItem(poId: string, ordered: number, received: number) {
  return prisma.purchase_order_items.create({
    data: {
      id: randomUUID(),
      poId,
      materialId,
      orderedQuantity: ordered,
      receivedQuantity: received,
      unitPrice: 10,
      totalPrice: ordered * 10,
      unit: 'METER',
    },
  });
}

async function makeRequirement(suffix: string, status: 'PO_SENT' | 'PARTIALLY_RECEIVED', totalRequired: number) {
  return prisma.material_requirements.create({
    data: {
      id: randomUUID(),
      requirementNumber: `${RUN}-${suffix}`,
      source: 'WORK_ORDER',
      unit: 'METER',
      materialId,
      orderQuantity: 500,
      quantityPerUnit: 0.2,
      wastagePercent: 0,
      totalRequired,
      shortfall: totalRequired,
      status,
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: userId,
    },
  });
}

async function link(requirementId: string, poId: string, poItemId: string, allocated: number, received: number) {
  return prisma.requirement_po_links.create({
    data: {
      requirementId,
      purchaseOrderId: poId,
      purchaseOrderItemId: poItemId,
      allocatedQuantity: allocated,
      receivedQuantity: received,
    },
  });
}

/** Count + summed quantity of every stock table short-close must never touch. */
async function stockFingerprint() {
  const [greige, fabric, levels] = await Promise.all([
    prisma.greige_stock.aggregate({
      _count: true,
      _sum: { quantityAvailable: true, quantityReserved: true, quantityConsumed: true },
    }),
    prisma.fabric_stock.aggregate({
      _count: true,
      _sum: { quantityAvailable: true, quantityReserved: true, quantityConsumed: true },
    }),
    prisma.stock_levels.aggregate({ _count: true, _sum: { quantity: true } }),
  ]);
  const n = (v: unknown) => Number(v ?? 0);
  return JSON.stringify({
    greige: [
      greige._count,
      n(greige._sum.quantityAvailable),
      n(greige._sum.quantityReserved),
      n(greige._sum.quantityConsumed),
    ],
    fabric: [
      fabric._count,
      n(fabric._sum.quantityAvailable),
      n(fabric._sum.quantityReserved),
      n(fabric._sum.quantityConsumed),
    ],
    levels: [levels._count, n(levels._sum.quantity)],
  });
}

const shortClose = (poId: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/purchase-orders/${poId}/short-close`).set(authHeader).send(body);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  const material = await prisma.materials.create({
    data: {
      id: randomUUID(),
      code: `${RUN}-MAT`,
      name: `${RUN} Material`,
      categoryId,
      materialType: 'OTHER',
      unit: 'METER',
    },
  });
  materialId = material.id;
});

afterAll(async () => {
  // Key requirement cleanup on the MATERIAL, not the RUN prefix: a carried-forward balance child is
  // minted from the real MR atomic series, so a prefix filter would leave it behind holding an FK
  // and silently leak a row into the live database (the po-cancel suite's lesson).
  const allMaterialIds = [only(materialId), ...extraMaterialIds];
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: { in: allMaterialIds } }, select: { id: true } })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  if (supplierIds.length > 0) {
    await prisma.job_work_orders.deleteMany({ where: { processorId: { in: supplierIds } } });
    const grnIds = (
      await prisma.goods_receiving_notes.findMany({ where: { supplierId: { in: supplierIds } }, select: { id: true } })
    ).map((g) => g.id);
    if (grnIds.length > 0) {
      await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
      await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
    }
  }
  if (poIds.length > 0) {
    await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } });
  }
  await prisma.materials.deleteMany({ where: { id: { in: allMaterialIds } } });
  if (supplierIds.length > 0) {
    await prisma.suppliers.deleteMany({ where: { id: { in: supplierIds } } });
  }
  await prisma.users.deleteMany({ where: { id: { in: [only(userId), ...extraUserIds] } } });
  await prisma.$disconnect();
});

describe('Short-closing a partially-received PO', () => {
  const REASON = 'Supplier confirmed the balance cannot be supplied this season';
  let poId: string;
  let supplierId: string;
  let itemUntouchedId: string;
  let itemPartialId: string;
  let reqUntouchedId: string;
  let reqPartialId: string;
  let stockBefore: string;
  let stockAfter: string;

  beforeAll(async () => {
    supplierId = await makeSupplier('A');
    poId = await makePO({ suffix: 'A', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'TRIMS' });
    itemUntouchedId = (await makeItem(poId, 100, 0)).id;
    itemPartialId = (await makeItem(poId, 100, 40)).id;
    reqUntouchedId = (await makeRequirement('A1', 'PO_SENT', 100)).id;
    reqPartialId = (await makeRequirement('A2', 'PARTIALLY_RECEIVED', 100)).id;
    await link(reqUntouchedId, poId, itemUntouchedId, 100, 0);
    await link(reqPartialId, poId, itemPartialId, 100, 40);
  });

  it('closes the order SHORT_CLOSED — not CANCELLED, not RECEIVED — with a full audit trail', async () => {
    // Snapshot immediately around the call: this runs against the shared dev database, so a wider
    // window would fingerprint unrelated activity and fail for the wrong reason.
    stockBefore = await stockFingerprint();
    const res = await shortClose(poId, { reason: REASON });
    stockAfter = await stockFingerprint();
    expect(res.status).toBe(200);

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('SHORT_CLOSED');
    expect(po.shortCloseReason).toBe(REASON);
    expect(po.shortClosedById).toBe(userId);
    expect(po.shortClosedAt).toBeInstanceOf(Date);
  });

  it('frees the line the supplier never delivered against and drops its link', async () => {
    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqUntouchedId } });
    expect(req.status).toBe('PO_REQUIRED');
    expect(await prisma.requirement_po_links.findMany({ where: { requirementId: reqUntouchedId } })).toEqual([]);
  });

  it('closes the part-delivered requirement at what arrived and STATES the short', async () => {
    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqPartialId } });
    expect(req.status).toBe('RECEIVED');
    expect(Number(req.shortfall)).toBeCloseTo(40, 2);
    // The short is recorded, not left to arithmetic.
    expect(Number(req.shortQuantity)).toBeCloseTo(60, 2);
    expect(req.shortCloseReason).toBe(REASON);

    // The link stays — it is the record of what this PO actually delivered.
    const links = await prisma.requirement_po_links.findMany({ where: { requirementId: reqPartialId } });
    expect(links).toHaveLength(1);
  });

  it('does NOT re-plan the balance by default — that is the whole point of the verb', async () => {
    const children = await prisma.material_requirements.findMany({ where: { splitFromId: reqPartialId } });
    expect(children).toEqual([]);
  });

  it('moves no stock whatsoever', () => {
    expect(stockAfter).toBe(stockBefore);
  });

  it('stays SHORT_CLOSED when a QC verdict is decided afterwards', async () => {
    // Every GRN event (create / approve / reject / reverse) funnels into updateReceivingStatus.
    // An approve that tops the counters up to ordered must not upgrade a closed PO to RECEIVED...
    await purchaseOrderService.updateReceivingStatus(poId);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('SHORT_CLOSED');

    await prisma.purchase_order_items.update({ where: { id: itemUntouchedId }, data: { receivedQuantity: 100 } });
    await prisma.purchase_order_items.update({ where: { id: itemPartialId }, data: { receivedQuantity: 100 } });
    await purchaseOrderService.updateReceivingStatus(poId);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('SHORT_CLOSED');

    // ...and a rejection that nets the counters back to zero must not downgrade it either.
    await prisma.purchase_order_items.update({ where: { id: itemUntouchedId }, data: { receivedQuantity: 0 } });
    await prisma.purchase_order_items.update({ where: { id: itemPartialId }, data: { receivedQuantity: 0 } });
    await purchaseOrderService.updateReceivingStatus(poId);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('SHORT_CLOSED');

    // Restore the delivered numbers so the rest of the suite reads real state.
    await prisma.purchase_order_items.update({ where: { id: itemPartialId }, data: { receivedQuantity: 40 } });
  });

  it('refuses a NEW goods receipt against the closed order', async () => {
    await expect(
      grnService.createGRN({ poId, items: [{ poItemId: itemPartialId, receivedQuantity: 10 }] } as never, userId)
    ).rejects.toThrow(/SHORT_CLOSED/);
  });

  it('cannot be short-closed twice', async () => {
    const res = await shortClose(poId, { reason: 'again' });
    expect(res.status).toBe(422);
  });

  it('no longer blocks deactivating the supplier — the order is finished', async () => {
    const result = await supplierService.validateDeactivation(supplierId);
    expect(result.blockers.map((b) => b.type)).not.toContain('Open Purchase Orders');
  });

  it('refuses to have its delivery location amended — there is nothing left to deliver', async () => {
    await expect(purchaseOrderService.amendDeliveryLocation(poId, randomUUID(), userId)).rejects.toThrow(
      /SHORT_CLOSED/
    );
  });

  it('refuses to reverse an already-accepted GRN against it', async () => {
    // Reversal re-opens receipt history, which would contradict the shortQuantity this close froze
    // onto the requirements. It must be a 422 refusal naming the PO, not a 500.
    const warehouse = await prisma.warehouses.findFirst({ select: { id: true } });
    const grn = await prisma.goods_receiving_notes.create({
      data: {
        id: randomUUID(),
        grnNumber: `${RUN}-GRN-REV`,
        poId,
        supplierId,
        warehouseId: warehouse?.id ?? null,
        status: 'ACCEPTED',
        receivedById: userId,
      },
    });

    await expect(grnService.reverseGRN(grn.id, userId, 'test')).rejects.toThrow(/closed short/i);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('SHORT_CLOSED');
  });

  it('does not count as an open PO for the duplicate-PO warning', async () => {
    // Otherwise the replacement PO for the very balance this feature carries forward would raise a
    // permanent "duplicate PO" warning against the order that is already finished.
    const dup = await checkForDuplicatePOs([materialId]);
    const poNumbers = dup.duplicates.flatMap((d) => (d.existingPOs ?? []).map((p) => p.poNumber));
    expect(poNumbers).not.toContain(`${RUN}-A`);
  });
});

describe('Cancel is no longer the exit for a part-delivered PO', () => {
  it('is refused on PARTIALLY_RECEIVED — Close Short is the honest verb', async () => {
    const supplierId = await makeSupplier('L');
    const poId = await makePO({ suffix: 'L', supplierId, status: 'PARTIALLY_RECEIVED' });
    await makeItem(poId, 100, 40);

    // Non-admin: the state machine no longer offers CANCELLED from PARTIALLY_RECEIVED.
    const user = await createTestUser({
      email: `test-${RUN.toLowerCase()}-pur@smoke.test`,
      role: 'PURCHASE',
      isActive: true,
      isApproved: true,
    });
    extraUserIds.push(user.id);

    const res = await request(app)
      .patch(`/api/purchase-orders/${poId}/cancel`)
      .set(getAuthHeader(user.id, 'PURCHASE'))
      .send({ reason: 'wrong verb' });
    expect(res.status).not.toBe(200);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('PARTIALLY_RECEIVED');
  });

  it('is refused on a SHORT_CLOSED PO even for an ADMIN — the override must not erase the answer', async () => {
    const supplierId = await makeSupplier('M');
    const poId = await makePO({ suffix: 'M', supplierId, status: 'PARTIALLY_RECEIVED' });
    await makeItem(poId, 100, 40);
    expect((await shortClose(poId, { reason: 'closed short' })).status).toBe(200);

    const res = await request(app)
      .patch(`/api/purchase-orders/${poId}/cancel`)
      .set(authHeader)
      .send({ reason: 'undo it' });
    expect(res.status).toBe(422);

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('SHORT_CLOSED');
    expect(po.shortCloseReason).toBe('closed short');
  });
});

describe('Short-close with reorderBalance', () => {
  let poId: string;
  let reqId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('B');
    poId = await makePO({ suffix: 'B', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'TRIMS' });
    const item = await makeItem(poId, 100, 40);
    reqId = (await makeRequirement('B1', 'PARTIALLY_RECEIVED', 100)).id;
    await link(reqId, poId, item.id, 100, 40);
  });

  it('carries exactly one orderable balance requirement forward when asked', async () => {
    const res = await shortClose(poId, { reason: 'Balance still needed for the next lot', reorderBalance: true });
    expect(res.status).toBe(200);

    const children = await prisma.material_requirements.findMany({ where: { splitFromId: reqId } });
    expect(children).toHaveLength(1);
    expect(Number(children[0].shortfall)).toBeCloseTo(60, 2);
    expect(Number(children[0].totalRequired)).toBeCloseTo(60, 2);
    expect(children[0].status).toBe('PO_REQUIRED');
    expect(children[0].materialId).toBe(materialId);

    // The parent still closes at what arrived — the child is the balance, not a re-plan of the lot.
    const parent = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqId } });
    expect(parent.status).toBe('RECEIVED');
    expect(Number(parent.shortfall)).toBeCloseTo(40, 2);
    expect(Number(parent.shortQuantity)).toBeCloseTo(60, 2);
  });
});

describe('Short-close on a consolidated PO line', () => {
  let poId: string;
  let reqAId: string;
  let reqBId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('C');
    poId = await makePO({ suffix: 'C', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'TRIMS' });
    // ONE PO line of 200 serving TWO requirements of 100 each; 120 arrived, split 70/50.
    const item = await makeItem(poId, 200, 120);
    reqAId = (await makeRequirement('C1', 'PARTIALLY_RECEIVED', 100)).id;
    reqBId = (await makeRequirement('C2', 'PARTIALLY_RECEIVED', 100)).id;
    await link(reqAId, poId, item.id, 100, 70);
    await link(reqBId, poId, item.id, 100, 50);
  });

  it('takes the short from each LINK, not from the shared PO item', async () => {
    const res = await shortClose(poId, { reason: 'Consolidated line closed short' });
    expect(res.status).toBe(200);

    const reqA = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqAId } });
    const reqB = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqBId } });

    // PO-item basis would give both requirements 200 - 120 = 80 short. Link basis gives 30 and 50.
    expect(Number(reqA.shortfall)).toBeCloseTo(70, 2);
    expect(Number(reqA.shortQuantity)).toBeCloseTo(30, 2);
    expect(Number(reqB.shortfall)).toBeCloseTo(50, 2);
    expect(Number(reqB.shortQuantity)).toBeCloseTo(50, 2);
  });
});

describe('Short-close with a requirement spread over several lines of the same PO', () => {
  let poId: string;
  let reqId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('N');
    poId = await makePO({ suffix: 'N', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'TRIMS' });
    // One requirement of 150 allocated across TWO lines of this PO: 100 (70 arrived) + 50 (20 arrived).
    const itemA = await makeItem(poId, 100, 70);
    const itemB = await makeItem(poId, 50, 20);
    reqId = (await makeRequirement('N1', 'PARTIALLY_RECEIVED', 150)).id;
    await link(reqId, poId, itemA.id, 100, 70);
    await link(reqId, poId, itemB.id, 50, 20);
  });

  it('sums the links instead of letting the last one overwrite the others', async () => {
    expect((await shortClose(poId, { reason: 'Split allocation closed short' })).status).toBe(200);

    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqId } });
    // Per-link handling would leave whichever link was processed last: shortfall 20, short 30.
    expect(Number(req.shortfall)).toBeCloseTo(90, 2);
    expect(Number(req.shortQuantity)).toBeCloseTo(60, 2);
  });
});

describe('Short-close is refused where it would lie', () => {
  it('is refused on a DRAFT order — nothing was ever ordered out', async () => {
    const supplierId = await makeSupplier('D');
    const poId = await makePO({ suffix: 'D', supplierId, status: 'DRAFT' });
    await makeItem(poId, 100, 0);
    const res = await shortClose(poId, { reason: 'no' });
    expect(res.status).toBe(422);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('DRAFT');
  });

  it('is refused on a SENT order with nothing delivered — that one is a cancellation', async () => {
    const supplierId = await makeSupplier('E');
    const poId = await makePO({ suffix: 'E', supplierId, status: 'SENT' });
    await makeItem(poId, 100, 0);
    expect((await shortClose(poId, { reason: 'no' })).status).toBe(422);
  });

  it('is refused on a fully RECEIVED order', async () => {
    const supplierId = await makeSupplier('F');
    const poId = await makePO({ suffix: 'F', supplierId, status: 'RECEIVED' });
    await makeItem(poId, 100, 100);
    expect((await shortClose(poId, { reason: 'no' })).status).toBe(422);
  });

  it('is unreachable on an OVER-supplied order — the two variance paths cannot collide', async () => {
    const supplierId = await makeSupplier('G');
    const poId = await makePO({ suffix: 'G', supplierId, status: 'PARTIALLY_RECEIVED' });
    await makeItem(poId, 100, 110); // over-receipt within tolerance
    await purchaseOrderService.updateReceivingStatus(poId);

    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('RECEIVED');
    expect((await shortClose(poId, { reason: 'no' })).status).toBe(422);
  });

  it('is refused while a GRN for the order is still awaiting QC', async () => {
    const supplierId = await makeSupplier('H');
    const poId = await makePO({ suffix: 'H', supplierId, status: 'PARTIALLY_RECEIVED' });
    await makeItem(poId, 100, 40);
    await prisma.goods_receiving_notes.create({
      data: {
        id: randomUUID(),
        grnNumber: `${RUN}-GRN-H`,
        poId,
        supplierId,
        status: 'PENDING_QC',
        receivedById: userId,
      },
    });

    const res = await shortClose(poId, { reason: 'close it' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/QC/i);
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('PARTIALLY_RECEIVED');
  });

  it('is refused while an open job work order references the PO — the debit-note gate stands', async () => {
    const supplierId = await makeSupplier('I');
    const poId = await makePO({ suffix: 'I', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'PROCESSING' });
    await makeItem(poId, 100, 40);
    await prisma.job_work_orders.create({
      data: {
        id: randomUUID(),
        jobWorkNumber: `${RUN}-JWO`,
        processType: 'DYEING',
        processorId: supplierId,
        purchaseOrderId: poId,
        qtySentMeters: 100,
        agreedRatePerMeter: 25,
        jwoStatus: 'AT_PROCESSOR',
        createdById: userId,
      },
    });

    const res = await shortClose(poId, { reason: 'close it' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(new RegExp(`${RUN}-JWO`));
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('PARTIALLY_RECEIVED');
  });

  it('requires a reason', async () => {
    const supplierId = await makeSupplier('J');
    const poId = await makePO({ suffix: 'J', supplierId, status: 'PARTIALLY_RECEIVED' });
    await makeItem(poId, 100, 40);
    expect((await shortClose(poId, {})).status).toBe(400);
    expect((await shortClose(poId, { reason: '' })).status).toBe(400);
  });
});

describe('A greige PO that delivered nothing for a material does NOT release a zero-quantity processing PO', () => {
  let greigePOId: string;
  let processingPOId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('O');
    // Two greige lines: one delivered (so the PO is legitimately PARTIALLY_RECEIVED), one not.
    // The processing PO covers ONLY the material that never arrived.
    greigePOId = await makePO({ suffix: 'O-GRG', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'GREIGE' });
    await makeItem(greigePOId, 100, 60);

    const other = await prisma.materials.create({
      data: {
        id: randomUUID(),
        code: `${RUN}-MAT2`,
        name: `${RUN} Material 2`,
        categoryId,
        materialType: 'OTHER',
        unit: 'METER',
      },
    });
    extraMaterialIds.push(other.id);
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId: greigePOId,
        materialId: other.id,
        orderedQuantity: 80,
        receivedQuantity: 0,
        unitPrice: 10,
        totalPrice: 800,
        unit: 'METER',
      },
    });

    processingPOId = await makePO({
      suffix: 'O-PRC',
      supplierId,
      status: 'PENDING_GREIGE',
      poCategory: 'PROCESSING',
      linkedGreigePOId: greigePOId,
    });
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId: processingPOId,
        materialId: other.id,
        orderedQuantity: 80,
        receivedQuantity: 0,
        unitPrice: 25,
        totalPrice: 2000,
        unit: 'METER',
      },
    });
  });

  it('leaves it PENDING_GREIGE rather than sending the processor an order for nothing', async () => {
    expect((await shortClose(greigePOId, { reason: 'Second colour never arrived' })).status).toBe(200);

    const processingPO = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: processingPOId } });
    expect(processingPO.status).toBe('PENDING_GREIGE');
  });
});

describe('Short-closing a GREIGE PO releases its downstream processing PO', () => {
  let greigePOId: string;
  let processingPOId: string;
  let processingItemId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('K');
    greigePOId = await makePO({ suffix: 'K-GRG', supplierId, status: 'PARTIALLY_RECEIVED', poCategory: 'GREIGE' });
    await makeItem(greigePOId, 100, 60);

    processingPOId = await makePO({
      suffix: 'K-PRC',
      supplierId,
      status: 'PENDING_GREIGE',
      poCategory: 'PROCESSING',
      linkedGreigePOId: greigePOId,
    });
    processingItemId = (await makeItem(processingPOId, 100, 0)).id;
  });

  it('flips PENDING_GREIGE to READY_FOR_PROCESSING, reconciled to the greige that actually arrived', async () => {
    // Without this, the processing PO waits in PENDING_GREIGE forever for cloth that is not coming.
    expect((await shortClose(greigePOId, { reason: 'Mill could not complete the lot' })).status).toBe(200);

    const processingPO = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: processingPOId } });
    expect(processingPO.status).toBe('READY_FOR_PROCESSING');

    const item = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: processingItemId } });
    expect(Number(item.orderedQuantity)).toBeCloseTo(60, 2);
  });
});
