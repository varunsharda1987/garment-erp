/**
 * Thread is ordered in boxes of cones / tubes and stocked per pack (owner, 2026-09-26).
 *
 * A thread is ordered as cones (2- or 3-ply, chosen per line) or tubes (always 3-ply); the PO line is in BOXES
 * whose size comes from ONE table (thread_packaging_specs). Stock is kept per PACK — a materials row per
 * (thread, packing, ply), counted in cones / tubes — so cones and tubes are never added together.
 *
 * Walks the real services on tagged fixtures: the PO writer's refusals and its box size, a receipt booking each
 * pack on its own row (lot, stock_levels and derived_stock_view agreeing), a second receipt on the same PO line
 * (the old lot key refused it), stock-out drawing only its pack, reversal, the used-lot refusal, a PO edit that
 * re-sends a line without its pack, and MRP refusing thread requirements.
 */

import { randomUUID } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma, createTestUser } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import stockMovementService from '../../services/stockMovement.service';
import { purchaseOrderService } from '../../services/purchaseOrder.service';
import { previewPOsFromRequirements } from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { toPurchaseQty } from '../../services/helpers/purchase-unit.helper';

const RUN = `TSP${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let supplierId: string;
let wh1: string;
let threadId: string;
let baseRow: string;
const poIds: string[] = [];
let requirementId: string | undefined;

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
async function packRow(packing: 'CONE' | 'TUBE', ply: 'TWO_PLY' | 'THREE_PLY') {
  return prisma.materials.findFirstOrThrow({ where: { threadId, threadPackagingType: packing, threadPly: ply } });
}

type Line = {
  qty: number;
  rate: number;
  unit?: string;
  threadPackagingType?: 'CONE' | 'TUBE' | null;
  threadPly?: 'TWO_PLY' | 'THREE_PLY' | null;
};

async function createPO(lines: Line[]) {
  const po = await purchaseOrderService.createPurchaseOrder(
    {
      supplierId,
      poCategory: 'THREAD',
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
      items: lines.map((l) => ({
        materialId: baseRow,
        orderedQuantity: l.qty,
        unit: l.unit ?? 'BOX',
        unitPrice: l.rate,
        threadPackagingType: l.threadPackagingType,
        threadPly: l.threadPly,
      })),
    } as never,
    userId
  );
  poIds.push(po.id);
  return po;
}

/** Receive `boxes` of each PO line (by index) on one GRN and approve it. */
async function receive(poId: string, boxes: Record<string, number>) {
  await prisma.purchase_orders.update({ where: { id: poId }, data: { status: 'SENT' } });
  const grn = await grnService.createGRN(
    {
      poId,
      warehouseId: wh1,
      items: Object.entries(boxes).map(([poItemId, qty]) => ({
        poItemId,
        materialId: baseRow,
        receivedQuantity: qty,
        acceptedQuantity: qty,
        rejectedQuantity: 0,
        unit: 'BOX',
      })),
    } as never,
    userId
  );
  await grnService.approveGRN(grn.id, userId, wh1);
  return grn.id;
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
      data: { code: `${RUN}-SUP`, name: `${RUN} Threads`, isActive: true, createdById: userId },
    })
  ).id;
  wh1 = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH1`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  threadId = (
    await prisma.thread_master.create({
      data: { threadCode: `${RUN}-THR`, threadName: `${RUN} Navy Thread`, packagingType: 'CONE', ply: 'THREE_PLY' },
    })
  ).id;
  baseRow = await ensureMaterialRecord(threadId, 'THREAD');
});

