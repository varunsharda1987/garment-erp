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
export const updateOrderStatus = async (
  id: string,
  statusData: UpdateOrderStatusRequest
): Promise<Order> => {
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
