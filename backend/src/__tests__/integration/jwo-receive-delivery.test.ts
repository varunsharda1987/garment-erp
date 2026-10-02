/**
 * One delivery from a processor, every colour it brought, in one action (2026-10-02 — the Receive page).
 *
 * The printer sends ONE challan and ONE bill for a truck carrying Brown and Red. POST /api/grn/jwo/receive-delivery
 * takes the truck's details once and a row per job line; each row files its own receipt (lot, inward challan, its
 * own orders credited) and all of them commit together or not at all.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../../services/helpers/material-sync.helper';
import { createJobWorkOrderWithLines } from '../../services/helpers/jwo-lines.helper';

const RUN = `RDL${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let authHeader: Record<string, string>;
let warehouseId: string;
let printerId: string;
let nextProcessorId: string;
let nextUnitId: string;
let greigeId: string;
let greigeMaterialId: string;
let lotId: string;
let styleA: string;
let styleB: string;

interface Job {
  id: string;
  lineIds: string[];
  requirementIds: string[];
}

let job: Job;

/** A printing job at the printer, greige sent all at once; one line per [colour, style, expected] */
const mkJob = async (suffix: string, spec: Array<[string, string, number]>): Promise<Job> => {
  const requirementIds: string[] = [];
  for (const [colorName, , expected] of spec) {
    requirementIds.push(
      (
        await prisma.material_requirements.create({
          data: {
            requirementNumber: `${RUN}-MR-${suffix}-${colorName}`,
            source: 'MANUAL',
            requirementType: 'PROCESSING',
            materialId: greigeMaterialId,
            orderQuantity: 100,
            quantityPerUnit: 1,
            wastagePercent: 0,
            totalRequired: expected,
            shortfall: expected,
            unit: 'METER',
            status: 'PO_SENT',
            colorName,
            requiredDate: new Date(),
            createdById: userId,
          },
        })
      ).id
    );
  }
  const created = await prisma.$transaction((tx) =>
    createJobWorkOrderWithLines(
      tx,
      {
        jobWorkNumber: `${RUN}-${suffix}`,
        processType: 'PRINTING',
        processorId: printerId,
        agreedRatePerMeter: 20,
        tolerancePercent: 3,
        uom: 'MTR',
        fabricType: 'GREIGE',
        jwoStatus: 'AT_PROCESSOR',
        greigeStockLotId: lotId,
        sentDate: new Date('2026-09-05T00:00:00Z'),
        createdById: userId,
      },
      spec.map(([colorName, styleId, expected], i) => ({
        styleId,
        colorName,
        sentWidthInches: 54,
        expectedShrinkage: 10,
        qtySent: Math.round((expected / 0.9) * 100) / 100,
        qtyExpected: expected,
        requirementLinks: [{ requirementId: requirementIds[i], allocatedQuantity: expected }],
      }))
    )
  );
  const lines = await prisma.job_work_order_lines.findMany({
    where: { jobWorkOrderId: created.id },
    orderBy: { lineNo: 'asc' },
  });
  return { id: created.id, lineIds: lines.map((l) => l.id), requirementIds };
};

const deliver = (j: Job, body: Record<string, unknown>) =>
  request(app)
    .post('/api/grn/jwo/receive-delivery')
    .set(authHeader)
    .send({
      jobWorkOrderId: j.id,
      warehouseId,
      receivedDate: '2026-09-20',
      receivedChallan: 'PC-771',
      invoiceToFollow: true,
      ...body,
    });

const receiptsOf = (jobId: string) =>
  prisma.goods_receiving_notes.findMany({
    where: { jobWorkOrderId: jobId },
    include: { grn_items: true },
    orderBy: { grnNumber: 'asc' },
  });
