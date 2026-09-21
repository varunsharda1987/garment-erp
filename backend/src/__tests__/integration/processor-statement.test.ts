/**
 * Processor Statement, end to end through the real endpoints (2026-09-21).
 *
 * The unit suite pins the arithmetic on hand-built events. This one pins the half nothing else
 * covers: that the LOADER finds those events in the database at all. Every figure here is reached
 * by driving the same endpoints a user drives — create, issue, receive in two parts, return
 * unprocessed — so a renamed relation or a changed `select` fails here instead of silently
 * producing an empty statement. (Building this feature, two such mistakes were caught only by
 * hand: `fabric_stock.fabricMaster` is not `.fabric`, and the supplier query schema rejected the
 * PROCESSOR meta-category before the service ever saw it.)
 *
 * The window arithmetic is the point, so the fixture deliberately spans two months: both jobs are
 * SENT in August and settle in September. A statement that cannot tell "sent before the window"
 * from "sent in it" reports the same cloth twice and reconciles against nothing.
 */

import request from 'supertest';
import { Unit } from '@prisma/client';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import greigeStockService from '../../services/greige-stock.service';
import { createChallan } from '../../services/challan.service';

const RUN = `PST${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let dyerId: string;
let greigeId: string;
let lotId: string;
let jwoA: string;
let jwoB: string;

const only = (id: string | undefined) => id ?? '__unset__';

const LOT_QTY = 2000;
const SEND_A = 1000;
const SEND_B = 500;
const SHRINKAGE_PCT = 10;
/** 1000 sent at 10% agreed -> 900 due back; both parts together meet it exactly. */
const PART_1 = 450;
const PART_2 = 450;

const SENT_ON = '2026-08-20';
const PART_1_ON = '2026-09-05';
const PART_2_ON = '2026-09-12';
const B_SENT_ON = '2026-09-02';
const B_RETURNED_ON = '2026-09-08';

const AUG = { periodStart: '2026-08-01', periodEnd: '2026-08-31' };
const SEP = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };

/** The one greige row in a statement section, whichever section it landed in. */
function greigeRow(body: { data: { sections: Array<{ kind: string; rows: unknown[] }> } }) {
  const section = body.data.sections.find((s) => s.kind === 'GREIGE');
  if (!section) throw new Error(`no GREIGE section: ${JSON.stringify(body.data.sections)}`);
  return section.rows[0] as {
    material: { code: string };
    opening: number;
    sent: number;
    received: number;
    returned: number;
    shrinkage: number;
    shortfall: number;
    closing: number;
    jobs: Array<{
      jobWorkNumber: string;
      sentQty: number;
      returned: number;
      shrinkage: number;
      shortfall: number;
      balance: number;
      agreedShrinkagePct: number | null;
      dueBack: number | null;
      challanNumbers: string[];
      receipts: Array<{ grnNumber: string; qty: number }>;
    }>;
  };
}

const statement = (query: Record<string, string>) =>
  request(app)
    .get('/api/job-work-statutory/processor-statement')
    .query({ processorId: dyerId, ...query })
    .set(authHeader);

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
      receivedDate: new Date('2026-08-01T00:00:00Z'),
      purchaseCost: 40,
      weightedAvgCost: 40,
      warehouseId,
      createdById: userId,
    },
  });
  lotId = lot.id;
  const greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, LOT_QTY, warehouseId, 'METER');

  // --- Job A: sent in August, comes back in two September deliveries -------------------------
  const createdA = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    quantity: SEND_A,
    agreedRate: 20,
    expectedShrinkage: SHRINKAGE_PCT,
    colorName: 'Navy',
  });
  if (createdA.status !== 201) throw new Error(`JWO-A create failed: ${JSON.stringify(createdA.body)}`);
  jwoA = createdA.body.data.id;

  const issuedA = await request(app)
    .post(`/api/job-work-orders/${jwoA}/issue`)
    .set(authHeader)
    .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_A }] });
  if (issuedA.status !== 200) throw new Error(`JWO-A issue failed: ${JSON.stringify(issuedA.body)}`);

  // Issue stamps sentDate = now. Backdate the job AND its outward challan: the statement dates
  // SENT from the challan line, and a receipt may not predate the send.
  await prisma.job_work_orders.update({ where: { id: jwoA }, data: { sentDate: new Date(`${SENT_ON}T00:00:00Z`) } });
  await prisma.challans.updateMany({
    where: { jobWorkOrderId: jwoA, challanType: 'OUTWARD' },
    data: { challanDate: new Date(`${SENT_ON}T00:00:00Z`), issuedDate: new Date(`${SENT_ON}T00:00:00Z`) },
  });

  const part1 = await request(app).post('/api/grn/jwo/receive').set(authHeader).send({
    jobWorkOrderId: jwoA,
    qtyReceivedMeters: PART_1,
    receivedDate: PART_1_ON,
    warehouseId,
    isFinal: false,
  });
  if (part1.status !== 201 && part1.status !== 200) {
    throw new Error(`part 1 receive failed: ${part1.status} ${JSON.stringify(part1.body)}`);
  }

  const part2 = await request(app).post('/api/grn/jwo/receive').set(authHeader).send({
    jobWorkOrderId: jwoA,
    qtyReceivedMeters: PART_2,
    receivedDate: PART_2_ON,
    warehouseId,
    isFinal: true,
  });
  if (part2.status !== 201 && part2.status !== 200) {
    throw new Error(`part 2 receive failed: ${part2.status} ${JSON.stringify(part2.body)}`);
  }

  // --- Job B: sent in September, the whole lot handed back unprocessed ------------------------
  const createdB = await request(app).post('/api/job-work-orders').set(authHeader).send({
    processType: 'DYEING',
    processorId: dyerId,
    quantity: SEND_B,
    agreedRate: 20,
    expectedShrinkage: SHRINKAGE_PCT,
    colorName: 'Black',
  });
  if (createdB.status !== 201) throw new Error(`JWO-B create failed: ${JSON.stringify(createdB.body)}`);
  jwoB = createdB.body.data.id;

  const issuedB = await request(app)
    .post(`/api/job-work-orders/${jwoB}/issue`)
    .set(authHeader)
    .send({ lots: [{ greigeStockLotId: lotId, qty: SEND_B }] });
  if (issuedB.status !== 200) throw new Error(`JWO-B issue failed: ${JSON.stringify(issuedB.body)}`);

  await prisma.job_work_orders.update({ where: { id: jwoB }, data: { sentDate: new Date(`${B_SENT_ON}T00:00:00Z`) } });
  await prisma.challans.updateMany({
    where: { jobWorkOrderId: jwoB, challanType: 'OUTWARD' },
    data: { challanDate: new Date(`${B_SENT_ON}T00:00:00Z`), issuedDate: new Date(`${B_SENT_ON}T00:00:00Z`) },
  });

  // The return is seeded through the same two writers the controller uses, NOT through
  // POST /api/dyeing/process-pos/:id/return-unprocessed — because that endpoint cannot succeed.
  // It guards on `job.status` (dyeing.controller.ts:2252, printing.controller.ts:2220), the legacy
  // JobWorkStatus column that was retired and dropped; the row only has `jwoStatus`. So the check
  // reads undefined, never matches AT_MILL, and refuses every job with "Job status is undefined".
  // Reported separately. What is pinned here is the STATEMENT's reading of a return, which must
  // keep working whichever door eventually writes one.
  await greigeStockService.returnGreigeStock(lotId, SEND_B, userId, undefined, {
    referenceType: 'JOB_WORK_ORDER',
    referenceId: jwoB,
    notes: `${RUN} unprocessed greige returned`,
  });
  const inward = await createChallan({
    challanType: 'INWARD',
    challanDate: new Date(`${B_RETURNED_ON}T00:00:00Z`),
    fromType: 'VENDOR',
    fromId: dyerId,
    fromName: `${RUN} Dyer`,
    toType: 'WAREHOUSE',
    toName: `${RUN} Warehouse`,
    jobWorkOrderId: jwoB,
    issuedById: userId,
    unit: Unit.METER,
    remarks: `${RUN} unprocessed greige returned`,
    items: [
      {
        itemType: 'GREIGE',
        greigeStockId: lotId,
        description: `${RUN} unprocessed greige returned`,
        quantity: SEND_B,
        unit: Unit.METER,
        jobWorkOrderId: jwoB,
      },
    ],
  });
  await prisma.job_work_orders.update({
    where: { id: jwoB },
    data: {
      inwardChallanId: inward.id,
      jwoStatus: 'CANCELLED',
      qtyReceivedMeters: 0,
      receivedDate: new Date(`${B_RETURNED_ON}T00:00:00Z`),
      remarks: `[RETURNED UNPROCESSED] ${SEND_B} meters returned`,
    },
  });
});

afterAll(async () => {
  // Per-step teardown, never one wrapping try/catch: a single catch once hid the first failing
  // delete and left 19 fake customers in the live dropdown.
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);

  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jwoIds } }, select: { id: true } })
  ).map((g) => g.id);
  const grnItemIds = (await prisma.grn_items.findMany({ where: { grnId: { in: grnIds } }, select: { id: true } })).map(
    (i) => i.id
  );

  // Lots booked by those receipts point back at the grn_item, so they go first.
  const mintedFabricIds = (
    await prisma.fabric_master.findMany({
      where: { OR: [{ fabricName: { contains: RUN } }, { greigeId: only(greigeId) }] },
      select: { id: true },
    })
  ).map((f) => f.id);
  const fabricLotIds = (
    await prisma.fabric_stock.findMany({
      where: { OR: [{ fabricId: { in: mintedFabricIds } }, { grnItemId: { in: grnItemIds } }] },
      select: { id: true },
    })
  ).map((l) => l.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLotIds } } });

  // Challans: both the outward issues and the inward ones the receipts/return filed.
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jwoIds } }, { grnId: { in: grnIds } }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });

  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });

  await prisma.job_work_order_components.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.greige_issue_details.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });

  await prisma.stock_movements.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedFabricIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.stock_levels.deleteMany({
    where: { materials: { OR: [{ fabricId: { in: mintedFabricIds } }, { greigeId: only(greigeId) }] } },
  });
  await prisma.materials.deleteMany({
    where: { OR: [{ fabricId: { in: mintedFabricIds } }, { greigeId: only(greigeId) }] },
  });
  await prisma.fabric_master.deleteMany({ where: { id: { in: mintedFabricIds } } });

  await prisma.greige_stock_transaction.deleteMany({ where: { stockId: only(lotId) } });
  await prisma.greige_stock_details.deleteMany({ where: { greigeStockId: only(lotId) } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('processor statement over the real endpoints', () => {
  it('finds the cloth in August, before any of it comes back', async () => {
    const res = await statement(AUG);
    expect(res.status).toBe(200);

    const row = greigeRow(res.body);
    expect(row.material.code).toBe(`${RUN}-GG`);
    expect(row.opening).toBe(0);
    expect(row.sent).toBe(SEND_A); // job B has not been sent yet
    expect(row.received).toBe(0);
    expect(row.closing).toBe(SEND_A);
  });

  it('carries August into September as opening rather than counting it as sent again', async () => {
    const res = await statement(SEP);
    expect(res.status).toBe(200);

    const row = greigeRow(res.body);
    expect(row.opening).toBe(SEND_A);
    expect(row.sent).toBe(SEND_B);
    expect(row.received).toBe(PART_1 + PART_2);
    expect(row.returned).toBe(SEND_B);
    // 1000 sent, nothing returned on A -> 100 is the agreed 10%, and 900 came back exactly
    expect(row.shrinkage).toBe(100);
    expect(row.shortfall).toBe(0);
    expect(row.closing).toBe(0);
  });

  it('lists both deliveries of a job received in parts, against their own GRNs', async () => {
    const res = await statement(SEP);
    const job = greigeRow(res.body).jobs.find((j) => j.sentQty === SEND_A);
    expect(job).toBeDefined();

    expect(job!.receipts).toHaveLength(2);
    expect(job!.receipts.map((r) => r.qty).sort()).toEqual([PART_1, PART_2]);
    expect(new Set(job!.receipts.map((r) => r.grnNumber)).size).toBe(2); // one GRN per part
    expect(job!.challanNumbers.length).toBeGreaterThan(0);
    expect(job!.agreedShrinkagePct).toBe(SHRINKAGE_PCT);
    expect(job!.dueBack).toBe(900);
    expect(job!.balance).toBe(0);
  });

  it('books an unprocessed return as returned, not as shrinkage', async () => {
    const res = await statement(SEP);
    const job = greigeRow(res.body).jobs.find((j) => j.sentQty === SEND_B);
    expect(job).toBeDefined();

    expect(job!.returned).toBe(SEND_B);
    // Nothing was processed, so nothing was lost — a cancelled job must not be charged shrinkage.
    expect(job!.shrinkage).toBe(0);
    expect(job!.shortfall).toBe(0);
    expect(job!.balance).toBe(0);
  });

  it('reads the same either side of the boundary — nothing falls between the months', async () => {
    const aug = greigeRow((await statement(AUG)).body);
    const sep = greigeRow((await statement(SEP)).body);
    expect(aug.closing).toBe(sep.opening);
  });

  it('refuses a backwards period and an unknown processor', async () => {
    const backwards = await statement({ periodStart: '2026-09-30', periodEnd: '2026-09-01' });
    expect(backwards.status).toBe(400);

    const unknown = await request(app)
      .get('/api/job-work-statutory/processor-statement')
      .query({ processorId: '00000000-0000-0000-0000-000000000000', ...SEP })
      .set(authHeader);
    expect(unknown.status).toBe(404);
  });

  it('prints the same period as a PDF', async () => {
    const res = await statement({ ...SEP, format: 'pdf' });
    // The renderer needs Chrome; where it is unavailable the endpoint is still expected to fail
    // loudly rather than return an empty 200, so only a real success is asserted on.
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    } else {
      expect(res.status).toBeGreaterThanOrEqual(500);
    }
  });
});
