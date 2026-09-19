export type SaleOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_ALLOCATED'
  | 'FULLY_ALLOCATED'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

/** Linked production order summary (make-to-order: orders.saleOrderId) */
export interface LinkedProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalQuantity: number;
  expectedDeliveryDate?: string | null;
  createdAt?: string;
}

/** Buyer PO record (multiple POs per sale order — one per delivery location) */
export interface BuyerPO {
  id: string;
  buyerPoNumber: string;
  isPrimary: boolean;
  remarks?: string | null;
  createdAt: string;
  /** Where this PO's goods ship — one of the customer's own saved addresses. */
  deliveryAddressId?: string | null;
  deliveryAddress?: {
    id: string;
    label: string;
    addressType?: string | null;
    pincode?: string | null;
    city?: { cityName: string } | null;
  } | null;
  /** The date printed on the buyer's PO (not when we filed it). */
  poDate?: string | null;
  /** The customer's PO paperwork. Served behind an auth check — open it with openUploadedFile(). */
  documentUrl?: string | null;
  documentName?: string | null;
  documentSize?: number | null;
  documentUploadedAt?: string | null;
}

export interface SaleOrderItem {
  id: string;
  saleOrderId: string;
  styleId: string;
  colorId?: string | null;
  sizeId?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  allocatedQty: number;
  dispatchedQty: number;
  remarks?: string | null;
  /**
   * The buyer's own style code AS AT THE DAY THIS LINE WAS TAKEN. Prefer this over
   * `style.buyerStyleRef` when displaying: the style master's copy is editable with no history, so
   * it shows today's code even on an order placed under an older one. Null on lines taken before
   * this was captured — fall back to the style's value then.
   */
  buyerStyleRef?: string | null;
  style?: {
    id: string;
    styleCode: string;
    buyerStyleRef?: string | null;
    styleName: string;
    imageUrl?: string | null;
  };
  color?: {
    id: string;
    colorName: string;
    colorCode?: string | null;
  } | null;
  size?: {
    id: string;
    sizeName: string;
    sizeCode: string;
  } | null;
  allocations?: Array<{
    id: string;
    allocatedQty: number;
    /** ALLOCATED = reserved and not yet shipped; CONSUMED = shipped; RELEASED = given back. */
    status: string;
    fgStock?: {
      id: string;
      quantity: number;
      locations?: { id: string; locationName: string };
    };
  }>;
}

export interface SaleOrder {
  id: string;
  saleOrderNumber: string;
  buyerPoNumber?: string | null; // Buyer's (HOK) PO number — B2B tracking key
  customerId: string;
  styleId?: string | null; // Primary style for the order
  saleDate: string;
  expectedShipDate?: string | null; // Factory's planned ship date
  buyerDeadline?: string | null; // Buyer's required completion date
  orderDate?: string | null; // Buyer's PO/order date
  deliveryDate?: string | null; // Agreed delivery date
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  status: SaleOrderStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  remarks?: string | null;
  createdById: string;
  approvedById?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    code: string;
    name: string;
    billingAddress?: string | null;
    shippingAddress?: string | null;
    gstNumber?: string | null;
  };
  style?: {
    id: string;
    styleCode: string;
    buyerStyleRef?: string | null;
    styleName: string;
    imageUrl?: string | null;
  } | null; // Primary style relation
  items?: SaleOrderItem[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  productionOrders?: LinkedProductionOrder[];
  buyerPos?: BuyerPO[];
  _count?: {
    items: number;
    deliveryNotes: number;
    invoices: number;
  };
}

export interface SOItemInput {
  styleId: string;
  colorId?: string | null;
  sizeId?: string | null;
  quantity: number;
  unitPrice: number;
  remarks?: string;
  /**
   * Send the value read back from the order to KEEP the code its line was taken under; omit it and
   * the backend captures the style's current code. An edit must always send it back, or re-saving
   * an old order would silently re-stamp it with today's code.
   */
  buyerStyleRef?: string | null;
}

export interface CreateSORequest {
  customerId: string;
  buyerPoNumber?: string; // Buyer's (HOK) PO number — B2B tracking key
  styleId?: string | null; // Primary style for the order
  expectedShipDate?: string;
  buyerDeadline?: string; // Buyer's required completion date
  orderDate?: string; // Buyer's PO/order date
  deliveryDate?: string; // Agreed delivery date
  paymentTerms?: string;
  deliveryAddress?: string;
  remarks?: string;
  items: SOItemInput[];
}

export interface UpdateSORequest {
  customerId?: string;
  buyerPoNumber?: string | null; // Buyer's (HOK) PO number — B2B tracking key
  styleId?: string | null; // Primary style for the order
  expectedShipDate?: string | null;
  buyerDeadline?: string | null; // Buyer's required completion date
  orderDate?: string | null; // Buyer's PO/order date
  deliveryDate?: string | null; // Agreed delivery date
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  remarks?: string | null;
  items?: SOItemInput[];
}

export interface SOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SaleOrderStatus;
  customerId?: string;
  /** yyyy-MM-dd — filters on saleDate, inclusive */
  fromDate?: string;
  /** yyyy-MM-dd — filters on saleDate, inclusive */
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedSaleOrders {
  data: SaleOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AvailableFGStock {
  id: string;
  styleId: string;
  colorId: string;
  sizeId: string;
  quantity: number;
  availableQty: number;
  allocatedQty: number;
  colorOptions?: {
    id: string;
    colorName: string;
  };
  sizeOptions?: {
    id: string;
    sizeName: string;
    sizeCode: string;
  };
  locations?: {
    id: string;
    // The API selects `locationName` (locations has no `name` column) — reading `name` here
    // silently rendered every stock location as "-".
    locationName: string;
  };
}

// Stock Preview types for Smart Confirm Dialog
export interface StyleReadiness {
  status: string;
  hasComponents: boolean;
  hasFabrics: boolean;
  hasSizes: boolean;
  hasVariants: boolean;
  isReady: boolean;
  missingSteps: string[];
}

export type StockStatus = 'FULL' | 'PARTIAL' | 'NONE';
export type RecommendedAction = 'ALLOCATE_ALL' | 'START_PRODUCTION' | 'MIXED';

export interface StockPreviewItem {
  id: string;
  style: {
    id: string;
    styleCode: string;
    styleName: string;
  } | null;
  color: {
    id: string;
    colorName: string;
  } | null;
  size: {
    id: string;
    sizeName: string;
    sizeCode: string;
  } | null;
  orderedQty: number;
  availableQty: number;
  shortfall: number;
  status: StockStatus;
  styleReadiness?: StyleReadiness;
}

export interface StockPreviewSummary {
  itemsWithStock: number;
  itemsPartialStock: number;
  itemsNoStock: number;
  quantityAvailable: number;
  quantityNeedsProduction: number;
}

export interface StockPreviewResponse {
  saleOrderId: string;
  saleOrderNumber: string;
  totalItems: number;
  totalQuantity: number;
  summary: StockPreviewSummary;
  items: StockPreviewItem[];
  recommendedAction: RecommendedAction;
}
