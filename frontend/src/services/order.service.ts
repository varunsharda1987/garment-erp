// Order Management Service
import api from '../lib/api';
import type {
  Order,
  OrderListResponse,
  OrderResponse,
  CreateOrderRequest,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
  RawOrderFromApi,
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

  // Normalize response: map backend field names to frontend expected names
  const normalizedData: OrderListResponse = {
    ...data,
    data: data.data.map((order: RawOrderFromApi): Order => ({
      ...order,
      customer: order.customers, // Backend returns 'customers', frontend expects 'customer'
      // Normalize _count from snake_case to camelCase
      _count: (order as any)._count ? {
        orderItems: (order as any)._count.order_items || 0,
      } : undefined,
    })),
  };

  return normalizedData;
};

/**
 * Get single order by ID
 */
export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await api.get(`/orders/${id}`);
  const rawOrder = data.data as RawOrderFromApi;

  // Normalize: map customers (plural) to customer (singular)
  // Also map relation names from Prisma to frontend expected names
  const normalizedOrder: Order = {
    ...rawOrder,
    customer: rawOrder.customers,
    // Map Prisma relation names to expected frontend names
    orderItems: (rawOrder as any).order_items?.map((item: any) => ({
      ...item,
      style: item.styles,
      orderItemBreakup: item.order_item_breakup?.map((breakup: any) => ({
        ...breakup,
        color: breakup.color_options,
        size: breakup.size_options,
      })),
    })),
  };

  return normalizedOrder;
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

/**
 * Get order statistics grouped by customer
 */
export const getOrderStatisticsByCustomer = async (): Promise<OrderStatisticsResponse> => {
  const { data } = await api.get('/orders/statistics/by-customer');
  return data;
};
