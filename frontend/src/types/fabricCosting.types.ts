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

// ============================================
// NEW TYPES FOR REDESIGNED FABRIC COSTING PAGE
// ============================================

// Cost input mode
export type CostInputMode = 'LANDED_PRICE' | 'BUILD_UP';

// Transport cost mode
export type TransportCostMode = 'PER_METER' | 'FIXED';

// Processor info for dropdown
export interface ProcessorInfo {
  id: string;
  name: string;
  code: string;
  rating?: number;
}

// Fabric data from style for costing
export interface FabricForCosting {
  id: string; // style_fabrics.id
  fabricId: string;
  fabricName: string;
  genericFabricName?: string | null;
  componentId: string;
  componentName: string;
  cadMeters: number | null;
  width: number | null;
  finishType: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;
  greigeId: string | null;
  greigeName: string | null;
  greigeCode: string | null;
  greigeDefaultCost: number | null;
  numberOfColors: number | null;
  // Ready fabric cost from fabric_master (for direct purchase without processing)
  readyFabricCost: number | null;
}

// Style fabrics response
export interface StyleFabricsResponse {
  styleId: string;
  styleCode: string;
  styleName: string;
  fabrics: FabricForCosting[];
}

// Rate lookup result (from backend)
export interface ProcessorRateLookup {
  id: string;
  processorId: string;
  processorName: string;
  processingType: 'DYEING' | 'PRINTING';
  printingType?: 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';
  greigeId: string;
  greigeName: string;
  slabId: string;
  slabLabel: string;
  minQuantity: number;
  maxQuantity: number;
  ratePerMeter: number;
  totalCost: number;
  shrinkagePercent: number | null;
  screenCostPerScreen: number | null;
}

// Fabric costing row for the table
export interface FabricCostingRow {
  id: string; // style_fabrics.id
  fabricId: string;
  fabricName: string;
  genericFabricName?: string | null;
  componentName: string;
  cadMeters: number;
  width: number;
  finishType: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;

  // Greige reference
  greigeId: string | null;
  greigeName: string | null;
  greigeCode: string | null;
  greigeDefaultCost: number | null;

  // Ready fabric cost from fabric_master (for direct purchase without processing)
  readyFabricCost: number | null;

  // Cost input mode
  costInputMode: CostInputMode;

  // Landed price mode
  landedPricePerMeter: number | null;

  // Build-up mode - Greige & Transport
  greigeCostPerMeter: number | null;
  greigeCostSource: 'GREIGE_MASTER' | 'MANUAL';
  transportCostMode: TransportCostMode;
  transportCostPerMeter: number | null;
  transportFixedAmount: number | null;

  // Shrinkage (from processor rate card)
  shrinkagePercent: number | null;
  shrinkageValue: number | null; // Calculated: greigeCost × shrinkage%

  // Processor selection
  processorId: string | null;
  processorName: string | null;
  processingType: 'DYEING' | 'PRINTING' | null;
  printingType?: 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE' | null;
  processingCostPerMeter: number | null;
  slabLabel: string | null;
  rateCardId: string | null;

  // Screen cost (PRINTING only)
  numberOfColors: number | null;
  screenCostPerScreen: number | null;
  screenCostTotal: number | null; // Calculated: screenCost × numberOfColors
  screenCostPerMeter: number | null; // Calculated: screenCostTotal / totalQuantity

  // Calculated totals
  totalCostPerMeter: number | null;
  totalCostForQuantity: number | null;

  // UI state
  isExpanded: boolean;
  isLoading: boolean;
  error: string | null;
}

// Page state
export interface FabricCostingPageState {
  // Selection
  selectedCustomerId: string | null;
  selectedStyleId: string | null;
  orderQuantity: number;

  // Data
  fabricRows: FabricCostingRow[];
  processors: ProcessorInfo[];

  // UI
  isLoadingStyle: boolean;
  isLoadingProcessors: boolean;
  isSaving: boolean;

  // Summary
  totalFabricCost: number;
}

// Save request
export interface SaveFabricCostingRequest {
  styleId: string;
  orderQuantity: number;
  fabricCostings: FabricCostingSaveItem[];
}

export interface FabricCostingSaveItem {
  styleFabricId: string;
  totalCostPerMeter: number | null;
  numberOfColors: number | null;
}
