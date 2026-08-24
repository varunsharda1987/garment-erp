/**
 * sale-order-status.helper — pins the derived sale_orders.status contract (landmine №2 fix).
 *
 * Progress states derive from item facts, dispatch ranked above allocation; DRAFT /
 * CANCELLED / DELIVERED are pinned commercial states the recompute never overwrites.
 * The House of Kasya B2B app reads this column live (docs/B2B_INTEGRATION_GUIDE.md §4) —
 * the regression this pins: releasing reserved stock on a partly-shipped order must NOT
 * step the buyer-facing badge back to CONFIRMED (which also made DELIVERED unreachable).
 */

import { deriveSaleOrderProgress, recomputeSaleOrderStatus } from '../helpers/sale-order-status.helper';
import { saleOrderService } from '../saleOrder.service';
import prisma from '../../config/database';
import { randomUUID } from 'crypto';

describe('sale-order-status.helper', () => {
  const RUN = `TSOS${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let customerId: string;
  let styleId: string;
  let sizeId: string;
  let saleOrderId: string;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: `${RUN.toLowerCase()}@test.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;

    const customer = await prisma.customers.create({
      data: {
        code: `${RUN}-CUST`,
        name: `${RUN} Customer`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    });
    customerId = customer.id;

    const style = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode: `${RUN}-STYLE`,
        styleName: `${RUN} Style`,
        createdById: testUserId,
      },
    });
    styleId = style.id;

    const size = await prisma.size_options.create({
      data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: 'M' },
    });
    sizeId = size.id;
  });

  beforeEach(async () => {
    const so = await prisma.sale_orders.create({
      data: {
        id: randomUUID(),
        saleOrderNumber: `${RUN}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
        customerId,
        status: 'CONFIRMED',
        createdById: testUserId,
      },
    });
    saleOrderId = so.id;
  });

  afterEach(async () => {
    await prisma.sale_orders.deleteMany({ where: { id: saleOrderId } }); // items cascade
  });

  afterAll(async () => {
    try {
      await prisma.sale_orders.deleteMany({ where: { saleOrderNumber: { startsWith: RUN } } });
      await prisma.styles.deleteMany({ where: { id: styleId } });
      await prisma.customers.deleteMany({ where: { id: customerId } });
      await prisma.users.deleteMany({ where: { id: testUserId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  function addItem(quantity: number, allocatedQty = 0, dispatchedQty = 0) {
    return prisma.sale_order_items.create({
      data: {
        id: randomUUID(),
        saleOrderId,
        styleId,
        sizeId,
        quantity,
        unitPrice: 100,
        totalPrice: quantity * 100,
        allocatedQty,
        dispatchedQty,
      },
    });
  }

  async function status(): Promise<string> {
    const so = await prisma.sale_orders.findUnique({ where: { id: saleOrderId } });
    return so!.status;
  }

  it('pure derivation: dispatch facts outrank allocation facts, per item', () => {
    const item = (q: number, a: number, d: number) => ({ quantity: q, allocatedQty: a, dispatchedQty: d });
    expect(deriveSaleOrderProgress([])).toBe('CONFIRMED');
    expect(deriveSaleOrderProgress([item(10, 0, 0)])).toBe('CONFIRMED');
    expect(deriveSaleOrderProgress([item(10, 4, 0)])).toBe('PARTIALLY_ALLOCATED');
    expect(deriveSaleOrderProgress([item(10, 10, 0)])).toBe('FULLY_ALLOCATED');
    expect(deriveSaleOrderProgress([item(10, 10, 4)])).toBe('PARTIALLY_DISPATCHED');
    expect(deriveSaleOrderProgress([item(10, 10, 10)])).toBe('DISPATCHED');
    // Releasing allocation on a partly-shipped order keeps the dispatch badge
    expect(deriveSaleOrderProgress([item(10, 0, 4)])).toBe('PARTIALLY_DISPATCHED');
    // Per-item, not aggregate: over-dispatch on one item can't mask a shortfall on another
    expect(deriveSaleOrderProgress([item(10, 0, 20), item(10, 0, 0)])).toBe('PARTIALLY_DISPATCHED');
  });

  it('deallocating on a partly-dispatched order keeps the B2B badge (the incident pin)', async () => {
    await addItem(10, 6, 4);
    await prisma.sale_orders.update({
      where: { id: saleOrderId },
      data: { status: 'PARTIALLY_DISPATCHED' }, // allow-sale-order-status: test fixture
    });

    // Simulate the warehouse releasing all reserved stock
    await prisma.sale_order_items.updateMany({ where: { saleOrderId }, data: { allocatedQty: 0 } });
    expect(await recomputeSaleOrderStatus(prisma, saleOrderId)).toBe('PARTIALLY_DISPATCHED');
    expect(await status()).toBe('PARTIALLY_DISPATCHED');
  });

  it('allocation tier steps honestly when nothing is dispatched', async () => {
    const item = await addItem(10, 0, 0);
    await prisma.sale_order_items.update({ where: { id: item.id }, data: { allocatedQty: 10 } });
    expect(await recomputeSaleOrderStatus(prisma, saleOrderId)).toBe('FULLY_ALLOCATED');

    await prisma.sale_order_items.update({ where: { id: item.id }, data: { allocatedQty: 0 } });
    expect(await recomputeSaleOrderStatus(prisma, saleOrderId)).toBe('CONFIRMED');
  });

  it('never overwrites DRAFT, CANCELLED or DELIVERED', async () => {
    await addItem(10, 10, 10);
    for (const pinned of ['DRAFT', 'CANCELLED', 'DELIVERED'] as const) {
      await prisma.sale_orders.update({
        where: { id: saleOrderId },
        data: { status: pinned }, // allow-sale-order-status: test fixture
      });
      expect(await recomputeSaleOrderStatus(prisma, saleOrderId)).toBe(pinned);
      expect(await status()).toBe(pinned);
    }
  });

  it('allocateStock refuses cancelled and draft orders (no resurrection)', async () => {
    const item = await addItem(10);

    await prisma.sale_orders.update({
      where: { id: saleOrderId },
      data: { status: 'CANCELLED' }, // allow-sale-order-status: test fixture
    });
    await expect(saleOrderService.allocateStock(item.id, randomUUID(), 5, testUserId)).rejects.toThrow(/CANCELLED/);
    expect(await status()).toBe('CANCELLED');

    await prisma.sale_orders.update({
      where: { id: saleOrderId },
      data: { status: 'DRAFT' }, // allow-sale-order-status: test fixture
    });
    await expect(saleOrderService.allocateStock(item.id, randomUUID(), 5, testUserId)).rejects.toThrow(
      /Confirm the sale order/
    );
    expect(await status()).toBe('DRAFT');
  });
});
