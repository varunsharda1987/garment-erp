/**
 * Allocating a sent PO to running orders, on real rows (docs/plans/po-allocation-design.md §6.4, §8, §9; owner
 * decisions D10–D12).
 *
 *  - the dialog's data: candidates earliest delivery first, the default split, Late;
 *  - happy path: PO_REQUIRED → PO_SENT, links ranked, one audit row;
 *  - every refusal, collected — nothing is written;
 *  - two tabs over-allocating one line at once: exactly one wins;
 *  - a part cover leaves a balance row, and Undo folds it back; a PARTIAL_STOCK row keeps its stock both ways;
 *  - a line whose goods partly arrived: a new link takes them at once and holds them (can't be undone); goods
 *    already used or held elsewhere are refused;
 *  - taking goods held for another order reopens the loser's need (D10); a COMPLETED order lets go of its
 *    holds (D11).
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import {
  allocatePoLines,
  getPoAllocation,
  heldForOtherOrders,
  releaseCompletedOrderHolds,
  takeHeldGoods,
  undoPoAllocation,
} from '../../services/helpers/po-allocation.helper';
import { applyLineReceipts } from '../../services/helpers/receipt-allocation.helper';
import { heldForRequirement, receiptHeldByRequirement } from '../../services/helpers/stock-reservation.helper';

jest.setTimeout(120000);

const RUN = `PAL${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;
const REQUIRED = new Date(Math.floor((Date.now() + 25 * DAY) / DAY) * DAY);

let userId: string;
let supplierId: string;
let customerId: string;
let storeId: string;
const masterIds: string[] = [];
const materialIds: string[] = [];
const masterOf: Record<string, string> = {};
const orderIds: string[] = [];
const poIds: string[] = [];
let grnSeq = 0;

// Materials: M1 (the main PO), M2 (the part-arrived line), MX (a different material), THREAD
let m1: string;
let m2: string;
let mx: string;
let threadId: string;
// Orders: O1..O4 running (delivery +10/+20/+30/+40 days), a cancelled one, a completed one
const O: Record<string, string> = {};
// POs and lines
let poA: string;
let a1: string; // M1, 1,000 pcs
let a2: string; // M1 in Red, 500 pcs
let aThread: string;
let poD: string; // draft
let d1: string;
let poP: string; // the race
let p1Line: string;
let poQ: string; // a GRN awaiting QC
let q1: string;
let poB: string; // part-arrived
let b1: string;
// Requirements
const R: Record<string, string> = {};

async function makeOtherMaterial(suffix: string): Promise<string> {
  const master = await prisma.other_material_master.create({
    data: { materialCode: `${RUN}-${suffix}`, materialName: `${RUN} ${suffix}` },
  });
  masterIds.push(master.id);
  const id = await ensureMaterialRecord(master.id, 'OTHER_MATERIAL');
  materialIds.push(id);
  masterOf[id] = master.id;
  return id;
}

async function makeOrder(
  name: string,
  deliveryInDays: number,
  status: 'PENDING' | 'IN_PRODUCTION' | 'CANCELLED' | 'COMPLETED' = 'IN_PRODUCTION'
) {
  const id = randomUUID();
  await prisma.orders.create({
    data: {
      id,
      orderNumber: `${RUN}-${name}`,
      customerId,
      status,
      expectedDeliveryDate: new Date(Date.now() + deliveryInDays * DAY),
      totalQuantity: 100,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderIds.push(id);
  O[name] = id;
}

async function makePo(suffix: string, status: 'SENT' | 'DRAFT' = 'SENT') {
  const id = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id,
      poNumber: `${RUN}-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 15 * DAY),
      status,
      poCategory: 'TRIMS',
      createdById: userId,
    },
  });
  poIds.push(id);
  return id;
}

async function makeLine(poId: string, materialId: string, qty: number, colorName: string | null = null) {
  const id = randomUUID();
  await prisma.purchase_order_items.create({
    data: { id, poId, materialId, orderedQuantity: qty, unitPrice: 1, totalPrice: qty, unit: 'PIECE', colorName },
  });
  return id;
}

async function makeRequirement(
  name: string,
  materialId: string,
  orderName: string | null,
  need: number,
  extra: Partial<Prisma.material_requirementsUncheckedCreateInput> = {}
) {
  const id = randomUUID();
  await prisma.material_requirements.create({
    data: {
      id,
      requirementNumber: `${RUN}-${name}`,
      source: 'MANUAL',
      unit: 'PIECE',
      materialId,
      orderId: orderName ? O[orderName] : null,
      orderQuantity: 1,
      quantityPerUnit: need,
      wastagePercent: 0,
      totalRequired: need,
      shortfall: need,
      status: 'PO_REQUIRED',
      requiredDate: REQUIRED,
      createdById: userId,
      ...extra,
    },
  });
  R[name] = id;
  return id;
}

async function makeGrn(
  poId: string,
  poItemId: string,
  materialId: string,
  qty: number,
  status: 'ACCEPTED' | 'PENDING_QC'
) {
  const grnId = randomUUID();
  await prisma.goods_receiving_notes.create({
    data: {
      id: grnId,
      grnNumber: `${RUN}-GRN-${++grnSeq}`,
      poId,
      supplierId,
      warehouseId: storeId,
      status,
      receivedById: userId,
      ...(status === 'ACCEPTED' ? { approvedById: userId } : {}),
      receivingDate: new Date(),
      grn_items: {
        create: [
          {
            id: randomUUID(),
            poItemId,
            materialId,
            orderedQuantity: qty,
            receivedQuantity: qty,
            acceptedQuantity: status === 'ACCEPTED' ? qty : 0,
            unit: 'PIECE',
            ...(status === 'ACCEPTED' ? { stockQuantity: qty } : {}),
          },
        ],
      },
    },
  });
  return grnId;
}

async function useStockHold(requirementId: string, materialId: string, qty: number) {
  await prisma.stock_reservations.create({
    data: {
      materialId,
      warehouseId: storeId,
      reservationType: 'ORDER',
      referenceType: 'MATERIAL_REQUIREMENT',
      referenceId: requirementId,
      referenceNumber: `${RUN}-hold`,
      reservedQuantity: qty,
      unit: 'PIECE',
      status: 'ACTIVE',
      reservedById: userId,
    },
  });
}

const req = (name: string) => prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
const linksOf = (itemId: string) =>
  prisma.requirement_po_links.findMany({ where: { purchaseOrderItemId: itemId }, orderBy: { fillOrder: 'asc' } });
const errorOf = (p: Promise<unknown>) => p.then(() => null).catch((e) => e);

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
        createdById: userId,
      },
    })
  ).id;

  m1 = await makeOtherMaterial('M1');
  m2 = await makeOtherMaterial('M2');
  mx = await makeOtherMaterial('MX');
  const categoryId = (await prisma.materials.findUniqueOrThrow({ where: { id: m1 }, select: { categoryId: true } }))
    .categoryId;
  threadId = (
    await prisma.materials.create({
      data: {
        id: randomUUID(),
        code: `${RUN}-THR`,
        name: `${RUN} Thread`,
        categoryId,
        materialType: 'THREAD',
        unit: 'PIECE',
      },
    })
  ).id;
  materialIds.push(threadId);

  await makeOrder('O1', 10);
  await makeOrder('O2', 20);
  await makeOrder('O3', 30);
  await makeOrder('O4', 40, 'PENDING');
  await makeOrder('OC', 12, 'CANCELLED');
  await makeOrder('OD', 12, 'COMPLETED');

  poA = await makePo('A');
  a1 = await makeLine(poA, m1, 1000);
  a2 = await makeLine(poA, m1, 500, 'Red');
  aThread = await makeLine(poA, threadId, 10);
  poD = await makePo('D', 'DRAFT');
  d1 = await makeLine(poD, m1, 100);
  poP = await makePo('P');
  p1Line = await makeLine(poP, m1, 1000);
  poQ = await makePo('Q');
  q1 = await makeLine(poQ, m1, 100);
  await makeGrn(poQ, q1, m1, 100, 'PENDING_QC');
  poB = await makePo('B');
  b1 = await makeLine(poB, m2, 1000);

  // M1 — earliest orders first: r1 (O1) / r2 (O2) / r3 (O3); the rest on O4, after them
  await makeRequirement('r1', m1, 'O1', 300);
  await makeRequirement('r2', m1, 'O2', 300);
  await makeRequirement('r3', m1, 'O3', 500);
  await makeRequirement('rStock', m1, 'O4', 500, { status: 'PARTIAL_STOCK', allocatedFromStock: 100, shortfall: 400 });
  await useStockHold(R.rStock, m1, 100);
  await makeRequirement('rBig', m1, 'O4', 50);
  await makeRequirement('rColour', m1, 'O4', 50, { colorName: 'Blue' });
  await makeRequirement('rMeter', m1, 'O4', 50, { unit: 'METER' });
  await makeRequirement('rq', m1, 'O4', 50);
  await makeRequirement('p1', m1, 'O4', 600);
  await makeRequirement('p2', m1, 'O4', 600);
  await makeRequirement('rSize', m1, 'O4', 50, { status: 'SIZE_PENDING' });
  await makeRequirement('rDecision', m1, 'O4', 50, { status: 'DECISION_PENDING' });
  await makeRequirement('rGenerated', m1, 'O4', 50, { status: 'PO_GENERATED' });
  await makeRequirement('rCancelledOrder', m1, 'OC', 50);
  await makeRequirement('rCompleted', m1, 'OD', 50);
  await makeRequirement('rOtherMat', mx, 'O4', 50);
  await makeRequirement('rLinked', m1, 'O4', 50);
  await prisma.requirement_po_links.create({
    data: { requirementId: R.rLinked, purchaseOrderId: poD, purchaseOrderItemId: d1, allocatedQuantity: 50 },
  });

  // M2 — the part-arrived line
  await makeRequirement('rb1', m2, 'O1', 500);
  await makeRequirement('rb2', m2, 'O2', 150);
  await makeRequirement('rb3', m2, 'O3', 100);
  await makeRequirement('rb4', m2, 'O4', 40, { status: 'FULFILLED_STOCK', allocatedFromStock: 40, shortfall: 0 });
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: { in: poIds } } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: poIds } } })],
    ['lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: { in: masterIds } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    [
      'balance rows',
      () =>
        prisma.material_requirements.deleteMany({
          where: { materialId: { in: materialIds }, splitFromId: { not: null } },
        }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(storeId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['masters', () => prisma.other_material_master.deleteMany({ where: { id: { in: masterIds } } })],
    ['supplier', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the Allocate dialog’s data', () => {
  it('lists running orders earliest delivery first, suggests every need in full, marks Late', async () => {
    const view = await getPoAllocation(poA);
    expect(view.po.linkable).toBe(true);
    const line = view.lines.find((l) => l.itemId === a1)!;
    expect(line.freeToLink).toBe(1000);
    const ids = line.candidates.map((c) => c.requirementId);
    expect(ids.indexOf(R.r1)).toBe(0);
    expect(ids.indexOf(R.r2)).toBe(1);
    expect(ids.indexOf(R.r3)).toBe(2);
    // Not candidates: other statuses, cancelled / completed orders, already linked, other materials
    for (const n of ['rSize', 'rDecision', 'rGenerated', 'rCancelledOrder', 'rCompleted', 'rLinked', 'rOtherMat']) {
      expect(ids).not.toContain(R[n]);
    }
    // The default split, whichever of the two M1 lines sorts first: r1 and r2 whole on the uncoloured line (their
    // own colour — none); r3 (500) no longer fits there (400 left), so it goes whole on the Red line rather than
    // being part-covered; only then is the uncoloured line's last 400 given to the next order, p1, in part
    const suggested = (itemId: string, name: string) =>
      view.lines.find((l) => l.itemId === itemId)!.candidates.find((c) => c.requirementId === R[name])!.suggestedQty;
    expect([suggested(a1, 'r1'), suggested(a1, 'r2'), suggested(a1, 'r3'), suggested(a1, 'p1')]).toEqual([
      300, 300, 0, 400,
    ]);
    expect([suggested(a2, 'r1'), suggested(a2, 'r2'), suggested(a2, 'r3'), suggested(a2, 'p1')]).toEqual([
      0, 0, 500, 0,
    ]);
    const byId = new Map(line.candidates.map((c) => [c.requirementId, c]));
    expect(byId.get(R.r1)!.arrivesLate).toBe(true);
    expect(byId.get(R.r3)!.arrivesLate).toBe(false);
    expect(byId.get(R.rMeter)!.linkable).toBe(false);
    expect(byId.get(R.rMeter)!.blockedReason).toMatch(/counted in m/);
    // The thread line cannot be linked
    expect(view.lines.find((l) => l.itemId === aThread)!.blockedReason).toMatch(/thread lines/);
    expect(view.unlinkedOrderCount).toBe(4);
  });
});

describe('linking', () => {
  it('happy path: PO_REQUIRED → PO_SENT, ranked earliest first, one audit row', async () => {
    const res = await allocatePoLines(
      poA,
      [
        { purchaseOrderItemId: a1, requirementId: R.r2, quantity: 300 },
        { purchaseOrderItemId: a1, requirementId: R.r1, quantity: 300 },
      ],
      userId
    );
    expect(res.linked).toHaveLength(2);
    expect(res.splits).toEqual([]);
    expect((await req('r1')).status).toBe('PO_SENT');
    expect((await req('r2')).status).toBe('PO_SENT');
    const links = await linksOf(a1);
    expect(links.map((l) => [l.requirementId, l.fillOrder, Number(l.allocatedQuantity)])).toEqual([
      [R.r1, 1, 300],
      [R.r2, 2, 300],
    ]);
    const line = res.allocation.lines.find((l) => l.itemId === a1)!;
    expect(line.linkedQty).toBe(600);
    expect(line.freeToLink).toBe(400);
    expect(line.links.every((l) => l.canUndo)).toBe(true);
    const audit = await prisma.audit_logs.findMany({ where: { entityId: poA, userId } });
    expect(audit).toHaveLength(1);
    expect((audit[0].newValues as { event: string }).event).toBe('ALLOCATE_TO_ORDERS');
  });

  const refusals: Array<[string, () => { poId: string; itemId: string; names: string[]; qty?: number }, RegExp]> = [
    ['a draft PO', () => ({ poId: poD, itemId: d1, names: ['r3'] }), /only a sent PO/],
    ['a line from another PO', () => ({ poId: poA, itemId: d1, names: ['r3'] }), /not on/],
    ['another material', () => ({ poId: poA, itemId: a1, names: ['rOtherMat'] }), /different material/],
    ['another colour', () => ({ poId: poA, itemId: a2, names: ['rColour'] }), /is for Blue, this line is Red/],
    ['another unit', () => ({ poId: poA, itemId: a1, names: ['rMeter'] }), /counted in m/],
    ['sizes not given', () => ({ poId: poA, itemId: a1, names: ['rSize'] }), /size breakdown/],
    ['a decision pending', () => ({ poId: poA, itemId: a1, names: ['rDecision'] }), /Order the extra/],
    ['already on a PO', () => ({ poId: poA, itemId: a1, names: ['rGenerated'] }), /already on/],
    ['a cancelled order', () => ({ poId: poA, itemId: a1, names: ['rCancelledOrder'] }), /is cancelled/],
    ['a completed order', () => ({ poId: poA, itemId: a1, names: ['rCompleted'] }), /is completed/],
    ['a thread line', () => ({ poId: poA, itemId: aThread, names: ['r3'] }), /thread lines/],
    ['more than it needs', () => ({ poId: poA, itemId: a1, names: ['rBig'], qty: 60 }), /more than it needs/],
    ['the same requirement twice', () => ({ poId: poA, itemId: a1, names: ['r3', 'r3'] }), /asked for twice/],
    ['linked elsewhere', () => ({ poId: poA, itemId: a1, names: ['rLinked'] }), /already on .*-D/],
    ['a GRN awaiting QC', () => ({ poId: poQ, itemId: q1, names: ['rq'] }), /awaiting QC/],
  ];

  it.each(refusals)('refuses %s, writing nothing', async (_label, make, reason) => {
    const { poId, itemId, names, qty } = make();
    const before = await Promise.all(names.map((n) => req(n)));
    const err = await errorOf(
      allocatePoLines(
        poId,
        names.map((n) => ({ purchaseOrderItemId: itemId, requirementId: R[n], quantity: qty ?? 10 })),
        userId
      )
    );
    expect(err).not.toBeNull();
    expect(err.details?.code).toBe('PO_ALLOCATION_REFUSED');
    expect((err.details.rows as Array<{ reason: string }>).map((r) => r.reason).join(' | ')).toMatch(reason);
    const after = await Promise.all(names.map((n) => req(n)));
    expect(after.map((r) => r.status)).toEqual(before.map((r) => r.status));
  });

  it('refuses more than the line has free (409), writing nothing', async () => {
    const err = await errorOf(
      allocatePoLines(poA, [{ purchaseOrderItemId: a1, requirementId: R.r3, quantity: 450 }], userId)
    );
    expect(err.statusCode).toBe(409);
    expect(err.details).toMatchObject({ code: 'PO_LINE_OVER_ALLOCATED', free: 400, requested: 450 });
    expect((await req('r3')).status).toBe('PO_REQUIRED');
  });

  it('two tabs over-allocating one line at once: exactly one wins', async () => {
    const results = await Promise.allSettled([
      allocatePoLines(poP, [{ purchaseOrderItemId: p1Line, requirementId: R.p1, quantity: 600 }], userId),
      allocatePoLines(poP, [{ purchaseOrderItemId: p1Line, requirementId: R.p2, quantity: 600 }], userId),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason.details?.code).toBe('PO_LINE_OVER_ALLOCATED');
    const links = await linksOf(p1Line);
    expect(links).toHaveLength(1);
    expect(Number(links[0].allocatedQuantity)).toBe(600);
  });

  it('a part cover leaves a balance row; Undo folds it back', async () => {
    const res = await allocatePoLines(poA, [{ purchaseOrderItemId: a1, requirementId: R.r3, quantity: 200 }], userId);
    expect(res.splits).toHaveLength(1);
    expect(res.splits[0]).toMatchObject({ requirementNumber: `${RUN}-r3`, balance: 300 });
    const parent = await req('r3');
    expect(parent.status).toBe('PO_SENT');
    expect(Number(parent.shortfall)).toBe(200);
    const child = await prisma.material_requirements.findFirstOrThrow({ where: { splitFromId: R.r3 } });
    expect(child.status).toBe('PO_REQUIRED');
    expect(Number(child.shortfall)).toBe(300);
    expect(child.orderId).toBe(O.O3);
    expect((await linksOf(a1)).map((l) => l.requirementId)).toEqual([R.r1, R.r2, R.r3]);

    const link = (await linksOf(a1)).find((l) => l.requirementId === R.r3)!;
    const undo = await undoPoAllocation(poA, link.id, userId);
    expect(undo.newStatus).toBe('PO_REQUIRED');
    expect(undo.foldedBack).toEqual([child.requirementNumber]);
    const back = await req('r3');
    expect(back.status).toBe('PO_REQUIRED');
    expect(Number(back.shortfall)).toBe(500);
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: child.id } })).status).toBe(
      'CANCELLED'
    );
    expect(undo.allocation.lines.find((l) => l.itemId === a1)!.freeToLink).toBe(400);
  });

  it('a PARTIAL_STOCK row keeps its stock and its hold, linked and undone', async () => {
    await allocatePoLines(poA, [{ purchaseOrderItemId: a1, requirementId: R.rStock, quantity: 400 }], userId);
    let row = await req('rStock');
    expect(row.status).toBe('PO_SENT');
    expect(Number(row.allocatedFromStock)).toBe(100);
    expect(await heldForRequirement(prisma, R.rStock, 'stock')).toBe(100);

    const link = (await linksOf(a1)).find((l) => l.requirementId === R.rStock)!;
    const undo = await undoPoAllocation(poA, link.id, userId);
    expect(undo.newStatus).toBe('PARTIAL_STOCK');
    row = await req('rStock');
    expect(row.status).toBe('PARTIAL_STOCK');
    expect([Number(row.allocatedFromStock), Number(row.shortfall)]).toEqual([100, 400]);
    expect(await heldForRequirement(prisma, R.rStock, 'stock')).toBe(100);
  });
});

describe('a line whose goods partly arrived (D12)', () => {
  it('a new link takes the arrived goods first and holds them at once — and cannot be undone', async () => {
    await allocatePoLines(poB, [{ purchaseOrderItemId: b1, requirementId: R.rb1, quantity: 500 }], userId);
    // 700 arrive into the store and are approved: rb1 is filled, 200 are plain
    await makeGrn(poB, b1, m2, 700, 'ACCEPTED');
    await prisma.other_material_stock.create({
      data: {
        otherMaterialId: masterOf[m2],
        quantityAvailable: 700,
        purchaseCost: 1,
        weightedAvgCost: 1,
        receivedDate: new Date(),
        warehouseId: storeId,
      },
    });
    await prisma.$transaction((tx) => applyLineReceipts(tx, [b1], { event: 'approve', userId }), { timeout: 30000 });
    expect((await req('rb1')).status).toBe('RECEIVED');

    const view = await getPoAllocation(poB);
    const line = view.lines.find((l) => l.itemId === b1)!;
    expect([line.arrivedQty, line.plainQty, line.arrivedFree, line.freeToLink]).toEqual([700, 200, 200, 500]);
    const cand = new Map(line.candidates.map((c) => [c.requirementId, c]));
    expect([cand.get(R.rb2)!.suggestedQty, cand.get(R.rb2)!.alreadyHereQty]).toEqual([150, 150]);
    expect([cand.get(R.rb3)!.suggestedQty, cand.get(R.rb3)!.alreadyHereQty]).toEqual([100, 50]);

    const res = await allocatePoLines(poB, [{ purchaseOrderItemId: b1, requirementId: R.rb2, quantity: 150 }], userId);
    expect(res.linked[0].heldAtOnce).toBe(150);
    expect((await req('rb2')).status).toBe('RECEIVED');
    expect((await receiptHeldByRequirement(prisma, [R.rb2])).get(R.rb2)).toBe(150);
    const rb2View = res.allocation.lines[0].links.find((l) => l.requirementId === R.rb2)!;
    expect(rb2View.canUndo).toBe(false);
    const err = await errorOf(undoPoAllocation(poB, rb2View.linkId, userId));
    expect(err.details?.code).toBe('PO_UNDO_REFUSED');
    expect(err.message).toMatch(/already arrived/);
  });

  it('goods already used or held elsewhere are refused — Use Stock for them', async () => {
    // Someone's Use Stock holds 40 of the 50 still plain
    await useStockHold(R.rb4, m2, 40);
    const err = await errorOf(
      allocatePoLines(poB, [{ purchaseOrderItemId: b1, requirementId: R.rb3, quantity: 60 }], userId)
    );
    expect(err.details).toMatchObject({ code: 'PO_ARRIVED_NOT_FREE', free: 10, wanted: 50 });
    expect(err.message).toMatch(/only 10 of the 50/);
    expect((await req('rb3')).status).toBe('PO_REQUIRED');
  });
});

describe('goods held for another order (D10, D11)', () => {
  it('lists other orders’ holds, the order that needs them last first', async () => {
    const held = await heldForOtherOrders(prisma, { materialId: m2, excludeOrderId: O.O3 });
    expect(held.map((h) => [h.requirementId, h.kind, h.qty])).toEqual([
      [R.rb4, 'stock', 40],
      [R.rb2, 'receipt', 150],
      [R.rb1, 'receipt', 500],
    ]);
  });

  it('taking them reopens the losers’ need, and the line never credits them again', async () => {
    const result = await prisma.$transaction(
      (tx) =>
        takeHeldGoods(tx, { materialId: m2, quantity: 100, takerOrderId: O.O3, userId, reference: `${RUN} challan` }),
      { timeout: 30000 }
    );
    expect(result.taken).toBe(100);
    expect(result.short).toBe(0);
    // rb4 (Use Stock, not on a PO) reopens in place
    const rb4 = await req('rb4');
    expect([rb4.status, Number(rb4.allocatedFromStock), Number(rb4.shortfall)]).toEqual(['PO_REQUIRED', 0, 40]);
    // rb2 (on the PO) keeps its link; 60 of its goods went, and a balance row asks for them again
    const child = await prisma.material_requirements.findFirstOrThrow({ where: { splitFromId: R.rb2 } });
    expect([child.status, Number(child.shortfall)]).toEqual(['PO_REQUIRED', 60]);
    expect(result.from.map((f) => [f.requirementId, f.kind, f.quantity, f.balanceRequirementNumber])).toEqual([
      [R.rb4, 'stock', 40, null],
      [R.rb2, 'receipt', 60, child.requirementNumber],
    ]);
    expect((await receiptHeldByRequirement(prisma, [R.rb2])).get(R.rb2)).toBe(90);
    expect(await prisma.audit_logs.count({ where: { userId, entityType: 'material_requirement' } })).toBe(2);

    // A recompute keeps it: rb2 still credited 150, holds 150 − 60 taken
    await prisma.$transaction((tx) => applyLineReceipts(tx, [b1], { event: 'link', userId }), { timeout: 30000 });
    const held = await receiptHeldByRequirement(prisma, [R.rb1, R.rb2]);
    expect([held.get(R.rb1), held.get(R.rb2)]).toEqual([500, 90]);
    const links = await linksOf(b1);
    expect(links.map((l) => Number(l.receivedQuantity))).toEqual([500, 150]);
  });

  it('a COMPLETED order lets go of its receipt holds and keeps its credit', async () => {
    await prisma.orders.update({ where: { id: O.O1 }, data: { status: 'COMPLETED' } });
    const released = await prisma.$transaction((tx) => releaseCompletedOrderHolds(tx, O.O1), { timeout: 30000 });
    expect(released).toBe(500);
    await prisma.$transaction((tx) => applyLineReceipts(tx, [b1], { event: 'link', userId }), { timeout: 30000 });
    const held = await receiptHeldByRequirement(prisma, [R.rb1, R.rb2]);
    expect([held.get(R.rb1) ?? 0, held.get(R.rb2)]).toEqual([0, 90]);
    const rb1Link = (await linksOf(b1)).find((l) => l.requirementId === R.rb1)!;
    expect(Number(rb1Link.receivedQuantity)).toBe(500);
  });
});
