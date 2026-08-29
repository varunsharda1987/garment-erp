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

/** Buyer PO record (multiple POs per sale order) */
export interface BuyerPO {
  id: string;
  buyerPoNumber: string;
  isPrimary: boolean;
  remarks?: string | null;
  createdAt: string;
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
    status: string;
    fgStock?: {
      id: string;
      quantity: number;
      locations?: { id: string; name: string };
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
    name: string;
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
