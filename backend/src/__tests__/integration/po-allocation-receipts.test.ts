/**
 * Receipts on a PO allocated to running orders, through the REAL approveGRN / reverseGRN (po-allocation design
 * §6.6, §6.7, C2, C7; owner decisions D1 / D2, 2026-09-29).
 *
 *  - Trims: two receipts fill the earliest order first and are held for it; a QC-rejected part counts for
 *    nothing; reversing the first lands exactly on "only the second arrived"; plain stock is charged to no style;
 *    a reversal that would leave orders holding more than is on the shelf is refused; a cancelled PO whose
 *    receipt is already credited cannot be reversed (C2).
 *  - Greige: a receipt rejected while waiting for QC credits nobody; a lot another order holds cannot be reversed
 *    (GRN_LOT_HELD) until it lets go.
 *  - Greige "received as ready fabric" on a linked line: its orders are credited (credit only — a fabric lot holds
 *    no greige, and that is no hold shortfall) and their dyeing is cancelled; another line of the same PO, still
 *    coming as greige, is left alone. Reversing it takes the credit back.
 *  - Greige at a processor's unit that is linked to no processor fills nobody — plain stock (C7). approveGRN
 *    refuses to book there at all, so the unit is unlinked after the receipt.
 *  - Greige lace counted at a fold length is booked, credited and held in ACTUAL metres.
 *
 * Tagged fixtures (RUN), everything torn down; nothing real is touched.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { getDerivedOnHandMap } from '../../services/helpers/derived-stock.helper';
import { computeLineCredits, lineCreditDeltasForGrn } from '../../services/helpers/receipt-allocation.helper';
import {
  receiptHeldByRequirement,
  releaseReservations,
  reserveOnLots,
} from '../../services/helpers/stock-reservation.helper';

const RUN = `PAR${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let supplierId: string;
let dyerId: string;
let customerId: string;
let storeId: string;
let dyerUnitId: string;
let trimId: string;
let greigeId: string;
let laceId: string;
/** Ready-fabric PO: line 1's greige (a fabric is made from it) and line 2's */
let rfGreigeId: string;
let rfGreige2Id: string;
let rfFabricId: string;
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

async function makePo(
  poCategory: 'OTHER_MATERIAL' | 'GREIGE' | 'GREIGE_LACE',
  materialId: string,
  orderedQuantity: number,
  unit: 'PIECE' | 'METER',
  unitPrice: number
): Promise<{ poId: string; poItemId: string }> {
  const poId = randomUUID();
  await prisma.purchase_orders.create({
    data: {
      id: poId,
      poNumber: `${RUN}-PO${poIds.length + 1}`,
      supplierId,
      poDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 10 * DAY),
      status: 'SENT',
      poCategory,
      createdById: userId,
    },
  });
  poIds.push(poId);
  const poItemId = randomUUID();
  await prisma.purchase_order_items.create({
    data: {
      id: poItemId,
      poId,
      materialId,
      orderedQuantity,
      receivedQuantity: 0,
      unitPrice,
      totalPrice: orderedQuantity * unitPrice,
      unit,
    },
  });
  return { poId, poItemId };
}

/** One more line on a PO */
async function addLine(poId: string, materialId: string, orderedQuantity: number, unitPrice: number) {
  return (
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId,
        materialId,
        orderedQuantity,
        receivedQuantity: 0,
        unitPrice,
        totalPrice: orderedQuantity * unitPrice,
        unit: 'METER',
      },
    })
  ).id;
}

