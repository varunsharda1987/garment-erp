/**
 * Fabric Costing Types
 * Types for fabric cost calculation with sourcing strategies
 */

export interface StockOption {
  available: boolean;
  stockLotId: string | null;
  stockCost: number | null;
  quantityAvailable: number | null;
  warehouseLocation: string | null;
  originStyleId: string | null;
  originStyleName: string | null;
  totalCost: number | null;
  details: string;
}

export interface ReadyFabricOption {
  available: boolean;
  readyFabricCost: number | null;
  procurementId: string | null;
  supplierName: string | null;
  totalCost: number | null;
  details: string;
}

export interface GreigeProcessingOption {
  available: boolean;
  greigeCost: number | null;
  processingCost: number | null;
  processorId: string | null;
  processorName: string | null;
  rateCardId: string | null;
  processingType: string | null;
  turnaroundDays: number | null;
  totalCost: number | null;
  costBreakdown: {
    greigeCostPerMeter: number | null;
    processingCostPerMeter: number | null;
    totalPerMeter: number | null;
  };
  details: string;
}

export interface FabricCostCalculationResult {
  fabricId: string;
  fabricName: string;
  cadMeters: number;
  width: number;
  stockReuse: StockOption;
  readyFabric: ReadyFabricOption;
  greigeProcessing: GreigeProcessingOption;
  recommendedStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED' | 'NONE';
  recommendedCost: number | null;
  savings: number | null;
  comparisonTable: ComparisonTableRow[];
}

export interface ComparisonTableRow {
  strategy: string;
  costPerMeter: number | null;
  totalCost: number | null;
  savings: number | null;
  available: boolean;
}

export interface FabricCostingRequest {
  fabricId: string;
  cadMeters: number;
  width: number;
  orderQuantity?: number;
  styleId?: string;
}

export interface BatchFabricCostingRequest {
  fabrics: FabricCostingRequest[];
  orderQuantity?: number;
  styleId?: string;
}

export interface BatchFabricCostingResult {
  fabrics: (FabricCostCalculationResult | { fabricId: string; error: string; success: false })[];
  summary: {
    totalFabrics: number;
    successfulCalculations: number;
    failedCalculations: number;
    totalRecommendedCost: number;
    totalSavings: number;
  };
}

export type SourcingStrategy = 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
