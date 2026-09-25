/**
 * Reversing a purchase greige GRN.
 *
 * `reverseSpecializedStockInTx` deleted the greige lot and then wrote an ADJUSTMENT_OUT row that
 * points at the lot it had just deleted — and approval had already written a STOCK_IN row against
 * it, so the delete itself hit the lot ← transaction foreign key. A partly used lot was worse:
 * only what was left got reversed, silently, as if the used metres had never been received.
 *
 * Rule (direct-to-processor plan, Phase 1): a reversed lot is zeroed and marked EXHAUSTED, never
 * deleted — its ledger and any challan lines keep pointing at a real row — and a lot some of which
 * has already been used cannot be reversed at all.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import greigeStockService from '../../services/greige-stock.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `GRREV${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let supplierId: string;
let warehouseId: string;
let greigeId: string;
let materialId: string;
const poIds: string[] = [];

async function receiveAndApprove(qty: number): Promise<{ grnId: string; grnItemId: string }> {
  const poId = (
    await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber: `${RUN}-PO${poIds.length + 1}`,
        supplierId,
        poDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        status: 'SENT',
        poCategory: 'GREIGE',
        createdById: userId,
      },
    })
  ).id;
  poIds.push(poId);
  const poItemId = (
    await prisma.purchase_order_items.create({
      data: {
        id: randomUUID(),
        poId,
        materialId,
        orderedQuantity: qty,
        receivedQuantity: 0,
        unitPrice: 50,
        totalPrice: qty * 50,
        unit: 'METER',
      },
    })
  ).id;
  const grn = await grnService.createGRN(
    {
      poId,
      warehouseId,
      items: [
        { poItemId, materialId, receivedQuantity: qty, acceptedQuantity: qty, rejectedQuantity: 0, unit: 'METER' },
      ],
    },
    userId
  );
  await grnService.approveGRN(grn.id, userId, warehouseId);
  const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: grn.id } });
  return { grnId: grn.id, grnItemId: item.id };
}

async function onHand(): Promise<number> {
  const level = await prisma.stock_levels.findFirst({ where: { materialId, warehouseId } });
  return Number(level?.quantity ?? 0);
}

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
        greigeName: `${RUN} Cambric 44"`,
        composition: '100% Cotton',
        greigeWidth: 44,
        createdById: userId,
      },
    })
  ).id;
  materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
});

afterAll(async () => {
  const lotIds = (
    await prisma.greige_stock.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((l) => l.id);
  if (lotIds.length) {
    await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: { in: lotIds } } });
    await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  }
  await prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.fabric_procurement.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.stock_movements.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_transactions.deleteMany({ where: { materialId: only(materialId) } });
  await prisma.stock_levels.deleteMany({ where: { materialId: only(materialId) } });
  for (const id of poIds) {
    await prisma.goods_receiving_notes.deleteMany({ where: { poId: only(id) } });
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

describe('reversing a purchase greige GRN', () => {
  it('zeroes the untouched lot (EXHAUSTED, never deleted), writes the ledger row, and takes it off stock', async () => {
    const before = await onHand();
    const { grnId, grnItemId } = await receiveAndApprove(1200);
    expect(await onHand()).toBeCloseTo(before + 1200, 2);

    await grnService.reverseGRN(grnId, userId, `${RUN} wrong supplier`);

    const lot = await prisma.greige_stock.findFirst({ where: { grnItemId } });
    expect(lot).not.toBeNull(); // kept: its ledger rows point at it
    expect(Number(lot!.quantityAvailable)).toBe(0);
    expect(lot!.status).toBe('EXHAUSTED');

    const reversal = await prisma.greige_stock_transaction.findFirst({
      where: { stockId: lot!.id, transactionType: 'ADJUSTMENT_OUT', referenceId: grnId },
    });
    expect(Number(reversal?.quantity)).toBeCloseTo(-1200, 2);
    expect(await onHand()).toBeCloseTo(before, 2);

    const grn = await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: grnId } });
    expect(grn.status).toBe('REVERSED');
  });

  it('refuses when some of the lot has already been used, and changes nothing', async () => {
    const { grnId, grnItemId } = await receiveAndApprove(800);
    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { grnItemId } });
    await greigeStockService.consumeGreigeStock(lot.id, 300, userId);
    const before = await onHand();

    await expect(grnService.reverseGRN(grnId, userId, `${RUN} partly used`)).rejects.toThrow(/already been used|300/);

    const after = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(after.quantityAvailable)).toBeCloseTo(500, 2);
    expect(await onHand()).toBeCloseTo(before, 2);
    const grn = await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: grnId } });
    expect(grn.status).not.toBe('REVERSED');
  });
});
