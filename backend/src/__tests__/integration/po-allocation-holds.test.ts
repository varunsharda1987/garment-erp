/**
 * Holds of goods that arrived on a linked PO line, on the paths outside the PO page (docs/plans/po-allocation-design.md
 * §6.7, §8; owner decisions D2, Q1):
 *
 *  - an order cancelled after its goods arrived: what it had not issued passes to the next order in line, a link left
 *    with nothing goes (its row CANCELLED, even one already RECEIVED), a link that issued keeps just that, and the
 *    order holds nothing any more; rows on a PO not yet sent stay PO_GENERATED; the next orders are held no more
 *    than is on the shelf;
 *  - goods given back (C9) come back as a hold only to a requirement that may still hold them;
 *  - lace allocation (the other meaning of "reserved") refuses a lot that carries requirement holds (C13);
 *  - an MRP recalculation squares allocatedFromStock against Use Stock holds only — a receipt hold is never counted
 *    or released by it (invariant 6).
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { allocatePoLines } from '../../services/helpers/po-allocation.helper';
import { applyLineReceipts } from '../../services/helpers/receipt-allocation.helper';
import {
  consumeReservations,
  heldForRequirement,
  receiptHeldByRequirement,
  unconsumeReservations,
  untrackedHeldByMaterial,
} from '../../services/helpers/stock-reservation.helper';
import { reconcileRequirementLineage } from '../../services/helpers/requirement-reconcile.helper';
import { orderService } from '../../services/order.service';
import { allocateStock, transferStock } from '../../services/laceStock.service';
import type { CalculatedRequirement } from '../../types/mrp.types';

jest.setTimeout(120000);

const RUN = `PAH${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;
const REQUIRED = new Date(Math.floor((Date.now() + 25 * DAY) / DAY) * DAY);

let userId: string;
let supplierId: string;
let customerId: string;
let storeId: string;
let styleId: string;
let laceId: string;
let laceMaterialId: string;
const masterIds: string[] = [];
const materialIds: string[] = [];
const masterOf: Record<string, string> = {};
const orderIds: string[] = [];
const orderItemIds: string[] = [];
const bomIds: string[] = [];
const poIds: string[] = [];
const laceLotIds: string[] = [];
const O: Record<string, string> = {};
const R: Record<string, string> = {};
let grnSeq = 0;

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

async function makePo(suffix: string, status: 'SENT' | 'CANCELLED' | 'DRAFT' = 'SENT') {
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

/** An approved receipt into the store, and the trim lot it booked */
async function receive(poId: string, poItemId: string, materialId: string, qty: number, lotQty = qty) {
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
      quantityAvailable: lotQty,
      purchaseCost: 1,
      weightedAvgCost: 1,
      receivedDate: new Date(),
      warehouseId: storeId,
    },
  });
  await prisma.$transaction((tx) => applyLineReceipts(tx, [poItemId], { event: 'approve', userId }), {
    timeout: 30000,
  });
}

/** A hold row written straight in: Use Stock (no link) or receipt (with a link), optionally on a lace lot */
async function hold(
  requirementId: string,
  materialId: string,
  qty: number,
  opts: { poLinkId?: string; laceStockId?: string; ageMinutes?: number } = {}
) {
  await prisma.stock_reservations.create({
    data: {
      materialId,
      warehouseId: storeId,
      reservationType: 'ORDER',
      referenceType: 'MATERIAL_REQUIREMENT',
      referenceId: requirementId,
      referenceNumber: `${RUN}-hold`,
      reservedQuantity: qty,
      unit: opts.laceStockId ? 'METER' : 'PIECE',
      status: 'ACTIVE',
      reservedById: userId,
      reservedAt: new Date(Date.now() - (opts.ageMinutes ?? 0) * 60000),
      poLinkId: opts.poLinkId ?? null,
      laceStockId: opts.laceStockId ?? null,
    },
  });
}

