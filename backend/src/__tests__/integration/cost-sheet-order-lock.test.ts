/**
 * Order-consumption freeze on cost sheets (2026-08-25).
 *
 * Once a live order consumed a cost sheet (active order_bom.sourceCostSheetId,
 * or order_item_costing.baseCostingId with a non-cancelled order), the sheet's
 * approval must not be pulled out from under those frozen numbers — revoke,
 * reject, edit and delete are refused with 409 COST_SHEET_IN_USE. The
 * `lockedForOrders` column was write-only dead code; these guards are the real
 * lock. Sanctioned path: create a new cost-sheet version.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CSL${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;
let customerId: string;

let sheetVersionCounter = 0;
const createdSheetIds: string[] = [];
async function createCostSheet(overrides: Record<string, any> = {}) {
  sheetVersionCounter += 1;
  // Route param schema requires the production id shape: /^CS-\d+-[a-z0-9]+$/i
  const sheet = await prisma.style_costing.create({
    data: {
      id: `CS-${Date.now()}${sheetVersionCounter}-${randomUUID().replace(/-/g, '').slice(0, 7)}`,
      styleId,
      createdById: testUserId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      version: sheetVersionCounter,
      approvalStatus: 'APPROVED',
      isApproved: true,
      ...overrides,
    },
  });
  createdSheetIds.push(sheet.id);
  return sheet;
}

let orderCounter = 0;
async function createOrder() {
  orderCounter += 1;
  return prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}ORD${orderCounter}`,
      customerId,
      expectedDeliveryDate: new Date(),
      totalQuantity: 100,
      totalAmount: 10000,
      createdById: testUserId,
    },
  });
}

async function createBomFromSheet(orderId: string, costSheetId: string, overrides: Record<string, any> = {}) {
  return prisma.order_bom.create({
    data: {
      orderId,
      styleId,
      createdById: testUserId,
      status: 'APPROVED',
      sourceCostSheetId: costSheetId,
      ...overrides,
    },
  });
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: testUserId },
  });
  styleId = style.id;

  const customer = await prisma.customers.create({
    data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: testUserId },
  });
  customerId = customer.id;
});

afterAll(async () => {
  await prisma.orders.deleteMany({ where: { orderNumber: { startsWith: RUN } } }); // cascades BOMs + items
  if (createdSheetIds.length > 0) {
    await prisma.style_costing.deleteMany({ where: { id: { in: createdSheetIds } } });
  }
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('cost-sheet order-consumption freeze', () => {
  it('revoke is refused (409) while an active order BOM was built from the sheet', async () => {
    const sheet = await createCostSheet();
    const order = await createOrder();
    await createBomFromSheet(order.id, sheet.id);

    const res = await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ action: 'revoke' })
      .expect(409);
    expect(res.body.details.code).toBe('COST_SHEET_IN_USE');
    expect(res.body.details.dependents.activeBoms.map((b: any) => b.orderNumber)).toContain(order.orderNumber);
    expect(res.body.message).toContain(order.orderNumber);

    const after = await prisma.style_costing.findUnique({ where: { id: sheet.id } });
    expect(after!.approvalStatus).toBe('APPROVED'); // untouched
    expect(after!.isApproved).toBe(true);
  });

  it('the legacy `approved: false` contract is guarded the same way', async () => {
    const sheet = await createCostSheet();
    const order = await createOrder();
    await createBomFromSheet(order.id, sheet.id);

    await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ approved: false })
      .expect(409);
  });

  it('reject is refused too; re-approve is not a downgrade and stays allowed', async () => {
    const sheet = await createCostSheet();
    const order = await createOrder();
    await createBomFromSheet(order.id, sheet.id);

    await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ action: 'reject', rejectionNotes: 'testing guard' })
      .expect(409);

    await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ action: 'approve' })
      .expect(200);
  });

  it('after the BOM is deactivated, revoke succeeds (the teardown flow)', async () => {
    const sheet = await createCostSheet();
    const order = await createOrder();
    const bom = await createBomFromSheet(order.id, sheet.id);

    await prisma.order_bom.update({ where: { id: bom.id }, data: { isActive: false } });

    await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ action: 'revoke' })
      .expect(200);

    const after = await prisma.style_costing.findUnique({ where: { id: sheet.id } });
    expect(after!.approvalStatus).toBe('PENDING');
    expect(after!.isApproved).toBe(false);
  });

  it('an order-item costing alone blocks revoke; a CANCELLED order releases it', async () => {
    const sheet = await createCostSheet();
    const order = await createOrder();
    const orderItem = await prisma.order_items.create({
      data: {
        id: randomUUID(),
        orderId: order.id,
        styleId,
        totalQuantity: 100,
        unitPrice: 100,
        totalPrice: 10000,
      },
    });
    await prisma.order_item_costing.create({
      data: { orderItemId: orderItem.id, baseCostingId: sheet.id },
    });

    await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ action: 'revoke' })
      .expect(409);

    await prisma.orders.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });

    await request(app)
      .patch(`/api/style-costing/${sheet.id}/approve`)
      .set(authHeader)
      .send({ action: 'revoke' })
      .expect(200);
  });

  it('delete is refused while ANY BOM reference exists — even an inactive one', async () => {
    const sheet = await createCostSheet({ approvalStatus: 'PENDING', isApproved: false });
    const order = await createOrder();
    await createBomFromSheet(order.id, sheet.id, { isActive: false, status: 'DRAFT' });

    const res = await request(app).delete(`/api/style-costing/${sheet.id}`).set(authHeader).expect(409);
    expect(res.body.details.code).toBe('COST_SHEET_IN_USE');

    const after = await prisma.style_costing.findUnique({ where: { id: sheet.id } });
    expect(after).not.toBeNull(); // still there
  });

  it('editing a non-approved sheet with a live consumer is refused (legacy-state backstop)', async () => {
    const sheet = await createCostSheet({ approvalStatus: 'PENDING', isApproved: false });
    const order = await createOrder();
    await createBomFromSheet(order.id, sheet.id);

    await request(app)
      .put(`/api/style-costing/${sheet.id}`)
      .set(authHeader)
      .send({ notes: 'should not be possible' })
      .expect(409);
  });
});
