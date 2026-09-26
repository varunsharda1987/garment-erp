/**
 * Cancelling a purchase order — the guards (PO list bug hunt RA-1 / RA-3, 2026-09-27).
 *
 * Cancel handed the ADMIN override out implicitly: validateTransition lets every ADMIN (12 of 18
 * users) through any transition, so the list's Cancel on a stale row cancelled a part-received PO.
 * The cancel then reset the requirements and deleted their links (links are credited only at QC),
 * approveGRN never looked at the PO's status, and the goods still in QC were booked against a
 * CANCELLED PO while the same material sat re-orderable — a double purchase. A second cancel of a
 * cancelled PO overwrote who/when and appended a second reason.
 *
 * The contract the PO screens branch on (details.code, 422 unless noted):
 *   PO_ALREADY_CANCELLED · PO_DRAFT_DELETE_INSTEAD · PO_GOODS_RECEIVED · PO_GRN_PENDING_QC ·
 *   PO_STATUS_CHANGED · 403 for `force` from anyone but an ADMIN.
 * The requirement repair itself is pinned by po-cancel-requirement-revert.test.ts.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { grnService } from '../../services/grn.service';

const RUN = `POCG${Date.now().toString(36).toUpperCase()}`;

let adminHeader: Record<string, string>;
let purchaseHeader: Record<string, string>;
let adminId: string;
let purchaseUserId: string;
let supplierId: string;
let materialId: string;

const poIds: string[] = [];

type PoStatus = 'DRAFT' | 'SENT' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

async function makePO(suffix: string, status: PoStatus, extra: { remarks?: string; cancelledAt?: Date } = {}) {
  const po = await prisma.purchase_orders.create({
    data: {
      id: randomUUID(),
      poNumber: `${RUN}-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 20 * 86400000),
      status,
      createdById: adminId,
      remarks: extra.remarks,
      cancelledAt: extra.cancelledAt,
      cancelledById: extra.cancelledAt ? adminId : undefined,
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

async function makePendingGrn(poId: string, suffix: string) {
  return prisma.goods_receiving_notes.create({
    data: {
      id: randomUUID(),
      grnNumber: `${RUN}-GRN-${suffix}`,
      poId,
      supplierId,
      status: 'PENDING_QC',
      receivedById: adminId,
    },
  });
}

async function makeRequirement(suffix: string, status: 'PO_SENT' | 'PARTIALLY_RECEIVED', total: number) {
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
      totalRequired: total,
      shortfall: total,
      status,
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: adminId,
    },
  });
}

const cancel = (poId: string, body: Record<string, unknown>, header = adminHeader) =>
  request(app).patch(`/api/purchase-orders/${poId}/cancel`).set(header).send(body);

const statusOf = async (poId: string) =>
  (await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status;

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');

  // PURCHASE holds the purchaseOrders write permission, so a 403 for it can only come from the
  // force check — not from the route's permission gate.
  const buyer = await createTestUser({
    email: `test-${RUN.toLowerCase()}-pur@smoke.test`,
    role: 'PURCHASE',
    isActive: true,
    isApproved: true,
  });
  purchaseUserId = buyer.id;
  purchaseHeader = getAuthHeader(buyer.id, 'PURCHASE');

  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}SUP`, name: `${RUN} Supplier`, createdById: adminId } })
  ).id;

  const categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  materialId = (
    await prisma.materials.create({
      data: {
        id: randomUUID(),
        code: `${RUN}-MAT`,
        name: `${RUN} Material`,
        categoryId,
        materialType: 'OTHER',
        unit: 'METER',
      },
    })
  ).id;
});

afterAll(async () => {
  // Requirements keyed on the MATERIAL: a carried-forward child is minted from the real MR series,
  // so a RUN-prefix filter would leave it behind holding an FK (the po-cancel suite's lesson).
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: only(materialId) }, select: { id: true } })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  if (poIds.length > 0) {
    await prisma.audit_logs.deleteMany({ where: { entityType: 'purchase_order', entityId: { in: poIds } } });
    await prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } });
  }
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.users.deleteMany({ where: { id: { in: [only(adminId), only(purchaseUserId)] } } });
  await prisma.$disconnect();
});

describe('Cancel refuses what it must not do', () => {
  it('refuses a PO that is already cancelled — the first cancel keeps its who / when / reason', async () => {
    const cancelledAt = new Date(Date.now() - 3 * 86400000);
    const poId = await makePO('A', 'CANCELLED', { remarks: 'Cancellation reason: first', cancelledAt });

    const res = await cancel(poId, { reason: 'second' });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_ALREADY_CANCELLED');

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.remarks).toBe('Cancellation reason: first');
    expect(po.cancelledAt?.getTime()).toBe(cancelledAt.getTime());
  });

  it('refuses a draft — a draft is deleted, not cancelled', async () => {
    const poId = await makePO('B', 'DRAFT');
    const res = await cancel(poId, { reason: 'not needed' });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_DRAFT_DELETE_INSTEAD');
    expect(await statusOf(poId)).toBe('DRAFT');
  });

  it('refuses a part-received PO even for an ADMIN without force — Close Short is the exit', async () => {
    const poId = await makePO('C', 'PARTIALLY_RECEIVED');
    await makeItem(poId, 100, 40);

    const res = await cancel(poId, { reason: 'stale row' });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_GOODS_RECEIVED');
    expect(res.body.message).toMatch(/Close Short/);
    expect(await statusOf(poId)).toBe('PARTIALLY_RECEIVED');
  });

  it('refuses a fully received PO without force', async () => {
    const poId = await makePO('D', 'RECEIVED');
    const res = await cancel(poId, { reason: 'stale row' });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_GOODS_RECEIVED');
    expect(await statusOf(poId)).toBe('RECEIVED');
  });

  it('answers force from a non-ADMIN with 403 and changes nothing', async () => {
    const poId = await makePO('E', 'RECEIVED');
    const res = await cancel(poId, { reason: 'force it', force: true }, purchaseHeader);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN'); // the service's refusal, not the route permission gate
    expect(await statusOf(poId)).toBe('RECEIVED');
  });

  it('refuses a FORCED cancel while a GRN on the PO is still awaiting QC', async () => {
    const poId = await makePO('F', 'PARTIALLY_RECEIVED');
    await makeItem(poId, 100, 40);
    await makePendingGrn(poId, 'F');

    const res = await cancel(poId, { reason: 'force it', force: true });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_GRN_PENDING_QC');
    expect(res.body.message).toMatch(new RegExp(`${RUN}-GRN-F`));
    expect(await statusOf(poId)).toBe('PARTIALLY_RECEIVED');
  });

  it('refuses a plain cancel while a GRN is awaiting QC, too', async () => {
    const poId = await makePO('G', 'SENT');
    await makePendingGrn(poId, 'G');

    const res = await cancel(poId, { reason: 'supplier backed out' });
    expect(res.status).toBe(422);
    expect(res.body.details?.code).toBe('PO_GRN_PENDING_QC');
    expect(await statusOf(poId)).toBe('SENT');
  });
});

describe('Cancel claims the PO with its status in the WHERE', () => {
  it('lets exactly one of two simultaneous cancels through, with one reason recorded', async () => {
    const poId = await makePO('H', 'SENT');

    const [a, b] = await Promise.all([cancel(poId, { reason: 'tab one' }), cancel(poId, { reason: 'tab two' })]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 422]);

    const loser = a.status === 422 ? a : b;
    // Lost inside the transaction (PO_STATUS_CHANGED) or already refused before it (PO_ALREADY_CANCELLED)
    expect(['PO_STATUS_CHANGED', 'PO_ALREADY_CANCELLED']).toContain(loser.body.details?.code);

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('CANCELLED');
    expect(po.remarks?.match(/Cancellation reason/g)).toHaveLength(1);
  });
});

describe('A forced cancel by an ADMIN', () => {
  let poId: string;
  let reqSplitId: string;
  let reqUntouchedId: string;

  beforeAll(async () => {
    poId = await makePO('I', 'PARTIALLY_RECEIVED');
    const line1 = await makeItem(poId, 50, 20);
    const line2 = await makeItem(poId, 50, 10);

    // ONE requirement allocated across both lines: 50 + 50 ordered, 20 + 10 arrived → 70 outstanding.
    // The old per-link loop minted a child per link from requirement.shortfall (80, then 10).
    reqSplitId = (await makeRequirement('R1', 'PARTIALLY_RECEIVED', 100)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqSplitId,
        purchaseOrderId: poId,
        purchaseOrderItemId: line1.id,
        allocatedQuantity: 50,
        receivedQuantity: 20,
      },
    });
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqSplitId,
        purchaseOrderId: poId,
        purchaseOrderItemId: line2.id,
        allocatedQuantity: 50,
        receivedQuantity: 10,
      },
    });

    // And one nothing arrived for.
    reqUntouchedId = (await makeRequirement('R2', 'PO_SENT', 30)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqUntouchedId,
        purchaseOrderId: poId,
        purchaseOrderItemId: line2.id,
        allocatedQuantity: 30,
        receivedQuantity: 0,
      },
    });
  });

  it('cancels the part-received PO and says so in its remarks', async () => {
    const res = await cancel(poId, { reason: 'Entered against the wrong supplier', force: true });
    expect(res.status).toBe(200);

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('CANCELLED');
    expect(po.cancelledById).toBe(adminId);
    expect(po.remarks).toMatch(/forced by admin/i);
    expect(po.remarks).toMatch(/Entered against the wrong supplier/);
  });

  it('carries forward ONE balance per requirement, summed across its links', async () => {
    const children = await prisma.material_requirements.findMany({ where: { splitFromId: reqSplitId } });
    expect(children).toHaveLength(1);
    expect(Number(children[0].shortfall)).toBeCloseTo(70, 2);
    expect(children[0].status).toBe('PO_REQUIRED');

    const original = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqSplitId } });
    expect(Number(original.shortfall)).toBeCloseTo(30, 2);
    // The delivered links stay: they are the record of what this PO did deliver
    expect(await prisma.requirement_po_links.count({ where: { requirementId: reqSplitId } })).toBe(2);
  });

  it('hands the never-delivered requirement back to the plan', async () => {
    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqUntouchedId } });
    expect(req.status).toBe('PO_REQUIRED');
    expect(await prisma.requirement_po_links.count({ where: { requirementId: reqUntouchedId } })).toBe(0);
  });

  it('writes an audit row naming the override', async () => {
    const rows = await prisma.audit_logs.findMany({ where: { entityType: 'purchase_order', entityId: poId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(adminId);
    expect(rows[0].oldValues).toMatchObject({ status: 'PARTIALLY_RECEIVED' });
    expect(rows[0].newValues).toMatchObject({ status: 'CANCELLED', forced: true });
  });

  it('is a plain cancel on a PO that received nothing — no override, no audit row', async () => {
    const sentId = await makePO('J', 'SENT');
    const res = await cancel(sentId, { reason: 'supplier backed out', force: true });
    expect(res.status).toBe(200);
    expect(await statusOf(sentId)).toBe('CANCELLED');
    expect(await prisma.audit_logs.count({ where: { entityType: 'purchase_order', entityId: sentId } })).toBe(0);
  });
});

describe('approveGRN on a cancelled PO', () => {
  it('refuses to book the receipt — the demand was already handed back for re-ordering', async () => {
    const poId = await makePO('K', 'CANCELLED');
    const grn = await makePendingGrn(poId, 'K');

    await expect(grnService.approveGRN(grn.id, adminId)).rejects.toMatchObject({
      statusCode: 422,
      details: { code: 'GRN_PO_CANCELLED' },
    });
    expect((await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: grn.id } })).status).toBe('PENDING_QC');
  });
});