const req = (name: string) => prisma.material_requirements.findUniqueOrThrow({ where: { id: R[name] } });
const linkOf = (name: string) => prisma.requirement_po_links.findFirst({ where: { requirementId: R[name] } });
const errorOf = (p: Promise<unknown>) => p.then(() => null).catch((e) => e);
const receiptHeld = async (name: string) => (await receiptHeldByRequirement(prisma, [R[name]])).get(R[name]) ?? 0;

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
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  laceId = (await prisma.lace_master.create({ data: { laceCode: `${RUN}-LACE`, laceName: `${RUN} Lace` } })).id;
  laceMaterialId = await ensureMaterialRecord(laceId, 'LACE');
  materialIds.push(laceMaterialId);
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: { in: poIds } } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: poIds } } })],
    ['trim lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: { in: masterIds } } })],
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
    ['bom items', () => prisma.order_bom_items.deleteMany({ where: { orderBomId: { in: bomIds } } })],
    ['boms', () => prisma.order_bom.deleteMany({ where: { id: { in: bomIds } } })],
    ['lace ledger', () => prisma.lace_stock_transaction.deleteMany({ where: { stockId: { in: laceLotIds } } })],
    ['lace allocations', () => prisma.lace_stock_allocation.deleteMany({ where: { stockId: { in: laceLotIds } } })],
    ['lace lots', () => prisma.lace_stock.deleteMany({ where: { id: { in: laceLotIds } } })],
    ['order items', () => prisma.order_items.deleteMany({ where: { id: { in: orderItemIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['style', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(storeId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['masters', () => prisma.other_material_master.deleteMany({ where: { id: { in: masterIds } } })],
    ['lace master', () => prisma.lace_master.deleteMany({ where: { id: only(laceId) } })],
    ['supplier', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-holds teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('an order cancelled after its goods arrived', () => {
  it('passes what it had not issued to the next order; its empty link goes and its row is CANCELLED', async () => {
    const mA = await makeOtherMaterial('MA');
    await makeOrder('O1', 10);
    await makeOrder('O2', 20);
    await makeOrder('O3', 30);
    const poA = await makePo('A');
    const a1 = await makeLine(poA, mA, 1000);
    // r1 already took 50 from stock (Use Stock) and is on the PO for the rest
    await makeRequirement('r1', mA, 'O1', 450, { status: 'PARTIAL_STOCK', allocatedFromStock: 50, shortfall: 400 });
    await hold(R.r1, mA, 50);
    await makeRequirement('r2', mA, 'O2', 400);
    await makeRequirement('r3', mA, 'O3', 200);
    await allocatePoLines(
      poA,
      [
        { purchaseOrderItemId: a1, requirementId: R.r1, quantity: 400 },
        { purchaseOrderItemId: a1, requirementId: R.r2, quantity: 400 },
        { purchaseOrderItemId: a1, requirementId: R.r3, quantity: 200 },
      ],
      userId
    );
    // 300 arrive: all of it is O1's (earliest delivery)
    await receive(poA, a1, mA, 300, 350);
    expect(Number((await linkOf('r1'))!.receivedQuantity)).toBe(300);
    expect((await req('r1')).status).toBe('PARTIALLY_RECEIVED');
    expect(await receiptHeld('r1')).toBe(300);

    await orderService.cancelOrder(O.O1, { userId });

    expect((await prisma.orders.findUniqueOrThrow({ where: { id: O.O1 } })).status).toBe('CANCELLED');
    // O1 issued nothing: its link goes, its row is CANCELLED and holds nothing — Use Stock hold included
    expect(await linkOf('r1')).toBeNull();
    expect((await req('r1')).status).toBe('CANCELLED');
    expect(await heldForRequirement(prisma, R.r1)).toBe(0);
    // The 300 pass to O2, and are held for it; O3 still waits
    const r2Link = (await linkOf('r2'))!;
    const r3Link = (await linkOf('r3'))!;
    expect([Number(r2Link.receivedQuantity), Number(r3Link.receivedQuantity)]).toEqual([300, 0]);
    expect([(await req('r2')).status, (await req('r3')).status]).toEqual(['PARTIALLY_RECEIVED', 'PO_SENT']);
    expect([await receiptHeld('r2'), await receiptHeld('r3')]).toEqual([300, 0]);
    expect(r2Link.fillOrder!).toBeLessThan(r3Link.fillOrder!);
  });

  it('a link that issued keeps just what it issued; the rest passes on and the order holds nothing', async () => {
    const mB = await makeOtherMaterial('MB');
    await makeOrder('O4', 5);
    await makeOrder('O5', 15);
    const poB = await makePo('B');
    const b1 = await makeLine(poB, mB, 1000);
    await makeRequirement('r4', mB, 'O4', 400);
    await makeRequirement('r5', mB, 'O5', 400);
    await allocatePoLines(
      poB,
      [
        { purchaseOrderItemId: b1, requirementId: R.r4, quantity: 400 },
        { purchaseOrderItemId: b1, requirementId: R.r5, quantity: 400 },
      ],
      userId
    );
    await receive(poB, b1, mB, 300, 330);
    // O4 issues 120 of what arrived for it
    await prisma.$transaction((tx) => consumeReservations(tx, [R.r4], 120, new Date()));
    expect(await receiptHeld('r4')).toBe(180);
    // …and its row also holds 30 from stock
    await hold(R.r4, mB, 30);

    await orderService.cancelOrder(O.O4, { userId });

    // The link stays, credited only what it issued; its row's status is left as it was
    const r4Link = (await linkOf('r4'))!;
    expect(Number(r4Link.receivedQuantity)).toBe(120);
    expect((await req('r4')).status).toBe('PARTIALLY_RECEIVED');
    // A cancelled order holds nothing: neither what arrived for it nor its own stock
    expect(await heldForRequirement(prisma, R.r4, 'receipt')).toBe(0);
    expect(await heldForRequirement(prisma, R.r4, 'stock')).toBe(0);
    // O5 gets the 180 O4 had not issued
    expect(Number((await linkOf('r5'))!.receivedQuantity)).toBe(180);
    expect(await receiptHeld('r5')).toBe(180);
    expect((await req('r5')).status).toBe('PARTIALLY_RECEIVED');
  });

  it('a row credited in full that issued nothing is CANCELLED with its link — never left RECEIVED (invariant 1)', async () => {
    const mE = await makeOtherMaterial('ME');
    await makeOrder('O6', 3);
    await makeOrder('O7', 13);
    const poE = await makePo('E');
    const e1 = await makeLine(poE, mE, 1000);
    await makeRequirement('r6', mE, 'O6', 200);
    await makeRequirement('r7', mE, 'O7', 400);
    await allocatePoLines(
      poE,
      [
        { purchaseOrderItemId: e1, requirementId: R.r6, quantity: 200 },
        { purchaseOrderItemId: e1, requirementId: R.r7, quantity: 400 },
      ],
      userId
    );
    await receive(poE, e1, mE, 200);
    expect((await req('r6')).status).toBe('RECEIVED');

    await orderService.cancelOrder(O.O6, { userId });

    expect(await linkOf('r6')).toBeNull();
    expect((await req('r6')).status).toBe('CANCELLED');
    expect(await heldForRequirement(prisma, R.r6)).toBe(0);
    // Its 200 pass to O7
    expect(Number((await linkOf('r7'))!.receivedQuantity)).toBe(200);
    expect((await req('r7')).status).toBe('PARTIALLY_RECEIVED');
    expect(await receiptHeld('r7')).toBe(200);
  });

  it('rows on a PO not yet sent stay PO_GENERATED when another order on the line is cancelled', async () => {
    const mF = await makeOtherMaterial('MF');
    await makeOrder('O8', 7);
    await makeOrder('O9', 17);
    const poF = await makePo('F', 'DRAFT');
    const f1 = await makeLine(poF, mF, 500);
    // As MRP generate writes them: one draft line for two orders
    await makeRequirement('r8', mF, 'O8', 200, { status: 'PO_GENERATED' });
    await makeRequirement('r9', mF, 'O9', 300, { status: 'PO_GENERATED' });
    for (const [name, qty] of [
      ['r8', 200],
      ['r9', 300],
    ] as const) {
      await prisma.requirement_po_links.create({
        data: { requirementId: R[name], purchaseOrderId: poF, purchaseOrderItemId: f1, allocatedQuantity: qty },
      });
    }

    await orderService.cancelOrder(O.O8, { userId });

    expect(await linkOf('r8')).toBeNull();
    expect((await req('r8')).status).toBe('CANCELLED');
    expect((await req('r9')).status).toBe('PO_GENERATED');
    expect((await linkOf('r9'))!.fillOrder).toBe(1);
  });

  it('holds for the next orders no more than is on the shelf — goods issued before holds existed are not held again', async () => {
    const mH = await makeOtherMaterial('MH');
    await makeOrder('OA', 4);
    await makeOrder('OB', 14);
    await makeOrder('OC', 24);
    const poH = await makePo('H');
    const h1 = await makeLine(poH, mH, 1100);
    // Links as MRP generate writes them, credited and statused the old way (by delta, no holds)
    const links: Array<[string, string, number]> = [
      ['rA', 'OA', 500],
      ['rB', 'OB', 500],
      ['rC', 'OC', 100],
    ];
    for (const [name, order, qty] of links) {
      const credited = name === 'rC' ? 0 : qty;
      await makeRequirement(name, mH, order, qty, { status: credited > 0 ? 'RECEIVED' : 'PO_SENT' });
      await prisma.requirement_po_links.create({
        data: {
          requirementId: R[name],
          purchaseOrderId: poH,
          purchaseOrderItemId: h1,
          allocatedQuantity: qty,
          receivedQuantity: credited,
        },
      });
    }
    await prisma.goods_receiving_notes.create({
      data: {
        id: randomUUID(),
        grnNumber: `${RUN}-GRN-${++grnSeq}`,
        poId: poH,
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
              poItemId: h1,
              materialId: mH,
              orderedQuantity: 1000,
              receivedQuantity: 1000,
              acceptedQuantity: 1000,
              stockQuantity: 1000,
              unit: 'PIECE',
            },
          ],
        },
      },
    });
    // A and B issued all 1,000 by challan, which consumed no hold: the shelf is empty
    await prisma.other_material_stock.create({
      data: {
        otherMaterialId: masterOf[mH],
        quantityAvailable: 0,
        purchaseCost: 1,
        weightedAvgCost: 1,
        receivedDate: new Date(),
        warehouseId: storeId,
      },
    });

    await orderService.cancelOrder(O.OC, { userId });

    // A and B stay credited, but nothing is held on an empty shelf — no order's issue is blocked by it
    expect([Number((await linkOf('rA'))!.receivedQuantity), Number((await linkOf('rB'))!.receivedQuantity)]).toEqual([
      500, 500,
    ]);
    expect([await receiptHeld('rA'), await receiptHeld('rB')]).toEqual([0, 0]);
    expect((await untrackedHeldByMaterial(prisma, [mH])).get(mH) ?? 0).toBe(0);
    expect((await req('rC')).status).toBe('CANCELLED');
  });
});

describe('goods given back (C9)', () => {
  async function consumedHold(requirementId: string, materialId: string, qty: number) {
    await prisma.stock_reservations.create({
      data: {
        materialId,
        warehouseId: storeId,
        reservationType: 'ORDER',
        referenceType: 'MATERIAL_REQUIREMENT',
        referenceId: requirementId,
        referenceNumber: `${RUN}-hold`,
        reservedQuantity: qty,
        consumedQuantity: qty,
        unit: 'PIECE',
        status: 'CONSUMED',
        reservedById: userId,
        completedAt: new Date(),
      },
    });
  }

  it('come back as a hold only to a live requirement of a running order, and only as far as it took from stock', async () => {
    const mG = await makeOtherMaterial('MG');
    await makeOrder('OG1', 10);
    await makeOrder('OG2', 10);
    const fromStock = { status: 'FULFILLED_STOCK' as const, allocatedFromStock: 100, shortfall: 0 };
    await makeRequirement('g1', mG, 'OG1', 100, fromStock);
    await makeRequirement('g2', mG, 'OG2', 100, fromStock);
    await makeRequirement('g3', mG, 'OG1', 100, { ...fromStock, status: 'CANCELLED' });
    // A receipt hold whose link has since gone (poLinkId SET NULL): the row took nothing from stock
    await makeRequirement('g4', mG, 'OG1', 100, { status: 'RECEIVED' });
    for (const name of ['g1', 'g2', 'g3', 'g4']) await consumedHold(R[name], mG, 100);
    await prisma.orders.update({ where: { id: O.OG2 }, data: { status: 'COMPLETED' } });

    const restored = await prisma.$transaction((tx) =>
      unconsumeReservations(
        tx,
        ['g1', 'g2', 'g3', 'g4'].map((n) => R[n]),
        400
      )
    );

    expect(restored).toBe(100);
    const held = await Promise.all(['g1', 'g2', 'g3', 'g4'].map((n) => heldForRequirement(prisma, R[n])));
    expect(held).toEqual([100, 0, 0, 0]);
  });
});

describe('lace allocation on a lot held for requirements', () => {
  async function laceLot(qty: number, reserved = 0) {
    const lot = await prisma.lace_stock.create({
      data: {
        laceId,
        quantityAvailable: qty,
        quantityReserved: reserved,
        weightedAvgCost: 10,
        purchaseCost: 10,
        receivedDate: new Date(),
        warehouseId: storeId,
        lotNumber: `${RUN}-L${laceLotIds.length + 1}`,
      },
    });
    laceLotIds.push(lot.id);
    return lot.id;
  }

  it('another order needing the held metres is refused, naming who holds them — allocate and transfer alike — and nothing is written', async () => {
    await makeOrder('OL', 20);
    await makeOrder('OL2', 30);
    const heldLot = await laceLot(500, 100);
    await makeRequirement('rLace', laceMaterialId, 'OL', 100, {
      unit: 'METER',
      status: 'FULFILLED_STOCK',
      allocatedFromStock: 100,
      shortfall: 0,
    });
    await hold(R.rLace, laceMaterialId, 100, { laceStockId: heldLot });

    // 400 m are free; 450 for ANOTHER order needs 50 m of OL's hold
    const allocErr = await errorOf(
      allocateStock({ stockId: heldLot, orderId: O.OL2, styleId, quantityToAllocate: 450, createdById: userId })
    );
    expect(allocErr?.details?.code).toBe('LACE_LOT_HELD');
    expect(allocErr.message).toContain(`${RUN}-OL (${RUN}-rLace) 100 m`);
    expect(allocErr.details.holders).toEqual([
      { requirementNumber: `${RUN}-rLace`, orderNumber: `${RUN}-OL`, kind: 'stock', quantity: 100, unit: 'METER' },
    ]);

    const transferErr = await errorOf(
      transferStock({
        stockId: heldLot,
        toOrderId: O.OL2,
        toStyleId: styleId,
        quantityToTransfer: 450,
        performedById: userId,
      })
    );
    expect(transferErr?.details?.code).toBe('LACE_LOT_HELD');

    expect(await prisma.lace_stock_allocation.count({ where: { stockId: heldLot } })).toBe(0);
    const lot = await prisma.lace_stock.findUniqueOrThrow({ where: { id: heldLot } });
    expect([Number(lot.quantityAvailable), Number(lot.quantityReserved)]).toEqual([500, 100]);

    // The order the lace is held FOR may use it: free metres first, then its own hold (2026-10-03 — any hold
    // used to refuse every allocation, even this one)
    const own = await allocateStock({
      stockId: heldLot,
      orderId: O.OL,
      styleId,
      quantityToAllocate: 450,
      createdById: userId,
    });
    expect(Number(own.quantityAllocated)).toBe(450);
    const left = await prisma.stock_reservations.findMany({
      where: { referenceId: R.rLace, laceStockId: heldLot, status: 'ACTIVE' },
    });
    expect(left.reduce((sum, h) => sum + Number(h.reservedQuantity) - Number(h.consumedQuantity), 0)).toBeCloseTo(
      50,
      2
    );
  });

  it('a lot nobody holds — or whose hold is used up — still allocates', async () => {
    const freeLot = await laceLot(500);
    const allocation = await allocateStock({
      stockId: freeLot,
      orderId: O.OL,
      styleId,
      quantityToAllocate: 50,
      createdById: userId,
    });
    expect(Number(allocation.quantityAllocated)).toBe(50);

    // A hold fully issued is not a claim any more
    const usedLot = await laceLot(500);
    await prisma.stock_reservations.create({
      data: {
        materialId: laceMaterialId,
        warehouseId: storeId,
        reservationType: 'ORDER',
        referenceType: 'MATERIAL_REQUIREMENT',
        referenceId: R.rLace,
        reservedQuantity: 40,
        consumedQuantity: 40,
        unit: 'METER',
        status: 'ACTIVE',
        reservedById: userId,
        laceStockId: usedLot,
      },
    });
    await expect(
      allocateStock({ stockId: usedLot, orderId: O.OL, styleId, quantityToAllocate: 50, createdById: userId })
    ).resolves.toMatchObject({ stockId: usedLot });
  });
});

describe('MRP reconcile counts Use Stock holds only', () => {
  let orderItemId: string;
  let bomId: string;
  let cancelledPo: string;

  async function bomLine(materialId: string) {
    const id = randomUUID();
    await prisma.order_bom_items.create({
      data: {
        id,
        orderBomId: bomId,
        materialType: 'OTHER_MATERIAL',
        materialId,
        quantityPerGarment: 1,
        orderQuantity: 100,
        totalQuantity: 100,
        unit: 'PIECE',
        unitPrice: 1,
        totalCost: 100,
      },
    });
    return id;
  }

  /** A link on the cancelled PO: its row still counts as open for the reconcile, but can carry a receipt hold */
  async function cancelledPoLink(name: string, materialId: string, qty: number) {
    const line = await makeLine(cancelledPo, materialId, qty);
    return (
      await prisma.requirement_po_links.create({
        data: {
          requirementId: R[name],
          purchaseOrderId: cancelledPo,
          purchaseOrderItemId: line,
          allocatedQuantity: qty,
          receivedQuantity: qty,
        },
      })
    ).id;
  }

  const calc = (materialId: string, orderBomItemId: string, need: number): CalculatedRequirement => ({
    orderId: O.OR,
    orderItemId,
    materialId,
    orderBomId: bomId,
    orderBomItemId,
    orderQuantity: 100,
    quantityPerUnit: need / 100,
    wastagePercent: 0,
    totalRequired: need,
    unit: 'PIECE',
    availableStock: 0,
    allocatedFromStock: 0,
    shortfall: need,
    status: 'PO_REQUIRED',
    requirementType: 'MATERIAL',
    colorName: null,
  });

  const reconcile = (reqs: CalculatedRequirement[]) =>
    prisma.$transaction(
      (tx) =>
        reconcileRequirementLineage(tx, {
          materialReqs: reqs,
          processingReqs: [],
          requiredDate: REQUIRED,
          userId,
          nextNumber: async () => `${RUN}-N${randomUUID().slice(0, 6)}`,
          settledWhere: { id: { in: [] } },
        }),
      { timeout: 30000 }
    );

  beforeAll(async () => {
    await makeOrder('OR', 25);
    orderItemId = randomUUID();
    await prisma.order_items.create({
      data: { id: orderItemId, orderId: O.OR, styleId, totalQuantity: 100, unitPrice: 10, totalPrice: 1000 },
    });
    orderItemIds.push(orderItemId);
    bomId = (
      await prisma.order_bom.create({
        data: {
          orderId: O.OR,
          styleId,
          orderItemId,
          createdById: userId,
          status: 'APPROVED',
          isActive: true,
          version: 1,
        },
      })
    ).id;
    bomIds.push(bomId);
    cancelledPo = await makePo('X', 'CANCELLED');
  });

  it('an open row carried over shrinks its own stock hold, never the goods held for it off a PO', async () => {
    const mC = await makeOtherMaterial('MC');
    const line = await bomLine(mC);
    await makeRequirement('k', mC, 'OR', 300, {
      status: 'PARTIAL_STOCK',
      allocatedFromStock: 100,
      shortfall: 200,
      orderItemId,
      orderBomId: bomId,
      orderBomItemId: line,
    });
    await hold(R.k, mC, 100, { ageMinutes: 2 });
    // The receipt hold is the NEWER row — "release newest first" over both kinds would take it
    await hold(R.k, mC, 200, { poLinkId: await cancelledPoLink('k', mC, 200), ageMinutes: 1 });

    const outcome = await reconcile([calc(mC, line, 50)]);

    expect(outcome.handledIds.has(R.k)).toBe(true);
    const k = await req('k');
    expect([k.status, Number(k.totalRequired), Number(k.allocatedFromStock), Number(k.shortfall)]).toEqual([
      'FULFILLED_STOCK',
      50,
      50,
      0,
    ]);
    expect(await heldForRequirement(prisma, R.k, 'stock')).toBe(50);
    expect(await receiptHeld('k')).toBe(200);
  });

  it('an open extra beside a committed row shrinks to fit on its stock hold alone', async () => {
    const mD = await makeOtherMaterial('MD');
    const line = await bomLine(mD);
    const bomFields = { orderItemId, orderBomId: bomId, orderBomItemId: line };
    const livePo = await makePo('Y');
    const y1 = await makeLine(livePo, mD, 100);
    await makeRequirement('c', mD, 'OR', 100, { status: 'PO_SENT', ...bomFields });
    await prisma.requirement_po_links.create({
      data: { requirementId: R.c, purchaseOrderId: livePo, purchaseOrderItemId: y1, allocatedQuantity: 100 },
    });
    await makeRequirement('e', mD, 'OR', 200, {
      status: 'PARTIAL_STOCK',
      allocatedFromStock: 150,
      shortfall: 50,
      ...bomFields,
    });
    await hold(R.e, mD, 150, { ageMinutes: 2 });
    await hold(R.e, mD, 100, { poLinkId: await cancelledPoLink('e', mD, 100), ageMinutes: 1 });

    // Need 200: the committed row covers 100, so the extra shrinks from 200 to 100
    await reconcile([calc(mD, line, 200)]);

    const e = await req('e');
    expect([Number(e.totalRequired), Number(e.allocatedFromStock), Number(e.shortfall)]).toEqual([100, 100, 0]);
    expect(await heldForRequirement(prisma, R.e, 'stock')).toBe(100);
    expect(await receiptHeld('e')).toBe(100);
    const c = await req('c');
    expect([c.status, Number(c.totalRequired)]).toEqual(['PO_SENT', 100]);
  });
});
