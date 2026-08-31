/**
 * Unit Tests for Stock Level Service
 *
 * Tests critical stock operations:
 * 1. increaseStock - Adding stock with WAC calculation
 * 2. decreaseStock - Reducing stock with validation
 * 3. getMaterialsBelowReorderLevel - Reorder alerts
 */

import stockLevelService from '../stockLevel.service';
import prisma from '../../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { Unit } from '@prisma/client';
import { only } from '../../utils/prisma-test-guard';

describe('StockLevelService', () => {
  const testPrefix = `TEST_SLS_${Date.now()}`;
  let testMaterialId: string;
  let testWarehouseId: string;
  let testWarehouse2Id: string;
  let testUserId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // Create test user first
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

    // Create test material category
    testCategoryId = `${testPrefix}_CAT`;
    await prisma.material_categories.create({
      data: {
        id: testCategoryId,
        name: `${testPrefix} Test Category`,
        isActive: true,
      },
    });

    // Create test warehouses
    const warehouse1 = await prisma.warehouses.create({
      data: {
        warehouseCode: `${testPrefix}_WH1`,
        warehouseName: `${testPrefix} Test Warehouse 1`,
        warehouseType: 'RAW_MATERIAL',
        city: 'Test City',
        state: 'Test State',
        isActive: true,
        createdById: testUserId,
      },
    });
    testWarehouseId = warehouse1.id;

    const warehouse2 = await prisma.warehouses.create({
      data: {
        warehouseCode: `${testPrefix}_WH2`,
        warehouseName: `${testPrefix} Test Warehouse 2`,
        warehouseType: 'RAW_MATERIAL',
        city: 'Test City 2',
        state: 'Test State',
        isActive: true,
        createdById: testUserId,
      },
    });
    testWarehouse2Id = warehouse2.id;

    // Create test material
    testMaterialId = `${testPrefix}_MAT`;
    await prisma.materials.create({
      data: {
        id: testMaterialId,
        code: `${testPrefix}_MAT`,
        name: `${testPrefix} Test Material`,
        categoryId: testCategoryId,
        materialType: 'OTHER',
        unit: 'PIECE',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.stock_levels.deleteMany({
        where: {
          OR: [{ warehouseId: only(testWarehouseId) }, { warehouseId: only(testWarehouse2Id) }],
        },
      });
      await prisma.materials.deleteMany({
        where: { code: { startsWith: testPrefix } },
      });
      await prisma.material_categories.deleteMany({
        where: { id: { startsWith: testPrefix } },
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

  beforeEach(async () => {
    await prisma.stock_levels.deleteMany({
      where: { materialId: only(testMaterialId) },
    });
  });

  describe('increaseStock', () => {
    it('should create new stock level when none exists', async () => {
      const result = await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(100),
        'PIECE' as Unit,
        new Decimal(10)
      );

      expect(result.quantity.toNumber()).toBe(100);
      expect(result.valuationRate?.toNumber()).toBe(10);
      expect(result.stockValue?.toNumber()).toBe(1000);
    });

    it('should add to existing stock level', async () => {
      await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(100),
        'PIECE' as Unit,
        new Decimal(10)
      );

      const result = await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(50),
        'PIECE' as Unit,
        new Decimal(10)
      );

      expect(result.quantity.toNumber()).toBe(150);
    });

    it('should calculate weighted average cost correctly', async () => {
      // Initial: 100 units at ₹10 = ₹1000
      await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(100),
        'PIECE' as Unit,
        new Decimal(10)
      );

      // Add: 50 units at ₹12 = ₹600
      const result = await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(50),
        'PIECE' as Unit,
        new Decimal(12)
      );

      // WAC: (1000 + 600) / 150 = 10.67
      expect(result.quantity.toNumber()).toBe(150);
      expect(result.stockValue?.toNumber()).toBeCloseTo(1600, 0);
      expect(result.valuationRate?.toNumber()).toBeCloseTo(10.67, 1);
    });

    it('should handle decimal quantities', async () => {
      const result = await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(10.5),
        'METER' as Unit,
        new Decimal(15.75)
      );

      expect(result.quantity.toNumber()).toBe(10.5);
      expect(result.valuationRate?.toNumber()).toBe(15.75);
    });

    it('should work within a transaction', async () => {
      await prisma.$transaction(async (tx) => {
        await stockLevelService.increaseStock(
          testMaterialId,
          testWarehouseId,
          new Decimal(200),
          'PIECE' as Unit,
          new Decimal(8),
          tx
        );
      });

      const stockLevel = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId, warehouseId: testWarehouseId },
      });
      expect(stockLevel?.quantity.toNumber()).toBe(200);
    });
  });

  describe('decreaseStock', () => {
    beforeEach(async () => {
      await stockLevelService.increaseStock(
        testMaterialId,
        testWarehouseId,
        new Decimal(100),
        'PIECE' as Unit,
        new Decimal(10)
      );
    });

    it('should decrease stock quantity correctly', async () => {
      const result = await stockLevelService.decreaseStock(testMaterialId, testWarehouseId, new Decimal(30));

      expect(result.quantity.toNumber()).toBe(70);
    });

    it('should update stock value proportionally on decrease', async () => {
      const before = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId },
      });
      expect(before?.stockValue?.toNumber()).toBe(1000);

      const result = await stockLevelService.decreaseStock(testMaterialId, testWarehouseId, new Decimal(30));

      // Stock value should be 70 * 10 = 700
      expect(result.stockValue?.toNumber()).toBe(700);
    });

    it('should throw error when decreasing below zero', async () => {
      await expect(stockLevelService.decreaseStock(testMaterialId, testWarehouseId, new Decimal(150))).rejects.toThrow(
        'Insufficient stock'
      );
    });

    it('should throw error when stock level does not exist', async () => {
      await expect(stockLevelService.decreaseStock(testMaterialId, testWarehouse2Id, new Decimal(10))).rejects.toThrow(
        'Stock level not found'
      );
    });

    it('should allow decreasing to exactly zero', async () => {
      const result = await stockLevelService.decreaseStock(testMaterialId, testWarehouseId, new Decimal(100));

      expect(result.quantity.toNumber()).toBe(0);
      expect(result.stockValue?.toNumber()).toBe(0);
    });

    it('should handle decimal decrease quantities', async () => {
      const result = await stockLevelService.decreaseStock(testMaterialId, testWarehouseId, new Decimal(10.5));

      expect(result.quantity.toNumber()).toBe(89.5);
    });

    it('should work within a transaction', async () => {
      await prisma.$transaction(async (tx) => {
        await stockLevelService.decreaseStock(testMaterialId, testWarehouseId, new Decimal(25), tx);
      });

      const stockLevel = await prisma.stock_levels.findFirst({
        where: { materialId: testMaterialId, warehouseId: testWarehouseId },
      });
      expect(stockLevel?.quantity.toNumber()).toBe(75);
    });
  });

  describe('getMaterialsBelowReorderLevel', () => {
    let testMaterial2Id: string;

    beforeAll(async () => {
      testMaterial2Id = `${testPrefix}_MAT2`;
      await prisma.materials.create({
        data: {
          id: testMaterial2Id,
          code: `${testPrefix}_MAT2`,
          name: `${testPrefix} Test Material 2`,
          categoryId: testCategoryId,
          materialType: 'OTHER',
          unit: 'PIECE',
          isActive: true,
          reorderLevel: 50,
        },
      });
    });

    afterAll(async () => {
      await prisma.stock_levels.deleteMany({
        where: { materialId: only(testMaterial2Id) },
      });
      await prisma.materials.delete({
        where: { id: only(testMaterial2Id) },
      });
    });

    it('should return materials below reorder level', async () => {
      await prisma.stock_levels.create({
        data: {
          materialId: testMaterial2Id,
          warehouseId: testWarehouseId,
          quantity: 30, // Below reorder level of 50
          unit: 'PIECE',
          reorderLevel: 50,
        },
      });

      const result = await stockLevelService.getMaterialsBelowReorderLevel();

      const found = result.find((r: any) => r.materialId === testMaterial2Id);
      expect(found).toBeTruthy();
      expect(found?.quantity.toNumber()).toBe(30);
    });

    it('should not return materials above reorder level', async () => {
      await prisma.stock_levels.updateMany({
        where: { materialId: only(testMaterial2Id) },
        data: { quantity: 100 }, // Above reorder level of 50
      });

      const result = await stockLevelService.getMaterialsBelowReorderLevel();

      const found = result.find((r: any) => r.materialId === testMaterial2Id);
      expect(found).toBeFalsy();
    });

    it('should filter by warehouse when provided', async () => {
      await prisma.stock_levels.updateMany({
        where: { materialId: only(testMaterial2Id) },
        data: { quantity: 25 },
      });

      const result = await stockLevelService.getMaterialsBelowReorderLevel(testWarehouse2Id);

      const found = result.find((r: any) => r.materialId === testMaterial2Id);
      expect(found).toBeFalsy();
    });

    it('should include materials at exactly reorder level', async () => {
      await prisma.stock_levels.updateMany({
        where: { materialId: only(testMaterial2Id) },
        data: { quantity: 50 }, // Equal to reorder level
      });

      const result = await stockLevelService.getMaterialsBelowReorderLevel();

      const found = result.find((r: any) => r.materialId === testMaterial2Id);
      expect(found).toBeTruthy();
    });
  });
});
