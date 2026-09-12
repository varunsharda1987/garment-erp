/**
 * FG stock allocation against sale-order lines, and what dispatch does to those reservations.
 *
 * `allocatedQty` means RESERVED AND NOT YET SHIPPED. Everything here pins that meaning:
 *   - a reservation can never exceed what the line still needs, or what the lot still has
 *   - a reservation must match the line's style/colour/size
 *   - two simultaneous allocations of one lot cannot both win
 *   - releasing a reservation hands the stock back and re-derives the order status
 *   - shipping PART of a reservation draws it down; the untouched remainder stays reserved
 *   - a rejected POD leaves no phantom reservation behind
 *
 * Runs against the real app + live dev DB, so every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { saleOrderService } from '../../services/saleOrder.service';
import { recomputeSaleOrderStatus } from '../../services/helpers/sale-order-status.helper';

const RUN = `SOA${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let styleId: string;
let otherStyleId: string;
let colorId: string;
let sizeMId: string;
let sizeLId: string;
let locationId: string;

const createdSoIds: string[] = [];
const createdStockIds: string[] = [];
const createdLocationIds: string[] = [];

/** A sale order with one line, confirmed and ready to allocate against. */
async function confirmedOrder(quantity: number, sizeId: string = sizeMId) {
  const created = await request(app)
    .post('/api/sale-orders')
    .set(authHeader)
    .send({ customerId, items: [{ styleId, colorId, sizeId, quantity, unitPrice: 100 }] })
    .expect(201);

  const soId = created.body.data.id as string;
  createdSoIds.push(soId);
  await request(app).post(`/api/sale-orders/${soId}/confirm`).set(authHeader).send({}).expect(200);

  const item = await prisma.sale_order_items.findFirstOrThrow({ where: { saleOrderId: soId } });
  return { soId, itemId: item.id };
}

/**
 * A finished-goods lot for this run's style/colour, at the given size.
 *
 * `finished_goods_stock` is unique on (style, colour, size, location), so each lot gets its own
 * location — otherwise every test after the first would collide on the same SKU.
 */
