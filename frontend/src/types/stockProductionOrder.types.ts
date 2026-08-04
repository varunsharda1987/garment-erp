export type StockProductionOrderStatus = 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'COMPLETED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface StockProductionOrderItem {
  id: string;
  stockProductionOrderId: string;
  colorId?: string | null;
  sizeId: string;
  quantity: number;
  completedQuantity: number;
  color?: {
    id: string;
    colorName: string;
    colorCode?: string | null;
  } | null;
  size?: {
    id: string;
    sizeName: string;
    sizeCode: string;
  };
}

export interface StockProductionOrder {
  id: string;
  spoNumber: string;
  styleId: string;
  totalQuantity: number;
  targetDate?: string | null;
  status: StockProductionOrderStatus;
  priority: Priority;
  remarks?: string | null;
  createdById: string;
  approvedById?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  style?: {
    id: string;
    styleCode: string;
    buyerStyleRef?: string | null;
    styleName: string;
    imageUrl?: string | null;
    customerName?: string | null;
  };
  items?: StockProductionOrderItem[];
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
  workOrders?: Array<{
    id: string;
    workOrderNumber: string;
    status: string;
    totalQuantity: number;
    completedQuantity: number;
  }>;
  _count?: {
    items: number;
    workOrders: number;
  };
}

export interface CreateSPORequest {
  styleId: string;
  totalQuantity: number;
  targetDate?: string;
  priority?: Priority;
  remarks?: string;
  items: Array<{
    colorId?: string | null;
    sizeId: string;
    quantity: number;
  }>;
}

export interface UpdateSPORequest {
  totalQuantity?: number;
  targetDate?: string;
  priority?: Priority;
  remarks?: string;
  items?: Array<{
    colorId?: string | null;
    sizeId: string;
    quantity: number;
  }>;
}

export interface SPOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: StockProductionOrderStatus;
  styleId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedSPOs {
  data: StockProductionOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
