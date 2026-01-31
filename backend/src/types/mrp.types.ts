/**
 * MRP (Material Requirement Planning) Types
 * Backend type definitions for material requirements management
 */

import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// ENUMS (mirror Prisma enums)
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

export const RequirementSource = {
  SALES_ORDER: 'SALES_ORDER',
  WORK_ORDER: 'WORK_ORDER',
  MANUAL: 'MANUAL',
} as const;

export type RequirementSource = typeof RequirementSource[keyof typeof RequirementSource];

// ============================================
// CALCULATION TYPES
// ============================================

/**
 * Input for calculating material requirements from an order
 */
export interface CalculateRequirementsInput {
  orderId: string;
  orderItemId?: string; // Optional - if not provided, calculate for all items
  requiredDate: Date;
  checkStock?: boolean; // Default true - whether to check available stock
}

/**
 * BOM item data needed for requirement calculation
 */
export interface BOMItemData {
  orderBomId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantityPerUnit: number | Decimal;
  wastagePercent: number | Decimal;
  preferredSupplierId?: string | null;
}

/**
 * Order item data needed for requirement calculation
 */
export interface OrderItemData {
  orderItemId: string;
  styleId: string;
  styleName: string;
  styleCode: string;
  totalQuantity: number;
  bomId?: string | null;
}

/**
 * Result of requirement calculation for a single material
 */
export interface CalculatedRequirement {
  orderId: string;
  orderItemId: string;
  materialId: string;
  orderBomId: string;
  orderQuantity: number;
  quantityPerUnit: number;
  wastagePercent: number;
  totalRequired: number;
  unit: string;
  availableStock: number;
  allocatedFromStock: number;
  shortfall: number;
  preferredSupplierId?: string | null;
  status: MaterialRequirementStatus;
  // Fabric width tracking for split PO scenarios
  fabricWidth?: number;
  cadId?: string;
  splitFromId?: string;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request to calculate requirements for an order
 */
export interface CalculateRequirementsRequest {
  orderId: string;
  orderItemId?: string;
  requiredDate: string; // ISO date string
  checkStock?: boolean;
}

/**
 * Request to manually create a requirement
 */
export interface CreateManualRequirementRequest {
  materialId: string;
  quantity: number;
  unit: string;
  requiredDate: string;
  preferredSupplierId?: string;
  remarks?: string;
}

/**
 * Request to generate PO from requirements
 */
export interface GeneratePOFromRequirementsRequest {
  requirementIds: string[];
  supplierId: string;
  expectedDeliveryDate: string;
  remarks?: string;
  consolidate?: boolean; // Combine same materials into single PO item
}

/**
 * Request to allocate stock to a requirement
 */
export interface AllocateStockRequest {
  requirementId: string;
  quantity: number;
  warehouseId?: string;
}

/**
 * Request to link a requirement to an existing PO item
 */
export interface LinkRequirementToPORequest {
  requirementId: string;
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  allocatedQuantity: number;
}

/**
 * Filter options for querying requirements
 */
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

/**
 * Material requirement with relations
 */
export interface MaterialRequirementResponse {
  id: string;
  requirementNumber: string;
  source: RequirementSource;
  orderId: string | null;
  orderItemId: string | null;
  materialId: string;
  orderBomId: string | null;
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
  order?: {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName?: string;
  } | null;
  orderItem?: {
    id: string;
    styleId: string;
    styleName?: string;
    totalQuantity: number;
  } | null;
  material?: {
    id: string;
    code: string;
    name: string;
    materialType: string;
  };
  preferredSupplier?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  poLinks?: RequirementPOLinkResponse[];
}

/**
 * Requirement to PO link with relations
 */
export interface RequirementPOLinkResponse {
  id: string;
  requirementId: string;
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  allocatedQuantity: number;
  receivedQuantity: number;
  createdAt: string;

  // Relations
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

/**
 * Summary of requirements for an order
 */
export interface OrderRequirementsSummary {
  orderId: string;
  orderNumber: string;
  totalRequirements: number;
  byStatus: {
    status: MaterialRequirementStatus;
    count: number;
    totalQuantity: number;
  }[];
  totalShortfall: number;
  requirementsNeedingPO: number;
  estimatedPOValue?: number;
}

/**
 * MRP Dashboard statistics
 */
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

/**
 * Paginated list response
 */
export interface RequirementListResponse {
  success: boolean;
  data: MaterialRequirementResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Single requirement response
 */
export interface RequirementResponse {
  success: boolean;
  data: MaterialRequirementResponse;
  message?: string;
}

/**
 * Calculation result response
 */
export interface CalculationResultResponse {
  success: boolean;
  data: {
    created: number;
    updated: number;
    requirements: MaterialRequirementResponse[];
  };
  message?: string;
}

/**
 * PO generation result
 */
export interface POGenerationResult {
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
// UTILITY TYPES
// ============================================

/**
 * Requirement number generator config
 */
export interface RequirementNumberConfig {
  prefix: string;
  dateFormat: string;
  sequenceLength: number;
}

/**
 * Stock availability check result
 */
export interface StockAvailabilityResult {
  materialId: string;
  warehouseId?: string;
  availableQuantity: number;
  reservedQuantity: number;
  freeQuantity: number;
}