async function makeRequirement(
  materialId: string,
  unit: 'PIECE' | 'METER',
  orderId: string | null,
  extra: Partial<Prisma.material_requirementsUncheckedCreateInput> = {}
) {
  return (
    await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-MR${++reqSeq}`,
        source: 'MANUAL',
        unit,
        materialId,
        orderId,
        orderQuantity: 1,
        quantityPerUnit: 1000,
        wastagePercent: 0,
        totalRequired: 1000,
        shortfall: 1000,
        status: 'PO_SENT',
        requiredDate: new Date(Date.now() + 20 * DAY),
        createdById: userId,
        ...extra,
      },
    })
  ).id;
}

async function link(requirementId: string, poId: string, poItemId: string, allocated: number, fillOrder: number) {
  return (
    await prisma.requirement_po_links.create({
      data: {
        requirementId,
        purchaseOrderId: poId,
        purchaseOrderItemId: poItemId,
        allocatedQuantity: allocated,
        fillOrder,
      },
    })
  ).id;
}

/** A receipt through the real createGRN, left waiting for QC */
async function createReceipt(
  poId: string,
  poItemId: string,
  materialId: string,
  unit: 'PIECE' | 'METER',
  warehouseId: string,
  qty: { received: number; accepted?: number; foldLengthCm?: number; receivedAsReadyFabric?: boolean }
): Promise<string> {
  const accepted = qty.accepted ?? qty.received;
  const grn = await grnService.createGRN(
    {
      poId,
      invoiceToFollow: true,
      warehouseId,
      items: [
        {
          poItemId,
          materialId,
          receivedQuantity: qty.received,
          acceptedQuantity: accepted,
          rejectedQuantity: qty.received - accepted,
          unit,
          weaverNotKnown: true,
          ...(qty.foldLengthCm ? { foldLengthCm: qty.foldLengthCm } : {}),
          ...(qty.receivedAsReadyFabric ? { receivedAsReadyFabric: true } : {}),
        },
      ],
    },
    userId
  );
  return grn.id;
}

/** createGRN + approveGRN, the way the GRN screen does it */
async function receive(
  poId: string,
  poItemId: string,
  materialId: string,
  unit: 'PIECE' | 'METER',
  warehouseId: string,
  qty: { received: number; accepted?: number; foldLengthCm?: number },
  opts?: { directDeliveryConfirmed?: boolean }
): Promise<string> {
  const grnId = await createReceipt(poId, poItemId, materialId, unit, warehouseId, qty);
  await grnService.approveGRN(grnId, userId, warehouseId, undefined, opts);
  return grnId;
}

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
const onHand = async (materialId: string) => (await getDerivedOnHandMap([materialId])).get(materialId) ?? 0;
const greigeLot = (grnId: string) => prisma.greige_stock.findFirstOrThrow({ where: { grnItem: { grnId } } });
const grnStatus = async (grnId: string) =>
  (await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: grnId } })).status;

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
  dyerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-MANGAL`,
        name: `${RUN} Mangal`,
        supplierCategories: ['DYEING_PRINTING'],
        createdById: userId,
      },
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
        isActive: true,
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
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  trimId = (
    await prisma.other_material_master.create({
      data: { materialCode: `${RUN}-TAG`, materialName: `${RUN} Hang tag` },
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
  laceId = (
    await prisma.lace_master.create({
      data: { laceCode: `${RUN}-GL`, laceName: `${RUN} Greige Organza`, isGreige: true, laceType: 'Organza', width: 1 },
    })
  ).id;
  await ensureMaterialRecord(laceId, 'LACE');
  const mkGreige = async (tag: string) => {
    const id = (
      await prisma.greige_master.create({
        data: {
          greigeCode: `${RUN}-${tag}`,
          greigeName: `${RUN} ${tag}`,
          composition: '100% Cotton',
          greigeWidth: 44,
          createdById: userId,
        },
      })
    ).id;
    await ensureMaterialRecord(id, 'GREIGE');
    return id;
  };
  rfGreigeId = await mkGreige('RFG');
  rfGreige2Id = await mkGreige('RFG2');
  rfFabricId = (
    await prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-RFF`,
        fabricName: `${RUN} Ready Cambric`,
        greigeId: rfGreigeId,
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(rfFabricId, 'FABRIC');

  // Three running orders, delivery 10 / 20 / 30 days out → fill order 1 / 2 / 3
  await makeOrder(1, 10);
  await makeOrder(2, 20);
  await makeOrder(3, 30);
});

afterAll(async () => {
  const greigeIds = [greigeId, rfGreigeId, rfGreige2Id].filter(Boolean);
  const materialIds = [trimId, laceId, rfFabricId, ...greigeIds].filter(Boolean);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const greigeLots = (
    await prisma.greige_stock.findMany({ where: { greigeId: { in: greigeIds.map(only) } }, select: { id: true } })
  ).map((l) => l.id);
  const fabricLots = (
    await prisma.fabric_stock.findMany({ where: { fabricId: only(rfFabricId) }, select: { id: true } })
  ).map((l) => l.id);
  const laceLots = (await prisma.lace_stock.findMany({ where: { laceId: only(laceId) }, select: { id: true } })).map(
    (l) => l.id
  );
  const challanIds = (
    await prisma.challans.findMany({ where: { directSupplyGrnId: { in: grnIds } }, select: { id: true } })
  ).map((c) => c.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['challan items', () => prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } })],
    ['challans', () => prisma.challans.deleteMany({ where: { id: { in: challanIds } } })],
    ['reservations', () => prisma.stock_reservations.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: poIds } } })],
    ['greige details', () => prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: greigeLots } } })],
    ['greige txns', () => prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: greigeLots } } })],
    ['greige lots', () => prisma.greige_stock.deleteMany({ where: { id: { in: greigeLots } } })],
    ['lace txns', () => prisma.lace_stock_transaction.deleteMany({ where: { stockId: { in: laceLots } } })],
    ['lace lots', () => prisma.lace_stock.deleteMany({ where: { id: { in: laceLots } } })],
    ['trim lots', () => prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(trimId) } })],
    ['fabric details', () => prisma.fabric_stock_details.deleteMany({ where: { fabricStockId: { in: fabricLots } } })],
    ['fabric txns', () => prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLots } } })],
    ['fabric lots', () => prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLots } } })],
    ['fabric procurement', () => prisma.fabric_procurement.deleteMany({ where: { greigeId: only(greigeId) } })],
    ['ready fabric procurement', () => prisma.fabric_procurement.deleteMany({ where: { fabricId: only(rfFabricId) } })],
    ['movements', () => prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['transactions', () => prisma.stock_transactions.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['grn details', () => prisma.grn_item_details.deleteMany({ where: { grn_items: { grnId: { in: grnIds } } } })],
    ['grn items', () => prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    [
      'child requirements',
      () =>
        prisma.material_requirements.deleteMany({
          where: { materialId: { in: materialIds }, linkedRequirementId: { not: null } },
        }),
    ],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: { in: orderIds } } })],
    ['customer', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    [
      'warehouses',
      () => prisma.warehouses.deleteMany({ where: { id: { in: [storeId, dyerUnitId].filter(Boolean) } } }),
    ],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['ready fabric', () => prisma.fabric_master.deleteMany({ where: { id: only(rfFabricId) } })],
    ['greige', () => prisma.greige_master.deleteMany({ where: { id: { in: greigeIds.map(only) } } })],
    ['lace', () => prisma.lace_master.deleteMany({ where: { id: only(laceId) } })],
    ['trim master', () => prisma.other_material_master.deleteMany({ where: { id: only(trimId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: { in: [supplierId, dyerId].filter(Boolean) } } })],
    ['user', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, step] of steps) {
    try {
      await step();
    } catch (err) {
      console.error(`[po-allocation-receipts teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('trims — two receipts fill the earliest order first; reversal is exact', () => {
  let poId: string;
  let poItemId: string;
  const reqs: string[] = [];
  const links: string[] = [];
  let grnA: string;
  let grnB: string;

  beforeAll(async () => {
    ({ poId, poItemId } = await makePo('OTHER_MATERIAL', trimId, 1000, 'PIECE', 2));
    const alloc = [350, 322, 253];
    for (let i = 0; i < 3; i++) {
      reqs.push(await makeRequirement(trimId, 'PIECE', orderIds[i]));
      links.push(await link(reqs[i], poId, poItemId, alloc[i], i + 1));
    }
  });

  it('receipt A (650 in, 50 rejected at QC): only the 600 accepted fill — order 1 full, order 2 part', async () => {
    grnA = await receive(poId, poItemId, trimId, 'PIECE', storeId, { received: 650, accepted: 600 });
    expect(await creditsOf(links)).toEqual([350, 250, 0]);
    expect(await statusesOf(reqs)).toEqual(['RECEIVED', 'PARTIALLY_RECEIVED', 'PO_SENT']);
    expect(await heldOf(reqs)).toEqual([350, 250, 0]); // held for them (D2)
    expect(
      Number((await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: poItemId } })).receivedQuantity)
    ).toBe(600);
  });

  it('receipt B (400): everyone full, 75 plain stock — charged to no style', async () => {
    grnB = await receive(poId, poItemId, trimId, 'PIECE', storeId, { received: 400 });
    expect(await creditsOf(links)).toEqual([350, 322, 253]);
    expect(await statusesOf(reqs)).toEqual(['RECEIVED', 'RECEIVED', 'RECEIVED']);
    expect(await heldOf(reqs)).toEqual([350, 322, 253]);
    const line = (await computeLineCredits(prisma, poItemId))!;
    expect([line.arrived, line.plain, line.held]).toEqual([1000, 75, 925]);
    // The cost basis: what B gave each order — 72 + 253; the 75 left over is charged to nobody
    const deltas = await lineCreditDeltasForGrn(prisma, grnB);
    expect(links.map((id) => deltas.get(id) ?? 0)).toEqual([0, 72, 253]);
  });

  it('a reversal that would leave orders holding more than is on the shelf is refused, and changes nothing', async () => {
    // Order 3 also holds 60 from stock (Use Stock, no PO link): 925 + 60 held of 1,000 on hand
    const stockReq = await makeRequirement(trimId, 'PIECE', orderIds[2], { status: 'FULFILLED_STOCK' });
    await prisma.$transaction((tx) =>
      reserveOnLots(tx, {
        requirement: { id: stockReq, requirementNumber: `${RUN}-USE`, materialId: trimId, unit: 'PIECE' },
        lots: [],
        userId,
        fallbackWarehouseId: storeId,
        untrackedQuantity: 60,
      })
    );
    // Taking A's 600 back leaves 400 on hand against 400 receipt holds + 60 → refused
    await expect(grnService.reverseGRN(grnA, userId, `${RUN} test`)).rejects.toMatchObject({
      details: expect.objectContaining({ code: 'GRN_REVERSAL_HELD_STOCK' }),
    });
    expect(await grnStatus(grnA)).toBe('ACCEPTED');
    expect(await creditsOf(links)).toEqual([350, 322, 253]);
    expect(await onHand(trimId)).toBe(1000);

    await prisma.$transaction((tx) => releaseReservations(tx, [stockReq]));
  });

  it('reversing A lands exactly on "only B arrived"', async () => {
    await grnService.reverseGRN(grnA, userId, `${RUN} test`);
    expect(await grnStatus(grnA)).toBe('REVERSED');
    expect(await creditsOf(links)).toEqual([350, 50, 0]);
    expect(await statusesOf(reqs)).toEqual(['RECEIVED', 'PARTIALLY_RECEIVED', 'PO_SENT']);
    expect(await heldOf(reqs)).toEqual([350, 50, 0]);
    expect(await onHand(trimId)).toBe(400);
  });

  it('a cancelled PO whose receipt is credited to orders cannot be reversed (C2)', async () => {
    const before = (await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } })).status;
    await prisma.purchase_orders.update({ where: { id: poId }, data: { status: 'CANCELLED' } });
    try {
      await expect(grnService.reverseGRN(grnB, userId, `${RUN} test`)).rejects.toMatchObject({
        details: expect.objectContaining({ code: 'GRN_PO_CLOSED_LINKED' }),
      });
      expect(await grnStatus(grnB)).toBe('ACCEPTED');
      expect(await creditsOf(links)).toEqual([350, 50, 0]);
    } finally {
      await prisma.purchase_orders.update({ where: { id: poId }, data: { status: before } });
    }
  });

  it('reversing B too leaves nothing credited, held or on hand', async () => {
    await grnService.reverseGRN(grnB, userId, `${RUN} test`);
    expect(await creditsOf(links)).toEqual([0, 0, 0]);
    expect(await statusesOf(reqs)).toEqual(['PO_SENT', 'PO_SENT', 'PO_SENT']);
    expect(await heldOf(reqs)).toEqual([0, 0, 0]);
    expect(await onHand(trimId)).toBe(0);
  });
});

