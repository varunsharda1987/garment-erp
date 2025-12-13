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
  // Backend serializer transforms: order_items -> items, customers remains as 'customers' in list response
  const normalizedData: OrderListResponse = {
    ...data,
    data: data.data.map((order: RawOrderFromApi): Order => ({
      ...order,
      customer: order.customers || (order as any).customer, // Backend returns 'customers', frontend expects 'customer'
      // Normalize _count - serializer transforms order_items to items
      _count: (order as any)._count ? {
        orderItems: (order as any)._count.items || (order as any)._count.order_items || 0,
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

  // Backend serializer transforms snake_case to camelCase, then applies relation mappings:
  //   - order_items -> orderItems -> items
  //   - order_item_breakup -> orderItemBreakup -> breakup
  //   - color_options -> colorOptions -> colors
  //   - size_options -> sizeOptions -> sizes
  //   - customers stays as 'customers' (need to map to 'customer')
  //   - styles stays as 'styles' (need to map to 'style')
  const normalizedOrder: Order = {
    ...rawOrder,
    customer: rawOrder.customers || (rawOrder as any).customer,
    // Backend sends 'items' (transformed from order_items by serializer)
    orderItems: (rawOrder as any).items?.map((item: any) => ({
      ...item,
      // Backend sends 'styles' as the style relation
      style: item.styles || item.style,
      // Backend sends 'breakup' (transformed from order_item_breakup by serializer)
      orderItemBreakup: (item.breakup || item.orderItemBreakup)?.map((breakup: any) => ({
        ...breakup,
        // Backend serializer converts color_options -> colorOptions -> colors (via RELATION_MAPPINGS)
        color: breakup.colorOptions || breakup.colors || breakup.color,
        // Backend serializer converts size_options -> sizeOptions -> sizes (via RELATION_MAPPINGS)
        size: breakup.sizeOptions || breakup.sizes || breakup.size,
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
