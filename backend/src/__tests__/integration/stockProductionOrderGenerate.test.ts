/**
 * Stock Production Order → Generate Work Orders (make-to-stock).
 *
 * Until 2026-09-17 generateWorkOrders created the run and only then flipped the SPO's status,
 * outside any transaction, and never looked for an existing run — two clicks made two runs for
 * one stock order (order-system T1-D). Now: claim the SPO (APPROVED → IN_PRODUCTION) and create
 * the run in ONE transaction; a second caller finds nothing to claim.
 *
 * Runs against the LIVE database; fixtures are tagged and torn down per step.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SPG${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let authHeader: Record<string, string>;
let styleId: string;
let sizeId: string;
const spoIds: string[] = [];

async function createSpo(totalQuantity: number, breakupQty: number) {
  const res = await request(app)
    .post('/api/stock-production-orders')
    .set(authHeader)
    .send({ styleId, totalQuantity, items: [{ sizeId, quantity: breakupQty }] });
  if (res.status !== 201) throw new Error(`create SPO: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  // The SPO create answers the object unwrapped (unlike work-order/sale-order creates).
  const id = (res.body.data ?? res.body).id as string;
  if (!id) throw new Error(`create SPO: no id in ${JSON.stringify(res.body).slice(0, 200)}`);
  spoIds.push(id);
  return id;
}
const generate = (id: string) =>
  request(app).post(`/api/stock-production-orders/${id}/generate-work-orders`).set(authHeader).send({});

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: userId },
  });
  sizeId = randomUUID();
  await prisma.size_options.create({ data: { id: sizeId, styleId, sizeName: 'M', sizeCode: `${RUN}-M` } });
});

afterAll(async () => {
  // Per step, each reported: the first version of this teardown stopped at the first FK failure
  // and silently left two runs' fixtures in the live DB (2026-09-17). Scope by STYLE, not by the
  // ids the tests managed to record — an SPO created before a helper threw is otherwise orphaned.
  const spoIdsByStyle = (
    await prisma.stock_production_orders.findMany({ where: { styleId: only(styleId) }, select: { id: true } })
  ).map((s) => s.id);
  const woIds = (
    await prisma.work_orders.findMany({
      where: { OR: [{ stockProductionOrderId: { in: spoIdsByStyle } }, { styleId: only(styleId) }] },
      select: { id: true },
    })
  ).map((w) => w.id);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['production_tracking', () => prisma.production_tracking.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_order_breakup', () => prisma.work_order_breakup.deleteMany({ where: { workOrderId: { in: woIds } } })],
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { id: { in: woIds } } })],
    [
      'stock_production_orders',
      () => prisma.stock_production_orders.deleteMany({ where: { id: { in: spoIdsByStyle } } }),
    ],
    ['size_options', () => prisma.size_options.deleteMany({ where: { id: only(sizeId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[stockProductionOrderGenerate teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('stock production order → work orders', () => {
  it('refuses before approval, with the reason', async () => {
    const id = await createSpo(10, 10);
    const res = await generate(id);
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/APPROVED/);
    expect(await prisma.work_orders.count({ where: { stockProductionOrderId: id } })).toBe(0);
  });

  it('refuses a breakup that does not add up to the order quantity', async () => {
    const id = await createSpo(10, 4);
    await request(app).post(`/api/stock-production-orders/${id}/approve`).set(authHeader).send({}).expect(200);
    const res = await generate(id);
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/adds up to 4, not the order quantity of 10/);
    expect(await prisma.work_orders.count({ where: { stockProductionOrderId: id } })).toBe(0);
    const spo = await prisma.stock_production_orders.findUniqueOrThrow({ where: { id } });
    expect(spo.status).toBe('APPROVED'); // not claimed — nothing was written
  });

  it('two simultaneous clicks make exactly one run, and a third is refused', async () => {
    const id = await createSpo(10, 10);
    await request(app).post(`/api/stock-production-orders/${id}/approve`).set(authHeader).send({}).expect(200);

    const [a, b] = await Promise.all([generate(id), generate(id)]);
    // The loser is refused either by the pre-check (422, it read IN_PRODUCTION after the winner
    // committed) or by the transactional claim (409, both read APPROVED) — depends on timing.
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect([409, 422]).toContain(statuses[1]);

    const runs = await prisma.work_orders.findMany({ where: { stockProductionOrderId: id } });
    expect(runs).toHaveLength(1);
    expect(runs[0].totalQuantity).toBe(10);
    const breakup = await prisma.work_order_breakup.findMany({ where: { workOrderId: runs[0].id } });
    expect(breakup.map((b) => b.plannedQuantity)).toEqual([10]);

    const spo = await prisma.stock_production_orders.findUniqueOrThrow({ where: { id } });
    expect(spo.status).toBe('IN_PRODUCTION');

    const again = await generate(id);
    expect(again.status).toBe(422);
    expect(again.body.message).toMatch(/already been generated/);
    expect(await prisma.work_orders.count({ where: { stockProductionOrderId: id } })).toBe(1);
  });
});