describe('greige — a receipt rejected at QC, and a lot another order holds', () => {
  let poId: string;
  let poItemId: string;
  let req1: string;
  let link1: string;
  let grnId: string;

  beforeAll(async () => {
    ({ poId, poItemId } = await makePo('GREIGE', greigeId, 2000, 'METER', 67));
    req1 = await makeRequirement(greigeId, 'METER', orderIds[0]);
    link1 = await link(req1, poId, poItemId, 600, 1);
  });

  it('a receipt waiting for QC credits nobody, and rejecting it credits nobody either', async () => {
    const pending = await createReceipt(poId, poItemId, greigeId, 'METER', storeId, { received: 500 });
    expect(await grnStatus(pending)).toBe('PENDING_QC');
    expect(await creditsOf([link1])).toEqual([0]);

    await grnService.rejectGRN(pending, userId, `${RUN} test`);
    expect(await grnStatus(pending)).toBe('REJECTED');
    expect(await creditsOf([link1])).toEqual([0]);
    expect(await statusesOf([req1])).toEqual(['PO_SENT']);
    expect(
      Number((await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: poItemId } })).receivedQuantity)
    ).toBe(0);
  });

  it('1,000 m in: the order is credited its 600 and it is held on the lot', async () => {
    grnId = await receive(poId, poItemId, greigeId, 'METER', storeId, { received: 1000 });
    expect(await creditsOf([link1])).toEqual([600]);
    expect(await statusesOf([req1])).toEqual(['RECEIVED']);
    const lot = await greigeLot(grnId);
    expect(Number(lot.quantityReserved)).toBe(600);
  });

  it('refuses to reverse while another order holds part of the lot, naming it — then allows it once let go', async () => {
    const lot = await greigeLot(grnId);
    const otherReq = await makeRequirement(greigeId, 'METER', orderIds[1], {
      status: 'PARTIAL_STOCK',
      allocatedFromStock: 150,
    });
    await prisma.$transaction((tx) =>
      reserveOnLots(tx, {
        requirement: { id: otherReq, requirementNumber: `${RUN}-USE-G`, materialId: greigeId, unit: 'METER' },
        lots: [{ table: 'greige', lotId: lot.id, warehouseId: storeId, quantity: 150 }],
        userId,
        fallbackWarehouseId: storeId,
      })
    );

    const refusal = grnService.reverseGRN(grnId, userId, `${RUN} test`);
    await expect(refusal).rejects.toMatchObject({ details: expect.objectContaining({ code: 'GRN_LOT_HELD' }) });
    await expect(refusal).rejects.toThrow(new RegExp(`${RUN}ORD2`));
    // Rolled back whole: still approved, still credited and held, the lot untouched
    expect(await grnStatus(grnId)).toBe('ACCEPTED');
    expect(await creditsOf([link1])).toEqual([600]);
    const after = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lot.id } });
    expect([Number(after.quantityAvailable), Number(after.quantityReserved)]).toEqual([1000, 750]);

    await prisma.$transaction((tx) => releaseReservations(tx, [otherReq]));
    await grnService.reverseGRN(grnId, userId, `${RUN} test`);
    expect(await creditsOf([link1])).toEqual([0]);
    expect(await statusesOf([req1])).toEqual(['PO_SENT']);
    const gone = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lot.id } });
    expect([Number(gone.quantityAvailable), Number(gone.quantityReserved), gone.status]).toEqual([0, 0, 'EXHAUSTED']);
  });
});

