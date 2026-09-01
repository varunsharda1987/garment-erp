/**
 * Lace Costing Types
 * Types for lace cost calculation with sourcing strategies
 */

export interface LaceStockOption {
  available: boolean;
  stockLotId: string | null;
  stockCost: number | null;
  quantityAvailable: number | null;
  warehouseLocation: string | null;
  dyeLotNumber: string | null;
  originStyleId: string | null;
  originStyleCode: string | null;
  totalCost: number | null;
  details: string;
  rateSource: 'STOCK_WAC' | null;
  lastUpdated: string | null;
}

export interface ReadyLaceOption {
  available: boolean;
  readyLaceCost: number | null;
  supplierId: string | null;
  supplierName: string | null;
  totalCost: number | null;
  details: string;
  rateSource: 'LACE_MASTER' | 'SUPPLIER_PRICE' | null;
  lastUpdated: string | null;
}

export interface GreigeLaceProcessingOption {
  available: boolean;
  greigeLaceId: string | null;
  greigeLaceName: string | null;
  greigeCost: number | null;
  processingCost: number | null;
  processorId: string | null;
  processorName: string | null;
  slabLabel: string | null;
  shrinkagePercent: number | null;
  greigeQuantityNeeded: number | null;
  totalCost: number | null;
  costBreakdown: {
    greigeCostPerMeter: number | null;
    processingCostPerMeter: number | null;
    shrinkageFactor: number | null;
    effectiveCostPerMeter: number | null;
  };
  details: string;
  labDipRequired: boolean;
  labDipId: string | null;
  labDipStatus: string | null;
  labDipApproved: boolean;
  greigeRateSource: 'GREIGE_LACE_MASTER' | 'PROCUREMENT' | null;
  processingRateSource: 'RATE_CARD' | null;
  lastUpdated: string | null;
}

export interface LaceComparisonTableRow {
  strategy: string;
  costPerMeter: number | null;
  totalCost: number | null;
  savings: number | null;
  available: boolean;
  notes: string | null;
}

export interface LaceCostCalculationResult {
  laceId: string;
  laceName: string;
  /** True when this master is greige (raw/undyed) — drives the "create dyed variant" flow. */
  isGreige: boolean;
  quantityPerGarment: number;
  wastagePercent: number;
  effectiveQuantity: number;
  totalQuantityNeeded: number;
  stockReuse: LaceStockOption;
  readyLace: ReadyLaceOption;
  greigeProcessing: GreigeLaceProcessingOption;
  recommendedStrategy: 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED' | 'NONE';
  recommendedCost: number | null;
  costPerMeter: number | null;
  costPerGarment: number | null;
  savings: number | null;
  comparisonTable: LaceComparisonTableRow[];
}

export interface LaceCostingRequest {
  laceId: string;
  laceName?: string;
  quantityPerGarment: number;
  orderQuantity?: number;
  wastagePercent?: number;
  styleId?: string;
  costSheetId?: string;
  /** Pins the dyeing processor instead of letting the server pick the cheapest rate. */
  processorId?: string;
}

export interface BatchLaceCostingRequest {
  laceItems: LaceCostingRequest[];
  orderQuantity?: number;
  styleId?: string;
  costSheetId?: string;
}

export interface BatchLaceCostingResult {
  results: LaceCostCalculationResult[];
  summary: {
    totalItems: number;
    successfulCalculations: number;
    failedCalculations: number;
    totalRecommendedCost: number;
    totalSavings: number;
  };
}

export type LaceSourcingStrategy = 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED';
