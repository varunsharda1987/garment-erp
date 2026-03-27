/**
 * Order Production Status Service
 * API client for order-centric production status
 */

import api from '../lib/api';
import type {
  OrderStatusListResponse,
  OrderStatusQueryOptions,
  OrderStatusSummary,
  SelectCadRequest,
  UpdateInheritanceRequest,
  CostingComparisonResponse,
  RecalculateCostingResponse,
} from '../types/orderProductionStatus.types';

const BASE_URL = '/production-status';
const ORDER_ITEMS_URL = '/order-items';

/**
 * Get order-level production status list with filters
 */
export const getOrderStatusList = async (options: OrderStatusQueryOptions = {}): Promise<OrderStatusListResponse> => {
  const params = new URLSearchParams();

  if (options.page) params.append('page', options.page.toString());
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.search) params.append('search', options.search);
  if (options.brand) params.append('brand', options.brand);
  if (options.customer) params.append('customer', options.customer);
  if (options.status) params.append('status', options.status);
  if (options.stage) params.append('stage', options.stage);
  if (options.cadStatus) params.append('cadStatus', options.cadStatus);
  if (options.orderDateFrom) params.append('orderDateFrom', options.orderDateFrom);
  if (options.orderDateTo) params.append('orderDateTo', options.orderDateTo);
  if (options.deliveryDateFrom) params.append('deliveryDateFrom', options.deliveryDateFrom);
  if (options.deliveryDateTo) params.append('deliveryDateTo', options.deliveryDateTo);
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);
  if (options.styleId) params.append('styleId', options.styleId);
  if (options.orderId) params.append('orderId', options.orderId);

  const queryString = params.toString();
  const url = `${BASE_URL}/by-order${queryString ? `?${queryString}` : ''}`;

  const response = await api.get<OrderStatusListResponse>(url);
  return response.data;
};

/**
 * Get order production status summary
 */
export const getOrderStatusSummary = async (): Promise<OrderStatusSummary> => {
  const response = await api.get<{ success: boolean; data: OrderStatusSummary }>(`${BASE_URL}/by-order/summary`);
  return response.data.data;
};

/**
 * Select CAD width for an order item
 */
export const selectCadForOrder = async (orderItemId: string, data: SelectCadRequest): Promise<unknown> => {
  const response = await api.patch(`${ORDER_ITEMS_URL}/${orderItemId}/select-cad`, data);
  return response.data;
};

/**
 * Update inheritance settings for an order item
 */
export const updateInheritance = async (orderItemId: string, data: UpdateInheritanceRequest): Promise<unknown> => {
  const response = await api.patch(`${ORDER_ITEMS_URL}/${orderItemId}/inheritance`, data);
  return response.data;
};

/**
 * Get order item costing
 */
export const getOrderItemCosting = async (orderItemId: string): Promise<unknown> => {
  const response = await api.get(`${ORDER_ITEMS_URL}/${orderItemId}/costing`);
  return response.data;
};

/**
 * Recalculate costing for an order item
 */
export const recalculateOrderCosting = async (
  orderItemId: string,
  selectedCadId?: string
): Promise<RecalculateCostingResponse> => {
  const response = await api.post<{ success: boolean; data: RecalculateCostingResponse }>(
    `${ORDER_ITEMS_URL}/${orderItemId}/recalculate-costing`,
    { selectedCadId }
  );
  return response.data.data;
};

/**
 * Get costing comparison between style base and order-specific
 */
export const getCostingComparison = async (orderItemId: string): Promise<CostingComparisonResponse> => {
  const response = await api.get<{ success: boolean; data: CostingComparisonResponse }>(
    `${ORDER_ITEMS_URL}/${orderItemId}/costing-comparison`
  );
  return response.data.data;
};

/**
 * Delete order item costing (revert to style costing)
 */
export const deleteOrderItemCosting = async (orderItemId: string): Promise<void> => {
  await api.delete(`${ORDER_ITEMS_URL}/${orderItemId}/costing`);
};

// Export as named object for easier imports
export const orderProductionStatusService = {
  getOrderStatusList,
  getOrderStatusSummary,
  selectCadForOrder,
  updateInheritance,
  getOrderItemCosting,
  recalculateOrderCosting,
  getCostingComparison,
  deleteOrderItemCosting,
};

export default orderProductionStatusService;
