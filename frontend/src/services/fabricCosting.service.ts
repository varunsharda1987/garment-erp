/**
 * Fabric Costing Service
 * API calls for fabric cost calculation with sourcing strategies
 */

import axios from 'axios';
import type {
  FabricCostCalculationResult,
  FabricCostingRequest,
  BatchFabricCostingRequest,
  BatchFabricCostingResult,
  ProcessorInfo,
  StyleFabricsResponse,
  ProcessorRateLookup,
  SaveFabricCostingRequest,
} from '../types/fabricCosting.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/fabric-costing`;

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

export const fabricCostingService = {
  // ============================================
  // NEW ENDPOINTS FOR REDESIGNED FABRIC COSTING
  // ============================================

  /**
   * Get all DYEING_PRINTING processors for dropdown
   */
  async getProcessors(): Promise<ProcessorInfo[]> {
    const response = await axios.get<ApiResponse<ProcessorInfo[]>>(
      `${BASE_URL}/processors`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get fabrics from a style with greige data for fabric costing
   */
  async getStyleFabrics(styleId: string): Promise<StyleFabricsResponse> {
    const response = await axios.get<ApiResponse<StyleFabricsResponse>>(
      `${BASE_URL}/style/${styleId}`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Lookup processor rate for a specific greige and quantity
   */
  async lookupRate(params: {
    processorId: string;
    processingType: 'DYEING' | 'PRINTING';
    printingType?: 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';
    greigeId: string;
    quantityMeters: number;
  }): Promise<ProcessorRateLookup | null> {
    try {
      const response = await axios.post<ApiResponse<ProcessorRateLookup>>(
        `${BASE_URL}/lookup-rate`,
        params,
        { headers: getAuthHeader() }
      );
      return response.data.data;
    } catch (error: any) {
      // Return null if no rate found (404)
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Save fabric costing data for a style
   */
  async saveFabricCosting(request: SaveFabricCostingRequest): Promise<{ message: string; updatedCount: number }> {
    const response = await axios.post<ApiResponse<{ message: string; updatedCount: number }>>(
      `${BASE_URL}/save`,
      request,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  // ============================================
  // LEGACY ENDPOINTS (kept for backward compatibility)
  // ============================================

  /**
   * Calculate fabric cost with all sourcing options (legacy)
   */
  async calculateFabricCost(
    request: FabricCostingRequest
  ): Promise<FabricCostCalculationResult> {
    const response = await axios.post<ApiResponse<FabricCostCalculationResult>>(
      `${BASE_URL}/calculate`,
      request,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Calculate costs for multiple fabrics (legacy)
   */
  async calculateBatchFabricCost(
    request: BatchFabricCostingRequest
  ): Promise<BatchFabricCostingResult> {
    const response = await axios.post<ApiResponse<BatchFabricCostingResult>>(
      `${BASE_URL}/batch-calculate`,
      request,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },
};

export default fabricCostingService;
