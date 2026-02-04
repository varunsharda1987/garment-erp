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
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const OrderStatusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  DISPATCHED: 'Dispatched',
  CANCELLED: 'Cancelled',
};

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type Priority = typeof Priority[keyof typeof Priority];

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
  color?: {
    id: string;
    colorName: string;
    colorCode?: string;
  } | null;
  size?: {
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
    image?: string | null;
  };
  orderItemBreakup: OrderItemBreakup[];
  orderItemCosting?: OrderItemCosting | null;
}

// ============================================
// ORDER
// ============================================

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
}

export interface UpdateOrderRequest {
  orderDate?: string;
  expectedDeliveryDate?: string;
  priority?: Priority;
  paymentTerms?: string;
  shippingAddress?: string;
  remarks?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
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
    pages: number;
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
