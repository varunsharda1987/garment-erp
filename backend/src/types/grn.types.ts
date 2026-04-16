/**
 * GRN (Goods Receiving Notes) Types
 * Type definitions for goods receiving operations
 */

import { GRNStatus, Unit } from '@prisma/client';

// Re-export Prisma's GRNStatus for use in controllers
export { GRNStatus };

// ============================================
// GRN Entry Mode & Detail Types
// ============================================

export type GRNEntryMode = 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';

/**
 * Detail row for than/roll breakdown within a GRN item
 */
export interface GRNItemDetailDTO {
  detailType: 'THAN' | 'ROLL';
  baleNumber?: number | null; // For bale-wise grouping (1, 2, 3...)
  sequenceNo: number;
  meters: number;
  remarks?: string | null;
}

/**
 * Detail row response (includes id)
 */
export interface GRNItemDetailResponse {
  id: string;
  grnItemId: string;
  detailType: string;
  baleNumber: number | null;
  sequenceNo: number;
  meters: number;
  remarks: string | null;
}

// ============================================
// GRN Item Types
// ============================================

/**
 * DTO for creating a GRN item
 */
export interface GRNItemDTO {
  poItemId: string;
  materialId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: Unit;
  rejectionReason?: string | null;
  remarks?: string | null;
  // Per-item measurement fields
  foldLengthCm?: number | null;
  receivedWidthInches?: number | null;
  entryMode?: GRNEntryMode | null;
  details?: GRNItemDetailDTO[];
  // Source mismatch override fields (greige→ready fabric scenario)
  receivedAsReadyFabric?: boolean; // Override: treat greige PO item as ready fabric
  actualRatePerUnit?: number | null; // Actual rate received (may differ from PO rate)
  updateFutureSourcing?: boolean; // true = permanent change, false = one-time exception
}

/**
 * GRN item with computed fields
 */
export interface GRNItemResponse {
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
  // Measurement fields
  foldLengthCm: number | null;
  receivedWidthInches: number | null;
  entryMode: string | null;
  baleCount: number | null;
  thanCount: number | null;
  rollCount: number | null;
  totalMeters: number | null;
  isOverReceipt: boolean;
  overReceiptQty: number | null;
  // Source mismatch override fields
  receivedAsReadyFabric: boolean;
  actualRatePerUnit: number | null;
  updateFutureSourcing: boolean;
  // Relations
  materials?: MaterialSummary;
  purchase_order_items?: POItemSummary;
  grn_item_details?: GRNItemDetailResponse[];
}

// ============================================
// GRN Types
// ============================================

/**
 * DTO for creating a GRN
 */
export interface CreateGRNDTO {
  poId: string;
  warehouseId?: string | null; // Optional for now since schema doesn't have it yet
  receivingDate?: Date | string;
  invoiceNumber?: string | null;
  invoiceDate?: Date | string | null;
  transportDetails?: string | null;
  remarks?: string | null;
  items: GRNItemDTO[];
  processingData?: ProcessingReceiveData;
}

/**
 * Processing-specific receive data (for PROCESSING PO GRNs)
 */
export interface ProcessingReceiveData {
  qtyReceivedMeters?: number;
  receivedWidthInches: number;
  thanCount?: number;
  foldLengthCm?: number;
  receivedChallan?: string;
}

/**
 * Processing-specific QC data (for PROCESSING PO GRN approval)
 */
export interface ProcessingQCData {
  qualityGrade: string; // 'A' | 'B' | 'Reject'
  colorMatchStatus?: string; // 'Match' | 'Slight Variation' | 'Mismatch'
  defectMeters?: number;
  defectType?: string;
  actualRate?: number;
  remarks?: string;
}

/**
 * DTO for approving a GRN
 */
export interface ApproveGRNDTO {
  remarks?: string;
  processingQC?: ProcessingQCData;
}

/**
 * DTO for rejecting a GRN
 */
export interface RejectGRNDTO {
  reason: string;
}

// ============================================
// Query & Filter Types
// ============================================

/**
 * Filters for listing GRNs
 */
export interface GRNFilters {
  poId?: string;
  poNumber?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: GRNStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Summary Types (for relations)
// ============================================

/**
 * Material summary for GRN item responses
 */
export interface MaterialSummary {
  id: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  unit: string | null;
}

/**
 * PO item summary for GRN item responses
 */
export interface POItemSummary {
  id: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: Unit;
  unitPrice: number;
}

/**
 * PO summary for GRN responses
 */
export interface POSummary {
  id: string;
  poNumber: string;
  supplierId: string;
  expectedDeliveryDate: Date;
  status: string;
}

/**
 * Supplier summary for GRN responses
 */
export interface SupplierSummary {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string | null;
}

/**
 * User summary for audit fields
 */
export interface UserSummary {
  id: string;
  username: string;
  email: string;
}

/**
 * Warehouse summary
 */
export interface WarehouseSummary {
  id: string;
  warehouseCode: string;
  warehouseName: string;
}

// ============================================
// Response Types
// ============================================

/**
 * GRN list item (compact for lists)
 */
export interface GRNListItem {
  id: string;
  grnNumber: string;
  poId: string;
  supplierId: string;
  receivingDate: Date;
  invoiceNumber: string | null;
  status: GRNStatus;
  purchase_orders?: POSummary;
  suppliers?: SupplierSummary;
  itemCount: number;
}

/**
 * Full GRN response with all relations
 */
export interface GRNResponse {
  id: string;
  grnNumber: string;
  poId: string;
  supplierId: string;
  receivingDate: Date;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  status: GRNStatus;
  remarks: string | null;
  receivedById: string;
  approvedById: string | null;
  createdAt: Date;
  // Relations
  purchase_orders?: POSummary;
  suppliers?: SupplierSummary;
  grn_items?: GRNItemResponse[];
  users_goods_receiving_notes_receivedByIdTousers?: UserSummary;
  users_goods_receiving_notes_approvedByIdTousers?: UserSummary | null;
}

// ============================================
// Pending Items Types (for GRN creation)
// ============================================

/**
 * Pending item info for GRN form
 */
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
  receivedByWarehouse?: WarehouseReceiptSummary[];
}

/**
 * Receipt summary by warehouse
 */
export interface WarehouseReceiptSummary {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

/**
 * Receiving summary by warehouse for PO detail
 */
export interface ReceivingSummaryByWarehouse {
  warehouseId: string;
  warehouseName: string;
  totalReceived: number;
  grnCount: number;
}

// ============================================
// Pagination Types
// ============================================

/**
 * Paginated response for GRNs
 */
export interface PaginatedGRNsResponse {
  data: GRNListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Error Response Types
// ============================================

/**
 * Error response structure
 */
export interface GRNErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}
