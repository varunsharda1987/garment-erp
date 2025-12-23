// Style Label Configuration Service
import api from '@/lib/api';
import type {
  StyleLabelConfig,
  StyleLabelListResponse,
  StyleLabelResponse,
  CreateStyleLabelInput,
  UpdateStyleLabelInput,
  OrderLabelOverride,
  OrderLabelOverrideListResponse,
  CreateOrderLabelOverrideInput,
  OrderItemLabelRequirements,
  OrderItemLabelRequirementsResponse,
  OrderTotalLabelRequirements,
  OrderTotalLabelRequirementsResponse,
} from '@/types/styleLabel.types';

// ============================================
// STYLE LABEL CONFIG API
// ============================================

/**
 * Get all labels assigned to a style
 */
export async function getStyleLabels(styleId: string, includeInactive = false): Promise<StyleLabelConfig[]> {
  const response = await api.get<StyleLabelListResponse>(`/styles/${styleId}/labels`, {
    params: { includeInactive: includeInactive ? 'true' : undefined },
  });
  return response.data.data;
}

/**
 * Get a specific style label config by ID
 */
export async function getStyleLabelById(id: string): Promise<StyleLabelConfig> {
  const response = await api.get<StyleLabelResponse>(`/style-labels/${id}`);
  return response.data.data;
}

/**
 * Add a label to a style
 */
export async function addLabelToStyle(styleId: string, data: CreateStyleLabelInput): Promise<StyleLabelConfig> {
  const response = await api.post<StyleLabelResponse>(`/styles/${styleId}/labels`, data);
  return response.data.data;
}

/**
 * Bulk add labels to a style
 */
export async function bulkAddLabelsToStyle(styleId: string, labels: CreateStyleLabelInput[]): Promise<StyleLabelConfig[]> {
  const response = await api.post<{ data: StyleLabelConfig[] }>(`/styles/${styleId}/labels/bulk`, { labels });
  return response.data.data;
}

/**
 * Update a style label config
 */
export async function updateStyleLabel(id: string, data: UpdateStyleLabelInput): Promise<StyleLabelConfig> {
  const response = await api.put<StyleLabelResponse>(`/style-labels/${id}`, data);
  return response.data.data;
}

/**
 * Remove a label from a style (soft delete)
 */
export async function removeStyleLabel(id: string): Promise<void> {
  await api.delete(`/style-labels/${id}`);
}

/**
 * Permanently delete a style label config
 */
export async function deleteStyleLabelPermanent(id: string): Promise<void> {
  await api.delete(`/style-labels/${id}/permanent`);
}

// ============================================
// ORDER LABEL REQUIREMENTS API
// ============================================

/**
 * Get calculated label requirements for an order item
 * Quantities are auto-calculated from order breakup × (1 + extraPercentage/100)
 */
export async function getOrderItemLabelRequirements(orderItemId: string): Promise<OrderItemLabelRequirements> {
  const response = await api.get<OrderItemLabelRequirementsResponse>(
    `/order-items/${orderItemId}/label-requirements`
  );
  return response.data.data;
}

/**
 * Get aggregated label requirements for entire order
 */
export async function getOrderTotalLabelRequirements(orderId: string): Promise<OrderTotalLabelRequirements> {
  const response = await api.get<OrderTotalLabelRequirementsResponse>(
    `/orders/${orderId}/label-requirements`
  );
  return response.data.data;
}

// ============================================
// ORDER LABEL OVERRIDE API
// ============================================

/**
 * Get all label overrides for an order item
 */
export async function getOrderLabelOverrides(orderItemId: string): Promise<OrderLabelOverride[]> {
  const response = await api.get<OrderLabelOverrideListResponse>(
    `/order-items/${orderItemId}/label-overrides`
  );
  return response.data.data;
}

/**
 * Create or update a label override for an order item
 */
export async function createOrUpdateLabelOverride(
  orderItemId: string,
  data: CreateOrderLabelOverrideInput
): Promise<OrderLabelOverride> {
  const response = await api.post<{ data: OrderLabelOverride }>(
    `/order-items/${orderItemId}/label-overrides`,
    data
  );
  return response.data.data;
}

/**
 * Delete a label override
 */
export async function deleteLabelOverride(overrideId: string): Promise<void> {
  await api.delete(`/order-label-overrides/${overrideId}`);
}
