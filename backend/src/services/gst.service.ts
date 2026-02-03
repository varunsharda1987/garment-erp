/**
 * GST Service
 * Handles GST validation and calculation for Indian tax compliance
 */

import prisma from '../config/database';
import { ValidationError } from '../errors';
import { logDebug, logError } from '../utils/logger';

// ============================================
// Types
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

// ============================================
// GST Service Class
// ============================================

class GSTServiceClass {
  /**
   * Validate GST number format and state code match
   * GST Format: 15 alphanumeric characters
   * Pattern: \d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}
   * First 2 digits must match the state code
   */
  validateGSTNumber(gstNumber: string, stateCode: string): boolean {
    try {
      // Basic validation
      if (!gstNumber || !stateCode) {
        return false;
      }

      // Remove whitespace and convert to uppercase
      const cleanGST = gstNumber.trim().toUpperCase();
      const cleanStateCode = stateCode.trim();

      // Check length
      if (cleanGST.length !== 15) {
        logDebug(`GST validation failed: Invalid length (${cleanGST.length}, expected 15)`);
        return false;
      }

      // Check format using regex
      const gstPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
      if (!gstPattern.test(cleanGST)) {
        logDebug(`GST validation failed: Invalid format`);
        return false;
      }

      // Extract state code from GST number (first 2 digits)
      const gstStateCode = cleanGST.substring(0, 2);

      // Compare with provided state code
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

  /**
   * Calculate GST breakdown based on supplier and customer states
   *
   * Rules:
   * - Intra-state (same state): CGST + SGST (split rate equally)
   * - Inter-state (different states): IGST (full rate)
   *
   * @param amount - Taxable amount
   * @param taxRate - Total tax rate (e.g., 12, 18, 28)
   * @param supplierStateId - Supplier's state ID
   * @param customerStateId - Customer's state ID
   * @returns GST calculation breakdown
   */
  async calculateGST(
    amount: number,
    taxRate: number,
    supplierStateId: string,
    customerStateId: string
  ): Promise<GSTCalculation> {
    try {
      // Validate inputs
      if (amount < 0) {
        throw new ValidationError('Amount cannot be negative');
      }

      if (taxRate < 0 || taxRate > 100) {
        throw new ValidationError('Tax rate must be between 0 and 100');
      }

      if (!supplierStateId || !customerStateId) {
        throw new ValidationError('Supplier and customer state IDs are required');
      }

      // Check if same state (intra-state) or different (inter-state)
      const isInterstate = supplierStateId !== customerStateId;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;

      if (isInterstate) {
        // Inter-state: IGST only (full rate)
        igstRate = taxRate;
        igst = (amount * taxRate) / 100;
      } else {
        // Intra-state: CGST + SGST (split equally)
        cgstRate = taxRate / 2;
        sgstRate = taxRate / 2;
        cgst = (amount * cgstRate) / 100;
        sgst = (amount * sgstRate) / 100;
      }

      const totalTax = cgst + sgst + igst;

      const calculation: GSTCalculation = {
        cgst: parseFloat(cgst.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        igst: parseFloat(igst.toFixed(2)),
        cgstRate: parseFloat(cgstRate.toFixed(2)),
        sgstRate: parseFloat(sgstRate.toFixed(2)),
        igstRate: parseFloat(igstRate.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        isInterstate,
      };

      logDebug('GST Calculation:', {
        amount,
        taxRate,
        isInterstate,
        calculation,
      });

      return calculation;
    } catch (error) {
      logError('Error calculating GST:', error);
      throw error;
    }
  }

  /**
   * Get default GST rate for garment products
   *
   * Standard rates:
   * - HSN 61, 62, 63: 12% (most garments)
   * - HSN 64: 5% (footwear)
   *
   * @param hsnCode - Optional HSN/SAC code
   * @returns Default tax rate
   */
  getDefaultGSTRate(hsnCode?: string): number {
    // Default rate for garments (HSN 61, 62, 63)
    const DEFAULT_GARMENT_RATE = 12;

    if (!hsnCode) {
      return DEFAULT_GARMENT_RATE;
    }

    // Extract first 2 digits of HSN code
    const hsnPrefix = hsnCode.substring(0, 2);

    switch (hsnPrefix) {
      case '61': // Knitted or crocheted garments
      case '62': // Non-knitted or crocheted garments
      case '63': // Other made-up textile articles
        return 12;

      case '64': // Footwear
        return 5;

      case '50': // Silk
      case '51': // Wool
      case '52': // Cotton
      case '53': // Other vegetable textile fibres
      case '54': // Man-made filaments
      case '55': // Man-made staple fibres
      case '56': // Wadding, felt, nonwovens
      case '57': // Carpets
      case '58': // Special woven fabrics
      case '59': // Impregnated, coated, covered textiles
      case '60': // Knitted or crocheted fabrics
        return 5; // Raw materials generally at 5%

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
