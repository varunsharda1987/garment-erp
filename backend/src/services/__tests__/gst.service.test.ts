/**
 * Unit Tests for GST Service
 * Tests the core GST calculation logic with mocked Prisma
 */

// Mock prisma before importing the service
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    materials: { findUnique: jest.fn() },
    hsn_sac_masters: { findUnique: jest.fn(), findFirst: jest.fn() },
    tax_masters: { findFirst: jest.fn() },
    supplier_gst_numbers: { findFirst: jest.fn() },
    suppliers: { findUnique: jest.fn() },
    customers: { findUnique: jest.fn() },
    indian_states: { findUnique: jest.fn() },
  },
}));

jest.mock('../../config/company.config', () => ({
  COMPANY_CONFIG: { stateCode: '29', gstin: '29AABCU9603R1ZM' },
}));

jest.mock('../../utils/logger', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

import { gstService } from '../gst.service';
import prisma from '../../config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GSTService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 1. calculateLineItemGST
  // ============================================
  describe('calculateLineItemGST', () => {
    // Mock getGSTRate to return a known rate for these tests
    beforeEach(() => {
      // Default: no material, no HSN, no tax_masters → fallback 12
      (mockPrisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.hsn_sac_masters.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.tax_masters.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should calculate intrastate GST (CGST + SGST split)', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 10000,
        gstRateOverride: 12,
        isInterstate: false,
      });

      expect(result.cgstRate).toBe(6);
      expect(result.sgstRate).toBe(6);
      expect(result.cgstAmount).toBe(600);
      expect(result.sgstAmount).toBe(600);
      expect(result.igstRate).toBe(0);
      expect(result.igstAmount).toBe(0);
      expect(result.taxAmount).toBe(1200);
      expect(result.gstRate).toBe(12);
    });

    it('should calculate interstate GST (IGST only)', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 10000,
        gstRateOverride: 12,
        isInterstate: true,
      });

      expect(result.cgstRate).toBe(0);
      expect(result.sgstRate).toBe(0);
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.igstRate).toBe(12);
      expect(result.igstAmount).toBe(1200);
      expect(result.taxAmount).toBe(1200);
    });

    it('should handle 5% rate with odd split (2.5% each)', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 10000,
        gstRateOverride: 5,
        isInterstate: false,
      });

      expect(result.cgstRate).toBe(2.5);
      expect(result.sgstRate).toBe(2.5);
      expect(result.cgstAmount).toBe(250);
      expect(result.sgstAmount).toBe(250);
      expect(result.taxAmount).toBe(500);
    });

    it('should handle 18% interstate', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 5000,
        gstRateOverride: 18,
        isInterstate: true,
      });

      expect(result.igstRate).toBe(18);
      expect(result.igstAmount).toBe(900);
      expect(result.taxAmount).toBe(900);
    });

    it('should return all zeros for zero amount', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 0,
        gstRateOverride: 12,
        isInterstate: false,
      });

      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.igstAmount).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('should return all zeros for zero rate', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 10000,
        gstRateOverride: 0,
        isInterstate: false,
      });

      expect(result.gstRate).toBe(0);
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
      expect(result.taxAmount).toBe(0);
    });

    it('should handle fractional amounts with proper rounding', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 999.99,
        gstRateOverride: 12,
        isInterstate: false,
      });

      // 999.99 * 6 / 100 = 59.9994 → toFixed(2) → 60.00
      expect(result.cgstAmount).toBe(60);
      expect(result.sgstAmount).toBe(60);
      expect(result.taxAmount).toBe(120);
    });

    it('should handle 28% rate (highest slab)', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 10000,
        gstRateOverride: 28,
        isInterstate: true,
      });

      expect(result.igstRate).toBe(28);
      expect(result.igstAmount).toBe(2800);
      expect(result.taxAmount).toBe(2800);
    });

    it('should set hsnCode from params', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 1000,
        hsnSacCode: '62114210',
        gstRateOverride: 12,
        isInterstate: false,
      });

      expect(result.hsnCode).toBe('62114210');
    });

    it('should set hsnCode to null when not provided', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 1000,
        gstRateOverride: 12,
        isInterstate: false,
      });

      expect(result.hsnCode).toBeNull();
    });

    it('should handle large amounts without precision loss', async () => {
      const result = await gstService.calculateLineItemGST({
        lineTotal: 9999999.99,
        gstRateOverride: 28,
        isInterstate: true,
      });

      // 9999999.99 * 28 / 100 = 2799999.9972 → 2800000.00
      expect(result.igstAmount).toBeCloseTo(2800000, 0);
      expect(result.taxAmount).toBeCloseTo(2800000, 0);
    });
  });

  // ============================================
  // 2. getGSTRate — 5-Priority Resolution
  // ============================================
  describe('getGSTRate', () => {
    beforeEach(() => {
      (mockPrisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.hsn_sac_masters.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.tax_masters.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should return override when explicitly provided', async () => {
      const rate = await gstService.getGSTRate({ gstRateOverride: 5 });
      expect(rate).toBe(5);
      expect(mockPrisma.materials.findUnique).not.toHaveBeenCalled();
    });

    it('should return 0 when override is 0', async () => {
      const rate = await gstService.getGSTRate({ gstRateOverride: 0 });
      expect(rate).toBe(0);
    });

    it('should return material gstRate when available', async () => {
      (mockPrisma.materials.findUnique as jest.Mock).mockResolvedValue({
        gstRate: 18,
        hsnCode: '62114210',
      });

      const rate = await gstService.getGSTRate({ materialId: 'mat-1' });
      expect(rate).toBe(18);
    });

    it('should use material hsnCode for HSN lookup when no gstRate', async () => {
      (mockPrisma.materials.findUnique as jest.Mock).mockResolvedValue({
        gstRate: null,
        hsnCode: '62114210',
      });
      (mockPrisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({
        defaultGstRate: 12,
      });

      const rate = await gstService.getGSTRate({ materialId: 'mat-1' });
      expect(rate).toBe(12);
      expect(mockPrisma.hsn_sac_masters.findUnique).toHaveBeenCalledWith({
        where: { code: '62114210' },
        select: { defaultGstRate: true },
      });
    });

    it('should try chapter match when exact HSN not found', async () => {
      (mockPrisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.hsn_sac_masters.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // 4-digit chapter miss
        .mockResolvedValueOnce({ defaultGstRate: 5 }); // 2-digit chapter hit

      const rate = await gstService.getGSTRate({ hsnSacCode: '52081390' });
      expect(rate).toBe(5);
    });

    it('should try 4-digit chapter before 2-digit', async () => {
      (mockPrisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.hsn_sac_masters.findFirst as jest.Mock).mockResolvedValueOnce({ defaultGstRate: 18 }); // 4-digit hit

      const rate = await gstService.getGSTRate({ hsnSacCode: '96064100' });
      expect(rate).toBe(18);
      // Should only call once (4-digit match found)
      expect(mockPrisma.hsn_sac_masters.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should fall back to tax_masters when no HSN match', async () => {
      (mockPrisma.tax_masters.findFirst as jest.Mock).mockResolvedValue({
        taxRate: 5,
      });

      const rate = await gstService.getGSTRate({});
      expect(rate).toBe(5);
    });

    it('should return 5% fallback when all lookups fail (GST 2.0 textile default)', async () => {
      const rate = await gstService.getGSTRate({});
      expect(rate).toBe(5);
    });

    it('should not use hsnSacCode param if material hsnCode is null and hsnSacCode is provided', async () => {
      (mockPrisma.materials.findUnique as jest.Mock).mockResolvedValue({
        gstRate: null,
        hsnCode: null,
      });
      (mockPrisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({
        defaultGstRate: 18,
      });

      const rate = await gstService.getGSTRate({
        materialId: 'mat-1',
        hsnSacCode: '96060000',
      });
      expect(rate).toBe(18);
      // Should use the hsnSacCode param since material has no hsnCode
      expect(mockPrisma.hsn_sac_masters.findUnique).toHaveBeenCalledWith({
        where: { code: '96060000' },
        select: { defaultGstRate: true },
      });
    });
  });

  // ============================================
  // 3. calculateTotals — Aggregation
  // ============================================
  describe('calculateTotals', () => {
    it('should aggregate single item correctly', () => {
      const result = gstService.calculateTotals([
        {
          lineTotal: 10000,
          hsnCode: '62114210',
          gstRate: 12,
          cgstRate: 6,
          cgstAmount: 600,
          sgstRate: 6,
          sgstAmount: 600,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 1200,
        },
      ]);

      expect(result.subtotal).toBe(10000);
      expect(result.totalCgst).toBe(600);
      expect(result.totalSgst).toBe(600);
      expect(result.totalIgst).toBe(0);
      expect(result.totalTax).toBe(1200);
    });

    it('should aggregate multiple items', () => {
      const result = gstService.calculateTotals([
        {
          lineTotal: 5000,
          hsnCode: null,
          gstRate: 12,
          cgstRate: 6,
          cgstAmount: 300,
          sgstRate: 6,
          sgstAmount: 300,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 600,
        },
        {
          lineTotal: 3000,
          hsnCode: null,
          gstRate: 18,
          cgstRate: 9,
          cgstAmount: 270,
          sgstRate: 9,
          sgstAmount: 270,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 540,
        },
      ]);

      expect(result.subtotal).toBe(8000);
      expect(result.totalCgst).toBe(570);
      expect(result.totalSgst).toBe(570);
      expect(result.totalTax).toBe(1140);
    });

    it('should return all zeros for empty array', () => {
      const result = gstService.calculateTotals([]);

      expect(result.subtotal).toBe(0);
      expect(result.totalCgst).toBe(0);
      expect(result.totalSgst).toBe(0);
      expect(result.totalIgst).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('should handle mixed interstate/intrastate items', () => {
      const result = gstService.calculateTotals([
        {
          lineTotal: 5000,
          hsnCode: null,
          gstRate: 12,
          cgstRate: 6,
          cgstAmount: 300,
          sgstRate: 6,
          sgstAmount: 300,
          igstRate: 0,
          igstAmount: 0,
          taxAmount: 600,
        },
        {
          lineTotal: 5000,
          hsnCode: null,
          gstRate: 12,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: 12,
          igstAmount: 600,
          taxAmount: 600,
        },
      ]);

      expect(result.subtotal).toBe(10000);
      expect(result.totalCgst).toBe(300);
      expect(result.totalSgst).toBe(300);
      expect(result.totalIgst).toBe(600);
      expect(result.totalTax).toBe(1200);
    });
  });

  // ============================================
  // 4. isInterstatePO — 3-Tier Lookup
  // ============================================
  describe('isInterstatePO', () => {
    beforeEach(() => {
      (mockPrisma.supplier_gst_numbers.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.suppliers.findUnique as jest.Mock).mockResolvedValue(null);
    });

    it('should detect intrastate from primary GST (same state)', async () => {
      (mockPrisma.supplier_gst_numbers.findFirst as jest.Mock).mockResolvedValueOnce({ stateCode: '29' }); // Primary GST

      const result = await gstService.isInterstatePO('supplier-1');

      expect(result.isInterstate).toBe(false);
      expect(result.supplierStateCode).toBe('29');
    });

    it('should detect interstate from primary GST (different state)', async () => {
      (mockPrisma.supplier_gst_numbers.findFirst as jest.Mock).mockResolvedValueOnce({ stateCode: '27' }); // Primary GST - Maharashtra

      const result = await gstService.isInterstatePO('supplier-1');

      expect(result.isInterstate).toBe(true);
      expect(result.supplierStateCode).toBe('27');
    });

    it('should fall back to any GST number when no primary', async () => {
      (mockPrisma.supplier_gst_numbers.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // No primary
        .mockResolvedValueOnce({ stateCode: '33' }); // Any GST - Tamil Nadu

      const result = await gstService.isInterstatePO('supplier-1');

      expect(result.isInterstate).toBe(true);
      expect(result.supplierStateCode).toBe('33');
    });

    it('should fall back to billing state when no GST numbers', async () => {
      (mockPrisma.supplier_gst_numbers.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.suppliers.findUnique as jest.Mock).mockResolvedValue({
        billingStateId: 'state-1',
        billing_state: { stateCode: '29' },
      });

      const result = await gstService.isInterstatePO('supplier-1');

      expect(result.isInterstate).toBe(false);
      expect(result.supplierStateCode).toBe('29');
    });

    it('should default to intrastate when no data available', async () => {
      const result = await gstService.isInterstatePO('supplier-1');

      expect(result.isInterstate).toBe(false);
      expect(result.supplierStateCode).toBeNull();
    });

    it('should handle error gracefully', async () => {
      (mockPrisma.supplier_gst_numbers.findFirst as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await gstService.isInterstatePO('supplier-1');

      expect(result.isInterstate).toBe(false);
      expect(result.supplierStateCode).toBeNull();
    });
  });

  // ============================================
  // 5. isInterstateSale — Customer State Lookup
  // ============================================
  describe('isInterstateSale', () => {
    it('should detect interstate sale (different state)', async () => {
      (mockPrisma.customers.findUnique as jest.Mock).mockResolvedValue({
        billingStateId: 'state-mh',
        billingState: { stateCode: '27' },
      });

      const result = await gstService.isInterstateSale('cust-1');
      expect(result.isInterstate).toBe(true);
      expect(result.supplierStateCode).toBe('27');
    });

    it('should detect intrastate sale (same state)', async () => {
      (mockPrisma.customers.findUnique as jest.Mock).mockResolvedValue({
        billingStateId: 'state-ka',
        billingState: { stateCode: '29' },
      });

      const result = await gstService.isInterstateSale('cust-1');
      expect(result.isInterstate).toBe(false);
    });

    it('should default to intrastate when no billing state', async () => {
      (mockPrisma.customers.findUnique as jest.Mock).mockResolvedValue({
        billingStateId: null,
        billingState: null,
      });

      const result = await gstService.isInterstateSale('cust-1');
      expect(result.isInterstate).toBe(false);
      expect(result.supplierStateCode).toBeNull();
    });
  });

  // ============================================
  // 6. getSACCodeForService
  // ============================================
  describe('getSACCodeForService', () => {
    beforeEach(() => {
      (mockPrisma.hsn_sac_masters.findFirst as jest.Mock).mockResolvedValue(null);
    });

    const sacMappings: [string, string][] = [
      ['DYEING', '998821'],
      ['PRINTING', '998822'],
      ['EMBROIDERY', '998823'],
      ['CUTTING', '998831'],
      ['STITCHING', '998832'],
      ['WASHING', '998833'],
      ['FINISHING', '998833'],
      ['HANDWORK', '998829'],
      ['SMOCKING', '998829'],
      ['TRANSPORTATION', '998871'],
      ['OTHER', '998829'],
      ['PROCESSING', '998829'],
    ];

    it.each(sacMappings)('should map %s to SAC code %s', async (serviceType, expectedSac) => {
      const result = await gstService.getSACCodeForService(serviceType);
      expect(result.sacCode).toBe(expectedSac);
    });

    it('should return fallback SAC for unknown service type', async () => {
      const result = await gstService.getSACCodeForService('UNKNOWN_SERVICE');
      expect(result.sacCode).toBe('998829');
    });

    it('should return rate from hsn_sac_masters when available', async () => {
      (mockPrisma.hsn_sac_masters.findFirst as jest.Mock).mockResolvedValue({
        defaultGstRate: 12,
      });

      const result = await gstService.getSACCodeForService('DYEING');
      expect(result.gstRate).toBe(12);
    });

    it('should return 18% when hsn_sac_masters has no entry', async () => {
      const result = await gstService.getSACCodeForService('DYEING');
      expect(result.gstRate).toBe(18);
    });

    it('should handle case-insensitive service type', async () => {
      const result = await gstService.getSACCodeForService('dyeing');
      expect(result.sacCode).toBe('998821');
    });
  });

  // ============================================
  // 7. validateGSTNumber
  // ============================================
  describe('validateGSTNumber', () => {
    it('should validate correct GST number with matching state', () => {
      expect(gstService.validateGSTNumber('29AABCU9603R1ZM', '29')).toBe(true);
    });

    it('should reject GST with mismatched state code', () => {
      expect(gstService.validateGSTNumber('27AABCU9603R1ZM', '29')).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(gstService.validateGSTNumber('INVALID', '29')).toBe(false);
    });

    it('should reject empty GST number', () => {
      expect(gstService.validateGSTNumber('', '29')).toBe(false);
    });

    it('should reject empty state code', () => {
      expect(gstService.validateGSTNumber('29AABCU9603R1ZM', '')).toBe(false);
    });

    it('should handle lowercase (auto-uppercased)', () => {
      // The service trims and uppercases, so lowercase should pass
      expect(gstService.validateGSTNumber('29aabcu9603r1zm', '29')).toBe(true);
    });

    it('should reject wrong length', () => {
      expect(gstService.validateGSTNumber('29AABCU9603R1Z', '29')).toBe(false); // 14 chars
      expect(gstService.validateGSTNumber('29AABCU9603R1ZMX', '29')).toBe(false); // 16 chars
    });

    it('should handle whitespace in inputs', () => {
      expect(gstService.validateGSTNumber(' 29AABCU9603R1ZM ', ' 29 ')).toBe(true);
    });
  });

  // ============================================
  // 8. extractStateCodeFromGST
  // ============================================
  describe('extractStateCodeFromGST', () => {
    it('should extract state code from valid GST', () => {
      expect(gstService.extractStateCodeFromGST('29AABCU9603R1ZM')).toBe('29');
    });

    it('should extract state code from partial string', () => {
      expect(gstService.extractStateCodeFromGST('27')).toBe('27');
    });

    it('should return null for empty string', () => {
      expect(gstService.extractStateCodeFromGST('')).toBeNull();
    });

    it('should return null for single character', () => {
      expect(gstService.extractStateCodeFromGST('2')).toBeNull();
    });
  });

  // ============================================
  // 9. getDefaultGSTRate (legacy, deprecated)
  // ============================================
  describe('getDefaultGSTRate (legacy)', () => {
    it('should return 5% (base rate) for garment HSN codes (61-63)', () => {
      // GST 2.0: garments ≤₹2,500/piece → 5%, >₹2,500 → 18%
      // getDefaultGSTRate returns base rate (no unitPrice param), so always 5%
      expect(gstService.getDefaultGSTRate('6109')).toBe(5);
      expect(gstService.getDefaultGSTRate('6204')).toBe(5);
      expect(gstService.getDefaultGSTRate('6309')).toBe(5);
    });

    it('should return 5% for footwear HSN (64)', () => {
      expect(gstService.getDefaultGSTRate('6403')).toBe(5);
    });

    it('should return 5% for fabric HSN codes (50-60)', () => {
      expect(gstService.getDefaultGSTRate('5208')).toBe(5);
      expect(gstService.getDefaultGSTRate('5407')).toBe(5);
      expect(gstService.getDefaultGSTRate('6001')).toBe(5);
    });

    it('should return 18% for accessories HSN (96xx)', () => {
      // HSN 96 = buttons, zippers, accessories → 18%
      expect(gstService.getDefaultGSTRate('9606')).toBe(18);
    });

    it('should return 5% for no HSN (default garment rate)', () => {
      expect(gstService.getDefaultGSTRate()).toBe(5);
      expect(gstService.getDefaultGSTRate(undefined)).toBe(5);
    });
  });

  // ============================================
  // 9b. Apparel price-based GST slab (unit test for applyApparelPriceSlab via getGSTRate)
  // ============================================
  describe('apparel price-based GST slab', () => {
    it('should apply 5% for garment HSN 61/62 when unitPrice ≤ ₹2,500', async () => {
      // Mock hsn_sac_masters to return 5% for apparel
      (prisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({ defaultGstRate: 5 });

      const rate = await gstService.getGSTRate({
        hsnSacCode: '6109',
        unitPrice: 2000,
      });
      expect(rate).toBe(5);
    });

    it('should apply 18% for garment HSN 61/62 when unitPrice > ₹2,500', async () => {
      (prisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({ defaultGstRate: 5 });

      const rate = await gstService.getGSTRate({
        hsnSacCode: '6204',
        unitPrice: 3000,
      });
      expect(rate).toBe(18);
    });

    it('should apply 5% at exactly ₹2,500 boundary', async () => {
      (prisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({ defaultGstRate: 5 });

      const rate = await gstService.getGSTRate({
        hsnSacCode: '6109',
        unitPrice: 2500,
      });
      expect(rate).toBe(5); // ≤₹2,500 → 5%
    });

    it('should NOT apply apparel slab to non-apparel HSN (fabric 52)', async () => {
      (prisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({ defaultGstRate: 5 });

      const rate = await gstService.getGSTRate({
        hsnSacCode: '5208',
        unitPrice: 5000, // Even with high price, fabric stays 5%
      });
      expect(rate).toBe(5);
    });

    it('should NOT apply apparel slab when unitPrice not provided', async () => {
      (prisma.materials.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.hsn_sac_masters.findUnique as jest.Mock).mockResolvedValue({ defaultGstRate: 5 });

      const rate = await gstService.getGSTRate({
        hsnSacCode: '6109',
        // No unitPrice — slab not applied
      });
      expect(rate).toBe(5);
    });
  });

  // ============================================
  // 10. calculateGST (legacy)
  // ============================================
  describe('calculateGST (legacy)', () => {
    it('should calculate intrastate (same state IDs)', async () => {
      const result = await gstService.calculateGST(10000, 12, 'state-1', 'state-1');

      expect(result.isInterstate).toBe(false);
      expect(result.cgstRate).toBe(6);
      expect(result.sgstRate).toBe(6);
      expect(result.cgst).toBe(600);
      expect(result.sgst).toBe(600);
      expect(result.igst).toBe(0);
      expect(result.totalTax).toBe(1200);
    });

    it('should calculate interstate (different state IDs)', async () => {
      const result = await gstService.calculateGST(10000, 12, 'state-1', 'state-2');

      expect(result.isInterstate).toBe(true);
      expect(result.igstRate).toBe(12);
      expect(result.igst).toBe(1200);
      expect(result.cgst).toBe(0);
      expect(result.sgst).toBe(0);
    });

    it('should throw for negative amount', async () => {
      await expect(gstService.calculateGST(-100, 12, 'state-1', 'state-1')).rejects.toThrow(
        'Amount cannot be negative'
      );
    });

    it('should throw for invalid tax rate', async () => {
      await expect(gstService.calculateGST(1000, 101, 'state-1', 'state-1')).rejects.toThrow(
        'Tax rate must be between 0 and 100'
      );
    });

    it('should throw for missing state IDs', async () => {
      await expect(gstService.calculateGST(1000, 12, '', 'state-1')).rejects.toThrow(
        'Supplier and customer state IDs are required'
      );
    });
  });
});
