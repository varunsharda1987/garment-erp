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

const API_BASE = '/api/gst';

class GSTService {
  /**
   * Validate a GST number format and state code matching
   */
  async validateGSTNumber(request: GSTValidationRequest): Promise<GSTValidationResponse> {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to validate GST number');
    }

    return response.json();
  }

  /**
   * Calculate GST breakdown for an amount
   */
  async calculateGST(request: GSTCalculationRequest): Promise<GSTCalculation> {
    const response = await fetch(`${API_BASE}/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate GST');
    }

    return response.json();
  }

  /**
   * Calculate GST for multiple items (bulk calculation)
   */
  async calculateBulkGST(request: BulkGSTCalculationRequest): Promise<BulkGSTTotals> {
    const response = await fetch(`${API_BASE}/calculate-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate bulk GST');
    }

    return response.json();
  }

  /**
   * Get common GST rates
   */
  async getGSTRates(): Promise<GSTRateInfo[]> {
    const response = await fetch(`${API_BASE}/rates`);

    if (!response.ok) {
      throw new Error('Failed to fetch GST rates');
    }

    return response.json();
  }

  /**
   * Get HSN codes for garments
   */
  async getHSNCodes(): Promise<HSNCode[]> {
    const response = await fetch(`${API_BASE}/hsn-codes`);

    if (!response.ok) {
      throw new Error('Failed to fetch HSN codes');
    }

    return response.json();
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
