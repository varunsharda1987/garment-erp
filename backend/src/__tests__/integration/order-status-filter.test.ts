/**
 * The order list filter must accept every status the database can actually hold
 * (silent-data-loss finding #10).
 *
 * `orderQuerySchema.status` reused `OrderStatus` — the WRITABLE list — which is missing `SPLIT`.
 * Prisma's OrderStatus has it (a parent production run that was split into children). So a client
 * filtering on SPLIT got a 400 "Invalid query parameters".
 *
 * That 400 was invisible. React Query's global onError only covers mutations, so a failed list
 * fetch rendered as an empty result set: the Create-ASN order picker said "No orders found." and
 * the dispatch team read that as "nothing is ready to ship". The picker was in fact sending
 * `status: 'CONFIRMED'` — a SaleOrderStatus, not an OrderStatus — so EVERY request 400'd and the
 * screen was unusable with no error anyone could report.
 *
 * Reading and writing need different sets, which is why this is not simply "widen the enum":
 * SPLIT must be filterable but must never be settable by a client.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `OSF${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
});

afterAll(async () => {
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

const listOrders = (query: string) => request(app).get(`/api/orders${query}`).set(authHeader);

describe('Order list status filter', () => {
  it('accepts SPLIT — a real Prisma status the writable enum omits', async () => {
    // This is the red-first assertion: it was a 400 because the query schema reused the write enum.
    const res = await listOrders('?status=SPLIT&limit=5');
    expect(res.status).toBe(200);
  });

  it('accepts every other real status', async () => {
    for (const status of ['PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED']) {
      const res = await listOrders(`?status=${status}&limit=5`);
      expect([status, res.status]).toEqual([status, 200]);
    }
  });

  it("still rejects 'CONFIRMED' — it is a SaleOrderStatus, not an OrderStatus", async () => {
    // The ASN picker was sending exactly this. It must stay a hard 400 rather than being quietly
    // accepted and matching nothing, so a wrong filter can never masquerade as an empty result.
    const res = await listOrders('?status=CONFIRMED&limit=5');
    expect(res.status).toBe(400);
  });

  it('returns orders when no status filter is sent — what the ASN picker now does', async () => {
    const res = await listOrders('?limit=20');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('does not let a client WRITE the SPLIT status', async () => {
    // SPLIT is stamped by the split flow on a parent run. Filterable, never settable — widening the
    // one enum for both would have handed clients a way to fabricate it.
    const anyOrder = await prisma.orders.findFirst({ select: { id: true, status: true } });
    if (!anyOrder) return; // nothing to probe against on an empty install
    const res = await request(app).patch(`/api/orders/${anyOrder.id}/status`).set(authHeader).send({ status: 'SPLIT' });
    expect(res.status).toBe(400);

    const after = await prisma.orders.findUniqueOrThrow({ where: { id: anyOrder.id } });
    expect(after.status).toBe(anyOrder.status);
  });
});
