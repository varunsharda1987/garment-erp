// Style CAD Planning Types
// For CAD approval workflow and fabric width selection

export enum CADStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
}

// CAD Purposes - COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION
// Renamed from: PLANNING → COSTING, COSTING → RAW_MATERIAL_CALCULATION, PRODUCTION (unchanged)
export enum CADPurpose {
  COSTING = 'COSTING', // For initial costing estimates (was PLANNING)
  RAW_MATERIAL_CALCULATION = 'RAW_MATERIAL_CALCULATION', // For actual material planning once order is confirmed (was COSTING)
  PRODUCTION = 'PRODUCTION', // When fabric is inwarded; actual width determines usage
}

// Approval Status for CAD records
export enum CADApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Auto-approval source
export enum CADAutoApprovalSource {
  MANUAL = 'MANUAL',
  COSTING_SHEET = 'COSTING_SHEET',
  DATA_MIGRATION = 'DATA_MIGRATION',
}

export enum ProductionMethod {
  DYED_ONLY = 'DYED_ONLY',
  PRINTED_ONLY = 'PRINTED_ONLY',
  MIXED = 'MIXED',
  // Component-level options
  DYED = 'DYED',
  PRINTED = 'PRINTED',
}

export interface CADOption {
  cadId: string;
  fabricId: string;
  fabricName: string;
  greigeId: string;
  greigeName: string;
  availableWidth: number; // inches
  widthUnit: string;
  cadMeters: number;
  cadYards?: number;
  cadWastagePercent: number;
  markerEfficiency?: number;
  isPreferred: boolean;
  supplierAvailability?: string;
  priceDifferential?: number;
  // Cost calculation fields
  fabricRate?: number; // Rate per meter/yard
  totalFabricCost?: number; // Calculated: (CAD × (1 + wastage%)) × Rate
  notes?: string;
}

export interface GenerateCADOptionsDTO {
  styleId: string;
  genericGreigeName: string;
  greigeId: string;
  widths?: number[]; // Optional: specific widths to generate, defaults to common widths
}

export interface CADCostCalculationDTO {
  cadId: string;
  fabricRate: number; // Rate per unit (meter or yard)
  unit?: 'meters' | 'yards'; // Defaults to meters
}

export interface CADCostResult {
  cadId: string;
  availableWidth: number;
  cadConsumption: number;
  wastagePercent: number;
  effectiveConsumption: number; // cadConsumption × (1 + wastage%)
  fabricRate: number;
  totalCost: number;
  costPerMeter?: number;
  unit: string;
}

export interface ApproveCADDTO {
  styleId: string;
  cadId: string;
  fabricId: string;
  approvalNotes?: string;
}

export interface StyleCADSummary {
  styleId: string;
  styleCode: string;
  styleName: string;
  customerName: string;
  brandName: string;
  imageUrl?: string;
  cadStatus: CADStatus;
  components: ComponentCADSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentCADSummary {
  componentId: string;
  componentName: string;
  productionMethod?: ProductionMethod;
  fabrics: FabricCADSummary[];
}

export interface FabricCADSummary {
  fabricId: string;
  genericGreigeName: string;
  productionMethod?: ProductionMethod;
  cadStatus: 'PENDING' | 'OPTIONS_GENERATED' | 'APPROVED';
  approvedCADId?: string;
  approvedWidth?: number;
  approvedCost?: number;
  availableOptions: number; // Count of CAD options generated
}

export interface PendingCADStylesResponse {
  data: StyleCADSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CADOptionsResponse {
  styleId: string;
  genericGreigeName: string;
  greigeName: string;
  options: CADOption[];
  recommendedOption?: string; // CAD ID of lowest cost option
}

export interface CADApprovalResponse {
  success: boolean;
  message: string;
  style: {
    styleId: string;
    cadStatus: CADStatus;
    approvedCadId: string;
  };
}

// ============================================
// CAD PURPOSES: PRODUCTION, PLANNING, COSTING
// ============================================

/**
 * Approve CAD Purpose DTO
 */
export interface ApproveCADPurposeDTO {
  cadId: string;
  approvalNotes?: string;
}

/**
 * Reject CAD Purpose DTO
 */
export interface RejectCADPurposeDTO {
  cadId: string;
  rejectionNotes: string; // Required for rejection
}

/**
 * Create New Version of COSTING CAD
 */
export interface CreateCostingVersionDTO {
  baseCadId: string; // Base CAD to copy from
  versionReason?: string; // Why new version is needed
}

/**
 * Copy CAD Between Purposes (Updated for "Copy as Draft" workflow)
 */
export interface CopyCADPurposeDTO {
  sourceCadId: string;
  targetPurpose: CADPurpose;
  styleFabricId: string; // Target style fabric
  componentId?: string; // Optional: specify component
  patternPartId?: string; // Optional: specify pattern part
}

/**
 * Copy CAD Response - Returns new draft record details
 */
export interface CopyCADResponse {
  success: boolean;
  message: string;
  data: {
    newRecordId: string;
    copiedFromId: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus; // Will be PENDING
  };
}

/**
 * CAD Copy Lineage Data - Tracks copy history
 */
export interface CADCopyLineage {
  source?: {
    id: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus;
    componentName?: string;
    cutableWidth: number;
  };
  current: {
    id: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus;
    componentName?: string;
    cutableWidth: number;
  };
  children: Array<{
    id: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus;
    componentName?: string;
    cutableWidth: number;
  }>;
}

/**
 * Get Lineage Response
 */
export interface GetCADLineageResponse {
  success: boolean;
  data: CADCopyLineage;
}

/**
 * Link PRODUCTION CAD to Stock
 */
export interface LinkCADToStockDTO {
  cadId: string;
  fabricStockId: string;
  procurementId?: string; // Optional: link to procurement for traceability
  costingCadWidth?: number; // Optional: original COSTING mode width for variance tracking
}

/**
 * CAD Purpose Response (with all new fields)
 */
export interface CADPurposeResponse {
  id: string;
  purpose: CADPurpose;

  // Approval
  approvalStatus?: CADApprovalStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;

  // Locking (PRODUCTION)
  isLocked: boolean;
  lockedReason?: string;
  lockedAt?: string;

  // Version Control (COSTING mode)
  version: number;
  supersededById?: string;
  supersededByVersion?: number;

  // Copy Lineage - Track source record for audit trail
  copiedFromId?: string;
  copiedFrom?: {
    id: string;
    purpose: CADPurpose;
    approvalStatus: CADApprovalStatus;
  };

  // Stock Integration (PRODUCTION)
  fabricStockId?: string;
  fabricStockDetails?: {
    finishedWidth: number;
    cutableWidth: number;
    rollNumbers?: string;
    qualityGrade: string;
  };
  procurementId?: string;

  // Variance Tracking (PRODUCTION)
  costingCadWidth?: number;
  widthVariance?: number;
  variancePercent?: number;

  // Costing Integration (RAW_MATERIAL_CALCULATION mode)
  styleCostingId?: string;
  autoApprovedFrom?: CADAutoApprovalSource;

  // CAD Data
  cutableWidth: number;
  layerLengthMeters?: number;
  layerMarginMeters?: number;
  piecesPerMarker?: number;
  cadAverage?: number;
  sizeBreakdowns?: Array<{
    sizeName: string;
    quantity: number;
  }>;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ============================================
// FABRIC STOCK INTEGRATION FOR CAD PLANNING
// ============================================

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
}
