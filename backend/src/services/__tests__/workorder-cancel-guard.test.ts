/**
 * Landmine №10 — a cancelled work order must not be resurrected by production tracking.
 *
 * The old auto-start guard used `!actualStartDate` as a "production hasn't started" proxy;
 * a WO cancelled before starting also has an empty start date, so one stray cutting entry
 * flipped it back to IN_PRODUCTION with nothing to re-cancel it. Now: tracking inserts are
 * refused on CANCELLED work orders, and the auto-start status flip is PENDING-only.
 */

import workOrderService from '../workOrder.service';
import prisma from '../../config/database';
import { randomUUID } from 'crypto';
import { only } from '../../utils/prisma-test-guard';

describe('workOrder.addProductionTracking cancel guard', () => {
  const RUN = `TWOC${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let styleId: string;
  let n = 0;

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

    const style = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode: `${RUN}-STYLE`,
        styleName: `${RUN} Style`,
        createdById: testUserId,
      },
    });
    styleId = style.id;
  });

  afterAll(async () => {
    try {
      await prisma.production_tracking.deleteMany({
        where: { work_orders: { workOrderNumber: { startsWith: RUN } } },
      });
      await prisma.work_orders.deleteMany({ where: { workOrderNumber: { startsWith: RUN } } });
      await prisma.styles.deleteMany({ where: { id: only(styleId) } });
      await prisma.users.deleteMany({ where: { id: only(testUserId) } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  function createWo(status: 'PENDING' | 'CANCELLED' | 'COMPLETED') {
    n += 1;
    return prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: `${RUN}-${n}`,
        styleId,
        plannedStartDate: new Date(),
        plannedEndDate: new Date(),
        totalQuantity: 100,
        status,
        createdById: testUserId,
      },
    });
  }

  function track(workOrderId: string) {
    // isAdminOverride bypasses stage-blocking validation — this suite pins the status
    // guard, not the stage gates
    return workOrderService.addProductionTracking(
      {
        workOrderId,
        productionStage: 'CUTTING' as any,
        quantityCompleted: 10,
        updatedById: testUserId,
      } as any,
      true
    );
  }

  it('refuses a tracking entry on a CANCELLED work order (the resurrection pin)', async () => {
    const wo = await createWo('CANCELLED');

    await expect(track(wo.id)).rejects.toThrow(/CANCELLED/);

    const after = await prisma.work_orders.findUnique({ where: { id: wo.id } });
    expect(after!.status).toBe('CANCELLED');
    expect(after!.actualStartDate).toBeNull();
    const rows = await prisma.production_tracking.count({ where: { workOrderId: wo.id } });
    expect(rows).toBe(0);
  });

  it('cutting on a PENDING work order starts production (unchanged behavior)', async () => {
    const wo = await createWo('PENDING');

    await track(wo.id);

    const after = await prisma.work_orders.findUnique({ where: { id: wo.id } });
    expect(after!.status).toBe('IN_PRODUCTION');
    expect(after!.actualStartDate).not.toBeNull();
  });

  it('a COMPLETED work order never steps back to IN_PRODUCTION', async () => {
    const wo = await createWo('COMPLETED'); // legacy edge: completed with no start date

    await track(wo.id);

    const after = await prisma.work_orders.findUnique({ where: { id: wo.id } });
    expect(after!.status).toBe('COMPLETED');
    expect(after!.actualStartDate).not.toBeNull(); // start date backfilled, status untouched
  });
});
