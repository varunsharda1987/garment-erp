/**
 * Editing a purchase order must not strand the demand behind it (silent-data-loss finding #17).
 *
 * `updatePurchaseOrder` deleted every `purchase_order_items` row and recreated it with a fresh
 * uuid. All four child tables — requirement_po_links, service_requirement_po_links, po_source_links,
 * grn_items — are `onDelete: Cascade`, and `order_thread_requirements.poItemId` is SET NULL. So the
 * LINKS vanished while the demand rows kept their "already ordered" status.
 *
 * A material requirement sitting at PO_GENERATED with no link is unbuyable for ever: PO generation
 * only accepts PO_REQUIRED/PARTIAL_STOCK, the duplicate guard skips anything already ordered, the
 * recalc supersede pass excludes PO_GENERATED, and `scripts/recompute-requirement-statuses.ts`
 * explicitly declines to touch "no links but has PO status". The material is simply never bought.
 *
 * It was one click away by design: MRP creates every PO as DRAFT while creating the links and
 * flipping the requirements to PO_GENERATED, the list page offers Edit on DRAFT, and the form
 * ALWAYS sends `items` — so changing only the delivery date ran the destructive rebuild.
 *
 * The fix keeps item ids: a line the client names by id is updated in place, so its links are never
 * touched. Only genuinely removed lines are deleted, and their demand is handed back first.
 *
 * Not covered here: the service-requirement and thread-requirement legs of
 * `releasePurchaseOrderItemLinks`. They run through the same helper but need work-order / thread-
 * master fixtures; they are asserted by inspection only.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { purchaseOrderService } from '../../services/purchaseOrder.service';

const RUN = `POED${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let categoryId: string;

const supplierIds: string[] = [];
const materialIds: string[] = [];
const poIds: string[] = [];

async function makeSupplier(suffix: string) {
  const s = await prisma.suppliers.create({
    data: { code: `${RUN}${suffix}`, name: `${RUN} ${suffix}`, createdById: userId },
  });
  supplierIds.push(s.id);
  return s.id;
}

async function makeMaterial(suffix: string) {
  const m = await prisma.materials.create({
    data: {
      id: randomUUID(),
      code: `${RUN}-${suffix}`,
      name: `${RUN} ${suffix}`,
      categoryId,
      materialType: 'OTHER',
      unit: 'METER',
    },
  });
  materialIds.push(m.id);
  return m.id;
}

async function makePO(suffix: string, supplierId: string, status: 'DRAFT' | 'SENT' = 'DRAFT') {
  const po = await prisma.purchase_orders.create({
    data: {
      id: randomUUID(),
      poNumber: `${RUN}-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 20 * 86400000),
      status,
      poCategory: 'TRIMS',
      createdById: userId,
    },
  });
  poIds.push(po.id);
  return po.id;
}

async function makeItem(poId: string, materialId: string, qty: number, foldLengthCm?: number) {
  return prisma.purchase_order_items.create({
    data: {
      id: randomUUID(),
      poId,
      materialId,
      orderedQuantity: qty,
      receivedQuantity: 0,
      unitPrice: 10,
      totalPrice: qty * 10,
      unit: 'METER',
      foldLengthCm: foldLengthCm ?? null,
    },
  });
}

async function makeRequirement(suffix: string, materialId: string, qty: number) {
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
      totalRequired: qty,
      shortfall: qty,
      status: 'PO_GENERATED',
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: userId,
    },
  });
}

const editPO = (poId: string, body: Record<string, unknown>) =>
  request(app).put(`/api/purchase-orders/${poId}`).set(authHeader).send(body);

/** The payload shape PurchaseOrderForm sends, built from live rows. */
async function payloadFromDb(poId: string, opts: { withIds: boolean; drop?: string[] } = { withIds: true }) {
  const items = await prisma.purchase_order_items.findMany({ where: { poId }, orderBy: { id: 'asc' } });
  return items
    .filter((i) => !(opts.drop ?? []).includes(i.id))
    .map((i) => ({
      ...(opts.withIds ? { id: i.id } : {}),
      materialId: i.materialId ?? undefined,
      orderedQuantity: Number(i.orderedQuantity),
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
      foldLengthCm: i.foldLengthCm != null ? Number(i.foldLengthCm) : undefined,
    }));
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
  categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
});

