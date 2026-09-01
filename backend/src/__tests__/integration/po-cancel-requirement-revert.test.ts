/**
 * Cancelling a PO must leave its unfulfilled material requirements ORDERABLE
 * (silent-data-loss finding #13).
 *
 * cancelPurchaseOrder reverted linked requirements with
 * `updateMany({ where: { id: { in: ... }, status: 'PO_GENERATED' }, ... })`. Two holes:
 *
 *   - a requirement moved to PO_SENT (PO issued to the supplier) matches nothing, and
 *   - a requirement moved to PARTIALLY_RECEIVED (a GRN arrived for part of it) matches nothing.
 *
 * Both stay pinned to the CANCELLED PO forever. They can never be re-ordered: PO generation only
 * accepts PO_REQUIRED/PARTIAL_STOCK, and the duplicate guard skips anything already in
 * PO_GENERATED/PO_SENT/PARTIALLY_RECEIVED/RECEIVED. The MRP "needing PO" tile counts only
 * PO_REQUIRED/PARTIAL_STOCK, so the shortfall vanishes from the procurement screen entirely.
 * updateMany returns { count: 0 }, which is never checked and is indistinguishable from success,
 * and the API answers "Purchase order cancelled successfully".
 *
 * Material that was ordered, part-delivered, then cancelled simply disappears from the plan —
 * discovered when production stops for want of it.
 *
 * The correct behaviour, mirroring the job-work-order cancel path which already gets this right:
 * a link with nothing received is fully reverted and its link row removed; a link with a partial
 * receipt keeps the received part booked and mints an orderable child requirement for the balance.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `POC${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let supplierId: string;
let materialId: string;
let categoryId: string;
let poId: string;
let poItemUntouchedId: string;
let poItemPartialId: string;
let reqSentId: string;
let reqPartialId: string;

const SHORTFALL = 100;
const RECEIVED_ON_PARTIAL = 40;

async function makeRequirement(number: string, status: 'PO_SENT' | 'PARTIALLY_RECEIVED') {
  return prisma.material_requirements.create({
    data: {
      id: randomUUID(),
      requirementNumber: number,
      source: 'WORK_ORDER',
      unit: 'METER',
      materialId,
      orderQuantity: 500,
      quantityPerUnit: 0.2,
      wastagePercent: 0,
      totalRequired: SHORTFALL,
      shortfall: SHORTFALL,
      status,
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: userId,
    },
  });
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const supplier = await prisma.suppliers.create({
    data: { code: `${RUN}SUP`, name: `${RUN} Supplier`, createdById: userId },
  });
  supplierId = supplier.id;

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

  // One requirement the supplier never delivered against, one part-delivered.
  reqSentId = (await makeRequirement(`${RUN}-R1`, 'PO_SENT')).id;
  reqPartialId = (await makeRequirement(`${RUN}-R2`, 'PARTIALLY_RECEIVED')).id;

  const po = await prisma.purchase_orders.create({
    data: {
      id: randomUUID(),
      poNumber: `${RUN}-PO`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 20 * 86400000),
      status: 'PARTIALLY_RECEIVED',
      createdById: userId,
    },
  });
  poId = po.id;

  const mkItem = async (qty: number, received: number) =>
    prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId,
        materialId,
        orderedQuantity: qty,
        receivedQuantity: received,
        unitPrice: 10,
        totalPrice: qty * 10,
        unit: 'METER',
      },
    });

  poItemUntouchedId = (await mkItem(SHORTFALL, 0)).id;
  poItemPartialId = (await mkItem(SHORTFALL, RECEIVED_ON_PARTIAL)).id;

  await prisma.requirement_po_links.create({
    data: {
      requirementId: reqSentId,
      purchaseOrderId: poId,
      purchaseOrderItemId: poItemUntouchedId,
      allocatedQuantity: SHORTFALL,
      receivedQuantity: 0,
    },
  });
  await prisma.requirement_po_links.create({
    data: {
      requirementId: reqPartialId,
      purchaseOrderId: poId,
      purchaseOrderItemId: poItemPartialId,
      allocatedQuantity: SHORTFALL,
      receivedQuantity: RECEIVED_ON_PARTIAL,
    },
  });
});

afterAll(async () => {
  // Key on the material, not the RUN prefix: the carried-forward child requirement is minted by
  // the real MR atomic series, so a prefix filter would leave it behind holding an FK on the
  // material and silently leak a row into the live database.
  const reqIds = (
    await prisma.material_requirements.findMany({
      where: { materialId: only(materialId) },
      select: { id: true },
    })
  ).map((r) => r.id);
  if (reqIds.length > 0) {
    await prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: reqIds } } });
    await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  }
  await prisma.purchase_order_items.deleteMany({ where: { poId: only(poId) } });
  await prisma.purchase_orders.deleteMany({ where: { id: only(poId) } });
  await prisma.materials.deleteMany({ where: { id: only(materialId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Cancelling a purchase order leaves its unfulfilled material orderable', () => {
  it('cancels and does not strand any requirement', async () => {
    const res = await request(app)
      .patch(`/api/purchase-orders/${poId}/cancel`)
      .set(authHeader)
      .send({ reason: 'Supplier defaulted on the balance' });

    expect([200, 201]).toContain(res.status);

    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('CANCELLED');

    // NOTHING may be left pinned to a cancelled PO in a state PO generation refuses to touch.
    const stranded = await prisma.material_requirements.findMany({
      where: {
        requirementNumber: { startsWith: RUN },
        status: { in: ['PO_GENERATED', 'PO_SENT'] },
      },
      select: { requirementNumber: true, status: true },
    });
    expect(stranded).toEqual([]);
  });

  it('makes the never-delivered requirement orderable again and drops its link', async () => {
    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqSentId } });
    // PO_SENT is explicitly revertible per the state machine — it was simply not in the filter.
    expect(req.status).toBe('PO_REQUIRED');

    const links = await prisma.requirement_po_links.findMany({ where: { requirementId: reqSentId } });
    // The link must go too: MRP's duplicate guard skips a requirement that still has one.
    expect(links).toEqual([]);
  });

  it('keeps the received part booked and carries the undelivered balance forward', async () => {
    const original = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqPartialId } });

    // The 40 already delivered stays accounted for on the original row — it is not re-planned.
    expect(Number(original.shortfall)).toBeCloseTo(RECEIVED_ON_PARTIAL, 2);

    // ...and the 60 that never arrived exists as its own orderable requirement.
    const child = await prisma.material_requirements.findFirst({
      where: { splitFromId: reqPartialId },
      select: { shortfall: true, totalRequired: true, status: true, materialId: true },
    });
    expect(child).not.toBeNull();
    expect(Number(child!.shortfall)).toBeCloseTo(SHORTFALL - RECEIVED_ON_PARTIAL, 2);
    expect(child!.status).toBe('PO_REQUIRED');
    expect(child!.materialId).toBe(materialId);
  });
});
