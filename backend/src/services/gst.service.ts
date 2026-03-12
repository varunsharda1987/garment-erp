/**
 * GST Service
 * Handles GST validation and calculation for Indian tax compliance
 *
 * Provides:
 * - GST number validation
 * - Database-driven rate lookups (hsn_sac_masters + tax_masters + material gstRate)
 * - Per-line-item GST calculation (reusable across all PO/invoice services)
 * - PO/invoice total aggregation
 * - Interstate detection for suppliers
 * - SAC code mapping for service POs
 */

import prisma from '../config/database';
import { COMPANY_CONFIG } from '../config/company.config';
import { ValidationError } from '../errors';
import { logDebug, logError } from '../utils/logger';
import type {
  LineItemGSTResult,
  POGSTTotals,
  InterstatePOResult,
  CalculateLineItemGSTParams,
  SACCodeResult,
} from '../types/gst.types';

// Re-export types for consumers
export type { LineItemGSTResult, POGSTTotals, InterstatePOResult, CalculateLineItemGSTParams, SACCodeResult };

// ============================================
// Types (kept for backward compatibility)
// ============================================

export interface GSTCalculation {
  cgst: number;
  sgst: number;
  igst: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  totalTax: number;
  isInterstate: boolean;
}

// SAC code mapping for service types
const SERVICE_SAC_MAPPING: Record<string, string> = {
  DYEING: '998821',
  PRINTING: '998822',
  EMBROIDERY: '998823',
  CUTTING: '998831',
  STITCHING: '998832',
  WASHING: '998833',
  FINISHING: '998833',
  HANDWORK: '998829',
  SMOCKING: '998829',
  TRANSPORTATION: '998871',
  OTHER: '998829',
  PROCESSING: '998829',
};

// ============================================
// GST Service Class
// ============================================

class GSTServiceClass {

  // ============================================
  // Rate Lookup Methods (Database-Driven)
  // ============================================

  /**
   * Get GST rate from database sources (replaces hardcoded getDefaultGSTRate)
   *
   * Priority:
   * 1. gstRateOverride (if explicitly provided)
   * 2. Material's gstRate field (if materialId provided)
   * 3. hsn_sac_masters table (exact code match, then chapter match)
   * 4. tax_masters fallback
   * 5. Absolute fallback: 5% (GST 2.0 default for textiles/apparel)
   */
  async getGSTRate(params: {
    hsnSacCode?: string | null;
    materialId?: string | null;
    gstRateOverride?: number | null;
  } = {}): Promise<number> {
    const { hsnSacCode, materialId, gstRateOverride } = params;

    // 1. Explicit override
    if (gstRateOverride !== null && gstRateOverride !== undefined) {
      return gstRateOverride;
    }

    // 2. Material's own gstRate
    let resolvedHsnCode = hsnSacCode;
    if (materialId) {
      try {
        const material = await prisma.materials.findUnique({
          where: { id: materialId },
          select: { gstRate: true, hsnCode: true },
        });
        if (material?.gstRate) {
          return Number(material.gstRate);
        }
        if (material?.hsnCode && !resolvedHsnCode) {
          resolvedHsnCode = material.hsnCode;
        }
      } catch (error) {
        logDebug('Could not lookup material for GST rate, continuing with other sources');
      }
    }

    // 3. hsn_sac_masters lookup
    if (resolvedHsnCode) {
      try {
        // Exact code match
        const exact = await prisma.hsn_sac_masters.findUnique({
          where: { code: resolvedHsnCode },
          select: { defaultGstRate: true },
        });
        if (exact) {
          return Number(exact.defaultGstRate);
        }

        // Chapter-level match (4-digit, then 2-digit)
        for (const len of [4, 2]) {
          if (resolvedHsnCode.length >= len) {
            const prefix = resolvedHsnCode.substring(0, len);
            const chapterMatch = await prisma.hsn_sac_masters.findFirst({
              where: { chapter: prefix, isActive: true },
              select: { defaultGstRate: true },
            });
            if (chapterMatch) {
              return Number(chapterMatch.defaultGstRate);
            }
          }
        }
      } catch (error) {
        logDebug('HSN/SAC lookup failed, falling back to tax_masters');
      }
    }

    // 4. tax_masters fallback
    try {
      const defaultTax = await prisma.tax_masters.findFirst({
        where: {
          taxType: 'GST',
          isActive: true,
          applicableFrom: { lte: new Date() },
          OR: [
            { applicableTo: null },
            { applicableTo: { gte: new Date() } },
          ],
        },
        orderBy: { taxRate: 'asc' },
      });
      if (defaultTax) {
        return Number(defaultTax.taxRate);
      }
    } catch (error) {
      logDebug('tax_masters lookup failed');
    }

    // 5. Absolute fallback (GST 2.0: 5% for textiles/apparel)
    return 5;
  }

