// Production Planning Types (Phase 5.4)

// Enums
export const OrderStatus = {
  PENDING: 'PENDING',
  IN_PRODUCTION: 'IN_PRODUCTION',
  COMPLETED: 'COMPLETED',
  DISPATCHED: 'DISPATCHED',
  CANCELLED: 'CANCELLED',
  SPLIT: 'SPLIT',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ProductionStage = {
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  FINISHING: 'FINISHING',
  CHECKING: 'CHECKING',
  PACKING: 'PACKING',
  ORDER_RECEIVED: 'ORDER_RECEIVED',
  PENDING_COSTING: 'PENDING_COSTING',
  PENDING_GREIGE_ORDER: 'PENDING_GREIGE_ORDER',
  TRIMS_NOT_ORDERED: 'TRIMS_NOT_ORDERED',
  IN_PRINTING: 'IN_PRINTING',
  IN_DYING: 'IN_DYING',
  IN_EMBROIDERY: 'IN_EMBROIDERY',
  IN_HANDWORK: 'IN_HANDWORK',
  IN_CUTTING: 'IN_CUTTING',
  IN_STITCHING: 'IN_STITCHING',
  IN_FINISHING: 'IN_FINISHING',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
} as const;
export type ProductionStage = (typeof ProductionStage)[keyof typeof ProductionStage];

export const LocationType = {
  FACTORY: 'FACTORY',
  WAREHOUSE: 'WAREHOUSE',
  OFFICE: 'OFFICE',
} as const;
export type LocationType = (typeof LocationType)[keyof typeof LocationType];

// Location interface
export interface Location {
  id: string;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  address?: string;
  capacity?: number;
  isActive: boolean;
  createdAt: string;
}

// Work Order Breakup (Color x Size matrix)
export interface WorkOrderBreakup {
  id: string;
  workOrderId: string;
  colorId: string | null; // Nullable for size-only orders
  sizeId: string;
  plannedQuantity: number;
  completedQuantity: number;
  // Note: API transforms snake_case to camelCase via middleware
  colorOptions?: {
    id: string;
    colorName: string;
    colorCode?: string;
  } | null;
  sizeOptions: {
    id: string;
    sizeName: string;
    sizeCode: string;
  };
}

// Production Tracking Update
export interface ProductionTracking {
  id: string;
  workOrderId: string;
  productionStage: ProductionStage;
  updateDate: string;
  quantityCompleted: number;
  remarks?: string;
  updatedById: string;
  createdAt: string;
  users: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  // Note: API transforms snake_case to camelCase via middleware
  workOrders?: {
    id: string;
    workOrderNumber: string;
    totalQuantity: number;
  };
}

// Work Order
export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  orderId: string | null;
  orderItemId: string | null;
  stockProductionOrderId?: string | null;
  stockProductionOrderItemId?: string | null;
  styleId: string;
  warehouseId: string | null; // Nullable - can be assigned later
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  totalQuantity: number;
  completedQuantity: number;
  status: OrderStatus;
  priority: Priority;
  remarks?: string;
  createdById: string;
  approvedById?: string;
  createdAt: string;
  updatedAt: string;

  // Relations (transformed from snake_case by API middleware)
  orders?: {
    id: string;
    orderNumber: string;
    orderDate?: string;
    expectedDeliveryDate?: string;
    customers: {
      id: string;
      name: string;
      code: string;
    };
  };
  orderItems?: {
    id: string;
    itemDescription?: string;
    totalQuantity: number;
    unitPrice: number;
    totalPrice?: number;
  };
  stockProductionOrder?: {
    id: string;
    spoNumber: string;
    status?: string;
    totalQuantity?: number;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    categoryId?: string;
    description?: string;
    imageUrl?: string;
  };
  warehouses?: {
    id: string;
    warehouseCode: string;
    warehouseName: string;
    warehouseType?: string;
    address?: string;
    city?: string;
  } | null;
  usersWorkOrdersCreatedByIdTousers?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  usersWorkOrdersApprovedByIdTousers?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workOrderBreakup?: WorkOrderBreakup[];
  productionTracking?: ProductionTracking[];

  // Split support
  parentRunId?: string | null;
  fabricLotInfo?: Record<string, unknown> | null;
  splitReason?: string | null;
  parentRun?: {
    id: string;
    workOrderNumber: string;
    totalQuantity: number;
    status: OrderStatus;
  } | null;
  childRuns?: Array<{
    id: string;
    workOrderNumber: string;
    totalQuantity: number;
    completedQuantity: number;
    status: OrderStatus;
    fabricLotInfo?: Record<string, unknown> | null;
    splitReason?: string | null;
  }>;
}

