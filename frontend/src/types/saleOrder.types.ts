export type SaleOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_ALLOCATED'
  | 'FULLY_ALLOCATED'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'CANCELLED';

export interface SaleOrderItem {
  id: string;
  saleOrderId: string;
  styleId: string;
  colorId?: string | null;
  sizeId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  allocatedQty: number;
  dispatchedQty: number;
  remarks?: string | null;
  style?: {
    id: string;
    styleCode: string;
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
  };
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
  customerId: string;
  saleDate: string;
  expectedShipDate?: string | null;
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
  _count?: {
    items: number;
    deliveryNotes: number;
    invoices: number;
  };
}

export interface CreateSORequest {
  customerId: string;
  expectedShipDate?: string;
  remarks?: string;
  items: Array<{
    styleId: string;
    colorId?: string | null;
    sizeId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface UpdateSORequest {
  expectedShipDate?: string;
  remarks?: string;
  items?: Array<{
    styleId: string;
    colorId?: string | null;
    sizeId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface SOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SaleOrderStatus;
  customerId?: string;
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
