import api from '../lib/api';
import type {
  SaleOrder,
  CreateSORequest,
  UpdateSORequest,
  SOQueryParams,
  PaginatedSaleOrders,
  AvailableFGStock,
  StockPreviewResponse,
} from '@/types/saleOrder.types';

const BASE_URL = '/sale-orders';

export async function getAllSaleOrders(params: SOQueryParams = {}): Promise<PaginatedSaleOrders> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

export async function getSaleOrderById(id: string): Promise<SaleOrder> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data;
}

export async function searchSaleOrders(params: { search?: string; limit?: number }): Promise<SaleOrder[]> {
  const response = await api.get(`${BASE_URL}/search`, { params });
  return response.data;
}

export async function createSaleOrder(data: CreateSORequest): Promise<SaleOrder> {
  const response = await api.post(BASE_URL, data);
  return response.data;
}

export async function updateSaleOrder(id: string, data: UpdateSORequest): Promise<SaleOrder> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

export async function deleteSaleOrder(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}

export async function confirmSaleOrder(id: string): Promise<SaleOrder> {
  const response = await api.post(`${BASE_URL}/${id}/confirm`);
  return response.data;
}

/**
 * Start production (make-to-order): creates a linked production order for the full SO quantity.
 */
export async function startProduction(
  id: string,
  data: { expectedDeliveryDate?: string; priority?: string; remarks?: string } = {}
): Promise<{ data: { id: string; orderNumber: string; workOrderFailures?: unknown[] }; message: string }> {
  const response = await api.post(`${BASE_URL}/${id}/start-production`, data);
  return response.data;
}

export async function allocateStock(data: {
  saleOrderItemId: string;
  fgStockId: string;
  quantity: number;
}): Promise<unknown> {
  const response = await api.post(`${BASE_URL}/allocate-stock`, data);
  return response.data;
}

export async function getAvailableStock(params: {
  styleId: string;
  colorId?: string;
  sizeId?: string;
}): Promise<AvailableFGStock[]> {
  const response = await api.get(`${BASE_URL}/available-stock`, { params });
  return response.data;
}

/**
 * Get stock preview for a sale order before confirmation.
 * Shows FG stock availability + style readiness for items needing production.
 */
export async function getStockPreview(saleOrderId: string): Promise<StockPreviewResponse> {
  const response = await api.get(`${BASE_URL}/${saleOrderId}/stock-preview`);
  return response.data;
}
