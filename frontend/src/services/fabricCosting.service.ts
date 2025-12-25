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
  /**
   * Calculate fabric cost with all sourcing options
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
   * Calculate costs for multiple fabrics
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