afterAll(async () => {
  const materialIds = (
    await prisma.materials.findMany({ where: { threadId: only(threadId) }, select: { id: true } })
  ).map((m) => m.id);
  const lotIds = (
    await prisma.thread_stock.findMany({ where: { threadId: only(threadId) }, select: { id: true } })
  ).map((l) => l.id);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['thread txns', () => prisma.thread_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } })],
    ['thread_stock', () => prisma.thread_stock.deleteMany({ where: { id: { in: lotIds } } })],
    ['stock_movements', () => prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_transactions', () => prisma.stock_transactions.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_settings', () => prisma.stock_settings.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['grn_items', () => prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } })],
    ['grns', () => prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } })],
    ['po_items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['pos', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { id: only(requirementId) } })],
    ['material_suppliers', () => prisma.material_suppliers.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['thread_master', () => prisma.thread_master.deleteMany({ where: { id: only(threadId) } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(wh1) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[thread-stock-per-pack teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('thread is ordered in boxes and stocked per pack', () => {
  let conePoItemId: string;
  let tubePoItemId: string;
  let poId: string;
  let firstGrnId: string;

  it('23 cones order as 3 boxes (rounded up to whole boxes)', () => {
    expect(toPurchaseQty(23, 10)).toBe(3);
    expect(toPurchaseQty(30, 10)).toBe(3);
    expect(toPurchaseQty(16, 15)).toBe(2);
  });

  it('the PO writer refuses a thread line that is not boxes of a cone / tube pack', async () => {
    await expect(
      createPO([{ qty: 30, rate: 25, unit: 'CONE', threadPackagingType: 'CONE', threadPly: 'THREE_PLY' }])
    ).rejects.toThrow(/bought in boxes/);
    await expect(createPO([{ qty: 2, rate: 300, threadPackagingType: 'TUBE', threadPly: 'TWO_PLY' }])).rejects.toThrow(
      /3-ply only/
    );
    await expect(createPO([{ qty: 2, rate: 250 }])).rejects.toThrow(/Cone or Tube/);
    await expect(createPO([{ qty: 2, rate: 250, threadPackagingType: 'CONE' }])).rejects.toThrow(/2-ply or 3-ply/);
  });

  it('cone and tube lines are saved as BOXES with the box size from the table (a tube is 3-ply)', async () => {
    const po = await createPO([
      { qty: 3, rate: 250, threadPackagingType: 'CONE', threadPly: 'THREE_PLY' }, // ₹25 a cone × 10
      { qty: 2, rate: 300, threadPackagingType: 'TUBE' }, // tubes priced per box; ply follows
    ]);
    poId = po.id;
    const lines = await prisma.purchase_order_items.findMany({ where: { poId } });
    const cone = lines.find((l) => l.threadPackagingType === 'CONE')!;
    const tube = lines.find((l) => l.threadPackagingType === 'TUBE')!;
    conePoItemId = cone.id;
    tubePoItemId = tube.id;
    expect(cone.unit).toBe('BOX');
    expect(Number(cone.stockUnitsPerUnit)).toBe(10);
    expect(cone.threadPly).toBe('THREE_PLY');
    expect(tube.unit).toBe('BOX');
    expect(Number(tube.stockUnitsPerUnit)).toBe(15);
    expect(tube.threadPly).toBe('THREE_PLY');
    expect(Number(cone.totalPrice)).toBe(750);
  });

  it('a receipt books each pack on its OWN row, in cones / tubes — lot, stock_levels and view agree', async () => {
    firstGrnId = await receive(poId, { [conePoItemId]: 2, [tubePoItemId]: 2 });
    const cone = await packRow('CONE', 'THREE_PLY');
    const tube = await packRow('TUBE', 'THREE_PLY');
    expect(cone.unit).toBe('CONE');
    expect(tube.unit).toBe('TUBE');
    expect(cone.code).toBe(`${RUN}-THR-CONE-3PLY`);

    const lots = await prisma.thread_stock.findMany({ where: { threadId }, orderBy: { packagingType: 'asc' } });
    expect(lots).toHaveLength(2);
    expect(lots.every((l) => l.grnItemId)).toBe(true);
    const coneLot = lots.find((l) => l.packagingType === 'CONE')!;
    expect(Number(coneLot.quantityAvailable)).toBe(20);
    expect(coneLot.ply).toBe('THREE_PLY');
    expect(Number(coneLot.purchaseCost)).toBe(25); // per cone
    expect(Number(coneLot.metersAvailable)).toBe(100000); // 20 × 5,000 m

    expect(await level(cone.id)).toBe(20);
    expect(await view(cone.id)).toBe(20);
    expect(await level(tube.id)).toBe(30);
    expect(await view(tube.id)).toBe(30);
    // Never added together on the base thread row
    expect(await level(baseRow)).toBe(0);
    expect(await view(baseRow)).toBe(0);

    const moves = await prisma.stock_movements.findMany({
      where: { referenceId: firstGrnId, movementType: 'STOCK_IN' },
    });
    expect(moves.map((m) => [m.materialId, m.unit, Number(m.quantity)]).sort()).toEqual(
      [
        [cone.id, 'CONE', 20],
        [tube.id, 'TUBE', 30],
      ].sort()
    );
    // The PO counter stays in boxes
    expect(
      Number((await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: conePoItemId } })).receivedQuantity)
    ).toBe(2);
  });

  it('stock-out of 5 cones draws the cone lot only — the tubes are untouched', async () => {
    const cone = await packRow('CONE', 'THREE_PLY');
    const tube = await packRow('TUBE', 'THREE_PLY');
    await stockMovementService.createStockOut({
      movementType: 'STOCK_OUT',
      materialId: cone.id,
      warehouseId: wh1,
      quantity: new Decimal(5),
      unit: 'CONE',
      performedById: userId,
    } as never);
    expect(await view(cone.id)).toBe(15);
    expect(await level(cone.id)).toBe(15);
    expect(await view(tube.id)).toBe(30);
  });

  it('a second receipt on the same PO line is its own lot; reversing it takes back exactly that', async () => {
    const cone = await packRow('CONE', 'THREE_PLY');
    const secondGrnId = await receive(poId, { [conePoItemId]: 1 });
    expect(await prisma.thread_stock.count({ where: { threadId, packagingType: 'CONE' } })).toBe(2);
    expect(await view(cone.id)).toBe(25);
    expect(await level(cone.id)).toBe(25);

    await grnService.reverseGRN(secondGrnId, userId, 'test');
    expect(await view(cone.id)).toBe(15);
    expect(await level(cone.id)).toBe(15);
  });

  it('a receipt whose lot has been used cannot be reversed', async () => {
    await expect(grnService.reverseGRN(firstGrnId, userId, 'test')).rejects.toThrow(/already been used/);
  });

  it('a stock-out spanning two cone lots draws both, with an audit row on each (it stopped after the first)', async () => {
    const cone = await packRow('CONE', 'THREE_PLY');
    await receive(poId, { [conePoItemId]: 1 }); // a third cone lot of 10 → 25 on hand
    expect(await view(cone.id)).toBe(25);
    await stockMovementService.createStockOut({
      movementType: 'STOCK_OUT',
      materialId: cone.id,
      warehouseId: wh1,
      quantity: new Decimal(20),
      unit: 'CONE',
      performedById: userId,
    } as never);
    expect(await view(cone.id)).toBe(5);
    expect(await level(cone.id)).toBe(5);
    const outs = await prisma.thread_stock_transaction.findMany({
      where: { transactionType: 'CONSUMPTION', stock: { threadId } },
    });
    // 5 from the first stock-out, then 15 + 5 across two lots
    expect(outs.map((t) => Number(t.quantity)).sort((x, y) => x - y)).toEqual([-15, -5, -5]);
  });

  it('a stock-out its lots cannot cover is refused and rolls back — neither layer moves', async () => {
    const cone = await packRow('CONE', 'THREE_PLY');
    // Make the layers disagree the way a lost lot write used to: the lot holds 2, stock_levels still 5
    const lot = await prisma.thread_stock.findFirstOrThrow({
      where: { threadId, packagingType: 'CONE', quantityAvailable: { gt: 0 } },
    });
    await prisma.thread_stock.update({ where: { id: lot.id }, data: { quantityAvailable: 2 } });
    await expect(
      stockMovementService.createStockOut({
        movementType: 'STOCK_OUT',
        materialId: cone.id,
        warehouseId: wh1,
        quantity: new Decimal(4),
        unit: 'CONE',
        performedById: userId,
      } as never)
    ).rejects.toThrow(/its stock level and its lots disagree/);
    expect(await level(cone.id)).toBe(5);
    expect(Number((await prisma.thread_stock.findUniqueOrThrow({ where: { id: lot.id } })).quantityAvailable)).toBe(2);
    await prisma.thread_stock.update({ where: { id: lot.id }, data: { quantityAvailable: 5 } });
  });

  it('a PO edit that re-sends a thread line without its pack keeps the pack it was ordered in', async () => {
    const draft = await createPO([{ qty: 1, rate: 250, threadPackagingType: 'CONE', threadPly: 'TWO_PLY' }]);
    const [line] = await prisma.purchase_order_items.findMany({ where: { poId: draft.id } });
    await purchaseOrderService.updatePurchaseOrder(draft.id, {
      items: [{ id: line.id, materialId: baseRow, orderedQuantity: 4, unit: 'BOX', unitPrice: 250 }],
    } as never);
    const after = await prisma.purchase_order_items.findUniqueOrThrow({ where: { id: line.id } });
    expect(Number(after.orderedQuantity)).toBe(4);
    expect(after.threadPackagingType).toBe('CONE');
    expect(after.threadPly).toBe('TWO_PLY');
    expect(Number(after.stockUnitsPerUnit)).toBe(10);
  });

  it('MRP does not turn a thread requirement (a garment count) into a PO', async () => {
    requirementId = (
      await prisma.material_requirements.create({
        data: {
          id: randomUUID(),
          requirementNumber: `${RUN}-MR`,
          source: 'MANUAL',
          unit: 'PIECE',
          materialId: baseRow,
          orderQuantity: 1,
          quantityPerUnit: 500,
          wastagePercent: 0,
          totalRequired: 500,
          shortfall: 500,
          unitPrice: 0,
          status: 'PO_REQUIRED',
          requiredDate: new Date(Date.now() + 30 * 86400000),
          createdById: userId,
        },
      })
    ).id;
    await expect(
      previewPOsFromRequirements({
        groups: [
          {
            supplierId,
            requirementIds: [requirementId],
            expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          },
        ],
      })
    ).rejects.toThrow(/order thread from Purchase Orders/);
  });
});
