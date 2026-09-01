/**
 * Purchase Order Service
 * Frontend API client for purchase order management
 */

import api from '../lib/api';
import type {
  PurchaseOrder,
  PurchaseOrderListResponse,
  PurchaseOrderResponse,
  PurchaseOrderItemResponse,
  PurchaseOrderFilters,
  CreatePurchaseOrderRequest,
  UpdatePurchaseOrderRequest,
  CreatePurchaseOrderItemRequest,
  UpdatePurchaseOrderItemRequest,
  CancelPurchaseOrderRequest,
  ShortClosePurchaseOrderRequest,
  AmendDeliveryLocationRequest,
  PendingItemsResponse,
  PurchaseOrderItem,
  POStats,
} from '../types/purchaseOrder.types';

const BASE_URL = '/purchase-orders';

/**
 * Get all purchase orders with filters and pagination
 */
export const getAllPurchaseOrders = async (filters?: PurchaseOrderFilters): Promise<PurchaseOrderListResponse> => {
  const { data } = await api.get(BASE_URL, {
    params: {
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      status: filters?.status || undefined,
      source: filters?.source || undefined,
      poCategories: filters?.poCategories?.join(',') || undefined,
      supplierId: filters?.supplierId || undefined,
      orderId: filters?.orderId || undefined,
      search: filters?.search || undefined,
      startDate: filters?.startDate || undefined,
      endDate: filters?.endDate || undefined,
      sortBy: filters?.sortBy || undefined,
      sortOrder: filters?.sortOrder || undefined,
    },
  });
  return data;
};

/**
 * Get PO statistics (counts by source, category, status + total value)
 */
export const getPOStats = async (): Promise<POStats> => {
  const { data } = await api.get(`${BASE_URL}/stats`);
  return data.data;
};

/**
 * Get receivable purchase orders (for GRN creation)
 */
export const getReceivablePurchaseOrders = async (
  supplierId?: string
): Promise<{ success: boolean; data: PurchaseOrder[]; count: number }> => {
  const { data } = await api.get(`${BASE_URL}/receivable`, {
    params: { supplierId },
  });
  return data;
};

/**
 * Get purchase order by ID
 */
export const getPurchaseOrderById = async (id: string): Promise<PurchaseOrder> => {
  const { data } = await api.get<PurchaseOrderResponse>(`${BASE_URL}/${id}`);
  return data.data;
};

/**
 * Get purchase orders by supplier
 */
export const getPurchaseOrdersBySupplier = async (
  supplierId: string,
  filters?: PurchaseOrderFilters
): Promise<PurchaseOrderListResponse> => {
  const { data } = await api.get(`${BASE_URL}/supplier/${supplierId}`, {
    params: {
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      status: filters?.status || undefined,
      search: filters?.search || undefined,
      startDate: filters?.startDate || undefined,
      endDate: filters?.endDate || undefined,
    },
  });
  return data;
};

/**
 * Get pending items for a PO (for GRN creation)
 */
export const getPendingItemsForPO = async (poId: string): Promise<PendingItemsResponse> => {
  const { data } = await api.get(`${BASE_URL}/${poId}/pending-items`);
  return data;
};

/**
 * Create a new purchase order
 */
export const createPurchaseOrder = async (orderData: CreatePurchaseOrderRequest): Promise<PurchaseOrder> => {
  const { data } = await api.post<PurchaseOrderResponse>(BASE_URL, orderData);
  return data.data;
};

/**
 * Update a purchase order
 */
export const updatePurchaseOrder = async (
  id: string,
  orderData: UpdatePurchaseOrderRequest
): Promise<PurchaseOrder> => {
  const { data } = await api.put<PurchaseOrderResponse>(`${BASE_URL}/${id}`, orderData);
  return data.data;
};

/**
 * Delete a purchase order
 */
