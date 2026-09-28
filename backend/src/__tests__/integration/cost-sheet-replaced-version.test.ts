/**
 * A replaced cost sheet version is history (cost-sheet-version.helper assertCostSheetIsLive).
 *
 * ESSKY092LS v1 (28-Sep-2026) was revoked minutes after the CAD correction moved its order onto v2: the
 * revoke wiped who had approved it, and nothing recorded who pressed it. The pages offered Revoke, New
 * Version and Create Order on every approved version, old ones included, and the server took them — a New
 * Version from an old sheet leaves two live sheets, and an order BOM from one takes replaced figures.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { orderBomService } from '../../services/order-bom.service';

const RUN = `CSR${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let customerId: string;
let orderId: string;
let v1Id: string;
let v2Id: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}-C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 10,
        totalAmount: 100,
        createdById: userId,
      },
    })
  ).id;

  v1Id = (
    await prisma.style_costing.create({
      data: {
        id: `CS-${Date.now()}-v1${RUN}`,
        styleId,
        createdById: userId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        version: 1,
        isApproved: true,
        approvalStatus: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
    })
  ).id;
  const res = await request(app)
    .post(`/api/style-costing/${v1Id}/create-version`)
    .set(authHeader)
    .send({ versionReason: `${RUN} corrected` })
    .expect(201);
  v2Id = res.body.data.id;
});

afterAll(async () => {
  await prisma.audit_logs.deleteMany({ where: { entityId: only(v1Id) } });
  await prisma.audit_logs.deleteMany({ where: { entityId: only(v2Id) } });
  await prisma.order_bom.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.style_costing.updateMany({ where: { styleId: only(styleId) }, data: { supersededById: null } });
  await prisma.style_costing.deleteMany({ where: { styleId: only(styleId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

function expectReplaced(res: request.Response) {
  expect(res.status).toBe(409);
  expect(res.body.message).toMatch(/v1 was replaced .* and is kept as history\. Open v2 to make changes\./);
  expect(res.body.details).toMatchObject({ code: 'COST_SHEET_REPLACED', liveCostSheetId: v2Id, liveVersion: 2 });
}

describe('a replaced cost sheet version is history', () => {
  // (The /lace-items routes validate a UUID sheet id, so no real CS-… sheet reaches them; lace is saved by PUT)
  it('refuses revoke, reject, approve, edit, delete and New Version — and v1 stays as it was', async () => {
    const attempts = [
      request(app).patch(`/api/style-costing/${v1Id}/approve`).set(authHeader).send({ action: 'revoke' }),
      request(app)
        .patch(`/api/style-costing/${v1Id}/approve`)
        .set(authHeader)
        .send({ action: 'reject', rejectionNotes: 'x' }),
      request(app).patch(`/api/style-costing/${v1Id}/approve`).set(authHeader).send({ action: 'approve' }),
      request(app)
        .put(`/api/style-costing/${v1Id}`)
        .set(authHeader)
        .send({ notes: `${RUN} edit` }),
      request(app).delete(`/api/style-costing/${v1Id}`).set(authHeader),
      request(app).post(`/api/style-costing/${v1Id}/create-version`).set(authHeader).send({ versionReason: 'fork' }),
    ];
    for (const attempt of attempts) expectReplaced(await attempt);

    const v1 = await prisma.style_costing.findUniqueOrThrow({ where: { id: v1Id } });
    expect(v1).toMatchObject({
      approvalStatus: 'APPROVED',
      isApproved: true,
      approvedById: userId,
      supersededById: v2Id,
    });
    expect(await prisma.style_costing.count({ where: { styleId } })).toBe(2);
  });

  it('refuses to build an order BOM from the replaced version', async () => {
    await expect(
      orderBomService.createFromCostSheet({ orderId, styleId, costSheetId: v1Id, createdById: userId })
    ).rejects.toMatchObject({ statusCode: 409, details: { code: 'COST_SHEET_REPLACED', liveVersion: 2 } });
    expect(await prisma.order_bom.count({ where: { orderId } })).toBe(0);
  });

  it('still lets an order whose BOM came from the old version regenerate it (Regenerate sends its own source)', async () => {
    const bomId = randomUUID();
    await prisma.order_bom.create({
      data: {
        id: bomId,
        orderId,
        styleId,
        isActive: true,
        sourceCostSheetId: v1Id,
        createdById: userId,
        updatedAt: new Date(),
      },
    });
    try {
      const outcome = await orderBomService
        .createFromCostSheet({ orderId, styleId, costSheetId: v1Id, createdById: userId })
        .then(
          () => 'built',
          (e: { details?: { code?: string } }) => e.details?.code ?? 'other refusal'
        );
      expect(outcome).not.toBe('COST_SHEET_REPLACED');
    } finally {
      await prisma.order_bom.deleteMany({ where: { orderId: only(orderId) } });
    }
  });

  it('writes who approved and who revoked the live version to the audit log', async () => {
    await request(app)
      .patch(`/api/style-costing/${v2Id}/approve`)
      .set(authHeader)
      .send({ action: 'approve' })
      .expect(200);
    await request(app)
      .patch(`/api/style-costing/${v2Id}/approve`)
      .set(authHeader)
      .send({ action: 'revoke' })
      .expect(200);

    const logs = await prisma.audit_logs.findMany({
      where: { entityType: 'COST_SHEET', entityId: v2Id },
      orderBy: { timestamp: 'asc' },
    });
    expect(logs.map((l) => l.action)).toEqual(['APPROVE', 'UPDATE']);
    expect(logs.every((l) => l.userId === userId)).toBe(true);
    expect(logs[0].newValues).toMatchObject({ approvalStatus: 'APPROVED', version: 2, styleCode: `${RUN}S` });
    // The revoke keeps what it wiped from the row: who had approved it
    expect(logs[1].oldValues).toMatchObject({ approvalStatus: 'APPROVED', approvedById: userId });
    expect(logs[1].newValues).toMatchObject({ approvalStatus: 'PENDING', change: 'Approval revoked' });
  });
});
