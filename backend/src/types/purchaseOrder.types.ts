/**
 * Purchase Order Types
 * Type definitions for purchase order operations
 */

import { PurchaseOrderStatus, Unit } from '@prisma/client';

// Re-export Prisma's PurchaseOrderStatus for use in controllers
export { PurchaseOrderStatus };

// ============================================
// Purchase Order Item Types
// ============================================

/**
 * DTO for creating a purchase order item
 */
export interface PurchaseOrderItemDTO {
  materialId: string;
  orderedQuantity: number;
  unit: Unit;
  unitPrice: number;
  remarks?: string | null;
}

/**
 * DTO for updating a purchase order item
 */
export interface UpdatePurchaseOrderItemDTO {
  orderedQuantity?: number;
  unit?: Unit;
  unitPrice?: number;
  remarks?: string | null;
}

/**
 * Purchase order item with computed fields
 */
export interface PurchaseOrderItemResponse {
  id: string;
  poId: string;
  materialId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: Unit;
  unitPrice: number;
  totalPrice: number;
  remarks: string | null;
  materials?: MaterialSummary;
}

// ============================================
// Purchase Order Types
// ============================================

/**
 * DTO for creating a purchase order
 */
export interface CreatePurchaseOrderDTO {
  supplierId: string;
  expectedDeliveryDate: Date | string;
  paymentTerms?: string | null;
  remarks?: string | null;
  items: PurchaseOrderItemDTO[];
}

/**
 * DTO for updating a purchase order
 */
export interface UpdatePurchaseOrderDTO {
  supplierId?: string;
  expectedDeliveryDate?: Date | string;
  paymentTerms?: string | null;
  remarks?: string | null;
}

/**
 * DTO for submitting PO for approval
 */
export interface SubmitForApprovalDTO {
  remarks?: string;
}

/**
 * DTO for approving a PO
 */
export interface ApprovePurchaseOrderDTO {
  remarks?: string;
}

/**
 * DTO for rejecting a PO
 */
export interface RejectPurchaseOrderDTO {
  reason: string;
}

/**
 * DTO for cancelling a PO
 */
export interface CancelPurchaseOrderDTO {
  reason: string;
}

// ============================================
// Query & Filter Types
// ============================================

/**
 * Filters for listing purchase orders
 */
export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  search?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Summary Types (for relations)
// ============================================

/**
 * Supplier summary for PO responses
 */
export interface SupplierSummary {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
}

/**
 * Material summary for PO item responses
 */
export interface MaterialSummary {
  id: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  unit: string | null;
}

/**
 * User summary for audit fields
 */
export interface UserSummary {
  id: string;
  username: string;
  email: string;
}

// ============================================
// Response Types
// ============================================

/**
 * Purchase order list item (compact for lists)
 */
export interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  supplierId: string;
  poDate: Date;
  expectedDeliveryDate: Date;
  status: PurchaseOrderStatus;
  totalAmount: number | null;
  paymentTerms: string | null;
  suppliers: SupplierSummary;
  itemCount: number;
}

/**
 * Full purchase order response with all relations
 */
export interface PurchaseOrderResponse {
  id: string;
  poNumber: string;
  supplierId: string;
  poDate: Date;
  expectedDeliveryDate: Date;
  status: PurchaseOrderStatus;
  totalAmount: number | null;
  paymentTerms: string | null;
  remarks: string | null;
  createdById: string;
  approvedById: string | null;
  createdAt: Date;
  // Relations
  suppliers: SupplierSummary;
  purchase_order_items: PurchaseOrderItemResponse[];
  users_purchase_orders_createdByIdTousers?: UserSummary;
  users_purchase_orders_approvedByIdTousers?: UserSummary | null;
  // Computed fields
  receivingHistory?: GRNSummary[];
}

/**
 * GRN summary for PO detail view
 */
export interface GRNSummary {
  id: string;
  grnNumber: string;
  receivingDate: Date;
  warehouseId: string | null;
  warehouseName: string | null;
  totalReceived: number;
  status: string;
}

/**
 * Receiving summary by warehouse
 */
export interface ReceivingSummaryByWarehouse {
  warehouseId: string;
  warehouseName: string;
  totalReceived: number;
  grnCount: number;
}

// ============================================
// Status Transition Types
// ============================================

/**
 * Valid status transitions for purchase orders
 * Note: The schema has DRAFT, SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
 * We'll add PENDING_APPROVAL and APPROVED as intermediate states if needed,
 * or handle approval workflow separately with approvedById
 */
export const PO_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['ACKNOWLEDGED', 'CANCELLED'],
  ACKNOWLEDGED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: PurchaseOrderStatus,
  newStatus: PurchaseOrderStatus
): boolean {
  return PO_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ============================================
// Pagination Types
// ============================================

/**
 * Paginated response for purchase orders
 */
export interface PaginatedPurchaseOrdersResponse {
  data: PurchaseOrderListItem[];
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
export interface PurchaseOrderErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}
