/**
 * What happens to a sent PO's links when the PO ends, on real rows (docs/plans/po-allocation-design.md §6.9,
 * invariant 10, §8 ★ rows, §9 po-allocation-lifecycle).
 *
 *  - cancel with nothing received hands each requirement's demand back by the one rule: PO_REQUIRED, PARTIAL_STOCK
 *    (its Use Stock hold kept), CANCELLED for a cancelled order (its holds released), a BOM surplus applied;
 *  - cancel after a part receipt closes each requirement RECEIVED at what arrived, carries the balance forward,
 *    and freezes the kept links at allocated = received (C3) — a later recompute moves nothing;
 *  - short-close, then an order cancel: the cancelled order's goods become plain stock, and no other link rises
 *    above the shortfall the close wrote;
 *  - a link never counts past its allocation when a PO is closed;
 *  - Unified PO (MRP source): a requirement already on a PO is refused, each link is sized to its need (never the
 *    whole line), a part cover leaves a balance row, links are ranked earliest need first.
 *
 * Tagged fixtures (RUN), everything torn down. The Unified PO's number is stubbed so a fixture PO never takes a
 * number from the live PO series.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { allocatePoLines, releaseCancelledOrderLinks } from '../../services/helpers/po-allocation.helper';
import { applyLineReceipts } from '../../services/helpers/receipt-allocation.helper';
import { heldForRequirement, receiptHeldByRequirement } from '../../services/helpers/stock-reservation.helper';
import { purchaseOrderService } from '../../services/purchaseOrder.service';
import { createUnifiedPO } from '../../services/unified-po-creation.service';

const mockRun = `PLC${Date.now().toString(36).toUpperCase()}`;
let mockPoSeq = 0;
jest.mock('../../utils/po-number-generator', () => ({
  ...jest.requireActual<typeof import('../../utils/po-number-generator')>('../../utils/po-number-generator'),
  generateUnifiedPONumberInTransaction: async () => `${mockRun}-U${++mockPoSeq}`,
}));

jest.setTimeout(120000);

const RUN = mockRun;
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

const O: Record<string, string> = {};
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

async function makeOrder(name: string, deliveryInDays: number) {
  const id = randomUUID();
  await prisma.orders.create({
    data: {
      id,
      orderNumber: `${RUN}-${name}`,
      customerId,
      status: 'IN_PRODUCTION',
      expectedDeliveryDate: new Date(Date.now() + deliveryInDays * DAY),
      totalQuantity: 100,
      totalAmount: 1000,
      createdById: userId,
    },
  });
  orderIds.push(id);
  O[name] = id;
}

async function makePo(suffix: string, status: 'SENT' | 'DRAFT' | 'PARTIALLY_RECEIVED' = 'SENT') {
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

async function makeLine(poId: string, materialId: string, qty: number) {
  const id = randomUUID();
  await prisma.purchase_order_items.create({
    data: { id, poId, materialId, orderedQuantity: qty, unitPrice: 1, totalPrice: qty, unit: 'PIECE' },
  });
  return id;
}

async function makeRequirement(
  name: string,
  materialId: string,
  orderName: string,
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
      orderId: O[orderName],
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

/** An approved receipt into the store, its lot, the credits recomputed, and the PO counters as the GRN leaves them */
async function receive(poId: string, poItemId: string, materialId: string, qty: number) {
  await prisma.goods_receiving_notes.create({
    data: {
      id: randomUUID(),
      grnNumber: `${RUN}-GRN-${++grnSeq}`,
      poId,
      supplierId,
      warehouseId: storeId,
      status: 'ACCEPTED',
      receivedById: userId,
      approvedById: userId,
      receivingDate: new Date(),
      grn_items: {
        create: [
          {
            id: randomUUID(),
            poItemId,
            materialId,
            orderedQuantity: qty,
            receivedQuantity: qty,
            acceptedQuantity: qty,
            stockQuantity: qty,
            unit: 'PIECE',
          },
        ],
      },
    },
  });
  await prisma.other_material_stock.create({
    data: {
      otherMaterialId: masterOf[materialId],
      quantityAvailable: qty,
      purchaseCost: 1,
      weightedAvgCost: 1,
      receivedDate: new Date(),
      warehouseId: storeId,
    },
  });
  await prisma.$transaction((tx) => applyLineReceipts(tx, [poItemId], { event: 'approve', userId }), {
    timeout: 30000,
  });
  await prisma.purchase_order_items.update({ where: { id: poItemId }, data: { receivedQuantity: qty } });
  await prisma.purchase_orders.update({ where: { id: poId }, data: { status: 'PARTIALLY_RECEIVED' } });
}