const credited = async (j: Job) =>
  (
    await prisma.requirement_jwo_links.findMany({
      where: { jobWorkOrderId: j.id },
      orderBy: { lineId: 'asc' },
      select: { requirementId: true, receivedQuantity: true },
    })
  ).reduce<Record<string, number>>((m, l) => ({ ...m, [l.requirementId]: Number(l.receivedQuantity) }), {});

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
  const mkSupplier = async (code: string) =>
    (
      await prisma.suppliers.create({
        data: {
          code: `${RUN}-${code}`,
          name: `${RUN} ${code}`,
          supplierCategories: ['DYEING_PRINTING'],
          isActive: true,
          createdById: userId,
        },
      })
    ).id;
  printerId = await mkSupplier('PRN');
  nextProcessorId = await mkSupplier('EMB');
  nextUnitId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-EMBU`,
        warehouseName: `${RUN} EMB - Processing Unit`,
        warehouseType: 'JOB_WORK',
        supplierId: nextProcessorId,
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: `${RUN} Crepe`,
        genericGreigeName: `${RUN} Crepe`,
        composition: '100% Viscose',
        greigeWidth: 71,
        createdById: userId,
      },
    })
  ).id;
  lotId = (
    await prisma.greige_stock.create({
      data: {
        greigeId,
        quantityAvailable: 0,
        quantityConsumed: 5000,
        greigeWidth: 71,
        receivedDate: new Date('2026-09-01T00:00:00Z'),
        purchaseCost: 50,
        weightedAvgCost: 50,
        warehouseId,
        createdById: userId,
      },
    })
  ).id;
  greigeMaterialId = await ensureMaterialRecord(greigeId, 'GREIGE');
  await syncStockLevelQuantity(greigeMaterialId, 0, warehouseId, 'METER');

  const mkStyle = async (suffix: string) =>
    (
      await prisma.styles.create({
        data: { id: randomUUID(), styleCode: `${RUN}${suffix}`, styleName: `${RUN} ${suffix}`, createdById: userId },
      })
    ).id;
  styleA = await mkStyle('A');
  styleB = await mkStyle('B');

  job = await mkJob('J1', [
    ['Brown', styleA, 900],
    ['Red', styleB, 450],
  ]);
});

afterAll(async () => {
  const jobIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(printerId) }, select: { id: true } })
  ).map((j) => j.id);
  const grnIds = (
    await prisma.goods_receiving_notes.findMany({ where: { jobWorkOrderId: { in: jobIds } }, select: { id: true } })
  ).map((g) => g.id);
  await prisma.audit_logs.deleteMany({ where: { entityId: { in: grnIds } } });
  const challanIds = (
    await prisma.challans.findMany({
      where: { OR: [{ jobWorkOrderId: { in: jobIds } }, { grnId: { in: grnIds } }] },
      select: { id: true },
    })
  ).map((c) => c.id);
  await prisma.challan_items.deleteMany({ where: { challanId: { in: challanIds } } });
  await prisma.challans.deleteMany({ where: { id: { in: challanIds } } });
  const fabricIds = (
    await prisma.fabric_master.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((f) => f.id);
  const fabricLotIds = (
    await prisma.fabric_stock.findMany({ where: { fabricId: { in: fabricIds } }, select: { id: true } })
  ).map((l) => l.id);
  await prisma.fabric_stock_transaction.deleteMany({ where: { stockId: { in: fabricLotIds } } });
  await prisma.fabric_stock.deleteMany({ where: { id: { in: fabricLotIds } } });
  await prisma.grn_items.deleteMany({ where: { grnId: { in: grnIds } } });
  await prisma.goods_receiving_notes.deleteMany({ where: { id: { in: grnIds } } });
  await prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: { in: jobIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.material_requirements.deleteMany({ where: { requirementNumber: { startsWith: RUN } } });
  const materialWhere = { OR: [{ fabricId: { in: fabricIds } }, { greigeId: only(greigeId) }] };
  await prisma.stock_movements.deleteMany({ where: { materials: materialWhere } });
  await prisma.stock_levels.deleteMany({ where: { materials: materialWhere } });
  await prisma.materials.deleteMany({ where: materialWhere });
  await prisma.style_fabrics.updateMany({ where: { fabricId: { in: fabricIds } }, data: { fabricId: null } });
  await prisma.fabric_master.deleteMany({ where: { id: { in: fabricIds } } });
  await prisma.greige_stock.deleteMany({ where: { id: only(lotId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.styles.deleteMany({ where: { id: { in: [only(styleA), only(styleB)] } } });
  await prisma.warehouses.deleteMany({ where: { id: { in: [only(warehouseId), only(nextUnitId)] } } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(printerId), only(nextProcessorId)] } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('one delivery, every colour it brought, in one action', () => {
  const key = randomUUID();

  it('files one receipt per colour — each its own fabric, style, lot, inward challan and order — in one press', async () => {
    const res = await deliver(job, {
      submissionKey: key,
      lines: [
        { lineId: job.lineIds[1], qtyReceivedMeters: 200, receivedWidthInches: 55, isFinal: false },
        { lineId: job.lineIds[0], qtyReceivedMeters: 880, receivedWidthInches: 54.5, isFinal: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(res.body.data.receipts).toHaveLength(2);
    expect(res.body.data.jobClosed).toBe(false);

    const receipts = await receiptsOf(job.id);
    expect(receipts).toHaveLength(2);
    // In line order: Brown (line 1) first
    expect(receipts.map((r) => r.grn_items[0].jobWorkOrderLineId)).toEqual(job.lineIds);
    // The printer's ONE challan and the bill-to-follow on both
    for (const r of receipts) {
      expect(r.remarks).toMatch(/Vendor challan ref: PC-771/);
      expect(r.invoiceNumber).toBeNull();
      expect(r.status).toBe('ACCEPTED');
    }
    expect(receipts.map((r) => r.submissionKey)).toEqual([`${key}:1`, `${key}:2`]);

    const lots = await prisma.fabric_stock.findMany({
      where: { grnItemId: { in: receipts.map((r) => r.grn_items[0].id) } },
    });
    expect(lots).toHaveLength(2);
    expect(new Set(lots.map((l) => l.fabricId)).size).toBe(2);
    expect(lots.map((l) => l.originStyleId).sort()).toEqual([styleA, styleB].sort());
    expect(
      await prisma.challans.count({ where: { grnId: { in: receipts.map((r) => r.id) }, challanType: 'INWARD' } })
    ).toBe(2);

    const c = await credited(job);
    expect(c[job.requirementIds[0]]).toBe(880);
    expect(c[job.requirementIds[1]]).toBe(200);
    const j = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(Number(j.qtyReceivedMeters)).toBe(1080);
    expect((await prisma.job_work_order_lines.findUniqueOrThrow({ where: { id: job.lineIds[0] } })).closedHow).toBe(
      'FINAL'
    );
  });

  it('the same delivery sent again answers with the receipts already filed — nothing booked twice', async () => {
    const res = await deliver(job, {
      submissionKey: key,
      lines: [
        { lineId: job.lineIds[1], qtyReceivedMeters: 200, receivedWidthInches: 55, isFinal: false },
        { lineId: job.lineIds[0], qtyReceivedMeters: 880, receivedWidthInches: 54.5, isFinal: true },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
    expect(res.body.data.receipts).toHaveLength(2);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: job.id } })).toBe(2);
  });

  it('one bill that follows goes on every receipt of the truck with one "Add invoice"', async () => {
    const [first, second] = await receiptsOf(job.id);
    const res = await request(app)
      .patch(`/api/grn/${first.id}/invoice`)
      .set(authHeader)
      .send({ invoiceNumber: 'MT/2026/118', invoiceDate: '2026-09-21' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain(second.grnNumber);
    const after = await receiptsOf(job.id);
    expect(after.map((r) => r.invoiceNumber)).toEqual(['MT/2026/118', 'MT/2026/118']);
  });

  it('refuses the whole delivery when one colour is over its maximum — nothing is written for either', async () => {
    const before = await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: job.id } });
    const res = await deliver(job, {
      submissionKey: randomUUID(),
      lines: [{ lineId: job.lineIds[1], qtyReceivedMeters: 900, receivedWidthInches: 55, isFinal: false }],
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/exceeds the expected fabric 450\.00/);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: job.id } })).toBe(before);
  });

  it('refuses a closed colour in a delivery, and a colour entered twice', async () => {
    const closed = await deliver(job, {
      submissionKey: randomUUID(),
      lines: [{ lineId: job.lineIds[0], qtyReceivedMeters: 5, receivedWidthInches: 55 }],
    });
    expect(closed.status).toBe(422);
    expect(closed.body.message).toMatch(/already closed/);

    const twice = await deliver(job, {
      submissionKey: randomUUID(),
      lines: [
        { lineId: job.lineIds[1], qtyReceivedMeters: 5, receivedWidthInches: 55 },
        { lineId: job.lineIds[1], qtyReceivedMeters: 5, receivedWidthInches: 55 },
      ],
    });
    expect(twice.status).toBe(400);
  });

  it('the last colour short closes the job only once confirmed — refused with nothing written first', async () => {
    const row = { lineId: job.lineIds[1], qtyReceivedMeters: 100, receivedWidthInches: 55, isFinal: true };
    const before = await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: job.id } });
    const refused = await deliver(job, { submissionKey: randomUUID(), lines: [row] });
    expect(refused.status).toBe(422);
    expect(refused.body.details.reason).toBe('SHORT_CLOSE_UNCONFIRMED');
    expect(refused.body.details.cumulative).toBe(1180);
    expect(await prisma.goods_receiving_notes.count({ where: { jobWorkOrderId: job.id } })).toBe(before);

    const res = await deliver(job, { submissionKey: randomUUID(), shortCloseConfirmed: true, lines: [row] });
    expect(res.status).toBe(201);
    expect(res.body.data.jobClosed).toBe(true);
    const j = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.jwoStatus).toBe('STOCK_UPDATED');
    expect(Number(j.qtyAbnormalLoss)).toBeGreaterThan(0);
    expect((await credited(job))[job.requirementIds[1]]).toBe(300);
  });

  it('delivered straight to another processor: each colour is booked at their unit with its own onward challan', async () => {
    const j2 = await mkJob('J2', [
      ['Brown', styleA, 300],
      ['Red', styleB, 300],
    ]);
    const res = await deliver(j2, {
      submissionKey: randomUUID(),
      warehouseId: nextUnitId,
      deliveredToProcessor: true,
      vehicleNumber: 'RJ14 AB 1234',
      lines: [
        { lineId: j2.lineIds[0], qtyReceivedMeters: 290, receivedWidthInches: 54, isFinal: true },
        { lineId: j2.lineIds[1], qtyReceivedMeters: 295, receivedWidthInches: 54, isFinal: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.onwardChallans).toHaveLength(2);
    const receipts = await receiptsOf(j2.id);
    const lots = await prisma.fabric_stock.findMany({
      where: { grnItemId: { in: receipts.map((r) => r.grn_items[0].id) } },
    });
    expect(lots.map((l) => l.warehouseId)).toEqual([nextUnitId, nextUnitId]);
  });

  it('a one-colour job comes through the same door, with the one row', async () => {
    const j3 = await mkJob('J3', [['Navy', styleA, 500]]);
    const res = await deliver(j3, {
      submissionKey: randomUUID(),
      invoiceToFollow: false,
      invoiceNumber: 'MT/2026/120',
      invoiceDate: '2026-09-20',
      lines: [{ lineId: j3.lineIds[0], qtyReceivedMeters: 490, receivedWidthInches: 54, isFinal: true }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.jobClosed).toBe(true);
    const [receipt] = await receiptsOf(j3.id);
    expect(receipt.invoiceNumber).toBe('MT/2026/120');
  });
});
