// Order Management Service
import api from '../lib/api';
import type {
  Order,
  OrderListResponse,
  OrderResponse,
  CreateOrderRequest,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
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

  // Normalize response: map customers (plural) to customer (singular)
  const normalizedData = {
    ...data,
    data: data.data.map((order: any) => ({
      ...order,
      customer: order.customers, // Backend returns 'customers', frontend expects 'customer'
    })),
  };

  return normalizedData;
};

/**
 * Get single order by ID
 */
export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await api.get(`/orders/${id}`);
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
 * Delete/Cancel order
 */
export const deleteOrder = async (id: string): Promise<void> => {
  await api.delete(`/orders/${id}`);
};
