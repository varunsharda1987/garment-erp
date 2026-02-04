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
  unit?: string;           // 'pcs', 'meters', 'lot', etc.
  bomId?: string;          // Reference to style_material_bom.id
  materialType?: string;   // 'BUTTON', 'ZIPPER', 'THREAD', etc.
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
  purpose: CostSheetPurpose;  // Cost sheet mode

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

  // CMT Costs
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  buttonAttachmentCost: number;
  handworkCmtCost: number;
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
  purpose?: CostSheetPurpose;  // Optional, defaults to COSTING
  numberOfComponents?: number;
  category?: string;
  subCategory?: string;
  fabricDetails: FabricDetail[];
  trimsDetails: TrimDetail[];
  cmtCosts: CMTCosts;
  embroideryDetails: EmbroideryDetail[];
  accessoriesDetails: AccessoryDetail[];
  valueLossPercent: number;
  markupPercent: number;
  notes?: string;
  // Closed Cost - Final agreed price with customer
  closedCost?: number | null;
  closedCostNotes?: string | null;
};

export type UpdateCostSheetInput = {
  purpose?: CostSheetPurpose;  // Can update mode
  numberOfComponents?: number;
  category?: string;
  subCategory?: string;
  fabricDetails?: FabricDetail[];
  trimsDetails?: TrimDetail[];
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
};

export type CostSheetListResponse = {
  success: boolean;
  data: CostSheet[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
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
