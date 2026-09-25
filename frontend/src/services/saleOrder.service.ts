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

/**
 * POST returns the envelope `{ data, message }` (unlike GET/PUT, which return the order itself),
 * so the order must be unwrapped here — returning the envelope handed callers `undefined` for
 * `id` and sent the "open the new order" redirect to /sale-orders/undefined.
 */
export async function createSaleOrder(data: CreateSORequest): Promise<SaleOrder> {
  const response = await api.post(BASE_URL, data);
  return response.data.data ?? response.data;
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
 * Start production (make-to-order): creates a linked production order — by default for the
 * shortfall (what finished-goods stock does not already cover), or the full SO quantity.
 */
export async function startProduction(
  id: string,
  data: {
    expectedDeliveryDate?: string;
    priority?: string;
    remarks?: string;
    quantityMode?: 'SHORTFALL' | 'FULL';
    items?: Array<{ saleOrderItemId: string; quantity: number }>;
  } = {}
): Promise<{ data: { id: string; orderNumber: string; workOrderFailures?: unknown[] }; message: string }> {
  const response = await api.post(`${BASE_URL}/${id}/start-production`, data);
  return response.data;
}

/**
 * A sale order Orders → New can fill from: the customer's CONFIRMED / PARTIALLY_ALLOCATED sale order
 * carrying the style, with no production order yet. `lines` are that style's only; `open` is what
 * is still to make (ordered − allocated − dispatched).
 */
export interface OpenSaleOrderForStyle {
  id: string;
  saleOrderNumber: string;
  buyerPoNumber: string | null;
  status: string;
  /** The buyer's PO date — the production order is dated as it */
  orderDate: string | null;
  expectedShipDate: string | null;
  buyerDeadline: string | null;
  /** How many styles the sale order carries (this form makes one) */
  styleCount: number;
  lines: Array<{
    colorId: string | null;
    sizeId: string | null;
    quantity: number;
    open: number;
    unitPrice: number;
  }>;
}

export async function getOpenSaleOrdersForStyle(customerId: string, styleId: string): Promise<OpenSaleOrderForStyle[]> {
  const response = await api.get(`${BASE_URL}/open-for-style`, { params: { customerId, styleId } });
  return response.data.data;
}

/** A production order already planning this sale order's styles but linked to no sale order. */
export interface LinkableProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalQuantity: number;
  expectedDeliveryDate: string | null;
  customerName: string | null;
  sameCustomer: boolean;
  styles: string[];
  hasSizes: boolean;
}

export async function getLinkableProductionOrders(id: string): Promise<LinkableProductionOrder[]> {
  const response = await api.get(`${BASE_URL}/${id}/linkable-production-orders`);
  return response.data.data;
}

/**
 * Link an existing production order to this sale order; a sizeless order gets the buyer PO's
 * colour/size split copied onto it (which re-plans its requirements and creates its production run).
 */
export async function linkProductionOrder(
  id: string,
  orderId: string
): Promise<{
  data: { orderNumber: string; saleOrderNumber: string; sized: Array<{ orderItemId: string; error?: string }> };
  message: string;
}> {
  const response = await api.post(`${BASE_URL}/${id}/link-production-order`, { orderId });
  return response.data;
}

/**
 * Admin only: correct a CONFIRMED order's per-line quantities (the buyer PO split was entered
 * wrong). The linked production order follows where its sizes still mirrored this order.
 */
export async function amendSaleOrderQuantities(
  id: string,
  body: { lines: Array<{ itemId: string; quantity: number }>; reason: string }
): Promise<{
  data: {
    saleOrderNumber: string;
    notFollowed: string[];
    sized: Array<{ orderItemId: string; error?: string }>;
  };
  message: string;
}> {
  const response = await api.post(`${BASE_URL}/${id}/amend-quantities`, body);
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

/**
 * Cancel a sale order and release all allocations.
 * Only works for non-terminal statuses without active production or dispatched items.
 */
export async function cancelSaleOrder(id: string): Promise<SaleOrder> {
  const response = await api.post(`${BASE_URL}/${id}/cancel`);
  return response.data.data ?? response.data;
}

/**
 * Release a specific FG stock allocation from a sale order item.
 */
export async function deallocateStock(allocationId: string): Promise<void> {
  await api.post(`${BASE_URL}/deallocate-stock`, { allocationId });
}

// === Buyer PO Management ===

import type { BuyerPO } from '@/types/saleOrder.types';

/**
 * Add a buyer PO number to a sale order.
 */
export async function addBuyerPo(
  saleOrderId: string,
  buyerPoNumber: string,
  remarks?: string,
  details?: { deliveryAddressId?: string | null; poDate?: string | null }
): Promise<BuyerPO> {
  const response = await api.post(`${BASE_URL}/${saleOrderId}/buyer-pos`, {
    buyerPoNumber,
    remarks,
    ...details,
  });
  return response.data.data;
}

/**
 * Edit a buyer PO's delivery location / PO date / remarks.
 * The PO NUMBER is not editable — it keys the unique index and the legacy scalar the B2B app
 * reads. Renaming a PO means removing it and adding the new one.
 */
export async function updateBuyerPo(
  poId: string,
  patch: { deliveryAddressId?: string | null; poDate?: string | null; remarks?: string | null }
): Promise<BuyerPO> {
  const response = await api.patch(`${BASE_URL}/buyer-pos/${poId}`, patch);
  return response.data.data;
}

/**
 * Attach (or replace) the customer's PO document.
 * Content-Type is left unset on purpose so the browser writes the multipart boundary.
 */
export async function uploadBuyerPoDocument(poId: string, file: File): Promise<BuyerPO> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`${BASE_URL}/buyer-pos/${poId}/document`, formData);
  return response.data.data;
}

/** Remove the PO document, leaving the PO itself in place. */
export async function removeBuyerPoDocument(poId: string): Promise<BuyerPO> {
  const response = await api.delete(`${BASE_URL}/buyer-pos/${poId}/document`);
  return response.data.data;
}

/**
 * Remove a buyer PO from a sale order.
 */
export async function removeBuyerPo(poId: string): Promise<void> {
  await api.delete(`${BASE_URL}/buyer-pos/${poId}`);
}

/**
 * Set a buyer PO as primary for a sale order.
 */
export async function setPrimaryBuyerPo(poId: string): Promise<BuyerPO> {
  const response = await api.post(`${BASE_URL}/buyer-pos/${poId}/set-primary`);
  return response.data.data;
}
