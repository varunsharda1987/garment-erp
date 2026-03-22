// Fabric Stock Service - API calls for fabric stock
import axios from 'axios';
import type { FabricStockSummary } from '../types/fabricStock.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/stock`;

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

interface FabricStock {
  id: string;
  fabricId: string;
  fabric?: {
    fabricCode: string;
    fabricName: string;
    colorName: string | null;
  };
  fabricMaster?: {
    fabricCode: string;
    fabricName: string;
    colorName: string | null;
  };
  weightedAvgCost: number;
  purchaseCost: number;
  quantityAvailable: number;
  warehouseLocation: string | null;
}

interface FabricStockListResponse {
  success: boolean;
  data: FabricStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const fabricStockService = {
  /**
   * Get fabric stock summary for unified dashboard
   */
  async getSummary(): Promise<FabricStockSummary> {
    const response = await axios.get<ApiResponse<FabricStockSummary>>(`${BASE_URL}/summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get fabric stock entries by fabric ID
   * Returns the most recent stock entries with weighted average cost
   */
  async getStockByFabricId(fabricId: string): Promise<FabricStock[]> {
    const response = await axios.get<FabricStockListResponse>(
      `${BASE_URL}?fabricId=${fabricId}&limit=10&status=AVAILABLE`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get all fabric stock entries with optional filters
   */
  async listStock(params?: {
    fabricId?: string;
    warehouseLocation?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<FabricStockListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.fabricId) queryParams.append('fabricId', params.fabricId);
    if (params?.warehouseLocation) queryParams.append('warehouseLocation', params.warehouseLocation);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await axios.get<FabricStockListResponse>(`${BASE_URL}?${queryParams.toString()}`, {
      headers: getAuthHeader(),
    });
    return response.data;
  },
};

export default fabricStockService;
