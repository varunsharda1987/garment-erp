/**
 * Five fabric-lot bugs found while planning the rolls & thans work (plans/fabric-lot-rolls-thans.md, "Not in this
 * change", fixed 2026-09-28):
 *
 *  1. A GREIGE receipt line received as READY FABRIC books a fabric lot — reversing the receipt left that lot in
 *     stock, and the greige branch's legacy fallback zeroed an unrelated old greige lot of the same greige.
 *  2. A FABRIC receipt's reversal took back only the lot its line booked, refused once used, zeroed (never deleted)
 *     with a ledger row — no fallback onto another receipt's or a hand-entered lot.
 *  3. Issue to Cutting of a lot the Cutting Chart did not plan: a lot of a fabric the batch cuts joins the batch (so
 *     completion counts and returns it); a lot of another fabric is refused and nothing moves.
 *  4. The cutting issue fulfils the order's MRP hold on the lot (only the job-work issue did).
 *  5. POST /api/stock/transfer moves a whole lot only, with its ledger row in the same transaction.
 *
 * Tests run on the LIVE DB: every fixture is tagged with RUN and removed by id. Nothing posts {}.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';

const RUN = `FBX${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';
const DAY = 24 * 60 * 60 * 1000;
const RECEIVED_ON = new Date(Date.now() - 5 * DAY);

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let supplierId: string;
let customerId: string;
let orderId: string;
let styleId: string;
let workOrderId: string;
let batchId: string;
let greigeId: string;
let readyFabricId: string; // the fabric the greige becomes — what a "received as ready fabric" line books
let fabricA: string; // cut in the batch
let fabricB: string; // not cut in the batch
let requirementId: string;
const poIds: string[] = [];
const lot: Record<'planned' | 'extra' | 'other' | 'moving' | 'oldGreige', string> = {
  planned: '',
  extra: '',
  other: '',
  moving: '',
  oldGreige: '',
};

const lotQty = async (id: string) =>
  Number((await prisma.fabric_stock.findUniqueOrThrow({ where: { id } })).quantityAvailable);
const onHand = async (materialId: string) =>
  Number((await prisma.stock_levels.findFirst({ where: { materialId, warehouseId } }))?.quantity ?? 0);

/** A lot put on the rack by hand (no receipt) — the kind the old reversal fallback could take */
const makeLot = async (fabricId: string, qty: number) => {
  const created = await prisma.fabric_stock.create({
    data: {
      fabricId,
      finishedWidth: 58,
      cutableWidth: 56,
      quantityAvailable: qty,
      weightedAvgCost: 80,
      purchaseCost: 80,
      receivedDate: RECEIVED_ON,
      warehouseId,
      createdById: userId,
    },
  });
  await syncStockLevelQuantity(fabricId, qty, warehouseId, 'METER');
  return created.id;
};

/** A PO of one line, received into the store and approved */
async function receive(
  category: 'FABRIC' | 'GREIGE',
  materialId: string,
  qty: number,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const poId = (
    await prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber: `${RUN}-PO${poIds.length + 1}`,
        supplierId,
        poDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * DAY),
        status: 'SENT',
        poCategory: category,
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
        unitPrice: 90,
        totalPrice: qty * 90,
        unit: 'METER',
      },
    })
  ).id;
  const grn = await grnService.createGRN(
    {
      poId,
      invoiceToFollow: true,
      warehouseId,
      receivingDate: RECEIVED_ON,
      items: [
        {
          poItemId,
          materialId,
          receivedQuantity: qty,
          acceptedQuantity: qty,
          rejectedQuantity: 0,
          unit: 'METER',
          weaverNotKnown: true,
          receivedWidthInches: 58,
          ...extra,
        },
      ],
    },
    userId
  );
  await grnService.approveGRN(grn.id, userId, warehouseId);
  return grn.id;
}

