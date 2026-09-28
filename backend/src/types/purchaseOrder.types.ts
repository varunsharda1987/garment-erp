/**
 * Purchase Order Types
 * Type definitions for purchase order operations
 */

import {
  PurchaseOrderStatus,
  Unit,
  POSource,
  DeliveryLocationType,
  POCategory,
  ThreadPackagingType,
  ThreadPly,
} from '@prisma/client';
import { toDateInputValue } from '../utils/date';

// Re-export Prisma types for use in controllers
export { PurchaseOrderStatus, POSource };

/**
 * Material PO categories — the only categories the Purchase Orders page shows (its Material tab,
 * its category filter, the PO form's category picker) and counts (/stats), per the Job Work
 * Consolidation decision (2026-08-09). Processing/service work lives in Job Work Orders.
 *
 * The frontend keeps its own copy (MATERIAL_PO_CATEGORIES in frontend/src/types/purchaseOrder.types.ts);
 * `__tests__/unit/po-material-categories.test.ts` fails when the two differ. THREAD was missing here
 * until 2026-09-27, so a thread PO would have been listed but never counted on the stat cards.
 * MACHINE_PART joined 2026-09-28 — one category per supplier category, so machine-part suppliers can be
 * picked at all (General last). ACCESSORIES (2026-09-28) = a style's labels + packaging, as the Style Form's
 * Accessories tab defines them — one meaning system-wide, so Trims no longer takes them and PACKAGING left
 * the page (it is still creatable by API, for history). Which materials each takes:
 * helpers/po-line-category.helper.ts.
 */
export const MATERIAL_PO_CATEGORIES: POCategory[] = [
  POCategory.FABRIC,
  POCategory.GREIGE,
  POCategory.TRIMS,
  POCategory.ACCESSORIES,
  POCategory.THREAD,
  POCategory.LACE,
  POCategory.GREIGE_LACE,
  POCategory.MACHINE_PART,
  POCategory.GENERAL,
];

/**
 * Every category a purchase order may be CREATED with (manual form, API, MRP): the page's material
 * categories plus the specific ones the schema still carries (PACKAGING, and the per-trim ones).
 * Materials only — Phase 5a retired service/processing POs. ManualPOCategoryEnum and unified PO
 * creation both read this list.
 */
export const CREATABLE_PO_CATEGORIES: POCategory[] = [
  ...MATERIAL_PO_CATEGORIES,
  POCategory.PACKAGING,
  POCategory.BUTTON,
  POCategory.ZIPPER,
  POCategory.ELASTIC,
  POCategory.LABEL,
  POCategory.OTHER_MATERIAL,
];

/** The columns GET /purchase-orders may sort by (anything else used to reach Prisma and 400). */
export const PO_SORT_FIELDS = ['createdAt', 'poDate', 'poNumber', 'expectedDeliveryDate', 'totalAmount'] as const;
export type PurchaseOrderSortField = (typeof PO_SORT_FIELDS)[number];

/**
 * The PO date is settable (owner decision 2026-09-27): today by default, a past date allowed (a PO
 * typed in after the order was placed by phone), never a future one. Compared as IST calendar days.
 */
export function isPoDateAfterToday(poDate: Date | string): boolean {
  return toDateInputValue(poDate) > toDateInputValue(new Date());
}

/**
 * Goods cannot be due before the order was placed (2026-09-28: 8 of 13 POs had it so). The same day is
 * fine. Compared as IST calendar days, like the PO date itself.
 */
export function isDeliveryBeforePoDate(expectedDeliveryDate: Date | string, poDate: Date | string): boolean {
  return toDateInputValue(expectedDeliveryDate) < toDateInputValue(poDate);
}

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
  weaverId?: string | null; // Phase 1b: the weaver this line is bought from, when known at ordering
  /** A thread line's pack — CONE (2- or 3-ply) or TUBE (3-ply); the server sets the box size from it */
  threadPackagingType?: ThreadPackagingType | null;
  threadPly?: ThreadPly | null;
  /**
   * The line's GST % as typed on the form (0 is a rate). Sent = the line's rate; absent / null = the
   * material's (its own rate, else its HSN's). 2026-09-28: the form's GST box used to be never sent.
   */
  gstRate?: number | null;
  /** The HSN the line is billed under; absent / blank = the material's own HSN */
  hsnCode?: string | null;
  /**
   * Split delivery (2026-09-26): how much of this line goes to each place. Absent on every line = one
   * place (the header's deliveryLocationId) or "to be advised". po-delivery-plan.helper builds the plan.
   */
  deliveries?: Array<{ warehouseId: string; quantity: number }> | null;
}

/**
 * DTO for updating a purchase order item
 */
export interface UpdatePurchaseOrderItemDTO {
  orderedQuantity?: number;
  unit?: Unit;
  unitPrice?: number;
  remarks?: string | null;
  threadPackagingType?: ThreadPackagingType | null;
  threadPly?: ThreadPly | null;
  /** Absent = the line keeps the rate it was saved with; null = back to the material's rate */
  gstRate?: number | null;
  /** Absent = the line keeps its HSN; null / blank = the material's own HSN */
  hsnCode?: string | null;
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
  /** The PO's own date — omitted = now. Never after today (isPoDateAfterToday). */
  poDate?: Date | string;
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
  /** The PO's own date — omitted = unchanged. Never after today (isPoDateAfterToday). */
  poDate?: Date | string;
  paymentTerms?: string | null;
  /** null or '' clears it; absent leaves it */
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
  /** ADMIN only: cancel a PO that has already received goods (Close Short is the normal exit) */
  force?: boolean;
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
  poCategories?: POCategory[];
  supplierId?: string;
  /** The order the PO buys for — its own orderId, or any requirement link back to that order */
  orderId?: string;
  serviceWorkOrderId?: string;
  /** 'TO_BE_ADVISED' = no delivery place yet */
  delivery?: 'TO_BE_ADVISED';
  search?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  page?: number;
  limit?: number;
  sortBy?: PurchaseOrderSortField;
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
