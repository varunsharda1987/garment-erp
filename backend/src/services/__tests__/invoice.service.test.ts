/**
 * Unit Tests for Invoice Service
 *
 * Tests critical financial reconciliation operations:
 * 1. Invoice totals correct (subtotal + GST = grand total)
 * 2. Payment allocation matches (paidAmount + balanceAmount = totalAmount)
 * 3. Duplicate payment detection (24h window)
 * 4. Status transitions (PENDING → PARTIALLY_PAID → PAID)
 * 5. Cannot overpay (payment > balance rejected)
 * 6. Invoice number generation unique
 */

import { invoiceService } from '../invoice.service';
import prisma from '../../config/database';
import { Decimal } from '@prisma/client/runtime/library';

// Mock logger to avoid noise in tests
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

describe('InvoiceService', () => {
  const testPrefix = `TEST_INV_${Date.now()}`;
  let testUserId: string;
  let testCustomerId: string;
  let testOrderId: string;
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

    // Get or create a test state (for GST calculations)
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

    // Create test order
    const order = await prisma.orders.create({
      data: {
        id: `${testPrefix}_ORD_ID`,
        orderNumber: `${testPrefix}_ORD`,
        customerId: testCustomerId,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
        totalQuantity: 100,
        totalAmount: 10000,
        createdById: testUserId,
      },
    });
    testOrderId = order.id;

    // Set the company state ID for GST calculations
    process.env.COMPANY_STATE_ID = testStateId;
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order of dependencies
      await prisma.payments.deleteMany({
        where: {
          invoices: {
            invoiceNumber: { startsWith: 'INV-' },
            customerId: testCustomerId,
          },
        },
      });
      await prisma.invoice_items.deleteMany({
        where: {
          invoice: {
            customerId: testCustomerId,
          },
        },
      });
      await prisma.invoices.deleteMany({
        where: { customerId: testCustomerId },
      });
      await prisma.orders.deleteMany({
        where: { orderNumber: { startsWith: testPrefix } },
      });
      await prisma.customers.deleteMany({
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

  describe('Invoice Creation - Totals Calculation', () => {
    it('should calculate totalAmount as subtotal + taxAmount', async () => {
      const subtotal = 10000;

      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        createdById: testUserId,
      });

      const actualSubtotal = parseFloat(invoice.subtotal.toString());
      const actualTax = parseFloat(invoice.taxAmount.toString());
      const actualTotal = parseFloat(invoice.totalAmount.toString());

      expect(actualSubtotal).toBe(subtotal);
      expect(actualTotal).toBeCloseTo(actualSubtotal + actualTax, 2);
    });

    it('should set balanceAmount equal to totalAmount for new invoice', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 5000,
        createdById: testUserId,
      });

      const totalAmount = parseFloat(invoice.totalAmount.toString());
      const balanceAmount = parseFloat(invoice.balanceAmount.toString());

      expect(balanceAmount).toBe(totalAmount);
      expect(parseFloat(invoice.paidAmount.toString())).toBe(0);
    });

    it('should set initial status to PENDING', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 5000,
        createdById: testUserId,
      });

      expect(invoice.status).toBe('PENDING');
    });
  });

  describe('Payment Allocation', () => {
    let testInvoiceId: string;
    let testInvoiceTotal: number;

    beforeEach(async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 10000,
        createdById: testUserId,
      });
      testInvoiceId = invoice.id;
      testInvoiceTotal = parseFloat(invoice.totalAmount.toString());
    });

    it('should update paidAmount and balanceAmount correctly', async () => {
      const paymentAmount = 5000;

      await invoiceService.recordPayment({
        invoiceId: testInvoiceId,
        amount: paymentAmount,
        paymentMethod: 'BANK_TRANSFER',
        receivedById: testUserId,
      });

      const updatedInvoice = await invoiceService.getInvoiceById(testInvoiceId);
      const paidAmount = parseFloat(updatedInvoice.paidAmount.toString());
      const balanceAmount = parseFloat(updatedInvoice.balanceAmount.toString());

      expect(paidAmount).toBe(paymentAmount);
      expect(balanceAmount).toBe(testInvoiceTotal - paymentAmount);
    });

    it('should accumulate multiple payments correctly', async () => {
      const payment1 = 3000;
      const payment2 = 2000;

      await invoiceService.recordPayment({
        invoiceId: testInvoiceId,
        amount: payment1,
        paymentMethod: 'CASH',
        receivedById: testUserId,
      });

      // Wait a bit to avoid duplicate detection
      await new Promise((r) => setTimeout(r, 100));

      await invoiceService.recordPayment({
        invoiceId: testInvoiceId,
        amount: payment2,
        paymentMethod: 'UPI',
        receivedById: testUserId,
      });

      const updatedInvoice = await invoiceService.getInvoiceById(testInvoiceId);
      const paidAmount = parseFloat(updatedInvoice.paidAmount.toString());

      expect(paidAmount).toBe(payment1 + payment2);
    });
  });

  describe('Duplicate Payment Detection', () => {
    let testInvoiceId: string;

    beforeEach(async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 20000,
        createdById: testUserId,
      });
      testInvoiceId = invoice.id;
    });

    it('should detect duplicate payment within 24 hours', async () => {
      const paymentAmount = 5000;

      // First payment succeeds
      await invoiceService.recordPayment({
        invoiceId: testInvoiceId,
        amount: paymentAmount,
        paymentMethod: 'BANK_TRANSFER',
        receivedById: testUserId,
      });

      // Same amount within 24h should be rejected
      await expect(
        invoiceService.recordPayment({
          invoiceId: testInvoiceId,
          amount: paymentAmount,
          paymentMethod: 'BANK_TRANSFER',
          receivedById: testUserId,
        })
      ).rejects.toThrow('Possible duplicate payment detected');
    });

    it('should allow different amounts even within 24 hours', async () => {
      await invoiceService.recordPayment({
        invoiceId: testInvoiceId,
        amount: 5000,
        paymentMethod: 'BANK_TRANSFER',
        receivedById: testUserId,
      });

      // Different amount should succeed
      await expect(
        invoiceService.recordPayment({
          invoiceId: testInvoiceId,
          amount: 3000,
          paymentMethod: 'BANK_TRANSFER',
          receivedById: testUserId,
        })
      ).resolves.toBeTruthy();
    });
  });

  describe('Status Transitions', () => {
    it('should transition from PENDING to PARTIALLY_PAID', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 10000,
        createdById: testUserId,
      });

      expect(invoice.status).toBe('PENDING');

      const totalAmount = parseFloat(invoice.totalAmount.toString());

      await invoiceService.recordPayment({
        invoiceId: invoice.id,
        amount: totalAmount / 2,
        paymentMethod: 'CASH',
        receivedById: testUserId,
      });

      const updatedInvoice = await invoiceService.getInvoiceById(invoice.id);
      expect(updatedInvoice.status).toBe('PARTIALLY_PAID');
    });

    it('should transition from PARTIALLY_PAID to PAID', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 10000,
        createdById: testUserId,
      });

      const totalAmount = parseFloat(invoice.totalAmount.toString());

      // First payment - 40%
      await invoiceService.recordPayment({
        invoiceId: invoice.id,
        amount: Math.floor(totalAmount * 0.4),
        paymentMethod: 'CASH',
        receivedById: testUserId,
      });

      // Second payment - remaining 60% (different amount to avoid duplicate detection)
      await invoiceService.recordPayment({
        invoiceId: invoice.id,
        amount: totalAmount - Math.floor(totalAmount * 0.4),
        paymentMethod: 'BANK_TRANSFER',
        receivedById: testUserId,
      });

      const updatedInvoice = await invoiceService.getInvoiceById(invoice.id);
      expect(updatedInvoice.status).toBe('PAID');
      expect(parseFloat(updatedInvoice.balanceAmount.toString())).toBe(0);
    });

    it('should set status to OVERDUE when past due date without payment', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        subtotal: 10000,
        createdById: testUserId,
      });

      expect(invoice.status).toBe('OVERDUE');
    });
  });

  describe('Overpayment Prevention', () => {
    it('should reject payment exceeding balance', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 10000,
        createdById: testUserId,
      });

      const totalAmount = parseFloat(invoice.totalAmount.toString());

      await expect(
        invoiceService.recordPayment({
          invoiceId: invoice.id,
          amount: totalAmount + 1000,
          paymentMethod: 'CASH',
          receivedById: testUserId,
        })
      ).rejects.toThrow('exceeds balance');
    });

    it('should reject zero or negative payment amounts', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 10000,
        createdById: testUserId,
      });

      await expect(
        invoiceService.recordPayment({
          invoiceId: invoice.id,
          amount: 0,
          paymentMethod: 'CASH',
          receivedById: testUserId,
        })
      ).rejects.toThrow('must be greater than 0');

      await expect(
        invoiceService.recordPayment({
          invoiceId: invoice.id,
          amount: -100,
          paymentMethod: 'CASH',
          receivedById: testUserId,
        })
      ).rejects.toThrow('must be greater than 0');
    });
  });

  describe('Invoice Number Generation', () => {
    it('should generate unique sequential invoice numbers', async () => {
      // Create invoices sequentially to test proper number generation
      const invoice1 = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 1000,
        createdById: testUserId,
      });

      const invoice2 = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 2000,
        createdById: testUserId,
      });

      const invoice3 = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 3000,
        createdById: testUserId,
      });

      const invoiceNumbers = [invoice1.invoiceNumber, invoice2.invoiceNumber, invoice3.invoiceNumber];
      const uniqueNumbers = new Set(invoiceNumbers);

      expect(uniqueNumbers.size).toBe(3);
    });

    it('should follow INV-YYMM-NNNN format', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 1000,
        createdById: testUserId,
      });

      const pattern = /^INV-\d{4}-\d{4}$/;
      expect(invoice.invoiceNumber).toMatch(pattern);
    });
  });

  describe('Invoice Deletion Constraints', () => {
    it('should not allow deletion of invoice with payments', async () => {
      const invoice = await invoiceService.createInvoice({
        orderId: testOrderId,
        customerId: testCustomerId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 10000,
        createdById: testUserId,
      });

      await invoiceService.recordPayment({
        invoiceId: invoice.id,
        amount: 1000,
        paymentMethod: 'CASH',
        receivedById: testUserId,
      });

      await expect(invoiceService.deleteInvoice(invoice.id)).rejects.toThrow(
        'Cannot delete invoice with recorded payments'
      );
    });
  });
});
