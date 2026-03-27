/**
 * Processor Rate Card V2 Service
 * API calls for matrix-based processor rate card management
 */

import axios from 'axios';
import type {
  ProcessingTypeV2,
  PrintingTypeV2,
  ProcessorInfo,
  SlabDefinition,
  SlabInput,
  GreigeForRateCard,
  ProcessorRateMatrix,
  ProcessorRateMatrixFromAPI,
  CopyRatesInput,
  SaveMatrixRequest,
  ProcessorRateCardSummary,
  GreigeLaceForRateCard,
  LaceRateMatrix,
  LaceRateMatrixFromAPI,
  SaveLaceMatrixRequest,
} from '../types/processorRateCardV2.types';
import { convertGreigeFromAPI, convertLaceFromAPI } from '../types/processorRateCardV2.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/processor-rate-cards/v2`;

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

export const processorRateCardV2Service = {
  /**
   * Get summary dashboard data for all processors
   */
  async getSummary(): Promise<ProcessorRateCardSummary> {
    const response = await axios.get<ApiResponse<ProcessorRateCardSummary>>(`${BASE_URL}/summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get all DYEING/PRINTING processors
   */
  async getProcessors(): Promise<ProcessorInfo[]> {
    const response = await axios.get<ApiResponse<ProcessorInfo[]>>(`${BASE_URL}/processors`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get rate matrix for a processor
   * Converts API format (array rates) to local format (record rates) for easier editing
   * For PRINTING, printingType is required to specify which printing sub-type
   */
  async getProcessorMatrix(
    processorId: string,
    processingType: ProcessingTypeV2,
    printingType?: PrintingTypeV2
  ): Promise<ProcessorRateMatrix> {
    let url = `${BASE_URL}/processors/${processorId}/matrix?processingType=${processingType}`;
    if (processingType === 'PRINTING' && printingType) {
      url += `&printingType=${printingType}`;
    }
    const response = await axios.get<ApiResponse<ProcessorRateMatrixFromAPI>>(url, { headers: getAuthHeader() });

    // Convert API format to local format
    const apiMatrix = response.data.data;
    return {
      ...apiMatrix,
      greiges: apiMatrix.greiges.map(convertGreigeFromAPI),
    };
  },

  /**
   * Get all greige fabrics for row population
   */
  async getGreigeFabrics(): Promise<GreigeForRateCard[]> {
    const response = await axios.get<ApiResponse<GreigeForRateCard[]>>(`${BASE_URL}/greiges`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Update slab definitions
   */
  async updateSlabs(
    processorId: string,
    processingType: ProcessingTypeV2,
    slabs: SlabInput[]
  ): Promise<SlabDefinition[]> {
    const response = await axios.post<ApiResponse<SlabDefinition[]>>(
      `${BASE_URL}/processors/${processorId}/slabs`,
      { processingType, slabs },
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  /**
   * Bulk save rate matrix
   */
  async saveMatrix(processorId: string, request: SaveMatrixRequest): Promise<void> {
    await axios.put(`${BASE_URL}/processors/${processorId}/matrix`, request, { headers: getAuthHeader() });
  },

  /**
   * Copy rates between processors
   */
  async copyRates(input: CopyRatesInput): Promise<void> {
    await axios.post(`${BASE_URL}/copy`, input, { headers: getAuthHeader() });
  },

  /**
   * Add greige row to processor's matrix
   * For PRINTING, printingType is required
   */
  async addGreige(
    processorId: string,
    processingType: ProcessingTypeV2,
    greigeId: string,
    printingType?: PrintingTypeV2
  ): Promise<void> {
    const body: { processingType: ProcessingTypeV2; printingType?: PrintingTypeV2 } = { processingType };
    if (processingType === 'PRINTING' && printingType) {
      body.printingType = printingType;
    }
    await axios.post(`${BASE_URL}/processors/${processorId}/greiges/${greigeId}`, body, { headers: getAuthHeader() });
  },

  /**
   * Remove greige row from processor's matrix
   * For PRINTING, printingType is required
   */
  async removeGreige(
    processorId: string,
    processingType: ProcessingTypeV2,
    greigeId: string,
    printingType?: PrintingTypeV2
  ): Promise<void> {
    let url = `${BASE_URL}/processors/${processorId}/greiges/${greigeId}?processingType=${processingType}`;
    if (processingType === 'PRINTING' && printingType) {
      url += `&printingType=${printingType}`;
    }
    await axios.delete(url, { headers: getAuthHeader() });
  },

  /**
   * Lookup rate for fabric costing
   * For PRINTING, printingType is required
   */
  async lookupRate(
    processorId: string,
    processingType: ProcessingTypeV2,
    greigeId: string,
    quantityMeters: number,
    printingType?: PrintingTypeV2
  ): Promise<{
    id: string;
    ratePerMeter: number;
    totalCost: number;
    slabLabel: string;
  } | null> {
    try {
      const body: {
        processorId: string;
        processingType: ProcessingTypeV2;
        greigeId: string;
        quantityMeters: number;
        printingType?: PrintingTypeV2;
      } = { processorId, processingType, greigeId, quantityMeters };
      if (processingType === 'PRINTING' && printingType) {
        body.printingType = printingType;
      }
      const response = await axios.post<
        ApiResponse<{
          id: string;
          ratePerMeter: number;
          totalCost: number;
          slabLabel: string;
        }>
      >(`${BASE_URL}/lookup`, body, { headers: getAuthHeader() });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // ============================================
  // LACE RATE CARD METHODS
  // ============================================

  /**
   * Get all greige laces for rate card row population
   */
  async getGreigeLaces(): Promise<GreigeLaceForRateCard[]> {
    const response = await axios.get<ApiResponse<GreigeLaceForRateCard[]>>(`${BASE_URL}/laces`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  /**
   * Get lace rate matrix for a processor
   */
  async getLaceProcessorMatrix(processorId: string): Promise<LaceRateMatrix> {
    const response = await axios.get<ApiResponse<LaceRateMatrixFromAPI>>(
      `${BASE_URL}/processors/${processorId}/lace-matrix`,
      { headers: getAuthHeader() }
    );

    const apiMatrix = response.data.data;
    return {
      ...apiMatrix,
      laces: apiMatrix.laces.map(convertLaceFromAPI),
    };
  },

  /**
   * Bulk save lace rate matrix
   */
  async saveLaceMatrix(processorId: string, request: SaveLaceMatrixRequest): Promise<void> {
    await axios.put(`${BASE_URL}/processors/${processorId}/lace-matrix`, request, { headers: getAuthHeader() });
  },

  /**
   * Add lace row to processor's matrix
   */
  async addLace(processorId: string, laceId: string): Promise<void> {
    await axios.post(`${BASE_URL}/processors/${processorId}/laces/${laceId}`, {}, { headers: getAuthHeader() });
  },

  /**
   * Remove lace row from processor's matrix
   */
  async removeLace(processorId: string, laceId: string): Promise<void> {
    await axios.delete(`${BASE_URL}/processors/${processorId}/laces/${laceId}`, { headers: getAuthHeader() });
  },

  /**
   * Lookup rate for lace costing
   */
  async lookupLaceRate(
    processorId: string,
    laceId: string,
    quantityMeters: number
  ): Promise<{
    ratePerMeter: number;
    totalCost: number;
    shrinkagePercent: number | null;
    slab: { id: string; label: string; minQuantity: number; maxQuantity: number };
    processor: { id: string; name: string };
    lace: { id: string; name: string; costPerMeterGreige: number | null };
  } | null> {
    try {
      const response = await axios.post<
        ApiResponse<{
          ratePerMeter: number;
          totalCost: number;
          shrinkagePercent: number | null;
          slab: { id: string; label: string; minQuantity: number; maxQuantity: number };
          processor: { id: string; name: string };
          lace: { id: string; name: string; costPerMeterGreige: number | null };
        }>
      >(`${BASE_URL}/lookup-lace`, { processorId, laceId, quantityMeters }, { headers: getAuthHeader() });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },
};

export default processorRateCardV2Service;
