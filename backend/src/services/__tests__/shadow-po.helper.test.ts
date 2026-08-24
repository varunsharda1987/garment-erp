/**
 * shadow-po.helper — pins the guarded shadow-PO echo contract (landmine №7 fix).
 *
 * Dyeing/printing echoed job status onto the paired purchase order with raw
 * unconditional updates: an echo could resurrect a CANCELLED PO to SENT/RECEIVED, and
 * the JWO cancel flow forgot the echo entirely (live-looking PO for a dead job — GRN
 * still bookable, MRP double-orders). The helper applies a target status only from the
 * states it may legally follow.
 */

import { echoShadowPoStatus } from '../helpers/shadow-po.helper';
import { purchaseOrderService } from '../purchaseOrder.service';
import prisma from '../../config/database';
import { randomUUID } from 'crypto';

describe('shadow-po.helper', () => {
  const RUN = `TSPO${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let supplierId: string;
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

    const supplier = await prisma.suppliers.create({
      data: {
        id: randomUUID(),
        code: `${RUN}-SUP`,
        name: `${RUN} Supplier`,
        createdById: testUserId,
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    try {
      await prisma.purchase_orders.deleteMany({ where: { poNumber: { startsWith: RUN } } });
      await prisma.suppliers.deleteMany({ where: { id: supplierId } });
      await prisma.users.deleteMany({ where: { id: testUserId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  function createPo(status: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED', remarks?: string) {
    n += 1;
    return prisma.purchase_orders.create({
      data: {
        id: randomUUID(),
        poNumber: `${RUN}-${n}`,
        supplierId,
        expectedDeliveryDate: new Date(),
        status,
        remarks,
        createdById: testUserId,
      },
    });
  }

  async function statusOf(id: string) {
    const po = await prisma.purchase_orders.findUnique({ where: { id } });
    return po!.status;
  }

  it('normal path: DRAFT -> SENT -> RECEIVED', async () => {
    const po = await createPo('DRAFT');
    expect(await echoShadowPoStatus(prisma, po.id, 'SENT')).toBe(true);
    expect(await statusOf(po.id)).toBe('SENT');
    expect(await echoShadowPoStatus(prisma, po.id, 'RECEIVED')).toBe(true);
    expect(await statusOf(po.id)).toBe('RECEIVED');
  });

  it('never resurrects a CANCELLED PO (the incident pin)', async () => {
    const po = await createPo('CANCELLED');
    expect(await echoShadowPoStatus(prisma, po.id, 'SENT')).toBe(false);
    expect(await statusOf(po.id)).toBe('CANCELLED');
    expect(await echoShadowPoStatus(prisma, po.id, 'RECEIVED')).toBe(false);
    expect(await statusOf(po.id)).toBe('CANCELLED');
  });

  it('never erases a receipt: RECEIVED and PARTIALLY_RECEIVED refuse CANCELLED', async () => {
    const received = await createPo('RECEIVED');
    expect(await echoShadowPoStatus(prisma, received.id, 'CANCELLED')).toBe(false);
    expect(await statusOf(received.id)).toBe('RECEIVED');

    const partial = await createPo('PARTIALLY_RECEIVED');
    expect(await echoShadowPoStatus(prisma, partial.id, 'CANCELLED')).toBe(false);
    expect(await statusOf(partial.id)).toBe('PARTIALLY_RECEIVED');
  });

  it('cancel echo appends remarks instead of overwriting', async () => {
    const po = await createPo('SENT', 'Original terms: 30 days');
    expect(await echoShadowPoStatus(prisma, po.id, 'CANCELLED', { appendRemarks: '[RETURNED UNPROCESSED] test' })).toBe(
      true
    );
    const after = await prisma.purchase_orders.findUnique({ where: { id: po.id } });
    expect(after!.status).toBe('CANCELLED');
    expect(after!.remarks).toContain('Original terms: 30 days');
    expect(after!.remarks).toContain('[RETURNED UNPROCESSED] test');
  });

  it('tolerates a missing or null PO id (legacy JWOs without a shadow pair)', async () => {
    expect(await echoShadowPoStatus(prisma, null, 'CANCELLED')).toBe(false);
    expect(await echoShadowPoStatus(prisma, randomUUID(), 'SENT')).toBe(false);
  });

  it('cancel echo stamps who cancelled and when (audit follow-up)', async () => {
    const po = await createPo('SENT');
    await echoShadowPoStatus(prisma, po.id, 'CANCELLED', { cancelledById: testUserId });
    const after = await prisma.purchase_orders.findUnique({ where: { id: po.id } });
    expect(after!.cancelledById).toBe(testUserId);
    expect(after!.cancelledAt).not.toBeNull();
  });

  it('the live cancelPurchaseOrder stamps the actor too (previously nobody was recorded)', async () => {
    const po = await createPo('DRAFT');
    await purchaseOrderService.cancelPurchaseOrder(po.id, 'audit test', 'ADMIN', testUserId);
    const after = await prisma.purchase_orders.findUnique({ where: { id: po.id } });
    expect(after!.status).toBe('CANCELLED');
    expect(after!.cancelledById).toBe(testUserId);
    expect(after!.cancelledAt).not.toBeNull();
    expect(after!.remarks).toContain('Cancellation reason: audit test');
  });
});
