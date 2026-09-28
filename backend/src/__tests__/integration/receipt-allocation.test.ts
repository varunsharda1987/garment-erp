/**
 * The receipt engine on real rows (owner decisions D1 / D2, 2026-09-29): a SENT PO line with three links, GRNs
 * written the way approveGRN leaves them (ACCEPTED, `stockQuantity` on the line, lots with `grnItemId`), then
 * `applyLineReceipts` approve / reverse in every order.
 *
 * Trims (ACCESSORIES): the earliest order fills first, statuses follow, each link holds credit − issued as ONE
 * lot-less receipt hold (never more than is on the shelf), a reversal lands exactly on the state of the receipts
 * still approved, a reversal that would take back issued goods is refused, and a cancelled order's share passes on.
 * Greige: cloth at the dyer's unit fills that dyer's orders first and is held on that lot; the store's lot tops
 * up anyone; reversing the store receipt releases its lot; a dyer changed after arrival moves the hold (C10).
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import {
  applyLineReceipts,
  computeLineCredits,
  lineCreditDeltasForGrn,
  physicallyFreeForLine,
  requirementDyers,
  type ReceiptEvent,
} from '../../services/helpers/receipt-allocation.helper';
import {
  consumeReservations,
  heldForRequirement,
  receiptHeldByRequirement,
  unconsumeReservations,
} from '../../services/helpers/stock-reservation.helper';
import { STORE_POOL } from '../../services/helpers/receipt-split.helper';

const RUN = `RAL${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let supplierId: string;
let dyerId: string;
let otherDyerId: string;
let customerId: string;
let storeId: string;
let dyerUnitId: string;
let trimId: string;
let greigeId: string;
const orderIds: string[] = [];
const poIds: string[] = [];
let grnSeq = 0;

// Trims (an other-material master, so its lots count as on hand)
const trimLotOfGrn = new Map<string, string>();
let trimPoId: string;
let trimItemId: string;
const trimReqs: string[] = [];
const trimLinks: string[] = [];

// Greige
let greigePoId: string;
let greigeItemId: string;
const greigeReqs: string[] = [];
let g3ChildId: string;

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

async function makePo(suffix: string, poCategory: 'ACCESSORIES' | 'GREIGE') {
  const id = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id,
      poNumber: `${RUN}-PO-${suffix}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 10 * DAY),
      status: 'SENT',
      poCategory,
      createdById: userId,
    },
  });
  poIds.push(id);
  return id;
}

async function makeRequirement(
  suffix: string,
  materialId: string,
  unit: 'PIECE' | 'METER',
  orderId: string | null,
  extra: Partial<Prisma.material_requirementsUncheckedCreateInput> = {}
) {
  const qty = 100;
  return (
    await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-${suffix}`,
        source: 'MANUAL',
        unit,
        materialId,
        orderId,
        orderQuantity: 1,
        quantityPerUnit: qty,
        wastagePercent: 0,
        totalRequired: qty,
        shortfall: qty,
        status: 'PO_SENT',
        requiredDate: new Date(Date.now() + 20 * DAY),
        createdById: userId,
        ...extra,
      },
    })
  ).id;
}

/** A GRN as approveGRN leaves it: ACCEPTED, the line's stockQuantity set; optionally the greige lot it booked. */
async function approvedGrn(opts: {
  poId: string;
  poItemId: string;
  materialId: string;
  qty: number;
  unit: 'PIECE' | 'METER';
  warehouseId: string;
  lot?: { processorId: string | null; sourceType: 'DIRECT' | 'GRN' };
}): Promise<{ grnId: string; lotId: string | null }> {
  const grnId = randomUUID();
  const itemId = randomUUID();
  await prisma.goods_receiving_notes.create({
    data: {
      id: grnId,
      grnNumber: `${RUN}-GRN-${++grnSeq}`,
      poId: opts.poId,
      supplierId,
      warehouseId: opts.warehouseId,
      status: 'ACCEPTED',
      receivedById: userId,
      approvedById: userId,
      receivingDate: new Date(Date.now() + grnSeq * 1000),
      grn_items: {
        create: [
          {
            id: itemId,
            poItemId: opts.poItemId,
            materialId: opts.materialId,
            orderedQuantity: opts.qty,
            receivedQuantity: opts.qty,
            acceptedQuantity: opts.qty,
            unit: opts.unit,
            stockQuantity: opts.qty,
          },
        ],
      },
    },
  });
  let lotId: string | null = null;
  if (opts.materialId === trimId) {
    // The trim lot approval books — what the shelf has, which caps the holds
    lotId = (
      await prisma.other_material_stock.create({
        data: {
          otherMaterialId: trimId,
          quantityAvailable: opts.qty,
          purchaseCost: 1,
          weightedAvgCost: 1,
          receivedDate: new Date(),
          warehouseId: opts.warehouseId,
        },
      })
    ).id;
    trimLotOfGrn.set(grnId, lotId);
  }
  if (opts.lot) {
    lotId = (
      await prisma.greige_stock.create({
        data: {
          greigeId,
          quantityAvailable: opts.qty,
          greigeWidth: 44,
          receivedDate: new Date(),
          warehouseId: opts.warehouseId,
          processorId: opts.lot.processorId,
          sourceType: opts.lot.sourceType,
          grnItemId: itemId,
          createdById: userId,
        },
      })
    ).id;
  }
  return { grnId, lotId };
}

