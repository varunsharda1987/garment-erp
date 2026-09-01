/**
 * An order's frozen costing baseline must survive an item edit (silent-data-loss finding #12).
 *
 * PUT /orders/:id replaces order_items inside a transaction. order_item_costing is
 * `onDelete: Cascade` off order_items, so the replacement DESTROYS the snapshot that recorded
 * which cost sheet the order was sold against. The transaction then COMMITS, and only afterwards
 * — outside any transaction — the controller re-snapshots by reading the CURRENT approved sheet.
 *
 * So editing a quantity silently rebases the order onto whatever price was approved LATER. Live
 * example: ORD2026080030 is frozen at ESSKY091LS v1 (Rs225.42) while an approved v2 (Rs224.00)
 * now supersedes it — one edit and the agreed basis becomes Rs224.00, with nothing said. Worse,
 * when the style has no live approved sheet the re-snapshot fails, the failure is only logged,
 * and the order is left with NO costing row at all: no variance anchor, no version, no estimate.
 *
 * This violates the project's own rule that rates freeze at costing time and are never
 * re-derived downstream.
 *
 * Atomicity is covered too, without mocking: a breakup row pointing at a size that does not exist
 * raises a foreign-key error INSIDE the transaction, so the whole replacement must roll back and
 * leave the original items and their costing untouched.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `OCB${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let customerId: string;
let orderId: string;
let sheetV1Id: string;
let sheetV2Id: string;
let extraStyleId: string | undefined;

const V1_PRICE = 225.42;
const V2_PRICE = 224.0;
const ORDER_QTY = 500;

async function makeSheet(version: number, price: number) {
  return prisma.style_costing.create({
    data: {
      id: `CS-${Date.now()}-${RUN.toLowerCase()}v${version}`,
      styleId,
      createdById: userId,
      version,
      isApproved: true,
      approvalStatus: 'APPROVED',
      totalCostPerPiece: price,
      totalProductCost: price,
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

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  const customer = await prisma.customers.create({
    data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  // The sheet the order is placed against.
  sheetV1Id = (await makeSheet(1, V1_PRICE)).id;

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: ORDER_QTY,
      totalAmount: ORDER_QTY * 10,
      createdById: userId,
    },
  });
  orderId = order.id;

  const item = await prisma.order_items.create({
    data: { id: randomUUID(), orderId, styleId, totalQuantity: ORDER_QTY, unitPrice: 10, totalPrice: ORDER_QTY * 10 },
  });

  // The baseline as it stands when the order is placed: v1.
  await prisma.order_item_costing.create({
    data: {
      orderItemId: item.id,
      baseCostingId: sheetV1Id,
      totalCostPerPiece: V1_PRICE,
      estimatedCostPerPiece: V1_PRICE,
      originalCostSheetVersion: 1,
      snapshotCreatedAt: new Date(),
      costingSnapshot: { id: sheetV1Id, version: 1, totalCostPerPiece: V1_PRICE },
    },
  });

  // AFTER the order was placed, a cheaper v2 is approved and supersedes v1 — exactly the live
  // ESSKY091LS shape.
  sheetV2Id = (await makeSheet(2, V2_PRICE)).id;
  await prisma.style_costing.update({ where: { id: sheetV1Id }, data: { supersededById: sheetV2Id } });
});

afterAll(async () => {
  const itemIds = (await prisma.order_items.findMany({ where: { orderId: only(orderId) }, select: { id: true } })).map(
    (i) => i.id
  );
  if (itemIds.length > 0) {
    await prisma.order_item_costing.deleteMany({ where: { orderItemId: { in: itemIds } } });
  }
  await prisma.orders.deleteMany({ where: { id: only(orderId) } }); // cascades items
  await prisma.style_costing.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.styles.deleteMany({
    where: { id: { in: [styleId, extraStyleId].filter((v): v is string => typeof v === 'string') } },
  });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Editing an order keeps the costing baseline it was placed against', () => {
  it('does not rebase the order onto a cost sheet approved after it was placed', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set(authHeader)
      .send({
        items: [{ styleId, totalQuantity: 400, unitPrice: 10, breakup: [] }],
      });

    expect(res.status).toBe(200);

    const costing = await prisma.order_item_costing.findFirst({
      where: { order_item: { orderId } },
      select: { originalCostSheetVersion: true, baseCostingId: true, totalCostPerPiece: true, costingSnapshot: true },
    });

    // The order must still be anchored to the sheet it was SOLD on.
    expect(costing).not.toBeNull();
    expect(costing!.originalCostSheetVersion).toBe(1);
    expect(costing!.baseCostingId).toBe(sheetV1Id);
    expect(Number(costing!.totalCostPerPiece)).toBeCloseTo(V1_PRICE, 2);
    // ...and the snapshot JSON — the only record of the original rates — survives.
    expect(costing!.costingSnapshot).not.toBeNull();
  });

  it('leaves the order with a costing row even when the style has no live approved sheet', async () => {
    // Withdraw every approved sheet: the re-snapshot has nothing to find. The order must keep the
    // baseline it already had rather than being left with none.
    await prisma.style_costing.updateMany({ where: { styleId }, data: { isApproved: false } });

    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set(authHeader)
      .send({ items: [{ styleId, totalQuantity: 450, unitPrice: 10, breakup: [] }] });

    expect(res.status).toBe(200);

    const costing = await prisma.order_item_costing.findFirst({
      where: { order_item: { orderId } },
      select: { originalCostSheetVersion: true, totalCostPerPiece: true },
    });
    expect(costing).not.toBeNull();
    expect(costing!.originalCostSheetVersion).toBe(1);
    expect(Number(costing!.totalCostPerPiece)).toBeCloseTo(V1_PRICE, 2);

    await prisma.style_costing.updateMany({ where: { styleId }, data: { isApproved: true } });
  });

  it('carries every baseline column across the replacement, not just the headline ones', async () => {
    // The bug class this whole effort targets is a rebuild that silently drops columns, so pin
    // the less-obvious ones: variance results and their timestamps must survive an edit.
    const item = await prisma.order_items.findFirstOrThrow({ where: { orderId, styleId }, select: { id: true } });
    await prisma.order_item_costing.update({
      where: { orderItemId: item.id },
      data: {
        actualCostPerPiece: 231.5,
        costVarianceAmount: 6.08,
        costVariancePercent: 2.7,
        varianceCalculatedAt: new Date('2026-08-20T10:00:00Z'),
        recalculatedAt: new Date('2026-08-21T10:00:00Z'),
      },
    });

    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set(authHeader)
      .send({ items: [{ styleId, totalQuantity: 425, unitPrice: 10, breakup: [] }] });
    expect(res.status).toBe(200);

    const after = await prisma.order_item_costing.findFirstOrThrow({ where: { order_item: { orderId } } });
    expect(Number(after.actualCostPerPiece)).toBeCloseTo(231.5, 2);
    expect(Number(after.costVarianceAmount)).toBeCloseTo(6.08, 2);
    expect(Number(after.costVariancePercent)).toBeCloseTo(2.7, 2);
    expect(after.varianceCalculatedAt?.toISOString()).toBe('2026-08-20T10:00:00.000Z');
    expect(after.recalculatedAt?.toISOString()).toBe('2026-08-21T10:00:00.000Z');
  });

  it('rolls the whole edit back when the replacement fails midway, keeping items AND costing', async () => {
    const itemsBefore = await prisma.order_items.findMany({
      where: { orderId },
      select: { id: true, totalQuantity: true },
    });
    const costingBefore = await prisma.order_item_costing.findFirstOrThrow({ where: { order_item: { orderId } } });

    // A breakup row referencing a size that does not exist fails the FK inside the transaction,
    // AFTER the old items have been deleted and the costing re-attached. If any of that were
    // outside the transaction, the order would be left mangled.
    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set(authHeader)
      .send({
        items: [
          {
            styleId,
            totalQuantity: 10,
            unitPrice: 10,
            // colorId '' (not null) — the schema types it as a plain string and the controller
            // normalises '' to null. sizeId is a well-formed uuid that exists nowhere, so it
            // passes validation and fails the foreign key at the database, inside the transaction.
            breakup: [{ colorId: '', sizeId: randomUUID(), quantity: 10 }],
          },
        ],
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    // Must fail at the DATABASE, not at request validation — otherwise the transaction never ran
    // and the rollback assertions below would pass vacuously. A Prisma foreign-key error (P2003)
    // is mapped to "Referenced record does not exist" by the error middleware; a Zod rejection
    // says "Invalid request data". Pin the former.
    expect(res.body.message).toMatch(/Referenced record does not exist/i);

    const itemsAfter = await prisma.order_items.findMany({
      where: { orderId },
      select: { id: true, totalQuantity: true },
    });
    const costingAfter = await prisma.order_item_costing.findFirst({ where: { order_item: { orderId } } });

    // Nothing moved: same item ids, same quantities, costing still attached and unchanged.
    expect(itemsAfter.map((i) => i.id).sort()).toEqual(itemsBefore.map((i) => i.id).sort());
    expect(itemsAfter.map((i) => i.totalQuantity).sort()).toEqual(itemsBefore.map((i) => i.totalQuantity).sort());
    expect(costingAfter).not.toBeNull();
    expect(costingAfter!.originalCostSheetVersion).toBe(costingBefore.originalCostSheetVersion);
    expect(costingAfter!.orderItemId).toBe(costingBefore.orderItemId);
  });

  // LAST: this one leaves a second style on the order; afterAll removes both.
  it('snapshots a style that is NEW to the order, and reports it when there is no sheet to use', async () => {
    // A second style joins the order. It has no prior baseline, so it must get a fresh snapshot —
    // and when it has no approved sheet, the caller must be TOLD rather than only the log.
    const uncosted = await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S2`, styleName: `${RUN} Style 2`, createdById: userId },
    });
    extraStyleId = uncosted.id;

    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set(authHeader)
      .send({
        items: [
          { styleId, totalQuantity: 400, unitPrice: 10, breakup: [] },
          { styleId: uncosted.id, totalQuantity: 100, unitPrice: 12, breakup: [] },
        ],
      });

    expect(res.status).toBe(200);

    // The failure reaches the response, not just the server log.
    expect(res.body.costingInfo?.failures?.length).toBeGreaterThan(0);
    expect(res.body.costingInfo.failures.some((f: { styleId: string }) => f.styleId === uncosted.id)).toBe(true);

    // ...and the ORIGINAL style's baseline is still untouched by the edit.
    const items = await prisma.order_items.findMany({ where: { orderId }, select: { id: true, styleId: true } });
    const originalItem = items.find((i) => i.styleId === styleId)!;
    const costing = await prisma.order_item_costing.findUnique({ where: { orderItemId: originalItem.id } });
    expect(costing).not.toBeNull();
    expect(costing!.originalCostSheetVersion).toBe(1);
  });
});
