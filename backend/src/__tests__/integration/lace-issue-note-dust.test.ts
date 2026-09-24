/**
 * Lace issue notes — the quantity rule (utils/quantity) on consume / return / close.
 *
 * The note's issued / consumed / returned columns are 2-decimal, but the service added and
 * subtracted them as JS floats: 0.1 + 0.2 is 0.30000000000000004, so returning the last 0.2 m of a
 * 0.3 m note after consuming 0.1 was REFUSED as "more than remaining", and a note fully accounted
 * for could be left PARTIALLY_RETURNED by a 1e-15 remainder. A return typed within dust of what is
 * left (5.004 against 5.00) is that remainder, and must close the note with exactly 5.00 returned.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `LIN${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let styleId: string;
let orderId: string;
let laceId: string;
const stockIds: string[] = [];

async function makeLot(quantityAvailable: number) {
  const lot = await prisma.lace_stock.create({
    data: {
      laceId,
      quantityAvailable,
      weightedAvgCost: 10,
      purchaseCost: 10,
      receivedDate: new Date(),
      lotNumber: `${RUN}-${stockIds.length + 1}`,
    },
  });
  stockIds.push(lot.id);
  return lot;
}

async function issue(stockId: string, issuedQuantity: number) {
  const res = await request(app)
    .post('/api/lace-issue-notes')
    .set(authHeader)
    .send({ orderId, styleId, stockId, laceId, issuedQuantity })
    .expect(201);
  return res.body.data.id as string;
}

async function note(id: string) {
  const n = await prisma.lace_issue_note.findUniqueOrThrow({ where: { id } });
  return {
    status: n.status,
    consumed: Number(n.consumedQuantity),
    returned: Number(n.returnedQuantity),
  };
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;
  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;
  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}ORD`,
      customerId,
      expectedDeliveryDate: new Date(),
      totalQuantity: 100,
      totalAmount: 10000,
      createdById: userId,
    },
  });
  orderId = order.id;
  const lace = await prisma.lace_master.create({
    data: { laceCode: `${RUN}-LACE`, laceName: `${RUN} Lace` },
  });
  laceId = lace.id;
});

afterAll(async () => {
  if (stockIds.length > 0) {
    await prisma.lace_stock_transaction.deleteMany({ where: { stockId: { in: stockIds } } });
    await prisma.lace_issue_note.deleteMany({ where: { stockId: { in: stockIds } } });
    await prisma.lace_stock.deleteMany({ where: { id: { in: stockIds } } });
  }
  await prisma.lace_master.deleteMany({ where: { id: only(laceId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('lace issue note — rounding dust', () => {
  it('returns the last 0.2 m after consuming 0.1 of a 0.3 m note, and closes it', async () => {
    const lot = await makeLot(0.3);
    const id = await issue(lot.id, 0.3);

    await request(app)
      .post(`/api/lace-issue-notes/${id}/consume`)
      .set(authHeader)
      .send({ consumedQuantity: 0.1 })
      .expect(200);
    // 0.1 + 0.2 > 0.3 in floats — this was refused before the quantity rule.
    await request(app)
      .post(`/api/lace-issue-notes/${id}/return`)
      .set(authHeader)
      .send({ returnQuantity: 0.2 })
      .expect(200);

    expect(await note(id)).toEqual({ status: 'CLOSED', consumed: 0.1, returned: 0.2 });
  });

  it('closes a note whose float remainder is not exactly zero (10.3 − 0.1 − 10.2)', async () => {
    const lot = await makeLot(10.3);
    const id = await issue(lot.id, 10.3);

    await request(app)
      .post(`/api/lace-issue-notes/${id}/consume`)
      .set(authHeader)
      .send({ consumedQuantity: 0.1 })
      .expect(200);
    await request(app)
      .post(`/api/lace-issue-notes/${id}/return`)
      .set(authHeader)
      .send({ returnQuantity: 10.2 })
      .expect(200);

    expect((await note(id)).status).toBe('CLOSED');
  });

  it('a return typed within dust of what is left returns exactly that and closes the note', async () => {
    const lot = await makeLot(5);
    const id = await issue(lot.id, 5);

    await request(app)
      .post(`/api/lace-issue-notes/${id}/return`)
      .set(authHeader)
      .send({ returnQuantity: 5.004 })
      .expect(200);

    expect(await note(id)).toEqual({ status: 'CLOSED', consumed: 0, returned: 5 });
    const after = await prisma.lace_stock.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(after.quantityAvailable)).toBe(5);
    expect(Number(after.quantityReserved)).toBe(0);
  });

  it('still refuses a return that is really over what is left', async () => {
    const lot = await makeLot(5);
    const id = await issue(lot.id, 5);

    const res = await request(app)
      .post(`/api/lace-issue-notes/${id}/return`)
      .set(authHeader)
      .send({ returnQuantity: 5.01 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await note(id)).toEqual({ status: 'ISSUED', consumed: 0, returned: 0 });
  });
});