afterAll(async () => {
  if (materialIds.length > 0) {
    const reqIds = (
      await prisma.material_requirements.findMany({
        where: { materialId: { in: materialIds } },
        select: { id: true },
      })
    ).map((r) => r.id);
    if (reqIds.length > 0) {
      await prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: reqIds } } });
      await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
    }
  }
  if (poIds.length > 0) {
    await prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } });
    await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } });
  }
  if (materialIds.length > 0) await prisma.materials.deleteMany({ where: { id: { in: materialIds } } });
  if (supplierIds.length > 0) await prisma.suppliers.deleteMany({ where: { id: { in: supplierIds } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('An ordinary PO edit leaves the MRP linkage completely alone', () => {
  let poId: string;
  let itemAId: string;
  let itemBId: string;
  let reqAId: string;
  let reqBId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('A');
    const matA = await makeMaterial('MATA');
    const matB = await makeMaterial('MATB');
    poId = await makePO('A', supplierId);
    itemAId = (await makeItem(poId, matA, 100, 42.5)).id;
    itemBId = (await makeItem(poId, matB, 200)).id;
    reqAId = (await makeRequirement('RA', matA, 100)).id;
    reqBId = (await makeRequirement('RB', matB, 200)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqAId,
        purchaseOrderId: poId,
        purchaseOrderItemId: itemAId,
        allocatedQuantity: 100,
        receivedQuantity: 0,
      },
    });
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqBId,
        purchaseOrderId: poId,
        purchaseOrderItemId: itemBId,
        allocatedQuantity: 200,
        receivedQuantity: 0,
      },
    });
  });

  it('changing only the delivery date keeps every item id', async () => {
    // This is the exact click that used to destroy the linkage: the form always resends `items`.
    const res = await editPO(poId, {
      expectedDeliveryDate: new Date(Date.now() + 45 * 86400000).toISOString(),
      items: await payloadFromDb(poId),
    });
    expect(res.status).toBe(200);

    const ids = (await prisma.purchase_order_items.findMany({ where: { poId }, select: { id: true } })).map(
      (i) => i.id
    );
    expect(ids.sort()).toEqual([itemAId, itemBId].sort());
  });

  it('keeps both requirement links, still pointing at the same items', async () => {
    const links = await prisma.requirement_po_links.findMany({ where: { purchaseOrderId: poId } });
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.purchaseOrderItemId).sort()).toEqual([itemAId, itemBId].sort());
  });

  it('leaves both requirements ordered — nothing is handed back that is still on the PO', async () => {
    const reqA = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqAId } });
    const reqB = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqBId } });
    expect(reqA.status).toBe('PO_GENERATED');
    expect(reqB.status).toBe('PO_GENERATED');
  });

  it('does not wipe the roll fold length', async () => {
    const item = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: itemAId } });
    expect(Number(item.foldLengthCm)).toBeCloseTo(42.5, 2);
  });

  it('applies the edit it was actually asked to make', async () => {
    const res = await editPO(poId, {
      items: (await payloadFromDb(poId)).map((i) => (i.id === itemAId ? { ...i, orderedQuantity: 150 } : i)),
    });
    expect(res.status).toBe(200);
    const item = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: itemAId } });
    expect(Number(item.orderedQuantity)).toBeCloseTo(150, 2);
    // ...and STILL holds its link.
    expect(await prisma.requirement_po_links.count({ where: { purchaseOrderItemId: itemAId } })).toBe(1);
  });
});

