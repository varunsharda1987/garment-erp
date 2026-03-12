/**
 * Unit Tests for CreditNote Service
 * Tests CRUD operations, GST calculation integration, status transitions,
 * and number generation with mocked Prisma and GST service.
 */

// ============================================
// Mocks (must be before imports)
// ============================================

const mockTx = {
  credit_notes: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  invoices: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    credit_notes: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    invoices: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockTx)),
  },
}));

jest.mock('../gst.service', () => ({
  gstService: {
    calculateLineItemGST: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

import { CreditNoteService } from '../creditNote.service';
import prisma from '../../config/database';
import { gstService } from '../gst.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGstService = gstService as jest.Mocked<typeof gstService>;

// ============================================
// Test Suite
// ============================================

describe('CreditNoteService', () => {
  let service: CreditNoteService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set $transaction implementation after clearAllMocks
    (mockPrisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(mockTx));
    service = new CreditNoteService();
  });

  // ============================================
  // 1. generateCreditNoteNumber (tested via create)
  // ============================================
  describe('generateCreditNoteNumber (via create)', () => {
    const baseCreateInput = {
      invoiceId: 'inv-1',
      customerId: 'cust-1',
      reason: 'GOODS_RETURNED',
      items: [
        {
          description: 'Test item',
          hsnCode: '62114210',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    };

    const intrastateGST = {
      gstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      igstRate: 0,
      cgstAmount: 60,
      sgstAmount: 60,
      igstAmount: 0,
      taxAmount: 120,
      hsnCode: '62114210',
    };

    beforeEach(() => {
      // Default: invoice exists, intrastate
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue(intrastateGST);
      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({
        id: 'cn-id-1',
        creditNoteNumber: 'CN-001',
      });
    });

    it('should generate CN-001 when no previous credit notes exist', async () => {
      (mockPrisma.credit_notes.findFirst as jest.Mock).mockResolvedValue(null);

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.credit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditNoteNumber: 'CN-001',
          }),
        })
      );
    });

    it('should generate CN-004 when last credit note is CN-003', async () => {
      (mockPrisma.credit_notes.findFirst as jest.Mock).mockResolvedValue({
        creditNoteNumber: 'CN-003',
      });

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.credit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditNoteNumber: 'CN-004',
          }),
        })
      );
    });

    it('should pad number to 3 digits (CN-010)', async () => {
      (mockPrisma.credit_notes.findFirst as jest.Mock).mockResolvedValue({
        creditNoteNumber: 'CN-009',
      });

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.credit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditNoteNumber: 'CN-010',
          }),
        })
      );
    });
  });

  // ============================================
  // 2. create()
  // ============================================
  describe('create', () => {
    const createInput = {
      invoiceId: 'inv-1',
      customerId: 'cust-1',
      creditNoteDate: '2026-03-01',
      reason: 'GOODS_RETURNED',
      remarks: 'Returned due to defect',
      items: [
        {
          invoiceItemId: 'inv-item-1',
          description: 'Fabric Roll A',
          hsnCode: '52081390',
          quantity: 10,
          unitPrice: 500,
        },
        {
          description: 'Thread Spool',
          hsnCode: '54011010',
          quantity: 5,
          unitPrice: 200,
        },
      ],
    };

    beforeEach(() => {
      // generateCreditNoteNumber uses top-level prisma, not tx
      (mockPrisma.credit_notes.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should create intrastate credit note with CGST/SGST', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });

      // Item 1: 10 * 500 = 5000
      (mockGstService.calculateLineItemGST as jest.Mock)
        .mockResolvedValueOnce({
          gstRate: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          igstRate: 0,
          cgstAmount: 125,
          sgstAmount: 125,
          igstAmount: 0,
          taxAmount: 250,
          hsnCode: '52081390',
        })
        // Item 2: 5 * 200 = 1000
        .mockResolvedValueOnce({
          gstRate: 12,
          cgstRate: 6,
          sgstRate: 6,
          igstRate: 0,
          cgstAmount: 60,
          sgstAmount: 60,
          igstAmount: 0,
          taxAmount: 120,
          hsnCode: '54011010',
        });

      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({
        id: 'cn-id-1',
        creditNoteNumber: 'CN-001',
        status: 'DRAFT',
      });

      const result = await service.create(createInput, 'user-1');

      // Verify gstService was called correctly for each item
      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledTimes(2);
      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 5000,
        hsnSacCode: '52081390',
        isInterstate: false,
      });
      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 1000,
        hsnSacCode: '54011010',
        isInterstate: false,
      });

      // Verify create was called with aggregated totals
      // subtotal = 5000 + 1000 = 6000
      // totalCgst = 125 + 60 = 185
      // totalSgst = 125 + 60 = 185
      // totalIgst = 0
      // totalTax = 370
      // totalAmount = 6000 + 370 = 6370
      expect(mockTx.credit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditNoteNumber: 'CN-001',
            invoiceId: 'inv-1',
            customerId: 'cust-1',
            reason: 'GOODS_RETURNED',
            remarks: 'Returned due to defect',
            isInterstate: false,
            subtotal: 6000,
            cgstAmount: 185,
            sgstAmount: 185,
            igstAmount: 0,
            totalTax: 370,
            totalAmount: 6370,
            status: 'DRAFT',
            createdById: 'user-1',
          }),
        })
      );

      expect(result).toEqual({
        id: 'cn-id-1',
        creditNoteNumber: 'CN-001',
        status: 'DRAFT',
      });
    });

    it('should create interstate credit note with IGST', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: true,
      });

      // Single item: 10 * 500 = 5000
      const interstateInput = {
        invoiceId: 'inv-1',
        customerId: 'cust-1',
        reason: 'PRICE_ADJUSTMENT',
        items: [
          {
            description: 'Fabric Roll A',
            hsnCode: '52081390',
            quantity: 10,
            unitPrice: 500,
          },
        ],
      };

      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 5,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 5,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 250,
        taxAmount: 250,
        hsnCode: '52081390',
      });

      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({
        id: 'cn-id-2',
        creditNoteNumber: 'CN-001',
        isInterstate: true,
      });

      await service.create(interstateInput, 'user-1');

      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 5000,
        hsnSacCode: '52081390',
        isInterstate: true,
      });

      expect(mockTx.credit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isInterstate: true,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 250,
            totalTax: 250,
            totalAmount: 5250,
          }),
        })
      );
    });

    it('should throw error when invoice is not found', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(
          {
            invoiceId: 'non-existent',
            customerId: 'cust-1',
            reason: 'GOODS_RETURNED',
            items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
          },
          'user-1'
        )
      ).rejects.toThrow('Invoice not found');
    });

    it('should handle items with zero quantity (lineTotal = 0)', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });

      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        taxAmount: 0,
        hsnCode: null,
      });

      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({
        id: 'cn-id-3',
        creditNoteNumber: 'CN-001',
      });

      await service.create(
        {
          invoiceId: 'inv-1',
          customerId: 'cust-1',
          reason: 'OTHER',
          items: [{ description: 'Zero qty item', quantity: 0, unitPrice: 500 }],
        },
        'user-1'
      );

      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 0,
        hsnSacCode: undefined,
        isInterstate: false,
      });

      expect(mockTx.credit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
            totalAmount: 0,
          }),
        })
      );
    });

    it('should set creditNoteDate to current date when not provided', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({ id: 'cn-id-4' });

      await service.create(
        {
          invoiceId: 'inv-1',
          customerId: 'cust-1',
          reason: 'OTHER',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.credit_notes.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.creditNoteDate).toBeInstanceOf(Date);
    });

    it('should parse creditNoteDate string into Date', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({ id: 'cn-id-5' });

      await service.create(
        {
          invoiceId: 'inv-1',
          customerId: 'cust-1',
          creditNoteDate: '2026-06-15',
          reason: 'OTHER',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.credit_notes.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.creditNoteDate).toEqual(new Date('2026-06-15'));
    });

    it('should set invoiceItemId to null when not provided', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({ id: 'cn-id-6' });

      await service.create(
        {
          invoiceId: 'inv-1',
          customerId: 'cust-1',
          reason: 'OTHER',
          items: [{ description: 'No invoice item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.credit_notes.create as jest.Mock).mock.calls[0][0];
      const createdItems = createCall.data.items.create;
      expect(createdItems[0].invoiceItemId).toBeNull();
    });

    it('should include invoice, customer, createdBy, and items in create response', async () => {
      (mockTx.invoices.findUnique as jest.Mock).mockResolvedValue({
        isInterstate: false,
      });
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.credit_notes.create as jest.Mock).mockResolvedValue({ id: 'cn-id-7' });

      await service.create(
        {
          invoiceId: 'inv-1',
          customerId: 'cust-1',
          reason: 'OTHER',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.credit_notes.create as jest.Mock).mock.calls[0][0];
      expect(createCall.include).toEqual({
        invoice: true,
        customer: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: true,
      });
    });
  });

  // ============================================
  // 3. getAll()
  // ============================================
  describe('getAll', () => {
    const mockData = [
      { id: 'cn-1', creditNoteNumber: 'CN-001', status: 'DRAFT' },
      { id: 'cn-2', creditNoteNumber: 'CN-002', status: 'APPROVED' },
    ];

    beforeEach(() => {
      (mockPrisma.credit_notes.findMany as jest.Mock).mockResolvedValue(mockData);
      (mockPrisma.credit_notes.count as jest.Mock).mockResolvedValue(2);
    });

    it('should return paginated results with defaults', async () => {
      const result = await service.getAll();

      expect(result).toEqual({
        data: mockData,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });

      expect(mockPrisma.credit_notes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should apply search filter on creditNoteNumber and customer name', async () => {
      await service.getAll({ search: 'CN-001' });

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { creditNoteNumber: { contains: 'CN-001', mode: 'insensitive' } },
        { customer: { name: { contains: 'CN-001', mode: 'insensitive' } } },
      ]);
    });

    it('should apply status filter', async () => {
      await service.getAll({ status: 'DRAFT' });

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('DRAFT');
    });

    it('should apply customerId filter', async () => {
      await service.getAll({ customerId: 'cust-1' });

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.customerId).toBe('cust-1');
    });

    it('should apply fromDate filter', async () => {
      await service.getAll({ fromDate: '2026-01-01' });

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.creditNoteDate).toEqual({
        gte: new Date('2026-01-01'),
      });
    });

    it('should apply toDate filter', async () => {
      await service.getAll({ toDate: '2026-12-31' });

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.creditNoteDate).toEqual({
        lte: new Date('2026-12-31'),
      });
    });

    it('should apply both fromDate and toDate filter', async () => {
      await service.getAll({ fromDate: '2026-01-01', toDate: '2026-12-31' });

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.creditNoteDate).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      });
    });

    it('should handle custom pagination', async () => {
      (mockPrisma.credit_notes.findMany as jest.Mock).mockResolvedValue([mockData[0]]);
      (mockPrisma.credit_notes.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getAll({ page: 2, limit: 1 });

      expect(mockPrisma.credit_notes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
        })
      );
      expect(result.pagination).toEqual({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    });

    it('should handle custom sorting', async () => {
      await service.getAll({ sortBy: 'creditNoteNumber', sortOrder: 'asc' });

      expect(mockPrisma.credit_notes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { creditNoteNumber: 'asc' },
        })
      );
    });

    it('should include related entities in response', async () => {
      await service.getAll();

      const findManyCall = (mockPrisma.credit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.include).toEqual({
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
        customer: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        items: true,
      });
    });
  });

  // ============================================
  // 4. getById()
  // ============================================
  describe('getById', () => {
    it('should return credit note with all relations', async () => {
      const mockCN = {
        id: 'cn-1',
        creditNoteNumber: 'CN-001',
        invoice: { id: 'inv-1' },
        customer: { id: 'cust-1' },
        items: [],
      };
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue(mockCN);

      const result = await service.getById('cn-1');

      expect(result).toEqual(mockCN);
      expect(mockPrisma.credit_notes.findUnique).toHaveBeenCalledWith({
        where: { id: 'cn-1' },
        include: {
          invoice: true,
          customer: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          items: true,
        },
      });
    });

    it('should return null when not found', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // 5. approve()
  // ============================================
  describe('approve', () => {
    it('should approve DRAFT credit note', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'DRAFT',
      });
      const approvedCN = { id: 'cn-1', status: 'APPROVED' };
      (mockPrisma.credit_notes.update as jest.Mock).mockResolvedValue(approvedCN);

      const result = await service.approve('cn-1');

      expect(result).toEqual(approvedCN);
      expect(mockPrisma.credit_notes.update).toHaveBeenCalledWith({
        where: { id: 'cn-1' },
        data: { status: 'APPROVED' },
        include: {
          invoice: true,
          customer: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          items: true,
        },
      });
    });

    it('should throw error when credit note not found', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.approve('non-existent')).rejects.toThrow(
        'Credit note not found'
      );
    });

    it('should throw error when status is APPROVED', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
      });

      await expect(service.approve('cn-1')).rejects.toThrow(
        'Only DRAFT credit notes can be approved'
      );
    });

    it('should throw error when status is CANCELLED', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'CANCELLED',
      });

      await expect(service.approve('cn-1')).rejects.toThrow(
        'Only DRAFT credit notes can be approved'
      );
    });
  });

  // ============================================
  // 6. cancel()
  // ============================================
  describe('cancel', () => {
    it('should cancel DRAFT credit note', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'DRAFT',
      });
      const cancelledCN = { id: 'cn-1', status: 'CANCELLED' };
      (mockPrisma.credit_notes.update as jest.Mock).mockResolvedValue(cancelledCN);

      const result = await service.cancel('cn-1');

      expect(result).toEqual(cancelledCN);
      expect(mockPrisma.credit_notes.update).toHaveBeenCalledWith({
        where: { id: 'cn-1' },
        data: { status: 'CANCELLED' },
        include: {
          invoice: true,
          customer: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          items: true,
        },
      });
    });

    it('should throw error when credit note not found', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancel('non-existent')).rejects.toThrow(
        'Credit note not found'
      );
    });

    it('should throw error when status is APPROVED', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
      });

      await expect(service.cancel('cn-1')).rejects.toThrow(
        'Only DRAFT credit notes can be cancelled'
      );
    });

    it('should throw error when status is CANCELLED', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'CANCELLED',
      });

      await expect(service.cancel('cn-1')).rejects.toThrow(
        'Only DRAFT credit notes can be cancelled'
      );
    });
  });

  // ============================================
  // 7. delete()
  // ============================================
  describe('delete', () => {
    it('should delete DRAFT credit note', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'DRAFT',
      });
      (mockPrisma.credit_notes.delete as jest.Mock).mockResolvedValue({
        id: 'cn-1',
      });

      const result = await service.delete('cn-1');

      expect(result).toEqual({ id: 'cn-1' });
      expect(mockPrisma.credit_notes.delete).toHaveBeenCalledWith({
        where: { id: 'cn-1' },
      });
    });

    it('should throw error when credit note not found', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        'Credit note not found'
      );
    });

    it('should throw error when status is APPROVED', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
      });

      await expect(service.delete('cn-1')).rejects.toThrow(
        'Only DRAFT credit notes can be deleted'
      );
    });

    it('should throw error when status is CANCELLED', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'CANCELLED',
      });

      await expect(service.delete('cn-1')).rejects.toThrow(
        'Only DRAFT credit notes can be deleted'
      );
    });

    it('should not call delete when status check fails', async () => {
      (mockPrisma.credit_notes.findUnique as jest.Mock).mockResolvedValue({
        status: 'APPROVED',
      });

      await expect(service.delete('cn-1')).rejects.toThrow();
      expect(mockPrisma.credit_notes.delete).not.toHaveBeenCalled();
    });
  });
});