const lineLot = async (grnId: string) => {
  const item = await prisma.grn_items.findFirstOrThrow({ where: { grnId } });
  return prisma.fabric_stock.findFirstOrThrow({ where: { grnItemId: item.id } });
};

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

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
  supplierId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-SUP`,
        name: `${RUN} Mill`,
        supplierCategories: ['FABRIC_SUPPLIER', 'GREIGE_SUPPLIER'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: `${RUN} Poplin`,
        genericGreigeName: `${RUN} Poplin`,
        composition: '100% Cotton',
        greigeWidth: 58,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(greigeId, 'GREIGE');
  const mkFabric = async (tag: string, extra: Record<string, unknown> = {}) => {
    const id = (
      await prisma.fabric_master.create({
        data: { fabricCode: `${RUN}-${tag}`, fabricName: `${RUN} ${tag}`, createdById: userId, ...extra },
      })
    ).id;
    await ensureMaterialRecord(id, 'FABRIC');
    return id;
  };
  readyFabricId = await mkFabric('RF', { greigeId, isActive: true });
  fabricA = await mkFabric('FA');
  fabricB = await mkFabric('FB');

  // An old greige receipt lot of the same greige with no receipt line — what the old fallback picked
  lot.oldGreige = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 300,
        greigeWidth: 58,
        receivedDate: RECEIVED_ON,
        purchaseCost: 40,
        weightedAvgCost: 40,
        warehouseId,
        sourceType: 'GRN',
        createdById: userId,
      },
    })
  ).id;

  lot.planned = await makeLot(fabricA, 300);
  lot.extra = await makeLot(fabricA, 300);
  lot.other = await makeLot(fabricB, 300);
  lot.moving = await makeLot(fabricA, 120);

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}-ORD`,
        customerId,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 30 * DAY),
        totalQuantity: 100,
        totalAmount: 10000,
        createdById: userId,
      },
    })
  ).id;
  workOrderId = (
    await prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: `${RUN}-WO`,
        styleId,
        orderId,
        status: 'IN_PRODUCTION',
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 20 * DAY),
        totalQuantity: 100,
        createdById: userId,
      },
    })
  ).id;
  // A batch the Cutting Chart planned from ONE lot of fabric A
  batchId = (
    await prisma.cutting_batches.create({
      data: {
        id: randomUUID(),
        batchNumber: `${RUN}-CB1`,
        workOrderId,
        fabricStockId: lot.planned,
        cuttingDate: new Date(),
        actualFabricWidth: 56,
        cadAverageUsed: 1.5,
        cadWidthUsed: 58,
        layersPerLay: 1,
        numberOfLays: 1,
        fabricConsumed: 0,
        status: 'IN_PROGRESS',
        createdById: userId,
      },
    })
  ).id;
  await prisma.cutting_batch_fabrics.create({
    data: { batchId, fabricStockId: lot.planned, cadAvgUsed: 1.5, cadWidthUsed: 58, actualWidth: 56 },
  });

  // The order's requirement for fabric A holds 50 m on the extra lot (Use Stock)
  requirementId = (
    await prisma.material_requirements.create({
      data: {
        requirementNumber: `${RUN}-MR`,
        source: 'SALES_ORDER',
        materialId: fabricA,
        orderId,
        orderQuantity: 100,
        quantityPerUnit: 1.5,
        wastagePercent: 0,
        totalRequired: 150,
        unit: 'METER',
        shortfall: 0,
        allocatedFromStock: 50,
        requiredDate: new Date(Date.now() + 10 * DAY),
        createdById: userId,
      },
    })
  ).id;
  await prisma.stock_reservations.create({
    data: {
      materialId: fabricA,
      warehouseId,
      reservationType: 'ORDER',
      referenceType: 'MATERIAL_REQUIREMENT',
      referenceId: requirementId,
      referenceNumber: `${RUN}-MR`,
      reservedQuantity: 50,
      unit: 'METER',
      status: 'ACTIVE',
      reservedById: userId,
      fabricStockId: lot.extra,
    },
  });
  await prisma.fabric_stock.update({ where: { id: lot.extra }, data: { quantityReserved: 50 } });
});

