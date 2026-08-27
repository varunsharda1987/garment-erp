// ============================================
// FABRIC TYPES
// ============================================

export type FabricDetail = {
  id?: string;
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;
  // Not Applicable flag - if true, item is excluded from calculations and 0 values are allowed
  isNotApplicable?: boolean;
  // Track if fabric was auto-populated (N/A checkbox only shows for manually added items)
  isAutoPopulated?: boolean;
  // Sourcing Strategy Fields
  fabricId?: string;
  sourcingStrategy?: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
  stockLotId?: string;
  processorId?: string;
  rateCardId?: string;
  procurementId?: string;
  greigeCost?: number;
  processingCost?: number;
  isManualOverride?: boolean;
  overrideReason?: string;
};

// ============================================
// TRIMS TYPES
// ============================================

export type TrimDetail = {
  id?: string;
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
  // Not Applicable flag - if true, item is excluded from calculations and 0 values are allowed
  isNotApplicable?: boolean;
  // New fields for auto-population from style_material_bom
  unit?: string; // 'pcs', 'meters', 'lot', etc.
  bomId?: string; // Reference to style_material_bom.id
  materialType?: string; // 'BUTTON', 'ZIPPER', 'THREAD', 'ELASTIC', 'LABEL', 'PACKAGING', etc.
  // Master ID fields — link to specific master records for MRP
  threadId?: string;
  buttonId?: string;
  zipperId?: string;
  elasticId?: string;
  labelId?: string;
  packagingId?: string;
  // Generic trim master FK fields
  hookEyeId?: string;
  snapButtonId?: string;
  buckleId?: string;
  beltId?: string;
  velcroId?: string;
  drawstringId?: string;
  ribbonId?: string;
  sequinId?: string;
  beadId?: string;
  motifId?: string;
  interliningId?: string;
  paddingId?: string;
  otherFastenerId?: string;
  otherTapeId?: string;
  otherDecorativeId?: string;
  otherFunctionalId?: string;
  materialId?: string; // FK to unified materials table
};

// ============================================
// LACE TYPES
// ============================================

export type LaceDetail = {
  id?: string;
  laceId: string;
  laceName: string;
  colorName?: string;
  width?: number;
  quantityPerGarment: number;
  wastagePercent: number;
  effectiveQuantity: number;
  // Sourcing Strategy Fields
  sourcingStrategy: 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED';
  greigeCost?: number;
  processingCost?: number;
  readyLaceCost?: number;
  stockCost?: number;
  costPerMeter: number;
  totalCost: number;
  // Source references
  greigeLaceId?: string;
  processorId?: string;
  rateCardId?: string;
  stockLotId?: string;
  procurementId?: string;
  labDipId?: string;
  // Override
  isManualOverride?: boolean;
  overrideReason?: string;
  // Not Applicable flag
  isNotApplicable?: boolean;
};

// ============================================
// CMT (CUT, MAKE, TRIM) TYPES
// ============================================

export type CMTCosts = {
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  buttonAttachmentCost: number;
  handworkCost: number;
  smockingCost: number;
};

// ============================================
// EMBROIDERY TYPES
// ============================================

export type EmbroideryDetail = {
  id?: string;
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
  // Not Applicable flag - if true, item is excluded from calculations and 0 values are allowed
  isNotApplicable?: boolean;
};

// ============================================
// ACCESSORIES TYPES
// ============================================

export type AccessoryDetail = {
  id?: string;
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
  // Not Applicable flag - if true, item is excluded from calculations and 0 values are allowed
  isNotApplicable?: boolean;
  // Master ID fields — link to specific master records for MRP
  labelId?: string;
  packagingId?: string;
  materialId?: string; // FK to unified materials table
  materialType?: string; // 'LABEL' | 'PACKAGING'
};

// ============================================
// COST SHEET MAIN TYPE
// ============================================

// Approval status enum for cost sheets
export type CostSheetApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Cost sheet purpose/mode - determines what the cost sheet can be used for
export type CostSheetPurpose = 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';

