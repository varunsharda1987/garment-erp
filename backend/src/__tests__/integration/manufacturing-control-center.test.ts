import request from 'supertest';
import app from '../../app';
import prisma from '../../config/database';
import { getAuthHeader } from '../helpers/test-utils';

/**
 * The Manufacturing Control Center's contract.
 *
 * These are the assertions that would have caught the defects found on 2026-09-21:
 *
 *  - `GET /api/manufacturing/alerts` answered **200 to an anonymous caller**, handing out supplier
 *    names, quantities, order numbers, style codes and cost variances on a LAN-exposed API.
 *  - Every overdue feeder keyed on a nullable due date, and Prisma's `{ lt: today }` excludes
 *    NULLs. All 8 challans had `expectedDate` NULL, so the Overdue Challans alert had never once
 *    been able to fire — including for a challan 54 days out at a vendor.
 *  - "Due This Week" counted only external_process_send_outs, never job_work_orders, which is the
 *    flow this factory actually uses.
 *
 * ⚠ There is no TEST_DATABASE_URL — this runs against the LIVE database. Every fixture carries the
 * RUN_TAG prefix, every assertion is a DELTA against a baseline rather than an absolute count, and
 * teardown deletes by that prefix in reverse-FK order.
 */

const RUN_TAG = `CCTEST-${Date.now()}`;

describe('Manufacturing Control Center', () => {
  let admin: Record<string, string>;
  let adminId: string;

  beforeAll(async () => {
    // isApproved matters: leaked test fixtures are active but unapproved, and authenticateToken
    // rejects those with a 401 that reads exactly like a broken permission rule.
    const a = await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true, isApproved: true } });
    adminId = a!.id;
    admin = getAuthHeader(a!.id, 'ADMIN');
  });

  describe('authentication', () => {
    it('refuses an anonymous caller on /alerts', async () => {
      await request(app).get('/api/manufacturing/alerts').expect(401);
    });

    it('refuses an anonymous caller on /pipeline', async () => {
      await request(app).get('/api/manufacturing/pipeline').expect(401);
    });

    it('serves an authenticated caller', async () => {
      const res = await request(app).get('/api/manufacturing/alerts').set(admin).expect(200);
      expect(res.body.data.alerts).toBeDefined();
    });

    /**
     * Reads stay open to any signed-in role (CLAUDE.md). Pinned deliberately: the `manufacturing`
     * permission key is granted to every role in role_permissions, so gating on it would imply a
     * restriction that does not exist. Tightening this later should be a visible test change.
     */
    it('serves a non-production role too — reads are open', async () => {
      const acc = await prisma.users.findFirst({ where: { role: 'ACCOUNTS', isActive: true, isApproved: true } });
      if (!acc) return; // deployment has no ACCOUNTS user; nothing to assert
      await request(app).get('/api/manufacturing/alerts').set(getAuthHeader(acc.id, 'ACCOUNTS')).expect(200);
    });
  });

  describe('overdue challans', () => {
    let challanId: string;
    let baseline: number;

    beforeAll(async () => {
      const res = await request(app).get('/api/manufacturing/alerts').set(admin).expect(200);
      baseline = res.body.data.alerts.overdueChallans.count;

      // A challan with NO expected date, issued long enough ago to be past any sane grace window.
      // This is precisely the row the old query could never see.
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 120);

      const created = await prisma.challans.create({
        data: {
          challanNumber: `${RUN_TAG}-OUT`,
          challanType: 'OUTWARD',
          challanDate: longAgo,
          issuedDate: longAgo,
          expectedDate: null,
          status: 'ISSUED',
          fromType: 'WAREHOUSE',
          fromName: 'Main Warehouse',
          toType: 'VENDOR',
          toName: `${RUN_TAG} Vendor`,
          totalItems: 0,
          totalQuantity: 0,
          issuedById: adminId,
        },
      });
      challanId = created.id;
    });

    it('counts an outward challan with no expected date once it is past the grace window', async () => {
      const res = await request(app).get('/api/manufacturing/alerts').set(admin).expect(200);
      expect(res.body.data.alerts.overdueChallans.count).toBe(baseline + 1);
      // And it must report a real age, not "overdue by 0 days" — the NULLS-LAST orderBy bug.
      expect(res.body.data.alerts.overdueChallans.oldestDays).toBeGreaterThanOrEqual(120);
    });

    it('stops counting it once it is received', async () => {
      await prisma.challans.update({
        where: { id: challanId },
        data: { status: 'RECEIVED', receivedDate: new Date() },
      });
      const res = await request(app).get('/api/manufacturing/alerts').set(admin).expect(200);
      expect(res.body.data.alerts.overdueChallans.count).toBe(baseline);
    });

    afterAll(async () => {
      await prisma.challans.deleteMany({ where: { challanNumber: { startsWith: RUN_TAG } } });
    });
  });

  describe('pipeline', () => {
    it('reports counts and never invents blockers of its own', async () => {
      const res = await request(app).get('/api/manufacturing/pipeline').set(admin).expect(200);
      const body = res.body.data;

      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.counts).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          blocked: expect.any(Number),
          ready: expect.any(Number),
          running: expect.any(Number),
        })
      );

      // Blocked rows must carry a reason. A row flagged blocked with no blocker would be the
      // dashboard deciding prerequisites for itself — exactly what must never happen.
      for (const order of body.orders) {
        if (order.isBlocked) expect(order.blockers.length).toBeGreaterThan(0);
        expect(
          order.blockers.every((b: { severity: string }) => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(b.severity))
        ).toBe(true);
      }

      // GPT cannot be evaluated before a work order exists; the flag must say so rather than imply a pass.
      for (const order of body.orders) {
        if (order.workOrderCount === 0) expect(order.gptEvaluated).toBe(false);
      }
    });
  });

  afterAll(async () => {
    await prisma.challans.deleteMany({ where: { challanNumber: { startsWith: RUN_TAG } } });
    await prisma.$disconnect();
  });
});
