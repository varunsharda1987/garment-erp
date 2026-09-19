/**
 * Receiving dyed lace back from the dyer, through the GRN door (2026-09-08).
 *
 * A lace job books its GRN against the DYED VARIANT — that is the material arriving; the greige
 * left stock at issue. Approval mints a lace_stock lot instead of fabric_stock, and mints no
 * fabric master at all: the variant already exists, chosen when the job was raised.
 *
 * COST is the point of this suite. The fabric path adds the processing rate to the greige rate
 * per metre, which under-values cloth that shrank — you paid for every metre sent but got the
 * shrunk quantity back. Lace values the lot the way the cost sheet quotes it: all the greige
 * money plus all the dyeing money over what actually arrived.
 *
 *     (1,000 m x ₹40 + 900 m x ₹20) / 900 = ₹64.44/m
 *
 * which is exactly the cost sheet's all-in, greige/(1−s) + dyeing.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { createLaceStock } from '../../services/laceStock.service';

const RUN = `LRC${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeLaceId: string;
let dyedLaceId: string;
let lotId: string;
let jwoId: string;
let grnId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const LOT_QTY = 1200;
const SEND_QTY = 1000;
const RECEIVE_QTY = 900; // 1,000 sent at 10% shrinkage
const LACE_COST = 40;
const DYEING_RATE = 20;
/** (1,000 × 40 + 900 × 20) ÷ 900 */
const EXPECTED_COST_PER_M = (SEND_QTY * LACE_COST + RECEIVE_QTY * DYEING_RATE) / RECEIVE_QTY;

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

  // Raise the job and send the greige lace, so the receipt has real components to cost from.
  const created = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    greigeLaceId,
    finishedLaceId: dyedLaceId,
    quantity: SEND_QTY,
    agreedRate: DYEING_RATE,
    expectedShrinkage: 10,
  });
  if (created.status !== 201) throw new Error(`JWO create failed: ${JSON.stringify(created.body)}`);
  jwoId = created.body.data.id;

  const issued = await request(app)
    .post(`/api/job-work-orders/${jwoId}/issue`)
    .set(authHeader)
    .send({ lots: [{ laceStockLotId: lotId, qty: SEND_QTY }] });
  if (issued.status !== 200) throw new Error(`JWO issue failed: ${JSON.stringify(issued.body)}`);
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({
      where: { jobWorkOrderId: { in: jwoIds } },
      select: { id: true },
    })
  ).map((g) => g.id);
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  const challanIds = (
    await prisma.challans.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  const laceIds = [only(greigeLaceId), only(dyedLaceId)];
  const lots = await prisma.lace_stock.findMany({ where: { laceId: { in: laceIds } }, select: { id: true } });
  await prisma.lace_stock_transaction.deleteMany({ where: { stockId: { in: lots.map((l) => l.id) } } });
  await prisma.lace_stock.deleteMany({ where: { id: { in: lots.map((l) => l.id) } } });
  await prisma.stock_levels.deleteMany({ where: { materials: { laceId: { in: laceIds } } } });
  // GRN approval writes the central movement ledger too
  await prisma.stock_movements.deleteMany({ where: { materials: { laceId: { in: laceIds } } } });
  await prisma.materials.deleteMany({ where: { laceId: { in: laceIds } } });
  await prisma.lace_master.deleteMany({ where: { id: only(dyedLaceId) } });
  await prisma.lace_master.deleteMany({ where: { id: only(greigeLaceId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('receiving dyed lace on a job work order GRN', () => {
  it('refuses the JWO-page receive and points at the GRN door', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${jwoId}/receive`)
      .set(authHeader)
      .send({ qtyReceived: RECEIVE_QTY });

    // Without this, a lace job would terminate on the JWO page and the dyed lace would never
    // reach stock: it has no greige lot pointer and (raised by hand) no requirement link.
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RECEIVE_VIA_GRN');
    expect(res.body.message).toMatch(/lace/i);
  });

  it('one action books the receipt against the dyed variant and mints the lace lot at the all-in cost', async () => {
    const res = await request(app)
      .post('/api/grn/jwo/receive')
      .set(authHeader)
      .send({
        jobWorkOrderId: jwoId,
        qtyReceivedMeters: RECEIVE_QTY,
        warehouseId,
        receivedChallan: `${RUN}-VCH`,
      });

    expect(res.status).toBe(201);
    grnId = res.body.data.id;
    expect(res.body.data.status).toBe('ACCEPTED'); // filed accepted at birth

    const items = await prisma.grn_items.findMany({ where: { grnId } });
    expect(items).toHaveLength(1);
    expect(items[0].materialId).toBe(dyedLaceId); // materials.id === master.id
    expect(Number(items[0].receivedQuantity)).toBe(RECEIVE_QTY);
    // Ordered basis is the expected lace back (billable), not the 1,000 m sent.
    expect(Number(items[0].orderedQuantity)).toBeCloseTo(RECEIVE_QTY, 2);

    // …and the same call minted the lot — no separate approval.
    const lots = await prisma.lace_stock.findMany({ where: { laceId: dyedLaceId } });
    expect(lots).toHaveLength(1);
    expect(Number(lots[0].quantityAvailable)).toBe(RECEIVE_QTY);
    expect(Number(lots[0].purchaseCost)).toBeCloseTo(EXPECTED_COST_PER_M, 2); // 64.44
    expect(Number(lots[0].weightedAvgCost)).toBeCloseTo(EXPECTED_COST_PER_M, 2);
    expect(lots[0].warehouseId).toBe(warehouseId);
    expect(lots[0].status).toBe('AVAILABLE');

    const ledger = await prisma.lace_stock_transaction.findMany({
      where: { stockId: lots[0].id, transactionType: 'STOCK_IN' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].referenceType).toBe('GRN');
    expect(ledger[0].referenceId).toBe(grnId);

    // The central ledger carries the dyed variant now.
    const material = await prisma.materials.findFirst({ where: { laceId: dyedLaceId } });
    const level = await prisma.stock_levels.findFirst({ where: { materialId: material!.id, warehouseId } });
    expect(Number(level!.quantity)).toBe(RECEIVE_QTY);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(jwo!.qtyReceivedMeters)).toBe(RECEIVE_QTY);
    // A lace job mints no fabric master — writing one would put a phantom cloth on the order.
    expect(jwo!.finishedFabricId).toBeNull();

    const fabricLots = await prisma.fabric_stock.findMany({ where: { originStyleId: null, createdById: userId } });
    expect(fabricLots).toHaveLength(0);
  });

  it('takes the lot back when the receipt is reversed', async () => {
    const res = await request(app)
      .patch(`/api/grn/${grnId}/reverse`)
      .set(authHeader)
      .send({ reason: 'Wrong shade — sent back to the dyer' });
    expect(res.status).toBe(200);

    const lots = await prisma.lace_stock.findMany({ where: { laceId: dyedLaceId } });
    expect(lots).toHaveLength(0);

    const material = await prisma.materials.findFirst({ where: { laceId: dyedLaceId } });
    const level = await prisma.stock_levels.findFirst({ where: { materialId: material!.id, warehouseId } });
    expect(Number(level?.quantity ?? 0)).toBe(0);
  });
});