export type CostSheet = {
  id: string;
  styleId: string;
  purpose: CostSheetPurpose; // Cost sheet mode

  // Versioning Support
  version: number;
  versionDate: string;
  versionReason?: string;
  costVariancePercent?: number;
  supersededById?: string;
  lockedForOrders: boolean;
  widthCombinationHash?: string;
  widthCombinationDescription?: string;

  // Approval Status
  approvalStatus: CostSheetApprovalStatus;
  rejectionNotes?: string;

  // Source-costing drift (attached by GET /style-costing/:id; advisory, may be null)
  sourceCostingDrift?: CostSheetSourceDrift | null;

  // Basic Information
  numberOfComponents?: number;
  category?: string;
  subCategory?: string;

  // Fabric Details
  fabricDetails: FabricDetail[];
  fabricTotal: number;

  // Trims Details
  trimsDetails: TrimDetail[];
  trimsTotal: number;

  // Lace Details
  laceDetails: LaceDetail[];
  laceTotal: number;

  // CMT Costs
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  buttonAttachmentCost: number;
  handworkCmtCost: number;
  smockingCost: number;
  cmtTotal: number;

  // Embroidery Details
  embroideryDetails: EmbroideryDetail[];
  embroideryTotal: number;

  // Accessories Details
  accessoriesDetails: AccessoryDetail[];
  accessoriesTotal: number;

  // Value Loss
  valueLossPercent: number;
  valueLossAmount: number;

  // Markup
  markupPercent: number;
  markupAmount: number;

  // Calculated Totals
  subtotal: number;
  totalProductCost: number;
  totalMaterialCost: number;
  totalProcessingCost: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number;

  // Closed Cost - Final agreed price with customer (exclusive of tax)
  closedCost?: number | null;
  closedCostCurrency?: string;
  closedCostNotes?: string | null;
  closedCostApprovedAt?: string | null;
  closedCostApprovedById?: string | null;

  // Tracking
  createdById: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  isApproved: boolean;
  approvedById?: string;
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Style info
  style?: {
    id: string;
    styleCode: string;
    styleName?: string;
    buyerStyleRef?: string | null;
    category?: string;
  };

  // Linked Orders (for tracking)
  orderId?: string | null;
  orderItemId?: string | null;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    orderDate: string;
  } | null;
  orderItem?: {
    id: string;
    orderId: string;
    totalQuantity: number;
    orders?: {
      orderNumber: string;
      status: string;
    };
  } | null;
};

// ============================================
// INPUT TYPES FOR CREATE/UPDATE
// ============================================

export type CreateCostSheetInput = {
  styleId: string;
  purpose?: CostSheetPurpose; // Optional, defaults to COSTING
  numberOfComponents?: number;
  category?: string;
  subCategory?: string;
  fabricDetails: FabricDetail[];
  trimsDetails: TrimDetail[];
  laceDetails?: LaceDetail[];
  cmtCosts: CMTCosts;
  embroideryDetails: EmbroideryDetail[];
  accessoriesDetails: AccessoryDetail[];
  valueLossPercent: number;
  markupPercent: number;
  notes?: string;
  // Closed Cost - Final agreed price with customer
  closedCost?: number | null;
  closedCostNotes?: string | null;

  // Budget Fields (for RAW_MATERIAL_CALCULATION/PRODUCTION direct procurement)
  enableBudgetTracking?: boolean;
  fabricBudget?: number;
  trimsBudget?: number;
  cmtBudget?: number;
  embroideryBudget?: number;
  accessoriesBudget?: number;
  totalBudget?: number;

  // Buffer Percentages
  fabricBufferPercent?: number;
  trimsBufferPercent?: number;
  cmtBufferPercent?: number;
  embroideryBufferPercent?: number;
  accessoriesBufferPercent?: number;

  // Order Linking (optional)
  orderId?: string;
  orderItemId?: string;
};

export type UpdateCostSheetInput = {
  purpose?: CostSheetPurpose; // Can update mode
  numberOfComponents?: number;
  category?: string;
  subCategory?: string;
  fabricDetails?: FabricDetail[];
  trimsDetails?: TrimDetail[];
  laceDetails?: LaceDetail[];
  cmtCosts?: CMTCosts;
  embroideryDetails?: EmbroideryDetail[];
  accessoriesDetails?: AccessoryDetail[];
  valueLossPercent?: number;
  markupPercent?: number;
  notes?: string;
  // Closed Cost - Final agreed price with customer
  closedCost?: number | null;
  closedCostNotes?: string | null;
};

// ============================================
// LIST & RESPONSE TYPES
// ============================================

export type CostSheetListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  approved?: string;
  purpose?: string;
};

export type CostSheetListResponse = {
  success: boolean;
  data: CostSheet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // backend returns totalPages, not pages (bug-hunt orders-13)
  };
};

// ============================================
// LEGACY TYPES (for backward compatibility)
// ============================================

