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
  CONVERTED: 'CONVERTED', // P3: fabric req converted to greige+processing
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
  CONVERTED: 'Converted to Greige', // P3
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
  CONVERTED: 'bg-violet-100 text-violet-800', // P3
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

/**
 * Job Work Order link for PROCESSING requirements.
 *
 * MRP-45: the API has returned this since the Job Work Consolidation, but the type never did —
 * the page read it through `(req as any).jwoLinks`, so a backend rename would have silently
 * blanked the JWO status links instead of failing the build.
 */
export interface RequirementJWOLink {
  id: string;
  requirementId: string;
  jobWorkOrderId: string;
  allocatedQuantity: number;
  receivedQuantity: number;
  createdAt: string;
  jobWorkOrder?: {
    id: string;
    jobWorkNumber: string;
    status: string;
    jwoStatus: string;
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
  /** MRP-12: set when this row is the uncovered balance of a partially-ordered requirement. */
  splitFromId?: string | null;
  /** MRP-48f: shrinkage applied and where it came from (RATE_CARD | RATE_CARD_RESOLVED | GREIGE_MASTER_FALLBACK | NONE). */
  shrinkagePercentUsed?: number | null;
  shrinkageSource?: string | null;
  /**
   * Billing basis — PROCESSING rows only. The processor bills for the fabric he returns:
   * billableQuantity = totalRequired × (1 − effectiveShrinkagePercent/100). totalRequired /
   * greigeIssueQty stay greige-basis (what is bought and physically issued to him).
   */
  effectiveShrinkagePercent?: number | null;
  billableQuantity?: number | null;
  greigeIssueQty?: number | null;
  processingCost?: number | null;
  printingType?: string | null;
  colorName?: string | null;
  componentName?: string | null;
  fabricWidth?: number | null;

  // P5.3 Provenance fields - snapshot from approved Order BOM
  unitPrice?: number | null;
  rateSource?: string | null;
  orderBomItemId?: string | null;

  // Relations
  order?: OrderSummary | null;
  orderItem?: OrderItemSummary | null;
  material?: MaterialSummary;
  preferredSupplier?: SupplierSummary | null;
  createdBy?: UserSummary;
  poLinks?: RequirementPOLink[];
  jwoLinks?: RequirementJWOLink[];
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
  /**
   * MRP-08: optional — omit it and the backend uses the order's own expectedDeliveryDate. Callers
   * used to synthesise "today + 30 days", which overwrote the real due date on every requirement
   * a recalculation created.
   */
  requiredDate?: string;
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
  // P1.4/P1.10: Canonical groupKey for frontend edits — MUST match backend generatePOFromRequirements
  groupKey: string;
  // P1.10: Rate source for exception-only badge (show only when NOT 'ORDER_BOM')
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
  /**
   * PROCESSING rows only — `quantity` is the BILLABLE fabric-out qty (what the processor
   * charges for); this is the greige to physically issue (billable ÷ (1 − shrinkage)).
   */
  greigeIssueQty?: number | null;
  /** PROCESSING rows only — the shrinkage % linking greigeIssueQty and quantity. */
  shrinkagePercent?: number | null;
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
    /** Phase 4c: null for PROCESSING requirements — those produce a Job Work Order only */
    purchaseOrder: {
      id: string;
      poNumber: string;
      totalAmount: number;
    } | null;
    jobWorkOrder?: {
      id: string;
      jobWorkNumber: string;
      totalAmount: number;
    };
    linkedRequirements: number;
    totalItems: number;
    jobWorkNumber?: string;
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
  // P5.1: GRN tracking fields
  receivedCount?: number;
  totalPOCount?: number;
}

export interface MRPDashboardStats {
  totalPendingRequirements: number;
  totalShortfall: number;
  requirementsNeedingPO: number;
  poInProgress: number;
  awaitingReceipt: number;
  overdueRequirements: number;
  processingRequirementsCount: number;
  /** PROCESSING rows still awaiting a processor/JWO (PENDING, PO_REQUIRED, PARTIAL_STOCK). */
  processingNeedingAssignment: number;
  /** PROCESSING rows whose Job Work Order exists (PO_GENERATED, PO_SENT). */
  processingPoGenerated: number;
  /** Σ billable fabric-out qty × rate over open PROCESSING rows (Est. Service Cost tile). */
  processingEstimatedCost?: number;
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