describe('Removing a line from a PO hands its demand back to the plan', () => {
  let poId: string;
  let keptItemId: string;
  let droppedItemId: string;
  let keptReqId: string;
  let droppedReqId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('B');
    const matKeep = await makeMaterial('MATK');
    const matDrop = await makeMaterial('MATD');
    poId = await makePO('B', supplierId);
    keptItemId = (await makeItem(poId, matKeep, 100)).id;
    droppedItemId = (await makeItem(poId, matDrop, 300)).id;
    keptReqId = (await makeRequirement('RK', matKeep, 100)).id;
    droppedReqId = (await makeRequirement('RD', matDrop, 300)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: keptReqId,
        purchaseOrderId: poId,
        purchaseOrderItemId: keptItemId,
        allocatedQuantity: 100,
        receivedQuantity: 0,
      },
    });
    await prisma.requirement_po_links.create({
      data: {
        requirementId: droppedReqId,
        purchaseOrderId: poId,
        purchaseOrderItemId: droppedItemId,
        allocatedQuantity: 300,
        receivedQuantity: 0,
      },
    });
  });

  it('makes the dropped line’s material orderable again and removes its link', async () => {
    const res = await editPO(poId, { items: await payloadFromDb(poId, { withIds: true, drop: [droppedItemId] }) });
    expect(res.status).toBe(200);

    const dropped = await prisma.material_requirements.findUniqueOrThrow({ where: { id: droppedReqId } });
    // PO_GENERATED with no link is the unbuyable state. It must come back to PO_REQUIRED.
    expect(dropped.status).toBe('PO_REQUIRED');
    // The link must go too — MRP's duplicate guard skips a requirement that still holds one.
    expect(await prisma.requirement_po_links.count({ where: { requirementId: droppedReqId } })).toBe(0);
  });

  it('leaves the line that stayed completely untouched', async () => {
    const kept = await prisma.material_requirements.findUniqueOrThrow({ where: { id: keptReqId } });
    expect(kept.status).toBe('PO_GENERATED');
    expect(await prisma.requirement_po_links.count({ where: { purchaseOrderItemId: keptItemId } })).toBe(1);
    expect(await prisma.purchase_order_items.count({ where: { poId } })).toBe(1);
  });
});

describe('A client that sends no item ids still cannot strand a requirement', () => {
  let poId: string;
  let reqId: string;

  beforeAll(async () => {
    const supplierId = await makeSupplier('C');
    const mat = await makeMaterial('MATC');
    poId = await makePO('C', supplierId);
    const item = await makeItem(poId, mat, 100);
    reqId = (await makeRequirement('RC', mat, 100)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqId,
        purchaseOrderId: poId,
        purchaseOrderItemId: item.id,
        allocatedQuantity: 100,
        receivedQuantity: 0,
      },
    });
  });

  it('matches an unambiguous single-material line by material and keeps the link', async () => {
    // Older clients send no ids. Matching on a material that appears exactly once on each side is a
    // fact, not a guess — so the line survives in place rather than being rebuilt.
    const res = await editPO(poId, { items: await payloadFromDb(poId, { withIds: false }) });
    expect(res.status).toBe(200);

    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqId } });
    const links = await prisma.requirement_po_links.count({ where: { requirementId: reqId } });

    // Whatever happens, the forbidden state is PO_GENERATED with zero links — unbuyable and silent.
    expect(req.status === 'PO_GENERATED' && links === 0).toBe(false);
    expect(links).toBe(1);
    expect(req.status).toBe('PO_GENERATED');
  });
});

describe('Guards', () => {
  it('refuses to edit away a line that has already received goods', async () => {
    const supplierId = await makeSupplier('D');
    const mat = await makeMaterial('MATE');
    const poId = await makePO('D', supplierId);
    const item = await makeItem(poId, mat, 100);
    const reqId = (await makeRequirement('RE', mat, 100)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqId,
        purchaseOrderId: poId,
        purchaseOrderItemId: item.id,
        allocatedQuantity: 100,
        receivedQuantity: 40,
      },
    });

    // Drop the received line entirely — reverting it would erase a real receipt from the plan.
    const res = await editPO(poId, {
      items: [{ materialId: await makeMaterial('MATF'), orderedQuantity: 10, unit: 'METER', unitPrice: 5 }],
    });
    expect(res.status).toBe(422);

    // Nothing moved.
    expect(await prisma.purchase_order_items.count({ where: { id: item.id } })).toBe(1);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqId } })).status).toBe(
      'PO_GENERATED'
    );
  });

  it('hands the demand back when the whole PO is deleted', async () => {
    const supplierId = await makeSupplier('E');
    const mat = await makeMaterial('MATG');
    const poId = await makePO('E', supplierId);
    const item = await makeItem(poId, mat, 100);
    const reqId = (await makeRequirement('RG', mat, 100)).id;
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqId,
        purchaseOrderId: poId,
        purchaseOrderItemId: item.id,
        allocatedQuantity: 100,
        receivedQuantity: 0,
      },
    });

    await purchaseOrderService.deletePurchaseOrder(poId);

    const req = await prisma.material_requirements.findUniqueOrThrow({ where: { id: reqId } });
    expect(req.status).toBe('PO_REQUIRED');
    expect(await prisma.requirement_po_links.count({ where: { requirementId: reqId } })).toBe(0);
  });
});
