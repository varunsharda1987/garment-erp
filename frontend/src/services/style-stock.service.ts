// Style Stock Service - Frontend API calls

import api from '../lib/api';
import type {
  StyleStockEntry,
  StyleStockAvailability,
  StyleStockCreateResponse,
  FabricStyleUsage,
  FabricStockHistoryEntry,
  GreigeStockCreateResponse,
  GenericGreigeStock,
  StockStatusFilter,
  StyleFabricsResponse,
} from '../types/style-stock.types';

// Re-export types for convenience
export type {
  StyleStockEntry,
  StyleFabricStock,
  StyleStockAvailability,
  FabricWithCAD,
  ComponentWithFabrics,
  StyleStockCreateResponse,
  FabricStyleUsage,
  FabricStockHistoryEntry,
  GreigeStockCreateResponse,
  GenericGreigeStock,
  UnlinkedFabric,
  StyleFabricsResponse,
} from '../types/style-stock.types';

/**
 * Create bulk stock entry for a style
 */
export async function createStyleStock(styleId: string, entries: StyleStockEntry[]): Promise<StyleStockCreateResponse> {
  const response = await api.post(`/styles/${styleId}/stock-entry`, {
    entries,
  });
  return response.data;
}

/**
 * Get stock availability for a style
 * @param styleId - The style ID
 * @param statusFilter - Filter by stock status (default: AVAILABLE)
 */
export async function getStyleStock(
  styleId: string,
  statusFilter: StockStatusFilter = 'AVAILABLE'
): Promise<StyleStockAvailability> {
  const response = await api.get(`/styles/${styleId}/stock`, {
    params: { status: statusFilter },
  });
  return response.data.data;
}

/**
 * Get fabrics used in a style
 */
export async function getStyleFabrics(styleId: string): Promise<StyleFabricsResponse> {
  const response = await api.get(`/styles/${styleId}/fabrics`);
  return response.data.data;
}

/**
 * Get styles that use a specific fabric
 */
export async function getFabricStyles(fabricId: string): Promise<FabricStyleUsage[]> {
  const response = await api.get(`/styles/fabrics/${fabricId}/styles`);
  return response.data.data;
}

/**
 * Get stock origin history for a fabric
 */
export async function getFabricStockHistory(fabricId: string): Promise<FabricStockHistoryEntry[]> {
  const response = await api.get(`/styles/fabrics/${fabricId}/stock-history`);
  return response.data.data;
}

/**
 * Create generic greige stock entry
 */
export async function createGreigeStock(data: {
  greigeId: string;
  quantity: number; // Nominal quantity (what supplier measured)
  width: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  purchaseCost?: number;
  receivedDate?: Date;
  supplierId?: string;
  invoiceNumber?: string;
  invoiceDate?: Date;
  // Fold/Than tracking - for calculating actual meters from nominal
  foldLengthCm?: number; // "L" - fold length in cm (e.g., 97)
  thanCount?: number; // Number of thans in this lot
}): Promise<GreigeStockCreateResponse> {
  const response = await api.post(`/greige/stock-entry`, data);
  return response.data;
}

/**
 * Get generic greige stock
 */
export async function getGenericGreigeStock(): Promise<GenericGreigeStock[]> {
  const response = await api.get(`/greige/generic-stock`);
  return response.data.data;
}
