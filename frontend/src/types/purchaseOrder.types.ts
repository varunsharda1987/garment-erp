/**
 * Purchase Order Types
 * Frontend type definitions for purchase order management
 */

// ============================================
// ENUMS
// ============================================

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type PurchaseOrderStatus = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];

export const PurchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACKNOWLEDGED: 'Acknowledged',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export const PurchaseOrderStatusColors: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const Unit = {
  PCS: 'PCS',
  METERS: 'METERS',
  YARDS: 'YARDS',
  KGS: 'KGS',
  GRAMS: 'GRAMS',
  ROLLS: 'ROLLS',
  SETS: 'SETS',
  DOZENS: 'DOZENS',
  GROSS: 'GROSS',
  PAIRS: 'PAIRS',
  BOXES: 'BOXES',
  CONES: 'CONES',
  SPOOLS: 'SPOOLS',
  LITERS: 'LITERS',
} as const;

export type Unit = typeof Unit[keyof typeof Unit];

// ============================================
// SUPPLIER SUMMARY
// ============================================

export interface SupplierSummary {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
}

// ============================================
// MATERIAL SUMMARY
// ============================================

export interface MaterialSummary {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string | null;
}

// ============================================
// USER SUMMARY
// ============================================

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ============================================
// PURCHASE ORDER ITEM
// ============================================

export interface PurchaseOrderItem {
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
// GRN SUMMARY (for PO Detail)
// ============================================

export interface GRNSummary {
  id: string;
  grnNumber: string;
  receivingDate: string;
  warehouseId: string | null;
  warehouseName: string | null;
  totalReceived: number;
  status: string;
}

// ============================================
// PURCHASE ORDER
// ============================================

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  poDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  totalAmount: number | null;
  paymentTerms: string | null;
  remarks: string | null;
  createdById: string;
  approvedById: string | null;
  createdAt: string;

  // Relations
  suppliers?: SupplierSummary;
  purchase_order_items?: PurchaseOrderItem[];
  users_purchase_orders_createdByIdTousers?: UserSummary;
  users_purchase_orders_approvedByIdTousers?: UserSummary | null;
  goods_receiving_notes?: Array<{
    id: string;
    grnNumber: string;
    receivingDate: string;
    status: string;
    grn_items?: Array<{
      receivedQuantity: number;
      acceptedQuantity: number;
    }>;
  }>;

  // Computed
  itemCount?: number;
}

// ============================================
// CREATE/UPDATE REQUEST TYPES
// ============================================

export interface CreatePurchaseOrderItemRequest {
  materialId: string;
  orderedQuantity: number;
  unit: Unit;
  unitPrice: number;
  remarks?: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  expectedDeliveryDate: string;
  paymentTerms?: string;
  remarks?: string;
  items: CreatePurchaseOrderItemRequest[];
}

export interface UpdatePurchaseOrderRequest {
  supplierId?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  remarks?: string;
}

export interface UpdatePurchaseOrderItemRequest {
  orderedQuantity?: number;
  unit?: Unit;
  unitPrice?: number;
  remarks?: string;
}

// ============================================
// STATUS ACTIONS
// ============================================

export interface CancelPurchaseOrderRequest {
  reason: string;
}

// ============================================
// FILTER TYPES
// ============================================

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PurchaseOrderListResponse {
  success: boolean;
  data: PurchaseOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PurchaseOrderResponse {
  success: boolean;
  data: PurchaseOrder;
  message?: string;
}

export interface PurchaseOrderItemResponse {
  success: boolean;
  data: PurchaseOrderItem;
  message?: string;
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
  receivedQuantity: number;
  pendingQuantity: number;
  unitPrice: number;
}

export interface PendingItemsResponse {
  success: boolean;
  data: PendingPOItem[];
}

// ============================================
// FORM TYPES
// ============================================

export interface PurchaseOrderFormValues {
  supplierId: string;
  expectedDeliveryDate: string;
  paymentTerms: string;
  remarks: string;
  items: Array<{
    materialId: string;
    orderedQuantity: number | string;
    unit: Unit;
    unitPrice: number | string;
    remarks: string;
  }>;
}

// ============================================
// TABLE/LIST TYPES
// ============================================

export interface PurchaseOrderTableRow extends PurchaseOrder {
  supplierName: string;
  supplierCode: string;
  totalItems: number;
}

// Computed helpers for display
export const getSupplierDisplayName = (supplier: SupplierSummary | undefined): string =>
  supplier?.name || 'Unknown';

export const getSupplierDisplayCode = (supplier: SupplierSummary | undefined): string =>
  supplier?.code || '';
