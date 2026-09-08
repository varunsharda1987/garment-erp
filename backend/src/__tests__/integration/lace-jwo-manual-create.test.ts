/**
 * A lace dyeing job work order can be raised by hand (2026-09-08).
 *
 * Before this, `job_work_orders` could only name a fabric, so paying a lace dyer meant either a
 * processing batch (a tracking record with no GST and no payable) or a fabric JWO pointing at the
 * wrong material. A lace job carries its own identity on the header — the greige lace SENT and the
 * dyed variant expected BACK — because a manual job has no requirement chain to derive them from.
 *
 * The pair is validated at creation because nothing downstream can recover from a mismatch: issue
 * would consume lots of a lace the dyer was never sent, and receipt would stock a colour nobody
 * ordered.
 *
 * Billing basis (confirmed with the business 2026-09-08): the dyer bills per metre RETURNED, so
 * `qtyBillable` is the shrunk quantity, exactly as for cloth.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `LJC${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let dyerId: string;
let greigeLaceId: string;
let dyedLaceId: string;
let otherGreigeLaceId: string;
let strayVariantId: string;
let fabricId: string;

const only = (id: string | undefined) => id ?? '__unset__';
const createdJwoIds: string[] = [];

/** 1,000 greige metres out at 10% shrinkage = 900 dyed metres back, which is what gets billed. */
const QTY_SENT = 1000;
const SHRINKAGE = 10;
const EXPECTED_BACK = 900;

const createJwo = (body: Record<string, unknown>) =>
  request(app).post('/api/job-work-orders').set(authHeader).send(body);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

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
      expectedShrinkagePercent: SHRINKAGE,
      costPerMeterGreige: 40,
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

  // A second greige with its own variant — the material a mismatched pair would smuggle in.
  const otherGreige = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-GL2`,
      laceName: `${RUN} Greige Net`,
      isGreige: true,
      laceType: 'Net',
      width: 1,
    },
  });
  otherGreigeLaceId = otherGreige.id;

  const stray = await prisma.lace_master.create({
    data: {
      laceCode: `${RUN}-DL2`,
      laceName: `${RUN} Navy Net`,
      isGreige: false,
      color: 'Navy',
      sourceGreigeLaceId: otherGreigeLaceId,
      laceType: 'Net',
      width: 1,
    },
  });
  strayVariantId = stray.id;

  const fabric = await prisma.fabric_master.create({
    data: {
      fabricCode: `${RUN}-FAB`,
      fabricName: `${RUN} Fabric`,
      createdById: userId,
    },
  });
  fabricId = fabric.id;
});

afterAll(async () => {
  // By processor, not by collected id: a failing assertion aborts before the id is recorded,
  // and a JWO left behind blocks the supplier delete below.
  await prisma.job_work_orders.deleteMany({ where: { processorId: only(dyerId) } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: createdJwoIds.filter(Boolean) } } });
  await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
  await prisma.materials.deleteMany({
    where: { laceId: { in: [only(greigeLaceId), only(dyedLaceId), only(otherGreigeLaceId), only(strayVariantId)] } },
  });
  await prisma.lace_master.deleteMany({
    where: { id: { in: [only(dyedLaceId), only(strayVariantId)] } },
  });
  await prisma.lace_master.deleteMany({
    where: { id: { in: [only(greigeLaceId), only(otherGreigeLaceId)] } },
  });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('manual lace dyeing job work order', () => {
  it('creates a LACE job that bills on the metres returned', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId,
      finishedLaceId: dyedLaceId,
      quantity: QTY_SENT,
      agreedRate: 20,
      expectedShrinkage: SHRINKAGE,
    });

    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(jwo).not.toBeNull();
    // LACE, not GREIGE: dyeing is a FABRIC-category process, but this job handles lace lots.
    expect(jwo!.fabricType).toBe('LACE');
    expect(jwo!.greigeLaceId).toBe(greigeLaceId);
    expect(jwo!.finishedLaceId).toBe(dyedLaceId);
    expect(jwo!.fabricId).toBeNull();
    expect(Number(jwo!.qtySentMeters)).toBe(QTY_SENT);
    // Billed on what comes back, exactly as a cloth dyer is.
    expect(Number(jwo!.qtyBillable)).toBeCloseTo(EXPECTED_BACK, 2);
    expect(Number(jwo!.subtotal)).toBeCloseTo(EXPECTED_BACK * 20, 2);
    // The variant already knows its shade; it prints on the challan as the instruction.
    expect(jwo!.colorName).toBe('Navy');
  });

  it("falls back to the greige master's own expected loss when no shrinkage is typed", async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId,
      finishedLaceId: dyedLaceId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(201);
    createdJwoIds.push(res.body.data.id);

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: res.body.data.id } });
    expect(Number(jwo!.expectedShrinkage)).toBeCloseTo(SHRINKAGE, 2);
    expect(Number(jwo!.qtyBillable)).toBeCloseTo(EXPECTED_BACK, 2);
  });

  it('refuses a dyed variant that did not come from the greige being sent', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId,
      finishedLaceId: strayVariantId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/not a dyed variant/i);
  });

  it('refuses a greige lace in the finished slot', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId,
      finishedLaceId: otherGreigeLaceId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(422);
  });

  it('refuses a dyed lace in the greige slot', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId: dyedLaceId,
      finishedLaceId: dyedLaceId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/not a greige lace/i);
  });

  it('refuses half a pair — one end alone leaves issue or receipt with no material', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(400);
  });

  it('refuses lace on a process type that is not dyeing', async () => {
    const res = await createJwo({
      processType: 'PRINTING',
      processorId: dyerId,
      greigeLaceId,
      finishedLaceId: dyedLaceId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(400);
  });

  it('refuses a job that carries both a lace and a fabric', async () => {
    const res = await createJwo({
      processType: 'DYEING',
      processorId: dyerId,
      greigeLaceId,
      finishedLaceId: dyedLaceId,
      fabricId,
      quantity: QTY_SENT,
      agreedRate: 20,
    });

    expect(res.status).toBe(400);
  });
});
