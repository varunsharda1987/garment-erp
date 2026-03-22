/**
 * CAD Planning Module Types
 *
 * All types, enums, and constants specific to the CAD Planning module.
 * This is the canonical source — style.types.ts re-exports these for backward compatibility.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const CADStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
} as const;

export type CADStatus = (typeof CADStatus)[keyof typeof CADStatus];

// Print Direction enum for CAD planning
export const PrintDirection = {
  ONE_WAY: 'ONE_WAY',
  TWO_WAY: 'TWO_WAY',
} as const;

export type PrintDirection = (typeof PrintDirection)[keyof typeof PrintDirection];

export const PRINT_DIRECTION_LABELS: Record<PrintDirection, string> = {
  [PrintDirection.ONE_WAY]: 'One-Way',
  [PrintDirection.TWO_WAY]: 'Two-Way',
};

/**
 * Purpose of CAD entry
 * COSTING = Style costing for quotations (formerly PLANNING)
 * RAW_MATERIAL_CALCULATION = MRP for confirmed orders (formerly COSTING)
 * PRODUCTION = Actual production fabric requirements
 */
export const CADPurpose = {
  PRODUCTION: 'PRODUCTION',
  RAW_MATERIAL_CALCULATION: 'RAW_MATERIAL_CALCULATION',
  COSTING: 'COSTING',
} as const;

export type CADPurpose = (typeof CADPurpose)[keyof typeof CADPurpose];

export const CAD_PURPOSE_LABELS: Record<CADPurpose, string> = {
  [CADPurpose.PRODUCTION]: 'Production',
  [CADPurpose.RAW_MATERIAL_CALCULATION]: 'Raw Material Calculation',
  [CADPurpose.COSTING]: 'Costing',
};

// Short labels for compact UI display (tabs, badges)
export const CAD_PURPOSE_SHORT_LABELS: Record<CADPurpose, string> = {
  [CADPurpose.PRODUCTION]: 'Production',
  [CADPurpose.RAW_MATERIAL_CALCULATION]: 'Raw Mat',
  [CADPurpose.COSTING]: 'Costing',
};

/**
 * CAD Approval Status
 */
export const CADApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type CADApprovalStatus = (typeof CADApprovalStatus)[keyof typeof CADApprovalStatus];

/**
 * CAD Approval Status Labels
 */
export const CAD_APPROVAL_STATUS_LABELS: Record<CADApprovalStatus, string> = {
  [CADApprovalStatus.PENDING]: 'Pending',
  [CADApprovalStatus.APPROVED]: 'Approved',
  [CADApprovalStatus.REJECTED]: 'Rejected',
};

/**
 * Code for the "All Parts" pattern part in the database.
 * This is a real pattern_part_master record that represents all parts combined.
 */
export const ALL_PARTS_CODE = 'ALL_PARTS';

/**
 * Display label for "All Parts" option
 */
export const ALL_PARTS_LABEL = 'All Parts';

/**
 * @deprecated Use ALL_PARTS_CODE instead. Kept for backward compatibility.
 */
export const ALL_PARTS_ID = '__ALL_PARTS__';

// ============================================================================
// CAD PLANNING RESPONSE TYPES
// ============================================================================

export interface CADPlanningGreigeOption {
  id: string;
  greigeCode: string;
  greigeName: string;
  greigeWidth: number;
  defaultCutableWidth: number | null;
  expectedFinishedWidthMin: number | null;
  expectedFinishedWidthMax: number | null;
  greigePricePerMeter: number | null;
  composition?: string;
  weaveType?: string;
  cutableWidths?: number[];
}

export interface CADPlanningOption {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadYards: number | null;
  layerMarginMeters: number | null;
  cadWastagePercent: number;
  processingPricePerMeter: number | null;
  markerEfficiency: number | null;
  piecesPerMarker: number | null;
  markerLengthMeters: number | null;
  isSelected: boolean;
  isPreferred?: boolean;
  printDirection?: PrintDirection | null;
  componentName?: string | null;
  notes?: string | null;
  sizeBreakdowns?: Array<{ sizeName: string; sizeId?: string | null; quantity: number }>;
}

export interface CADPlanningFabric {
  id: string;
  componentId: string;
  componentName: string;
  fabricName: string;
  genericGreigeName: string;
  fabricFinishType: string;
  currentCADId: string | null;
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  cutableWidth?: number | null;
  allowCombinedCutting?: boolean;
}

