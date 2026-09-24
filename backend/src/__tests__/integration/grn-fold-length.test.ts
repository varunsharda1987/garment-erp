/**
 * Greige received at a fold length ("L") — the whole path runs on ACTUAL metres.
 *
 * GRN2609-0250 (2026-09-23): 10,011 m counted @ L=98 against a PO for 9,810.78 m (= 10,011 × 0.98).
 * The lot booked 9,810.78, but the GRN valued the counted figure (₹590,649 instead of ₹578,836.02),
 * flagged a 200.22 m over-receipt, and put 10,011 on the PO's received counter. This walks the same
 * receipt through create → value → approve → than-wise issue, and a manual Stock-In that used to
 * apply L twice.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import greigeStockService from '../../services/greige-stock.service';
import stockMovementService from '../../services/stockMovement.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `FOLD${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

// Three thans tagged 3,000.50 + 3,500.25 + 3,510.25 = 10,011 m counted.
const THANS = [3000.5, 3500.25, 3510.25];
const COUNTED = 10011;
const L = 98;
const ACTUAL = 9810.78;
const RATE = 59;

let userId: string;
let supplierId: string;
let warehouseId: string;
let greigeId: string;
let materialId: string;
let poId: string;
let poItemId: string;
let grnId: string;
let grnItemId: string;
let po2Id: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  supplierId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-SUP`, name: `${RUN} Mill`, isActive: true, createdById: userId },
    })
  ).id;
  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GRG`,
        greigeName: `${RUN} Poplin 48"`,
        composition: '100% Cotton',
        greigeWidth: 48,
        createdById: userId,
      },
    })
  ).id;
  materialId = await ensureMaterialRecord(greigeId, 'GREIGE');

  poId = (
    await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber: `${RUN}-PO`,
        supplierId,
        poDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        status: 'SENT',
        poCategory: 'GREIGE',
        createdById: userId,
      },
    })
  ).id;
  poItemId = (
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId,
        materialId,
        orderedQuantity: ACTUAL,
        receivedQuantity: 0,
        unitPrice: RATE,
        totalPrice: 578836.02,
        unit: 'METER',
        foldLengthCm: new Prisma.Decimal(L),
      },
    })
  ).id;
});

afterAll(async () => {
  const lots = await prisma.greige_stock.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } });
  const lotIds = lots.map((l) => l.id);
  if (lotIds.length) {
    const details = await prisma.greige_stock_details.findMany({
      where: { greigeStockId: { in: lotIds } },
      select: { id: true },
    });
    await prisma.greige_issue_details.deleteMany({ where: { greigeStockDetailId: { in: details.map((d) => d.id) } } });
    await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: lotIds } } });
    await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  }
  await prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.fabric_procurement.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.stock_movements.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_transactions.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_levels.deleteMany({ where: { materialId: only(materialId) } });
  for (const id of [poId, po2Id]) {
    await prisma.goods_receiving_notes.deleteMany({ where: { poId: only(id) } }); // cascades items + details
    await prisma.purchase_order_items.deleteMany({ where: { poId: only(id) } });
    await prisma.purchase_orders.deleteMany({ where: { id: only(id) } });
  }
  await prisma.materials.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('greige received at L=98', () => {
  it('creates the receipt on actual metres: no over-receipt, PO counter 9,810.78', async () => {
    const grn = await grnService.createGRN(
      {
        poId,
        warehouseId,
        items: [
          {
            poItemId,
            materialId,
            receivedQuantity: COUNTED,
            acceptedQuantity: COUNTED,
            rejectedQuantity: 0,
            unit: 'METER',
            foldLengthCm: L,
            entryMode: 'THAN_WISE',
            details: THANS.map((meters, i) => ({ detailType: 'THAN' as const, sequenceNo: i + 1, meters })),
          },
        ],
      },
      userId
    );
    grnId = grn.id;
    const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId } });
    grnItemId = item.id;

    expect(Number(item.receivedQuantity)).toBe(COUNTED); // the supplier's paper, unchanged
    expect(Number(item.actualQuantity)).toBeCloseTo(ACTUAL, 2);
    expect(item.isOverReceipt).toBe(false);
    expect(item.overReceiptQty).toBeNull();

    const poItem = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: poItemId } });
    expect(Number(poItem.receivedQuantity)).toBeCloseTo(ACTUAL, 2);
  });

  it('values the line at actual × rate: ₹578,836.02, on the list and the detail', async () => {
    const detail = await grnService.getGRNById(grnId);
    expect(detail.grn_items[0].value).toBeCloseTo(578836.02, 2);
    expect(detail.grn_items[0].actualQuantity).toBeCloseTo(ACTUAL, 2);

    const list = await grnService.getAllGRNs({ search: `${RUN}-PO` } as never);
    const row = list.data.find((g) => g.id === grnId);
    expect(row?.totalValue).toBeCloseTo(578836.02, 2);
  });

  it('approves into one lot of 9,810.78 m, and the movement agrees with it', async () => {
    await grnService.approveGRN(grnId, userId, warehouseId);

    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { grnItemId } });
    expect(Number(lot.quantityAvailable)).toBeCloseTo(ACTUAL, 2);
    expect(Number(lot.nominalQuantity)).toBeCloseTo(COUNTED, 2);

    const movement = await prisma.stock_movements.findFirstOrThrow({
      where: { referenceId: grnId, movementType: 'STOCK_IN' },
    });
    expect(Number(movement.quantity)).toBeCloseTo(ACTUAL, 2);
    expect(Number(movement.value)).toBeCloseTo(578836.02, 2);

    const poItem = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: poItemId } });
    expect(Number(poItem.receivedQuantity)).toBeCloseTo(ACTUAL, 2);
    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('RECEIVED');
  });

  it('issues every than: the counted tags take the whole 9,810.78 m lot, not 2% more', async () => {
    const lot = await prisma.greige_stock.findFirstOrThrow({
      where: { grnItemId },
      include: { stockDetails: true },
    });
    expect(lot.stockDetails.map((d) => Number(d.meters)).sort()).toEqual([...THANS].sort());

    const result = await greigeStockService.consumeWithDetails(
      lot.id,
      lot.stockDetails.map((d) => ({ greigeStockDetailId: d.id, metersToIssue: Number(d.metersRemaining) })),
      userId
    );
    expect(result.countedConsumed).toBeCloseTo(COUNTED, 2);
    expect(result.totalConsumed).toBeCloseTo(ACTUAL, 2);

    const after = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(after.quantityAvailable)).toBeCloseTo(0, 2);
  });
});

describe('a receipt a few centimetres short of the PO (under-receipt tolerance)', () => {
  it('PO2609-0007: 10,418.2 counted @ L=97 = 10,105.65 m against 10,105.7 ordered closes as RECEIVED', async () => {
    po2Id = (
      await prisma.purchase_orders.create({
        data: {
          id: randomUUID(),
          poNumber: `${RUN}-PO2`,
          supplierId,
          poDate: new Date(),
          expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
          status: 'SENT',
          poCategory: 'GREIGE',
          createdById: userId,
        },
      })
    ).id;
    const item = await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId: po2Id,
        materialId,
        orderedQuantity: 10105.7,
        receivedQuantity: 0,
        unitPrice: 58,
        totalPrice: 586130.6,
        unit: 'METER',
        foldLengthCm: new Prisma.Decimal(97),
      },
    });

    await grnService.createGRN(
      {
        poId: po2Id,
        warehouseId,
        items: [
          {
            poItemId: item.id,
            materialId,
            receivedQuantity: 10418.2,
            acceptedQuantity: 10418.2,
            rejectedQuantity: 0,
            unit: 'METER',
            foldLengthCm: 97,
          },
        ],
      },
      userId
    );

    const line = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: item.id } });
    expect(Number(line.receivedQuantity)).toBeCloseTo(10105.65, 2);
    const po = await prisma.purchase_orders.findUniqueOrThrow({ where: { id: po2Id } });
    expect(po.status).toBe('RECEIVED');
  });
});

describe('manual greige Stock-In at L=98', () => {
  it('converts once: 1,000 counted → a 980 m lot, not 960.40', async () => {
    await stockMovementService.createStockIn({
      movementType: 'STOCK_IN',
      materialId,
      warehouseId,
      quantity: new Prisma.Decimal(1000),
      unit: 'METER',
      rate: new Prisma.Decimal(RATE),
      foldLengthCm: new Prisma.Decimal(L),
      referenceType: 'MANUAL',
      performedById: userId,
    });

    const lot = await prisma.greige_stock.findFirstOrThrow({
      where: { greigeId, sourceType: 'MANUAL' },
      orderBy: { createdAt: 'desc' },
    });
    expect(Number(lot.quantityAvailable)).toBeCloseTo(980, 2);
    expect(Number(lot.nominalQuantity)).toBeCloseTo(1000, 2);

    const movement = await prisma.stock_movements.findFirstOrThrow({
      where: { materialId, movementType: 'STOCK_IN', referenceType: 'MANUAL' },
    });
    expect(Number(movement.quantity)).toBeCloseTo(980, 2);
  });
});