  /**
   * Get SAC code and GST rate for a service type
   */
  async getSACCodeForService(serviceType: string): Promise<SACCodeResult> {
    const sacCode = SERVICE_SAC_MAPPING[serviceType?.toUpperCase()] || '998829';

    try {
      const hsnMaster = await prisma.hsn_sac_masters.findFirst({
        where: { code: sacCode, isActive: true },
        select: { defaultGstRate: true },
      });
      return {
        sacCode,
        gstRate: hsnMaster ? Number(hsnMaster.defaultGstRate) : 18,
      };
    } catch (error) {
      logDebug('SAC lookup failed, using default 18%');
      return { sacCode, gstRate: 18 };
    }
  }

  // ============================================
  // Shared GST Calculation Helpers
  // ============================================

  /**
   * Calculate GST for a single line item
   * Reusable across manual POs, cost sheet POs, service POs, MRP POs, invoices, quotations
   */
  async calculateLineItemGST(params: CalculateLineItemGSTParams): Promise<LineItemGSTResult> {
    const { lineTotal, hsnSacCode, materialId, gstRateOverride, isInterstate } = params;

    const gstRate = await this.getGSTRate({
      hsnSacCode,
      materialId,
      gstRateOverride,
    });

    let cgstRate = 0, cgstAmount = 0;
    let sgstRate = 0, sgstAmount = 0;
    let igstRate = 0, igstAmount = 0;

    if (isInterstate) {
      igstRate = gstRate;
      igstAmount = parseFloat(((lineTotal * gstRate) / 100).toFixed(2));
    } else {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      cgstAmount = parseFloat(((lineTotal * cgstRate) / 100).toFixed(2));
      sgstAmount = parseFloat(((lineTotal * sgstRate) / 100).toFixed(2));
    }

    const taxAmount = cgstAmount + sgstAmount + igstAmount;

    return {
      hsnCode: hsnSacCode || null,
      gstRate,
      cgstRate: parseFloat(cgstRate.toFixed(2)),
      cgstAmount,
      sgstRate: parseFloat(sgstRate.toFixed(2)),
      sgstAmount,
      igstRate: parseFloat(igstRate.toFixed(2)),
      igstAmount,
      taxAmount: parseFloat(taxAmount.toFixed(2)),
    };
  }

