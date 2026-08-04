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
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type MaterialRequirementStatus = (typeof MaterialRequirementStatus)[keyof typeof MaterialRequirementStatus];

export const RequirementSource = {
  SALES_ORDER: 'SALES_ORDER',
  WORK_ORDER: 'WORK_ORDER',
  MANUAL: 'MANUAL',
} as const;

export type RequirementSource = (typeof RequirementSource)[keyof typeof RequirementSource];

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
  // NEW: GREIGE + PROCESSING support
  requirementType?: 'MATERIAL' | 'PROCESSING';
  processorId?: string | null;
  processingCost?: number | null;
  printingType?: string | null;
  linkedGreigeMaterialId?: string;
  isGreigeRequirement?: boolean;
  colorName?: string | null;
  componentName?: string | null;
  // Price snapshot from the approved Order BOM (single source of truth for PO pricing)
  unitPrice?: number | null;
  rateSource?: 'ORDER_BOM' | 'COST_SHEET' | 'SUPPLIER_PRICE' | 'RATE_CARD' | 'MANUAL' | null;
  orderBomItemId?: string | null;
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
  itemPrices?: Record<string, number>; // itemKey → unitPrice (user-edited prices)
  itemQuantities?: Record<string, number>; // itemKey → quantity (user-edited quantities, allows ordering more than MRP shortfall)
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
  priceRequired: boolean; // true if price = 0
  requirementIds: string[];
  /**
   * Canonical consolidation key — IDENTICAL to the key used by generatePOFromRequirements.
   * The frontend MUST key edited prices/quantities by this value so an edit lands on the
   * same group the generator builds (otherwise a per-width edit leaks across width groups).
   */
  groupKey: string;
  /** Where the displayed unitPrice came from — 'ORDER_BOM' is the trusted default. */
  rateSource?: string | null;
  // Enriched fields for PO context
  colorName?: string | null;
  styleName?: string | null;
  styleCode?: string | null;
  buyerStyleRef?: string | null;
  orderNumber?: string | null;
  processingType?: string | null;
  componentName?: string | null;
  fabricWidth?: number | null;
}

export interface POPreviewGroup {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  supplierGstin: string | null;
  supplierAddress: string;
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

export interface POPreviewRequest {
  groups: {
    supplierId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
  }[];
}

export interface POPreviewResponse {
  success: boolean;
  data: POPreviewGroup[];
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
  styleId?: string;
  status?: MaterialRequirementStatus | MaterialRequirementStatus[];
  source?: RequirementSource;
  requirementType?: 'MATERIAL' | 'PROCESSING';
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
  requirementType?: string;
  processorId?: string | null;
  processingCost?: number | null;
  printingType?: string | null;
  linkedRequirementId?: string | null;
  colorName?: string | null;
  componentName?: string | null;
  fabricWidth?: number | null;
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
    styleCode?: string;
    buyerStyleRef?: string | null;
    styleName?: string;
    totalQuantity: number;
  } | null;
  material?: {
    id: string;
    code: string;
    name: string;
    materialType: string;
    fabricId?: string | null;
  };
  preferredSupplier?: {
    id: string;
    code: string;
    name: string;
  } | null;
  processor?: {
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
  orderBom?: {
    id: string;
    version: number;
  } | null;
  linkedRequirement?: {
    id: string;
    requirementNumber: string;
    requirementType: string;
    status: MaterialRequirementStatus;
    totalRequired: number;
    material?: {
      id: string;
      code: string;
      name: string;
    };
  } | null;
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
 * Skipped BOM item during MRP calculation
 */
export interface SkippedBOMItem {
  componentName: string;
  materialType: string;
  reason: string;
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
    skipped: SkippedBOMItem[];
  };
  message?: string;
  warning?: string;
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
