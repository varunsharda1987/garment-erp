/**
 * An order that needs less gives its goods back to the line (2026-10-03).
 *
 * ESSKY091LS's S labels went 525 → 336, but its PO link and receipt hold stayed at 525: MRP only wrote
 * surplusQty, so 189 labels stayed locked away from the next order. shrinkRequirementToNeed lowers the
 * requirement, its link and its hold; the line is recomputed and the freed goods fill the next order in line.
 *
 * Through the REAL approveGRN; tagged fixtures, everything torn down.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { shrinkRequirementToNeed } from '../../services/helpers/po-allocation.helper';
import { receiptHeldByRequirement } from '../../services/helpers/stock-reservation.helper';

const RUN = `PAS${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let supplierId: string;
let customerId: string;
let storeId: string;
let trimId: string;
const orderIds: string[] = [];
const poIds: string[] = [];
let reqSeq = 0;

async function makeOrder(n: number, deliveryInDays: number) {
  const id = randomUUID();
  await prisma.orders.create({
    data: {
      id,
      orderNumber: `${RUN}ORD${n}`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + deliveryInDays * DAY),
      totalQuantity: 100,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderIds.push(id);
  return id;
}

async function makePo(orderedQuantity: number) {
  const poId = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id: poId,
      poNumber: `${RUN}-PO${poIds.length + 1}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 10 * DAY),
      status: 'SENT',
      poCategory: 'OTHER_MATERIAL',
      createdById: userId,
    },
  });
  poIds.push(poId);
  const poItemId = randomUUID();
  await prisma.purchase_order_items.create({
    data: {
      id: poItemId,
      poId,
      materialId: trimId,
      orderedQuantity,
      receivedQuantity: 0,
      unitPrice: 2,
      totalPrice: orderedQuantity * 2,
      unit: 'PIECE',
    },
  });
  return { poId, poItemId };
}

async function linkedRequirement(orderId: string, qty: number, poId: string, poItemId: string, fillOrder: number) {
  const reqId = (
    await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-MR${++reqSeq}`,
        source: 'MANUAL',
        unit: 'PIECE',
        materialId: trimId,
        orderId,
        orderQuantity: qty,
        quantityPerUnit: 1,
        wastagePercent: 0,
        totalRequired: qty,
        shortfall: qty,
        status: 'PO_SENT',
        requiredDate: new Date(Date.now() + 20 * DAY),
        createdById: userId,
      },
    })
  ).id;
  const linkId = (
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqId,
        purchaseOrderId: poId,
        purchaseOrderItemId: poItemId,
        allocatedQuantity: qty,
        fillOrder,
      },
    })
  ).id;
  return { reqId, linkId };
}

async function receive(poId: string, poItemId: string, qty: number) {
  const grn = await grnService.createGRN(
    {
      poId,
      invoiceToFollow: true,
      warehouseId: storeId,
      items: [
        {
          poItemId,
          materialId: trimId,
          receivedQuantity: qty,
          acceptedQuantity: qty,
          rejectedQuantity: 0,
          unit: 'PIECE',
          weaverNotKnown: true,
        },
      ],
    } as never,
    userId
  );
  await grnService.approveGRN(grn.id, userId, storeId);
}

const linkFigures = async (linkIds: string[]) => {
  const rows = await prisma.requirement_po_links.findMany({ where: { id: { in: linkIds } } });
  return linkIds.map((id) => {
    const r = rows.find((x) => x.id === id);
    return r ? [Number(r.allocatedQuantity), Number(r.receivedQuantity)] : null;
  });
};
const heldOf = async (reqIds: string[]) => {
  const map = await receiptHeldByRequirement(prisma, reqIds);
  return reqIds.map((id) => map.get(id) ?? 0);
};
const shrink = (reqId: string, to: number) =>
  prisma.$transaction((tx) => shrinkRequirementToNeed(tx, reqId, to, userId), { timeout: 30000 });

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  supplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}-SUP`, name: `${RUN} Supplier`, createdById: userId } })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  storeId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-ST`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  trimId = (
    await prisma.other_material_master.create({ data: { materialCode: `${RUN}-TAG`, materialName: `${RUN} Hang tag` } })
  ).id;
  await ensureMaterialRecord(trimId, 'OTHER_MATERIAL');
  await makeOrder(1, 10);
  await makeOrder(2, 20);
});

afterAll(async () => {
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: only(trimId) } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['trim lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(trimId) } })],
    ['movements', () => prisma.stock_movements.deleteMany({ where: { materialId: only(trimId) } })],
    ['transactions', () => prisma.stock_transactions.deleteMany({ where: { materialId: only(trimId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: only(trimId) } })],
    ['grn details', () => prisma.grn_item_details.deleteMany({ where: { grn_items: { grnId: { in: grnIds } } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: only(trimId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['warehouse', () => prisma.warehouses.deleteMany({ where: { id: only(storeId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: only(trimId) } })],
    ['trim master', () => prisma.other_material_master.deleteMany({ where: { id: only(trimId) } })],
    ['supplier', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-shrink teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the order needs less of goods already here', () => {
  let a: { reqId: string; linkId: string };
  let b: { reqId: string; linkId: string };

  beforeAll(async () => {
    const { poId, poItemId } = await makePo(1000);
    a = await linkedRequirement(orderIds[0], 700, poId, poItemId, 1);
    b = await linkedRequirement(orderIds[1], 300, poId, poItemId, 2);
    await receive(poId, poItemId, 800); // order 1 full (700), order 2 short (100 of 300)
  });

  it('before: the first order holds 700, the second 100', async () => {
    expect(await linkFigures([a.linkId, b.linkId])).toEqual([
      [700, 700],
      [300, 100],
    ]);
    expect(await heldOf([a.reqId, b.reqId])).toEqual([700, 100]);
  });

  it('the first order now needs 500: its 200 spare go to the second order at once', async () => {
    const result = await shrink(a.reqId, 500);
    expect(result).toMatchObject({ shrunk: 200, stuck: 0 });
    expect(await linkFigures([a.linkId, b.linkId])).toEqual([
      [500, 500],
      [300, 300],
    ]);
    expect(await heldOf([a.reqId, b.reqId])).toEqual([500, 300]);
    const reqs = await prisma.material_requirements.findMany({ where: { id: { in: [a.reqId, b.reqId] } } });
    const byId = new Map(reqs.map((r) => [r.id, r]));
    expect(Number(byId.get(a.reqId)!.totalRequired)).toBe(500);
    expect(byId.get(a.reqId)!.surplusQty).toBeNull();
    expect(byId.get(a.reqId)!.status).toBe('RECEIVED');
    expect(byId.get(b.reqId)!.status).toBe('RECEIVED');
  });
});

describe('the order needs less of goods still to come', () => {
  it('the unreceived part comes off its link first; nothing it holds moves', async () => {
    const { poId, poItemId } = await makePo(400);
    const c = await linkedRequirement(orderIds[0], 400, poId, poItemId, 1);
    await receive(poId, poItemId, 150);

    const result = await shrink(c.reqId, 250);
    expect(result).toMatchObject({ shrunk: 150, stuck: 0 });
    expect(await linkFigures([c.linkId])).toEqual([[250, 150]]);
    expect(await heldOf([c.reqId])).toEqual([150]);
  });

  it('a requirement no longer needed at all, with nothing received, leaves the PO', async () => {
    const { poId, poItemId } = await makePo(100);
    const d = await linkedRequirement(orderIds[1], 100, poId, poItemId, 1);
    // Nothing arrived yet: the link alone is lowered, and with nothing left it is removed
    const result = await shrink(d.reqId, 0);
    expect(result).toMatchObject({ shrunk: 100, stuck: 0 });
    expect(await linkFigures([d.linkId])).toEqual([null]);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: d.reqId } })).status).toBe('CANCELLED');
  });
});
