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
  CostingOptionsResponse,
  StyleCostingOptionsResponse,
  CostingOptionsFilters,
  CostingOption,
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

  // ============================================
  // COSTING OPTIONS ENDPOINTS (approval workflow)
  // ============================================

  /**
   * Get all costing options with filtering - paginated by style
   */
  async getCostingOptions(filters: CostingOptionsFilters): Promise<CostingOptionsResponse> {
    const params = new URLSearchParams();
    if (filters.customerId) params.append('customerId', filters.customerId);
    if (filters.styleId) params.append('styleId', filters.styleId);
    if (filters.processorId) params.append('processorId', filters.processorId);
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.purpose && filters.purpose !== 'ALL') params.append('purpose', filters.purpose);
    params.append('page', filters.page.toString());
    params.append('limit', filters.limit.toString());

    const response = await axios.get<CostingOptionsResponse>(
      `${BASE_URL}/options?${params.toString()}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  /**
   * Get all costing options for a specific style - grouped by component
   */
  async getStyleCostingOptions(styleId: string): Promise<StyleCostingOptionsResponse> {
    const response = await axios.get<StyleCostingOptionsResponse>(
      `${BASE_URL}/style/${styleId}/options`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  /**
   * Approve a costing option - marks it as preferred
   */
  async approveCostingOption(optionId: string): Promise<CostingOption> {
    const response = await axios.post<ApiResponse<CostingOption>>(
      `${BASE_URL}/option/${optionId}/approve`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Unapprove a costing option - revert to Pending status
   */
  async unapproveCostingOption(optionId: string): Promise<CostingOption> {
    const response = await axios.patch<ApiResponse<CostingOption>>(
      `${BASE_URL}/option/${optionId}/unapprove`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Delete a costing option
   */
  async deleteCostingOption(optionId: string): Promise<void> {
    await axios.delete(
      `${BASE_URL}/option/${optionId}`,
      { headers: getAuthHeader() }
    );
  },

  /**
   * Promote a costing option to next workflow stage
   * PLANNING → COSTING → PRODUCTION
   */
  async promoteCostingOption(
    optionId: string,
    targetPurpose: 'COSTING' | 'PRODUCTION'
  ): Promise<CostingOption> {
    const response = await axios.post<ApiResponse<CostingOption>>(
      `${BASE_URL}/option/${optionId}/promote`,
      { targetPurpose },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get costing status for multiple styles at once
   * Returns map of styleId -> { hasCosting, hasPending, hasApproved, hasProduction }
   */
  async getStylesCostingStatus(styleIds: string[]): Promise<Record<string, StyleCostingStatus>> {
    const response = await axios.post<ApiResponse<Record<string, StyleCostingStatus>>>(
      `${BASE_URL}/styles/costing-status`,
      { styleIds },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  // ============================================
  // CAD TO COSTING PUSH ENDPOINTS
  // ============================================

  /**
   * Check which CAD rows already have costing data
   * Returns counts and details of new vs existing records
   */
  async checkCADCostingStatus(styleId: string, cadRowIds: string[]): Promise<CADCostingStatusResponse> {
    const response = await axios.post<ApiResponse<CADCostingStatusResponse>>(
      `${BASE_URL}/check-cad-status`,
      { styleId, cadRowIds },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Create fabric costing records from CAD rows
   * Fetches greige cost from latest procurement and initializes costing fields
   */
  async pushFromCAD(styleId: string, cadRowIds: string[]): Promise<PushFromCADResponse> {
    const response = await axios.post<ApiResponse<PushFromCADResponse>>(
      `${BASE_URL}/push-from-cad`,
      { styleId, cadRowIds },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },
};

// Type for costing status
export interface StyleCostingStatus {
  hasCosting: boolean;
  hasPending: boolean;
  hasApproved: boolean;
  hasProduction: boolean;
  costingCount: number;
}

// Types for CAD to Costing push
export interface CADCostingStatusResponse {
  newCount: number;
  existingCount: number;
  newRows: { id: string; greigeId: string | null; greigeName: string | null; width: number }[];
  existingRows: { id: string; greigeId: string | null; greigeName: string | null; width: number; totalCostPerMeter: number }[];
}

export interface PushFromCADResponse {
  created: number;
  skipped: number;
  createdRows: { id: string; greigeId: string | null; greigeCostPerMeter: number | null; transportCostPerMeter: number; totalCostPerMeter: number | null }[];
  skippedRows: { id: string; reason: string }[];
}

export default fabricCostingService;
