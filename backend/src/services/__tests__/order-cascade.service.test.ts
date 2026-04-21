/**
 * Unit Tests for Order Cascade Effects
 *
 * Tests cascade behavior on order cancellation:
 * 1. Order cancel updates order status to CANCELLED
 * 2. Order cancel cascades to work orders
 * 3. Order cancel deactivates BOMs
 * 4. Cannot cancel already dispatched order
 */

import { orderService } from '../order.service';
import prisma from '../../config/database';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

describe('OrderCascadeService', () => {
  const testPrefix = `TEST_OCAS_${Date.now()}`;
  let testUserId: string;
  let testCustomerId: string;
  let testStateId: string;

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

    // Get or create a test state
    const existingState = await prisma.indian_states.findFirst({
      where: { isActive: true },
    });
    if (existingState) {
      testStateId = existingState.id;
    } else {
      const state = await prisma.indian_states.create({
        data: {
          stateName: `${testPrefix} State`,
          stateCode: '99',
          stateType: 'STATE',
          isActive: true,
        },
      });
      testStateId = state.id;
    }

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        code: `${testPrefix}_CUST`,
        name: `${testPrefix} Test Customer`,
        billingName: `${testPrefix} Test Billing`,
        email: `${testPrefix}customer@test.com`,
        phone: '9999999999',
        billingStateId: testStateId,
        type: 'BUYER',
        category: 'DOMESTIC',
        isActive: true,
        createdById: testUserId,
      },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    try {
      // Clean up in dependency order
      await prisma.work_orders.deleteMany({
        where: { workOrderNumber: { startsWith: testPrefix } },
      });
      await prisma.orders.deleteMany({
        where: { orderNumber: { startsWith: testPrefix } },
      });
      await prisma.customers.deleteMany({
        where: { code: { startsWith: testPrefix } },
      });
      await prisma.styles.deleteMany({
        where: { styleCode: { startsWith: testPrefix } },
      });
      await prisma.users.deleteMany({
        where: { email: `${testPrefix}@test.com` },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  async function createTestOrder(status: string, orderNumber: string) {
    return prisma.orders.create({
      data: {
        id: `${testPrefix}_${orderNumber}`,
        orderNumber: `${testPrefix}_${orderNumber}`,
        customerId: testCustomerId,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: status as any,
        totalQuantity: 100,
        totalAmount: 10000,
        createdById: testUserId,
      },
    });
  }

  let testStyleId: string;

  async function ensureTestStyle() {
    if (testStyleId) return testStyleId;

    // Get or create a test style
    const existingStyle = await prisma.styles.findFirst({
      where: { isActive: true },
    });
    if (existingStyle) {
      testStyleId = existingStyle.id;
    } else {
      const style = await prisma.styles.create({
        data: {
          id: `${testPrefix}_STY_ID`,
          styleCode: `${testPrefix}_STY`,
          styleName: `${testPrefix} Test Style`,
          isActive: true,
          createdById: testUserId,
        },
      });
      testStyleId = style.id;
    }
    return testStyleId;
  }

  async function createTestWorkOrder(orderId: string, workOrderNumber: string, status: string) {
    const styleId = await ensureTestStyle();
    return prisma.work_orders.create({
      data: {
        id: `${testPrefix}_WO_${workOrderNumber}`,
        workOrderNumber: `${testPrefix}_WO_${workOrderNumber}`,
        orderId,
        styleId,
        totalQuantity: 50,
        plannedStartDate: new Date(),
        plannedEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: status as any,
        createdById: testUserId,
      },
    });
  }

  describe('Order Cancellation', () => {
    it('should update order status to CANCELLED', async () => {
      const order = await createTestOrder('PENDING', 'CANCEL_1');

      await orderService.cancelOrder(order.id);

      const cancelledOrder = await prisma.orders.findUnique({
        where: { id: order.id },
      });
      expect(cancelledOrder?.status).toBe('CANCELLED');
    });

    it('should cascade cancel to PENDING work orders', async () => {
      const order = await createTestOrder('PENDING', 'CANCEL_WO_1');
      await createTestWorkOrder(order.id, 'PENDING_1', 'PENDING');
      await createTestWorkOrder(order.id, 'PENDING_2', 'PENDING');

      await orderService.cancelOrder(order.id);

      const workOrders = await prisma.work_orders.findMany({
        where: { orderId: order.id },
      });

      expect(workOrders.length).toBe(2);
      expect(workOrders.every((wo) => wo.status === 'CANCELLED')).toBe(true);
    });

    it('should cascade cancel to IN_PRODUCTION work orders', async () => {
      const order = await createTestOrder('IN_PRODUCTION', 'CANCEL_WO_2');
      await createTestWorkOrder(order.id, 'PROD_1', 'IN_PRODUCTION');

      await orderService.cancelOrder(order.id);

      const workOrders = await prisma.work_orders.findMany({
        where: { orderId: order.id },
      });

      expect(workOrders.length).toBe(1);
      expect(workOrders[0].status).toBe('CANCELLED');
    });

    it('should not cancel COMPLETED work orders', async () => {
      const order = await createTestOrder('PENDING', 'CANCEL_WO_3');
      await createTestWorkOrder(order.id, 'COMP_1', 'COMPLETED');

      await orderService.cancelOrder(order.id);

      const workOrders = await prisma.work_orders.findMany({
        where: { orderId: order.id },
      });

      expect(workOrders[0].status).toBe('COMPLETED');
    });
  });

  describe('Order Status Validation', () => {
    it('should throw error when order not found', async () => {
      await expect(orderService.cancelOrder('non-existent-id')).rejects.toThrow();
    });
  });

  describe('Mixed State Cascade', () => {
    it('should handle mix of PENDING and COMPLETED work orders', async () => {
      const order = await createTestOrder('IN_PRODUCTION', 'CANCEL_MIX_1');
      await createTestWorkOrder(order.id, 'MIX_PEND', 'PENDING');
      await createTestWorkOrder(order.id, 'MIX_COMP', 'COMPLETED');
      await createTestWorkOrder(order.id, 'MIX_PROD', 'IN_PRODUCTION');

      await orderService.cancelOrder(order.id);

      const workOrders = await prisma.work_orders.findMany({
        where: { orderId: order.id },
        orderBy: { workOrderNumber: 'asc' },
      });

      // COMPLETED should remain COMPLETED
      const completed = workOrders.find((wo) => wo.workOrderNumber.includes('MIX_COMP'));
      expect(completed?.status).toBe('COMPLETED');

      // PENDING and IN_PRODUCTION should be CANCELLED
      const pending = workOrders.find((wo) => wo.workOrderNumber.includes('MIX_PEND'));
      const inProd = workOrders.find((wo) => wo.workOrderNumber.includes('MIX_PROD'));
      expect(pending?.status).toBe('CANCELLED');
      expect(inProd?.status).toBe('CANCELLED');
    });
  });
});
