/**
 * Fabric Costing Types
 * Types for fabric cost calculation with sourcing strategies
 */

// Color option from style's color_options (for processing batch grouping)
export interface StyleColorOption {
  id: string;
  styleId: string;
  colorName: string;
  colorCode: string | null;
  sortOrder: number;
  isActive: boolean;
  colorMasterId: string | null;
  colorMaster?: {
    id: string;
    colorName: string;
    hexCode: string | null;
    colorFamily: string | null;
  } | null;
}

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
  // Rate source info
  rateSource: 'STOCK_WAC' | null;
  lastUpdated: string | null;
}

export interface ReadyFabricOption {
  available: boolean;
  readyFabricCost: number | null;
  procurementId: string | null;
  supplierName: string | null;
  totalCost: number | null;
  details: string;
  leadTimeDays?: number | null;
  // Rate source info
  rateSource: 'PROCUREMENT' | 'FABRIC_MASTER' | null;
  procurementDate: string | null;
  lastUpdated: string | null;
}

export interface GreigeProcessingOption {
  available: boolean;
  greigeCost: number | null;
  processingCost: number | null;
  processorId: string | null;
  processorName: string | null;
  rateCardId: string | null;
  processingType: string | null;
  slabLabel: string | null;
  turnaroundDays?: number | null;
  totalCost: number | null;
  costBreakdown: {
    greigeCostPerMeter: number | null;
    processingCostPerMeter: number | null;
    totalPerMeter: number | null;
  };
  details: string;
  // Rate source info
  greigeRateSource: 'PROCUREMENT' | 'STOCK_WAC' | 'GREIGE_MASTER' | null;
  processingRateSource: 'RATE_CARD' | 'PROCESSOR_DEFAULT' | null;
  greigeProcurementDate: string | null;
  rateCardEffectiveDate: string | null;
  lastUpdated: string | null;
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
  isRecommended?: boolean;
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

// Workflow purpose mode (same as CAD Planning)
// COSTING = Style costing for quotations (formerly PLANNING)
// RAW_MATERIAL_CALCULATION = MRP for confirmed orders (formerly COSTING)
// PRODUCTION = Actual production fabric requirements
export type CostingPurpose = 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';

// Display labels for CAD purposes
export const CAD_PURPOSE_LABELS: Record<CostingPurpose, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Material Calculation',
  PRODUCTION: 'Production',
};

// Short labels for tabs/badges
export const CAD_PURPOSE_SHORT_LABELS: Record<CostingPurpose, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Mat',
  PRODUCTION: 'Production',
};

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
  id: string; // fabric_width_cad.id (or style_fabrics.id for legacy)
  styleFabricId?: string; // style_fabrics.id (for linking)
  fabricId: string;
  fabricName: string;
  genericGreigeName?: string | null;
  componentId: string;
  componentName: string;
  cadMeters: number | null; // Per-piece consumption (cadAverage)
  width: number | null; // Cutable width
  purpose?: CostingPurpose | null; // PLANNING, COSTING, PRODUCTION
  finishType: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;
  // Design/Color identification
  printDesign?: string | null;
  colorName?: string | null;
  greigeId: string | null;
  greigeName: string | null;
  greigeCode: string | null;
  greigeDefaultCost: number | null; // Default cost from greige_master
  greigeStockCost: number | null; // Cost from latest greige procurement
  greigeCostPerMeter: number | null; // Actual cost to use (stock → default)
  greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_STOCK' | 'GREIGE_MASTER'; // Source indicator
  greigeStockAvailable: number | null; // Greige stock quantity available
  numberOfColors: number | null;
  // Shrinkage from saved data or greige master fallback
  shrinkagePercent: number | null;
  // Existing costing data from fabric_width_cad
  processorId?: string | null;
  processorName?: string | null;
  processorCode?: string | null;
  processingPricePerMeter?: number | null;
  screenType?: string | null;
  totalCostPerMeter?: number | null;
  transportCostPerMeter?: number | null;
  greigeCostPerMeterSaved?: number | null;
  // Ready fabric cost - prioritizes stock cost if available
  readyFabricCost: number | null;
  // Source of the ready fabric cost
  readyFabricCostSource: 'STOCK' | 'FABRIC_MASTER';
  // TOTAL available finished-fabric stock across all AVAILABLE lots (meters, display-only)
  stockAvailable: number | null;
  // Stock at THIS row's width ±0.5" (meters) — same tolerance MRP uses when allocating
  stockAtWidth?: number | null;
  // Quantity-weighted WAC (₹/m) of the width-matched lots (suggestive only)
  stockWacAtWidth?: number | null;
  // Cost input mode (from saved costing data)
  costInputMode?: CostInputMode | null;
  // Processing batch group color ID (for combined rate slab lookup)
  processingBatchGroupColorId?: string | null;
  // Available width options with their costing data
  widthOptions: FabricWidthOption[];
  // Order quantity used for rate slab lookup (from saved costing)
  orderQuantityPcs?: number | null;
  // Creation timestamp for sorting by most recent
  createdAt?: string | null;
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
  styleFabricId: string | null; // style_fabrics.id - for unique key grouping (same-fabric diff properties)
  fabricId: string;
  fabricWidthCadId: string | null; // fabric_width_cad.id (if existing record)
  savedOrderQuantityPcs?: number | null; // Original saved quantity for clone detection (quantity change creates new option)
  rowQuantity?: number; // Per-row quantity (can override global orderQuantity)
  createdAt?: string | null; // Timestamp when this costing was created (for date-based grouping)
  fabricName: string;
  genericGreigeName?: string | null;
  componentName: string;
  cadMeters: number;
  width: number;
  finishType: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW' | null;
  // Design/Color identification
  printDesign?: string | null;
  colorName?: string | null;

  // Greige reference
  greigeId: string | null;
  greigeName: string | null;
  greigeCode: string | null;
  greigeDefaultCost: number | null;

  // Ready fabric cost from fabric_master (for direct purchase without processing)
  readyFabricCost: number | null;

  // Finished-fabric stock at this row's width ±0.5" (meters) — display-only, allocation happens at MRP
  stockAtWidth?: number | null;
  // Quantity-weighted WAC (₹/m) of the width-matched stock lots (suggestive only)
  stockWacAtWidth?: number | null;

  // Cost input mode
  costInputMode: CostInputMode;

  // Landed price mode
  landedPricePerMeter: number | null;

  // Build-up mode - Greige & Transport
  greigeCostPerMeter: number | null;
  greigeCostSource: 'GREIGE_MASTER' | 'GREIGE_PROCUREMENT' | 'GREIGE_STOCK' | 'MANUAL';
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

  // Processing Batch Group (for combined rate slab lookup)
  processingBatchGroupColorId: string | null;
  processingBatchGroupColorName: string | null;

  // Batch rate comparison (populated after batch lookup)
  batchRate: number | null; // Rate from combined batch quantity
  individualRate: number | null; // Rate this row would get alone
  batchSavings: number | null; // individualRate - batchRate
  batchGroupTotalQuantity: number | null; // Combined quantity of batch in meters

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
  cloneFromCadId?: string; // If set, clone this record instead of updating (for quantity-based variants)
  styleFabricId: string | null; // style_fabrics.id - for unique key (required for multi-fabric same-component)
  fabricId: string;
  cutableWidth?: number; // CAD-owned field - managed by CAD Planning module
  componentName?: string | null; // CAD-owned field - managed by CAD Planning module
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
  // Order quantity used for slab rate lookup
  orderQuantityPcs?: number;
  // CAD consumption per piece (for fabric quantity calculation)
  cadMeters?: number;
  // Workflow purpose mode
  purpose?: CostingPurpose;
  // Processing batch group
  processingBatchGroupColorId?: string | null;
}