export type CADAverages = {
  fabricConsumption?: number;
  wastagePercent?: number;
  unit?: string;
};

export type MaterialCosts = {
  fabricCost: number;
  trimsCost: number;
  accessoriesCost: number;
  packagingCost: number;
  otherMaterialCost: number;
};

export type ProcessingCosts = {
  dyeingCost: number;
  printingCost: number;
  embroideryWork: number;
  handWork: number;
  smockingCost: number;
  washingCost: number;
  otherProcessingCost: number;
};

export type LaborCosts = {
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  checkingCost: number;
  cmtCost: number;
};

export type OverheadCosts = {
  transportCost: number;
  adminOverhead: number;
  factoryOverhead: number;
  otherOverheads: number;
};

// ============================================
// BUDGET SUGGESTIONS TYPES
// ============================================

export type BudgetSuggestions = {
  fabricBudget: number;
  trimsBudget: number;
  cmtBudget: number;
  embroideryBudget: number;
  accessoriesBudget: number;
  totalBudget: number;
  sources: {
    fabricSource: string;
    trimsSource: string;
    cmtSource: string;
    embroiderySource: string;
    accessoriesSource: string;
  };
};

export type BudgetSuggestionsResponse = {
  success: boolean;
  data: BudgetSuggestions;
  message: string;
};

// ============================================
// RATE VALIDATION TYPES
// ============================================

export type RateChangeSeverity = 'INFO' | 'WARNING' | 'BLOCKING';
export type RateValidationStatus = 'CURRENT' | 'OUTDATED' | 'RATE_CHANGED';
export type SuggestedAction = 'PROCEED' | 'REFRESH_RATES' | 'CREATE_NEW_VERSION';

export type ProcessorRateChangeWarning = {
  itemType: 'FABRIC' | 'LACE';
  itemId: string;
  itemName: string;
  processorId: string;
  processorName: string;
  greigeId?: string;
  greigeName?: string;
  laceId?: string;
  laceName?: string;
  costSheetRate: number;
  currentRate: number;
  difference: number;
  percentageChange: number;
  severity: RateChangeSeverity;
  rateCardIdOld?: string;
  rateCardIdNew?: string;
  effectiveFromOld?: string;
  effectiveFromNew?: string;
};

export type RateValidation = {
  status: RateValidationStatus;
  isValid: boolean;
  requiresRefresh: boolean;
  fabricWarnings: ProcessorRateChangeWarning[];
  laceWarnings: ProcessorRateChangeWarning[];
  blockingItems: ProcessorRateChangeWarning[];
  warningItems: ProcessorRateChangeWarning[];
  suggestedAction: SuggestedAction;
  summary: {
    totalItems: number;
    currentItems: number;
    warningItems: number;
    blockingItems: number;
  };
};

export type CostSheetWithRateValidation = CostSheet & {
  rateValidation: RateValidation;
  sourceCostingDrift?: CostSheetSourceDrift | null;
};

// ============================================
// SOURCE-COSTING DRIFT (ESSKY091LS)
// The relational fabric items froze a rate snapshot from fabric_width_cad;
// this reports where the source costing has since been re-priced, unapproved
// or cleared. Attached by GET /style-costing/:id (advisory — may be null).
// ============================================

export type SnapshotDriftFlag = 'PRICE_CHANGED' | 'CONSUMPTION_CHANGED' | 'SOURCE_UNAPPROVED' | 'SOURCE_UNCOSTED';

export type CostSheetDriftItem = {
  itemId: string;
  fabricName: string;
  width: number | null;
  isManualOverride: boolean;
  overrideReason: string | null;
  flags: SnapshotDriftFlag[];
  snapshot: {
    costPerMeter: number | null;
    greigeCost: number | null;
    processingCost: number | null;
    cadMeters: number | null;
  };
  current: {
    totalCostPerMeter: number | null;
    greigeCostPerMeter: number | null;
    processingPricePerMeter: number | null;
    cadAverage: number | null;
    costingApprovalStatusCurrent: string | null;
    componentName: string | null;
    cutableWidth: number | null;
    cadUpdatedAt: string;
  };
  estimatedImpactPerPiece: number | null;
};

export type CostSheetSourceDrift = {
  costSheetId: string;
  hasDrift: boolean;
  items: CostSheetDriftItem[];
  untrackedItems: number;
  summary: {
    itemsChecked: number;
    itemsWithDrift: number;
    totalEstimatedImpactPerPiece: number;
    flagCounts: Partial<Record<SnapshotDriftFlag, number>>;
  };
};
