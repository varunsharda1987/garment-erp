// Greige Stock Summary Types

export interface GreigeStockSummary {
  totalMeters: number;
  totalValue: number;
  agingStockCount: number;
  totalItems: number;
}

// BUG-GR11 fix: Added proper type for adjustStock return value
export interface GreigeStockAdjustmentResult {
  stockId: string;
  adjustmentType: 'INCREASE' | 'DECREASE';
  quantity: number;
  reason: string;
  remarks?: string;
  previousQuantity: number;
  newQuantity: number;
}
