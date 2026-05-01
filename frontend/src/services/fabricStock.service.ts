// Fabric Stock Service - API calls for fabric stock
import api from '@/lib/api';
import type { FabricStockSummary } from '../types/fabricStock.types';

const BASE_URL = '/stock';

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
    const response = await api.get<ApiResponse<FabricStockSummary>>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  /**
   * Get fabric stock entries by fabric ID
   * Returns the most recent stock entries with weighted average cost
   */
  async getStockByFabricId(fabricId: string): Promise<FabricStock[]> {
    const response = await api.get<FabricStockListResponse>(
      `${BASE_URL}?fabricId=${fabricId}&limit=10&status=AVAILABLE`
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

    const response = await api.get<FabricStockListResponse>(`${BASE_URL}?${queryParams.toString()}`);
    return response.data;
  },
};

export default fabricStockService;
