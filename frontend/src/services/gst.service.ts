import api from '@/lib/api';
import type {
  GSTValidationRequest,
  GSTValidationResponse,
  GSTCalculationRequest,
  GSTCalculation,
  BulkGSTCalculationRequest,
  BulkGSTTotals,
  GSTRateInfo,
  HSNCode,
} from '../types/gst.types';

const BASE_URL = '/gst';

class GSTService {
  /**
   * Validate a GST number format and state code matching
   */
  async validateGSTNumber(request: GSTValidationRequest): Promise<GSTValidationResponse> {
    const { data } = await api.post(`${BASE_URL}/validate`, request);
    return data;
  }

  /**
   * Calculate GST breakdown for an amount
   */
  async calculateGST(request: GSTCalculationRequest): Promise<GSTCalculation> {
    const { data } = await api.post(`${BASE_URL}/calculate`, request);
    return data;
  }

  /**
   * Calculate GST for multiple items (bulk calculation)
   */
  async calculateBulkGST(request: BulkGSTCalculationRequest): Promise<BulkGSTTotals> {
    const { data } = await api.post(`${BASE_URL}/calculate-bulk`, request);
    return data;
  }

  /**
   * Get common GST rates
   */
  async getGSTRates(): Promise<GSTRateInfo[]> {
    const { data } = await api.get(`${BASE_URL}/rates`);
    return data;
  }

  /**
   * Get HSN codes for garments
   */
  async getHSNCodes(): Promise<HSNCode[]> {
    const { data } = await api.get(`${BASE_URL}/hsn-codes`);
    return data;
  }

  /**
   * Quick validation helper - just checks format
   */
  isValidGSTFormat(gstNumber: string): boolean {
    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
    return gstRegex.test(gstNumber.toUpperCase());
  }

  /**
   * Extract state code from GST number
   */
  extractStateCode(gstNumber: string): string | null {
    if (gstNumber.length >= 2) {
      return gstNumber.substring(0, 2);
    }
    return null;
  }

  /**
   * Format GST number to uppercase
   */
  formatGSTNumber(gstNumber: string): string {
    return gstNumber.toUpperCase().trim();
  }

  /**
   * Calculate total tax amount from GST calculation
   */
  getTotalTax(calculation: GSTCalculation): number {
    return calculation.totalTax;
  }

  /**
   * Calculate grand total (amount + tax)
   */
  getGrandTotal(amount: number, calculation: GSTCalculation): number {
    return amount + calculation.totalTax;
  }

  /**
   * Helper to determine if transaction is interstate
   */
  isInterstate(calculation: GSTCalculation): boolean {
    return calculation.isInterstate;
  }

  /**
   * Get tax breakdown string for display
   */
  getTaxBreakdownText(calculation: GSTCalculation): string {
    if (calculation.isInterstate) {
      return `IGST ${calculation.igstRate}%: ₹${calculation.igst.toFixed(2)}`;
    }
    return `CGST ${calculation.cgstRate}%: ₹${calculation.cgst.toFixed(2)} + SGST ${calculation.sgstRate}%: ₹${calculation.sgst.toFixed(2)}`;
  }
}

export const gstService = new GSTService();
