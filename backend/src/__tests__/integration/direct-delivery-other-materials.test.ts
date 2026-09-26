/**
 * Lace, ready fabric and trims delivered STRAIGHT to a processor (direct-to-processor plan, Phase 2
 * step 5). Owner, 2026-09-25: every material a supplier delivers to a dyer travels under a challan, not
 * only greige. So a receipt into a processor's unit raises ONE Rule 45 challan naming every lot it
 * booked there, whatever the material:
 *
 *  - LACE: the lot sits in the unit (lace has no holder column — its warehouse says where it is); a
 *    lace dyeing job at that dyer DRAWS it where it lies, with no new challan; another dyer cannot
 *    take it; the receipt cannot be reversed once some of it was drawn.
 *  - READY FABRIC: recorded there with its challan; a job cannot take it where it lies until Phase 4a,
 *    so the issue refuses it rather than putting it on a dispatch challan.
 *  - TRIMS: named on the challan by material.
 *  - MRP (2026-09-26): lace in A's unit plans only for requirements at A (or with no processor yet),
 *    and our production floor cannot allocate or issue it from where it lies.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { grnService } from '../../services/grn.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { getRequirements } from '../../services/mrp.service';
import { getAvailableStockForLace } from '../../services/laceStock.service';
import { createLaceIssueNote } from '../../services/laceIssueNote.service';

const RUN = `DDM${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';
const DAY = 24 * 60 * 60 * 1000;
const RECEIVED_ON = new Date(Date.now() - 10 * DAY);

let userId: string;
let authHeader: Record<string, string>;
let supplierId: string;
let dyerA: string;
let dyerB: string;
let unitA: string;
let greigeLaceId: string;
let dyedLaceId: string;
let fabricId: string;
let otherMaterialId: string;
const materialIds: string[] = [];
const poIds: string[] = [];

async function receiveInto(
  category: 'GREIGE_LACE' | 'FABRIC' | 'OTHER_MATERIAL',
  materialId: string,
  qty: number,
  rate: number,
  unit: 'METER' | 'PIECE'
) {
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
        // Deliver To = dyer A's unit, so the approval needs no confirmation
        deliveryLocationId: unitA,
        deliveryLocationType: 'PROCESSOR',
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
        unitPrice: rate,
        totalPrice: qty * rate,
        unit,
      },
    })
  ).id;
  const grn = await grnService.createGRN(
    {
      poId,
      warehouseId: unitA,
      receivingDate: RECEIVED_ON,
      items: [
        {
          poItemId,
          materialId,
          receivedQuantity: qty,
          acceptedQuantity: qty,
          rejectedQuantity: 0,
          unit,
          weaverNotKnown: true,
        },
      ],
    },
    userId
  );
  await grnService.approveGRN(grn.id, userId, unitA);
  const challan = await prisma.challans.findFirstOrThrow({
    where: { directSupplyGrnId: grn.id },
    include: { items: true },
  });
  return { grnId: grn.id, challan };
}

const createLaceJob = (processorId: string, quantity: number) =>
  request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId,
    greigeLaceId,
    finishedLaceId: dyedLaceId,
    quantity,
    agreedRate: 20,
    expectedShrinkage: 10,
  });

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  authHeader = getAuthHeader(userId, 'ADMIN');
  supplierId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-SUP`, name: `${RUN} Supplier`, supplierCategories: ['LACE_SUPPLIER'], createdById: userId },
    })
  ).id;
  const mkDyer = async (tag: string) =>
    (
      await prisma.suppliers.create({
        data: {
          code: `${RUN}-${tag}`,
          name: `${RUN} Dyer ${tag}`,
          supplierCategories: ['DYEING_PRINTING'],
          createdById: userId,
        },
      })
    ).id;
  dyerA = await mkDyer('A');
  dyerB = await mkDyer('B');
  unitA = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-JWA`,
        warehouseName: `${RUN} Dyer A - Processing Unit`,
        warehouseType: 'JOB_WORK',
        supplierId: dyerA,
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  greigeLaceId = (
    await prisma.lace_master.create({
      data: { laceCode: `${RUN}-GL`, laceName: `${RUN} Greige Organza`, isGreige: true, laceType: 'Organza', width: 1 },
    })
  ).id;
  dyedLaceId = (
    await prisma.lace_master.create({
      data: {
        laceCode: `${RUN}-DL`,
        laceName: `${RUN} Navy Organza`,
        isGreige: false,
        color: 'Navy',
        sourceGreigeLaceId: greigeLaceId,
        laceType: 'Organza',
        width: 1,
      },
    })
  ).id;
  fabricId = (
    await prisma.fabric_master.create({
      data: { fabricCode: `${RUN}-FAB`, fabricName: `${RUN} Dyed Cambric`, createdById: userId },
    })
  ).id;
  otherMaterialId = (
    await prisma.other_material_master.create({
      data: { materialCode: `${RUN}-OTH`, materialName: `${RUN} Tissue Paper` },
    })
  ).id;
  materialIds.push(
    await ensureMaterialRecord(greigeLaceId, 'LACE'),
    await ensureMaterialRecord(fabricId, 'FABRIC'),
    await ensureMaterialRecord(otherMaterialId, 'OTHER_MATERIAL')
  );
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({
      where: { processorId: { in: [only(dyerA), only(dyerB)] } },
      select: { id: true },
    })
  ).map((j) => j.id);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { poId: { in: poIds } }, select: { id: true } })
  ).map((g) => g.id);
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jwoIds } }, { directSupplyGrnId: { in: grnIds } }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  const reqIds = (
    await prisma.material_requirements.findMany({ where: { materialId: { in: materialIds } }, select: { id: true } })
  ).map((r) => r.id);
  await prisma.stock_reservations.deleteMany({ where: { referenceId: { in: reqIds } } });
  await prisma.material_requirements.deleteMany({ where: { id: { in: reqIds } } });
  const laceLots = (
    await prisma.lace_stock.findMany({ where: { laceId: only(greigeLaceId) }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.lace_stock_transaction.deleteMany({ where: { stockId: { in: laceLots } } });
  await prisma.lace_stock.deleteMany({ where: { id: { in: laceLots } } });
  const fabricLots = (
    await prisma.fabric_stock.findMany({ where: { fabricId: only(fabricId) }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLots } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLots } } });
  await prisma.other_material_stock.deleteMany({ where: { otherMaterialId: only(otherMaterialId) } });
  await prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.stock_transactions.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } });
  for (const id of poIds) {
    const grns = await prisma.goods_receiving_notes.findMany({ where: { poId: only(id) }, select: { id: true } });
    await prisma.grn_items.deleteMany({ where: { grnId: { in: grns.map((g) => g.id) } } });
    await prisma.goods_receiving_notes.deleteMany({ where: { poId: only(id) } });
    await prisma.purchase_order_items.deleteMany({ where: { poId: only(id) } });
    await prisma.purchase_orders.deleteMany({ where: { id: only(id) } });
  }
  await prisma.materials.deleteMany({ where: { id: { in: materialIds } } });
  await prisma.materials.deleteMany({ where: { laceId: only(dyedLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: only(dyedLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: only(greigeLaceId) } });
  await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
  await prisma.other_material_master.deleteMany({ where: { id: only(otherMaterialId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(unitA) } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(dyerA), only(dyerB), only(supplierId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('lace, fabric and trims delivered straight to a processor', () => {
  let laceGrnId: string;
  let laceLotId: string;

  it('books lace at the dyer with a challan line naming the lot', async () => {
    const { grnId, challan } = await receiveInto('GREIGE_LACE', materialIds[0], 1000, 40, 'METER');
    laceGrnId = grnId;
    const lot = await prisma.lace_stock.findFirstOrThrow({ where: { laceId: greigeLaceId } });
    laceLotId = lot.id;
    expect(lot.warehouseId).toBe(unitA);
    expect(Number(lot.quantityAvailable)).toBe(1000);
    expect(lot.grnItemId).not.toBeNull(); // reversal finds it exactly
    expect(challan.status).toBe('ISSUED');
    expect(challan.toId).toBe(dyerA);
    expect(challan.items).toHaveLength(1);
    expect(challan.items[0]).toMatchObject({ itemType: 'LACE', laceStockId: lot.id });
    expect(Number(challan.totalDeclaredValue)).toBe(40000);
  });

  it("refuses the lace on another dyer's job", async () => {
    const job = await createLaceJob(dyerB, 300);
    expect(job.status).toBe(201);
    const res = await request(app)
      .post(`/api/job-work-orders/${job.body.data.id}/issue`)
      .set(authHeader)
      .send({ lots: [{ laceStockLotId: laceLotId, qty: 300 }] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LOT_AT_WRONG_PROCESSOR');
  });

  it('a lace job at that dyer draws it where it lies — no new challan', async () => {
    const job = await createLaceJob(dyerA, 300);
    expect(job.status).toBe(201);
    const jobId = job.body.data.id as string;

    const preview = (await request(app).get(`/api/job-work-orders/${jobId}/issue-preview`).set(authHeader)).body.data;
    const offered = preview.atProcessor.find((l: { id: string }) => l.id === laceLotId);
    expect(offered?.location).toMatchObject({ category: 'AT_THIS_PROCESSOR', drawnWhereItLies: true });

    const res = await request(app)
      .post(`/api/job-work-orders/${jobId}/issue`)
      .set(authHeader)
      .send({ lots: [{ laceStockLotId: laceLotId, qty: 300 }] });
    expect(res.status).toBe(200);
    expect(res.body.challanCreated).toBe(false);
    expect(await prisma.challans.count({ where: { jobWorkOrderId: jobId } })).toBe(0);
    const lot = await prisma.lace_stock.findUniqueOrThrow({ where: { id: laceLotId } });
    expect(Number(lot.quantityAvailable)).toBe(700);
    const draw = await prisma.lace_stock_transaction.findFirst({
      where: { stockId: laceLotId, referenceType: 'JOB_WORK_ORDER', referenceId: jobId },
    });
    expect(draw).not.toBeNull();
  });

  it("MRP plans lace at a requirement's own dyer only, reserves the same way, and our floor cannot take it", async () => {
    // 700 m left at dyer A (above); 200 m in our store (no warehouse recorded = ours)
    const storeLot = await prisma.lace_stock.create({
      data: {
        laceId: greigeLaceId,
        lotNumber: `${RUN}-STORE`,
        quantityAvailable: 200,
        weightedAvgCost: 40,
        purchaseCost: 40,
        receivedDate: new Date(Date.now() - 20 * DAY),
      },
    });
    let seq = 0;
    const makeRequirement = (processorId: string | null) =>
      prisma.material_requirements.create({
        data: {
          id: randomUUID(),
          requirementNumber: `${RUN}-MR${++seq}`,
          source: 'WORK_ORDER',
          unit: 'METER',
          materialId: materialIds[0],
          orderQuantity: 100,
          quantityPerUnit: 1,
          wastagePercent: 0,
          totalRequired: 100,
          shortfall: 100,
          status: 'PO_REQUIRED',
          requiredDate: new Date(Date.now() + 30 * DAY),
          processorId,
          createdById: userId,
        },
      });
    const atA = await makeRequirement(dyerA);
    const atB = await makeRequirement(dyerB);
    const unassigned = await makeRequirement(null);

    const { data } = await getRequirements({ materialId: materialIds[0], page: 1, limit: 50 } as never);
    const stockOf = (id: string) => data.find((r) => r.id === id)!.currentStock;
    expect(stockOf(atA.id)).toBe(900);
    expect(stockOf(atB.id)).toBe(200); // dyer A's lace is not dyer B's to plan with
    expect(stockOf(unassigned.id)).toBe(900);

    const reservedOn = async (id: string) =>
      Number((await prisma.lace_stock.findUniqueOrThrow({ where: { id } })).quantityReserved ?? 0);
    await request(app)
      .post(`/api/mrp/requirements/${atB.id}/allocate-stock`)
      .set(authHeader)
      .send({ quantity: 100 })
      .expect(200);
    expect(await reservedOn(storeLot.id)).toBe(100);
    expect(await reservedOn(laceLotId)).toBe(0);
    await request(app)
      .post(`/api/mrp/requirements/${atA.id}/allocate-stock`)
      .set(authHeader)
      .send({ quantity: 100 })
      .expect(200);
    expect(await reservedOn(laceLotId)).toBe(100); // its own dyer's lace first
    await prisma.lace_stock.updateMany({
      where: { id: { in: [laceLotId, storeLot.id] } },
      data: { quantityReserved: 0 },
    });

    // Allocating or issuing to our production floor: only store lace is offered, unit lace is refused
    const offered = await getAvailableStockForLace(greigeLaceId);
    expect(offered.stocks.map((l) => l.id)).toEqual([storeLot.id]);
    const allocate = await request(app)
      .post(`/api/lace-stock/${laceLotId}/allocate`)
      .set(authHeader)
      .send({ orderId: randomUUID(), styleId: randomUUID(), quantityToAllocate: 50 });
    expect(allocate.status).toBe(422);
    expect(allocate.body.details).toMatchObject({ code: 'LACE_AT_PROCESSOR' });
    await expect(
      createLaceIssueNote({
        orderId: randomUUID(),
        styleId: randomUUID(),
        stockId: laceLotId,
        laceId: greigeLaceId,
        issuedQuantity: 50,
        issuedById: userId,
      })
    ).rejects.toMatchObject({ details: { code: 'LACE_AT_PROCESSOR' } });
    expect(Number((await prisma.lace_stock.findUniqueOrThrow({ where: { id: laceLotId } })).quantityAvailable)).toBe(
      700
    );
    await prisma.lace_stock.delete({ where: { id: storeLot.id } });
  });

  it('refuses reversing the lace receipt once some of it was drawn', async () => {
    await expect(grnService.reverseGRN(laceGrnId, userId, `${RUN} test`)).rejects.toThrow(/already been used/);
  });

  it('books ready fabric at the dyer with its challan, but a job cannot take it there yet', async () => {
    const { challan } = await receiveInto('FABRIC', materialIds[1], 500, 90, 'METER');
    const lot = await prisma.fabric_stock.findFirstOrThrow({ where: { fabricId } });
    expect(lot.warehouseId).toBe(unitA);
    expect(challan.items[0]).toMatchObject({ itemType: 'FABRIC', fabricStockId: lot.id });

    const job = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'EMBROIDERY',
      processorId: dyerA,
      fabricStockLotId: lot.id,
      quantity: 100,
      agreedRate: 5,
    });
    expect(job.status).toBe(201);
    const res = await request(app).post(`/api/job-work-orders/${job.body.data.id}/issue`).set(authHeader).send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FABRIC_AT_PROCESSOR_NOT_YET');
    expect(Number((await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lot.id } })).quantityAvailable)).toBe(
      500
    );
  });

  it('names trims on the challan by material', async () => {
    const { challan } = await receiveInto('OTHER_MATERIAL', materialIds[2], 200, 2, 'PIECE');
    expect(challan.items).toHaveLength(1);
    expect(challan.items[0]).toMatchObject({ itemType: 'TRIM', materialId: materialIds[2] });
    expect(Number(challan.items[0].quantity)).toBe(200);
  });
});