afterAll(async () => {
  // Per-step teardown by id, never one wrapping try/catch
  const fabricIds = [readyFabricId, fabricA, fabricB].map(only);
  const lotIds = (
    await prisma.fabric_stock.findMany({ where: { fabricId: { in: fabricIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.stock_reservations.deleteMany({ where: { referenceId: only(requirementId) } });
  await prisma.material_requirements.deleteMany({ where: { id: only(requirementId) } });

  await prisma.cutting_batches.updateMany({ where: { id: only(batchId) }, data: { returnChallanId: null } });
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ productionRunId: only(workOrderId) }, { cuttingBatchId: only(batchId) }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.fabric_stock_allocation.deleteMany({ where: { cuttingBatchId: only(batchId) } });
  await prisma.cutting_batches.deleteMany({ where: { id: only(batchId) } });
  await prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });

  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: [...grnIds, ...poIds] } } });
  await prisma.fabric_stock_details.deleteMany({ where: { fabricStockId: { in: lotIds } } });
  await prisma.grn_item_details.deleteMany({ where: { grn_items: { grnId: { in: grnIds } } } });
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  await prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } });
  await prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } });

  await prisma.fabric_procurement.deleteMany({ where: { fabricId: { in: fabricIds } } });
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: lotIds } } });
  const greigeLots = (
    await prisma.greige_stock.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: greigeLots } } });
  await prisma.greige_stock.deleteMany({ where: { id: { in: greigeLots } } });
  const materialIds = [...fabricIds, only(greigeId)];
  await prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.materials.deleteMany({ where: { id: { in: materialIds } } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: fabricIds } } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(supplierId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
});

