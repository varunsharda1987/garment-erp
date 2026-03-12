/**
 * Unit Tests for TCS Service
 * Tests TCS entry CRUD, status management, and summary aggregation
 */

// Mock prisma before importing the service
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    tcs_entries: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { tcsService } from '../tcs.service';
import prisma from '../../config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---- Helper to build mock TCS entry ----

function makeTCSEntry(overrides: Partial<any> = {}) {
  return {
    id: 'tcs-001',
    invoiceId: null,
    customerName: 'Mega Retailers Pvt Ltd',
    tcsSection: '206C(1H)',
    tcsRate: 0.1,
    saleAmount: 5500000,
    tcsAmount: 5500,
    collectionDate: new Date('2026-01-20'),
    financialYear: '2025-26',
    quarter: 4,
    remarks: null,
    status: 'PENDING',
    createdById: 'user-001',
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-20'),
    ...overrides,
  };
}

describe('TCSService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 1. create
  // ============================================
  describe('create', () => {
    it('should convert collectionDate string to Date and set createdById', async () => {
      const input = {
        customerName: 'Mega Retailers Pvt Ltd',
        tcsSection: '206C(1H)',
        tcsRate: 0.1,
        saleAmount: 5500000,
        tcsAmount: 5500,
        collectionDate: '2026-01-20',
        financialYear: '2025-26',
        quarter: 4,
      };

      const mockCreated = makeTCSEntry();
      (mockPrisma.tcs_entries.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await tcsService.create(input, 'user-001');

      expect(mockPrisma.tcs_entries.create).toHaveBeenCalledTimes(1);
      const callArg = (mockPrisma.tcs_entries.create as jest.Mock).mock.calls[0][0];

      // collectionDate should be a Date object, not a string
      expect(callArg.data.collectionDate).toBeInstanceOf(Date);
      expect(callArg.data.collectionDate.toISOString()).toContain('2026-01-20');

      // createdById should be set from userId param
      expect(callArg.data.createdById).toBe('user-001');

      // Other fields should be passed through
      expect(callArg.data.customerName).toBe('Mega Retailers Pvt Ltd');
      expect(callArg.data.tcsSection).toBe('206C(1H)');
      expect(callArg.data.saleAmount).toBe(5500000);
      expect(callArg.data.tcsAmount).toBe(5500);

      expect(result).toEqual(mockCreated);
    });

    it('should pass optional fields like invoiceId and remarks', async () => {
      const input = {
        customerName: 'Big Buyer Corp',
        tcsSection: '206C(1H)',
        tcsRate: 0.1,
        saleAmount: 6000000,
        tcsAmount: 6000,
        collectionDate: '2026-03-15',
        financialYear: '2025-26',
        quarter: 4,
        invoiceId: 'inv-456',
        remarks: 'Sale above 50L threshold',
      };

      (mockPrisma.tcs_entries.create as jest.Mock).mockResolvedValue(makeTCSEntry(input));

      await tcsService.create(input, 'user-002');

      const callArg = (mockPrisma.tcs_entries.create as jest.Mock).mock.calls[0][0];
      expect(callArg.data.invoiceId).toBe('inv-456');
      expect(callArg.data.remarks).toBe('Sale above 50L threshold');
    });
  });

  // ============================================
  // 2. getAll
  // ============================================
  describe('getAll', () => {
    it('should calculate pagination correctly with defaults (page=1, limit=20)', async () => {
      const entries = [makeTCSEntry()];
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue(entries);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(1);

      const result = await tcsService.getAll({});

      // Default pagination
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.data).toEqual(entries);

      // skip should be 0 for page 1
      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.skip).toBe(0);
      expect(findManyCall.take).toBe(20);
    });

    it('should calculate skip correctly for page 4 with limit 5', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(35);

      const result = await tcsService.getAll({ page: 4, limit: 5 });

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.skip).toBe(15); // (4-1) * 5
      expect(findManyCall.take).toBe(5);
      expect(result.pagination.totalPages).toBe(7); // Math.ceil(35/5)
    });

    it('should apply search filter on customerName and tcsSection', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(0);

      await tcsService.getAll({ search: 'Mega' });

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { customerName: { contains: 'Mega', mode: 'insensitive' } },
        { tcsSection: { contains: 'Mega', mode: 'insensitive' } },
      ]);
    });

    it('should apply financialYear filter', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(0);

      await tcsService.getAll({ financialYear: '2025-26' });

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.financialYear).toBe('2025-26');
    });

    it('should apply quarter filter', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(0);

      await tcsService.getAll({ quarter: 2 });

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.quarter).toBe(2);
    });

    it('should apply status filter', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(0);

      await tcsService.getAll({ status: 'DEPOSITED' });

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('DEPOSITED');
    });

    it('should use default sorting by collectionDate desc', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(0);

      await tcsService.getAll({});

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ collectionDate: 'desc' });
    });

    it('should apply combined filters together', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tcs_entries.count as jest.Mock).mockResolvedValue(0);

      await tcsService.getAll({
        search: 'Retailer',
        financialYear: '2025-26',
        quarter: 4,
        status: 'PENDING',
      });

      const findManyCall = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.financialYear).toBe('2025-26');
      expect(findManyCall.where.quarter).toBe(4);
      expect(findManyCall.where.status).toBe('PENDING');
    });
  });

  // ============================================
  // 3. update
  // ============================================
  describe('update', () => {
    it('should perform partial update without date conversion when collectionDate not provided', async () => {
      const mockUpdated = makeTCSEntry({ remarks: 'Updated remark' });
      (mockPrisma.tcs_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await tcsService.update('tcs-001', { remarks: 'Updated remark' });

      const callArg = (mockPrisma.tcs_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.where.id).toBe('tcs-001');
      expect(callArg.data.remarks).toBe('Updated remark');
      expect(callArg.data.collectionDate).toBeUndefined();
      expect(result).toEqual(mockUpdated);
    });

    it('should convert collectionDate to Date when provided in update', async () => {
      const mockUpdated = makeTCSEntry({ collectionDate: new Date('2026-02-28') });
      (mockPrisma.tcs_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      await tcsService.update('tcs-001', {
        collectionDate: '2026-02-28',
        saleAmount: 7000000,
      });

      const callArg = (mockPrisma.tcs_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.data.collectionDate).toBeInstanceOf(Date);
      expect(callArg.data.collectionDate.toISOString()).toContain('2026-02-28');
      expect(callArg.data.saleAmount).toBe(7000000);
    });
  });

  // ============================================
  // 4. updateStatus
  // ============================================
  describe('updateStatus', () => {
    it('should update status to DEPOSITED', async () => {
      const mockUpdated = makeTCSEntry({ status: 'DEPOSITED' });
      (mockPrisma.tcs_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await tcsService.updateStatus('tcs-001', 'DEPOSITED');

      const callArg = (mockPrisma.tcs_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.where.id).toBe('tcs-001');
      expect(callArg.data).toEqual({ status: 'DEPOSITED' });
      expect(result.status).toBe('DEPOSITED');
    });

    it('should update status to PENDING', async () => {
      const mockUpdated = makeTCSEntry({ status: 'PENDING' });
      (mockPrisma.tcs_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await tcsService.updateStatus('tcs-001', 'PENDING');

      const callArg = (mockPrisma.tcs_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.data).toEqual({ status: 'PENDING' });
      expect(result.status).toBe('PENDING');
    });
  });

  // ============================================
  // 5. getSummary
  // ============================================
  describe('getSummary', () => {
    it('should return correct per-quarter counts and sums with entries across quarters', async () => {
      const entries = [
        // Q1 entries
        makeTCSEntry({ id: 'tcs-q1-1', quarter: 1, saleAmount: 6000000, tcsAmount: 6000, status: 'DEPOSITED' }),
        makeTCSEntry({ id: 'tcs-q1-2', quarter: 1, saleAmount: 5200000, tcsAmount: 5200, status: 'PENDING' }),
        // Q2 entries
        makeTCSEntry({ id: 'tcs-q2-1', quarter: 2, saleAmount: 7500000, tcsAmount: 7500, status: 'DEPOSITED' }),
        makeTCSEntry({ id: 'tcs-q2-2', quarter: 2, saleAmount: 8000000, tcsAmount: 8000, status: 'DEPOSITED' }),
        // Q3 - no entries
        // Q4 entries
        makeTCSEntry({ id: 'tcs-q4-1', quarter: 4, saleAmount: 5500000, tcsAmount: 5500, status: 'PENDING' }),
      ];

      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await tcsService.getSummary('2025-26');

      expect(result.financialYear).toBe('2025-26');
      expect(result.quarterSummary).toHaveLength(4);

      // Q1: 2 entries
      expect(result.quarterSummary[0].quarter).toBe(1);
      expect(result.quarterSummary[0].count).toBe(2);
      expect(result.quarterSummary[0].totalSaleAmount).toBe(11200000); // 6000000 + 5200000
      expect(result.quarterSummary[0].totalTCS).toBe(11200);           // 6000 + 5200
      expect(result.quarterSummary[0].deposited).toBe(1);
      expect(result.quarterSummary[0].pending).toBe(1);

      // Q2: 2 entries
      expect(result.quarterSummary[1].quarter).toBe(2);
      expect(result.quarterSummary[1].count).toBe(2);
      expect(result.quarterSummary[1].totalSaleAmount).toBe(15500000); // 7500000 + 8000000
      expect(result.quarterSummary[1].totalTCS).toBe(15500);
      expect(result.quarterSummary[1].deposited).toBe(2);
      expect(result.quarterSummary[1].pending).toBe(0);

      // Q3: empty
      expect(result.quarterSummary[2].quarter).toBe(3);
      expect(result.quarterSummary[2].count).toBe(0);
      expect(result.quarterSummary[2].totalSaleAmount).toBe(0);
      expect(result.quarterSummary[2].totalTCS).toBe(0);
      expect(result.quarterSummary[2].deposited).toBe(0);
      expect(result.quarterSummary[2].pending).toBe(0);

      // Q4: 1 entry
      expect(result.quarterSummary[3].quarter).toBe(4);
      expect(result.quarterSummary[3].count).toBe(1);
      expect(result.quarterSummary[3].totalSaleAmount).toBe(5500000);
      expect(result.quarterSummary[3].totalTCS).toBe(5500);
      expect(result.quarterSummary[3].pending).toBe(1);

      // Grand totals
      expect(result.totalEntries).toBe(5);
      expect(result.totalSaleAmount).toBe(32200000); // sum of all saleAmounts
      expect(result.totalTCS).toBe(32200);            // sum of all tcsAmounts
    });

    it('should return all zeros for empty financial year', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);

      const result = await tcsService.getSummary('2024-25');

      expect(result.financialYear).toBe('2024-25');
      expect(result.totalEntries).toBe(0);
      expect(result.totalSaleAmount).toBe(0);
      expect(result.totalTCS).toBe(0);

      result.quarterSummary.forEach((q) => {
        expect(q.count).toBe(0);
        expect(q.totalSaleAmount).toBe(0);
        expect(q.totalTCS).toBe(0);
        expect(q.pending).toBe(0);
        expect(q.deposited).toBe(0);
      });
    });

    it('should count PENDING and DEPOSITED statuses correctly', async () => {
      const entries = [
        makeTCSEntry({ id: 'tcs-1', quarter: 2, saleAmount: 5100000, tcsAmount: 5100, status: 'PENDING' }),
        makeTCSEntry({ id: 'tcs-2', quarter: 2, saleAmount: 5200000, tcsAmount: 5200, status: 'PENDING' }),
        makeTCSEntry({ id: 'tcs-3', quarter: 2, saleAmount: 5300000, tcsAmount: 5300, status: 'DEPOSITED' }),
        makeTCSEntry({ id: 'tcs-4', quarter: 2, saleAmount: 5400000, tcsAmount: 5400, status: 'DEPOSITED' }),
        makeTCSEntry({ id: 'tcs-5', quarter: 2, saleAmount: 5500000, tcsAmount: 5500, status: 'DEPOSITED' }),
      ];

      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await tcsService.getSummary('2025-26');

      const q2 = result.quarterSummary[1]; // index 1 = Q2
      expect(q2.count).toBe(5);
      expect(q2.pending).toBe(2);
      expect(q2.deposited).toBe(3);
    });

    it('should have grand totals matching sum of all entries', async () => {
      const entries = [
        makeTCSEntry({ id: 'tcs-1', quarter: 1, saleAmount: 5100000, tcsAmount: 5100 }),
        makeTCSEntry({ id: 'tcs-2', quarter: 2, saleAmount: 6200000, tcsAmount: 6200 }),
        makeTCSEntry({ id: 'tcs-3', quarter: 3, saleAmount: 7300000, tcsAmount: 7300 }),
        makeTCSEntry({ id: 'tcs-4', quarter: 4, saleAmount: 8400000, tcsAmount: 8400 }),
      ];

      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await tcsService.getSummary('2025-26');

      expect(result.totalEntries).toBe(4);
      expect(result.totalSaleAmount).toBe(27000000); // 5100000 + 6200000 + 7300000 + 8400000
      expect(result.totalTCS).toBe(27000);            // 5100 + 6200 + 7300 + 8400
    });

    it('should query with correct financialYear filter and ordering', async () => {
      (mockPrisma.tcs_entries.findMany as jest.Mock).mockResolvedValue([]);

      await tcsService.getSummary('2025-26');

      const callArg = (mockPrisma.tcs_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(callArg.where.financialYear).toBe('2025-26');
      expect(callArg.orderBy.quarter).toBe('asc');
    });
  });

  // ============================================
  // 6. getById
  // ============================================
  describe('getById', () => {
    it('should call findUnique with correct id', async () => {
      const mockEntry = makeTCSEntry();
      (mockPrisma.tcs_entries.findUnique as jest.Mock).mockResolvedValue(mockEntry);

      const result = await tcsService.getById('tcs-001');

      expect(mockPrisma.tcs_entries.findUnique).toHaveBeenCalledWith({ where: { id: 'tcs-001' } });
      expect(result).toEqual(mockEntry);
    });

    it('should return null when entry not found', async () => {
      (mockPrisma.tcs_entries.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await tcsService.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // 7. delete
  // ============================================
  describe('delete', () => {
    it('should call delete with correct id', async () => {
      const mockDeleted = makeTCSEntry();
      (mockPrisma.tcs_entries.delete as jest.Mock).mockResolvedValue(mockDeleted);

      const result = await tcsService.delete('tcs-001');

      expect(mockPrisma.tcs_entries.delete).toHaveBeenCalledWith({ where: { id: 'tcs-001' } });
      expect(result).toEqual(mockDeleted);
    });
  });
});
