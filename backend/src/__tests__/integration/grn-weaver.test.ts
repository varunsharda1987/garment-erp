/**
 * The weaver lives on the purchase and the lot, never on the greige master (Phase 1b, 2026-09-25).
 *
 * Owner: the weaver we buy a greige from keeps changing — record it when the PO is raised, the
 * stock must always show which weaver each lot came from, and every weaver's lots stay clubbed
 * under the same greige.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { weaverService, weaverNameKey } from '../../services/weaver.service';
import { lineageFromParts, weaverLabel } from '../../services/helpers/weaver-lineage.helper';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `WEAV${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let supplierId: string;
let warehouseId: string;
let greigeId: string;
let materialId: string;
let weaverA: string;
let weaverB: string;
const poIds: string[] = [];

async function makePo(weaverId: string | null, qty = 1000): Promise<{ poId: string; poItemId: string }> {
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
        unitPrice: 60,
        totalPrice: qty * 60,
        unit: 'METER',
        weaverId,
      },
    })
  ).id;
  return { poId, poItemId };
}

function line(poItemId: string, qty: number, extra: Record<string, unknown> = {}) {
  return {
    poItemId,
    materialId,
    receivedQuantity: qty,
    acceptedQuantity: qty,
    rejectedQuantity: 0,
    unit: 'METER' as const,
    ...extra,
  };
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
      data: { code: `${RUN}-SUP`, name: `${RUN} Trader`, isActive: true, createdById: userId },
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
        greigeName: `${RUN} Cotton Flex 63"`,
        composition: '100% Cotton',
        greigeWidth: 63,
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
  await prisma.weavers.deleteMany({ where: { nameKey: { startsWith: RUN.toLowerCase() } } });
  await prisma.materials.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('weaver on the purchase and the lot', () => {
  it('adds a weaver on the spot, and the same name in any case or spacing is the same weaver', async () => {
    const first = await weaverService.findOrCreate({ name: `${RUN} Kalai  Mangal` }, userId);
    expect(first.created).toBe(true);
    expect(first.weaver.name).toBe(`${RUN} Kalai Mangal`);
    const again = await weaverService.findOrCreate({ name: `  ${RUN.toLowerCase()} KALAI mangal ` }, userId);
    expect(again.created).toBe(false);
    expect(again.weaver.id).toBe(first.weaver.id);
    expect(weaverNameKey('  Kalai   MANGAL ')).toBe('kalai mangal');
    weaverA = first.weaver.id;
    weaverB = (await weaverService.findOrCreate({ name: `${RUN} Sharma Weaves` }, userId)).weaver.id;

    const found = await weaverService.search({ search: `${RUN} kalai` });
    expect(found.map((w) => w.id)).toEqual([weaverA]);
  });

  it('refuses a greige receipt that neither names a weaver nor says it is not known', async () => {
    const { poId, poItemId } = await makePo(null);
    await expect(grnService.createGRN({ poId, warehouseId, items: [line(poItemId, 400)] }, userId)).rejects.toThrow(
      /Weaver not known/
    );
  });

  it("inherits the PO line's weaver, and the lot carries it", async () => {
    const { poId, poItemId } = await makePo(weaverA);
    const grn = await grnService.createGRN({ poId, warehouseId, items: [line(poItemId, 600)] }, userId);
    const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: grn.id } });
    expect(item.weaverId).toBe(weaverA);

    await grnService.approveGRN(grn.id, userId, warehouseId);
    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { grnItemId: item.id } });
    expect(lot.weaverId).toBe(weaverA);
  });

  it('records the weaver that actually came when it differs from the PO line', async () => {
    const { poId, poItemId } = await makePo(weaverA);
    const grn = await grnService.createGRN(
      { poId, warehouseId, items: [line(poItemId, 300, { weaverId: weaverB })] },
      userId
    );
    await grnService.approveGRN(grn.id, userId, warehouseId);
    const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: grn.id } });
    const lot = await prisma.greige_stock.findFirstOrThrow({ where: { grnItemId: item.id } });
    expect(lot.weaverId).toBe(weaverB);
  });

  it('accepts "Weaver not known" out loud, and leaves the lot without one', async () => {
    const { poId, poItemId } = await makePo(null);
    const grn = await grnService.createGRN(
      { poId, warehouseId, items: [line(poItemId, 200, { weaverNotKnown: true })] },
      userId
    );
    const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId: grn.id } });
    expect(item.weaverNotKnown).toBe(true);
    expect(item.weaverId).toBeNull();
  });

  it('keeps every weaver under ONE greige: two lots, one greigeId, different weavers', async () => {
    const lots = await prisma.greige_stock.findMany({
      where: { greigeId, weaverId: { not: null } },
      select: { greigeId: true, weaverId: true },
    });
    expect(new Set(lots.map((l) => l.greigeId))).toEqual(new Set([greigeId]));
    expect(new Set(lots.map((l) => l.weaverId))).toEqual(new Set([weaverA, weaverB]));
  });

  it('processed fabric from several weavers records the mix by metres', () => {
    const one = lineageFromParts([{ weaverId: 'a', weaverName: 'A', metres: 500 }]);
    expect(one).toEqual({ weaverId: 'a', weaverMix: null });

    const mixed = lineageFromParts([
      { weaverId: 'a', weaverName: 'A', metres: 600 },
      { weaverId: 'b', weaverName: 'B', metres: 400 },
    ]);
    expect(mixed.weaverId).toBeNull();
    expect(mixed.weaverMix?.map((m) => [m.weaverName, m.share])).toEqual([
      ['A', 60],
      ['B', 40],
    ]);
    expect(weaverLabel(null, mixed.weaverMix)).toBe('Mixed: A 60%, B 40%');
  });
});
