// Order Management Service
import api from '../lib/api';
import type {
  Order,
  OrderListResponse,
  CreateOrderRequest,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
  OrderStatisticsResponse,
} from '../types/order.types';

/**
 * Get all orders with optional filters
 */
export const getAllOrders = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  status?: string;
  priority?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<OrderListResponse> => {
  const { data } = await api.get('/orders', {
    params: {
      page: params?.page || 1,
      limit: params?.limit || 10,
      search: params?.search || undefined,
      customerId: params?.customerId || undefined,
      status: params?.status || undefined,
      priority: params?.priority || undefined,
      fromDate: params?.fromDate || undefined,
      toDate: params?.toDate || undefined,
    },
  });

  // Backend serializer automatically transforms:
  //   - order_items -> orderItems -> items (via RELATION_MAPPINGS)
  //   - customers -> customer (via RELATION_MAPPINGS for singular relation)
  return data;
};

/**
 * Get single order by ID
 */
export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await api.get(`/orders/${id}`);

  // Backend serializer automatically transforms ALL relations:
  //   - order_items -> orderItems -> items (via RELATION_MAPPINGS)
  //   - order_item_breakup -> orderItemBreakup -> breakup (via RELATION_MAPPINGS)
  //   - customers -> customer (via RELATION_MAPPINGS for singular relation)
  //   - styles -> style (via RELATION_MAPPINGS for singular relation)
  //   - color_options -> colorOptions -> colors (via RELATION_MAPPINGS)
  //   - size_options -> sizeOptions -> sizes (via RELATION_MAPPINGS)
  return data.data;
};

/**
 * Create new order
 */
export const createOrder = async (orderData: CreateOrderRequest): Promise<Order> => {
  const { data } = await api.post('/orders', orderData);
  return data.data;
};

/**
 * Update order
 */
export const updateOrder = async (id: string, orderData: UpdateOrderRequest): Promise<Order> => {
  const { data } = await api.put(`/orders/${id}`, orderData);
  return data.data;
};

/**
 * Update order status
 */
export const updateOrderStatus = async (id: string, statusData: UpdateOrderStatusRequest): Promise<Order> => {
  const { data } = await api.patch(`/orders/${id}/status`, statusData);
  return data.data;
};

/**
 * Delete/Cancel order (soft delete - changes status to CANCELLED)
 */
export const deleteOrder = async (id: string): Promise<void> => {
  await api.delete(`/orders/${id}`);
};

/**
 * Check if order can be hard deleted
 * Returns { canDelete: boolean, reason?: string }
 */
export const canDeleteOrder = async (id: string): Promise<{ canDelete: boolean; reason?: string }> => {
  const { data } = await api.get(`/orders/${id}/can-delete`);
  return data;
};

/**
 * Hard delete order and all related records
 * Only works for unprocessed orders (PENDING status, no active work orders, etc.)
 */
export const hardDeleteOrder = async (id: string): Promise<void> => {
  await api.delete(`/orders/${id}/hard-delete`);
};

/**
 * Get order statistics grouped by customer
 */
export const getOrderStatisticsByCustomer = async (): Promise<OrderStatisticsResponse> => {
  const { data } = await api.get('/orders/statistics/by-customer');
  return data;
};

/**
 * MRP-49: create any missing production work orders for an order.
 *
 * Explicit replacement for the fallback that used to run inside BOM approval. Approving a bill of
 * materials and planning materials is procurement; scheduling production is a separate decision
 * that needs a colour/size breakup — which dyeing and printing never require. Idempotent: order
 * items that already have a work order for their style are skipped.
 */
export const createWorkOrdersForOrder = async (
  orderId: string
): Promise<{ created: string[]; skipped: string[]; failed: { styleId: string; reason: string }[] }> => {
  const { data } = await api.post(`/orders/${orderId}/work-orders`, {});
  return data.data;
};

export interface SizeBreakupLine {
  colorId: string | null;
  sizeId: string;
  quantity: number;
}

export interface SizeBreakupResult {
  orderItemId: string;
  breakup: SizeBreakupLine[];
  quantityChanged: boolean;
  currentTotal: number;
  newTotal: number;
  requirements: { created: number; updated: number; sizePending: number } | null;
  workOrders: { created: string[]; skipped: string[]; failed: { styleId: string; reason: string }[] } | null;
}

/**
 * Sizes-later workflow: set one order item's size breakdown after the order was created without
 * sizes (so greige/dyeing/printing could be procured first). Additive — unlike editing the order,
 * it keeps the order item and everything linked to it, then recalculates MRP and catches
 * production planning up.
 *
 * Pass confirmQuantityChange when the sizes deliberately sum to a different total than the order
 * currently carries; without it the backend refuses with QUANTITY_CHANGE_REQUIRES_CONFIRMATION.
 */
export const setOrderItemSizeBreakup = async (
  orderId: string,
  orderItemId: string,
  breakup: SizeBreakupLine[],
  confirmQuantityChange = false
): Promise<SizeBreakupResult> => {
  const { data } = await api.put(`/orders/${orderId}/items/${orderItemId}/size-breakup`, {
    breakup,
    confirmQuantityChange,
  });
  return data.data;
};
