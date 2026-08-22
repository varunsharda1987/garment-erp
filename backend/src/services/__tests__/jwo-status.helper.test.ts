/**
 * jwo-status.helper — pins the two-column JWO status contract (landmine №1 fix).
 *
 * jwoStatus is the single source of truth; the legacy `status` column is a derived mirror
 * written only through setJwoStatus/setJwoStatusMany. A cancel must land in BOTH columns,
 * and JWO_ACTIVE_FILTER must drop cancelled orders from receivable-shaped queries — the
 * exact hole that let a cancelled job's returned rolls be received again (double stock).
 */

import {
  setJwoStatus,
  setJwoStatusMany,
  JWO_ACTIVE_FILTER,
  JWO_TO_LEGACY_STATUS,
  isJwoDead,
} from '../helpers/jwo-status.helper';
import prisma from '../../config/database';

describe('jwo-status.helper', () => {
  const RUN = `TJWS${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let processorId: string;
  let jwoId: string;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: `${RUN.toLowerCase()}@test.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;

    const processor = await prisma.suppliers.create({
      data: {
        code: `${RUN}-PROC`,
        name: `${RUN} Processor`,
        createdById: testUserId,
      },
    });
    processorId = processor.id;
  });

  beforeEach(async () => {
    const jwo = await prisma.job_work_orders.create({
      data: {
        jobWorkNumber: `${RUN}-${Date.now().toString(36)}`,
        processorId,
        processType: 'DYEING',
        qtySentMeters: 100,
        agreedRatePerMeter: 10,
        status: 'READY_TO_SEND',
        jwoStatus: 'DRAFT',
        uom: 'MTR',
        createdById: testUserId,
      },
    });
    jwoId = jwo.id;
  });

  afterEach(async () => {
    await prisma.job_work_orders.deleteMany({ where: { id: jwoId } });
  });

  afterAll(async () => {
    try {
      await prisma.job_work_orders.deleteMany({ where: { jobWorkNumber: { startsWith: RUN } } });
      await prisma.suppliers.deleteMany({ where: { code: { startsWith: RUN } } });
      await prisma.users.deleteMany({ where: { email: `${RUN.toLowerCase()}@test.com` } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  it('CANCELLED lands in BOTH columns (the incident: legacy used to stay READY_TO_SEND)', async () => {
    await setJwoStatus(prisma, jwoId, 'CANCELLED', { remarks: '[CANCELLED] test' });

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('CANCELLED');
    expect(jwo!.status).toBe('CANCELLED');
  });

  it('ISSUED mirrors legacy AT_MILL; RECEIVED mirrors RECEIVED', async () => {
    await setJwoStatus(prisma, jwoId, 'ISSUED');
    let jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.status).toBe('AT_MILL');

    await setJwoStatus(prisma, jwoId, 'RECEIVED', { receivedDate: new Date() });
    jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.status).toBe('RECEIVED');
    expect(jwo!.receivedDate).not.toBeNull();
  });

  it('PARTIALLY_RECEIVED leaves the legacy column untouched (external-process convention)', async () => {
    await setJwoStatus(prisma, jwoId, 'ISSUED');
    await setJwoStatus(prisma, jwoId, 'PARTIALLY_RECEIVED');

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
    expect(jwo!.status).toBe('AT_MILL'); // unchanged until fully received
  });

  it('JWO_ACTIVE_FILTER drops cancelled orders from receivable-shaped queries', async () => {
    // Shape of getReceivable / the at-mill dashboards: legacy filter + active filter
    await setJwoStatus(prisma, jwoId, 'ISSUED');

    const receivableBefore = await prisma.job_work_orders.findMany({
      where: { id: jwoId, status: { in: ['AT_MILL', 'SENT_TO_MILL'] }, AND: [JWO_ACTIVE_FILTER] },
    });
    expect(receivableBefore).toHaveLength(1);

    await setJwoStatus(prisma, jwoId, 'CANCELLED');
    const receivableAfter = await prisma.job_work_orders.findMany({
      where: { id: jwoId, status: { in: ['AT_MILL', 'SENT_TO_MILL'] }, AND: [JWO_ACTIVE_FILTER] },
    });
    expect(receivableAfter).toHaveLength(0);

    // NULL jwoStatus (legacy-only creates) must still pass the filter
    await prisma.job_work_orders.update({ where: { id: jwoId }, data: { jwoStatus: null, status: 'AT_MILL' } });
    const legacyRows = await prisma.job_work_orders.findMany({
      where: { id: jwoId, status: { in: ['AT_MILL', 'SENT_TO_MILL'] }, AND: [JWO_ACTIVE_FILTER] },
    });
    expect(legacyRows).toHaveLength(1);
  });

  it('setJwoStatusMany enforces its guard (count 0 when the where excludes the row)', async () => {
    await setJwoStatus(prisma, jwoId, 'CANCELLED');

    const result = await setJwoStatusMany(
      prisma,
      { id: jwoId, receivedDate: null, AND: [JWO_ACTIVE_FILTER] },
      'RECEIVED'
    );
    expect(result.count).toBe(0); // a cancelled order cannot be force-received

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('CANCELLED');
  });

  it('mapping table stays total over the enum', () => {
    // Compile-time Record<> already enforces this; the runtime assertion guards enum growth
    const values = Object.keys(JWO_TO_LEGACY_STATUS);
    expect(values).toContain('CANCELLED');
    expect(values).toHaveLength(12);
    expect(isJwoDead('CANCELLED')).toBe(true);
    expect(isJwoDead('CLOSED')).toBe(true);
    expect(isJwoDead('ISSUED')).toBe(false);
    expect(isJwoDead(null)).toBe(false);
  });
});
