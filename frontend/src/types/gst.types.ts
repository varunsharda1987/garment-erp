/**
 * GST Types
 * Type definitions for GST validation and tax calculation
 */

export interface GSTCalculation {
  cgst: number; // Central GST amount
  sgst: number; // State GST amount
  igst: number; // Integrated GST amount
  cgstRate: number; // CGST percentage
  sgstRate: number; // SGST percentage
  igstRate: number; // IGST percentage
  totalTax: number; // Total tax amount
  isInterstate: boolean; // Whether this is inter-state transaction
}

export interface GSTValidationRequest {
  gstNumber: string; // 15-character GST number
  stateCode: string; // 2-digit state code
}

export interface GSTValidationResponse {
  success: boolean;
  data: {
    isValid: boolean;
    gstNumber: string;
    stateCode: string;
    message: string;
  };
}

export interface GSTCalculationRequest {
  amount: number; // Taxable amount
  taxRate: number; // Tax rate (e.g., 12, 18, 28)
  supplierStateId: string; // Seller's state ID
  customerStateId: string; // Buyer's state ID
}

export interface GSTCalculationResponse {
  success: boolean;
  data: GSTCalculation;
}

export interface GSTRateInfo {
  rate: number;
  description: string;
  examples: string[];
}

export interface HSNCode {
  code: string;
  description: string;
  rate: number;
  examples: string[];
}

export interface GSTRatesResponse {
  success: boolean;
  data: GSTRateInfo[];
}

export interface HSNCodesResponse {
  success: boolean;
  data: HSNCode[];
}

// Bulk Calculation Types
export interface BulkGSTItem {
  amount: number;
  taxRate: number;
}

export interface BulkGSTCalculationRequest {
  items: BulkGSTItem[];
  supplierStateId: string;
  customerStateId: string;
}

export interface BulkGSTCalculationResult extends GSTCalculation {
  amount: number;
  taxRate: number;
}

export interface BulkGSTTotals {
  totalAmount: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  grandTotal: number;
  isInterstate: boolean;
}

export interface BulkGSTCalculationResponse {
  success: boolean;
  data: {
    items: BulkGSTCalculationResult[];
    totals: BulkGSTTotals;
  };
}

// Default GST Rate Types
export interface DefaultGSTRateRequest {
  hsnCode?: string; // Optional HSN/SAC code
}

export interface DefaultGSTRateResponse {
  success: boolean;
  data: {
    hsnCode: string;
    rate: number;
    message: string;
  };
}

// Extract State Code Types
export interface ExtractStateCodeResponse {
  success: boolean;
  data: {
    gstNumber: string;
    stateCode: string;
  };
}
