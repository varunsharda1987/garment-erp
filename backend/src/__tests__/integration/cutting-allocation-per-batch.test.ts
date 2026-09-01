/**
 * A cutting batch's fabric reservation belongs to THAT batch (silent-data-loss finding #16).
 *
 * Reservations were created with no batch reference, and completion updated them with
 * `where: { stockId, orderId, styleId, allocationStatus: 'RESERVED' }`. Progressive cutting across
 * lays is a first-class flow — cutting_batches.workOrderId has no unique constraint — so two batches
 * on the same order/style/roll produce TWO reservation rows, and that filter matched both.
 *
 * The result was wrong in both directions at once: batch 1's consumption was stamped onto batch 2's
 * untouched reservation (flipping it to CONSUMED for fabric that had not been cut), and when batch 2
 * later completed it found nothing RESERVED, matched zero rows, and recorded nothing at all. The
 * updateMany count was never inspected, so zero matches looked exactly like success, and the batch
 * itself reported a correct figure — the divergence lived only in the allocation ledger that
 * fabric-usage-by-style reads.
 *
 * The allocation now carries `cuttingBatchId` and completion keys on it, so the update is 1:1.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CUTA${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let customerId: string;
let styleId: string;
let orderId: string;
let workOrderId: string;
let stockId: string;
let fabricId: string;
let batchAId: string;
let batchBId: string;

async function makeBatch(suffix: string) {
  const b = await prisma.cutting_batches.create({
    data: {
      id: randomUUID(),
      batchNumber: `${RUN}-${suffix}`,
      workOrderId,
      fabricStockId: stockId,
      cuttingDate: new Date(),
      actualFabricWidth: 58,
      cadAverageUsed: 1.5,
      cadWidthUsed: 58,
      layersPerLay: 1,
      numberOfLays: 1,
      fabricConsumed: 0,
      status: 'PENDING',
      createdById: userId,
    },
  });
  return b.id;
}

/** Reserve fabric for a batch exactly as createCuttingBatch does. */
async function reserve(batchId: string, qty: number) {
  return prisma.fabric_stock_allocation.create({
    data: {
      stockId,
      orderId,
      styleId,
      cuttingBatchId: batchId,
      quantityAllocated: qty,
      plannedCad: 1.5,
      allocationStatus: 'RESERVED',
      allocationType: 'SAME_STYLE',
      createdById: userId,
    },
  });
}

/** The completion write, as the controller now performs it. */
const consume = (batchId: string, consumed: number) =>
  prisma.fabric_stock_allocation.updateMany({
    where: { cuttingBatchId: batchId, stockId },
    data: { allocationStatus: 'CONSUMED', quantityConsumed: consumed, consumptionDate: new Date() },
  });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber: `${RUN}-ORD`,
      customerId,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
      totalQuantity: 200,
      totalAmount: 20000,
      createdById: userId,
    },
  });
  orderId = order.id;

  const wo = await prisma.work_orders.create({
    data: {
      id: randomUUID(),
      workOrderNumber: `${RUN}-WO`,
      styleId,
      plannedStartDate: new Date(),
      plannedEndDate: new Date(Date.now() + 20 * 86400000),
      totalQuantity: 200,
      createdById: userId,
    },
  });
  workOrderId = wo.id;

  const fabric = await prisma.fabric_master.create({
    data: { id: randomUUID(), fabricCode: `${RUN}-FAB`, fabricName: `${RUN} Fabric`, createdById: userId },
  });
  fabricId = fabric.id;

  const stock = await prisma.fabric_stock.create({
    data: {
      id: randomUUID(),
      fabricId,
      finishedWidth: 58,
      cutableWidth: 58,
      quantityAvailable: 500,
      weightedAvgCost: 100,
      purchaseCost: 100,
      receivedDate: new Date(),
      createdById: userId,
    },
  });
  stockId = stock.id;

  batchAId = await makeBatch('A');
  batchBId = await makeBatch('B');
});

afterAll(async () => {
  await prisma.fabric_stock_allocation.deleteMany({ where: { stockId: only(stockId) } });
  await prisma.cutting_batches.deleteMany({ where: { workOrderId: only(workOrderId) } });
  await prisma.fabric_stock.deleteMany({ where: { id: only(stockId) } });
  await prisma.fabric_master.deleteMany({ where: { id: only(fabricId) } });
  await prisma.work_orders.deleteMany({ where: { id: only(workOrderId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Fabric allocations belong to the batch that reserved them', () => {
  it('completing one batch touches exactly its own reservation', async () => {
    await reserve(batchAId, 150);
    await reserve(batchBId, 90);

    const result = await consume(batchAId, 150);
    // Exactly one row — the old key matched BOTH, which is the whole defect.
    expect(result.count).toBe(1);

    const a = await prisma.fabric_stock_allocation.findFirstOrThrow({ where: { cuttingBatchId: batchAId } });
    const b = await prisma.fabric_stock_allocation.findFirstOrThrow({ where: { cuttingBatchId: batchBId } });

    expect(a.allocationStatus).toBe('CONSUMED');
    expect(Number(a.quantityConsumed)).toBeCloseTo(150, 2);

    // Batch B never cut anything yet: it must still be reserved, at zero consumed.
    expect(b.allocationStatus).toBe('RESERVED');
    expect(Number(b.quantityConsumed)).toBeCloseTo(0, 2);
  });

  it('the second batch still records its own consumption afterwards', async () => {
    // Under the old key this matched ZERO rows — B's reservation had already been flipped to
    // CONSUMED by A's completion — so the second cut vanished from the ledger entirely.
    const result = await consume(batchBId, 90);
    expect(result.count).toBe(1);

    const b = await prisma.fabric_stock_allocation.findFirstOrThrow({ where: { cuttingBatchId: batchBId } });
    expect(Number(b.quantityConsumed)).toBeCloseTo(90, 2);

    // And the ledger now totals what was actually cut, not double the first batch.
    const total = await prisma.fabric_stock_allocation.aggregate({
      where: { stockId },
      _sum: { quantityConsumed: true },
    });
    expect(Number(total._sum.quantityConsumed)).toBeCloseTo(240, 2);
  });

  it('refuses two reservations for the same batch and roll', async () => {
    // The unique key makes the createCuttingBatch de-duplication unreachable rather than
    // load-bearing: CuttingChart sends the primary lot inside fabricStocks as well.
    await expect(reserve(batchAId, 10)).rejects.toThrow();
  });

  it('releases a batch reservation instead of orphaning it', async () => {
    const batchCId = await makeBatch('C');
    await reserve(batchCId, 60);

    // What deleteCuttingBatch / cancelCuttingBatch now do before the batch goes away.
    await prisma.fabric_stock_allocation.updateMany({
      where: { cuttingBatchId: batchCId },
      data: { allocationStatus: 'RELEASED', consumptionDate: new Date() },
    });

    const c = await prisma.fabric_stock_allocation.findFirstOrThrow({ where: { cuttingBatchId: batchCId } });
    expect(c.allocationStatus).toBe('RELEASED');

    // A released row must never be swept up by another batch's completion.
    const stray = await consume(batchAId, 1);
    expect(stray.count).toBe(1);
    expect(
      (await prisma.fabric_stock_allocation.findFirstOrThrow({ where: { cuttingBatchId: batchCId } })).allocationStatus
    ).toBe('RELEASED');
  });
});
