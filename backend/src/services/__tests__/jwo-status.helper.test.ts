/**
 * jwo-status.helper — pins the JWO status contract.
 *
 * jwoStatus is the single source of truth for job work order status.
 * The legacy `status` column has been retired.
 */

import {
  setJwoStatus,
  setJwoStatusMany,
  JWO_ACTIVE_FILTER,
  isJwoDead,
  JWO_PRE_ISSUE_STATUSES,
  JWO_AT_PROCESSOR_STATUSES,
  JWO_RECEIVED_STATUSES,
} from '../helpers/jwo-status.helper';
import prisma from '../../config/database';
import { only } from '../../utils/prisma-test-guard';

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
        jwoStatus: 'DRAFT',
        uom: 'MTR',
        createdById: testUserId,
      },
    });
    jwoId = jwo.id;
  });

  afterEach(async () => {
    await prisma.job_work_orders.deleteMany({ where: { id: only(jwoId) } });
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

  it('setJwoStatus updates jwoStatus', async () => {
    await setJwoStatus(prisma, jwoId, 'CANCELLED', { remarks: '[CANCELLED] test' });

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('CANCELLED');
  });

  it('setJwoStatus can set ISSUED and RECEIVED with receivedDate', async () => {
    await setJwoStatus(prisma, jwoId, 'ISSUED');
    let jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('ISSUED');

    await setJwoStatus(prisma, jwoId, 'RECEIVED', { receivedDate: new Date() });
    jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('RECEIVED');
    expect(jwo!.receivedDate).not.toBeNull();
  });

  it('setJwoStatus can set PARTIALLY_RECEIVED', async () => {
    await setJwoStatus(prisma, jwoId, 'ISSUED');
    await setJwoStatus(prisma, jwoId, 'PARTIALLY_RECEIVED');

    const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId } });
    expect(jwo!.jwoStatus).toBe('PARTIALLY_RECEIVED');
  });

  it('JWO_ACTIVE_FILTER drops cancelled orders from receivable-shaped queries', async () => {
    await setJwoStatus(prisma, jwoId, 'ISSUED');

    const receivableBefore = await prisma.job_work_orders.findMany({
      where: { id: jwoId, jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES }, AND: [JWO_ACTIVE_FILTER] },
    });
    expect(receivableBefore).toHaveLength(1);

    await setJwoStatus(prisma, jwoId, 'CANCELLED');
    const receivableAfter = await prisma.job_work_orders.findMany({
      where: { id: jwoId, jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES }, AND: [JWO_ACTIVE_FILTER] },
    });
    expect(receivableAfter).toHaveLength(0);
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

  it('status groups cover the expected values', () => {
    expect(JWO_PRE_ISSUE_STATUSES).toContain('DRAFT');
    expect(JWO_PRE_ISSUE_STATUSES).toContain('PENDING_APPROVAL');
    expect(JWO_PRE_ISSUE_STATUSES).toContain('APPROVED');
    expect(JWO_PRE_ISSUE_STATUSES).toHaveLength(3);

    expect(JWO_AT_PROCESSOR_STATUSES).toContain('ISSUED');
    expect(JWO_AT_PROCESSOR_STATUSES).toContain('IN_TRANSIT');
    expect(JWO_AT_PROCESSOR_STATUSES).toContain('AT_PROCESSOR');
    expect(JWO_AT_PROCESSOR_STATUSES).toContain('PARTIALLY_RECEIVED');
    expect(JWO_AT_PROCESSOR_STATUSES).toHaveLength(4);

    expect(JWO_RECEIVED_STATUSES).toContain('RECEIVED');
    expect(JWO_RECEIVED_STATUSES).toContain('QUALITY_CHECKED');
    expect(JWO_RECEIVED_STATUSES).toContain('STOCK_UPDATED');
    expect(JWO_RECEIVED_STATUSES).toHaveLength(3);
  });

  it('isJwoDead identifies terminal statuses', () => {
    expect(isJwoDead('CANCELLED')).toBe(true);
    expect(isJwoDead('CLOSED')).toBe(true);
    expect(isJwoDead('ISSUED')).toBe(false);
    expect(isJwoDead('DRAFT')).toBe(false);
    expect(isJwoDead(null)).toBe(false);
  });
});
