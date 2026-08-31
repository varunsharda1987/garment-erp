/**
 * Unit Tests for Material Sync Helper
 *
 * Tests the critical helper functions that all stock services must use:
 * 1. ensureMaterialRecord() - Creates materials record if missing
 * 2. syncStockLevelQuantity() - Keeps stock_levels in sync
 */

import { ensureMaterialRecord, syncStockLevelQuantity } from '../helpers/material-sync.helper';
import prisma from '../../config/database';
import { only } from '../../utils/prisma-test-guard';

describe('Material Sync Helper', () => {
  const testPrefix = `TEST_${Date.now()}`;
  let testGreigeId: string;
  let testMaterialId: string;
  let testWarehouseId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test user first (required for createdById)
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

    // Create test warehouse
    const warehouse = await prisma.warehouses.create({
      data: {
        warehouseCode: `${testPrefix}_WH`,
        warehouseName: `${testPrefix} Test Warehouse`,
        warehouseType: 'RAW_MATERIAL',
        city: 'Test City',
        state: 'Test State',
        isActive: true,
        createdById: testUserId,
      },
    });
    testWarehouseId = warehouse.id;
  });

  afterAll(async () => {
    try {
      await prisma.stock_levels.deleteMany({
        where: { warehouseId: only(testWarehouseId) },
      });
      await prisma.materials.deleteMany({
        where: { code: { startsWith: testPrefix } },
      });
      await prisma.greige_master.deleteMany({
        where: { greigeCode: { startsWith: testPrefix } },
      });
      await prisma.warehouses.deleteMany({
        where: { warehouseCode: { startsWith: testPrefix } },
      });
      await prisma.users.deleteMany({
        where: { email: `${testPrefix}@test.com` },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('ensureMaterialRecord', () => {
    beforeEach(async () => {
      // Create a test greige master for each test
      const greige = await prisma.greige_master.create({
        data: {
          greigeCode: `${testPrefix}_GRG_${Date.now()}`,
          greigeName: `Test Greige ${Date.now()}`,
          greigeWidth: 44,
          composition: '100% Cotton',
          isActive: true,
          createdById: testUserId,
        },
      });
      testGreigeId = greige.id;
    });

    it('should create materials record when it does not exist', async () => {
      const materialId = await ensureMaterialRecord(testGreigeId, 'GREIGE');

      expect(materialId).toBeTruthy();

      const material = await prisma.materials.findUnique({
        where: { id: materialId },
      });
      expect(material).toBeTruthy();
      expect(material?.greigeId).toBe(testGreigeId);
      expect(material?.materialType).toBe('GREIGE');
    });

    it('should return existing materialId when materials record already exists', async () => {
      const firstMaterialId = await ensureMaterialRecord(testGreigeId, 'GREIGE');
      const secondMaterialId = await ensureMaterialRecord(testGreigeId, 'GREIGE');

      expect(secondMaterialId).toBe(firstMaterialId);

      const count = await prisma.materials.count({
        where: { greigeId: testGreigeId },
      });
      expect(count).toBe(1);
    });

    it('should throw error for unknown master type', async () => {
      await expect(ensureMaterialRecord(testGreigeId, 'UNKNOWN_TYPE')).rejects.toThrow(
        'Unknown master type: UNKNOWN_TYPE'
      );
    });

    it('should throw error when master record does not exist', async () => {
      await expect(ensureMaterialRecord('non-existent-id', 'GREIGE')).rejects.toThrow('GREIGE master not found');
    });
  });

  describe('syncStockLevelQuantity', () => {
    beforeEach(async () => {
      const greige = await prisma.greige_master.create({
        data: {
          greigeCode: `${testPrefix}_GRG_SYNC_${Date.now()}`,
          greigeName: `Test Greige Sync ${Date.now()}`,
          greigeWidth: 44,
          composition: '100% Polyester',
          isActive: true,
          createdById: testUserId,
        },
      });
      testGreigeId = greige.id;

      testMaterialId = await ensureMaterialRecord(testGreigeId, 'GREIGE');

      await prisma.stock_levels.create({
        data: {
          materialId: testMaterialId,
          warehouseId: testWarehouseId,
          quantity: 100,
          unit: 'METER',
          valuationRate: 50,
          stockValue: 5000,
        },
      });
    });

    it('should increment stock level quantity for positive change', async () => {
      await syncStockLevelQuantity(testMaterialId, 50);

      const stockLevel = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      expect(stockLevel?.quantity.toNumber()).toBe(150);
    });

    it('should decrement stock level quantity for negative change', async () => {
      await syncStockLevelQuantity(testMaterialId, -30);

      const stockLevel = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      expect(stockLevel?.quantity.toNumber()).toBe(70);
    });

    it('should not change quantity for zero change', async () => {
      await syncStockLevelQuantity(testMaterialId, 0);

      const stockLevel = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      expect(stockLevel?.quantity.toNumber()).toBe(100);
    });

    it('should update lastUpdated timestamp on sync', async () => {
      const before = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      const initialTime = before?.lastUpdated;

      await new Promise((r) => setTimeout(r, 100));

      await syncStockLevelQuantity(testMaterialId, 10);

      const after = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      expect(after?.lastUpdated.getTime()).toBeGreaterThan(initialTime!.getTime());
    });

    it('should work within a transaction', async () => {
      await prisma.$transaction(async (tx) => {
        await syncStockLevelQuantity(testMaterialId, 25, undefined, undefined, tx);
      });

      const stockLevel = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      expect(stockLevel?.quantity.toNumber()).toBe(125);
    });

    it('should not throw when stock_levels entry does not exist', async () => {
      const nonExistentMaterialId = 'non-existent-material-id';
      await expect(syncStockLevelQuantity(nonExistentMaterialId, 50)).resolves.not.toThrow();
    });
  });
});
