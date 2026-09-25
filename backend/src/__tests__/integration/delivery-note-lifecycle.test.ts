/**
 * A delivery note's life after it is raised (2026-09-25):
 *   - CANCEL a pending note: stock and the sale order's dispatched quantity come back, the record and
 *     its number stay (status CANCELLED), and a cancelled note stops counting anywhere
 *   - SHORT STOCK is refused unless an ADMIN overrides with a reason
 *   - the proof of delivery records what EACH LINE received; a partial delivery hands each line's
 *     shortage back to stock and to the sale order
 *   - CREATE INVOICE from a delivered note bills the received quantity, once, at the selling price
 *   - a note raised from an ASN is LINKED to it, and the ASN reconciles what was dispatched
 *
 * Posts exactly what the pages post. Runs against the real app + live dev DB; every fixture is
 * scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `DNL${Date.now().toString(36).toUpperCase()}`;
const DELIVERY_DATE = '2026-12-01';
const DUE_DATE = '2026-12-31';

let admin: Record<string, string>;
let manager: Record<string, string>; // PRODUCTION_MANAGER: may raise notes, may not override
let adminId: string;
let managerId: string;
let customerId: string;
let styleId: string;
let colorId: string;
let sizeMId: string;
let sizeLId: string;
let costingId: string;

const createdSoIds: string[] = [];
const createdOrderIds: string[] = [];
const createdStockIds: string[] = [];
const createdLocationIds: string[] = [];
const createdAsnIds: string[] = [];

async function confirmedOrder(lines: Array<{ sizeId: string; quantity: number; unitPrice?: number }>) {
  const created = await request(app)
    .post('/api/sale-orders')
    .set(admin)
    .send({
      customerId,
      items: lines.map((l) => ({
        styleId,
        colorId,
        sizeId: l.sizeId,
        quantity: l.quantity,
        unitPrice: l.unitPrice ?? 100,
      })),
    })
    .expect(201);
  const soId = created.body.data.id as string;
  createdSoIds.push(soId);
  await request(app).post(`/api/sale-orders/${soId}/confirm`).set(admin).send({}).expect(200);
  const items = await prisma.sale_order_items.findMany({ where: { saleOrderId: soId } });
  return { soId, lineOf: (sizeId: string) => items.find((i) => i.sizeId === sizeId)!.id };
}

async function startProduction(soId: string) {
  const res = await request(app)
    .post(`/api/sale-orders/${soId}/start-production`)
    .set(admin)
    .send({ expectedDeliveryDate: '2026-12-31', quantityMode: 'FULL' })
    .expect(201);
  createdOrderIds.push(res.body.data.id);
  return res.body.data.id as string;
}

let lotSeq = 0;
async function fgLot(quantity: number, sizeId: string) {
  lotSeq += 1;
  const location = await prisma.locations.create({
    data: {
      id: randomUUID(),
      locationCode: `${RUN}-LOC-${lotSeq}`,
      locationName: `${RUN} WH ${lotSeq}`,
      locationType: 'WAREHOUSE',
    },
  });
  createdLocationIds.push(location.id);
  const stock = await prisma.finished_goods_stock.create({
    data: { id: randomUUID(), styleId, colorId, sizeId, quantity, locationId: location.id },
  });
  createdStockIds.push(stock.id);
  return stock.id;
}

const fgQty = async (id: string) => (await prisma.finished_goods_stock.findUniqueOrThrow({ where: { id } })).quantity;
const dispatchedOf = async (id: string) =>
  (await prisma.sale_order_items.findUniqueOrThrow({ where: { id } })).dispatchedQty;

/** POST /dispatch/delivery-notes exactly as DispatchDeliveryNoteForm posts it */
const raiseNote = (body: Record<string, unknown>, as = admin) =>
  request(app)
    .post('/api/dispatch/delivery-notes')
    .set(as)
    .send({ customerId, deliveryDate: DELIVERY_DATE, ...body });

const dispatchNote = (id: string) =>
  request(app).post(`/api/dispatch/delivery-notes/${id}/dispatch`).set(admin).send({});