describe('greige received as ready fabric — its own line only', () => {
  let poId: string;
  let line1: string;
  let line2: string;
  let req1: string;
  let req2: string;
  let dyeing1: string;
  let dyeing2: string;
  let link1: string;
  let link2: string;
  let grnId: string;

  beforeAll(async () => {
    // One PO, two greige lines, each allocated to an order that dyes it at Mangal
    ({ poId, poItemId: line1 } = await makePo('GREIGE', rfGreigeId, 1000, 'METER', 67));
    line2 = await addLine(poId, rfGreige2Id, 800, 60);
    const dyeingOf = (materialId: string, orderId: string, parent: string) =>
      makeRequirement(materialId, 'METER', orderId, {
        requirementType: 'PROCESSING',
        linkedRequirementId: parent,
        processorId: dyerId,
        status: 'PO_REQUIRED',
      });
    req1 = await makeRequirement(rfGreigeId, 'METER', orderIds[0]);
    dyeing1 = await dyeingOf(rfGreigeId, orderIds[0], req1);
    req2 = await makeRequirement(rfGreige2Id, 'METER', orderIds[1]);
    dyeing2 = await dyeingOf(rfGreige2Id, orderIds[1], req2);
    link1 = await link(req1, poId, line1, 600, 1);
    link2 = await link(req2, poId, line2, 800, 1);
  });

  it('500 m of line 1 arrive as ready fabric: its order is credited them with no hold and no warning, its dyeing is cancelled — line 2 is untouched', async () => {
    grnId = await createReceipt(poId, line1, rfGreigeId, 'METER', storeId, {
      received: 500,
      receivedAsReadyFabric: true,
    });
    const approved = (await grnService.approveGRN(grnId, userId, storeId)) as { _warnings?: string[] };
    expect((approved._warnings ?? []).filter((w) => /could be held/.test(w))).toEqual([]);

    const lot = await prisma.fabric_stock.findFirstOrThrow({ where: { grnItem: { grnId } } });
    expect([lot.fabricId, Number(lot.quantityAvailable), Number(lot.quantityReserved)]).toEqual([rfFabricId, 500, 0]);
    expect(await creditsOf([link1, link2])).toEqual([500, 0]);
    expect(await statusesOf([req1, req2])).toEqual(['PARTIALLY_RECEIVED', 'PO_SENT']);
    expect(await heldOf([req1, req2])).toEqual([0, 0]);
    // No dyeing for the cloth that came ready; line 2's greige still comes as greige and is still to be dyed
    expect(await statusesOf([dyeing1, dyeing2])).toEqual(['CANCELLED', 'PO_REQUIRED']);
  });

  it('reversing it takes the credit back', async () => {
    await grnService.reverseGRN(grnId, userId, `${RUN} test`);
    expect(await grnStatus(grnId)).toBe('REVERSED');
    expect(await creditsOf([link1, link2])).toEqual([0, 0]);
    expect(await statusesOf([req1, req2])).toEqual(['PO_SENT', 'PO_SENT']);
  });
});