const req = (name: string) => prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
const linkOf = (name: string) => prisma.requirement_po_links.findFirst({ where: { requirementId: R[name] } });
const childrenOf = (name: string) => prisma.material_requirements.findMany({ where: { splitFromId: R[name] } });
const figures = (l: { allocatedQuantity: Prisma.Decimal; receivedQuantity: Prisma.Decimal } | null) =>
  l ? [Number(l.allocatedQuantity), Number(l.receivedQuantity)] : null;
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
    await prisma.suppliers.create({
      data: { code: `${RUN}-SUP`, name: `${RUN} Supplier`, isActive: true, createdById: userId },
    })
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

  await makeOrder('O1', 10);
  await makeOrder('O2', 20);
  await makeOrder('O3', 30);
  await makeOrder('OX', 15); // cancelled after its requirement was linked (cancel, nothing received)
  await makeOrder('OY', 25); // cancelled after the PO was closed short
});

afterAll(async () => {
  // Every PO of the fixture supplier — a Unified PO created mid-test is found even if an assertion failed first
  const supplierPos = supplierId
    ? await prisma.purchase_orders.findMany({ where: { supplierId: only(supplierId) }, select: { id: true } })
    : [];
  const allPoIds = [...new Set([...poIds, ...supplierPos.map((p) => p.id)])];
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: allPoIds } } })],
    ['source links', () => prisma.po_source_links.deleteMany({ where: { purchaseOrderId: { in: allPoIds } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: { in: allPoIds } } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: allPoIds } } })],
    ['lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: { in: masterIds } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: allPoIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: allPoIds } } })],
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
      console.error(`[po-allocation-lifecycle teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('cancelling a sent PO that delivered nothing', () => {
  let poId: string;

  beforeAll(async () => {
    const m = await makeOtherMaterial('M1');
    poId = await makePo('C1');
    const line = await makeLine(poId, m, 1500);
    await makeRequirement('plain', m, 'O1', 300);
    await makeRequirement('stock', m, 'O2', 500, { status: 'PARTIAL_STOCK', allocatedFromStock: 100, shortfall: 400 });
    await useStockHold(R.stock, m, 100);
    await makeRequirement('gone', m, 'OX', 250, { status: 'PARTIAL_STOCK', allocatedFromStock: 50, shortfall: 200 });
    await useStockHold(R.gone, m, 50);
    await makeRequirement('surplus', m, 'O3', 100);
    await allocatePoLines(
      poId,
      [
        { purchaseOrderItemId: line, requirementId: R.plain, quantity: 300 },
        { purchaseOrderItemId: line, requirementId: R.stock, quantity: 400 },
        { purchaseOrderItemId: line, requirementId: R.gone, quantity: 200 },
        { purchaseOrderItemId: line, requirementId: R.surplus, quantity: 100 },
      ],
      userId
    );
    // Afterwards: order OX is cancelled while its requirement is still on the PO, and the BOM of O3 now needs 30 less
    await prisma.orders.update({ where: { id: O.OX }, data: { status: 'CANCELLED' } });
    await prisma.material_requirements.update({ where: { id: R.surplus }, data: { surplusQty: 30 } });

    await purchaseOrderService.cancelPurchaseOrder(poId, 'Supplier cannot make it', 'ADMIN', userId);
  });

  it('drops every link and cancels the PO', async () => {
    expect((await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status).toBe('CANCELLED');
    expect(await prisma.requirement_po_links.count({ where: { purchaseOrderId: poId } })).toBe(0);
  });

  it('a plain row goes back to PO_REQUIRED at its full need', async () => {
    const r = await req('plain');
    expect([r.status, Number(r.shortfall)]).toEqual(['PO_REQUIRED', 300]);
  });

  it('a row part-covered from stock goes back to PARTIAL_STOCK and keeps its Use Stock hold', async () => {
    const r = await req('stock');
    expect([r.status, Number(r.allocatedFromStock), Number(r.shortfall)]).toEqual(['PARTIAL_STOCK', 100, 400]);
    expect(await heldForRequirement(prisma, R.stock, 'stock')).toBe(100);
  });

  it('a row of a cancelled order is CANCELLED and lets go of its holds', async () => {
    const r = await req('gone');
    expect(r.status).toBe('CANCELLED');
    expect(await heldForRequirement(prisma, R.gone, 'all')).toBe(0);
  });

  it('a BOM surplus is applied as the row goes back', async () => {
    const r = await req('surplus');
    expect([r.status, Number(r.totalRequired), Number(r.shortfall), r.surplusQty]).toEqual([
      'PO_REQUIRED',
      70,
      70,
      null,
    ]);
  });

  it('carries nothing forward — there was no delivery to split', async () => {
    for (const name of ['plain', 'stock', 'gone', 'surplus']) expect(await childrenOf(name)).toEqual([]);
  });
});

describe('cancelling a PO after a part receipt', () => {
  let poId: string;
  let line: string;

  beforeAll(async () => {
    const m = await makeOtherMaterial('M2');
    poId = await makePo('C2');
    line = await makeLine(poId, m, 1000);
    await makeRequirement('c1', m, 'O1', 300);
    await makeRequirement('c2', m, 'O2', 300);
    await makeRequirement('c3', m, 'O3', 200);
    await allocatePoLines(
      poId,
      [
        { purchaseOrderItemId: line, requirementId: R.c3, quantity: 200 },
        { purchaseOrderItemId: line, requirementId: R.c2, quantity: 300 },
        { purchaseOrderItemId: line, requirementId: R.c1, quantity: 300 },
      ],
      userId
    );
    // 450 arrive: earliest delivery first — c1 300, c2 150, c3 nothing
    await receive(poId, line, m, 450);
    expect(figures(await linkOf('c2'))).toEqual([300, 150]);

    await purchaseOrderService.cancelPurchaseOrder(poId, 'Balance not coming', 'ADMIN', userId, { force: true });
  });

  it('closes each part-delivered requirement RECEIVED at what arrived', async () => {
    const [c1, c2] = [await req('c1'), await req('c2')];
    expect([c1.status, Number(c1.shortfall)]).toEqual(['RECEIVED', 300]);
    expect([c2.status, Number(c2.shortfall)]).toEqual(['RECEIVED', 150]);
  });

  it('carries only the undelivered balance forward, on the same order', async () => {
    expect(await childrenOf('c1')).toEqual([]);
    const [child] = await childrenOf('c2');
    expect([child.status, Number(child.shortfall), child.orderId]).toEqual(['PO_REQUIRED', 150, O.O2]);
  });

  it('hands back the requirement that received nothing', async () => {
    const c3 = await req('c3');
    expect([c3.status, Number(c3.shortfall)]).toEqual(['PO_REQUIRED', 200]);
    expect(await linkOf('c3')).toBeNull();
  });

  it('freezes the kept links at allocated = received, holds unchanged (C3)', async () => {
    expect(figures(await linkOf('c1'))).toEqual([300, 300]);
    expect(figures(await linkOf('c2'))).toEqual([150, 150]);
    const held = await receiptHeldByRequirement(prisma, [R.c1, R.c2]);
    expect([held.get(R.c1), held.get(R.c2)]).toEqual([300, 150]);
  });

  it('a later recompute moves nothing on the closed PO', async () => {
    await prisma.$transaction((tx) => applyLineReceipts(tx, [line], { event: 'link', userId }), { timeout: 30000 });
    expect(figures(await linkOf('c1'))).toEqual([300, 300]);
    expect(figures(await linkOf('c2'))).toEqual([150, 150]);
    expect((await req('c2')).status).toBe('RECEIVED');
  });

  // Needs grn.service.ts (WP-D, change C2): reversal on a CANCELLED PO whose line has credited links is refused
  it.todo('reversing the receipt on the cancelled PO is refused (GRN_PO_CLOSED_LINKED)');
});

describe('short-close, then an order cancel', () => {
  let poId: string;
  let line: string;
  let released: Awaited<ReturnType<typeof releaseCancelledOrderLinks>>;

  beforeAll(async () => {
    const m = await makeOtherMaterial('M3');
    poId = await makePo('C3');
    line = await makeLine(poId, m, 1100);
    await makeRequirement('s1', m, 'O1', 400);
    await makeRequirement('s2', m, 'OY', 300);
    await makeRequirement('s4', m, 'O3', 300);
    await makeRequirement('s5', m, 'O3', 100);
    await allocatePoLines(
      poId,
      [
        { purchaseOrderItemId: line, requirementId: R.s1, quantity: 400 },
        { purchaseOrderItemId: line, requirementId: R.s2, quantity: 300 },
        { purchaseOrderItemId: line, requirementId: R.s4, quantity: 300 },
        { purchaseOrderItemId: line, requirementId: R.s5, quantity: 100 },
      ],
      userId
    );
    // 750 arrive: s1 400, s2 (OY, +25 days) 300, s4 50 — s5 ranks after s4 and gets nothing
    await receive(poId, line, m, 750);
    expect(figures(await linkOf('s4'))).toEqual([300, 50]);

    await purchaseOrderService.shortClosePurchaseOrder(poId, 'Mill stopped the run', 'ADMIN', userId);
  });

  it('closes each part-delivered requirement at what arrived and states the short', async () => {
    const [s1, s2, s4] = [await req('s1'), await req('s2'), await req('s4')];
    expect([s1.status, Number(s1.shortfall), s1.shortQuantity]).toEqual(['RECEIVED', 400, null]);
    expect([s2.status, Number(s2.shortfall)]).toEqual(['RECEIVED', 300]);
    expect([s4.status, Number(s4.shortfall), Number(s4.shortQuantity)]).toEqual(['RECEIVED', 50, 250]);
    expect(await childrenOf('s4')).toEqual([]);
  });

  it('hands back the requirement that received nothing', async () => {
    expect((await req('s5')).status).toBe('PO_REQUIRED');
    expect(await linkOf('s5')).toBeNull();
  });

  it('freezes every kept link at allocated = received (invariant 10)', async () => {
    const links = await prisma.requirement_po_links.findMany({ where: { purchaseOrderId: poId } });
    expect(links).toHaveLength(3);
    for (const l of links) expect(Number(l.allocatedQuantity)).toBe(Number(l.receivedQuantity));
  });

  describe('when order OY is cancelled afterwards', () => {
    beforeAll(async () => {
      await prisma.orders.update({ where: { id: O.OY }, data: { status: 'CANCELLED' } });
      released = await prisma.$transaction((tx) => releaseCancelledOrderLinks(tx, O.OY, userId), { timeout: 30000 });
    });

    it('no other link rises above the shortfall the close wrote', async () => {
      expect(figures(await linkOf('s1'))).toEqual([400, 400]);
      expect(figures(await linkOf('s4'))).toEqual([50, 50]);
      const held = await receiptHeldByRequirement(prisma, [R.s1, R.s4]);
      expect([held.get(R.s1), held.get(R.s4)]).toEqual([400, 50]);
    });

    it("the cancelled order's goods become plain stock, and its hold goes", async () => {
      const lineOutcome = released.lines.find((l) => l.poItemId === line)!;
      expect(lineOutcome.plainStock).toEqual({ STORE: 300 });
      expect(await linkOf('s2')).toBeNull();
      expect(released.unlinked.map((u) => u.requirementId)).toEqual([R.s2]);
      expect(await heldForRequirement(prisma, R.s2, 'all')).toBe(0);
      // It read RECEIVED after the close; with its link gone it leaves the PO statuses (invariant 1)
      expect(released.unlinked.map((u) => [u.status, u.changed])).toEqual([['CANCELLED', true]]);
      expect((await req('s2')).status).toBe('CANCELLED');
    });
  });
});

describe('closing a PO counts a link only up to its allocation', () => {
  let poId: string;

  beforeAll(async () => {
    const m = await makeOtherMaterial('M4');
    poId = await makePo('C4', 'PARTIALLY_RECEIVED');
    const lineA = await makeLine(poId, m, 200);
    const lineB = await makeLine(poId, m, 100);
    await makeRequirement('over', m, 'O1', 100, { status: 'PARTIALLY_RECEIVED' });
    await makeRequirement('none', m, 'O2', 100, { status: 'PO_SENT' });
    // An older, pro-rata-shaped link credited past its allocation (a processing line over-credits its links)
    await prisma.requirement_po_links.create({
      data: {
        requirementId: R.over,
        purchaseOrderId: poId,
        purchaseOrderItemId: lineA,
        allocatedQuantity: 100,
        receivedQuantity: 130,
      },
    });
    await prisma.requirement_po_links.create({
      data: { requirementId: R.none, purchaseOrderId: poId, purchaseOrderItemId: lineB, allocatedQuantity: 100 },
    });
    await prisma.purchase_order_items.update({ where: { id: lineA }, data: { receivedQuantity: 130 } });
  });

  it('short-close writes the shortfall at the allocation, never above it', async () => {
    await purchaseOrderService.shortClosePurchaseOrder(poId, 'Closing the older PO', 'ADMIN', userId);
    const over = await req('over');
    expect([over.status, Number(over.shortfall), over.shortQuantity]).toEqual(['RECEIVED', 100, null]);
    expect((await req('none')).status).toBe('PO_REQUIRED');
  });
});

describe('Unified PO from MRP requirements', () => {
  let m: string;
  const make = (materialId: string, qty: number, requirementIds: string[]) =>
    createUnifiedPO(
      {
        supplierId,
        expectedDeliveryDate: new Date(Date.now() + 15 * DAY),
        createdById: userId,
        source: 'MRP',
        poCategory: 'TRIMS',
        items: [{ materialId, orderedQuantity: qty, unit: 'PIECE', unitPrice: 1 }],
        sourceLinks: { materialRequirementIds: requirementIds },
      },
      { skipDuplicateCheck: true }
    );

  beforeAll(async () => {
    m = await makeOtherMaterial('M5');
    await makeRequirement('u1', m, 'O1', 300);
    await makeRequirement('u2', m, 'O2', 200);
    await makeRequirement('u3', m, 'O1', 300);
    await makeRequirement('u4', m, 'O2', 200);
    await makeRequirement('u5', m, 'O3', 50);
    const draft = await makePo('LD', 'DRAFT');
    const draftLine = await makeLine(draft, m, 50);
    await prisma.requirement_po_links.create({
      data: { requirementId: R.u5, purchaseOrderId: draft, purchaseOrderItemId: draftLine, allocatedQuantity: 50 },
    });
    await prisma.material_requirements.update({ where: { id: R.u5 }, data: { status: 'PO_GENERATED' } });
  });

  it('refuses a requirement already on a PO, writing nothing', async () => {
    const before = await prisma.purchase_orders.count({ where: { supplierId } });
    const err = await errorOf(make(m, 100, [R.u5]));
    expect(err?.message).toMatch(new RegExp(`${RUN}-u5 is already on ${RUN}-LD`));
    expect(await prisma.purchase_orders.count({ where: { supplierId } })).toBe(before);
  });

  it('sizes each link to its need — the rest stays free — ranked earliest delivery first', async () => {
    const res = await make(m, 1000, [R.u2, R.u1]);
    poIds.push(res.purchaseOrder.id);
    expect(res.purchaseOrder.poNumber.startsWith(RUN)).toBe(true);
    const links = await prisma.requirement_po_links.findMany({
      where: { purchaseOrderId: res.purchaseOrder.id },
      orderBy: { fillOrder: 'asc' },
    });
    expect(links.map((l) => [l.requirementId, l.fillOrder, Number(l.allocatedQuantity)])).toEqual([
      [R.u1, 1, 300],
      [R.u2, 2, 200],
    ]);
    expect([(await req('u1')).status, (await req('u2')).status]).toEqual(['PO_GENERATED', 'PO_GENERATED']);
    expect([...(await childrenOf('u1')), ...(await childrenOf('u2'))]).toEqual([]);
  });

  it('a line short of the needs shares them pro-rata and leaves balance rows', async () => {
    const res = await make(m, 400, [R.u3, R.u4]);
    poIds.push(res.purchaseOrder.id);
    const links = await prisma.requirement_po_links.findMany({
      where: { purchaseOrderId: res.purchaseOrder.id },
      orderBy: { fillOrder: 'asc' },
    });
    expect(links.map((l) => [l.requirementId, Number(l.allocatedQuantity)])).toEqual([
      [R.u3, 240],
      [R.u4, 160],
    ]);
    const [u3, u4] = [await req('u3'), await req('u4')];
    expect([u3.status, Number(u3.shortfall)]).toEqual(['PO_GENERATED', 240]);
    expect([u4.status, Number(u4.shortfall)]).toEqual(['PO_GENERATED', 160]);
    const [b3] = await childrenOf('u3');
    const [b4] = await childrenOf('u4');
    expect([b3.status, Number(b3.shortfall), b4.status, Number(b4.shortfall)]).toEqual([
      'PO_REQUIRED',
      60,
      'PO_REQUIRED',
      40,
    ]);
  });
});
