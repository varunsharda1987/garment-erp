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
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type MaterialRequirementStatus = typeof MaterialRequirementStatus[keyof typeof MaterialRequirementStatus];

export const MaterialRequirementStatusLabels: Record<MaterialRequirementStatus, string> = {
  PENDING: 'Pending',
  FULFILLED_STOCK: 'Fulfilled from Stock',
  PARTIAL_STOCK: 'Partially from Stock',
  PO_REQUIRED: 'PO Required',
  PO_GENERATED: 'PO Generated',
  PO_SENT: 'PO Sent',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export const MaterialRequirementStatusColors: Record<MaterialRequirementStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  FULFILLED_STOCK: 'bg-green-100 text-green-800',
  PARTIAL_STOCK: 'bg-yellow-100 text-yellow-800',
  PO_REQUIRED: 'bg-orange-100 text-orange-800',
  PO_GENERATED: 'bg-blue-100 text-blue-800',
  PO_SENT: 'bg-indigo-100 text-indigo-800',
  RECEIVED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const RequirementSource = {
  SALES_ORDER: 'SALES_ORDER',
  WORK_ORDER: 'WORK_ORDER',
  MANUAL: 'MANUAL',
} as const;

export type RequirementSource = typeof RequirementSource[keyof typeof RequirementSource];

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
  styleName?: string;
  totalQuantity: number;
}

export interface MaterialSummary {
  id: string;
  code: string;
  name: string;
  materialType: string;
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

  // Relations
  order?: OrderSummary | null;
  orderItem?: OrderItemSummary | null;
  material?: MaterialSummary;
  preferredSupplier?: SupplierSummary | null;
  createdBy?: UserSummary;
  poLinks?: RequirementPOLink[];
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
  status?: MaterialRequirementStatus | MaterialRequirementStatus[];
  source?: RequirementSource;
  requiredDateFrom?: string;
  requiredDateTo?: string;
  hasShortfall?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

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

export interface CalculationResultResponse {
  success: boolean;
  data: {
    created: number;
    updated: number;
    requirements: MaterialRequirement[];
  };
  message?: string;
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