export interface CADPlanningEmbroidery {
  id: string;
  embroideryCode: string;
  designName: string;
  costPerMeter: number | null;
}

export interface CADPlanningReadyPurchaseFabric {
  id: string;
  fabricCode: string;
  fabricName: string;
  actualWidth: number | null;
  cutableWidth: number | null;
  costPerMeter: number | null;
  composition?: string;
  yarnCount?: string;
}

export interface CADFabricGroup {
  groupKey: string;
  genericGreigeName: string;
  fabricFinishType: string;
  cutableWidth?: number | null;
  hasEmbroidery?: boolean;
  embroidery?: CADPlanningEmbroidery | null;
  fabrics: CADPlanningFabric[];
  components: string[];
  isReadyPurchaseFabric?: boolean;
  readyPurchaseFabric?: CADPlanningReadyPurchaseFabric | null;
  availableGreiges?: CADPlanningGreigeOption[];
  selectedGreigeId?: string;
  selectedGreige?: CADPlanningGreigeOption;
  averagingMode?: 'COMBINED' | 'SEPARATE';
  cadOptions?: CADPlanningOption[];
  selectedCADId?: string;
  // Note: Backend returns 'sizeOptions' but serializer maps it to 'sizes'
  sizes?: Array<{ sizeId: string | null; sizeName: string; sortOrder: number }>;
}

export interface CADPlanningStyle {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate?: string;
}

export interface CADPlanningResponse {
  style: CADPlanningStyle;
  fabricGroups: CADFabricGroup[];
  missingGreigeNames?: string[];
}

export interface CADGroupingResponse {
  message: string;
  updated: number;
}

export interface CADApprovalResponse {
  message: string;
  updated: number;
}

// ============================================================================
// CAD SPREADSHEET TABLE TYPES
// ============================================================================

/**
 * Size breakdown for CAD calculation
 */
export interface CADSizeBreakdown {
  sizeName: string;
  sizeId: string | null;
  quantity: number;
}

/**
 * CAD spreadsheet row - represents one CAD entry in the table
 */
export interface CADSpreadsheetRow {
  id: string;
  purpose: CADPurpose | null;
  componentId: string;
  componentName: string;
  styleFabricId: string;
  partId: string | null;
  partCode: string | null;
  partName: string | null;
  fabricFinishType: string | null;
  isEmbroidery: boolean;
  genericGreigeName: string | null;
  // Ready-fabric fields: set when style_fabrics.fabricId is populated (Ready Fabric mode)
  readyFabricId?: string | null;
  readyFabricName?: string | null;
  readyFabricCode?: string | null;
  greigeId: string | null;
  greigeName: string | null;
  cutableWidth: number | null;
  availableWidths: number[];
  stockWidths?: number[]; // Available widths from stock
  hasStockMatch?: boolean; // Does stock exist for this fabric?
  printDirection: PrintDirection;
  sizeBreakdowns: CADSizeBreakdown[];
  piecesPerMarker: number | null;
  layerMarginMeters: number | null;
  layerLengthMeters: number | null;
  cadAverage: number | null;
  // Combined cutting fields
  isCombinedCutting?: boolean;
  combinedFabricIds?: string[] | null;
  combinedComponents?: string | null;
  // Order usage tracking
  orderCount?: number;
  stockLotNumber?: string | null;
  // Approval status
  approvalStatus?: string | null;
  isLocked?: boolean;
  fabricStockId?: string | null;
  // Copy lineage tracking
  copiedFromId?: string | null;
  copiedFrom?: {
    id: string;
    purpose: CADPurpose;
    approvalStatus: string;
  } | null;
}

/**
 * Pattern part option for dropdown
 */
export interface CADPatternPartOption {
  id: string;
  name: string;
  code: string;
  goesToEmbroidery: boolean;
}

/**
 * Style fabric option for add row functionality
 */
export interface CADStyleFabricOption {
  id: string;
  fabricFinishType: string | null;
  genericGreigeName: string | null;
  hasEmbroidery?: boolean;
  embroideryCode?: string | null;
  fabricCode?: string | null;
}

export interface CADComponentOption {
  id: string;
  name: string;
  type: string;
  // Component master pattern parts (backend key: 'masterPatternParts', not renamed by serializer)
  masterPatternParts: CADPatternPartOption[];
  // Style-assigned pattern parts (backend key: 'stylePatternParts', serializer renames to 'patternParts')
  patternParts: CADPatternPartOption[];
  // Backend key: 'styleFabrics', serializer renames to 'fabrics'
  fabrics: CADStyleFabricOption[];
}

