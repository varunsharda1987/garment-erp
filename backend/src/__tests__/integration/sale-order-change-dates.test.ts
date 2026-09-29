/**
 * An admin changes a CONFIRMED sale order's Expected Ship Date / Buyer Deadline (owner, 2026-09-29):
 * orders were confirmed with no deadline, or the buyer moved the date, and nothing could correct them.
 * Pins:
 *  - admin only (a merchandiser is refused), and a Draft is sent back to Edit;
 *  - the ship date may not be after the deadline;
 *  - a new ship date moves the linked production order and its unfinished runs — a finished run keeps
 *    its date;
 *  - with no ship date, a new deadline may not fall before the linked order's delivery;
 *  - every change is in the audit log, reason included; null clears a date.
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SCD${Date.now().toString(36).toUpperCase()}`;
const YEAR = new Date().getUTCFullYear() + 1;
const day = (m: number, d: number) => `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : null);

let adminHeader: Record<string, string>;
let adminId: string;
let merchHeader: Record<string, string>;
let merchId: string;
let customerId: string;
let styleId: string;
let soId: string;
let draftId: string;
let orderId: string;
let pendingRunId: string;
let doneRunId: string;
const DONE_RUN_END = new Date(Date.UTC(YEAR, 0, 5));

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');
  const merch = await createTestUser({
    email: `test-${RUN.toLowerCase()}-m@smoke.test`,
    role: 'MERCHANDISER',
    isActive: true,
    isApproved: true,
  });
  merchId = merch.id;
  merchHeader = getAuthHeader(merch.id, 'MERCHANDISER');

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Top`, createdById: adminId },
    })
  ).id;

  soId = randomUUID();
  await prisma.sale_orders.create({
    data: {
      id: soId,
      saleOrderNumber: `${RUN}SO`,
      customerId,
      status: 'CONFIRMED',
      expectedShipDate: new Date(`${day(3, 1)}T00:00:00+05:30`),
      createdById: adminId,
    },
  });
  draftId = randomUUID();
  await prisma.sale_orders.create({
    data: { id: draftId, saleOrderNumber: `${RUN}SOD`, customerId, status: 'DRAFT', createdById: adminId },
  });

  orderId = randomUUID();
  await prisma.orders.create({
    data: {
      id: orderId,
      orderNumber: `${RUN}ORD`,
      customerId,
      saleOrderId: soId,
      expectedDeliveryDate: new Date(`${day(3, 1)}T00:00:00+05:30`),
      totalQuantity: 100,
      totalAmount: 1000,
      createdById: adminId,
    },
  });
  const run = (status: 'PENDING' | 'COMPLETED', end: Date) =>
    prisma.work_orders.create({
      data: {
        id: randomUUID(),
        workOrderNumber: `${RUN}-WO-${status}`,
        styleId,
        orderId,
        status,
        plannedStartDate: new Date(),
        plannedEndDate: end,
        totalQuantity: 50,
        createdById: adminId,
      },
    });
  pendingRunId = (await run('PENDING', new Date(`${day(3, 1)}T00:00:00+05:30`))).id;
  doneRunId = (await run('COMPLETED', DONE_RUN_END)).id;
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['work_orders', () => prisma.work_orders.deleteMany({ where: { orderId: only(orderId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: only(orderId) } })],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { id: { in: [only(soId), only(draftId)] } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { entityId: only(soId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: { in: [only(adminId), only(merchId)] } } })],
  ];
  for (const [label, runStep] of steps) {
    try {
      await runStep();
    } catch (err) {
      console.error(`[sale-order-change-dates teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

const post = (id: string, header: Record<string, string>, body: object) =>
  request(app).post(`/api/sale-orders/${id}/dates`).set(header).send(body);

describe('changing a confirmed sale order’s dates', () => {
  it('is refused for a non-admin', async () => {
    const res = await post(soId, merchHeader, { buyerDeadline: day(3, 10) });
    expect(res.status).toBe(403);
  });

  it('sends a Draft back to Edit', async () => {
    const res = await post(draftId, adminHeader, { buyerDeadline: day(3, 10) });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Edit');
  });

  it('refuses a ship date after the deadline', async () => {
    const res = await post(soId, adminHeader, { expectedShipDate: day(3, 20), buyerDeadline: day(3, 10) });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Buyer Deadline');
  });

  it('sets a deadline on an order that had none, without touching production', async () => {
    const res = await post(soId, adminHeader, { buyerDeadline: day(3, 10), reason: 'Buyer confirmed the date' });
    expect(res.status).toBe(200);
    expect(res.body.data.productionOrder).toBeNull();
    const so = await prisma.sale_orders.findUniqueOrThrow({ where: { id: soId } });
    expect(iso(so.buyerDeadline)).toBe(day(3, 10));
    const log = await prisma.audit_logs.findFirst({ where: { entityId: soId }, orderBy: { timestamp: 'desc' } });
    expect(JSON.stringify(log?.newValues)).toContain('Buyer confirmed the date');
  });

  it('moves the linked production order and its unfinished runs with the ship date', async () => {
    const res = await post(soId, adminHeader, { expectedShipDate: day(3, 8) });
    expect(res.status).toBe(200);
    expect(res.body.data.productionOrder).toMatchObject({ orderNumber: `${RUN}ORD`, runsMoved: 1 });
    const order = await prisma.orders.findUniqueOrThrow({ where: { id: orderId } });
    const pending = await prisma.work_orders.findUniqueOrThrow({ where: { id: pendingRunId } });
    const done = await prisma.work_orders.findUniqueOrThrow({ where: { id: doneRunId } });
    const want = day(3, 8);
    expect(iso(order.expectedDeliveryDate)).toBe(want);
    expect(iso(pending.plannedEndDate)).toBe(want);
    expect(done.plannedEndDate.toISOString()).toBe(DONE_RUN_END.toISOString());
  });

  it('with no ship date, refuses a deadline before the linked order’s delivery', async () => {
    const res = await post(soId, adminHeader, { expectedShipDate: null, buyerDeadline: day(3, 5) });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(`${RUN}SO`);
  });

  it('clears the ship date', async () => {
    const res = await post(soId, adminHeader, { expectedShipDate: null });
    expect(res.status).toBe(200);
    const so = await prisma.sale_orders.findUniqueOrThrow({ where: { id: soId } });
    expect(so.expectedShipDate).toBeNull();
    expect(so.buyerDeadline).not.toBeNull();
  });
});