  /**
   * Aggregate item-level GST into PO/invoice header totals
   */
  calculateTotals(items: Array<{ lineTotal: number } & LineItemGSTResult>): POGSTTotals {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of items) {
      subtotal += item.lineTotal;
      totalCgst += item.cgstAmount;
      totalSgst += item.sgstAmount;
      totalIgst += item.igstAmount;
    }

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalCgst: parseFloat(totalCgst.toFixed(2)),
      totalSgst: parseFloat(totalSgst.toFixed(2)),
      totalIgst: parseFloat(totalIgst.toFixed(2)),
      totalTax: parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2)),
    };
  }

  /**
   * Determine if a PO is interstate based on supplier's primary GST registration
   * Compares supplier's state code with company's state code (COMPANY_CONFIG.stateCode)
   */
  async isInterstatePO(supplierId: string): Promise<InterstatePOResult> {
    try {
      // Try primary GST number first
      const primaryGst = await prisma.supplier_gst_numbers.findFirst({
        where: { supplierId, isPrimary: true },
        select: { stateCode: true },
      });

      if (primaryGst) {
        return {
          isInterstate: primaryGst.stateCode !== COMPANY_CONFIG.stateCode,
          supplierStateCode: primaryGst.stateCode,
        };
      }

      // Fallback to any GST number
      const anyGst = await prisma.supplier_gst_numbers.findFirst({
        where: { supplierId },
        select: { stateCode: true },
      });

      if (anyGst) {
        return {
          isInterstate: anyGst.stateCode !== COMPANY_CONFIG.stateCode,
          supplierStateCode: anyGst.stateCode,
        };
      }

      // Fallback to supplier billing state
      const supplier = await prisma.suppliers.findUnique({
        where: { id: supplierId },
        select: {
          billingStateId: true,
          billing_state: { select: { stateCode: true } },
        },
      });

      if (supplier?.billing_state?.stateCode) {
        return {
          isInterstate: supplier.billing_state.stateCode !== COMPANY_CONFIG.stateCode,
          supplierStateCode: supplier.billing_state.stateCode,
        };
      }

      // Cannot determine — assume intrastate (safer for tax purposes)
      logDebug(`Could not determine supplier state for ${supplierId}, defaulting to intrastate`);
      return { isInterstate: false, supplierStateCode: null };
    } catch (error) {
      logError('Error determining interstate status:', error);
      return { isInterstate: false, supplierStateCode: null };
    }
  }

  /**
   * Determine if a sale is interstate based on customer's state
   */
  async isInterstateSale(customerId: string): Promise<InterstatePOResult> {
    try {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: {
          billingStateId: true,
          billingState: { select: { stateCode: true } },
        },
      });

      if (customer?.billingState?.stateCode) {
        return {
          isInterstate: customer.billingState.stateCode !== COMPANY_CONFIG.stateCode,
          supplierStateCode: customer.billingState.stateCode,
        };
      }

      // Cannot determine — assume intrastate
      logDebug(`Could not determine customer state for ${customerId}, defaulting to intrastate`);
      return { isInterstate: false, supplierStateCode: null };
    } catch (error) {
      logError('Error determining interstate sale status:', error);
      return { isInterstate: false, supplierStateCode: null };
    }
  }

  // ============================================
  // GST Validation Methods (unchanged)
  // ============================================

  /**
   * Validate GST number format and state code match
   */
  validateGSTNumber(gstNumber: string, stateCode: string): boolean {
    try {
      if (!gstNumber || !stateCode) {
        return false;
      }

      const cleanGST = gstNumber.trim().toUpperCase();
      const cleanStateCode = stateCode.trim();

      if (cleanGST.length !== 15) {
        logDebug(`GST validation failed: Invalid length (${cleanGST.length}, expected 15)`);
        return false;
      }

      const gstPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
      if (!gstPattern.test(cleanGST)) {
        logDebug(`GST validation failed: Invalid format`);
        return false;
      }

      const gstStateCode = cleanGST.substring(0, 2);
      if (gstStateCode !== cleanStateCode) {
        logDebug(`GST validation failed: State code mismatch (GST: ${gstStateCode}, Expected: ${cleanStateCode})`);
        return false;
      }

      logDebug(`GST validation passed: ${cleanGST}`);
      return true;
    } catch (error) {
      logError('Error validating GST number:', error);
      return false;
    }
  }

  /**
   * Extract state code from GST number
   */
  extractStateCodeFromGST(gstNumber: string): string | null {
    if (!gstNumber || gstNumber.length < 2) {
      return null;
    }
    return gstNumber.substring(0, 2);
  }

  // ============================================
  // Legacy Methods (kept for backward compatibility)
  // ============================================

  /**
   * Calculate GST breakdown based on supplier and customer states
   * (Kept for backward compatibility — new code should use calculateLineItemGST + calculateTotals)
   */
  async calculateGST(
    amount: number,
    taxRate: number,
    supplierStateId: string,
    customerStateId: string
  ): Promise<GSTCalculation> {
    try {
      if (amount < 0) {
        throw new ValidationError('Amount cannot be negative');
      }
      if (taxRate < 0 || taxRate > 100) {
        throw new ValidationError('Tax rate must be between 0 and 100');
      }
      if (!supplierStateId || !customerStateId) {
        throw new ValidationError('Supplier and customer state IDs are required');
      }

      const isInterstate = supplierStateId !== customerStateId;

      let cgst = 0, sgst = 0, igst = 0;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;

      if (isInterstate) {
        igstRate = taxRate;
        igst = (amount * taxRate) / 100;
      } else {
        cgstRate = taxRate / 2;
        sgstRate = taxRate / 2;
        cgst = (amount * cgstRate) / 100;
        sgst = (amount * sgstRate) / 100;
      }

      const totalTax = cgst + sgst + igst;

      return {
        cgst: parseFloat(cgst.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        igst: parseFloat(igst.toFixed(2)),
        cgstRate: parseFloat(cgstRate.toFixed(2)),
        sgstRate: parseFloat(sgstRate.toFixed(2)),
        igstRate: parseFloat(igstRate.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        isInterstate,
      };
    } catch (error) {
      logError('Error calculating GST:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use getGSTRate() instead. Kept for backward compatibility.
   */
  getDefaultGSTRate(hsnCode?: string): number {
    // GST 2.0 (Sep 22, 2025): Default 5% for textiles/apparel (≤₹2,500)
    const DEFAULT_GARMENT_RATE = 5;
    if (!hsnCode) return DEFAULT_GARMENT_RATE;

    const hsnPrefix = hsnCode.substring(0, 2);
    switch (hsnPrefix) {
      // Apparel (5% for ≤₹2,500; 18% for >₹2,500 — default to 5%)
      case '61': case '62': case '63': return 5;
      // Footwear
      case '64': return 5;
      // Textiles, fabrics, yarns (all 5% under GST 2.0)
      case '50': case '51': case '52': case '53': case '54':
      case '55': case '56': case '57': case '58': case '59':
      case '60': return 5;
      // Accessories (buttons, zippers, plastics, metal) — 18%
      case '39': case '83': case '96': return 18;
      // Packaging — 18%
      case '48': case '49': return 18;
      // Machine parts — 18%
      case '73': case '84': return 18;
      default: return DEFAULT_GARMENT_RATE;
    }
  }

  /**
   * Validate if a state ID exists
   */
  async validateStateId(stateId: string): Promise<boolean> {
    try {
      const state = await prisma.indian_states.findUnique({
        where: { id: stateId },
      });
      return state !== null && state.isActive;
    } catch (error) {
      logError('Error validating state ID:', error);
      return false;
    }
  }

  /**
   * Get state by code
   */
  async getStateByCode(stateCode: string): Promise<{ id: string; stateName: string } | null> {
    try {
      const state = await prisma.indian_states.findUnique({
        where: { stateCode },
        select: { id: true, stateName: true },
      });
      return state;
    } catch (error) {
      logError('Error getting state by code:', error);
      return null;
    }
  }
}

// Export singleton instance
export const gstService = new GSTServiceClass();
export default gstService;
