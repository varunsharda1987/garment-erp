/**
 * Issuing greige FABRIC to a dyer on a job work order (2026-09-15).
 *
 * The fabric twin of jwo-lace-issue. Until this file existed the fabric side of job work had no
 * test at all while lace had four — which is a large part of how the fabric GRN guard drifted
 * unnoticed (see jwo-fabric-receive). This suite pins what leaving the building looks like:
 *
 *  1. The metres come out of the greige lot's AVAILABLE with exactly ONE ledger row, a component
 *     records which lot went and at what cost, an ISSUED challan carries the line, and the
 *     central stock_levels ledger moves with them.
 *  2. A second issue of the same order is refused.
 *  3. Cancelling before receipt, then disposing the returned greige to stock, puts the metres
 *     back — lot, ledger and stock_levels — the "issued material credited back" the audit's logs
 *     showed working on the live jobs.
 *
 * NOT yet pinned: minting `finishedFabricId` at issue on this generic path. The Dyeing page mints
 * at issue; the generic path does not, and GRN creation now covers the gap by minting at receipt.
 * Whether the generic path should mint too is tied to the Dyeing-page receive decision (plan
 * Step 1). Until then the assertion below records the current null — flip it when that lands.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';

const RUN = `FIS${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let greigeMaterialId: string;
let lotId: string;
let jwoId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const LOT_QTY = 1200;
const SEND_QTY = 1000;
const GREIGE_COST = 40;

const createJwo = () =>
  request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    quantity: SEND_QTY,
    agreedRate: 20,
    expectedShrinkage: 10,
    colorName: 'Navy',
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

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GG`,
      greigeName: `${RUN} Poplin`,
      genericGreigeName: `${RUN} Poplin`,
      composition: '100% Cotton',
      greigeWidth: 52,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const lot = await prisma.greige_stock.create({
    data: {
      greigeId,
      quantityAvailable: LOT_QTY,
      greigeWidth: 52,
      receivedDate: new Date(),
      purchaseCost: GREIGE_COST,
      weightedAvgCost: GREIGE_COST,
      warehouseId,
      createdById: userId,
    },
  });
  lotId = lot.id;
  // The lot was created below the service layer — keep the central ledger honest.
  greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, LOT_QTY, warehouseId, 'METER');
});

afterAll(async () => {
  // Per-step teardown, never one wrapping try/catch (see jwo-fabric-receive).
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

  await prisma.stock_reservations.deleteMany({ where: { referenceNumber: { startsWith: RUN } } });
  await prisma.material_requirements.deleteMany({ where: { requirementNumber: { startsWith: RUN } } }); // cascades links

  const mintedIds = (
    await prisma.fabric_master.findMany({
      where: { OR: [{ fabricName: { contains: RUN } }, { greigeId: only(greigeId) }] },
      select: { id: true },
    })
  ).map((f) => f.id);
  await prisma.stock_movements.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.stock_levels.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.materials.deleteMany({ where: { OR: [{ fabricId: { in: mintedIds } }, { greigeId: only(greigeId) }] } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: mintedIds } } });

  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('issuing greige fabric on a job work order', () => {
  it('consumes the lot, writes one ledger row and a component, and dispatches a challan', async () => {
    const created = await createJwo();
    expect(created.status).toBe(201);
    jwoId = created.body.data.id;

    const res = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_QTY }] });

    expect(res.status).toBe(200);

    const lot = await prisma.greige_stock.findUnique({ where: { id: lotId } });
    expect(Number(lot!.quantityAvailable)).toBe(LOT_QTY - SEND_QTY); // 200
    expect(Number(lot!.quantityConsumed)).toBe(SEND_QTY);
    expect(lot!.status).toBe('AVAILABLE'); // metres remain, so it is still usable

    // Exactly ONE outgoing row — the challan page's own deduction must not have run too.
    const outgoing = await prisma.greige_stock_transaction.findMany({
      where: { stockId: lotId, transactionType: { in: ['CONSUMPTION', 'ISSUE'] } },
    });
    expect(outgoing).toHaveLength(1);
    expect(Math.abs(Number(outgoing[0].quantity))).toBe(SEND_QTY);
    expect(Number(outgoing[0].balanceAfter)).toBe(LOT_QTY - SEND_QTY);

    // Unlike lace, a SINGLE-lot greige issue writes no component row: the lot pointer lives on the
    // job header (greigeStockLotId) and the receipt costs from the lot's own purchaseCost.
    // Components are written only when the issue is split across lots. Pinned so the
    // difference stays deliberate.
    const components = await prisma.job_work_order_components.findMany({ where: { jobWorkOrderId: jwoId } });
    expect(components).toHaveLength(0);

    // The outward challan carries the greige line and is ISSUED (the goods really left).
    const challan = await prisma.challans.findFirst({
      where: { jobWorkOrderId: jwoId },
      include: { items: true },
    });
    expect(challan).not.toBeNull();
    expect(challan!.status).toBe('ISSUED');
    expect(challan!.items).toHaveLength(1);
    expect(challan!.items[0].greigeStockId).toBe(lotId);
    // It names the store the lot really left — never the made-up "Main Warehouse" (2026-09-25).
    expect(challan!.fromName).toBe(`${RUN} Warehouse`);
    expect(challan!.fromId).toBe(warehouseId);

    // The central ledger moved with the lot.
    const level = await prisma.stock_levels.findFirst({ where: { materialId: greigeMaterialId, warehouseId } });
    expect(Number(level!.quantity)).toBe(LOT_QTY - SEND_QTY);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.sentDate).not.toBeNull();
    expect(jwo!.jwoStatus).toBe('ISSUED');
    expect(jwo!.greigeStockLotId).toBe(lotId);
    expect(jwo!.outwardChallanId).toBe(challan!.id);
    // Current behaviour on the GENERIC issue path (see header) — flip to toBeTruthy() when the
    // generic path mints at issue like the Dyeing page does.
    expect(jwo!.finishedFabricId).toBeNull();
  });

  it('refuses a second issue of the same order', async () => {
    const res = await request(app)
      .post(`/api/job-work-orders/${jwoId}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_QTY }] });

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
      .send({ disposition: 'RETURNED_TO_STOCK', notes: 'Greige came back undyed' });
    expect(disposed.status).toBe(200);

    const lot = await prisma.greige_stock.findUnique({ where: { id: lotId } });
    expect(Number(lot!.quantityAvailable)).toBe(LOT_QTY);
    expect(Number(lot!.quantityConsumed)).toBe(0);
    expect(lot!.status).toBe('AVAILABLE');

    const returns = await prisma.greige_stock_transaction.findMany({
      where: { stockId: lotId, transactionType: 'RETURN' },
    });
    expect(returns).toHaveLength(1);
    expect(Number(returns[0].quantity)).toBe(SEND_QTY);

    const level = await prisma.stock_levels.findFirst({ where: { materialId: greigeMaterialId, warehouseId } });
    expect(Number(level!.quantity)).toBe(LOT_QTY);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('CANCELLED');
  });

  it("settles the order's greige reservation when the greige leaves for the dyer", async () => {
    // As MRP builds it: the greige is reserved on the MATERIAL requirement; the dyeing job is linked
    // to the PROCESSING requirement, which points back via linkedRequirementId. Until 2026-09-24 the
    // release matched only the job's own links, so the hold outlived the greige: DJ-ESSKY086LS-004
    // left lot 2726b4f2 showing 1,833.25 m reserved against 421.5 m on the shelf.
    const RESERVED = 600;
    const req = (suffix: string, extra: Record<string, unknown>) =>
      prisma.material_requirements.create({
        data: {
          id: randomUUID(),
          requirementNumber: `${RUN}-${suffix}`,
          source: 'WORK_ORDER',
          unit: 'METER',
          materialId: greigeMaterialId,
          orderQuantity: 1000,
          quantityPerUnit: 1,
          wastagePercent: 0,
          totalRequired: SEND_QTY,
          shortfall: 0,
          requiredDate: new Date(Date.now() + 30 * 86400000),
          createdById: userId,
          ...extra,
        },
      });
    const greigeReq = await req('G', { status: 'FULFILLED_STOCK', allocatedFromStock: RESERVED });
    const dyeReq = await req('P', {
      status: 'PENDING',
      requirementType: 'PROCESSING',
      linkedRequirementId: greigeReq.id,
    });
    await prisma.stock_reservations.create({
      data: {
        materialId: greigeMaterialId,
        warehouseId,
        reservationType: 'ORDER',
        referenceType: 'MATERIAL_REQUIREMENT',
        referenceId: greigeReq.id,
        referenceNumber: `${RUN}-G`,
        reservedQuantity: RESERVED,
        unit: 'METER',
        reservedById: userId,
        // A reservation names the lot it holds (allocateStock, 2026-09-26) — the issue gives back to it
        greigeStockId: lotId,
      },
    });
    await prisma.greige_stock.update({ where: { id: lotId }, data: { quantityReserved: RESERVED } });

    const created = await createJwo();
    expect(created.status).toBe(201);
    const jobId = created.body.data.id as string;
    await prisma.requirement_jwo_links.create({
      data: { requirementId: dyeReq.id, jobWorkOrderId: jobId, allocatedQuantity: SEND_QTY },
    });

    const res = await request(app)
      .post(`/api/job-work-orders/${jobId}/issue`)
      .set(authHeader)
      .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_QTY }] });
    expect(res.status).toBe(200);

    const lot = await prisma.greige_stock.findUnique({ where: { id: lotId } });
    expect(Number(lot!.quantityReserved)).toBe(0);
    const reservation = await prisma.stock_reservations.findFirst({ where: { referenceId: greigeReq.id } });
    expect(reservation!.status).toBe('CONSUMED');
  });
});
