/**
 * GRN (Goods Receiving Notes) Types
 * Frontend type definitions for goods receiving management
 */

import { Unit } from './purchaseOrder.types';

// ============================================
// ENUMS
// ============================================

export const GRNStatus = {
  PENDING_QC: 'PENDING_QC',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  PARTIALLY_ACCEPTED: 'PARTIALLY_ACCEPTED',
  REVERSED: 'REVERSED',
} as const;

export type GRNStatus = (typeof GRNStatus)[keyof typeof GRNStatus];

export const GRNStatusLabels: Record<GRNStatus, string> = {
  PENDING_QC: 'Pending QC',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  PARTIALLY_ACCEPTED: 'Partially Accepted',
  REVERSED: 'Reversed',
};

export const GRNStatusColors: Record<GRNStatus, string> = {
  PENDING_QC: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-success-muted text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
  PARTIALLY_ACCEPTED: 'bg-orange-100 text-orange-800',
  REVERSED: 'bg-muted text-muted-foreground',
};

export type GRNEntryMode = 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';

// ============================================
// SUMMARY TYPES
// ============================================

export interface MaterialSummary {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string | null;
}

export interface POItemSummary {
  id: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: Unit;
  unitPrice: number;
}

export interface POSummary {
  id: string;
  poNumber: string;
  supplierId: string;
  poDate?: string;
  expectedDeliveryDate: string;
  status: string;
  poCategory?: string;
}

export interface SupplierSummary {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface WarehouseSummary {
  id: string;
  warehouseCode: string;
  warehouseName: string;
}

// ============================================
// GRN ITEM DETAIL (than/roll breakdown)
// ============================================

export interface GRNItemDetail {
  id: string;
  grnItemId: string;
  detailType: 'THAN' | 'ROLL';
  baleNumber: number | null;
  sequenceNo: number;
  /** The bale number PRINTED on the supplier's bale (e.g. "417"). baleNumber is only our 1,2,3 grouping. */
  baleNo?: string | null;
  /** The tag number on the than / roll. sequenceNo is only its order. */
  thanNo?: string | null;
  meters: number;
  remarks: string | null;
}

export interface GRNItemDetailRequest {
  detailType: 'THAN' | 'ROLL';
  baleNumber?: number | null;
  sequenceNo: number;
  baleNo?: string | null;
  thanNo?: string | null;
  meters: number;
  remarks?: string | null;
}

/** PATCH /grn/items/:itemId/detail-labels — printed bale / than numbers only, never quantities. */
export interface GRNDetailLabelsRequest {
  details: Array<{ id: string; baleNo?: string | null; thanNo?: string | null }>;
}

// ============================================
// GRN ITEM
// ============================================

export interface GRNItem {
  id: string;
  grnId: string;
  poItemId: string;
  materialId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: Unit;
  remarks: string | null;
  componentName?: string | null;
  colorName?: string | null;
  // Measurement fields
  foldLengthCm: number | null;
  receivedWidthInches: number | null;
  entryMode: GRNEntryMode | null;
  baleCount: number | null;
  thanCount: number | null;
  rollCount: number | null;
  totalMeters: number | null;
  isOverReceipt: boolean;
  overReceiptQty: number | null;
  // Source mismatch override fields (greige→ready fabric scenario)
  receivedAsReadyFabric: boolean;
  actualRatePerUnit: number | null;
  updateFutureSourcing: boolean;
  /** ACTUAL accepted metres — the counted figure × L/100 when foldLengthCm is set (what went to stock) */
  actualQuantity?: number | null;
  /** List and detail — per-unit rate the line is valued at (override › PO price › processor's charge); null = unpriced */
  rate?: number | null;
  /** List and detail — ACTUAL accepted qty × rate */
  value?: number | null;
  // Relations
  materials?: MaterialSummary;
  purchaseOrderItem?: POItemSummary;
  grnItemDetails?: GRNItemDetail[];
}

// ============================================
// GRN
// ============================================

export interface GRN {
  id: string;
  grnNumber: string;
  poId: string;
  supplierId: string;
  warehouseId?: string | null;
  receivingDate: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  status: GRNStatus;
  remarks: string | null;
  receivedById: string;
  approvedById: string | null;
  createdAt: string;

  // Relations (post-serializer names — serializer outputs 'purchaseOrders' for this relation)
  purchaseOrders?: POSummary;
  /** Set on a GRN raised against a job work order (no purchase order) — processed fabric/lace coming back. */
  jobWorkOrderId?: string | null;
  jobWorkOrder?: {
    id: string;
    jobWorkNumber: string;
    processType?: string;
    sentDate?: string | null;
    agreedRatePerMeter?: number;
    processTypeMaster?: { name: string; code: string } | null;
  } | null;
  supplier?: SupplierSummary;
  warehouse?: WarehouseSummary;
  items?: GRNItem[];
  receivedBy?: UserSummary;
  approvedBy?: UserSummary | null;
  /** Split delivery: the PO's planned place this receipt delivered against (warehouse = where it was booked) */
  poDeliveryPointId?: string | null;
  deliveryPoint?: { id: string; sequence: number; warehouse: { id: string; warehouseName: string } } | null;
  /** Goods booked at a processor's unit: the Rule 45 job-work challan raised for them */
  directSupplyChallans?: Array<{
    id: string;
    challanNumber: string;
    status: string;
    issuedDate: string | null;
    toName: string | null;
  }>;
  /** Create only — soft split-delivery warnings (over a place's plan, or booked away from it) */
  deliveryWarnings?: string[];

