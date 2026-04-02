// Greige Stock Service - API calls for greige stock
import axios from 'axios';
import type { GreigeStockSummary } from '../types/greigeStock.types';
import type { GreigeStockDetail, UpdateGreigeStockData } from '../types/style-stock.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/greige`;

const getAuthHeader = () => {
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      return state?.token ? { Authorization: `Bearer ${state.token}` } : {};
    } catch {
      return {};
    }
  }
  return {};
};

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
    const response = await axios.get<ApiResponse<GreigeStockSummary>>(`${BASE_URL}/summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get individual greige stock entries (available, with IDs for challan issuance)
   */
  async listAvailableStock(): Promise<GreigeStockEntry[]> {
    const response = await axios.get<ApiResponse<GreigeStockEntry[]>>(`${BASE_URL}/stock`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get individual stock entries for a specific greige type (expandable rows)
   */
  async getStockEntriesByGreige(greigeId: string): Promise<GreigeStockDetail[]> {
    const response = await axios.get<ApiResponse<GreigeStockDetail[]>>(`${BASE_URL}/stock-entries/${greigeId}`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Update a greige stock entry
   */
  async updateStock(stockId: string, data: UpdateGreigeStockData): Promise<GreigeStockDetail> {
    const response = await axios.patch<ApiResponse<GreigeStockDetail>>(`${BASE_URL}/stock/${stockId}`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Delete a greige stock entry
   */
  async deleteStock(stockId: string): Promise<void> {
    await axios.delete(`${BASE_URL}/stock/${stockId}`, {
      headers: getAuthHeader(),
    });
  },

  /**
   * Adjust greige stock (increase/decrease with reason)
   */
  async adjustStock(
    stockId: string,
    data: { adjustmentType: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; remarks?: string }
  ): Promise<any> {
    const response = await axios.post(`${BASE_URL}/stock/${stockId}/adjust`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },
};

export default greigeStockService;
