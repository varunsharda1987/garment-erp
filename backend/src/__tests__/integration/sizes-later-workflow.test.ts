/**
 * Sizes-later workflow (2026-08-29).
 *
 * Orders are deliberately created WITHOUT a size split so long-lead greige/dyeing/printing
 * procurement can start; the sizes arrive later. Two rules follow, and this suite locks both:
 *
 *  1. MRP must never silently drop a size-wise label just because the split is unknown. The
 *     total is already known, so the label is planned as ONE SIZE_PENDING requirement at full
 *     quantity — visible, deliberately not orderable (every PO path allowlists
 *     PO_REQUIRED/PARTIAL_STOCK). Previously it was skipped outright and vanished from the plan.
 *  2. Entering the sizes later must cascade: per-size requirements replace the aggregate, and
 *     production work orders (impossible while the order had no sizes) get created — WITHOUT
 *     destroying the order item, which PUT /orders/:id would do.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { calculateRequirementsFromOrder, linkRequirementToPO } from '../../services/mrp.service';
import { validateTransition } from '../../utils/stateMachine';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SZL${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let customerId: string;
let orderId: string;
let orderItemId: string;
let orderBomId: string;
let sizeIds: string[] = [];
let labelId: string;
let plainLabelId: string;

const ORDER_QTY = 600;
const SIZES = ['S', 'M', 'L'];

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

  for (const s of SIZES) {
    const so = await prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: s, sizeCode: s } });
    sizeIds.push(so.id);
  }

  const customer = await prisma.customers.create({
    data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  // A size-wise label (one variant per size) and a plain label (no variants) as the control
  const sizeLabel = await prisma.label_master.create({
    data: { labelCode: `${RUN}-SZ`, labelName: `${RUN} Size Label` },
  });
  labelId = sizeLabel.id;
  await prisma.materials.create({
    data: {
      id: labelId,
      code: `${RUN}-SZ`,
      name: sizeLabel.labelName,
      categoryId: (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id,
      materialType: 'LABEL',
      unit: 'PIECE',
      labelId,
    },
  });
  for (const s of SIZES) {
    await prisma.label_size_variants.create({ data: { id: randomUUID(), labelId, size: s, isActive: true } });
  }

  const plainLabel = await prisma.label_master.create({
    data: { labelCode: `${RUN}-PL`, labelName: `${RUN} Plain Label` },
  });
  plainLabelId = plainLabel.id;
  await prisma.materials.create({
    data: {
      id: plainLabelId,
      code: `${RUN}-PL`,
      name: plainLabel.labelName,
      categoryId: (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id,
      materialType: 'LABEL',
      unit: 'PIECE',
      labelId: plainLabelId,
    },
  });

  // Order created WITHOUT any size breakup — the whole point of this workflow
  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: ORDER_QTY,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderId = order.id;

  const orderItem = await prisma.order_items.create({
    data: { id: randomUUID(), orderId, styleId, totalQuantity: ORDER_QTY, unitPrice: 10, totalPrice: 6000 },
  });
  orderItemId = orderItem.id;

  const bom = await prisma.order_bom.create({
    data: { orderId, styleId, createdById: userId, status: 'APPROVED', isActive: true },
  });
  orderBomId = bom.id;

  for (const [idx, lid] of [labelId, plainLabelId].entries()) {
    await prisma.order_bom_items.create({
      data: {
        id: randomUUID(),
        orderBomId,
        materialType: 'LABEL',
        labelId: lid,
        componentName: idx === 0 ? 'Size Label' : 'Plain Label',
        quantityPerGarment: 1,
        orderQuantity: ORDER_QTY,
        totalQuantity: ORDER_QTY,
        unit: 'PIECE',
        unitPrice: 1,
        totalCost: ORDER_QTY,
        sortOrder: idx,
      },
    });
  }
});

afterAll(async () => {
  await prisma.material_requirements.deleteMany({ where: { orderId } });
  await prisma.work_order_breakup.deleteMany({ where: { work_orders: { orderId } } });
  await prisma.production_tracking.deleteMany({ where: { work_orders: { orderId } } });
  await prisma.work_orders.deleteMany({ where: { orderId } });
  await prisma.order_bom_items.deleteMany({ where: { orderBomId } });
  await prisma.order_bom.deleteMany({ where: { orderId } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } }); // cascades items + breakup
  await prisma.label_size_variants.deleteMany({ where: { labelId } });
  await prisma.materials.deleteMany({ where: { id: { in: [labelId, plainLabelId] } } });
  await prisma.label_master.deleteMany({ where: { id: { in: [labelId, plainLabelId] } } });
  await prisma.size_options.deleteMany({ where: { styleId } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('sizes-later workflow', () => {
  it('plans a size-wise label as SIZE_PENDING at full quantity instead of skipping it', async () => {
    const result = await calculateRequirementsFromOrder({ orderId, checkStock: false }, userId);

    // The old behaviour dropped it entirely; nothing may be skipped now
    expect(result.skipped).toHaveLength(0);
    expect(result.sizePending.map((s) => s.componentName)).toContain('Size Label');

    const reqs = await prisma.material_requirements.findMany({
      where: { orderId, status: { not: 'CANCELLED' } },
      include: { materials: { select: { labelId: true, sizeVariantId: true } } },
    });

    const pending = reqs.filter((r) => r.status === 'SIZE_PENDING');
    expect(pending).toHaveLength(1);
    expect(Number(pending[0].totalRequired)).toBe(ORDER_QTY); // full total, not zero
    expect(pending[0].materials.labelId).toBe(labelId);
    expect(pending[0].materials.sizeVariantId).toBeNull(); // the BASE label material

    // The plain label has no variants, so it plans normally — this is the discriminator
    const plain = reqs.filter((r) => r.materials.labelId === plainLabelId);
    expect(plain).toHaveLength(1);
    expect(plain[0].status).toBe('PO_REQUIRED');
  });

  it('refuses to put a SIZE_PENDING requirement on a purchase order', async () => {
    const pending = await prisma.material_requirements.findFirstOrThrow({
      where: { orderId, status: 'SIZE_PENDING' },
    });

    // linkRequirementToPO is the one PO path built on a DENYLIST rather than an allowlist, so
    // it is the one that could actually flip this row to PO_GENERATED — ordering labels whose
    // sizes nobody has chosen, and permanently shielding the row from the recalculation that
    // should replace it with per-size lines.
    await expect(
      linkRequirementToPO(
        {
          requirementId: pending.id,
          purchaseOrderId: randomUUID(),
          purchaseOrderItemId: randomUUID(),
          allocatedQuantity: Number(pending.totalRequired),
        },
        userId
      )
    ).rejects.toThrow(/size breakdown/i);

    const stillPending = await prisma.material_requirements.findUnique({ where: { id: pending.id } });
    expect(stillPending!.status).toBe('SIZE_PENDING');

    // And the state machine must not offer a manual promotion back into an orderable state
    expect(validateTransition('materialRequirement', 'SIZE_PENDING', 'PO_REQUIRED').valid).toBe(false);
  });

  it('rejects a size breakdown whose total differs from the order, until confirmed', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${orderItemId}/size-breakup`)
      .set(authHeader)
      .send({ breakup: sizeIds.map((id) => ({ colorId: null, sizeId: id, quantity: 100 })) }) // 300 ≠ 600
      .expect(422); // BusinessError

    expect(res.body.details?.code || res.body.code).toBe('QUANTITY_CHANGE_REQUIRES_CONFIRMATION');

    const breakupRows = await prisma.order_item_breakup.count({ where: { orderItemId } });
    expect(breakupRows).toBe(0); // nothing written on the refused call
  });

  it('rejects sizes that do not belong to the style', async () => {
    const otherStyle = await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}X`, styleName: `${RUN} Other`, createdById: userId },
    });
    const foreignSize = await prisma.size_options.create({
      data: { id: randomUUID(), styleId: otherStyle.id, sizeName: 'XXL', sizeCode: 'XXL' },
    });

    await request(app)
      .put(`/api/orders/${orderId}/items/${orderItemId}/size-breakup`)
      .set(authHeader)
      .send({ breakup: [{ colorId: null, sizeId: foreignSize.id, quantity: ORDER_QTY }] })
      .expect(400);

    await prisma.size_options.deleteMany({ where: { id: foreignSize.id } });
    await prisma.styles.deleteMany({ where: { id: otherStyle.id } });
  });

  it('entering the sizes replaces the pending row with per-size requirements, keeping the order item', async () => {
    const per = ORDER_QTY / SIZES.length;
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${orderItemId}/size-breakup`)
      .set(authHeader)
      .send({ breakup: sizeIds.map((id) => ({ colorId: null, sizeId: id, quantity: per })) })
      .expect(200);

    expect(res.body.data.quantityChanged).toBe(false);

    // The order item itself must survive — PUT /orders/:id would have recreated it with a new id
    const item = await prisma.order_items.findUnique({ where: { id: orderItemId } });
    expect(item).not.toBeNull();
    expect(item!.totalQuantity).toBe(ORDER_QTY);

    const active = await prisma.material_requirements.findMany({
      where: { orderId, status: { not: 'CANCELLED' } },
      include: { materials: { select: { labelId: true, sizeVariantId: true } } },
    });

    expect(active.filter((r) => r.status === 'SIZE_PENDING')).toHaveLength(0);

    const perSize = active.filter((r) => r.materials.labelId === labelId && r.materials.sizeVariantId);
    expect(perSize).toHaveLength(SIZES.length);
    expect(perSize.reduce((sum, r) => sum + Number(r.totalRequired), 0)).toBe(ORDER_QTY);
  });

  it('is idempotent — recalculating again does not duplicate the per-size rows', async () => {
    const before = await prisma.material_requirements.count({ where: { orderId, status: { not: 'CANCELLED' } } });
    await calculateRequirementsFromOrder({ orderId, checkStock: false }, userId);
    const after = await prisma.material_requirements.count({ where: { orderId, status: { not: 'CANCELLED' } } });
    expect(after).toBe(before);
  });

  it('applies a deliberate quantity change when confirmed', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/items/${orderItemId}/size-breakup`)
      .set(authHeader)
      .send({
        breakup: sizeIds.map((id) => ({ colorId: null, sizeId: id, quantity: 100 })), // 300
        confirmQuantityChange: true,
      })
      .expect(200);

    expect(res.body.data.quantityChanged).toBe(true);
    expect(res.body.data.newTotal).toBe(300);

    const item = await prisma.order_items.findUnique({ where: { id: orderItemId } });
    expect(item!.totalQuantity).toBe(300);
  });
});
