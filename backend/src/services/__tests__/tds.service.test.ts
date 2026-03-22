/**
 * Unit Tests for TDS Service
 * Tests TDS entry CRUD, status management, and summary aggregation
 */

// Mock prisma before importing the service
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    tds_entries: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { tdsService } from '../tds.service';
import prisma from '../../config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---- Helper to build mock TDS entry ----

function makeTDSEntry(overrides: Partial<any> = {}) {
  return {
    id: 'tds-001',
    invoiceId: null,
    paymentId: null,
    deductorName: 'ABC Textiles Pvt Ltd',
    deducteeName: 'XYZ Garments',
    tdsSection: '194C',
    tdsRate: 2,
    grossAmount: 100000,
    tdsAmount: 2000,
    netAmount: 98000,
    certificateNo: null,
    deductionDate: new Date('2026-01-15'),
    financialYear: '2025-26',
    quarter: 4,
    remarks: null,
    status: 'PENDING',
    createdById: 'user-001',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('TDSService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 1. create
  // ============================================
  describe('create', () => {
    it('should convert deductionDate string to Date and set createdById', async () => {
      const input = {
        deductorName: 'ABC Textiles Pvt Ltd',
        deducteeName: 'XYZ Garments',
        tdsSection: '194C',
        tdsRate: 2,
        grossAmount: 100000,
        tdsAmount: 2000,
        netAmount: 98000,
        deductionDate: '2026-01-15',
        financialYear: '2025-26',
        quarter: 4,
      };

      const mockCreated = makeTDSEntry();
      (mockPrisma.tds_entries.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await tdsService.create(input, 'user-001');

      expect(mockPrisma.tds_entries.create).toHaveBeenCalledTimes(1);
      const callArg = (mockPrisma.tds_entries.create as jest.Mock).mock.calls[0][0];

      // deductionDate should be a Date object, not a string
      expect(callArg.data.deductionDate).toBeInstanceOf(Date);
      expect(callArg.data.deductionDate.toISOString()).toContain('2026-01-15');

      // createdById should be set from userId param
      expect(callArg.data.createdById).toBe('user-001');

      // Other fields should be passed through
      expect(callArg.data.deductorName).toBe('ABC Textiles Pvt Ltd');
      expect(callArg.data.tdsSection).toBe('194C');
      expect(callArg.data.grossAmount).toBe(100000);

      expect(result).toEqual(mockCreated);
    });

    it('should pass optional fields like invoiceId and certificateNo', async () => {
      const input = {
        deductorName: 'Supplier Corp',
        deducteeName: 'Our Company',
        tdsSection: '194J',
        tdsRate: 10,
        grossAmount: 50000,
        tdsAmount: 5000,
        netAmount: 45000,
        deductionDate: '2026-02-10',
        financialYear: '2025-26',
        quarter: 4,
        invoiceId: 'inv-123',
        certificateNo: 'TDS-CERT-001',
        remarks: 'Professional fee payment',
      };

      (mockPrisma.tds_entries.create as jest.Mock).mockResolvedValue(makeTDSEntry(input));

      await tdsService.create(input, 'user-002');

      const callArg = (mockPrisma.tds_entries.create as jest.Mock).mock.calls[0][0];
      expect(callArg.data.invoiceId).toBe('inv-123');
      expect(callArg.data.certificateNo).toBe('TDS-CERT-001');
      expect(callArg.data.remarks).toBe('Professional fee payment');
    });
  });

  // ============================================
  // 2. getAll
  // ============================================
  describe('getAll', () => {
    it('should calculate pagination correctly with defaults (page=1, limit=20)', async () => {
      const entries = [makeTDSEntry()];
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue(entries);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(1);

      const result = await tdsService.getAll({});

      // Default pagination
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.data).toEqual(entries);

      // skip should be 0 for page 1
      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.skip).toBe(0);
      expect(findManyCall.take).toBe(20);
    });

    it('should calculate skip correctly for page 3 with limit 10', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(50);

      const result = await tdsService.getAll({ page: 3, limit: 10 });

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.skip).toBe(20); // (3-1) * 10
      expect(findManyCall.take).toBe(10);
      expect(result.pagination.totalPages).toBe(5); // Math.ceil(50/10)
    });

    it('should apply search filter on deductorName, tdsSection, certificateNo', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(0);

      await tdsService.getAll({ search: 'ABC' });

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { deductorName: { contains: 'ABC', mode: 'insensitive' } },
        { tdsSection: { contains: 'ABC', mode: 'insensitive' } },
        { certificateNo: { contains: 'ABC', mode: 'insensitive' } },
      ]);
    });

    it('should apply financialYear filter', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(0);

      await tdsService.getAll({ financialYear: '2025-26' });

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.financialYear).toBe('2025-26');
    });

    it('should apply quarter filter', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(0);

      await tdsService.getAll({ quarter: 3 });

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.quarter).toBe(3);
    });

    it('should apply status filter', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(0);

      await tdsService.getAll({ status: 'VERIFIED' });

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('VERIFIED');
    });

    it('should use default sorting by deductionDate desc', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(0);

      await tdsService.getAll({});

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ deductionDate: 'desc' });
    });

    it('should apply combined filters together', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.tds_entries.count as jest.Mock).mockResolvedValue(0);

      await tdsService.getAll({
        search: '194C',
        financialYear: '2025-26',
        quarter: 4,
        status: 'PENDING',
      });

      const findManyCall = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
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
    it('should perform partial update without date conversion when deductionDate not provided', async () => {
      const mockUpdated = makeTDSEntry({ remarks: 'Updated remark' });
      (mockPrisma.tds_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await tdsService.update('tds-001', { remarks: 'Updated remark' });

      const callArg = (mockPrisma.tds_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.where.id).toBe('tds-001');
      expect(callArg.data.remarks).toBe('Updated remark');
      // deductionDate should not be converted since it was not provided
      expect(callArg.data.deductionDate).toBeUndefined();
      expect(result).toEqual(mockUpdated);
    });

    it('should convert deductionDate to Date when provided in update', async () => {
      const mockUpdated = makeTDSEntry({ deductionDate: new Date('2026-02-20') });
      (mockPrisma.tds_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      await tdsService.update('tds-001', {
        deductionDate: '2026-02-20',
        grossAmount: 120000,
      });

      const callArg = (mockPrisma.tds_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.data.deductionDate).toBeInstanceOf(Date);
      expect(callArg.data.deductionDate.toISOString()).toContain('2026-02-20');
      expect(callArg.data.grossAmount).toBe(120000);
    });
  });

  // ============================================
  // 4. updateStatus
  // ============================================
  describe('updateStatus', () => {
    it('should update status field', async () => {
      const mockUpdated = makeTDSEntry({ status: 'CERTIFICATE_RECEIVED' });
      (mockPrisma.tds_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await tdsService.updateStatus('tds-001', 'CERTIFICATE_RECEIVED');

      const callArg = (mockPrisma.tds_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.where.id).toBe('tds-001');
      expect(callArg.data.status).toBe('CERTIFICATE_RECEIVED');
      expect(result.status).toBe('CERTIFICATE_RECEIVED');
    });

    it('should set certificateNo when provided with status update', async () => {
      const mockUpdated = makeTDSEntry({
        status: 'CERTIFICATE_RECEIVED',
        certificateNo: 'CERT-2026-001',
      });
      (mockPrisma.tds_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      await tdsService.updateStatus('tds-001', 'CERTIFICATE_RECEIVED', 'CERT-2026-001');

      const callArg = (mockPrisma.tds_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.data.status).toBe('CERTIFICATE_RECEIVED');
      expect(callArg.data.certificateNo).toBe('CERT-2026-001');
    });

    it('should not set certificateNo when not provided', async () => {
      const mockUpdated = makeTDSEntry({ status: 'VERIFIED' });
      (mockPrisma.tds_entries.update as jest.Mock).mockResolvedValue(mockUpdated);

      await tdsService.updateStatus('tds-001', 'VERIFIED');

      const callArg = (mockPrisma.tds_entries.update as jest.Mock).mock.calls[0][0];
      expect(callArg.data.status).toBe('VERIFIED');
      expect(callArg.data.certificateNo).toBeUndefined();
    });
  });

  // ============================================
  // 5. getSummary
  // ============================================
  describe('getSummary', () => {
    it('should return correct per-quarter counts and sums with entries in all 4 quarters', async () => {
      const entries = [
        // Q1 entries
        makeTDSEntry({
          id: 'tds-q1-1',
          quarter: 1,
          grossAmount: 50000,
          tdsAmount: 1000,
          netAmount: 49000,
          status: 'VERIFIED',
        }),
        makeTDSEntry({
          id: 'tds-q1-2',
          quarter: 1,
          grossAmount: 30000,
          tdsAmount: 600,
          netAmount: 29400,
          status: 'PENDING',
        }),
        // Q2 entries
        makeTDSEntry({
          id: 'tds-q2-1',
          quarter: 2,
          grossAmount: 80000,
          tdsAmount: 1600,
          netAmount: 78400,
          status: 'CERTIFICATE_RECEIVED',
        }),
        // Q3 entries
        makeTDSEntry({
          id: 'tds-q3-1',
          quarter: 3,
          grossAmount: 120000,
          tdsAmount: 2400,
          netAmount: 117600,
          status: 'PENDING',
        }),
        makeTDSEntry({
          id: 'tds-q3-2',
          quarter: 3,
          grossAmount: 60000,
          tdsAmount: 1200,
          netAmount: 58800,
          status: 'VERIFIED',
        }),
        makeTDSEntry({
          id: 'tds-q3-3',
          quarter: 3,
          grossAmount: 40000,
          tdsAmount: 800,
          netAmount: 39200,
          status: 'PENDING',
        }),
        // Q4 entries
        makeTDSEntry({
          id: 'tds-q4-1',
          quarter: 4,
          grossAmount: 100000,
          tdsAmount: 2000,
          netAmount: 98000,
          status: 'CERTIFICATE_RECEIVED',
        }),
      ];

      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await tdsService.getSummary('2025-26');

      expect(result.financialYear).toBe('2025-26');
      expect(result.quarterSummary).toHaveLength(4);

      // Q1: 2 entries
      expect(result.quarterSummary[0].quarter).toBe(1);
      expect(result.quarterSummary[0].count).toBe(2);
      expect(result.quarterSummary[0].totalGross).toBe(80000); // 50000 + 30000
      expect(result.quarterSummary[0].totalTDS).toBe(1600); // 1000 + 600
      expect(result.quarterSummary[0].totalNet).toBe(78400); // 49000 + 29400
      expect(result.quarterSummary[0].pending).toBe(1);
      expect(result.quarterSummary[0].certificateReceived).toBe(0);
      expect(result.quarterSummary[0].verified).toBe(1);

      // Q2: 1 entry
      expect(result.quarterSummary[1].quarter).toBe(2);
      expect(result.quarterSummary[1].count).toBe(1);
      expect(result.quarterSummary[1].totalGross).toBe(80000);
      expect(result.quarterSummary[1].totalTDS).toBe(1600);
      expect(result.quarterSummary[1].certificateReceived).toBe(1);

      // Q3: 3 entries
      expect(result.quarterSummary[2].quarter).toBe(3);
      expect(result.quarterSummary[2].count).toBe(3);
      expect(result.quarterSummary[2].totalGross).toBe(220000); // 120000 + 60000 + 40000
      expect(result.quarterSummary[2].totalTDS).toBe(4400); // 2400 + 1200 + 800
      expect(result.quarterSummary[2].pending).toBe(2);
      expect(result.quarterSummary[2].verified).toBe(1);

      // Q4: 1 entry
      expect(result.quarterSummary[3].quarter).toBe(4);
      expect(result.quarterSummary[3].count).toBe(1);
      expect(result.quarterSummary[3].totalGross).toBe(100000);

      // Grand totals
      expect(result.totalEntries).toBe(7);
      expect(result.totalGross).toBe(480000); // sum of all grossAmount
      expect(result.totalTDS).toBe(9600); // sum of all tdsAmount
      expect(result.totalNet).toBe(470400); // sum of all netAmount
    });

    it('should return all zeros for empty financial year', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);

      const result = await tdsService.getSummary('2024-25');

      expect(result.financialYear).toBe('2024-25');
      expect(result.totalEntries).toBe(0);
      expect(result.totalGross).toBe(0);
      expect(result.totalTDS).toBe(0);
      expect(result.totalNet).toBe(0);

      result.quarterSummary.forEach((q) => {
        expect(q.count).toBe(0);
        expect(q.totalGross).toBe(0);
        expect(q.totalTDS).toBe(0);
        expect(q.totalNet).toBe(0);
        expect(q.pending).toBe(0);
        expect(q.certificateReceived).toBe(0);
        expect(q.verified).toBe(0);
      });
    });

    it('should count mixed statuses correctly', async () => {
      const entries = [
        makeTDSEntry({
          id: 'tds-1',
          quarter: 1,
          grossAmount: 10000,
          tdsAmount: 200,
          netAmount: 9800,
          status: 'PENDING',
        }),
        makeTDSEntry({
          id: 'tds-2',
          quarter: 1,
          grossAmount: 20000,
          tdsAmount: 400,
          netAmount: 19600,
          status: 'PENDING',
        }),
        makeTDSEntry({
          id: 'tds-3',
          quarter: 1,
          grossAmount: 30000,
          tdsAmount: 600,
          netAmount: 29400,
          status: 'CERTIFICATE_RECEIVED',
        }),
        makeTDSEntry({
          id: 'tds-4',
          quarter: 1,
          grossAmount: 40000,
          tdsAmount: 800,
          netAmount: 39200,
          status: 'VERIFIED',
        }),
        makeTDSEntry({
          id: 'tds-5',
          quarter: 1,
          grossAmount: 50000,
          tdsAmount: 1000,
          netAmount: 49000,
          status: 'VERIFIED',
        }),
      ];

      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await tdsService.getSummary('2025-26');

      const q1 = result.quarterSummary[0];
      expect(q1.count).toBe(5);
      expect(q1.pending).toBe(2);
      expect(q1.certificateReceived).toBe(1);
      expect(q1.verified).toBe(2);
    });

    it('should have grand totals matching sum of all entries', async () => {
      const entries = [
        makeTDSEntry({ id: 'tds-1', quarter: 1, grossAmount: 25000, tdsAmount: 500, netAmount: 24500 }),
        makeTDSEntry({ id: 'tds-2', quarter: 2, grossAmount: 75000, tdsAmount: 1500, netAmount: 73500 }),
        makeTDSEntry({ id: 'tds-3', quarter: 3, grossAmount: 50000, tdsAmount: 1000, netAmount: 49000 }),
      ];

      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await tdsService.getSummary('2025-26');

      expect(result.totalEntries).toBe(3);
      expect(result.totalGross).toBe(150000); // 25000 + 75000 + 50000
      expect(result.totalTDS).toBe(3000); // 500 + 1500 + 1000
      expect(result.totalNet).toBe(147000); // 24500 + 73500 + 49000
    });

    it('should query with correct financialYear filter', async () => {
      (mockPrisma.tds_entries.findMany as jest.Mock).mockResolvedValue([]);

      await tdsService.getSummary('2025-26');

      const callArg = (mockPrisma.tds_entries.findMany as jest.Mock).mock.calls[0][0];
      expect(callArg.where.financialYear).toBe('2025-26');
      expect(callArg.orderBy.quarter).toBe('asc');
    });
  });

  // ============================================
  // 6. getById
  // ============================================
  describe('getById', () => {
    it('should call findUnique with correct id', async () => {
      const mockEntry = makeTDSEntry();
      (mockPrisma.tds_entries.findUnique as jest.Mock).mockResolvedValue(mockEntry);

      const result = await tdsService.getById('tds-001');

      expect(mockPrisma.tds_entries.findUnique).toHaveBeenCalledWith({ where: { id: 'tds-001' } });
      expect(result).toEqual(mockEntry);
    });

    it('should return null when entry not found', async () => {
      (mockPrisma.tds_entries.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await tdsService.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ============================================
  // 7. delete
  // ============================================
  describe('delete', () => {
    it('should call delete with correct id', async () => {
      const mockDeleted = makeTDSEntry();
      (mockPrisma.tds_entries.delete as jest.Mock).mockResolvedValue(mockDeleted);

      const result = await tdsService.delete('tds-001');

      expect(mockPrisma.tds_entries.delete).toHaveBeenCalledWith({ where: { id: 'tds-001' } });
      expect(result).toEqual(mockDeleted);
    });
  });
});