describe('greige at a processor unit linked to no processor fills nobody (C7)', () => {
  let poId: string;
  let poItemId: string;
  let reqM: string;
  let reqN: string;
  let linkM: string;
  let linkN: string;
  let grnAtUnit: string;

  beforeAll(async () => {
    ({ poId, poItemId } = await makePo('GREIGE', greigeId, 1000, 'METER', 67));
    // Order 1 is dyed at Mangal (its PROCESSING child); order 2 has no dyer yet
    reqM = await makeRequirement(greigeId, 'METER', orderIds[0]);
    await makeRequirement(greigeId, 'METER', orderIds[0], {
      requirementType: 'PROCESSING',
      linkedRequirementId: reqM,
      processorId: dyerId,
      status: 'PO_REQUIRED',
    });
    reqN = await makeRequirement(greigeId, 'METER', orderIds[1]);
    linkM = await link(reqM, poId, poItemId, 500, 1);
    linkN = await link(reqN, poId, poItemId, 200, 2);
  });

  afterAll(async () => {
    await prisma.warehouses.update({ where: { id: dyerUnitId }, data: { supplierId: dyerId } });
  });

  it('300 m delivered straight to Mangal fill the Mangal order and are held there', async () => {
    grnAtUnit = await receive(
      poId,
      poItemId,
      greigeId,
      'METER',
      dyerUnitId,
      { received: 300 },
      { directDeliveryConfirmed: true }
    );
    expect(await creditsOf([linkM, linkN])).toEqual([300, 0]);
    expect(Number((await greigeLot(grnAtUnit)).quantityReserved)).toBe(300);
  });

  it('once the unit is linked to no processor, its cloth is plain stock: approveGRN will not book there, and the next receipt refills from the store alone', async () => {
    await prisma.warehouses.update({ where: { id: dyerUnitId }, data: { supplierId: null } });

    // Nothing can be booked at a unit nobody runs
    const stray = await createReceipt(poId, poItemId, greigeId, 'METER', dyerUnitId, { received: 50 });
    await expect(grnService.approveGRN(stray, userId, dyerUnitId)).rejects.toMatchObject({
      details: expect.objectContaining({ reason: 'DIRECT_DELIVERY_UNIT_UNLINKED' }),
    });
    await grnService.rejectGRN(stray, userId, `${RUN} test`);

    const grnStore = await receive(poId, poItemId, greigeId, 'METER', storeId, { received: 100 });
    // The 300 m at the unlinked unit fill nobody; the store's 100 m go to the first order in line
    expect(await creditsOf([linkM, linkN])).toEqual([100, 0]);
    expect(await statusesOf([reqM, reqN])).toEqual(['PARTIALLY_RECEIVED', 'PO_SENT']);
    const line = (await computeLineCredits(prisma, poItemId))!;
    expect(line.plainStock).toEqual({ UNPLACED: 300, STORE: 0 });
    expect(Number((await greigeLot(grnAtUnit)).quantityReserved)).toBe(0);
    expect(Number((await greigeLot(grnStore)).quantityReserved)).toBe(100);
  });
});