/**
 * Greige option for dropdown
 */
export interface CADGreigeOption {
  id: string;
  greigeName: string;
  genericGreigeName: string;
  greigeWidth: number | null;
  expectedFinishedWidthMin: number | null;
  expectedFinishedWidthMax: number | null;
  supplierName?: string;
}

/**
 * Size option for size breakdown popup
 */
export interface CADSizeOption {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * Style summary for CAD table header
 */
export interface CADStyleSummary {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: CADStatus;
  approvedCadDate?: string | null;
}

/**
 * Stock summary item for banner display in CAD Planning page
 */
export interface FabricStockSummaryItem {
  id: string;
  fabricId: string;
  fabricName: string;
  fabricCode: string;
  greigeId: string;
  greigeName: string;
  cutableWidth: number;
  finishedWidth: number;
  quantityAvailable: number;
  qualityGrade: string;
  // PRODUCTION CAD tracking
  hasProductionCad?: boolean;
  productionCadId?: string | null;
  productionCadStatus?: string | null; // 'PENDING' | 'APPROVED' | 'REJECTED'
  stockLotNumber?: string | null;
}

/**
 * Full CAD table data response
 * Note: Backend serializer transforms sizeOptions → sizes
 */
export interface CADTableData {
  style: CADStyleSummary;
  components: CADComponentOption[];
  availableGreiges: CADGreigeOption[];
  sizeOptions?: CADSizeOption[]; // Backend may send as 'sizes' due to serializer
  sizes?: CADSizeOption[]; // Serialized name from backend
  cadRows: CADSpreadsheetRow[];
  stockSummary?: FabricStockSummaryItem[];
}

/**
 * Response for CAD table data endpoint
 */
export interface CADTableDataResponse {
  success: boolean;
  data: CADTableData;
  message?: string;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request body for adding a new CAD row
 */
export interface AddCADRowRequest {
  purpose?: CADPurpose;
  componentId: string;
  styleFabricId: string;
  partId?: string;
  isEmbroidery?: boolean;
  /** Required for PRODUCTION purpose - links CAD row to actual stock */
  fabricStockId?: string;
}

/**
 * Request body for updating a CAD row
 */
export interface UpdateCADRowRequest {
  purpose?: CADPurpose;
  partId?: string;
  isEmbroidery?: boolean;
  greigeId?: string;
  cutableWidth?: number;
  printDirection?: PrintDirection;
  sizeBreakdowns?: CADSizeBreakdown[];
  cadMeters?: number;
  piecesPerMarker?: number;
  layerLengthMeters?: number;
}

/**
 * Response for greige widths endpoint
 */
export interface GreigeWidthsResponse {
  success: boolean;
  data: {
    greigeId: string;
    greigeName: string;
    greigeWidth: number | null;
    minFinishedWidth: number;
    maxFinishedWidth: number;
    availableWidths: number[];
  };
}

/**
 * Copy CAD Response - for "Copy as Draft" workflow
 */
export interface CopyCADResponse {
  success: boolean;
  message: string;
  data: {
    newRecordId: string;
    copiedFromId: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus;
  };
}

/**
 * CAD Copy Lineage Data - for tracking copy history
 */
export interface CADCopyLineageItem {
  id: string;
  purpose: CADPurpose;
  approvalStatus: CADApprovalStatus;
  componentName?: string;
  cutableWidth: number;
}

export interface CADCopyLineage {
  source?: CADCopyLineageItem;
  current: CADCopyLineageItem;
  children: CADCopyLineageItem[];
}

/**
 * Get Lineage Response
 */
export interface GetCADLineageResponse {
  success: boolean;
  data: CADCopyLineage;
}

/**
 * Extended CAD spreadsheet row with approval and purpose fields
 */
export interface CADSpreadsheetRowExtended extends CADSpreadsheetRow {
  // Approval workflow
  approvalStatus?: CADApprovalStatus | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;

  // Locking (PRODUCTION)
  isLocked: boolean;
  lockedReason?: string | null;
  lockedAt?: string | null;

  // Version Control (COSTING)
  version: number;
  supersededById?: string | null;
  supersededByVersion?: number | null;

