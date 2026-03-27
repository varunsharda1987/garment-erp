/**
 * Fabric Costing Service
 * API calls for fabric cost calculation with sourcing strategies
 */

import api from '../lib/api';
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

const BASE_URL = '/fabric-costing';

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
    const response = await api.get<ApiResponse<ProcessorInfo[]>>(`${BASE_URL}/processors`);
    return response.data.data;
  },

  /**
   * Get fabrics from a style with greige data for fabric costing
   * @param styleId - The style ID to fetch fabrics for
   * @param purpose - Optional filter by costing purpose (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
   */
  async getStyleFabrics(
    styleId: string,
    purpose?: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION'
  ): Promise<StyleFabricsResponse> {
    const params = purpose ? `?purpose=${purpose}` : '';
    const response = await api.get<ApiResponse<StyleFabricsResponse>>(`${BASE_URL}/style/${styleId}${params}`);
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
      const response = await api.post<ApiResponse<ProcessorRateLookup>>(`${BASE_URL}/lookup-rate`, params);
      return response.data.data;
    } catch (error: unknown) {
      // Return null if no rate found (404)
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Save fabric costing data for a style
   */
  async saveFabricCosting(request: SaveFabricCostingRequest): Promise<{ message: string; updatedCount: number }> {
    const response = await api.post<ApiResponse<{ message: string; updatedCount: number }>>(
      `${BASE_URL}/save`,
      request
    );
    return response.data.data;
  },

  // ============================================
  // LEGACY ENDPOINTS (kept for backward compatibility)
  // ============================================

  /**
   * Calculate fabric cost with all sourcing options (legacy)
   */
  async calculateFabricCost(request: FabricCostingRequest): Promise<FabricCostCalculationResult> {
    const response = await api.post<ApiResponse<FabricCostCalculationResult>>(`${BASE_URL}/calculate`, request);
    return response.data.data;
  },

  /**
   * Calculate costs for multiple fabrics (legacy)
   */
  async calculateBatchFabricCost(request: BatchFabricCostingRequest): Promise<BatchFabricCostingResult> {
    const response = await api.post<ApiResponse<BatchFabricCostingResult>>(`${BASE_URL}/batch-calculate`, request);
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

    const response = await api.get<CostingOptionsResponse>(`${BASE_URL}/options?${params.toString()}`);
    return response.data;
  },

  /**
   * Get all costing options for a specific style - grouped by component
   * @param styleId - The style ID to get costing options for
   * @param purpose - Optional: filter by purpose (COSTING, RAW_MATERIAL_CALCULATION, PRODUCTION)
   */
  async getStyleCostingOptions(styleId: string, purpose?: string): Promise<StyleCostingOptionsResponse> {
    const params = new URLSearchParams();
    if (purpose) {
      params.append('purpose', purpose);
    }
    const queryString = params.toString();
    const url = `${BASE_URL}/style/${styleId}/options${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<StyleCostingOptionsResponse>(url);
    return response.data;
  },

  /**
   * Approve a costing option - marks it as preferred
   */
  async approveCostingOption(optionId: string): Promise<CostingOption> {
    const response = await api.post<ApiResponse<CostingOption>>(`${BASE_URL}/option/${optionId}/approve`, {});
    return response.data.data;
  },

  /**
   * Unapprove a costing option - revert to Pending status
   */
  async unapproveCostingOption(optionId: string): Promise<CostingOption> {
    const response = await api.patch<ApiResponse<CostingOption>>(`${BASE_URL}/option/${optionId}/unapprove`, {});
    return response.data.data;
  },

  /**
   * Delete a costing option
   */
  async deleteCostingOption(optionId: string): Promise<void> {
    await api.delete(`${BASE_URL}/option/${optionId}`);
  },

  /**
   * Promote a costing option to next workflow stage
   * PLANNING → COSTING → PRODUCTION
   */
  async promoteCostingOption(optionId: string, targetPurpose: 'COSTING' | 'PRODUCTION'): Promise<CostingOption> {
    const response = await api.post<ApiResponse<CostingOption>>(`${BASE_URL}/option/${optionId}/promote`, {
      targetPurpose,
    });
    return response.data.data;
  },

  /**
   * Get costing status for multiple styles at once
   * Returns map of styleId -> { hasCosting, hasPending, hasApproved, hasProduction }
   */
  async getStylesCostingStatus(styleIds: string[]): Promise<Record<string, StyleCostingStatus>> {
    const response = await api.post<ApiResponse<Record<string, StyleCostingStatus>>>(
      `${BASE_URL}/styles/costing-status`,
      { styleIds }
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
    const response = await api.post<ApiResponse<CADCostingStatusResponse>>(`${BASE_URL}/check-cad-status`, {
      styleId,
      cadRowIds,
    });
    return response.data.data;
  },

  /**
   * Create fabric costing records from CAD rows
   * Fetches greige cost from latest procurement and initializes costing fields
   */
  async pushFromCAD(styleId: string, cadRowIds: string[]): Promise<PushFromCADResponse> {
    const response = await api.post<ApiResponse<PushFromCADResponse>>(`${BASE_URL}/push-from-cad`, {
      styleId,
      cadRowIds,
    });
    return response.data.data;
  },

  // ============================================
  // CAD DATA VALIDATION - NEW
  // ============================================

  /**
   * Validate if style has CAD data for fabric costing
   * Used to show warning banner if no CAD data exists
   */
  async validateStyleCADData(
    styleId: string,
    purpose?: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION'
  ): Promise<{
    hasCADData: boolean;
    recordCount: number;
    records: Array<{
      id: string;
      purpose: string;
      componentName: string;
      cutableWidth: number;
      approvalStatus: string;
      copiedFromId: string | null;
    }>;
    message: string;
  }> {
    const url = purpose
      ? `${BASE_URL}/style/${styleId}/validate?purpose=${purpose}`
      : `${BASE_URL}/style/${styleId}/validate`;

    const response = await api.get<
      ApiResponse<{
        hasCADData: boolean;
        recordCount: number;
        records: Array<{
          id: string;
          purpose: string;
          componentName: string;
          cutableWidth: number;
          approvalStatus: string;
          copiedFromId: string | null;
        }>;
        message: string;
      }>
    >(url);
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
  existingRows: {
    id: string;
    greigeId: string | null;
    greigeName: string | null;
    width: number;
    totalCostPerMeter: number;
  }[];
}

export interface PushFromCADResponse {
  created: number;
  skipped: number;
  createdRows: {
    id: string;
    greigeId: string | null;
    greigeCostPerMeter: number | null;
    transportCostPerMeter: number;
    totalCostPerMeter: number | null;
  }[];
  skippedRows: { id: string; reason: string }[];
}

export default fabricCostingService;