const run = (poItemId: string, event: ReceiptEvent) =>
  prisma.$transaction((tx) => applyLineReceipts(tx, [poItemId], { event, userId }), { timeout: 30000 });

/** Reverse the way reverseGRN orders it: the GRN's status first, then the recompute, then its lot, in one transaction. */
const reverse = (grnId: string, poItemId: string) =>
  prisma.$transaction(
    async (tx) => {
      await tx.goods_receiving_notes.update({ where: { id: grnId }, data: { status: 'REVERSED' } });
      const outcome = await applyLineReceipts(tx, [poItemId], { event: 'reverse', userId });
      const trimLot = trimLotOfGrn.get(grnId);
      if (trimLot) await tx.other_material_stock.delete({ where: { id: trimLot } });
      return outcome;
    },
    { timeout: 30000 }
  );

async function creditsOf(linkIds: string[]) {
  const rows = await prisma.requirement_po_links.findMany({ where: { id: { in: linkIds } } });
  return linkIds.map((id) => Number(rows.find((r) => r.id === id)!.receivedQuantity));
}
async function statusesOf(reqIds: string[]) {
  const rows = await prisma.material_requirements.findMany({ where: { id: { in: reqIds } } });
  return reqIds.map((id) => rows.find((r) => r.id === id)!.status);
}
async function heldOf(reqIds: string[]) {
  const map = await receiptHeldByRequirement(prisma, reqIds);
  return reqIds.map((id) => map.get(id) ?? 0);
}
const lotReserved = async (lotId: string) =>
  Number((await prisma.greige_stock.findUniqueOrThrow({ where: { id: lotId } })).quantityReserved);

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
  const dyer = (code: string) =>
    prisma.suppliers.create({
      data: {
        code: `${RUN}-${code}`,
        name: `${RUN} ${code}`,
        supplierCategories: ['DYEING_PRINTING'],
        createdById: userId,
      },
    });
  dyerId = (await dyer('MANGAL')).id;
  otherDyerId = (await dyer('ARYAN')).id;
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
  dyerUnitId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-MU`,
        warehouseName: `${RUN} Mangal - Processing Unit`,
        warehouseType: 'JOB_WORK',
        supplierId: dyerId,
        createdById: userId,
      },
    })
  ).id;
  trimId = (
    await prisma.other_material_master.create({
      data: { materialCode: `${RUN}-LBL`, materialName: `${RUN} Size label` },
    })
  ).id;
  await ensureMaterialRecord(trimId, 'OTHER_MATERIAL');
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GRG`,
        greigeName: `${RUN} Cambric`,
        composition: '100% Cotton',
        greigeWidth: 44,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(greigeId, 'GREIGE');

  // Three running orders, delivery 10 / 20 / 30 days out → fill order 1 / 2 / 3
  await makeOrder(1, 10);
  await makeOrder(2, 20);
  await makeOrder(3, 30);

  // ── Trims: 4,530 pcs on one line, linked 350 / 322 / 253 ──
  trimPoId = await makePo('T', 'ACCESSORIES');
  trimItemId = randomUUID();
  await prisma.purchase_order_items.create({
    data: {
      id: trimItemId,
      poId: trimPoId,
      materialId: trimId,
      orderedQuantity: 4530,
      unitPrice: 0.6,
      totalPrice: 2718,
      unit: 'PIECE',
    },
  });
  const trimAlloc = [350, 322, 253];
  for (let i = 0; i < 3; i++) {
    const reqId = await makeRequirement(`T${i + 1}`, trimId, 'PIECE', orderIds[i]);
    trimReqs.push(reqId);
    trimLinks.push(
      (
        await prisma.requirement_po_links.create({
          data: {
            requirementId: reqId,
            purchaseOrderId: trimPoId,
            purchaseOrderItemId: trimItemId,
            allocatedQuantity: trimAlloc[i],
            fillOrder: i + 1,
          },
        })
      ).id
    );
  }

  // ── Greige: 1,000 m; g1 and g3 dyed at Mangal (on their PROCESSING child), g2 not decided ──
  greigePoId = await makePo('G', 'GREIGE');
  greigeItemId = randomUUID();
  await prisma.purchase_order_items.create({
    data: {
      id: greigeItemId,
      poId: greigePoId,
      materialId: greigeId,
      orderedQuantity: 1000,
      unitPrice: 67,
      totalPrice: 67000,
      unit: 'METER',
    },
  });
  const greigeAlloc = [100, 200, 300];
  for (let i = 0; i < 3; i++) {
    const reqId = await makeRequirement(`G${i + 1}`, greigeId, 'METER', orderIds[i]);
    greigeReqs.push(reqId);
    await prisma.requirement_po_links.create({
      data: {
        requirementId: reqId,
        purchaseOrderId: greigePoId,
        purchaseOrderItemId: greigeItemId,
        allocatedQuantity: greigeAlloc[i],
        fillOrder: i + 1,
      },
    });
  }
  for (const i of [0, 2]) {
    const child = await makeRequirement(`G${i + 1}P`, greigeId, 'METER', orderIds[i], {
      requirementType: 'PROCESSING',
      linkedRequirementId: greigeReqs[i],
      processorId: dyerId,
      status: 'PO_REQUIRED',
    });
    if (i === 2) g3ChildId = child;
  }
});

