/**
 * returnGreigeStock — the inverse of consumeGreigeStock (data-ownership landmine №4 fix).
 *
 * Pins the full return contract: guarded credit (never more than was consumed),
 * greige_stock_transaction RETURN ledger row, and central stock_levels kept in step —
 * the drift this closes was "credit the lot, forget the ledger" in the dyeing/printing
 * return-unprocessed flows and the cutting batch delete/cancel restores.
 */

import greigeStockService from '../greige-stock.service';
import { ensureMaterialRecord } from '../helpers/material-sync.helper';
import prisma from '../../config/database';

describe('greigeStockService.returnGreigeStock', () => {
  const testPrefix = `TGRT${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let testWarehouseId: string;
  let testGreigeId: string;
  let testMaterialId: string;
  let testStockId: string;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: `${testPrefix}@test.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;

    const warehouse = await prisma.warehouses.create({
      data: {
        warehouseCode: `${testPrefix}_WH`,
        warehouseName: `${testPrefix} Warehouse`,
        warehouseType: 'RAW_MATERIAL',
        city: 'Test City',
        state: 'Test State',
        isActive: true,
        createdById: testUserId,
      },
    });
    testWarehouseId = warehouse.id;

    const greige = await prisma.greige_master.create({
      data: {
        greigeCode: `${testPrefix}_GRG`,
        greigeName: `${testPrefix} Greige`,
        greigeWidth: 63,
        composition: '100% Cotton',
        isActive: true,
        createdById: testUserId,
      },
    });
    testGreigeId = greige.id;
    testMaterialId = await ensureMaterialRecord(testGreigeId, 'GREIGE');
  });

  beforeEach(async () => {
    // A lot with 100m consumed and nothing available — the state after a full issue to a mill
    const stock = await prisma.greige_stock.create({
      data: {
        greigeId: testGreigeId,
        warehouseId: testWarehouseId,
        greigeWidth: 63,
        receivedDate: new Date(),
        quantityAvailable: 0,
        quantityConsumed: 100,
        purchaseCost: 42,
        status: 'EXHAUSTED',
        createdById: testUserId,
      },
    });
    testStockId = stock.id;
  });

  afterEach(async () => {
    await prisma.greige_stock_transaction.deleteMany({ where: { stockId: testStockId } });
    await prisma.greige_stock.deleteMany({ where: { id: testStockId } });
  });

  afterAll(async () => {
    try {
      await prisma.stock_levels.deleteMany({ where: { warehouseId: testWarehouseId } });
      await prisma.materials.deleteMany({ where: { id: testMaterialId } });
      await prisma.greige_master.deleteMany({ where: { greigeCode: { startsWith: testPrefix } } });
      await prisma.warehouses.deleteMany({ where: { warehouseCode: { startsWith: testPrefix } } });
      await prisma.users.deleteMany({ where: { email: `${testPrefix}@test.com` } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  it('credits the lot, writes the RETURN ledger row, and syncs stock_levels', async () => {
    const before = await prisma.stock_levels.findFirst({
      where: { materialId: testMaterialId, warehouseId: testWarehouseId },
    });
    const beforeQty = before ? Number(before.quantity) : 0;

    const updated = await greigeStockService.returnGreigeStock(testStockId, 40, testUserId, undefined, {
      referenceType: 'JOB_WORK_ORDER',
      referenceId: 'test-jwo-id',
      notes: 'test unprocessed return',
    });

    expect(Number(updated.quantityAvailable)).toBe(40);
    expect(Number(updated.quantityConsumed)).toBe(60);
    expect(updated.status).toBe('AVAILABLE');

    const txnRows = await prisma.greige_stock_transaction.findMany({
      where: { stockId: testStockId, transactionType: 'RETURN' },
    });
    expect(txnRows).toHaveLength(1);
    expect(Number(txnRows[0].quantity)).toBe(40);
    expect(Number(txnRows[0].balanceAfter)).toBe(40);
    expect(txnRows[0].referenceType).toBe('JOB_WORK_ORDER');
    expect(txnRows[0].performedById).toBe(testUserId);

    const after = await prisma.stock_levels.findFirst({
      where: { materialId: testMaterialId, warehouseId: testWarehouseId },
    });
    expect(after).toBeTruthy();
    expect(Number(after!.quantity)).toBeCloseTo(beforeQty + 40, 3);
  });

  it('refuses to return more than was consumed (cannot mint stock)', async () => {
    await expect(greigeStockService.returnGreigeStock(testStockId, 150, testUserId)).rejects.toThrow(
      /only 100m of this lot is recorded as consumed/
    );

    const lot = await prisma.greige_stock.findUnique({ where: { id: testStockId } });
    expect(Number(lot!.quantityAvailable)).toBe(0);
    expect(Number(lot!.quantityConsumed)).toBe(100);
  });

  it('is the exact inverse of consumeGreigeStock (round trip leaves the lot unchanged)', async () => {
    await greigeStockService.returnGreigeStock(testStockId, 30, testUserId);
    await greigeStockService.consumeGreigeStock(testStockId, 30, testUserId, undefined, {
      referenceType: 'JOB_WORK_ORDER',
      referenceId: 'test-jwo-id',
    });

    const lot = await prisma.greige_stock.findUnique({ where: { id: testStockId } });
    expect(Number(lot!.quantityAvailable)).toBe(0);
    expect(Number(lot!.quantityConsumed)).toBe(100);
  });
});