describe('fabric-lot bug fixes', () => {
  describe('GRN reversal', () => {
    it('a FABRIC receipt reversal takes back only its own lot — zeroed, with a ledger row — and stock_levels', async () => {
      const before = await onHand(fabricA);
      const grnId = await receive('FABRIC', fabricA, 400);
      const booked = await lineLot(grnId);
      expect(Number(booked.quantityAvailable)).toBe(400);
      expect(await onHand(fabricA)).toBe(before + 400);

      await grnService.reverseGRN(grnId, userId, `${RUN} wrong delivery`);
      const after = await prisma.fabric_stock.findUniqueOrThrow({ where: { id: booked.id } });
      expect(Number(after.quantityAvailable)).toBe(0);
      expect(after.status).toBe('EXHAUSTED');
      const row = await prisma.fabric_stock_transaction.findFirstOrThrow({
        where: { stockId: booked.id, transactionType: 'ADJUSTMENT_OUT', referenceId: grnId },
      });
      expect(Number(row.quantity)).toBe(400);
      expect(await onHand(fabricA)).toBe(before);
      // The hand-entered lots of the same fabric are untouched
      expect(await lotQty(lot.moving)).toBe(120);
    });

    it('refuses to reverse a FABRIC receipt whose lot has been used — nothing moves', async () => {
      const grnId = await receive('FABRIC', fabricB, 200);
      const booked = await lineLot(grnId);
      const used = await request(app)
        .post('/api/stock/adjust')
        .set(authHeader)
        .send({ stockId: booked.id, adjustmentType: 'DECREASE', quantity: 30, reason: 'DAMAGED' });
      expect(used.status).toBe(200);
      await expect(grnService.reverseGRN(grnId, userId, `${RUN} test`)).rejects.toMatchObject({
        details: { reason: 'GRN_LOT_ALREADY_USED' },
      });
      expect(await lotQty(booked.id)).toBe(170);
    });

    it('a greige line received as ready fabric: the reversal takes back its fabric lot, never an old greige lot', async () => {
      const before = await onHand(readyFabricId);
      const grnId = await receive('GREIGE', greigeId, 500, { receivedAsReadyFabric: true });
      const booked = await lineLot(grnId);
      expect(booked.fabricId).toBe(readyFabricId);
      expect(Number(booked.quantityAvailable)).toBe(500);
      expect(await onHand(readyFabricId)).toBe(before + 500);

      await grnService.reverseGRN(grnId, userId, `${RUN} came as greige after all`);
      expect(await lotQty(booked.id)).toBe(0);
      expect(await onHand(readyFabricId)).toBe(before);
      // The old greige lot the fallback used to zero
      const oldGreige = await prisma.greige_stock.findUniqueOrThrow({ where: { id: lot.oldGreige } });
      expect(Number(oldGreige.quantityAvailable)).toBe(300);
    });
  });

  describe('Issue to Cutting of a lot the Cutting Chart did not plan', () => {
    const issue = (lotId: string, fabricId: string, quantity: number) =>
      request(app)
        .post(`/api/work-orders/${workOrderId}/issue-fabric`)
        .set(authHeader)
        .send({
          cuttingBatchId: batchId,
          lots: [{ fabricStockId: lotId, fabricId, quantity, description: `${RUN} issue` }],
        });

    it('a lot of a fabric the batch does not cut is refused, and nothing moves', async () => {
      const res = await issue(lot.other, fabricB, 100);
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/cuts .*not/);
      expect(await lotQty(lot.other)).toBe(300);
      // Refused before its challan existed: no challan, no number used
      expect(await prisma.challan_items.count({ where: { fabricStockId: lot.other } })).toBe(0);
      expect(await prisma.cutting_batch_fabrics.count({ where: { batchId, fabricStockId: lot.other } })).toBe(0);
    });

    it('the issue screen lists which fabrics each batch cuts', async () => {
      const res = await request(app).get(`/api/work-orders/${workOrderId}/fabric-issuance-data`).set(authHeader);
      expect(res.status).toBe(200);
      const batch = res.body.data.openBatches.find((b: { id: string }) => b.id === batchId);
      expect(batch.fabricIds).toEqual([fabricA]);
    });

    it("a lot of the batch's own fabric joins the batch with its CAD figures, and fulfils the order's hold on it", async () => {
      const res = await issue(lot.extra, fabricA, 100);
      expect(res.status).toBe(201);
      expect(await lotQty(lot.extra)).toBe(200);
      const row = await prisma.cutting_batch_fabrics.findUniqueOrThrow({
        where: { batchId_fabricStockId: { batchId, fabricStockId: lot.extra } },
      });
      expect(Number(row.cadAvgUsed)).toBe(1.5);
      expect(Number(row.cadWidthUsed)).toBe(58);

      const hold = await prisma.stock_reservations.findFirstOrThrow({ where: { referenceId: requirementId } });
      expect(hold.status).toBe('CONSUMED');
      expect(Number(hold.consumedQuantity)).toBe(50);
      expect(Number((await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lot.extra } })).quantityReserved)).toBe(
        0
      );
    });

    it('completion counts the lot and gives back what is returned', async () => {
      const issued = await request(app).get(`/api/cutting/batches/${batchId}/issued-fabric`).set(authHeader);
      expect(issued.status).toBe(200);
      const rows = issued.body.data.fabrics ?? issued.body.data;
      expect(rows.find((r: { fabricStockId: string }) => r.fabricStockId === lot.extra)).toMatchObject({
        issuedQty: 100,
      });

      const res = await request(app)
        .post(`/api/cutting/batches/${batchId}/complete`)
        .set(authHeader)
        .send({ fabricReturns: [{ fabricStockId: lot.extra, returnedQuantity: 40 }] });
      expect(res.status).toBe(200);
      expect(await lotQty(lot.extra)).toBe(240);
      const row = await prisma.cutting_batch_fabrics.findUniqueOrThrow({
        where: { batchId_fabricStockId: { batchId, fabricStockId: lot.extra } },
      });
      expect(Number(row.fabricIssued)).toBe(100);
      expect(Number(row.fabricReturned)).toBe(40);
      expect(Number(row.actualConsumption)).toBe(60);
    });
  });

  describe('POST /api/stock/transfer', () => {
    it('refuses to relabel part of a lot', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .set(authHeader)
        .send({ stockId: lot.moving, toWarehouse: `${RUN} Rack B`, quantityToTransfer: 50 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/whole lot/);
      const unchanged = await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lot.moving } });
      expect(unchanged.warehouseLocation).not.toBe(`${RUN} Rack B`);
      expect(await prisma.fabric_stock_transaction.count({ where: { stockId: lot.moving } })).toBe(0);
    });

    it('moves a whole lot, with one ledger row for all of it', async () => {
      const res = await request(app)
        .post('/api/stock/transfer')
        .set(authHeader)
        .send({ stockId: lot.moving, toWarehouse: `${RUN} Rack B`, quantityToTransfer: 120 });
      expect(res.status).toBe(200);
      const moved = await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lot.moving } });
      expect(moved.warehouseLocation).toBe(`${RUN} Rack B`);
      expect(Number(moved.quantityAvailable)).toBe(120);
      const rows = await prisma.fabric_stock_transaction.findMany({ where: { stockId: lot.moving } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ transactionType: 'TRANSFER' });
      expect(Number(rows[0].quantity)).toBe(120);
    });
  });
});