afterAll(async () => {
  const materialIds = [trimId, greigeId].filter(Boolean);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['greige lots', () => prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } })],
    ['trim lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(trimId) } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { goods_receiving_notes: { poId: { in: poIds } } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { poId: { in: poIds } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    [
      'warehouses',
      () => prisma.warehouses.deleteMany({ where: { id: { in: [storeId, dyerUnitId].filter(Boolean) } } }),
    ],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['greige', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['trim master', () => prisma.other_material_master.deleteMany({ where: { id: only(trimId) } })],
    [
      'suppliers',
      () => prisma.suppliers.deleteMany({ where: { id: { in: [supplierId, dyerId, otherDyerId].filter(Boolean) } } }),
    ],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[receipt-allocation teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

// What the line's links read for each total approved on it (earliest delivery first)
const TRIM_STATE: Record<number, { credits: number[]; statuses: string[] }> = {
  0: { credits: [0, 0, 0], statuses: ['PO_SENT', 'PO_SENT', 'PO_SENT'] },
  400: { credits: [350, 50, 0], statuses: ['RECEIVED', 'PARTIALLY_RECEIVED', 'PO_SENT'] },
  600: { credits: [350, 250, 0], statuses: ['RECEIVED', 'PARTIALLY_RECEIVED', 'PO_SENT'] },
  1000: { credits: [350, 322, 253], statuses: ['RECEIVED', 'RECEIVED', 'RECEIVED'] },
};

async function expectTrimState(total: number) {
  const want = TRIM_STATE[total];
  expect(await creditsOf(trimLinks)).toEqual(want.credits);
  expect(await statusesOf(trimReqs)).toEqual(want.statuses);
  // D2: each order holds exactly what it was credited (nothing issued yet)
  expect(await heldOf(trimReqs)).toEqual(want.credits);
}

describe('trims — earliest order first, held for it, exact in every order', () => {
  const sequences: Array<[string, Array<['approve' | 'reverse', 'A' | 'B']>]> = [
    [
      'A, B, reverse A, reverse B',
      [
        ['approve', 'A'],
        ['approve', 'B'],
        ['reverse', 'A'],
        ['reverse', 'B'],
      ],
    ],
    [
      'B, A, reverse B, reverse A',
      [
        ['approve', 'B'],
        ['approve', 'A'],
        ['reverse', 'B'],
        ['reverse', 'A'],
      ],
    ],
    [
      'A, B, reverse B, reverse A',
      [
        ['approve', 'A'],
        ['approve', 'B'],
        ['reverse', 'B'],
        ['reverse', 'A'],
      ],
    ],
  ];

  it.each(sequences)('%s — each step reads as the receipts still approved', async (_label, steps) => {
    const size = { A: 400, B: 600 };
    const grns: Partial<Record<'A' | 'B', string>> = {};
    let total = 0;
    for (const [action, which] of steps) {
      if (action === 'approve') {
        grns[which] = (
          await approvedGrn({
            poId: trimPoId,
            poItemId: trimItemId,
            materialId: trimId,
            qty: size[which],
            unit: 'PIECE',
            warehouseId: storeId,
          })
        ).grnId;
        const [outcome] = await run(trimItemId, 'approve');
        total += size[which];
        expect(outcome.arrived).toBe(total);
      } else {
        await reverse(grns[which]!, trimItemId);
        total -= size[which];
      }
      await expectTrimState(total);
    }
  });

  it('holds are lot-less receipt rows for the link, in the store the goods came into', async () => {
    await approvedGrn({
      poId: trimPoId,
      poItemId: trimItemId,
      materialId: trimId,
      qty: 1000,
      unit: 'PIECE',
      warehouseId: storeId,
    });
    const [outcome] = await run(trimItemId, 'approve');
    expect(outcome.plainStock[STORE_POOL]).toBe(75); // 1,000 arrived, 925 linked
    const rows = await prisma.stock_reservations.findMany({ where: { materialId: trimId, status: 'ACTIVE' } });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.poLinkId).not.toBeNull();
      expect([r.greigeStockId, r.fabricStockId, r.laceStockId]).toEqual([null, null, null]);
      expect(r.warehouseId).toBe(storeId);
    }
    // Recomputing again changes nothing (idempotent) and leaves exactly one ACTIVE hold per link
    await run(trimItemId, 'link');
    await expectTrimState(1000);
    expect(await prisma.stock_reservations.count({ where: { materialId: trimId, status: 'ACTIVE' } })).toBe(3);
  });

  it('what a GRN changed per link is its cost basis', async () => {
    const { grnId } = await approvedGrn({
      poId: trimPoId,
      poItemId: trimItemId,
      materialId: trimId,
      qty: 75,
      unit: 'PIECE',
      warehouseId: storeId,
    });
    await run(trimItemId, 'approve');
    // All three links were already full — the 75 is plain stock and charged to nobody
    expect((await lineCreditDeltasForGrn(prisma, grnId)).size).toBe(0);
    const line = (await computeLineCredits(prisma, trimItemId))!;
    expect(line.arrived).toBe(1075);
    expect(line.plain).toBe(150); // 1,075 arrived, 925 linked
    expect(line.toCome).toBe(3455);
    expect(line.uncredited).toBe(0);
    expect(line.held).toBe(925);
    await reverse(grnId, trimItemId);
  });

  it('issued goods are a floor: the reversal that would take them back is refused, and allowed once they come back', async () => {
    // 1,000 approved (previous test) — issue 300 to the first order from its hold
    await prisma.$transaction((tx) => consumeReservations(tx, [trimReqs[0]], 300, new Date()));
    expect(await heldForRequirement(prisma, trimReqs[0])).toBe(50);

    const grnIds = (
      await prisma.goods_receiving_notes.findMany({
        where: { poId: trimPoId, status: 'ACCEPTED' },
        select: { id: true },
      })
    ).map((g) => g.id);
    expect(grnIds).toHaveLength(1);
    await expect(reverse(grnIds[0], trimItemId)).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'GRN_REVERSAL_ISSUED' }),
    });
    // Rolled back whole: still approved, still credited
    expect((await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: grnIds[0] } })).status).toBe(
      'ACCEPTED'
    );
    expect(await creditsOf(trimLinks)).toEqual([350, 322, 253]);

    // A part delivery on top, then taking the big one away: the first order keeps what it issued
    const { grnId: small } = await approvedGrn({
      poId: trimPoId,
      poItemId: trimItemId,
      materialId: trimId,
      qty: 400,
      unit: 'PIECE',
      warehouseId: storeId,
    });
    await run(trimItemId, 'approve');
    await reverse(grnIds[0], trimItemId); // 400 left, 300 of it issued to order 1
    expect(await creditsOf(trimLinks)).toEqual([350, 50, 0]);
    expect(await heldOf(trimReqs)).toEqual([50, 50, 0]); // order 1: credit 350 − issued 300

    // The goods come back (job-work cancel / receive-back): the hold is restored, and the reversal goes through
    await prisma.$transaction((tx) => unconsumeReservations(tx, [trimReqs[0]], 300));
    expect(await heldForRequirement(prisma, trimReqs[0])).toBe(350);
    await reverse(small, trimItemId);
    await expectTrimState(0);
  });

  it('a cancelled order keeps nothing it did not issue — its share passes to the next order', async () => {
    await approvedGrn({
      poId: trimPoId,
      poItemId: trimItemId,
      materialId: trimId,
      qty: 600,
      unit: 'PIECE',
      warehouseId: storeId,
    });
    await run(trimItemId, 'approve');
    await expectTrimState(600);

    await prisma.orders.update({ where: { id: orderIds[0] }, data: { status: 'CANCELLED' } });
    try {
      await run(trimItemId, 'order-cancel');
      expect(await creditsOf(trimLinks)).toEqual([0, 322, 253]);
      expect(await heldOf(trimReqs)).toEqual([0, 322, 253]);
      // A cancelled order's requirement is not moved by receipts
      expect((await statusesOf(trimReqs))[0]).toBe('RECEIVED');
    } finally {
      await prisma.orders.update({ where: { id: orderIds[0] }, data: { status: 'PENDING' } });
    }
    await run(trimItemId, 'order-cancel');
    await expectTrimState(600);
  });

  it('never holds more than is on the shelf — goods that left without using a hold are not held again', async () => {
    // 600 approved (previous test); 500 leave by a path that uses no hold (an issue from before holds existed)
    const [live] = await prisma.goods_receiving_notes.findMany({
      where: { poId: trimPoId, status: 'ACCEPTED' },
      select: { id: true },
    });
    const lotId = trimLotOfGrn.get(live.id)!;
    await prisma.other_material_stock.update({ where: { id: lotId }, data: { quantityAvailable: 100 } });

    const [outcome] = await run(trimItemId, 'link');
    // Credits follow the receipts; the 100 still there are held for the earliest order
    expect(await creditsOf(trimLinks)).toEqual([350, 250, 0]);
    expect(await heldOf(trimReqs)).toEqual([100, 0, 0]);
    expect(outcome.holdShortfalls.map((h) => [h.wanted, h.held])).toEqual([
      [350, 100],
      [250, 0],
    ]);
    expect(await physicallyFreeForLine(prisma, trimItemId, STORE_POOL)).toBe(0);

    // The goods are back on the shelf: the next recompute holds them again
    await prisma.other_material_stock.update({ where: { id: lotId }, data: { quantityAvailable: 600 } });
    await run(trimItemId, 'link');
    await expectTrimState(600);
    await reverse(live.id, trimItemId);
    await expectTrimState(0);
  });

  it('a finished order takes nothing more from later receipts — they pass to the running orders (D11)', async () => {
    const { grnId: first } = await approvedGrn({
      poId: trimPoId,
      poItemId: trimItemId,
      materialId: trimId,
      qty: 100,
      unit: 'PIECE',
      warehouseId: storeId,
    });
    await run(trimItemId, 'approve');
    expect(await creditsOf(trimLinks)).toEqual([100, 0, 0]);

    await prisma.orders.update({ where: { id: orderIds[0] }, data: { status: 'COMPLETED' } });
    try {
      const { grnId: second } = await approvedGrn({
        poId: trimPoId,
        poItemId: trimItemId,
        materialId: trimId,
        qty: 900,
        unit: 'PIECE',
        warehouseId: storeId,
      });
      await run(trimItemId, 'approve');
      // Order 1 keeps its 100 and holds none of it; the 900 fill orders 2 and 3, and 325 are plain stock
      expect(await creditsOf(trimLinks)).toEqual([100, 322, 253]);
      expect(await heldOf(trimReqs)).toEqual([0, 322, 253]);
      const line = (await computeLineCredits(prisma, trimItemId))!;
      expect([line.allocated, line.plain, line.uncredited]).toEqual([675, 325, 0]);
      expect(await statusesOf(trimReqs.slice(1))).toEqual(['RECEIVED', 'RECEIVED']);

      // Reopened, it has its place back at the next recompute
      await prisma.orders.update({ where: { id: orderIds[0] }, data: { status: 'IN_PRODUCTION' } });
      await run(trimItemId, 'link');
      await expectTrimState(1000);
      await reverse(second, trimItemId);
      await reverse(first, trimItemId);
      await expectTrimState(0);
    } finally {
      await prisma.orders.update({ where: { id: orderIds[0] }, data: { status: 'PENDING' } });
    }
  });
});

