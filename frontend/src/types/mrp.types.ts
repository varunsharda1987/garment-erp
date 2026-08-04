/**
 * MRP (Material Requirement Planning) Types
 * Frontend type definitions for material requirements management
 */

// ============================================
// ENUMS
// ============================================

export const MaterialRequirementStatus = {
  PENDING: 'PENDING',
  FULFILLED_STOCK: 'FULFILLED_STOCK',
  PARTIAL_STOCK: 'PARTIAL_STOCK',
  PO_REQUIRED: 'PO_REQUIRED',
  PO_GENERATED: 'PO_GENERATED',
  PO_SENT: 'PO_SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED', // bug-hunt: was missing from frontend
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type MaterialRequirementStatus = (typeof MaterialRequirementStatus)[keyof typeof MaterialRequirementStatus];

export const MaterialRequirementStatusLabels: Record<MaterialRequirementStatus, string> = {
  PENDING: 'Pending',
  FULFILLED_STOCK: 'Fulfilled from Stock',
  PARTIAL_STOCK: 'Partially from Stock',
  PO_REQUIRED: 'PO Required',
  PO_GENERATED: 'PO Generated',
  PO_SENT: 'PO Sent',
  PARTIALLY_RECEIVED: 'Partially Received', // bug-hunt: was missing
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export const MaterialRequirementStatusColors: Record<MaterialRequirementStatus, string> = {
  PENDING: 'bg-muted text-foreground',
  FULFILLED_STOCK: 'bg-success-muted text-success',
  PARTIAL_STOCK: 'bg-yellow-100 text-yellow-800',
  PO_REQUIRED: 'bg-orange-100 text-orange-800',
  PO_GENERATED: 'bg-info-muted text-info',
  PO_SENT: 'bg-primary/10 text-primary',
  PARTIALLY_RECEIVED: 'bg-blue-100 text-blue-800', // bug-hunt: was missing
  RECEIVED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export const RequirementSource = {
  SALES_ORDER: 'SALES_ORDER',
  WORK_ORDER: 'WORK_ORDER',
  MANUAL: 'MANUAL',
} as const;

export type RequirementSource = (typeof RequirementSource)[keyof typeof RequirementSource];

export const RequirementSourceLabels: Record<RequirementSource, string> = {
  SALES_ORDER: 'Sales Order',
  WORK_ORDER: 'Work Order',
  MANUAL: 'Manual',
};

// ============================================
// SUMMARY TYPES
// ============================================

export interface OrderSummary {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
}

export interface OrderItemSummary {
  id: string;
  styleId: string;
  styleCode?: string;
  styleName?: string;
  buyerStyleRef?: string | null;
  totalQuantity: number;
}

export interface MaterialSummary {
  id: string;
  code: string;
  name: string;
  materialType: string;
  fabricId?: string | null;
}

export interface SupplierSummary {
  id: string;
  code: string;
  name: string;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
}

// ============================================
// REQUIREMENT PO LINK
// ============================================

export interface RequirementPOLink {
  id: string;
  requirementId: string;
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  allocatedQuantity: number;
  receivedQuantity: number;
  createdAt: string;
  purchaseOrder?: {
    id: string;
    poNumber: string;
    status: string;
    supplierId: string;
  };
  purchaseOrderItem?: {
    id: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
  };
}

// ============================================
// MATERIAL REQUIREMENT
// ============================================

export interface MaterialRequirement {
  id: string;
  requirementNumber: string;
  source: RequirementSource;
  orderId: string | null;
  orderItemId: string | null;
  materialId: string;
  bomItemId: string | null;
  orderQuantity: number;
  quantityPerUnit: number;
  wastagePercent: number;
  totalRequired: number;
  unit: string;
  availableStock: number;
  allocatedFromStock: number;
  shortfall: number;
  preferredSupplierId: string | null;
  status: MaterialRequirementStatus;
  requiredDate: string;
  calculatedAt: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;

  // NEW: GREIGE + PROCESSING support
  requirementType?: 'MATERIAL' | 'PROCESSING';
  processorId?: string | null;
  linkedRequirementId?: string | null;
  processingCost?: number | null;
  printingType?: string | null;
  colorName?: string | null;
  componentName?: string | null;
  fabricWidth?: number | null;

  // Relations
  order?: OrderSummary | null;
  orderItem?: OrderItemSummary | null;
  material?: MaterialSummary;
  preferredSupplier?: SupplierSummary | null;
  createdBy?: UserSummary;
  poLinks?: RequirementPOLink[];
  orderBom?: { id: string; version: number } | null;
  // NEW: Processing relations
  processor?: SupplierSummary | null;
  linkedRequirement?: MaterialRequirement | null;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CalculateRequirementsRequest {
  orderId: string;
  orderItemId?: string;
  requiredDate: string;
  checkStock?: boolean;
}

export interface CreateManualRequirementRequest {
  materialId: string;
  quantity: number;
  unit: string;
  requiredDate: string;
  preferredSupplierId?: string;
  remarks?: string;
}

export interface GeneratePORequest {
  requirementIds: string[];
  supplierId: string;
  expectedDeliveryDate: string;
  remarks?: string;
  consolidate?: boolean;
  itemPrices?: Record<string, number>;
}

// ============================================
// PO PREVIEW TYPES
// ============================================

export interface POPreviewItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  hsnCode: string | null;
  gstRate: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxAmount: number;
  totalWithTax: number;
  isGreige: boolean;
  priceRequired: boolean;
  requirementIds: string[];
  // Enriched fields for PO context
  colorName?: string | null;
  styleName?: string | null;
  styleCode?: string | null;
  orderNumber?: string | null;
  processingType?: string | null;
  componentName?: string | null;
  fabricWidth?: number | null;
}

export interface POPreviewGroup {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  supplierGstin?: string;
  supplierAddress?: string;
  isInterstate: boolean;
  supplierStateCode: string | null;
  items: POPreviewItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  hasZeroPriceItems: boolean;
}

export interface AllocateStockRequest {
  quantity: number;
  warehouseId?: string;
}

export interface LinkToPORequest {
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  allocatedQuantity: number;
}

export interface UpdateStatusRequest {
  status: MaterialRequirementStatus;
}

// ============================================
// FILTER TYPES
// ============================================

export interface RequirementFilters {
  orderId?: string;
  orderItemId?: string;
  materialId?: string;
  supplierId?: string;
  styleId?: string;
  status?: MaterialRequirementStatus | MaterialRequirementStatus[];
  source?: RequirementSource;
  requirementType?: 'MATERIAL' | 'PROCESSING'; // NEW: Filter by type
  requiredDateFrom?: string;
  requiredDateTo?: string;
  hasShortfall?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// NEW: Requirement Type helpers
export const RequirementTypeLabels: Record<string, string> = {
  MATERIAL: 'Material',
  PROCESSING: 'Processing',
};

export const RequirementTypeColors: Record<string, string> = {
  MATERIAL: 'bg-info-muted text-info border-info/20',
  PROCESSING: 'bg-accent/10 text-accent border-accent/20',
};

// ============================================
// RESPONSE TYPES
// ============================================

export interface RequirementListResponse {
  success: boolean;
  data: MaterialRequirement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequirementResponse {
  success: boolean;
  data: MaterialRequirement;
  message?: string;
}

/**
 * Skipped BOM item during MRP calculation
 */
export interface SkippedBOMItem {
  componentName: string;
  materialType: string;
  reason: string;
}

export interface CalculationResultResponse {
  success: boolean;
  data: {
    created: number;
    updated: number;
    requirements: MaterialRequirement[];
    skipped: SkippedBOMItem[];
  };
  message?: string;
  warning?: string;
}

export interface POGenerationResponse {
  success: boolean;
  data: {
    purchaseOrder: {
      id: string;
      poNumber: string;
      totalAmount: number;
    };
    linkedRequirements: number;
    totalItems: number;
  };
  message?: string;
}

// ============================================
// SUMMARY TYPES
// ============================================

export interface StatusCount {
  status: MaterialRequirementStatus;
  count: number;
  totalQuantity: number;
}

export interface OrderRequirementsSummary {
  orderId: string;
  orderNumber: string;
  totalRequirements: number;
  byStatus: StatusCount[];
  totalShortfall: number;
  requirementsNeedingPO: number;
  estimatedPOValue?: number;
}

export interface MRPDashboardStats {
  totalPendingRequirements: number;
  totalShortfall: number;
  requirementsNeedingPO: number;
  poInProgress: number;
  awaitingReceipt: number;
  overdueRequirements: number;
  processingRequirementsCount: number;
  byMaterialType: {
    materialType: string;
    count: number;
    shortfall: number;
  }[];
  bySupplier: {
    supplierId: string;
    supplierName: string;
    requirementCount: number;
    totalValue: number;
  }[];
}

export interface DashboardStatsResponse {
  success: boolean;
  data: MRPDashboardStats;
}

export interface OrderSummaryResponse {
  success: boolean;
  data: OrderRequirementsSummary;
}

// ============================================
// FORM TYPES
// ============================================

export interface ManualRequirementFormValues {
  materialId: string;
  quantity: number | string;
  unit: string;
  requiredDate: string;
  preferredSupplierId: string;
  remarks: string;
}

export interface GeneratePOFormValues {
  supplierId: string;
  expectedDeliveryDate: string;
  remarks: string;
  consolidate: boolean;
}

// ============================================
// TABLE/LIST TYPES
// ============================================

export interface RequirementTableRow extends MaterialRequirement {
  materialCode: string;
  materialName: string;
  orderNumber?: string;
  supplierName?: string;
}