  // Stock Integration (PRODUCTION)
  fabricStockId?: string | null;
  fabricStockDetails?: {
    finishedWidth: number;
    cutableWidth: number;
    rollNumbers?: string | null;
    qualityGrade: string;
  } | null;
  procurementId?: string | null;

  // Variance Tracking (PRODUCTION vs RAW_MATERIAL_CALCULATION)
  sourceCadWidth?: number | null; // Width from source RAW_MATERIAL_CALCULATION CAD
  planningCadWidth?: number | null; // @deprecated - use sourceCadWidth
  widthVariance?: number | null;
  variancePercent?: number | null;

  // Costing Integration (RAW_MATERIAL_CALCULATION)
  styleCostingId?: string | null;
  autoApprovedFrom?: string | null;

  // Order Usage Tracking (PRODUCTION)
  orderCount?: number;
  stockLotNumber?: string | null;
}

/**
 * Approve CAD Request
 */
export interface ApproveCADRequest {
  approvalNotes?: string;
}

/**
 * Reject CAD Request
 */
export interface RejectCADRequest {
  rejectionNotes: string;
}

/**
 * Create Costing Version Request (for COSTING CAD versioning)
 */
export interface CreateCostingVersionRequest {
  versionReason?: string;
}

/** @deprecated Use CreateCostingVersionRequest */
export type CreatePlanningVersionRequest = CreateCostingVersionRequest;

/**
 * Copy CAD Purpose Request
 */
export interface CopyCADPurposeRequest {
  sourceCadId: string;
  targetPurpose: CADPurpose;
  styleFabricId: string;
  componentId?: string;
  patternPartId?: string;
}

/**
 * Link CAD to Stock Request
 */
export interface LinkCADToStockRequest {
  cadId: string;
  fabricStockId: string;
  procurementId?: string;
  planningCadWidth?: number;
}

/**
 * Fabric Stock Option for PRODUCTION CAD selection
 */
export interface FabricStockOption {
  id: string;
  fabricId: string;
  fabricName: string;
  finishedWidth: number;
  cutableWidth: number;
  quantityAvailable: number;
  rollNumbers?: string | null;
  qualityGrade: string;
  receivedDate: string;
  procurementId?: string | null;
}

// ============================================================================
// MULTI-ORDER CAD WORKFLOW TYPES
// ============================================================================

/**
 * Create PRODUCTION CAD from stock request
 */
export interface CreateProductionCADFromStockRequest {
  fabricStockId: string;
  styleFabricId?: string;
  basedOnRawMatCadId?: string; // Source RAW_MATERIAL_CALCULATION CAD for variance tracking
  basedOnPlanningCadId?: string; // @deprecated - use basedOnRawMatCadId
  componentId?: string;
  greigeId?: string;
  patternPartId?: string;
}

/**
 * CAD Order History Item - tracks which order used which CAD
 */
export interface CADOrderHistoryItem {
  source: 'order_selection' | 'allocation';
  orderId: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  cadId: string | null;
  cutableWidth: number | null;
  cadMeters: number | null;
  stockLot: string | null;
  qualityGrade: string | null;
  planningCadWidth: number | null;
  widthVariance: number | null;
  variancePercent: number | null;
  quantityCut?: number;
  quantityAllocated?: number;
  quantityConsumed?: number;
  allocationStatus?: string;
}

/**
 * CAD Summary Item for Order History
 */
export interface CADSummaryItem {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  approvalStatus: string | null;
  isLocked: boolean;
  fabricName: string;
  componentName: string | null;
  stockLot: string | null;
  stockAvailable: number | null;
  orderCount: number;
  createdAt: string;
}

/**
 * CAD Order History Response
 */
export interface CADOrderHistoryResponse {
  styleId: string;
  history: CADOrderHistoryItem[];
  cadSummary: CADSummaryItem[];
  totalOrders: number;
  totalCADs: number;
}

// ============================================================================
// FROM cad-types.ts (merged)
// ============================================================================

export interface CadAverageFormData {
  fabricWidth: number;
  cadAverageMeters?: number;
  cadAverageYards?: number;
  cadWastagePercent?: number;
  markerEfficiency?: number;
  markerPlanFile?: string;
  isPreferred?: boolean;
  notes?: string;
}

// Common fabric widths (in inches)
export const COMMON_FABRIC_WIDTHS = [
  36, // 36 inches
  44, // 44 inches
  54, // 54 inches
  58, // 58 inches
  60, // 60 inches
  72, // 72 inches
  108, // 108 inches (extra wide)
];
