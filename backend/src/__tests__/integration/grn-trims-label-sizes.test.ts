/**
 * Trim receipts reach their stock tables — labels per size, buttons by the gross (2026-09-26).
 *
 * Before: a GRN against a TRIMS PO (how MRP and the PO form file buttons and labels) booked stock_levels only —
 * no lot, so no stock screen and no MRP netting ever saw it; label_stock had no size, so every label lot showed on
 * the base row AND every size row; stock-out took stock_levels down twice; buttons bought by the gross had no
 * conversion ("10 GROSS" booked 10 pieces).
 *
 * Now: one path books stock_levels once and each trim line's lot by its material (a size row → that size); the
 * PO line and GRN line stay in gross, stock and requirement links in pieces; a reversal takes back exactly what
 * approval booked and is refused once any of it has been issued.
 *
 * Runs against the real app services + live DB; tagged fixtures, per-step teardown.
 */

import { randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma, createTestUser } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import stockMovementService from '../../services/stockMovement.service';
import { purchaseOrderService } from '../../services/purchaseOrder.service';
import { ensureLabelSizeMaterialRecord, ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `GTL${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let supplierId: string;
let wh1: string;
let wh2: string;
let labelId: string;
let buttonId: string;
const sizeRow: Record<string, string> = {}; // size → materials.id (= size variant id)
let labelBaseRow: string;
const poIds: string[] = [];

async function view(materialId: string, warehouseId = wh1): Promise<number> {
  const r = await prisma.$queryRawUnsafe<Array<{ q: string | null }>>(
    'select sum(quantity)::text q from derived_stock_view where "materialId" = $1 and "warehouseId" = $2',
    materialId,
    warehouseId
  );
  return Number(r[0]?.q ?? 0);
}
async function level(materialId: string, warehouseId = wh1): Promise<number> {
  const l = await prisma.stock_levels.findFirst({ where: { materialId, warehouseId } });
  return Number(l?.quantity ?? 0);
}

/** A TRIMS PO through the real service (it decides the unit + factor), received and approved. */
async function receive(lines: Array<{ materialId: string; qty: number; unit: 'PIECE' | 'GROSS'; rate: number }>) {
  const po = await purchaseOrderService.createPurchaseOrder(
    {
      supplierId,
      poCategory: 'TRIMS',
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
      items: lines.map((l) => ({ materialId: l.materialId, orderedQuantity: l.qty, unit: l.unit, unitPrice: l.rate })),
    } as never,
    userId
  );
  poIds.push(po.id);
  await prisma.purchase_orders.update({ where: { id: po.id }, data: { status: 'SENT' } });
  const poItems = await prisma.purchase_order_items.findMany({ where: { poId: po.id } });
  const grn = await grnService.createGRN(
    {
      poId: po.id,
      warehouseId: wh1,
      items: poItems.map((pi) => ({
        poItemId: pi.id,
        materialId: pi.materialId!,
        receivedQuantity: Number(pi.orderedQuantity),
        acceptedQuantity: Number(pi.orderedQuantity),
        rejectedQuantity: 0,
        unit: pi.unit,
      })),
    } as never,
    userId
  );
  await grnService.approveGRN(grn.id, userId, wh1);
  return { poId: po.id, grnId: grn.id, poItems };
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
      data: { code: `${RUN}-SUP`, name: `${RUN} Trims`, isActive: true, createdById: userId },
    })
  ).id;
  const mkWh = async (n: number) =>
    (
      await prisma.warehouses.create({
        data: {
          warehouseCode: `${RUN}-WH${n}`,
          warehouseName: `${RUN} Store ${n}`,
          warehouseType: 'RAW_MATERIAL',
          isActive: true,
          createdById: userId,
        },
      })
    ).id;
  wh1 = await mkWh(1);
  wh2 = await mkWh(2);

  labelId = (
    await prisma.label_master.create({
      data: { labelCode: `${RUN}-LBL`, labelName: `${RUN} Main Label`, pricePerPiece: 0.6 },
    })
  ).id;
  // Size rows BEFORE the base row: an unfiltered labelId lookup would then pick a size row
  for (const size of ['S', 'M', 'L']) {
    const v = await prisma.label_size_variants.create({ data: { labelId, size } });
    sizeRow[size] = await ensureLabelSizeMaterialRecord(v.id);
  }
  labelBaseRow = await ensureMaterialRecord(labelId, 'LABEL');

  buttonId = (
    await prisma.button_master.create({
      data: { buttonCode: `${RUN}-BTN`, buttonName: `${RUN} Shirt Button`, pricePerPiece: 0.125, pricePerGross: 18 },
    })
  ).id;
  await ensureMaterialRecord(buttonId, 'BUTTON');
});

afterAll(async () => {
  const materialIds = [...Object.values(sizeRow), labelBaseRow, buttonId].filter(Boolean) as string[];
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['label_stock', () => prisma.label_stock.deleteMany({ where: { labelId: only(labelId) } })],
    ['button_stock', () => prisma.button_stock.deleteMany({ where: { buttonId: only(buttonId) } })],
    ['stock_movements', () => prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_transactions', () => prisma.stock_transactions.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_settings', () => prisma.stock_settings.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['grn_items', () => prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } })],
    ['po_items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    ['material_suppliers', () => prisma.material_suppliers.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['label_size_variants', () => prisma.label_size_variants.deleteMany({ where: { labelId: only(labelId) } })],
    ['label_master', () => prisma.label_master.deleteMany({ where: { id: only(labelId) } })],
    ['button_master', () => prisma.button_master.deleteMany({ where: { id: only(buttonId) } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: { in: [wh1, wh2].filter(Boolean) } } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[grn-trims-label-sizes teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('trim receipts reach their stock tables', () => {
  let firstGrnId: string;

  it("ensureMaterialRecord(label) returns the label's base row, not a size row", async () => {
    expect(await ensureMaterialRecord(labelId, 'LABEL')).toBe(labelBaseRow);
    expect(Object.values(sizeRow)).not.toContain(labelBaseRow);
  });

  it('a TRIMS receipt books each label size and a gross of buttons in pieces — lot, stock_levels, view agree', async () => {
    const r = await receive([
      { materialId: sizeRow.S, qty: 100, unit: 'PIECE', rate: 0.6 },
      { materialId: sizeRow.M, qty: 200, unit: 'PIECE', rate: 0.6 },
      { materialId: sizeRow.L, qty: 300, unit: 'PIECE', rate: 0.6 },
      { materialId: buttonId, qty: 2, unit: 'GROSS', rate: 18 },
    ]);
    firstGrnId = r.grnId;

    // Label: three lots, each with its size; none unsized; the view puts each on its size row only
    const lots = await prisma.label_stock.findMany({ where: { labelId } });
    expect(lots).toHaveLength(3);
    expect(lots.every((l) => l.sizeVariantId)).toBe(true);
    expect(await view(sizeRow.S)).toBe(100);
    expect(await view(sizeRow.M)).toBe(200);
    expect(await view(sizeRow.L)).toBe(300);
    expect(await view(labelBaseRow)).toBe(0);
    for (const size of ['S', 'M', 'L']) expect(await level(sizeRow[size])).toBe(await view(sizeRow[size]));

    // Buttons: the PO line is 2 GROSS (factor 144 set by the server); stock is 288 pieces at ₹0.125
    const buttonLine = r.poItems.find((p) => p.materialId === buttonId)!;
    expect(buttonLine.unit).toBe('GROSS');
    expect(Number(buttonLine.stockUnitsPerUnit)).toBe(144);
    expect(Number(buttonLine.totalPrice)).toBe(36); // value stays PO qty × PO rate
    expect(Number((await prisma.button_stock.findFirstOrThrow({ where: { buttonId } })).quantityAvailable)).toBe(288);
    expect(await level(buttonId)).toBe(288);
    expect(await view(buttonId)).toBe(288);
    const mv = await prisma.stock_movements.findFirstOrThrow({
      where: { materialId: buttonId, referenceId: firstGrnId, movementType: 'STOCK_IN' },
    });
    expect(Number(mv.quantity)).toBe(288);
    expect(mv.unit).toBe('PIECE');
    expect(Number(mv.rate)).toBe(0.125);
    const grnLine = await prisma.grn_items.findFirstOrThrow({ where: { grnId: firstGrnId, materialId: buttonId } });
    expect(Number(grnLine.stockQuantity)).toBe(288);
    expect(
      Number((await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: buttonLine.id } })).receivedQuantity)
    ).toBe(2);
  });

  it('a button line in PIECE is refused — buttons are bought by the gross', async () => {
    await expect(
      purchaseOrderService.createPurchaseOrder(
        {
          supplierId,
          poCategory: 'TRIMS',
          expectedDeliveryDate: new Date(),
          items: [{ materialId: buttonId, orderedQuantity: 100, unit: 'PIECE', unitPrice: 0.125 }],
        } as never,
        userId
      )
    ).rejects.toThrow(/bought by the gross/);
  });

  it('stock-out of size M takes 50 off lot, stock_levels and view ONCE; S and L untouched', async () => {
    await stockMovementService.createStockOut({
      movementType: 'STOCK_OUT',
      materialId: sizeRow.M,
      warehouseId: wh1,
      quantity: new Decimal(50),
      unit: 'PIECE',
      performedById: userId,
    } as never);
    expect(await view(sizeRow.M)).toBe(150);
    expect(await level(sizeRow.M)).toBe(150);
    expect(await view(sizeRow.S)).toBe(100);
    expect(await view(sizeRow.L)).toBe(300);
  });

  it('adjustment-out of 20 buttons: 268 in both layers', async () => {
    await stockMovementService.createStockAdjustment({
      materialId: buttonId,
      warehouseId: wh1,
      adjustmentQuantity: new Decimal(-20),
      unit: 'PIECE',
      reason: 'DAMAGED',
      performedById: userId,
    } as never);
    expect(await level(buttonId)).toBe(268);
    expect(await view(buttonId)).toBe(268);
  });

  it('transfer of 20 size-L labels: source 280 in both layers, the destination lot keeps size L', async () => {
    await stockMovementService.createStockTransfer({
      materialId: sizeRow.L,
      fromWarehouseId: wh1,
      toWarehouseId: wh2,
      quantity: new Decimal(20),
      unit: 'PIECE',
      performedById: userId,
    } as never);
    expect(await level(sizeRow.L)).toBe(280);
    expect(await view(sizeRow.L)).toBe(280);
    expect(await view(sizeRow.L, wh2)).toBe(20);
    const dest = await prisma.label_stock.findFirstOrThrow({ where: { labelId, warehouseId: wh2 } });
    expect(dest.sizeVariantId).toBe(sizeRow.L);
  });

  it('Stock In: a size lot carries its size, and 1 GROSS of buttons books 144 pieces', async () => {
    await stockMovementService.createStockIn({
      movementType: 'STOCK_IN',
      materialId: sizeRow.S,
      warehouseId: wh1,
      quantity: new Decimal(10),
      unit: 'PIECE',
      performedById: userId,
    } as never);
    expect(await view(sizeRow.S)).toBe(110);
    await stockMovementService.createStockIn({
      movementType: 'STOCK_IN',
      materialId: buttonId,
      warehouseId: wh1,
      quantity: new Decimal(1),
      unit: 'GROSS',
      rate: new Decimal(18),
      performedById: userId,
    } as never);
    expect(await level(buttonId)).toBe(268 + 144);
    expect(await view(buttonId)).toBe(268 + 144);
  });

  it('a second receipt, reversed, returns every figure to where it was', async () => {
    const before = {
      m: await view(sizeRow.M),
      ml: await level(sizeRow.M),
      b: await view(buttonId),
      bl: await level(buttonId),
    };
    const r = await receive([
      { materialId: sizeRow.M, qty: 40, unit: 'PIECE', rate: 0.6 },
      { materialId: buttonId, qty: 1, unit: 'GROSS', rate: 18 },
    ]);
    expect(await view(sizeRow.M)).toBe(before.m + 40);
    expect(await view(buttonId)).toBe(before.b + 144);
    await grnService.reverseGRN(r.grnId, userId, 'test');
    expect(await view(sizeRow.M)).toBe(before.m);
    expect(await level(sizeRow.M)).toBe(before.ml);
    expect(await view(buttonId)).toBe(before.b);
    expect(await level(buttonId)).toBe(before.bl);
  });

  it('reversing the first receipt after its size-M labels were issued is refused, and nothing changes', async () => {
    const before = { m: await view(sizeRow.M), b: await view(buttonId) };
    await expect(grnService.reverseGRN(firstGrnId, userId, 'test')).rejects.toThrow(/already been used/);
    expect(await view(sizeRow.M)).toBe(before.m);
    expect(await view(buttonId)).toBe(before.b);
    expect((await prisma.goods_receiving_notes.findUniqueOrThrow({ where: { id: firstGrnId } })).status).not.toBe(
      'REVERSED'
    );
  });
});