const recordPod = (id: string, body: Record<string, unknown>) =>
  request(app)
    .post(`/api/dispatch/delivery-notes/${id}/record-pod`)
    .set(admin)
    .send({ deliveryDate: DELIVERY_DATE, receivedBy: 'Store keeper', ...body });
const invoiceFrom = (deliveryNoteId: string) =>
  request(app).post('/api/invoices/from-delivery-note').set(admin).send({ deliveryNoteId, dueDate: DUE_DATE });

beforeAll(async () => {
  const a = await createTestUser({
    email: `admin-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = a.id;
  admin = getAuthHeader(a.id, 'ADMIN');
  const m = await createTestUser({
    email: `pm-${RUN.toLowerCase()}@smoke.test`,
    role: 'PRODUCTION_MANAGER',
    isActive: true,
    isApproved: true,
  });
  managerId = m.id;
  manager = getAuthHeader(m.id, 'PRODUCTION_MANAGER');

  const state = await prisma.indian_states.findFirstOrThrow({ select: { id: true } });
  const customer = await prisma.customers.create({
    data: {
      code: `${RUN}-CUST`,
      name: `${RUN} Buyer`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: adminId,
      billingStateId: state.id, // place of supply for the invoice
      gptBlocksShipment: false, // no GPT fixtures here
    },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: {
      id: randomUUID(),
      styleCode: `${RUN}A`,
      styleName: `${RUN} Style A`,
      createdById: adminId,
      hsnCode: '6204',
    },
  });
  styleId = style.id;
  const color = await prisma.color_options.create({
    data: { id: randomUUID(), styleId, colorName: `${RUN} Indigo`, colorCode: `${RUN}-IND` },
  });
  colorId = color.id;
  const [sm, sl] = await Promise.all([
    prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: `${RUN}-M` } }),
    prisma.size_options.create({ data: { id: randomUUID(), styleId, sizeName: 'L', sizeCode: `${RUN}-L` } }),
  ]);
  sizeMId = sm.id;
  sizeLId = sl.id;
  const costing = await prisma.style_costing.create({
    data: {
      id: randomUUID(),
      styleId,
      createdById: adminId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'APPROVED',
      isApproved: true,
    },
  });
  costingId = costing.id;
});

afterAll(async () => {
  const orderIds = (
    await prisma.orders.findMany({ where: { customerId: only(customerId) }, select: { id: true } })
  ).map((o) => o.id);
  const woIds = (await prisma.work_orders.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map(
    (w) => w.id
  );
  const orderItemIds = (
    await prisma.order_items.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
  ).map((i) => i.id);
  const invoiceIds = (
    await prisma.invoices.findMany({ where: { customerId: only(customerId) }, select: { id: true } })
  ).map((i) => i.id);

  const steps: Array<[string, () => Promise<unknown>]> = [
    ['invoice_items', () => prisma.invoice_items.deleteMany({ where: { invoiceId: { in: invoiceIds } } })],
    ['invoices', () => prisma.invoices.deleteMany({ where: { id: { in: invoiceIds } } })],
    [
      'dispatch_pods',
      () =>
        prisma.dispatch_pods.deleteMany({
          where: { deliveryNoteExt: { deliveryNote: { customerId: only(customerId) } } },
        }),
    ],
    [
      'dispatch_transports',
      () =>
        prisma.dispatch_transports.deleteMany({
          where: { deliveryNoteExt: { deliveryNote: { customerId: only(customerId) } } },
        }),
    ],
    ['delivery_notes', () => prisma.delivery_notes.deleteMany({ where: { customerId: only(customerId) } })],
    ['asn_applications', () => prisma.asn_applications.deleteMany({ where: { id: { in: createdAsnIds } } })],
    [
      'fg_stock_allocations',
      () => prisma.fg_stock_allocations.deleteMany({ where: { fgStockId: { in: createdStockIds } } }),
    ],
    ['finished_goods_stock', () => prisma.finished_goods_stock.deleteMany({ where: { id: { in: createdStockIds } } })],
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_order_breakup', () => prisma.work_order_breakup.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: { in: woIds } } })],
    [
      'order_item_breakup',
      () => prisma.order_item_breakup.deleteMany({ where: { orderItemId: { in: orderItemIds } } }),
    ],
    ['order_items', () => prisma.order_items.deleteMany({ where: { id: { in: orderItemIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { customerId: only(customerId) } })],
    ['style_costing', () => prisma.style_costing.deleteMany({ where: { id: only(costingId) } })],
    ['locations', () => prisma.locations.deleteMany({ where: { id: { in: createdLocationIds } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { id: only(colorId) } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { id: { in: [sizeMId, sizeLId] } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { userId: { in: [adminId, managerId] } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: { in: [adminId, managerId] } } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[delivery-note-lifecycle teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('cancelling a pending delivery note', () => {
  it('hands the stock and the dispatched quantity back, and keeps the record as CANCELLED', async () => {
    const { soId, lineOf } = await confirmedOrder([{ sizeId: sizeMId, quantity: 20 }]);
    const orderId = await startProduction(soId);
    const lot = await fgLot(20, sizeMId);

    const raised = await raiseNote({ orderId, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 20 }] }).expect(
      201
    );
    const noteId = raised.body.data.id as string;
    const number = raised.body.data.deliveryNumber as string;
    expect(await fgQty(lot)).toBe(0);
    expect(await dispatchedOf(lineOf(sizeMId))).toBe(20);
    expect(await prisma.production_tracking.count({ where: { remarks: `Delivery note ${number}` } })).toBeGreaterThan(
      0
    );

    const res = await request(app)
      .post(`/api/dispatch/delivery-notes/${noteId}/cancel`)
      .set(admin)
      .send({ reason: 'Raised against the wrong order' })
      .expect(200);
    expect(res.body.data.status).toBe('CANCELLED');

    const kept = await prisma.delivery_notes.findUniqueOrThrow({ where: { id: noteId } });
    expect(kept.status).toBe('CANCELLED');
    expect(kept.cancelReason).toBe('Raised against the wrong order');
    expect(kept.cancelledById).toBe(adminId);
    expect(await fgQty(lot)).toBe(20);
    expect(await dispatchedOf(lineOf(sizeMId))).toBe(0);
    expect(await prisma.production_tracking.count({ where: { remarks: `Delivery note ${number}` } })).toBe(0);

    // The list's Cancelled filter (it used to 400) finds it
    const list = await request(app).get('/api/dispatch/delivery-notes?status=CANCELLED').set(admin).expect(200);
    expect(JSON.stringify(list.body)).toContain(noteId);

    // A cancelled note no longer counts: the whole order can ship again, and the buyer's count skips it
    await raiseNote({ orderId, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 20 }] }).expect(201);
    const so = await request(app).get(`/api/sale-orders/${soId}`).set(admin).expect(200);
    expect(so.body._count.deliveryNotes).toBe(1);
  });

  it('refuses a note that has already left', async () => {
    const { soId } = await confirmedOrder([{ sizeId: sizeMId, quantity: 5 }]);
    const orderId = await startProduction(soId);
    await fgLot(5, sizeMId);
    const raised = await raiseNote({ orderId, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 5 }] }).expect(
      201
    );
    await dispatchNote(raised.body.data.id).expect(200);

    const res = await request(app)
      .post(`/api/dispatch/delivery-notes/${raised.body.data.id}/cancel`)
      .set(admin)
      .send({ reason: 'Too late for this' })
      .expect(400);
    expect(res.body.message).toMatch(/proof of delivery as Rejected/);
  });
});

describe('short finished-goods stock', () => {
  it('is refused, nothing written; only an admin with a reason may ship past it', async () => {
    const { soId, lineOf } = await confirmedOrder([{ sizeId: sizeLId, quantity: 10 }]);
    const lot = await fgLot(4, sizeLId);
    const body = { saleOrderId: soId, items: [{ styleId, colorId, sizeId: sizeLId, quantity: 10 }] };

    const refused = await raiseNote(body).expect(422);
    expect(refused.body.details.code).toBe('FG_STOCK_SHORT');
    expect(refused.body.message).toMatch(/need 10, in stock 4/);
    expect(await fgQty(lot)).toBe(4);
    expect(await dispatchedOf(lineOf(sizeLId))).toBe(0);

    const notAdmin = await raiseNote(
      { ...body, adminOverride: true, overrideReason: 'Finishing not recorded yet' },
      manager
    ).expect(403);
    expect(notAdmin.body.error).toBe('ADMIN_ONLY');

    await raiseNote({ ...body, adminOverride: true, overrideReason: 'short' }).expect(400); // reason too short

    const shipped = await raiseNote({
      ...body,
      adminOverride: true,
      overrideReason: 'Finishing not recorded in the ERP yet',
    }).expect(201);
    const note = await prisma.delivery_notes.findUniqueOrThrow({ where: { id: shipped.body.data.id } });
    expect(note.stockOverrideReason).toBe('Finishing not recorded in the ERP yet');
    expect(await fgQty(lot)).toBe(0);
    expect(await dispatchedOf(lineOf(sizeLId))).toBe(10);
  });
});

describe('proof of delivery and the invoice from it', () => {
  let soId: string;
  let mLine: string;
  let lLine: string;
  let noteId: string;
  let lotM: string;
  let lotL: string;

  it('a partial delivery records each line, and hands each shortage back', async () => {
    const so = await confirmedOrder([
      { sizeId: sizeMId, quantity: 10, unitPrice: 250 },
      { sizeId: sizeLId, quantity: 6, unitPrice: 300 },
    ]);
    soId = so.soId;
    mLine = so.lineOf(sizeMId);
    lLine = so.lineOf(sizeLId);
    const orderId = await startProduction(soId);
    lotM = await fgLot(10, sizeMId);
    lotL = await fgLot(6, sizeLId);

    const raised = await raiseNote({
      orderId,
      items: [
        { styleId, colorId, sizeId: sizeMId, quantity: 10 },
        { styleId, colorId, sizeId: sizeLId, quantity: 6 },
      ],
    }).expect(201);
    noteId = raised.body.data.id;

    // Not yet delivered: no invoice
    const early = await invoiceFrom(noteId).expect(400);
    expect(early.body.message).toMatch(/proof of delivery/);

    await dispatchNote(noteId).expect(200);
    const items = await prisma.delivery_note_items.findMany({ where: { deliveryNoteId: noteId } });
    const itemOf = (sizeId: string) => items.find((i) => i.sizeId === sizeId)!.id;

    // The page posts every line's received quantity for a partial delivery
    await recordPod(noteId, {
      deliveryStatus: 'PARTIAL',
      items: [
        { deliveryNoteItemId: itemOf(sizeMId), receivedQty: 8 },
        { deliveryNoteItemId: itemOf(sizeLId), receivedQty: 6 },
      ],
    }).expect(200);

    const after = await prisma.delivery_note_items.findMany({ where: { deliveryNoteId: noteId } });
    expect(after.find((i) => i.sizeId === sizeMId)!.receivedQty).toBe(8);
    expect(after.find((i) => i.sizeId === sizeLId)!.receivedQty).toBe(6);
    // The 2 short pieces of M go back to M's stock, and off M's dispatched quantity
    expect(await fgQty(lotM)).toBe(2);
    expect(await fgQty(lotL)).toBe(0);
    expect(await dispatchedOf(mLine)).toBe(8);
    expect(await dispatchedOf(lLine)).toBe(6);
    const pod = await prisma.dispatch_pods.findFirstOrThrow({ where: { deliveryNoteExt: { deliveryNoteId: noteId } } });
    expect(pod.shortageQty).toBe(2);
  });

  it('refuses a partial delivery that names no lines', async () => {
    const { soId: so2 } = await confirmedOrder([{ sizeId: sizeMId, quantity: 3 }]);
    const orderId = await startProduction(so2);
    await fgLot(3, sizeMId);
    const raised = await raiseNote({ orderId, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 3 }] }).expect(
      201
    );
    await dispatchNote(raised.body.data.id).expect(200);
    await recordPod(raised.body.data.id, { deliveryStatus: 'PARTIAL', shortageQty: 1 }).expect(400);
  });

  it('invoices what was received, at the sale order price — once, even when asked twice at once', async () => {
    const [a, b] = await Promise.all([invoiceFrom(noteId), invoiceFrom(noteId)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const won = a.status === 201 ? a : b;

    const invoice = await prisma.invoices.findUniqueOrThrow({
      where: { id: won.body.data.id },
      include: { invoice_items: true },
    });
    expect(invoice.deliveryNoteId).toBe(noteId);
    expect(invoice.saleOrderId).toBe(soId);
    const lines = invoice.invoice_items.map((i) => [i.quantity, Number(i.unitPrice)]).sort();
    expect(lines).toEqual([
      [6, 300],
      [8, 250],
    ]);
    expect(Number(invoice.subtotal)).toBe(8 * 250 + 6 * 300);

    // The note's detail now names its invoice
    const detail = await request(app).get(`/api/dispatch/delivery-notes/${noteId}`).set(admin).expect(200);
    expect(JSON.stringify(detail.body)).toContain(invoice.invoiceNumber);
  });

  it('a rejected delivery has nothing to invoice', async () => {
    const { soId: so3 } = await confirmedOrder([{ sizeId: sizeLId, quantity: 2 }]);
    const orderId = await startProduction(so3);
    await fgLot(2, sizeLId);
    const raised = await raiseNote({ orderId, items: [{ styleId, colorId, sizeId: sizeLId, quantity: 2 }] }).expect(
      201
    );
    await dispatchNote(raised.body.data.id).expect(200);
    await recordPod(raised.body.data.id, { deliveryStatus: 'REJECTED', rejectionReason: 'Wrong colour' }).expect(200);
    const res = await invoiceFrom(raised.body.data.id).expect(400);
    expect(res.body.message).toMatch(/rejected/);
  });
});

describe('a production order linked to no sale order', () => {
  const bareIds: string[] = [];
  // An unlinked live order for this style would (rightly) refuse every later Start Production
  // (UNLINKED_PRODUCTION_ORDER_EXISTS), so these are closed once this block is done with them
  afterAll(async () => {
    await prisma.orders.updateMany({ where: { id: { in: bareIds } }, data: { status: 'COMPLETED' } });
  });

  /** A bare production order, as raised early before the buyer's PO (no sale order link) */
  async function bareOrder(unitPrice: number) {
    const id = randomUUID();
    await prisma.orders.create({
      data: {
        id,
        orderNumber: `${RUN}-ORD-${createdOrderIds.length + 1}`,
        customerId,
        expectedDeliveryDate: new Date('2026-12-31'),
        totalQuantity: 4,
        totalAmount: unitPrice * 4,
        createdById: adminId,
        order_items: {
          create: {
            id: randomUUID(),
            styleId,
            totalQuantity: 4,
            unitPrice,
            totalPrice: unitPrice * 4,
            order_item_breakup: { create: { id: randomUUID(), colorId, sizeId: sizeMId, quantity: 4 } },
          },
        },
      },
    });
    createdOrderIds.push(id);
    bareIds.push(id);
    return id;
  }

  const deliverAndInvoice = async (orderId: string) => {
    await fgLot(4, sizeMId);
    const raised = await raiseNote({ orderId, items: [{ styleId, colorId, sizeId: sizeMId, quantity: 4 }] }).expect(
      201
    );
    await dispatchNote(raised.body.data.id).expect(200);
    await recordPod(raised.body.data.id, { deliveryStatus: 'DELIVERED' }).expect(200);
    return invoiceFrom(raised.body.data.id);
  };

  it('is invoiced at the production order price (it used to be ₹0)', async () => {
    const res = await deliverAndInvoice(await bareOrder(180));
    expect(res.status).toBe(201);
    const invoice = await prisma.invoices.findUniqueOrThrow({
      where: { id: res.body.data.id },
      include: { invoice_items: true },
    });
    expect(Number(invoice.invoice_items[0].unitPrice)).toBe(180);
    expect(invoice.invoice_items[0].quantity).toBe(4);
  });

  it('with no price anywhere, the invoice is refused rather than raised at ₹0', async () => {
    const res = await deliverAndInvoice(await bareOrder(0));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No selling price/);
  });
});

describe('a delivery note raised from an ASN', () => {
  async function asnFor(orderId: string, status: 'APPROVED' | 'PENDING') {
    const asn = await prisma.asn_applications.create({
      data: {
        asnNumber: `${RUN}-ASN-${createdAsnIds.length + 1}`,
        orderId,
        plannedDispatchQty: 6,
        cartonsPlanned: 1,
        requestedShipDate: new Date('2026-12-01'),
        status,
        approvedQty: 6,
        createdById: adminId,
        skuBreakdown: { create: [{ colorId, sizeId: sizeMId, plannedQty: 6 }] },
      },
    });
    createdAsnIds.push(asn.id);
    return asn.id;
  }

  it('is linked to it, and the ASN reconciles what left (not what is still pending or cancelled)', async () => {
    const { soId } = await confirmedOrder([{ sizeId: sizeMId, quantity: 10 }]);
    const orderId = await startProduction(soId);
    const asnId = await asnFor(orderId, 'APPROVED');
    await fgLot(10, sizeMId);

    const raised = await raiseNote({
      orderId,
      asnId,
      items: [{ styleId, colorId, sizeId: sizeMId, quantity: 5 }],
    }).expect(201);
    const ext = await prisma.delivery_notes_ext.findUniqueOrThrow({ where: { deliveryNoteId: raised.body.data.id } });
    expect(ext.asnId).toBe(asnId);

    const pending = await request(app).get(`/api/dispatch/asn/${asnId}/reconciliation`).set(admin).expect(200);
    expect(JSON.stringify(pending.body)).toContain('NOT_DISPATCHED');

    // A second note on the same ASN, cancelled: never counts
    const other = await raiseNote({
      orderId,
      asnId,
      items: [{ styleId, colorId, sizeId: sizeMId, quantity: 1 }],
    }).expect(201);
    await request(app)
      .post(`/api/dispatch/delivery-notes/${other.body.data.id}/cancel`)
      .set(admin)
      .send({ reason: 'Duplicate' })
      .expect(200);

    await dispatchNote(raised.body.data.id).expect(200);
    const shipped = await request(app).get(`/api/dispatch/asn/${asnId}/reconciliation`).set(admin).expect(200);
    const body = shipped.body.data ?? shipped.body;
    expect(JSON.stringify(body)).toContain('"actualQty":5');
  });

  it('refuses an ASN that is not approved, or belongs to another order', async () => {
    const { soId } = await confirmedOrder([{ sizeId: sizeMId, quantity: 4 }]);
    const orderId = await startProduction(soId);
    await fgLot(4, sizeMId);
    const pendingAsn = await asnFor(orderId, 'PENDING');
    const notApproved = await raiseNote({
      orderId,
      asnId: pendingAsn,
      items: [{ styleId, colorId, sizeId: sizeMId, quantity: 1 }],
    }).expect(400);
    expect(notApproved.body.message).toMatch(/only an approved ASN/);

    const { soId: otherSo } = await confirmedOrder([{ sizeId: sizeMId, quantity: 4 }]);
    const otherOrder = await startProduction(otherSo);
    const foreignAsn = await asnFor(otherOrder, 'APPROVED');
    const foreign = await raiseNote({
      orderId,
      asnId: foreignAsn,
      items: [{ styleId, colorId, sizeId: sizeMId, quantity: 1 }],
    }).expect(400);
    expect(foreign.body.message).toMatch(/different production order/);
  });
});
