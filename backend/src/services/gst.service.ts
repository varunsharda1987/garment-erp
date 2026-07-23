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
import { logDebug, logError, logWarn } from '../utils/logger';
import { roundToCent, percentOf, addCurrency, toCurrency } from '../utils/currency';
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
   * Apparel HSN chapters where price-based GST slab applies:
   * ≤₹2,500/piece → 5%, >₹2,500/piece → 18%
   */
  private readonly APPAREL_HSN_CHAPTERS = ['61', '62'];
  private readonly APPAREL_PRICE_THRESHOLD = 2500;
  private readonly APPAREL_LOW_RATE = 5;
  private readonly APPAREL_HIGH_RATE = 18;

  /**
   * Get GST rate from database sources (replaces hardcoded getDefaultGSTRate)
   *
   * Priority:
   * 1. gstRateOverride (if explicitly provided)
   * 2. Material's gstRate field (if materialId provided)
   * 3. hsn_sac_masters table (exact code match, then chapter match)
   *    3a. Apparel price slab: If HSN chapter 61/62 AND unitPrice > ₹2,500 → override to 18%
   * 4. tax_masters fallback
   * 5. Absolute fallback: 5% (GST 2.0 default for textiles/apparel)
   */
  async getGSTRate(
    params: {
      hsnSacCode?: string | null;
      materialId?: string | null;
      gstRateOverride?: number | null;
      unitPrice?: number | null;
    } = {}
  ): Promise<number> {
    const { hsnSacCode, materialId, gstRateOverride, unitPrice } = params;

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
          const baseRate = Number(exact.defaultGstRate);
          return this.applyApparelPriceSlab(baseRate, resolvedHsnCode, unitPrice);
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
              const baseRate = Number(chapterMatch.defaultGstRate);
              return this.applyApparelPriceSlab(baseRate, resolvedHsnCode, unitPrice);
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
          OR: [{ applicableTo: null }, { applicableTo: { gte: new Date() } }],
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
   * Apply apparel price-based GST slab for finished garments (HSN 61/62).
   * Indian GST rule: garments ≤₹2,500/piece → 5%, >₹2,500/piece → 18%.
   * Only overrides when unitPrice is provided AND HSN is apparel chapter.
   */
  private applyApparelPriceSlab(baseRate: number, hsnCode: string, unitPrice?: number | null): number {
    if (!unitPrice || !hsnCode) return baseRate;

    const chapter = hsnCode.substring(0, 2);
    if (!this.APPAREL_HSN_CHAPTERS.includes(chapter)) return baseRate;

    if (unitPrice > this.APPAREL_PRICE_THRESHOLD) {
      logDebug(
        `[GST] Apparel price slab: HSN ${hsnCode}, unit price ₹${unitPrice} > ₹${this.APPAREL_PRICE_THRESHOLD} → ${this.APPAREL_HIGH_RATE}% (overriding base ${baseRate}%)`
      );
      return this.APPAREL_HIGH_RATE;
    }

    return this.APPAREL_LOW_RATE;
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
    const { lineTotal, hsnSacCode, materialId, gstRateOverride, isInterstate, unitPrice } = params;

    const gstRate = await this.getGSTRate({
      hsnSacCode,
      materialId,
      gstRateOverride,
      unitPrice,
    });

    // decimal.js math per bug-hunt financial-gst-13 (raw float * / toFixed drifted paise)
    let cgstRate = 0,
      cgstAmount = 0;
    let sgstRate = 0,
      sgstAmount = 0;
    let igstRate = 0,
      igstAmount = 0;

    if (isInterstate) {
      igstRate = gstRate;
      igstAmount = roundToCent(percentOf(lineTotal, gstRate)).toNumber();
    } else {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      cgstAmount = roundToCent(percentOf(lineTotal, cgstRate)).toNumber();
      sgstAmount = roundToCent(percentOf(lineTotal, sgstRate)).toNumber();
    }

    const taxAmount = roundToCent(addCurrency(cgstAmount, sgstAmount, igstAmount)).toNumber();

    return {
      hsnCode: hsnSacCode || null,
      gstRate,
      cgstRate: roundToCent(cgstRate).toNumber(),
      cgstAmount,
      sgstRate: roundToCent(sgstRate).toNumber(),
      sgstAmount,
      igstRate: roundToCent(igstRate).toNumber(),
      igstAmount,
      taxAmount,
    };
  }

  /**
   * Aggregate item-level GST into PO/invoice header totals
   */
  calculateTotals(items: Array<{ lineTotal: number } & LineItemGSTResult>): POGSTTotals {
    // Header totals are the EXACT decimal.js sum of the already-rounded per-line amounts that
    // get stored on the item rows, so header always reconciles with sum(items) to the paise
    // (bug-hunt financial-gst-13: float += accumulation drifted vs the stored line values).
    let subtotal = toCurrency(0);
    let totalCgst = toCurrency(0);
    let totalSgst = toCurrency(0);
    let totalIgst = toCurrency(0);

    for (const item of items) {
      subtotal = subtotal.plus(toCurrency(item.lineTotal));
      totalCgst = totalCgst.plus(toCurrency(item.cgstAmount));
      totalSgst = totalSgst.plus(toCurrency(item.sgstAmount));
      totalIgst = totalIgst.plus(toCurrency(item.igstAmount));
    }

    const roundedCgst = roundToCent(totalCgst);
    const roundedSgst = roundToCent(totalSgst);
    const roundedIgst = roundToCent(totalIgst);

    return {
      subtotal: roundToCent(subtotal).toNumber(),
      totalCgst: roundedCgst.toNumber(),
      totalSgst: roundedSgst.toNumber(),
      totalIgst: roundedIgst.toNumber(),
      totalTax: roundToCent(roundedCgst.plus(roundedSgst).plus(roundedIgst)).toNumber(),
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

      // Cannot determine (supplier has no GST/state data configured) — assume intrastate
      logDebug(`Could not determine supplier state for ${supplierId}, defaulting to intrastate`);
      return { isInterstate: false, supplierStateCode: null };
    } catch (error) {
      // bug-hunt financial-gst-14: a DB/lookup FAILURE must not silently classify the supply
      // as intrastate (wrong tax head on statutory documents) — propagate instead.
      logError('Error determining interstate status:', error);
      throw error;
    }
  }

  /**
   * Single interstate authority for state-ID based classification (bug-hunt financial-gst-14).
   * Compares the place-of-supply state row's stateCode against COMPANY_CONFIG.stateCode — the
   * same source isInterstatePO/isInterstateSale use — instead of comparing raw state UUIDs
   * against the COMPANY_STATE_ID env var. Lookup failures propagate; they must not default
   * the tax classification to intrastate.
   */
  async isInterstateByStateId(placeOfSupplyStateId: string): Promise<boolean> {
    const state = await prisma.indian_states.findUnique({
      where: { id: placeOfSupplyStateId },
      select: { stateCode: true },
    });
    if (!state) {
      throw new ValidationError('Place-of-supply state not found — cannot determine GST classification');
    }
    return state.stateCode !== COMPANY_CONFIG.stateCode;
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

      // Cannot determine (customer has no billing state configured) — assume intrastate
      logDebug(`Could not determine customer state for ${customerId}, defaulting to intrastate`);
      return { isInterstate: false, supplierStateCode: null };
    } catch (error) {
      // bug-hunt financial-gst-14: propagate lookup failures instead of silently intrastate
      logError('Error determining interstate sale status:', error);
      throw error;
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

      let cgst = 0,
        sgst = 0,
        igst = 0;
      let cgstRate = 0,
        sgstRate = 0,
        igstRate = 0;

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
   * WARNING: This method cannot apply the apparel price-based slab (5% vs 18%)
   * because it doesn't receive unitPrice. Use getGSTRate({ hsnSacCode, unitPrice }) instead.
   */
  getDefaultGSTRate(hsnCode?: string): number {
    const DEFAULT_GARMENT_RATE = 5;
    if (!hsnCode) {
      logWarn(
        '[GST] getDefaultGSTRate called without HSN code — defaulting to 5% GST. ' +
          'This CANNOT apply price-based slab (5% ≤₹2,500 / 18% >₹2,500). ' +
          'Migrate callers to use getGSTRate() with unitPrice parameter.'
      );
      return DEFAULT_GARMENT_RATE;
    }

    const hsnPrefix = hsnCode.substring(0, 2);
    switch (hsnPrefix) {
      // Apparel — base rate 5% (≤₹2,500/piece). For >₹2,500, use getGSTRate() with unitPrice.
      case '61':
      case '62':
      case '63':
        return 5;
      // Footwear
      case '64':
        return 5;
      // Textiles, fabrics, yarns (all 5% under GST 2.0)
      case '50':
      case '51':
      case '52':
      case '53':
      case '54':
      case '55':
      case '56':
      case '57':
      case '58':
      case '59':
      case '60':
        return 5;
      // Accessories (buttons, zippers, plastics, metal) — 18%
      case '39':
      case '83':
      case '96':
        return 18;
      // Packaging — 18%
      case '48':
      case '49':
        return 18;
      // Machine parts — 18%
      case '73':
      case '84':
        return 18;
      default:
        return DEFAULT_GARMENT_RATE;
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