describe('greige — pools by where the cloth arrived, held on the lots it arrived as', () => {
  let grn1: { grnId: string; lotId: string | null };
  let grn2: { grnId: string; lotId: string | null };
  const links = async () =>
    (
      await prisma.requirement_po_links.findMany({
        where: { purchaseOrderItemId: greigeItemId },
        orderBy: { fillOrder: 'asc' },
      })
    ).map((l) => Number(l.receivedQuantity));

  it('the dyer of a requirement is its PROCESSING child’s processor', async () => {
    const dyers = await requirementDyers(prisma, greigeReqs);
    expect(greigeReqs.map((id) => dyers.get(id))).toEqual([dyerId, null, dyerId]);
  });

  it('250 m straight to Mangal fills the Mangal orders first and is held on that lot', async () => {
    grn1 = await approvedGrn({
      poId: greigePoId,
      poItemId: greigeItemId,
      materialId: greigeId,
      qty: 250,
      unit: 'METER',
      warehouseId: dyerUnitId,
      lot: { processorId: dyerId, sourceType: 'DIRECT' },
    });
    const [outcome] = await run(greigeItemId, 'approve');
    expect(outcome.holdShortfalls).toEqual([]);
    expect(await links()).toEqual([100, 0, 150]);
    expect(await heldOf(greigeReqs)).toEqual([100, 0, 150]);
    expect(await lotReserved(grn1.lotId!)).toBe(250);
    expect(await physicallyFreeForLine(prisma, greigeItemId, dyerId)).toBe(0);
  });

  it('300 m into our store tops up anyone, held on the store lot; reversing it releases that lot exactly', async () => {
    grn2 = await approvedGrn({
      poId: greigePoId,
      poItemId: greigeItemId,
      materialId: greigeId,
      qty: 300,
      unit: 'METER',
      warehouseId: storeId,
      lot: { processorId: null, sourceType: 'GRN' },
    });
    await run(greigeItemId, 'approve');
    expect(await links()).toEqual([100, 200, 250]);
    expect(await lotReserved(grn1.lotId!)).toBe(250);
    expect(await lotReserved(grn2.lotId!)).toBe(300);
    const onStore = await prisma.stock_reservations.findMany({
      where: { greigeStockId: grn2.lotId!, status: 'ACTIVE' },
      select: { referenceId: true, reservedQuantity: true },
    });
    expect(
      Object.fromEntries(onStore.map((r) => [greigeReqs.indexOf(r.referenceId) + 1, Number(r.reservedQuantity)]))
    ).toEqual({ 2: 200, 3: 100 });
    const deltas = await lineCreditDeltasForGrn(prisma, grn2.grnId);
    expect([...deltas.values()].sort((a, b) => a - b)).toEqual([100, 200]);

    await reverse(grn2.grnId, greigeItemId);
    expect(await links()).toEqual([100, 0, 150]);
    expect(await lotReserved(grn2.lotId!)).toBe(0);
    expect(await lotReserved(grn1.lotId!)).toBe(250);
    expect(await statusesOf(greigeReqs)).toEqual(['RECEIVED', 'PO_SENT', 'PARTIALLY_RECEIVED']);
  });

  it('the dyer changed after the cloth arrived: the next recompute moves the credit and the hold (C10)', async () => {
    await prisma.material_requirements.update({ where: { id: g3ChildId }, data: { processorId: otherDyerId } });
    await run(greigeItemId, 'link');
    // g3 is now dyed at Aryan and cannot use Mangal's cloth; g2 (no dyer yet) may
    expect(await links()).toEqual([100, 150, 0]);
    expect(await heldOf(greigeReqs)).toEqual([100, 150, 0]);
    expect(await lotReserved(grn1.lotId!)).toBe(250);
    await reverse(grn1.grnId, greigeItemId);
    expect(await links()).toEqual([0, 0, 0]);
    expect(await lotReserved(grn1.lotId!)).toBe(0);
  });
});
