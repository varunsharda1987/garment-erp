/**
 * Unit Tests for PO Status Manager Service
 *
 * Tests state machine validation:
 * 1. Status transitions are forward-only
 * 2. Cannot cancel received PO
 * 3. Cannot cancel partially received PO
 * 4. Send PO requires DRAFT or READY_FOR_PROCESSING status
 * 5. Acknowledge PO requires SENT status
 * 6. GRN receipt updates PO status correctly
 */

import { sendPO, acknowledgePO, cancelPO, updatePOReceivingStatus } from '../po-status-manager.service';
import prisma from '../../config/database';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

describe('POStatusManagerService', () => {
  const testPrefix = `TEST_POSM_${Date.now()}`;
  let testUserId: string;
  let testSupplierId: string;
  let testMaterialId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // Create test user
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

    // Create test supplier
    const supplier = await prisma.suppliers.create({
      data: {
        code: `${testPrefix}_SUP`,
        name: `${testPrefix} Test Supplier`,
        isActive: true,
        createdById: testUserId,
      },
    });
    testSupplierId = supplier.id;

    // Create test material category
    testCategoryId = `${testPrefix}_CAT`;
    await prisma.material_categories.create({
      data: {
        id: testCategoryId,
        name: `${testPrefix} Test Category`,
        isActive: true,
      },
    });

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
      await prisma.purchase_order_items.deleteMany({
        where: { purchase_orders: { poNumber: { startsWith: testPrefix } } },
      });
      await prisma.purchase_orders.deleteMany({
        where: { poNumber: { startsWith: testPrefix } },
      });
      await prisma.materials.deleteMany({
        where: { code: { startsWith: testPrefix } },
      });
      await prisma.material_categories.deleteMany({
        where: { id: { startsWith: testPrefix } },
      });
      await prisma.suppliers.deleteMany({
        where: { code: { startsWith: testPrefix } },
      });
      await prisma.users.deleteMany({
        where: { email: `${testPrefix}@test.com` },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  async function createTestPO(status: string, poNumber: string) {
    return prisma.purchase_orders.create({
      data: {
        id: `${testPrefix}_${poNumber}`,
        poNumber: `${testPrefix}_${poNumber}`,
        supplierId: testSupplierId,
        status: status as any,
        poDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount: 10000,
        createdById: testUserId,
        userId: testUserId,
        purchase_order_items: {
          create: {
            id: `${testPrefix}_${poNumber}_ITEM`,
            materialId: testMaterialId,
            orderedQuantity: 100,
            receivedQuantity: status === 'RECEIVED' ? 100 : status === 'PARTIALLY_RECEIVED' ? 50 : 0,
            unitPrice: 100,
            totalPrice: 10000,
            unit: 'PIECE',
          },
        },
      },
    });
  }

  describe('sendPO', () => {
    it('should send PO from DRAFT status', async () => {
      const po = await createTestPO('DRAFT', 'SEND_DRAFT');

      const result = await sendPO(po.id, testUserId);

      expect(result.success).toBe(true);

      const updatedPO = await prisma.purchase_orders.findUnique({
        where: { id: po.id },
      });
      expect(updatedPO?.status).toBe('SENT');
    });

    it('should send PO from READY_FOR_PROCESSING status', async () => {
      const po = await createTestPO('READY_FOR_PROCESSING', 'SEND_READY');

      const result = await sendPO(po.id, testUserId);

      expect(result.success).toBe(true);

      const updatedPO = await prisma.purchase_orders.findUnique({
        where: { id: po.id },
      });
      expect(updatedPO?.status).toBe('SENT');
    });

    it('should reject sending already SENT PO', async () => {
      const po = await createTestPO('SENT', 'SEND_SENT');

      await expect(sendPO(po.id, testUserId)).rejects.toThrow('Cannot send PO with status "SENT"');
    });

    it('should reject sending RECEIVED PO', async () => {
      const po = await createTestPO('RECEIVED', 'SEND_RECV');

      await expect(sendPO(po.id, testUserId)).rejects.toThrow('Cannot send PO with status "RECEIVED"');
    });
  });

  describe('acknowledgePO', () => {
    it('should acknowledge PO from SENT status', async () => {
      const po = await createTestPO('SENT', 'ACK_SENT');

      const result = await acknowledgePO(po.id, testUserId);

      expect(result.success).toBe(true);

      const updatedPO = await prisma.purchase_orders.findUnique({
        where: { id: po.id },
      });
      expect(updatedPO?.status).toBe('ACKNOWLEDGED');
    });

    it('should reject acknowledging DRAFT PO', async () => {
      const po = await createTestPO('DRAFT', 'ACK_DRAFT');

      await expect(acknowledgePO(po.id, testUserId)).rejects.toThrow(
        'Cannot acknowledge PO with status "DRAFT". Must be SENT.'
      );
    });

    it('should reject acknowledging already ACKNOWLEDGED PO', async () => {
      const po = await createTestPO('ACKNOWLEDGED', 'ACK_ACK');

      await expect(acknowledgePO(po.id, testUserId)).rejects.toThrow('Must be SENT');
    });
  });

  describe('cancelPO', () => {
    it('should cancel DRAFT PO', async () => {
      const po = await createTestPO('DRAFT', 'CAN_DRAFT');

      const result = await cancelPO(po.id, 'Test cancellation', testUserId);

      expect(result.success).toBe(true);

      const updatedPO = await prisma.purchase_orders.findUnique({
        where: { id: po.id },
      });
      expect(updatedPO?.status).toBe('CANCELLED');
    });

    it('should cancel SENT PO', async () => {
      const po = await createTestPO('SENT', 'CAN_SENT');

      const result = await cancelPO(po.id, 'Test cancellation', testUserId);

      expect(result.success).toBe(true);

      const updatedPO = await prisma.purchase_orders.findUnique({
        where: { id: po.id },
      });
      expect(updatedPO?.status).toBe('CANCELLED');
    });

    it('should reject cancelling RECEIVED PO', async () => {
      const po = await createTestPO('RECEIVED', 'CAN_RECV');

      await expect(cancelPO(po.id, 'Test', testUserId)).rejects.toThrow('Cannot cancel PO with status "RECEIVED"');
    });

    it('should reject cancelling PARTIALLY_RECEIVED PO', async () => {
      const po = await createTestPO('PARTIALLY_RECEIVED', 'CAN_PART');

      await expect(cancelPO(po.id, 'Test', testUserId)).rejects.toThrow(
        'Cannot cancel PO that has been partially received'
      );
    });

    it('should reject cancelling already CANCELLED PO', async () => {
      const po = await createTestPO('CANCELLED', 'CAN_CAN');

      await expect(cancelPO(po.id, 'Test', testUserId)).rejects.toThrow('Cannot cancel PO with status "CANCELLED"');
    });
  });

  describe('updatePOReceivingStatus', () => {
    it('should update to PARTIALLY_RECEIVED when some items received', async () => {
      const po = await createTestPO('SENT', 'RECV_PART');

      // Update item to partially received
      await prisma.purchase_order_items.updateMany({
        where: { poId: po.id },
        data: { receivedQuantity: 50 },
      });

      const newStatus = await updatePOReceivingStatus(po.id);

      expect(newStatus).toBe('PARTIALLY_RECEIVED');
    });

    it('should update to RECEIVED when all items fully received', async () => {
      const po = await createTestPO('SENT', 'RECV_FULL');

      // Update item to fully received
      await prisma.purchase_order_items.updateMany({
        where: { poId: po.id },
        data: { receivedQuantity: 100 },
      });

      const newStatus = await updatePOReceivingStatus(po.id);

      expect(newStatus).toBe('RECEIVED');
    });

    it('should not downgrade status when nothing received', async () => {
      const po = await createTestPO('ACKNOWLEDGED', 'RECV_NONE');

      const newStatus = await updatePOReceivingStatus(po.id);

      expect(newStatus).toBe('ACKNOWLEDGED');
    });
  });

  describe('Status Transition Rules (Forward-Only)', () => {
    it('should not allow transition from RECEIVED back to SENT', async () => {
      const po = await createTestPO('RECEIVED', 'RULE_RECV');

      await expect(sendPO(po.id, testUserId)).rejects.toThrow();
    });

    it('should not allow transition from PARTIALLY_RECEIVED back to DRAFT', async () => {
      const po = await createTestPO('PARTIALLY_RECEIVED', 'RULE_PART');

      // Attempt to "unsend" by cancelling - should fail
      await expect(cancelPO(po.id, 'Test', testUserId)).rejects.toThrow();
    });

    it('should throw error for non-existent PO', async () => {
      await expect(sendPO('non-existent-id', testUserId)).rejects.toThrow('PO not found');
    });
  });
});
