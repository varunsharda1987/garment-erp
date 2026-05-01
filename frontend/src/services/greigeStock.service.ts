// Greige Stock Service - API calls for greige stock
import api from '@/lib/api';
import type { GreigeStockSummary } from '../types/greigeStock.types';
import type { GreigeStockDetail, UpdateGreigeStockData } from '../types/style-stock.types';

const BASE_URL = '/greige';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface GreigeStockEntry {
  id: string;
  greigeId: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  greigeWidth: number;
  cutableWidth?: number;
  purchaseCost?: number;
  weightedAvgCost?: number;
  warehouseLocation?: string;
  rollNumbers?: string;
  qualityGrade: string;
  status: string;
  greige: {
    id: string;
    greigeCode: string;
    greigeName: string;
    composition: string;
    yarnCount?: string;
    construction?: string;
    weaveType?: string;
  };
}

export const greigeStockService = {
  /**
   * Get greige stock summary for unified dashboard
   */
  async getSummary(): Promise<GreigeStockSummary> {
    const response = await api.get<ApiResponse<GreigeStockSummary>>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  /**
   * Get individual greige stock entries (available, with IDs for challan issuance)
   * @param filters.warehouseLocation - Filter by warehouse location
   * @param filters.excludeTransferred - Exclude stock already transferred to processors
   */
  async listAvailableStock(filters?: {
    warehouseLocation?: string;
    excludeTransferred?: boolean;
  }): Promise<GreigeStockEntry[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseLocation) {
      params.append('warehouseLocation', filters.warehouseLocation);
    }
    if (filters?.excludeTransferred) {
      params.append('excludeTransferred', 'true');
    }
    const queryString = params.toString();
    const url = queryString ? `${BASE_URL}/stock?${queryString}` : `${BASE_URL}/stock`;

    const response = await api.get<ApiResponse<GreigeStockEntry[]>>(url);
    return response.data.data;
  },

  /**
   * Get individual stock entries for a specific greige type (expandable rows)
   */
  async getStockEntriesByGreige(greigeId: string): Promise<GreigeStockDetail[]> {
    const response = await api.get<ApiResponse<GreigeStockDetail[]>>(`${BASE_URL}/stock-entries/${greigeId}`);
    return response.data.data;
  },

  /**
   * Update a greige stock entry
   */
  async updateStock(stockId: string, data: UpdateGreigeStockData): Promise<GreigeStockDetail> {
    const response = await api.patch<ApiResponse<GreigeStockDetail>>(`${BASE_URL}/stock/${stockId}`, data);
    return response.data.data;
  },

  /**
   * Delete a greige stock entry
   */
  async deleteStock(stockId: string): Promise<void> {
    await api.delete(`${BASE_URL}/stock/${stockId}`);
  },

  /**
   * Adjust greige stock (increase/decrease with reason)
   */
  async adjustStock(
    stockId: string,
    data: { adjustmentType: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; remarks?: string }
  ): Promise<any> {
    const response = await api.post(`${BASE_URL}/stock/${stockId}/adjust`, data);
    return response.data.data;
  },
};

export default greigeStockService;
