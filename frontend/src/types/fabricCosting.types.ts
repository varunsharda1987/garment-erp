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

// Screen/Machine type for printing
export type ScreenType = 'ROTARY' | 'FLATBELT' | 'TABLE';

// Display labels for screen types
export const SCREEN_TYPE_LABELS: Record<ScreenType, string> = {
  ROTARY: 'Rotary',
  FLATBELT: 'Flat Belt',
  TABLE: 'Table',
};

// Default screen costs per screen (in ₹)
export const DEFAULT_SCREEN_COSTS: Record<ScreenType, number> = {
  ROTARY: 3000,
  FLATBELT: 1100,
  TABLE: 1000,
};

// Processor info for dropdown
export interface ProcessorInfo {
  id: string;
  name: string;
  code: string;
  rating?: number;
}

// Width option from fabric_width_cad (includes saved costing data)
export interface FabricWidthOption {
  id: string; // fabric_width_cad.id
  cutableWidth: number;
  componentName: string | null;
  cadMeters: number | null;
  // Costing data (saved in fabric_width_cad)
  greigeId: string | null;
  greigeName: string | null;
  greigeCode: string | null;
  greigeCostPerMeter: number | null;
  transportCostPerMeter: number | null;
  processingPricePerMeter: number | null;
  shrinkagePercent: number | null;
  shrinkageCostPerMeter: number | null;
  screenCostPerMeter: number | null;
  screenType: ScreenType | null;
  totalCostPerMeter: number | null;
  processorId: string | null;
  processorName: string | null;
  processorCode: string | null;
  numberOfColors: number | null;
  costInputMode: string | null;
  costingStyleId: string | null;
  isPreferred: boolean;
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
  greigeDefaultCost: number | null; // Default cost from greige_master
  greigeStockCost: number | null; // Cost from latest greige procurement
  greigeCostPerMeter: number | null; // Actual cost to use (stock → default)
  greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_MASTER'; // Source indicator
  greigeStockAvailable: number | null; // Greige stock quantity available
  numberOfColors: number | null;
  // Ready fabric cost - prioritizes stock cost if available
  readyFabricCost: number | null;
  // Source of the ready fabric cost
  readyFabricCostSource: 'STOCK' | 'FABRIC_MASTER';
  // Stock availability in meters
  stockAvailable: number | null;
  // Available width options with their costing data
  widthOptions: FabricWidthOption[];
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
  fabricWidthCadId: string | null; // fabric_width_cad.id (if existing record)
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
  screenType: ScreenType | null; // ROTARY, FLATBELT, or TABLE
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

// Save request - saves to fabric_width_cad
export interface SaveFabricCostingRequest {
  styleId: string;
  fabricCostings: FabricCostingSaveItem[];
}

// Save item - full costing breakdown for fabric_width_cad
export interface FabricCostingSaveItem {
  fabricWidthCadId: string | null; // If updating existing record
  fabricId: string;
  cutableWidth: number;
  componentName: string | null;
  // Greige and Transport
  greigeId: string | null;
  greigeCostPerMeter: number | null;
  transportCostPerMeter: number | null;
  // Processing
  processorId: string | null;
  processingCostPerMeter: number | null;
  // Shrinkage
  shrinkagePercent: number | null;
  shrinkageCostPerMeter: number | null;
  // Screen cost (for printing)
  screenCostPerMeter: number | null;
  screenType: ScreenType | null;
  numberOfColors: number | null;
  // Total
  totalCostPerMeter: number | null;
  // Mode
  costInputMode: 'LANDED_PRICE' | 'BUILD_UP';
}
