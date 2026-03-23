/**
 * GST Types
 * Shared types for GST calculation across all PO and invoice services
 */

export interface LineItemGSTResult {
  hsnCode: string | null;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxAmount: number;
}

export interface POGSTTotals {
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
}

export interface InterstatePOResult {
  isInterstate: boolean;
  supplierStateCode: string | null;
}

export interface CalculateLineItemGSTParams {
  lineTotal: number;
  hsnSacCode?: string | null;
  materialId?: string | null;
  gstRateOverride?: number | null;
  isInterstate: boolean;
  /** Per-piece unit price — required for apparel (HSN 61/62) to apply price-based GST slab:
   *  ≤₹2,500/piece → 5% GST, >₹2,500/piece → 18% GST */
  unitPrice?: number | null;
}

export interface SACCodeResult {
  sacCode: string;
  gstRate: number;
}
