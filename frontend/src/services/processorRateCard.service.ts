/**
 * Processor Rate Card Service
 * API calls for processor rate card management
 */

import axios from 'axios';
import type {
  ProcessorRateCard,
  ProcessorRateResult,
  ProcessorRateQuery,
  ProcessorInfo,
} from '../types/processorRateCard.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/processor-rate-cards`;

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

interface SearchResponse {
  success: boolean;
  data: ProcessorRateCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const processorRateCardService = {
  /**
   * Search rate cards with filters
   */
  async searchRateCards(params?: {
    processorId?: string;
    processingType?: string;
    fabricCategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<SearchResponse> {
    const queryParams = new URLSearchParams();
    if (params?.processorId) queryParams.append('processorId', params.processorId);
    if (params?.processingType) queryParams.append('processingType', params.processingType);
    if (params?.fabricCategory) queryParams.append('fabricCategory', params.fabricCategory);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await axios.get<SearchResponse>(
      `${BASE_URL}/search?${queryParams.toString()}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  },

  /**
   * Create new rate card
   */
  async createRateCard(data: {
    processorId: string;
    processingType: string;
    fabricCategory: string;
    genericFabricName?: string;
    minQuantityMeters: number;
    maxQuantityMeters: number;
    ratePerMeter: number;
    setupCharge?: number;
    minimumCharge?: number;
    turnaroundDays?: number;
    conditions?: string;
    priority?: number;
    effectiveFrom?: string;
    effectiveTo?: string;
  }): Promise<ProcessorRateCard> {
    const response = await axios.post<ApiResponse<ProcessorRateCard>>(
      BASE_URL,
      data,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Update rate card
   */
  async updateRateCard(
    id: string,
    data: Partial<{
      ratePerMeter: number;
      setupCharge: number;
      minimumCharge: number;
      turnaroundDays: number;
      conditions: string;
      priority: number;
      effectiveTo: string;
      isActive: boolean;
    }>
  ): Promise<ProcessorRateCard> {
    const response = await axios.put<ApiResponse<ProcessorRateCard>>(
      `${BASE_URL}/${id}`,
      data,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get processors by processing type
   */
  async getProcessorsByType(processingType: string): Promise<ProcessorInfo[]> {
    const response = await axios.get<ApiResponse<ProcessorInfo[]>>(
      `${BASE_URL}/processors/${processingType}`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Get rate preview for a processor
   */
  async getRatePreview(
    processorId: string,
    processingType: string,
    fabricCategory: string
  ): Promise<ProcessorRateResult[]> {
    const queryParams = new URLSearchParams({
      processorId,
      processingType,
      fabricCategory,
    });

    const response = await axios.get<ApiResponse<ProcessorRateResult[]>>(
      `${BASE_URL}/preview?${queryParams.toString()}`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Lookup best rate for given parameters
   */
  async lookupRate(query: ProcessorRateQuery): Promise<ProcessorRateResult | null> {
    try {
      const response = await axios.post<ApiResponse<ProcessorRateResult>>(
        `${BASE_URL}/lookup`,
        query,
        { headers: getAuthHeader() }
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
};

export default processorRateCardService;
