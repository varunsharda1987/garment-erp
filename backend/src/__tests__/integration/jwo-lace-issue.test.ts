/**
 * Issuing greige lace to a dyer on a job work order (2026-09-08).
 *
 * A lace job consumes lace_stock, not greige_stock, and there is no header lot pointer to fall
 * back on — the lots are chosen at issue time, so the job_work_order_components rows ARE the
 * record of what left. That is why a lace component is written for EVERY lot, even a single one:
 * cancel-restore and the receipt's cost build both read it back.
 *
 * The three things this suite pins:
 *  1. The metres come out of AVAILABLE (goods physically left) with exactly ONE ledger row, and
 *     the central stock_levels ledger moves with them.
 *  2. A lot of a different lace is refused — the dyer is paid to turn ONE greige into ONE dyed
 *     variant, and any other lace would come back as a colour of something never sent.
 *  3. Cancelling before receipt puts the metres back on the lot, ledgered.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { createLaceStock } from '../../services/laceStock.service';

const RUN = `LIS${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeLaceId: string;
let dyedLaceId: string;
let otherLaceId: string;
let lotId: string;
let otherLotId: string;
let jwoId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const LOT_QTY = 1200;
const SEND_QTY = 1000;
const LACE_COST = 40;

const createJwo = () =>
  request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    greigeLaceId,
    finishedLaceId: dyedLaceId,
    quantity: SEND_QTY,
    agreedRate: 20,
    expectedShrinkage: 10,
  });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const warehouse = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Warehouse`,
      warehouseType: 'RAW_MATERIAL',
      isActive: true,
      createdById: userId,
    },
  });
  warehouseId = warehouse.id;

  const dyer = await prisma.suppliers.create({
    data: {
      code: `${RUN}-DYE`,
      name: `${RUN} Dyer`,
      supplierCategories: ['DYEING_PRINTING'],
      isActive: true,
      createdById: userId,
    },
  });
  dyerId = dyer.id;

  const greige = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-GL`,
      laceName: `${RUN} Greige Organza`,
      isGreige: true,
      expectedShrinkagePercent: 10,
      costPerMeterGreige: LACE_COST,
      laceType: 'Organza',
      width: 1,
    },
  });
  greigeLaceId = greige.id;

  const dyed = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-DL`,
      laceName: `${RUN} Navy Organza`,
      isGreige: false,
      color: 'Navy',
      sourceGreigeLaceId: greigeLaceId,
      laceType: 'Organza',
      width: 1,
    },
  });
  dyedLaceId = dyed.id;

  // A different greige lace with its own lot — the wrong-lot case.
  const other = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-GL2`,
      laceName: `${RUN} Greige Net`,
      isGreige: true,
      laceType: 'Net',
      width: 1,
    },
  });
  otherLaceId = other.id;

  const lot = await createLaceStock({
    laceId: greigeLaceId,
    lotNumber: `${RUN}-LOT1`,
    warehouseId,
    quantityAvailable: LOT_QTY,
    weightedAvgCost: LACE_COST,
    purchaseCost: LACE_COST,
    createdById: userId,
  });
  lotId = lot.id;

  const otherLot = await createLaceStock({
    laceId: otherLaceId,
    lotNumber: `${RUN}-LOT2`,
    warehouseId,
    quantityAvailable: 500,
    weightedAvgCost: 30,
    purchaseCost: 30,
    createdById: userId,
  });
  otherLotId = otherLot.id;
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  const challanIds = (
    await prisma.challans.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  await prisma.lace_stock_transaction.deleteMany({
    where: { stockId: { in: [only(lotId), only(otherLotId)] } },
  });
  await prisma.lace_stock.deleteMany({ where: { id: { in: [only(lotId), only(otherLotId)] } } });
  const laceIds = [only(greigeLaceId), only(dyedLaceId), only(otherLaceId)];
  await prisma.stock_levels.deleteMany({ where: { materials: { laceId: { in: laceIds } } } });
  await prisma.materials.deleteMany({ where: { laceId: { in: laceIds } } });
  await prisma.lace_master.deleteMany({ where: { id: only(dyedLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: { in: [only(greigeLaceId), only(otherLaceId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('issuing greige lace on a job work order', () => {
  it('refuses a lot of a different lace', async () => {
    const created = await createJwo();
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/job-work-orders/${created.body.data.id}/issue`)
      .set(authHeader)
      .send({ lots: [{ laceStockLotId: otherLotId, qty: SEND_QTY }] });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LOT_LACE_MISMATCH');

    // Nothing left the building.
    const lot = await prisma.lace_stock.findUnique({ where: { id: otherLotId } });
    expect(Number(lot!.quantityAvailable)).toBe(500);
  });

  it('consumes the lot, writes one ledger row and a component, and dispatches a challan', async () => {
    const created = await createJwo();
    expect(created.status).toBe(201);
    jwoId = created.body.data.id;

    const res = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ laceStockLotId: lotId, qty: SEND_QTY }] });

    expect(res.status).toBe(200);

    const lot = await prisma.lace_stock.findUnique({ where: { id: lotId } });
    expect(Number(lot!.quantityAvailable)).toBe(LOT_QTY - SEND_QTY); // 200
    expect(Number(lot!.quantityConsumed)).toBe(SEND_QTY);
    // Metres remain on the lot, so it is still usable.
    expect(lot!.status).toBe('AVAILABLE');

    // Exactly ONE consumption row — the challan page's own lace deduction must not have run too.
    const consumptions = await prisma.lace_stock_transaction.findMany({
      where: { stockId: lotId, transactionType: 'CONSUMPTION' },
    });
    expect(consumptions).toHaveLength(1);
    expect(Number(consumptions[0].quantity)).toBe(-SEND_QTY);
    expect(Number(consumptions[0].balanceAfter)).toBe(LOT_QTY - SEND_QTY);
    expect(consumptions[0].referenceType).toBe('CHALLAN');

    // The component is the record of which lot went out and at what cost.
    const components = await prisma.job_work_order_components.findMany({ where: { jobWorkOrderId: jwoId } });
    expect(components).toHaveLength(1);
    expect(components[0].materialType).toBe('LACE');
    expect(components[0].laceId).toBe(greigeLaceId);
    expect(components[0].laceStockId).toBe(lotId);
    expect(Number(components[0].qtySent)).toBe(SEND_QTY);
    expect(Number(components[0].rateAtIssue)).toBe(LACE_COST);
    expect(components[0].isChargeable).toBe(false);

    // The outward challan carries the lace line and is ISSUED (the goods really left).
    const challan = await prisma.challans.findFirst({
      where: { jobWorkOrderId: jwoId },
      include: { items: true },
    });
    expect(challan).not.toBeNull();
    expect(challan!.status).toBe('ISSUED');
    expect(challan!.items).toHaveLength(1);
    expect(challan!.items[0].itemType).toBe('LACE');
    expect(challan!.items[0].laceStockId).toBe(lotId);
    expect(challan!.items[0].jobWorkOrderComponentId).toBe(components[0].id);
    expect(consumptions[0].referenceId).toBe(challan!.id);

    // The central ledger moved with the lot.
    const material = await prisma.materials.findFirst({ where: { laceId: greigeLaceId } });
    const level = await prisma.stock_levels.findFirst({ where: { materialId: material!.id, warehouseId } });
    expect(Number(level!.quantity)).toBe(LOT_QTY - SEND_QTY);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.sentDate).not.toBeNull();
    expect(jwo!.jwoStatus).toBe('ISSUED');
    expect(jwo!.outwardChallanId).toBe(challan!.id);
  });

  it('refuses a second issue of the same order', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ laceStockLotId: lotId, qty: SEND_QTY }] });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ALREADY_ISSUED');
  });

  it('puts the metres back when the job is cancelled before receipt', async () => {
    const cancelled = await request(app)
      .post(`/api/job-work-orders/${jwoId}/cancel`)
      .set(authHeader)
      .send({ reason: 'Dyer could not match the shade' });
    expect(cancelled.status).toBe(200);

    const disposed = await request(app)
      .post(`/api/job-work-orders/${jwoId}/dispose-inventory`)
      .set(authHeader)
      .send({ disposition: 'RETURNED_TO_STOCK', notes: 'Lace came back undyed' });
    expect(disposed.status).toBe(200);

    const lot = await prisma.lace_stock.findUnique({ where: { id: lotId } });
    expect(Number(lot!.quantityAvailable)).toBe(LOT_QTY);
    expect(Number(lot!.quantityConsumed)).toBe(0);
    expect(lot!.status).toBe('AVAILABLE');

    const returns = await prisma.lace_stock_transaction.findMany({
      where: { stockId: lotId, transactionType: 'RETURN' },
    });
    expect(returns).toHaveLength(1);
    expect(Number(returns[0].quantity)).toBe(SEND_QTY);

    const material = await prisma.materials.findFirst({ where: { laceId: greigeLaceId } });
    const level = await prisma.stock_levels.findFirst({ where: { materialId: material!.id, warehouseId } });
    expect(Number(level!.quantity)).toBe(LOT_QTY);
  });
});