  // Computed
  itemCount?: number;
  /** List only — what the receipt is worth (Σ line values; a job-work return = the processor's charge). null = a line has no price */
  totalValue?: number | null;
}

// ============================================
// CREATE/UPDATE REQUEST TYPES
// ============================================

export interface CreateGRNItemRequest {
  poItemId: string;
  materialId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: Unit;
  rejectionReason?: string;
  remarks?: string;
  // Per-item measurement fields (FABRIC & GREIGE)
  foldLengthCm?: number | null;
  receivedWidthInches?: number | null;
  entryMode?: GRNEntryMode | null;
  details?: GRNItemDetailRequest[];
  // Source mismatch override fields (greige→ready fabric scenario)
  receivedAsReadyFabric?: boolean; // Override: treat greige PO item as ready fabric
  actualRatePerUnit?: number | null; // Actual rate received (may differ from PO rate)
  updateFutureSourcing?: boolean; // true = permanent change, false = one-time exception (default)
  // Phase 1b: the weaver whose cloth arrived (pre-filled from the PO line), or "not known"
  weaverId?: string | null;
  weaverNotKnown?: boolean;
}

export interface ProcessingReceiveData {
  qtyReceivedMeters?: number;
  receivedWidthInches: number;
  thanCount?: number;
  foldLengthCm?: number;
  receivedChallan?: string;
}

export interface ProcessingQCData {
  qualityGrade: string;
  colorMatchStatus?: string;
  defectMeters?: number;
  defectType?: string;
  actualRate?: number;
  remarks?: string;
}

export interface ProcessingContext {
  jobId: string;
  processType: string;
  qtySentMeters: number;
  sentWidthInches: number;
  sentDate: string | null;
  expectedReturnDate: string | null;
  styleName: string;
  styleCode: string;
  fabricName: string;
  fabricCode: string;
  millName: string;
  agreedRate: number;
  greigeStockLotId: string | null;
  status: string;
  receivedDate: string | null;
}

export interface CreateGRNRequest {
  poId: string;
  warehouseId?: string;
  /** Required on a split PO: which of its places this delivery is against */
  poDeliveryPointId?: string | null;
  receivingDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  transportDetails?: string;
  remarks?: string;
  items: CreateGRNItemRequest[];
  processingData?: ProcessingReceiveData;
}

export interface RejectGRNRequest {
  reason: string;
}

// ============================================
// FILTER TYPES
// ============================================

export interface GRNFilters {
  poId?: string;
  poNumber?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: GRNStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// PENDING ITEMS (for GRN creation)
// ============================================

export interface PendingPOItem {
  poItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: Unit;
  orderedQuantity: number;
  totalReceivedQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
  /** The PO line's fold length — pre-fills the GRN line's L. PO quantities are actual metres. */
  foldLengthCm?: number | null;
  /** The PO line's weaver — pre-fills the GRN line's weaver (Phase 1b). */
  weaverId?: string | null;
  weaverName?: string | null;
  /** Greige / ready fabric: the receipt must name the weaver or tick "Weaver not known". */
  needsWeaver?: boolean;
}

export interface PendingItemsResponse {
  success: boolean;
  data: PendingPOItem[];
  tolerancePercent?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface GRNListResponse {
  success: boolean;
  data: GRN[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GRNResponse {
  success: boolean;
  data: GRN;
  message?: string;
}

export interface ReceivingSummary {
  success: boolean;
  data: {
    totalReceived: number;
    grnCount: number;
    byWarehouse: Array<{
      warehouseId: string;
      warehouseName: string;
      totalReceived: number;
      grnCount: number;
    }>;
  };
}

// ============================================
// FORM TYPES
// ============================================

export interface GRNFormValues {
  poId: string;
  warehouseId: string;
  receivingDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  remarks: string;
  items: Array<{
    poItemId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unit: Unit;
    orderedQuantity: number;
    pendingQuantity: number;
    receivedQuantity: number | string;
    acceptedQuantity: number | string;
    rejectedQuantity: number | string;
    rejectionReason: string;
    remarks: string;
    // Source mismatch override fields (greige→ready fabric scenario)
    receivedAsReadyFabric?: boolean;
    actualRatePerUnit?: number | string;
    updateFutureSourcing?: boolean;
  }>;
}