export const deletePurchaseOrder = async (id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${id}`);
};

// ============================================
// Item Management
// ============================================

/**
 * Add an item to a purchase order
 */
export const addPurchaseOrderItem = async (
  poId: string,
  item: CreatePurchaseOrderItemRequest
): Promise<PurchaseOrderItem> => {
  const { data } = await api.post<PurchaseOrderItemResponse>(`${BASE_URL}/${poId}/items`, item);
  return data.data;
};

/**
 * Update a purchase order item
 */
export const updatePurchaseOrderItem = async (
  poId: string,
  itemId: string,
  itemData: UpdatePurchaseOrderItemRequest
): Promise<PurchaseOrderItem> => {
  const { data } = await api.put<PurchaseOrderItemResponse>(`${BASE_URL}/${poId}/items/${itemId}`, itemData);
  return data.data;
};

/**
 * Remove an item from a purchase order
 */
export const removePurchaseOrderItem = async (poId: string, itemId: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${poId}/items/${itemId}`);
};

// ============================================
// Status Transitions
// ============================================

/**
 * Send purchase order to supplier (DRAFT -> SENT)
 */
export const sendPurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  const { data } = await api.patch<PurchaseOrderResponse>(`${BASE_URL}/${id}/send`);
  return data.data;
};

/**
 * Acknowledge purchase order (SENT -> ACKNOWLEDGED)
 */
export const acknowledgePurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  const { data } = await api.patch<PurchaseOrderResponse>(`${BASE_URL}/${id}/acknowledge`);
  return data.data;
};

/**
 * Cancel purchase order
 */
export const cancelPurchaseOrder = async (id: string, request: CancelPurchaseOrderRequest): Promise<PurchaseOrder> => {
  const { data } = await api.patch<PurchaseOrderResponse>(`${BASE_URL}/${id}/cancel`, request);
  return data.data;
};

/**
 * Close a partially-received purchase order at the quantity actually delivered.
 * The undelivered balance is dropped unless reorderBalance is set.
 */
export const shortClosePurchaseOrder = async (
  id: string,
  request: ShortClosePurchaseOrderRequest
): Promise<{ purchaseOrder: PurchaseOrder; warnings: string[] }> => {
  const { data } = await api.patch<PurchaseOrderResponse & { warnings?: string[] }>(
    `${BASE_URL}/${id}/short-close`,
    request
  );
  // The close itself always succeeds once it returns 200; warnings report follow-on reconciliation
  // that did NOT complete (a stranded processing PO), which the operator has to act on.
  return { purchaseOrder: data.data, warnings: data.warnings ?? [] };
};

/**
 * Amend delivery location for a purchase order
 */
export const amendDeliveryLocation = async (
  id: string,
  request: AmendDeliveryLocationRequest
): Promise<PurchaseOrder> => {
  const { data } = await api.patch<PurchaseOrderResponse>(`${BASE_URL}/${id}/delivery-location`, request);
  return data.data;
};

// ============================================
// Duplicate Check
// ============================================

export interface DuplicatePOInfo {
  poId: string;
  poNumber: string;
  source: string | null;
  status: string;
  orderedQuantity: number;
  pendingQuantity: number;
  supplierId: string;
  supplierName?: string;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: {
    materialId: string;
    materialName?: string;
    existingPOs: DuplicatePOInfo[];
  }[];
}

/**
 * Check for duplicate POs for given materials
 * Returns existing open POs that contain the same materials
 */
export const checkForDuplicates = async (
  materialIds: string[],
  excludePOIds?: string[]
): Promise<DuplicateCheckResult> => {
  const { data } = await api.post<{ success: boolean; data: DuplicateCheckResult }>(`${BASE_URL}/check-duplicates`, {
    materialIds,
    excludePOIds,
  });
  return data.data;
};

// ============================================
// Export all functions as default object
// ============================================

export default {
  getAllPurchaseOrders,
  getReceivablePurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrdersBySupplier,
  getPendingItemsForPO,
  getPOStats,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  addPurchaseOrderItem,
  updatePurchaseOrderItem,
  removePurchaseOrderItem,
  sendPurchaseOrder,
  acknowledgePurchaseOrder,
  cancelPurchaseOrder,
  shortClosePurchaseOrder,
  amendDeliveryLocation,
  checkForDuplicates,
};
