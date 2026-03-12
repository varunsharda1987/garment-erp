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
  PENDING_GREIGE: 'PENDING_GREIGE',
  READY_FOR_PROCESSING: 'READY_FOR_PROCESSING',
} as const;

export type PurchaseOrderStatus = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];

export const PurchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACKNOWLEDGED: 'Acknowledged',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
  PENDING_GREIGE: 'Pending Greige',
  READY_FOR_PROCESSING: 'Ready for Processing',
};

export const PurchaseOrderStatusColors: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  PENDING_GREIGE: 'bg-orange-100 text-orange-800',
  READY_FOR_PROCESSING: 'bg-cyan-100 text-cyan-800',
};

// ============================================
// PO SOURCE ENUM
// ============================================

export const POSource = {
  MANUAL: 'MANUAL',
  COST_SHEET: 'COST_SHEET',
  MRP: 'MRP',
  SERVICE_REQUIREMENT: 'SERVICE_REQUIREMENT',
  PRODUCTION_RUN: 'PRODUCTION_RUN',
} as const;

export type POSource = typeof POSource[keyof typeof POSource];

export const POSourceLabels: Record<POSource, string> = {
  MANUAL: 'Manual',
  COST_SHEET: 'Cost Sheet',
  MRP: 'MRP',
  SERVICE_REQUIREMENT: 'Service',
  PRODUCTION_RUN: 'Production Run',
};

export const POSourceColors: Record<POSource, string> = {
  MANUAL: 'bg-gray-100 text-gray-800',
  COST_SHEET: 'bg-purple-100 text-purple-800',
  MRP: 'bg-blue-100 text-blue-800',
  SERVICE_REQUIREMENT: 'bg-teal-100 text-teal-800',
  PRODUCTION_RUN: 'bg-orange-100 text-orange-800',
};

// ============================================
// PO GROUP / CATEGORY TYPES
// ============================================

export type POGroup = 'all' | 'material' | 'processing' | 'service';

export const PO_GROUP_CATEGORIES: Record<Exclude<POGroup, 'all'>, string[]> = {
  material: ['FABRIC', 'GREIGE', 'TRIMS', 'LACE', 'GREIGE_LACE', 'GENERAL'],
  processing: ['PROCESSING', 'LACE_PROCESSING'],
  service: [
    'EMBROIDERY_SERVICE',
    'WASHING_SERVICE', 'FINISHING_SERVICE', 'CUTTING_SERVICE',
    'STITCHING_SERVICE', 'HANDWORK_SERVICE', 'SMOCKING_SERVICE',
    'TRANSPORTATION_SERVICE',
  ],
};

export const PO_GROUP_LABELS: Record<POGroup, string> = {
  all: 'All',
  material: 'Material',
  processing: 'Processing',
  service: 'Service',
};

export const PO_CATEGORY_LABELS: Record<string, string> = {
  FABRIC: 'Fabric',
  GREIGE: 'Greige',
  PROCESSING: 'Processing',
  TRIMS: 'Trims',
  LACE: 'Lace',
  GREIGE_LACE: 'Greige Lace',
  LACE_PROCESSING: 'Lace Processing',
  GENERAL: 'General',
  EMBROIDERY_SERVICE: 'Embroidery',
  WASHING_SERVICE: 'Washing',
  FINISHING_SERVICE: 'Finishing',
  CUTTING_SERVICE: 'Cutting',
  STITCHING_SERVICE: 'Stitching',
  HANDWORK_SERVICE: 'Handwork',
  SMOCKING_SERVICE: 'Smocking',
  TRANSPORTATION_SERVICE: 'Transport',
};

export const PO_CATEGORY_COLORS: Record<string, string> = {
  FABRIC: 'bg-blue-100 text-blue-800',
  GREIGE: 'bg-stone-100 text-stone-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  TRIMS: 'bg-cyan-100 text-cyan-800',
  LACE: 'bg-pink-100 text-pink-800',
  GREIGE_LACE: 'bg-amber-100 text-amber-800',
  LACE_PROCESSING: 'bg-violet-100 text-violet-800',
  GENERAL: 'bg-gray-100 text-gray-800',
  EMBROIDERY_SERVICE: 'bg-rose-100 text-rose-800',
  WASHING_SERVICE: 'bg-sky-100 text-sky-800',
  FINISHING_SERVICE: 'bg-emerald-100 text-emerald-800',
  CUTTING_SERVICE: 'bg-lime-100 text-lime-800',
  STITCHING_SERVICE: 'bg-fuchsia-100 text-fuchsia-800',
  HANDWORK_SERVICE: 'bg-yellow-100 text-yellow-800',
  SMOCKING_SERVICE: 'bg-indigo-100 text-indigo-800',
  TRANSPORTATION_SERVICE: 'bg-slate-100 text-slate-800',
};

// ============================================
// PO STATS (from /api/purchase-orders/stats)
// ============================================

export interface POStats {
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  totalValue: number;
}

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
  materialId: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: Unit;
  unitPrice: number;
  totalPrice: number;
  remarks: string | null;
  printingType?: string | null;
  // Service PO fields
  serviceType?: string | null;
  serviceDescription?: string | null;
  // GST fields
  hsnCode?: string | null;
  gstRate?: number | null;
  cgstRate?: number | null;
  cgstAmount?: number | null;
  sgstRate?: number | null;
  sgstAmount?: number | null;
  igstRate?: number | null;
  igstAmount?: number | null;
  taxAmount?: number | null;
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
  poSource: POSource | null;
  poCategory: string | null;
  totalAmount: number | null;
  subtotal?: number | null;
  totalCgst?: number | null;
  totalSgst?: number | null;
  totalIgst?: number | null;
  totalTax?: number | null;
  isInterstate?: boolean;
  paymentTerms: string | null;
  remarks: string | null;
  createdById: string;
  approvedById: string | null;
  createdAt: string;

  // Relations (post-serializer names — RELATION_MAPPINGS renames these)
  supplier?: SupplierSummary;
  items?: PurchaseOrderItem[];
  createdBy?: UserSummary;
  approvedBy?: UserSummary | null;
  goodsReceivingNotes?: Array<{
    id: string;
    grnNumber: string;
    receivingDate: string;
    status: string;
    items?: Array<{
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
  materialId?: string;            // Required for material POs
  serviceType?: string;           // Required for service/processing POs
  serviceDescription?: string;    // Optional description for service POs
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
  poCategory?: string;            // POCategory enum value
  items: CreatePurchaseOrderItemRequest[];
}

export interface UpdatePurchaseOrderRequest {
  supplierId?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  remarks?: string;
  items?: CreatePurchaseOrderItemRequest[];  // If provided, replaces all existing items
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
  source?: POSource;
  poCategory?: string;
  poCategories?: string[];
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
