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
} as const;

export type GRNStatus = typeof GRNStatus[keyof typeof GRNStatus];

export const GRNStatusLabels: Record<GRNStatus, string> = {
  PENDING_QC: 'Pending QC',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  PARTIALLY_ACCEPTED: 'Partially Accepted',
};

export const GRNStatusColors: Record<GRNStatus, string> = {
  PENDING_QC: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PARTIALLY_ACCEPTED: 'bg-orange-100 text-orange-800',
};

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
  materials?: MaterialSummary;
  purchaseOrderItem?: POItemSummary;  // RELATION_MAPPINGS: purchaseOrderItems → items (but nested singular)
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
  supplier?: SupplierSummary;
  items?: GRNItem[];
  receivedBy?: UserSummary;
  approvedBy?: UserSummary | null;

  // Computed
  itemCount?: number;
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
}

export interface PendingItemsResponse {
  success: boolean;
  data: PendingPOItem[];
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
  }>;
}
