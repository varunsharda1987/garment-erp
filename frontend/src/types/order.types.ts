// Order Management Types

// ============================================
// ENUMS
// ============================================

export const OrderStatus = {
  PENDING: 'PENDING',
  IN_PRODUCTION: 'IN_PRODUCTION',
  COMPLETED: 'COMPLETED',
  DISPATCHED: 'DISPATCHED',
  CANCELLED: 'CANCELLED',
  // A parent production run that has been split into children. Read-only: the split flow stamps it,
  // no screen sets it. It was missing here while the API can return it, so any UI branching on order
  // status silently failed to account for a split parent.
  SPLIT: 'SPLIT',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderStatusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  DISPATCHED: 'Dispatched',
  CANCELLED: 'Cancelled',
  SPLIT: 'Split',
};

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

export const PriorityLabels: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

// ============================================
// ORDER ITEM COSTING
// ============================================

export interface OrderItemCosting {
  id: string;
  orderItemId: string;
  selectedCadId?: string | null;

  // Snapshot of selected CAD data
  cadMeters?: number | null;
  cadWidth?: number | null;

  // Cost breakdown
  fabricTotal: number;
  trimsTotal: number;
  cmtTotal: number;
  embroideryTotal: number;
  accessoriesTotal: number;
  processingTotal: number;
  overheadsTotal: number;
  totalCostPerPiece: number;

  // Margin & Selling Price
  profitMargin?: number | null;
  sellingPricePerPiece?: number | null;

  // Reference to base style costing
  baseCostingId?: string | null;

  // Cost Sheet Snapshot
  costingSnapshot?: Record<string, unknown> | null;
  snapshotCreatedAt?: string | null;
  originalCostSheetVersion?: number | null;

  // Variance Tracking - Estimated vs Actual costs
  estimatedCostPerPiece?: number | null;
  actualCostPerPiece?: number | null;
  costVarianceAmount?: number | null;
  costVariancePercent?: number | null;
  varianceCalculatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// ORDER ITEM BREAKUP
// ============================================

export interface OrderItemBreakup {
  id: string;
  orderItemId: string;
  colorId: string | null;
  sizeId: string;
  quantity: number;
  // Serializer keeps these as colorOptions/sizeOptions (the colorOptions->colors /
  // sizeOptions->sizes RELATION_MAPPINGS were removed; frontend reads them directly).
  colorOptions?: {
    id: string;
    colorName: string;
    colorCode?: string;
  } | null;
  sizeOptions?: {
    id: string;
    sizeName: string;
    sizeCode?: string;
  } | null;
}

// ============================================
// ORDER ITEM
// ============================================

export interface OrderItem {
  id: string;
  orderId: string;
  styleId: string;
  itemDescription?: string | null;
  totalQuantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDate?: string | null;
  status: OrderStatus;
  remarks?: string | null;
  style: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
    image?: string | null;
  };
  breakup: OrderItemBreakup[];
  orderItemCosting?: OrderItemCosting | null;
}

// ============================================
// ORDER
// ============================================

/** How an order's requirement lines stand — each live line in exactly one bucket (order-requirements.helper) */
export interface RequirementBuckets {
  live: number;
  toOrder: number;
  onOrder: number;
  received: number;
  fromStock: number;
  waitingSizes: number;
  needDecision: number;
  notChecked: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: OrderStatus;
  priority: Priority;
  totalQuantity: number;
  totalAmount: number;
  paymentTerms?: string | null;
  shippingAddress?: string | null;
  remarks?: string | null;
  createdById: string;
  approvedById?: string | null;
  createdAt: string;
  updatedAt: string;

  // Relationships
  customer?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  orderItems?: OrderItem[];
  /**
   * The list: the latest ACTIVE BOM of each style. The order page: every BOM, newest version first,
   * with the fields its BOM card shows.
   */
  orderBoms?: Array<{
    id: string;
    status: string;
    styleId: string;
    version: number;
    isActive?: boolean;
    totalMaterialCost?: number | string | null;
    style?: { styleCode: string; styleName: string; buyerStyleRef?: string | null };
    _count?: { items: number };
  }>;
  // ── Order page only (GET /orders/:id) ──
  /** Live requirement lines, one bucket each (CANCELLED / CONVERTED left out) */
  requirementsSummary?: { material: RequirementBuckets; processing: RequirementBuckets };
  /** Why the derived status is what it is — e.g. "WO2609-0087 in production" */
  statusReason?: string | null;
  /** Pieces to ship and shipped (net of rejected / short deliveries) — the facts the status reads */
  shipment?: { ordered: number; shipped: number } | null;
  /** Delivery notes raised against the order OR its sale order */
  dispatchNotes?: Array<{ id: string; deliveryNumber: string; status: string; deliveryDate: string; quantity: number }>;
  /** Invoices raised against the order OR its sale order */
  orderInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number | string;
    invoiceDate: string;
  }>;
  /**
   * Fabric per production run (metres): every issue to Cutting, every return from it, what is still
   * there, and what finished batches consumed. Net issued = issued − returned.
   */
  runFabric?: Array<{ workOrderId: string; issued: number; returned: number; atCutting: number; consumed: number }>;
  /** Make-to-order origin: the HOK B2B sale order this production order fulfils */
  saleOrder?: {
    id: string;
    saleOrderNumber: string;
    buyerPoNumber?: string | null;
    status: string;
  } | null;
  _count?: {
    orderItems: number;
  };
}

// ============================================
// CREATE/UPDATE REQUEST TYPES
// ============================================

export interface CreateOrderItemBreakup {
  colorId: string; // Can be empty string for size-only orders (backend handles conversion to null)
  sizeId: string;
  quantity: number;
}

export interface CreateOrderItem {
  styleId: string;
  itemDescription?: string;
  unitPrice: number | string;
  totalQuantity?: number; // Direct total quantity (used when breakup is empty)
  deliveryDate?: string;
  remarks?: string;
  breakup: CreateOrderItemBreakup[]; // Can be empty for orders without size breakdown
}

export interface CreateOrderRequest {
  customerId: string;
  orderDate?: string;
  expectedDeliveryDate: string;
  priority?: Priority;
  totalQuantity?: number; // Direct total quantity (used when no size breakdown)
  paymentTerms?: string;
  shippingAddress?: string;
  remarks?: string;
  items: CreateOrderItem[];
  /** The sale order this order is made for (Orders → New fills from it); set on create only */
  saleOrderId?: string;
}

export interface UpdateOrderRequest {
  customerId?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  priority?: Priority;
  totalQuantity?: number;
  paymentTerms?: string;
  shippingAddress?: string;
  remarks?: string;
  items?: CreateOrderItem[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface OrderListResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // backend returns totalPages, not pages (bug-hunt orders-13)
  };
}

export interface OrderResponse {
  data: Order;
  message?: string;
}

// Raw order from API (before normalization)
// Backend returns 'customers' instead of 'customer'
export interface RawOrderFromApi extends Omit<Order, 'customer'> {
  customers?: Order['customer'];
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface OrderStatisticsByCustomer {
  customerId: string;
  customerCode: string;
  customerName: string;
  orderCount: number;
  totalPieces: number;
  totalAmount: number;
}

export interface OrderStatisticsResponse {
  data: OrderStatisticsByCustomer[];
  totals: {
    totalOrders: number;
    totalPieces: number;
    totalAmount: number;
  };
}
