/**
 * Order BOM (Bill of Materials) Types
 * Frontend type definitions for Order-level BOM operations
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

// ============================================
// Order BOM Status
// ============================================

export type OrderBOMStatus = 'DRAFT' | 'APPROVED' | 'LOCKED';

// ============================================
// Order BOM Item Types
// ============================================

export type OrderBOMItemMaterialType =
  | 'BUTTON'
  | 'THREAD'
  | 'ZIPPER'
  | 'LACE'
  | 'ELASTIC'
  | 'LABEL'
  | 'PACKAGING'
  | 'FABRIC'
  | 'GENERIC';

export type OrderBOMItemUsageCategory =
  | 'GARMENT_TRIM'
  | 'PACKAGING'
  | 'VALUE_ADDITION'
  | 'FABRIC';

export interface OrderBOMItem {
  id: string;
  orderBomId: string;
  materialType: OrderBOMItemMaterialType;
  materialId?: string | null;
  buttonId?: string | null;
  threadId?: string | null;
  zipperId?: string | null;
  laceId?: string | null;
  elasticId?: string | null;
  labelId?: string | null;
  packagingId?: string | null;
  fabricId?: string | null;
  selectedCadId?: string | null;
  fabricWidthInches?: number | null;
  cadAverageSnapshot?: number | null;
  quantityPerGarment: number;
  orderQuantity: number;
  totalQuantity: number;
  wastagePercent?: number | null;
  totalWithWastage?: number | null;
  unit: string;
  unitPrice: number;
  totalCost: number;
  componentName?: string | null;
  usageCategory?: OrderBOMItemUsageCategory | null;
  notes?: string | null;
  sortOrder: number;
  // Material relations (populated from includes)
  material?: { id: string; code: string; name: string } | null;
  buttonMaster?: { id: string; buttonCode: string; buttonName: string } | null;
  threadMaster?: { id: string; threadCode: string; threadName: string } | null;
  zipperMaster?: { id: string; zipperCode: string; zipperName: string } | null;
  laceMaster?: { id: string; laceCode: string; laceName: string } | null;
  elasticMaster?: { id: string; elasticCode: string; elasticName: string } | null;
  labelMaster?: { id: string; labelCode: string; labelName: string } | null;
  packagingMaster?: { id: string; packagingCode: string; packagingName: string } | null;
  fabricMaster?: { id: string; fabricCode: string; fabricName: string } | null;
}

export interface OrderBOMItemInput {
  materialType: OrderBOMItemMaterialType;
  materialId?: string;
  buttonId?: string;
  threadId?: string;
  zipperId?: string;
  laceId?: string;
  elasticId?: string;
  labelId?: string;
  packagingId?: string;
  fabricId?: string;
  quantityPerGarment: number;
  orderQuantity: number;
  wastagePercent?: number;
  unit: string;
  unitPrice: number;
  componentName?: string;
  usageCategory?: OrderBOMItemUsageCategory;
  notes?: string;
  sortOrder?: number;
}

// ============================================
// Order BOM Types
// ============================================

export interface OrderBOM {
  id: string;
  orderId: string;
  orderItemId?: string | null;
  styleId: string;
  version: number;
  isActive: boolean;
  status: OrderBOMStatus;
  totalMaterialCost?: number | null;
  sourceCostSheetId?: string | null;
  copiedFromOrderId?: string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  order?: {
    id: string;
    orderNumber: string;
    [key: string]: unknown;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    [key: string]: unknown;
  };
  items?: OrderBOMItem[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

// ============================================
// Request Types
// ============================================

export interface CreateOrderBOMFromCostSheetRequest {
  styleId: string;
  costSheetId: string;
  orderItemId?: string;
}

export interface CopyOrderBOMRequest {
  styleId: string;
  orderItemId?: string;
  adjustQuantity?: number;
}

export interface UpdateOrderBOMRequest {
  items: OrderBOMItemInput[];
}

export interface ChangeWidthRequest {
  fabricItemChanges: Array<{
    bomItemId: string;
    newCadId: string;
  }>;
}

export interface FabricCadOption {
  id: string;
  fabricId?: string;
  cutableWidth: number;
  cadAverage?: number;
  totalCostPerMeter?: number;
  cadMeters?: number;
  cadWastagePercent?: number;
  markerEfficiency?: number;
}

// ============================================
// Query Types
// ============================================

export interface OrderBOMFilters {
  orderId?: string;
  styleId?: string;
  status?: OrderBOMStatus;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ============================================
// Response Types
// ============================================

export interface OrderBOMResponse {
  success: boolean;
  data: OrderBOM;
  message?: string;
}

export interface OrderBOMListResponse {
  success: boolean;
  data: OrderBOM[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Material Requirement Types
// ============================================

export interface OrderBOMMaterialRequirement {
  materialType: string;
  materialName: string;
  materialCode: string;
  quantityPerGarment: number;
  orderQuantity: number;
  baseQuantity: number;
  wastagePercent: number;
  wastageQuantity: number;
  totalQuantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
}

export interface OrderBOMRequirementsSummary {
  totalItems: number;
  totalMaterialCost: number;
  requirements: OrderBOMMaterialRequirement[];
  byCategory: {
    [category: string]: {
      itemCount: number;
      totalCost: number;
    };
  };
}

export interface OrderBOMRequirementsResponse {
  success: boolean;
  data: OrderBOMRequirementsSummary;
}
