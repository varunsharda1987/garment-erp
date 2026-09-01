/**
 * Purchase Order Types
 * Type definitions for purchase order operations
 */

import { PurchaseOrderStatus, Unit, POSource, DeliveryLocationType, POCategory } from '@prisma/client';

// Re-export Prisma types for use in controllers
export { PurchaseOrderStatus, POSource };

/**
 * Material PO categories — the only categories the Purchase Orders page shows/creates
 * per the Job Work Consolidation decision (2026-08-09). Processing/service work lives in
 * Job Work Orders. Mirror of PO_GROUP_CATEGORIES.material in
 * frontend/src/types/purchaseOrder.types.ts — keep the two lists in sync.
 */
export const MATERIAL_PO_CATEGORIES: POCategory[] = [
  POCategory.FABRIC,
  POCategory.GREIGE,
  POCategory.TRIMS,
  POCategory.LACE,
  POCategory.GREIGE_LACE,
  POCategory.GENERAL,
];

// ============================================
// Purchase Order Item Types
// ============================================

/**
 * DTO for creating a purchase order item
 */
export interface PurchaseOrderItemDTO {
  /**
   * Existing PO item id, sent ONLY on update. It is how the server recognises a line as the same
   * line and updates it in place; without it the line is rebuilt with a new uuid and every
   * cascading link (requirement_po_links, service_requirement_po_links, po_source_links,
   * order_thread_requirements.poItemId) is destroyed with it.
   */
  id?: string;
  materialId?: string; // Required for material POs
  serviceType?: string; // Required for service/processing POs (ServiceType enum)
  serviceDescription?: string; // Optional description for service POs
  orderedQuantity: number;
  unit: Unit;
  unitPrice: number;
  remarks?: string | null;
  foldLengthCm?: number | null; // "L" - fold length in cm (for greige/fabric)
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
  poCategory?: string; // POCategory enum value
  items: PurchaseOrderItemDTO[];
  // Optional traceability links (for Manual POs)
  styleId?: string | null;
  orderId?: string | null;
  cadId?: string | null;
  // Delivery location (warehouse ID - type is derived from warehouse)
  deliveryLocationId?: string | null;
}

/**
 * DTO for updating a purchase order
 * Items array, if provided, replaces all existing items
 */
export interface UpdatePurchaseOrderDTO {
  supplierId?: string;
  expectedDeliveryDate?: Date | string;
  paymentTerms?: string | null;
  remarks?: string | null;
  items?: PurchaseOrderItemDTO[]; // If provided, replaces all existing items
  // Optional traceability links (for Manual POs)
  styleId?: string | null;
  orderId?: string | null;
  cadId?: string | null;
  // Delivery location (warehouse ID - type is derived from warehouse)
  deliveryLocationId?: string | null;
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
  source?: POSource;
  poCategories?: string[];
  supplierId?: string;
  orderId?: string;
  serviceWorkOrderId?: string;
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
 * Reference copy of the PO transition table. `utils/stateMachine.ts` is the AUTHORITY — it is what
 * validateTransition consults, and it carries the ADMIN override. Keep this list identical to
 * stateMachine.purchaseOrder; nothing may branch on this one alone.
 */
export const PO_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  ACKNOWLEDGED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  // CANCELLED deliberately absent once goods have been delivered — the honest exit is SHORT_CLOSED.
  PARTIALLY_RECEIVED: ['RECEIVED', 'SHORT_CLOSED'],
  RECEIVED: [], // Terminal state
  SHORT_CLOSED: [], // Terminal state — delivered less than ordered, closed on purpose
  CANCELLED: [], // Terminal state
  PENDING_GREIGE: ['READY_FOR_PROCESSING', 'CANCELLED'], // Processing PO waiting for greige
  READY_FOR_PROCESSING: ['SENT', 'CANCELLED'], // Greige received, ready to send to processor
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(currentStatus: PurchaseOrderStatus, newStatus: PurchaseOrderStatus): boolean {
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