// DTOs for API requests
export interface CreateWorkOrderDTO {
  orderId?: string | null;
  orderItemId?: string | null;
  stockProductionOrderId?: string | null;
  stockProductionOrderItemId?: string | null;
  styleId: string;
  warehouseId?: string | null; // Optional - can be assigned later
  plannedStartDate: string | Date;
  plannedEndDate: string | Date;
  totalQuantity: number;
  priority?: Priority;
  remarks?: string;
  colorSizeBreakup: Array<{
    colorId: string | null; // Nullable for size-only orders
    sizeId: string;
    quantity: number;
  }>;
}

export interface SplitWorkOrderDTO {
  plannedDispatchDate: string | Date;
  breakupToSplit: Array<{
    colorId: string | null;
    sizeId: string;
    quantity: number;
  }>;
  remarks?: string;
}

export interface UpdateWorkOrderDTO {
  warehouseId?: string;
  plannedStartDate?: string | Date;
  plannedEndDate?: string | Date;
  actualStartDate?: string | Date;
  actualEndDate?: string | Date;
  totalQuantity?: number;
  completedQuantity?: number;
  status?: OrderStatus;
  priority?: Priority;
  remarks?: string;
}

export interface CreateProductionTrackingDTO {
  productionStage: ProductionStage;
  quantityCompleted: number;
  remarks?: string;
  adminOverride?: boolean;
  overrideReason?: string;
}

// Filters for work order list
export interface WorkOrderFilters {
  status?: OrderStatus;
  priority?: Priority;
  warehouseId?: string;
  styleId?: string;
  orderId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

// Production Dashboard Summary
export interface ProductionDashboardSummary {
  statusSummary: Array<{
    status: OrderStatus;
    _count: {
      id: number;
    };
    _sum: {
      totalQuantity: number | null;
      completedQuantity: number | null;
    };
  }>;
  locationSummary: Array<{
    warehouseId: string;
    _count: {
      id: number;
    };
  }>;
  recentUpdates: Array<ProductionTracking>;
  activeWorkOrders: Array<WorkOrder>;
}

// API Response types
export interface WorkOrderResponse {
  success: boolean;
  data: WorkOrder;
  message?: string;
}

export interface WorkOrderListResponse {
  success: boolean;
  data: WorkOrder[];
  count: number;
}

export interface ProductionDashboardResponse {
  success: boolean;
  data: ProductionDashboardSummary;
}

export interface ProductionTrackingResponse {
  success: boolean;
  data: ProductionTracking;
  message?: string;
}

// Helper types for forms
export interface ColorSizeBreakupInput {
  colorId: string;
  colorName: string;
  sizeId: string;
  sizeName: string;
  quantity: number;
}

export interface OrderItemForWorkOrder {
  id: string;
  styleId: string;
  styleName: string;
  styleCode: string;
  totalQuantity: number;
  unitPrice: number;
  colors: Array<{
    id: string;
    colorName: string;
    colorCode?: string;
  }>;
  sizes: Array<{
    id: string;
    sizeName: string;
    sizeCode: string;
  }>;
  breakup: Array<{
    colorId: string;
    sizeId: string;
    quantity: number;
  }>;
}