// ============================================
// COSTING OPTIONS TYPES (for approval workflow)
// ============================================

// Individual costing option (from fabric_width_cad)
export interface CostingOption {
  id: string;
  styleFabricId: string | null; // For grouping same-fabric different-properties
  fabricId: string | null;
  greigeName: string | null;
  greigeCode: string | null;
  cutableWidth: number;
  // Component and pattern part info (from CAD Planning)
  componentName: string | null;
  patternPartId: string | null;
  patternPartCode: string | null;
  patternPartName: string | null;
  // Design/Color identification (returned by GET /fabric-costing/style/:styleId/options)
  printDesign?: string | null;
  colorName?: string | null;
  processorId: string | null;
  processorName: string | null;
  processorCode: string | null;
  greigeCostPerMeter: number | null;
  transportCostPerMeter: number | null;
  processingPricePerMeter: number | null;
  shrinkagePercent: number | null;
  shrinkageCostPerMeter: number | null;
  screenCostPerMeter: number | null;
  screenType: ScreenType | null;
  numberOfColors: number | null;
  totalCostPerMeter: number | null;
  costInputMode: string | null;
  isPreferred: boolean;
  approvalStatus: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  isLowestCost: boolean;
  orderQuantityPcs: number | null;
  cadMeters: number | null; // Layer length (total fabric for marker)
  cadAverage: number | null; // Per-piece consumption (cadMeters / piecesPerMarker)
  purpose: CostingPurpose | null; // Workflow mode
  isLocked: boolean; // Locked for PRODUCTION records
  createdAt: string;
  updatedAt: string;
}

// Style info in grouped response
export interface CostingStyleInfo {
  id: string;
  styleCode: string;
  styleName: string;
  customerName: string | null;
  customerId: string | null;
}

// Grouped costing options by style
export interface GroupedCostingByStyle {
  style: CostingStyleInfo;
  components: Record<string, CostingOption[]>;
}

// Purpose counts for tabs
export interface PurposeCounts {
  all: number;
  costing: number; // For style costing/quotations (formerly planning)
  rawMaterialCalculation: number; // For order MRP (formerly costing)
  production: number;
}

// Response from GET /api/fabric-costing/options
export interface CostingOptionsResponse {
  success: boolean;
  data: Record<string, GroupedCostingByStyle>;
  pagination: {
    page: number;
    limit: number;
    totalStyles: number;
    totalPages: number;
    totalOptions: number;
  };
  purposeCounts: PurposeCounts;
}

// Response from GET /api/fabric-costing/style/:styleId/options
export interface StyleCostingOptionsResponse {
  success: boolean;
  data: Record<string, CostingOption[]>;
  summary: {
    totalOptions: number;
    approvedCount: number;
    componentCount: number;
    allComponentsApproved: boolean;
  };
}

// Filters for options page
export interface CostingOptionsFilters {
  customerId?: string;
  styleId?: string;
  processorId?: string;
  status?: 'ALL' | 'APPROVED' | 'PENDING';
  purpose?: 'ALL' | CostingPurpose;
  page: number;
  limit: number;
}
