/**
 * An MRP re-run must not re-plan greige that has already gone to the dyer.
 *
 * Entering an order's size breakdown (sizes-later workflow) re-runs MRP for the order. The re-run
 * cancels every requirement not on a PO / received and rebuilds it against TODAY's free stock. A
 * greige requirement met from stock whose greige a dyeing job has since taken away was neither —
 * so it came back as "PO required" for cloth already dyed. ESSKY085LS/086LS (2026-09-24) were one
 * size-breakdown save away from 1,833.25 m of phantom greige purchase each.
 *
 * Runs against the live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { calculateRequirementsFromOrder } from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { only } from '../../utils/prisma-test-guard';

const RUN = `MGS${Date.now().toString(36).toUpperCase()}`;
const QTY = 1000;

let userId: string;
let authHeader: Record<string, string>;
let styleId: string;
let customerId: string;
let dyerId: string;
let greigeId: string;
let orderId: string;
let orderBomId: string;
let jobId: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  styleId = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
    })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  dyerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-DYE`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-GG`,
        greigeName: `${RUN} Moss`,
        genericGreigeName: `${RUN} Moss`,
        composition: '100% Viscose',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;
  await ensureMaterialRecord(greigeId, 'GREIGE');

  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: QTY,
        totalAmount: 1000,
        createdById: userId,
      },
    })
  ).id;
  await prisma.order_items.create({
    data: { id: randomUUID(), orderId, styleId, totalQuantity: QTY, unitPrice: 10, totalPrice: 10000 },
  });
  orderBomId = (
    await prisma.order_bom.create({
      data: { orderId, styleId, createdById: userId, status: 'APPROVED', isActive: true },
    })
  ).id;
  await prisma.order_bom_items.create({
    data: {
      id: randomUUID(),
      orderBomId,
      materialType: 'GREIGE',
      greigeId,
      sourcingStrategy: 'GREIGE_PROCESSED',
      processorId: dyerId,
      componentName: 'Top - Moss',
      usageCategory: 'FABRIC',
      colorName: 'Black',
      quantityPerGarment: 1,
      orderQuantity: QTY,
      totalQuantity: QTY,
      totalWithWastage: QTY,
      unit: 'METER',
      unitPrice: 65,
      totalCost: 65 * QTY,
      greigeCost: 49,
      processingCost: 10,
      sortOrder: 0,
    },
  });
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['material_requirements', () => prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } })],
    ['job_work_orders', () => prisma.job_work_orders.deleteMany({ where: { processorId: only(dyerId) } })],
    ['order_bom_items', () => prisma.order_bom_items.deleteMany({ where: { orderBomId: only(orderBomId) } })],
    ['order_bom', () => prisma.order_bom.deleteMany({ where: { orderId: only(orderId) } })],
    ['orders', () => prisma.orders.deleteMany({ where: { id: only(orderId) } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materials: { greigeId: only(greigeId) } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { greigeId: only(greigeId) } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(dyerId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[mrp-recalc-greige-sent teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

const live = () =>
  prisma.material_requirements.findMany({
    where: { orderId, status: { not: 'CANCELLED' } },
    select: { id: true, requirementType: true, status: true, linkedRequirementId: true },
  });

describe('MRP re-run after the greige has gone to the dyer', () => {
  it('keeps the greige requirement settled and plans no second one', async () => {
    await calculateRequirementsFromOrder({ orderId, checkStock: false }, userId);
    const first = await live();
    const greige = first.find((r) => r.requirementType === 'MATERIAL')!;
    const processing = first.find((r) => r.requirementType === 'PROCESSING')!;
    expect(greige).toBeTruthy();
    expect(processing?.linkedRequirementId).toBe(greige.id);

    // What happened for real: greige met from stock, a dyeing job raised on the processing
    // requirement and sent, the dyed fabric received.
    await prisma.material_requirements.update({
      where: { id: greige.id },
      data: { status: 'FULFILLED_STOCK', allocatedFromStock: QTY, shortfall: 0 },
    });
    const job = await request(app).post('/api/job-work-orders').set(authHeader).send({
      processType: 'DYEING',
      processorId: dyerId,
      quantity: QTY,
      agreedRate: 10,
      expectedShrinkage: 8,
      colorName: 'Black',
    });
    expect(job.status).toBe(201);
    jobId = job.body.data.id;
    await prisma.job_work_orders.update({ where: { id: jobId }, data: { jwoStatus: 'STOCK_UPDATED' } });
    await prisma.requirement_jwo_links.create({
      data: { requirementId: processing.id, jobWorkOrderId: jobId, allocatedQuantity: QTY },
    });
    await prisma.material_requirements.update({ where: { id: processing.id }, data: { status: 'RECEIVED' } });

    // The re-run a size-breakdown save triggers
    await calculateRequirementsFromOrder({ orderId, checkStock: true }, userId);

    const after = await live();
    const greigeRows = after.filter((r) => r.requirementType === 'MATERIAL');
    expect(greigeRows).toHaveLength(1);
    expect(greigeRows[0].id).toBe(greige.id);
    expect(greigeRows[0].status).toBe('FULFILLED_STOCK');
    expect(after.filter((r) => r.requirementType === 'PROCESSING')).toHaveLength(1);
  });

  it('still re-plans a greige requirement whose job has not been sent', async () => {
    await prisma.job_work_orders.update({ where: { id: jobId }, data: { jwoStatus: 'APPROVED' } });
    await calculateRequirementsFromOrder({ orderId, checkStock: true }, userId);
    const greigeRows = (await live()).filter((r) => r.requirementType === 'MATERIAL');
    expect(greigeRows).toHaveLength(1);
    expect(greigeRows[0].status).not.toBe('FULFILLED_STOCK'); // no free stock → back to planning
  });
});
