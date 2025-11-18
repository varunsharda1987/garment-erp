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
};

// ============================================
// COST SHEET MAIN TYPE
// ============================================

export type CostSheet = {
  id: string;
  styleId: string;

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
  handworkCost: number;
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
};

// ============================================
// INPUT TYPES FOR CREATE/UPDATE
// ============================================

export type CreateCostSheetInput = {
  styleId: string;
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
};

export type UpdateCostSheetInput = {
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
