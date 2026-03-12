/**
 * Unit Tests for DebitNote Service
 * Tests CRUD operations, GST calculation integration, status transitions,
 * interstate PO detection, and number generation with mocked Prisma and GST service.
 */

// ============================================
// Mocks (must be before imports)
// ============================================

const mockTx = {
  debit_notes: {
    create: jest.fn(),
  },
};

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    debit_notes: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockTx)),
  },
}));

jest.mock('../gst.service', () => ({
  gstService: {
    calculateLineItemGST: jest.fn(),
    isInterstatePO: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

import { DebitNoteService } from '../debitNote.service';
import prisma from '../../config/database';
import { gstService } from '../gst.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGstService = gstService as jest.Mocked<typeof gstService>;

// ============================================
// Test Suite
// ============================================

describe('DebitNoteService', () => {
  let service: DebitNoteService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set $transaction implementation after clearAllMocks
    (mockPrisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(mockTx));
    service = new DebitNoteService();
  });

  // ============================================
  // 1. generateDebitNoteNumber (tested via create)
  // ============================================
  describe('generateDebitNoteNumber (via create)', () => {
    const baseCreateInput = {
      supplierId: 'sup-1',
      reason: 'QUALITY_ISSUE',
      items: [
        { description: 'Defective fabric', quantity: 5, unitPrice: 200 },
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
      hsnCode: null,
    };

    beforeEach(() => {
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue(intrastateGST);
      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({
        id: 'dn-id-1',
        debitNoteNumber: 'DN-001',
      });
    });

    it('should generate DN-001 when no previous debit notes exist', async () => {
      (mockPrisma.debit_notes.findFirst as jest.Mock).mockResolvedValue(null);

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debitNoteNumber: 'DN-001',
          }),
        })
      );
    });

    it('should generate DN-004 when last debit note is DN-003', async () => {
      (mockPrisma.debit_notes.findFirst as jest.Mock).mockResolvedValue({
        debitNoteNumber: 'DN-003',
      });

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debitNoteNumber: 'DN-004',
          }),
        })
      );
    });

    it('should pad number to 3 digits (DN-010)', async () => {
      (mockPrisma.debit_notes.findFirst as jest.Mock).mockResolvedValue({
        debitNoteNumber: 'DN-009',
      });

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debitNoteNumber: 'DN-010',
          }),
        })
      );
    });

    it('should handle high numbers (DN-100)', async () => {
      (mockPrisma.debit_notes.findFirst as jest.Mock).mockResolvedValue({
        debitNoteNumber: 'DN-099',
      });

      await service.create(baseCreateInput, 'user-1');

      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debitNoteNumber: 'DN-100',
          }),
        })
      );
    });
  });

  // ============================================
  // 2. create()
  // ============================================
  describe('create', () => {
    beforeEach(() => {
      (mockPrisma.debit_notes.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should create debit note with poId using isInterstatePO', async () => {
      (mockGstService.isInterstatePO as jest.Mock).mockResolvedValue({
        isInterstate: true,
        supplierStateCode: '27',
      });

      // Single item: 10 * 500 = 5000
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

      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({
        id: 'dn-id-1',
        debitNoteNumber: 'DN-001',
        isInterstate: true,
      });

      const result = await service.create(
        {
          poId: 'po-1',
          supplierId: 'sup-1',
          reason: 'QUALITY_ISSUE',
          items: [
            {
              poItemId: 'po-item-1',
              description: 'Defective Fabric Roll',
              hsnCode: '52081390',
              quantity: 10,
              unitPrice: 500,
            },
          ],
        },
        'user-1'
      );

      // Verify isInterstatePO was called with supplierId
      expect(mockGstService.isInterstatePO).toHaveBeenCalledWith('sup-1');

      // Verify GST calc used interstate = true
      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 5000,
        hsnSacCode: '52081390',
        isInterstate: true,
      });

      // Verify create data
      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debitNoteNumber: 'DN-001',
            poId: 'po-1',
            supplierId: 'sup-1',
            reason: 'QUALITY_ISSUE',
            isInterstate: true,
            subtotal: 5000,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 250,
            totalTax: 250,
            totalAmount: 5250,
            status: 'DRAFT',
            createdById: 'user-1',
          }),
        })
      );

      expect(result).toEqual({
        id: 'dn-id-1',
        debitNoteNumber: 'DN-001',
        isInterstate: true,
      });
    });

    it('should create debit note without poId (defaults to intrastate)', async () => {
      // Item: 5 * 200 = 1000
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 0,
        cgstAmount: 60,
        sgstAmount: 60,
        igstAmount: 0,
        taxAmount: 120,
        hsnCode: null,
      });

      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({
        id: 'dn-id-2',
        debitNoteNumber: 'DN-001',
        isInterstate: false,
      });

      await service.create(
        {
          supplierId: 'sup-1',
          reason: 'PRICE_DIFFERENCE',
          remarks: 'Overcharged',
          items: [
            { description: 'Price adjustment', quantity: 5, unitPrice: 200 },
          ],
        },
        'user-1'
      );

      // isInterstatePO should NOT be called (no poId)
      expect(mockGstService.isInterstatePO).not.toHaveBeenCalled();

      // GST calc should use isInterstate: false
      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 1000,
        hsnSacCode: undefined,
        isInterstate: false,
      });

      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            poId: null,
            isInterstate: false,
            subtotal: 1000,
            cgstAmount: 60,
            sgstAmount: 60,
            igstAmount: 0,
            totalTax: 120,
            totalAmount: 1120,
            remarks: 'Overcharged',
          }),
        })
      );
    });

    it('should throw error when items array is empty', async () => {
      await expect(
        service.create(
          {
            supplierId: 'sup-1',
            reason: 'QUALITY_ISSUE',
            items: [],
          },
          'user-1'
        )
      ).rejects.toThrow('At least one item is required');

      // Ensure no DB calls were made
      expect(mockGstService.calculateLineItemGST).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create with multiple items and aggregate GST totals', async () => {
      (mockGstService.calculateLineItemGST as jest.Mock)
        // Item 1: 10 * 300 = 3000
        .mockResolvedValueOnce({
          gstRate: 12,
          cgstRate: 6,
          sgstRate: 6,
          igstRate: 0,
          cgstAmount: 180,
          sgstAmount: 180,
          igstAmount: 0,
          taxAmount: 360,
          hsnCode: '52081390',
        })
        // Item 2: 20 * 100 = 2000
        .mockResolvedValueOnce({
          gstRate: 18,
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
          cgstAmount: 180,
          sgstAmount: 180,
          igstAmount: 0,
          taxAmount: 360,
          hsnCode: '96064100',
        });

      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({ id: 'dn-id-3' });

      await service.create(
        {
          supplierId: 'sup-1',
          reason: 'QUALITY_ISSUE',
          items: [
            { description: 'Fabric', hsnCode: '52081390', quantity: 10, unitPrice: 300 },
            { description: 'Buttons', hsnCode: '96064100', quantity: 20, unitPrice: 100 },
          ],
        },
        'user-1'
      );

      // subtotal = 3000 + 2000 = 5000
      // totalCgst = 180 + 180 = 360
      // totalSgst = 180 + 180 = 360
      // totalTax = 360 + 360 = 720
      // totalAmount = 5000 + 720 = 5720
      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 5000,
            cgstAmount: 360,
            sgstAmount: 360,
            igstAmount: 0,
            totalTax: 720,
            totalAmount: 5720,
          }),
        })
      );
    });

    it('should set debitNoteDate to current date when not provided', async () => {
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({ id: 'dn-id-4' });

      await service.create(
        {
          supplierId: 'sup-1',
          reason: 'OTHER',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.debit_notes.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.debitNoteDate).toBeInstanceOf(Date);
    });

    it('should parse debitNoteDate string into Date', async () => {
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({ id: 'dn-id-5' });

      await service.create(
        {
          supplierId: 'sup-1',
          debitNoteDate: '2026-06-15',
          reason: 'OTHER',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.debit_notes.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.debitNoteDate).toEqual(new Date('2026-06-15'));
    });

    it('should set poItemId to null when not provided in items', async () => {
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({ id: 'dn-id-6' });

      await service.create(
        {
          supplierId: 'sup-1',
          reason: 'OTHER',
          items: [{ description: 'No PO item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.debit_notes.create as jest.Mock).mock.calls[0][0];
      const createdItems = createCall.data.items.create;
      expect(createdItems[0].poItemId).toBeNull();
    });

    it('should include supplier, purchaseOrder, createdBy, and items in create response', async () => {
      (mockGstService.calculateLineItemGST as jest.Mock).mockResolvedValue({
        gstRate: 12, cgstAmount: 60, sgstAmount: 60, igstAmount: 0, taxAmount: 120,
      });
      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({ id: 'dn-id-7' });

      await service.create(
        {
          supplierId: 'sup-1',
          reason: 'OTHER',
          items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
        },
        'user-1'
      );

      const createCall = (mockTx.debit_notes.create as jest.Mock).mock.calls[0][0];
      expect(createCall.include).toEqual({
        supplier: {
          select: { id: true, code: true, name: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        items: true,
      });
    });

    it('should handle items with zero quantity (lineTotal = 0)', async () => {
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
      (mockTx.debit_notes.create as jest.Mock).mockResolvedValue({ id: 'dn-id-8' });

      await service.create(
        {
          supplierId: 'sup-1',
          reason: 'OTHER',
          items: [{ description: 'Zero qty', quantity: 0, unitPrice: 500 }],
        },
        'user-1'
      );

      expect(mockGstService.calculateLineItemGST).toHaveBeenCalledWith({
        lineTotal: 0,
        hsnSacCode: undefined,
        isInterstate: false,
      });

      expect(mockTx.debit_notes.create).toHaveBeenCalledWith(
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
  });

  // ============================================
  // 3. getAll()
  // ============================================
  describe('getAll', () => {
    const mockData = [
      { id: 'dn-1', debitNoteNumber: 'DN-001', status: 'DRAFT' },
      { id: 'dn-2', debitNoteNumber: 'DN-002', status: 'APPROVED' },
    ];

    beforeEach(() => {
      (mockPrisma.debit_notes.findMany as jest.Mock).mockResolvedValue(mockData);
      (mockPrisma.debit_notes.count as jest.Mock).mockResolvedValue(2);
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

      expect(mockPrisma.debit_notes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should apply search filter on debitNoteNumber and supplier name', async () => {
      await service.getAll({ search: 'DN-001' });

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { debitNoteNumber: { contains: 'DN-001', mode: 'insensitive' } },
        { supplier: { name: { contains: 'DN-001', mode: 'insensitive' } } },
      ]);
    });

    it('should apply status filter', async () => {
      await service.getAll({ status: 'APPROVED' });

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('APPROVED');
    });

    it('should apply supplierId filter', async () => {
      await service.getAll({ supplierId: 'sup-1' });

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.supplierId).toBe('sup-1');
    });

    it('should apply fromDate filter', async () => {
      await service.getAll({ fromDate: '2026-01-01' });

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.debitNoteDate).toEqual({
        gte: new Date('2026-01-01'),
      });
    });

    it('should apply toDate filter', async () => {
      await service.getAll({ toDate: '2026-12-31' });

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.debitNoteDate).toEqual({
        lte: new Date('2026-12-31'),
      });
    });

    it('should apply both fromDate and toDate filter', async () => {
      await service.getAll({ fromDate: '2026-01-01', toDate: '2026-12-31' });

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.debitNoteDate).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      });
    });

    it('should handle custom pagination', async () => {
      (mockPrisma.debit_notes.findMany as jest.Mock).mockResolvedValue([mockData[0]]);
      (mockPrisma.debit_notes.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getAll({ page: 3, limit: 2 });

      expect(mockPrisma.debit_notes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 4,
          take: 2,
        })
      );
      expect(result.pagination).toEqual({
        page: 3,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('should handle custom sorting', async () => {
      await service.getAll({ sortBy: 'debitNoteNumber', sortOrder: 'asc' });

      expect(mockPrisma.debit_notes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { debitNoteNumber: 'asc' },
        })
      );
    });

    it('should include related entities in response', async () => {
      await service.getAll();

      const findManyCall = (mockPrisma.debit_notes.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.include).toEqual({
        supplier: {
          select: { id: true, code: true, name: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
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
    it('should return debit note with all relations', async () => {
      const mockDN = {
        id: 'dn-1',
        debitNoteNumber: 'DN-001',
        supplier: { id: 'sup-1', code: 'SUP-001', name: 'Supplier A' },
        purchaseOrder: { id: 'po-1', poNumber: 'PO-001' },
        items: [],
      };
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue(mockDN);

      const result = await service.getById('dn-1');

      expect(result).toEqual(mockDN);
      expect(mockPrisma.debit_notes.findUnique).toHaveBeenCalledWith({
        where: { id: 'dn-1' },
        include: {
          supplier: {
            select: { id: true, code: true, name: true, phone: true, email: true },
          },
          purchaseOrder: {
            select: { id: true, poNumber: true, poDate: true, status: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          items: true,
        },
      });
    });

    it('should return null when not found', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // 5. approve()
  // ============================================
  describe('approve', () => {
    it('should approve DRAFT debit note', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'DRAFT',
      });
      const approvedDN = { id: 'dn-1', status: 'APPROVED' };
      (mockPrisma.debit_notes.update as jest.Mock).mockResolvedValue(approvedDN);

      const result = await service.approve('dn-1');

      expect(result).toEqual(approvedDN);
      expect(mockPrisma.debit_notes.update).toHaveBeenCalledWith({
        where: { id: 'dn-1' },
        data: { status: 'APPROVED' },
        include: {
          supplier: {
            select: { id: true, code: true, name: true },
          },
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          items: true,
        },
      });
    });

    it('should throw error when debit note not found', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.approve('non-existent')).rejects.toThrow(
        'Debit note not found'
      );
    });

    it('should throw error when status is APPROVED', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'APPROVED',
      });

      await expect(service.approve('dn-1')).rejects.toThrow(
        'Only DRAFT debit notes can be approved'
      );
    });

    it('should throw error when status is CANCELLED', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'CANCELLED',
      });

      await expect(service.approve('dn-1')).rejects.toThrow(
        'Only DRAFT debit notes can be approved'
      );
    });

    it('should not call update when status check fails', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'APPROVED',
      });

      await expect(service.approve('dn-1')).rejects.toThrow();
      expect(mockPrisma.debit_notes.update).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 6. cancel()
  // ============================================
  describe('cancel', () => {
    it('should cancel DRAFT debit note', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'DRAFT',
      });
      const cancelledDN = { id: 'dn-1', status: 'CANCELLED' };
      (mockPrisma.debit_notes.update as jest.Mock).mockResolvedValue(cancelledDN);

      const result = await service.cancel('dn-1');

      expect(result).toEqual(cancelledDN);
      expect(mockPrisma.debit_notes.update).toHaveBeenCalledWith({
        where: { id: 'dn-1' },
        data: { status: 'CANCELLED' },
        include: {
          supplier: {
            select: { id: true, code: true, name: true },
          },
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          items: true,
        },
      });
    });

    it('should throw error when debit note not found', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancel('non-existent')).rejects.toThrow(
        'Debit note not found'
      );
    });

    it('should throw error when status is APPROVED', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'APPROVED',
      });

      await expect(service.cancel('dn-1')).rejects.toThrow(
        'Only DRAFT debit notes can be cancelled'
      );
    });

    it('should throw error when status is CANCELLED', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'CANCELLED',
      });

      await expect(service.cancel('dn-1')).rejects.toThrow(
        'Only DRAFT debit notes can be cancelled'
      );
    });
  });

  // ============================================
  // 7. delete()
  // ============================================
  describe('delete', () => {
    it('should delete DRAFT debit note', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'DRAFT',
      });
      (mockPrisma.debit_notes.delete as jest.Mock).mockResolvedValue({
        id: 'dn-1',
      });

      const result = await service.delete('dn-1');

      expect(result).toEqual({ id: 'dn-1' });
      expect(mockPrisma.debit_notes.delete).toHaveBeenCalledWith({
        where: { id: 'dn-1' },
      });
    });

    it('should throw error when debit note not found', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        'Debit note not found'
      );
    });

    it('should throw error when status is APPROVED', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'APPROVED',
      });

      await expect(service.delete('dn-1')).rejects.toThrow(
        'Only DRAFT debit notes can be deleted'
      );
    });

    it('should throw error when status is CANCELLED', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'CANCELLED',
      });

      await expect(service.delete('dn-1')).rejects.toThrow(
        'Only DRAFT debit notes can be deleted'
      );
    });

    it('should not call delete when status check fails', async () => {
      (mockPrisma.debit_notes.findUnique as jest.Mock).mockResolvedValue({
        id: 'dn-1',
        status: 'APPROVED',
      });

      await expect(service.delete('dn-1')).rejects.toThrow();
      expect(mockPrisma.debit_notes.delete).not.toHaveBeenCalled();
    });
  });
});