describe('greige lace counted at a fold length is booked, credited and held in actual metres', () => {
  let poId: string;
  let poItemId: string;
  let req: string;
  let linkId: string;
  let grnId: string;

  beforeAll(async () => {
    ({ poId, poItemId } = await makePo('GREIGE_LACE', laceId, 950, 'METER', 40));
    req = await makeRequirement(laceId, 'METER', orderIds[0]);
    linkId = await link(req, poId, poItemId, 950, 1);
  });

  it('1,000 m counted @ L=95 → a 950 m lot, 950 m on hand, credited and held', async () => {
    grnId = await receive(poId, poItemId, laceId, 'METER', storeId, { received: 1000, foldLengthCm: 95 });
    const lot = await prisma.lace_stock.findFirstOrThrow({ where: { grnItem: { grnId } } });
    expect(Number(lot.quantityAvailable)).toBe(950);
    const level = await prisma.stock_levels.findFirst({ where: { materialId: laceId, warehouseId: storeId } });
    expect(Number(level?.quantity)).toBe(950);
    expect(await creditsOf([linkId])).toEqual([950]);
    expect(await statusesOf([req])).toEqual(['RECEIVED']);
    expect(Number(lot.quantityReserved)).toBe(950);
  });

  it("reversing it moves the order's own hold off first, so the lot goes back whole", async () => {
    await grnService.reverseGRN(grnId, userId, `${RUN} test`);
    expect(await creditsOf([linkId])).toEqual([0]);
    expect(await statusesOf([req])).toEqual(['PO_SENT']);
    expect(await heldOf([req])).toEqual([0]);
    const level = await prisma.stock_levels.findFirst({ where: { materialId: laceId, warehouseId: storeId } });
    expect(Number(level?.quantity ?? 0)).toBe(0);
  });
});
