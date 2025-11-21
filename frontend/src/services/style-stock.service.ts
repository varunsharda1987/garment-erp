// Style Stock Service - Frontend API calls

import api from '../lib/api';
import type {
  StyleStockEntry,
  StyleFabricStock,
  StyleStockAvailability,
  FabricWithCAD,
  ComponentWithFabrics,
} from '../types/style-stock.types';

// Re-export types for convenience
export type {
  StyleStockEntry,
  StyleFabricStock,
  StyleStockAvailability,
  FabricWithCAD,
  ComponentWithFabrics,
} from '../types/style-stock.types';

/**
 * Create bulk stock entry for a style
 */
export async function createStyleStock(
  styleId: string,
  entries: StyleStockEntry[]
): Promise<any> {
  const response = await api.post(`/styles/${styleId}/stock-entry`, {
    entries,
  });
  return response.data;
}

/**
 * Get stock availability for a style
 */
export async function getStyleStock(styleId: string): Promise<StyleStockAvailability> {
  const response = await api.get(`/styles/${styleId}/stock`);
  return response.data.data;
}

/**
 * Get fabrics used in a style
 */
export async function getStyleFabrics(styleId: string): Promise<ComponentWithFabrics[]> {
  const response = await api.get(`/styles/${styleId}/fabrics`);
  return response.data.data;
}

/**
 * Get styles that use a specific fabric
 */
export async function getFabricStyles(fabricId: string): Promise<any> {
  const response = await api.get(`/fabrics/${fabricId}/styles`);
  return response.data.data;
}

/**
 * Get stock origin history for a fabric
 */
export async function getFabricStockHistory(fabricId: string): Promise<any> {
  const response = await api.get(`/fabrics/${fabricId}/stock-history`);
  return response.data.data;
}

/**
 * Create generic greige stock entry
 */
export async function createGreigeStock(data: {
  greigeId: string;
  quantity: number;
  width: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  purchaseCost?: number;
  receivedDate?: Date;
}): Promise<any> {
  const response = await api.post(`/greige/stock-entry`, data);
  return response.data;
}

/**
 * Get generic greige stock
 */
export async function getGenericGreigeStock(): Promise<any> {
  const response = await api.get(`/greige/generic-stock`);
  return response.data.data;
}