let lotSeq = 0;
async function fgLot(quantity: number, sizeId: string = sizeMId) {
  lotSeq += 1;
  const location = await prisma.locations.create({
    data: {
      id: randomUUID(),
      locationCode: `${RUN}-LOC-${lotSeq}`,
      locationName: `${RUN} Warehouse ${lotSeq}`,
      locationType: 'WAREHOUSE',
    },
  });
  createdLocationIds.push(location.id);

  const stock = await prisma.finished_goods_stock.create({
    data: { id: randomUUID(), styleId, colorId, sizeId, quantity, locationId: location.id },
  });
  createdStockIds.push(stock.id);
  return stock;
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUST`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: testUserId },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}A`, styleName: `${RUN} Style A`, createdById: testUserId },
  });
  styleId = style.id;

  const otherStyle = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}B`, styleName: `${RUN} Style B`, createdById: testUserId },
  });
  otherStyleId = otherStyle.id;

  const color = await prisma.color_options.create({
    data: { id: randomUUID(), styleId, colorName: `${RUN} Indigo`, colorCode: `${RUN}-IND` },
  });
  colorId = color.id;

  const [m, l] = await Promise.all([
    prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: `${RUN}-M` } }),
    prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: 'L', sizeCode: `${RUN}-L` } }),
  ]);
  sizeMId = m.id;
  sizeLId = l.id;

  const location = await prisma.locations.create({
    data: {
      id: randomUUID(),
      locationCode: `${RUN}-LOC`,
      locationName: `${RUN} Warehouse`,
      locationType: 'WAREHOUSE',
    },
  });
  locationId = location.id;
});

afterAll(async () => {
  // Children first, and each step independent: one failure must not strand the rest in the live DB.
  const steps: Array<[string, () => Promise<unknown>]> = [
    // dispatch_pods (and dispatch_transports) hang off delivery_notes_ext WITHOUT a cascade, so
    // they have to go first or the note delete fails and takes the rest of the teardown with it.
    [
      'dispatch_pods',
      () =>
        prisma.dispatch_pods.deleteMany({
          where: { deliveryNoteExt: { deliveryNote: { saleOrderId: { in: createdSoIds } } } },
        }),
    ],
    [
      'dispatch_transports',
      () =>
        prisma.dispatch_transports.deleteMany({
          where: { deliveryNoteExt: { deliveryNote: { saleOrderId: { in: createdSoIds } } } },
        }),
    ],
    // delivery_notes_ext, delivery_note_items and delivery_note_fg_allocations cascade from the note.
    ['delivery_notes', () => prisma.delivery_notes.deleteMany({ where: { saleOrderId: { in: createdSoIds } } })],
    [
      'fg_stock_allocations',
      () => prisma.fg_stock_allocations.deleteMany({ where: { fgStockId: { in: createdStockIds } } }),
    ],
    ['finished_goods_stock', () => prisma.finished_goods_stock.deleteMany({ where: { id: { in: createdStockIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: only(customerId) } })],
    ['locations', () => prisma.locations.deleteMany({ where: { id: { in: [locationId, ...createdLocationIds] } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { id: only(colorId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { id: { in: [sizeMId, sizeLId] } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: [styleId, otherStyleId] } } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];

  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[saleOrderAllocation teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }

  await prisma.$disconnect();
});

describe('allocateStock — what may be reserved', () => {
  it('refuses to reserve more than the line still needs', async () => {
    const { soId, itemId } = await confirmedOrder(10);
    const stock = await fgLot(500);

    const res = await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 500 })
      .expect(422);
    expect(res.body.message).toMatch(/10 pcs left to allocate/i);

    const item = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.allocatedQty).toBe(0);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(after.body.status).toBe('CONFIRMED');
  });

  it('refuses stock belonging to a different style', async () => {
    const { itemId } = await confirmedOrder(10);

    const otherSize = await prisma.size_options.create({
      data: { id: randomUUID(), styleId: otherStyleId, sizeName: 'M', sizeCode: `${RUN}-BM` },
    });
    const otherColor = await prisma.color_options.create({
      data: { id: randomUUID(), styleId: otherStyleId, colorName: `${RUN} Rust` },
    });
    const foreignStock = await prisma.finished_goods_stock.create({
      data: {
        id: randomUUID(),
        styleId: otherStyleId,
        colorId: otherColor.id,
        sizeId: otherSize.id,
        quantity: 50,
        locationId,
      },
    });
    createdStockIds.push(foreignStock.id);

    const res = await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: foreignStock.id, quantity: 5 })
      .expect(400);
    expect(res.body.message).toMatch(new RegExp(`${RUN}A`));

    const item = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.allocatedQty).toBe(0);
  });

  it('refuses stock of a different size to the line', async () => {
    const { itemId } = await confirmedOrder(10);
    const wrongSize = await fgLot(20, sizeLId);

    const res = await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: wrongSize.id, quantity: 5 })
      .expect(400);
    expect(res.body.message).toMatch(/different size/i);
  });

  it('reserves the requested quantity and moves the order to FULLY_ALLOCATED', async () => {
    const { soId, itemId } = await confirmedOrder(8);
    const stock = await fgLot(20);

    await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 8 })
      .expect(201);

    const item = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.allocatedQty).toBe(8);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(after.body.status).toBe('FULLY_ALLOCATED');

    // The lot itself is untouched until dispatch — a reservation is a claim, not a withdrawal.
    const stockAfter = await prisma.finished_goods_stock.findUniqueOrThrow({ where: { id: stock.id } });
    expect(stockAfter.quantity).toBe(20);
  });

  it('two simultaneous allocations cannot both take the last of a lot', async () => {
    // The availability read and the write now sit in one transaction with the lot row locked.
    // Before that both callers saw 10 free and both succeeded, over-reserving the lot.
    const first = await confirmedOrder(6);
    const second = await confirmedOrder(6);
    const stock = await fgLot(10);

    const results = await Promise.all([
      request(app)
        .post('/api/sale-orders/allocate-stock')
        .set(authHeader)
        .send({ saleOrderItemId: first.itemId, fgStockId: stock.id, quantity: 6 }),
      request(app)
        .post('/api/sale-orders/allocate-stock')
        .set(authHeader)
        .send({ saleOrderItemId: second.itemId, fgStockId: stock.id, quantity: 6 }),
    ]);

    expect(results.filter((r) => r.status < 300)).toHaveLength(1);
    expect(results.filter((r) => r.status >= 400)).toHaveLength(1);

    const reserved = await prisma.fg_stock_allocations.aggregate({
      where: { fgStockId: stock.id, status: 'ALLOCATED' },
      _sum: { allocatedQty: true },
    });
    expect(reserved._sum.allocatedQty).toBe(6);
  });

  it('refuses to reserve against a DRAFT order', async () => {
    const created = await request(app)
      .post('/api/sale-orders')
      .set(authHeader)
      .send({ customerId, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 3, unitPrice: 100 }] })
      .expect(201);
    createdSoIds.push(created.body.data.id);

    const item = await prisma.sale_order_items.findFirstOrThrow({ where: { saleOrderId: created.body.data.id } });
    const stock = await fgLot(10);

    const res = await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: item.id, fgStockId: stock.id, quantity: 3 })
      .expect(422);
    expect(res.body.message).toMatch(/confirm the sale order/i);
  });
});

describe('deallocateStock — giving a reservation back', () => {
  it('releases the reservation, frees the stock and re-derives the status', async () => {
    const { soId, itemId } = await confirmedOrder(5);
    const stock = await fgLot(5);

    const alloc = await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 5 })
      .expect(201);

    const fullyAllocated = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(fullyAllocated.body.status).toBe('FULLY_ALLOCATED');

    await request(app)
      .post('/api/sale-orders/deallocate-stock')
      .set(authHeader)
      .send({ allocationId: alloc.body.data.id })
      .expect(200);

    const item = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.allocatedQty).toBe(0);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(after.body.status).toBe('CONFIRMED');

    // Free again for someone else
    const available = await saleOrderService.getAvailableStock(styleId, colorId, sizeMId);
    expect(available.find((s) => s.id === stock.id)?.availableQty).toBe(5);
  });

  it('refuses to release the same reservation twice', async () => {
    const { itemId } = await confirmedOrder(4);
    const stock = await fgLot(4);

    const alloc = await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 4 })
      .expect(201);

    await request(app)
      .post('/api/sale-orders/deallocate-stock')
      .set(authHeader)
      .send({ allocationId: alloc.body.data.id })
      .expect(200);

    const res = await request(app)
      .post('/api/sale-orders/deallocate-stock')
      .set(authHeader)
      .send({ allocationId: alloc.body.data.id })
      .expect(422);
    expect(res.body.message).toMatch(/already RELEASED/i);
  });
});

describe('dispatch draws reservations down rather than discarding them', () => {
  it('shipping part of a reservation leaves the remainder reserved and re-usable', async () => {
    const { soId, itemId } = await confirmedOrder(10);
    const stock = await fgLot(10);

    await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 10 })
      .expect(201);

    // Ship 4 of the 10 reserved pieces.
    const dispatch = await request(app)
      .post('/api/dispatch/sale-order-dispatch')
      .set(authHeader)
      .send({ saleOrderId: soId, items: [{ saleOrderItemId: itemId, quantity: 4 }] })
      .expect(201);
    const noteId = dispatch.body.data.id as string;

    const item = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.dispatchedQty).toBe(4);
    // 10 reserved − 4 shipped: the remaining 6 are still this line's.
    expect(item.allocatedQty).toBe(6);

    const allocations = await prisma.fg_stock_allocations.findMany({ where: { saleOrderItemId: itemId } });
    expect(allocations).toHaveLength(1);
    expect(allocations[0].status).toBe('ALLOCATED');
    expect(allocations[0].allocatedQty).toBe(6);

    // The 6 are NOT offered to other orders (the bug: a part-shipped reservation was flagged
    // CONSUMED, so these pieces disappeared from every ALLOCATED query and looked free).
    const available = await saleOrderService.getAvailableStock(styleId, colorId, sizeMId);
    expect(available.find((s) => s.id === stock.id)?.availableQty ?? 0).toBe(0);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(after.body.status).toBe('PARTIALLY_DISPATCHED');

    // Deleting the pending note gives the quantities back to the order, not just to the shelf.
    await request(app).delete(`/api/dispatch/delivery-notes/${noteId}`).set(authHeader).expect(200);

    const restored = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(restored.dispatchedQty).toBe(0);

    const restoredSo = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(restoredSo.body.status).not.toBe('DISPATCHED');
  });

  it('a fully-shipped reservation is marked CONSUMED and stops counting as allocated', async () => {
    const { soId, itemId } = await confirmedOrder(5);
    const stock = await fgLot(5);

    await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 5 })
      .expect(201);

    await request(app)
      .post('/api/dispatch/sale-order-dispatch')
      .set(authHeader)
      .send({ saleOrderId: soId, items: [{ saleOrderItemId: itemId, quantity: 5 }] })
      .expect(201);

    const item = await prisma.sale_order_items.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.dispatchedQty).toBe(5);
    expect(item.allocatedQty).toBe(0);

    const allocations = await prisma.fg_stock_allocations.findMany({ where: { saleOrderItemId: itemId } });
    expect(allocations[0].status).toBe('CONSUMED');
    expect(allocations[0].allocatedQty).toBe(0);

    // Reserved stock that ships leaves the building: the lot is drawn down too.
    const stockAfter = await prisma.finished_goods_stock.findUniqueOrThrow({ where: { id: stock.id } });
    expect(stockAfter.quantity).toBe(0);
  });

  it('a confirmed POD does not mark the order DELIVERED while another note is still out', async () => {
    // DELIVERED is pinned — nothing derives back out of it. dispatchedQty is incremented when a
    // note is CREATED, so "everything dispatched" goes true as soon as the last note is raised;
    // stamping DELIVERED on that basis ended the order while goods were still travelling.
    const { soId, itemId } = await confirmedOrder(10);
    await fgLot(10);

    const noteA = await request(app)
      .post('/api/dispatch/sale-order-dispatch')
      .set(authHeader)
      .send({ saleOrderId: soId, items: [{ saleOrderItemId: itemId, quantity: 5 }] })
      .expect(201);
    const noteB = await request(app)
      .post('/api/dispatch/sale-order-dispatch')
      .set(authHeader)
      .send({ saleOrderId: soId, items: [{ saleOrderItemId: itemId, quantity: 5 }] })
      .expect(201);

    const dispatched = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(dispatched.body.status).toBe('DISPATCHED');

    // DeliveryConfirmation is DELIVERED | PARTIAL | REJECTED — there is no 'FULL'.
    const podBody = {
      deliveryDate: '2026-09-12',
      receivedBy: 'Store manager',
      deliveryStatus: 'DELIVERED',
    };

    // Confirm only the FIRST note. POD needs the note in transit; the transport workflow itself
    // is not what this test is about.
    await prisma.delivery_notes.update({ where: { id: noteA.body.data.id }, data: { status: 'IN_TRANSIT' } });
    await request(app)
      .post(`/api/dispatch/delivery-notes/${noteA.body.data.id}/record-pod`)
      .set(authHeader)
      .send(podBody)
      .expect(200);

    const midway = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(midway.body.status).not.toBe('DELIVERED');

    // Once the second note is confirmed too, the order is genuinely delivered.
    await prisma.delivery_notes.update({ where: { id: noteB.body.data.id }, data: { status: 'IN_TRANSIT' } });
    await request(app)
      .post(`/api/dispatch/delivery-notes/${noteB.body.data.id}/record-pod`)
      .set(authHeader)
      .send(podBody)
      .expect(200);

    const finished = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(finished.body.status).toBe('DELIVERED');
  });

  it('a returned shipment leaves no phantom reservation behind', async () => {
    // dispatchedQty goes back up the ledger and the stock is restored FREE, so the order must
    // read CONFIRMED — not FULLY_ALLOCATED against reservations that no longer exist.
    const { soId, itemId } = await confirmedOrder(5);
    const stock = await fgLot(5);

    await request(app)
      .post('/api/sale-orders/allocate-stock')
      .set(authHeader)
      .send({ saleOrderItemId: itemId, fgStockId: stock.id, quantity: 5 })
      .expect(201);

    await request(app)
      .post('/api/dispatch/sale-order-dispatch')
      .set(authHeader)
      .send({ saleOrderId: soId, items: [{ saleOrderItemId: itemId, quantity: 5 }] })
      .expect(201);

    // Stand in for the POD rejection: the goods came back and nothing is reserved any more.
    await prisma.sale_order_items.update({ where: { id: itemId }, data: { dispatchedQty: 0 } });
    await recomputeSaleOrderStatus(prisma, soId);

    const after = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
    expect(after.body.status).toBe('CONFIRMED');
    expect(after.body.items[0].allocatedQty).toBe(0);
  });
});
