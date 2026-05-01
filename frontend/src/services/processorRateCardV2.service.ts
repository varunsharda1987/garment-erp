/**
 * Processor Rate Card V2 Service
 * API calls for matrix-based processor rate card management
 */

import api from '@/lib/api';
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

const BASE_URL = '/processor-rate-cards/v2';

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
    const response = await api.get<ApiResponse<ProcessorRateCardSummary>>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  /**
   * Get all DYEING/PRINTING processors
   */
  async getProcessors(): Promise<ProcessorInfo[]> {
    const response = await api.get<ApiResponse<ProcessorInfo[]>>(`${BASE_URL}/processors`);
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
    const response = await api.get<ApiResponse<ProcessorRateMatrixFromAPI>>(url);

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
    const response = await api.get<ApiResponse<GreigeForRateCard[]>>(`${BASE_URL}/greiges`);
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
    const response = await api.post<ApiResponse<SlabDefinition[]>>(`${BASE_URL}/processors/${processorId}/slabs`, {
      processingType,
      slabs,
    });
    return response.data.data;
  },

  /**
   * Bulk save rate matrix
   */
  async saveMatrix(processorId: string, request: SaveMatrixRequest): Promise<void> {
    await api.put(`${BASE_URL}/processors/${processorId}/matrix`, request);
  },

  /**
   * Copy rates between processors
   */
  async copyRates(input: CopyRatesInput): Promise<void> {
    await api.post(`${BASE_URL}/copy`, input);
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
    await api.post(`${BASE_URL}/processors/${processorId}/greiges/${greigeId}`, body);
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
    await api.delete(url);
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
      const response = await api.post<
        ApiResponse<{
          id: string;
          ratePerMeter: number;
          totalCost: number;
          slabLabel: string;
        }>
      >(`${BASE_URL}/lookup`, body);
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
    const response = await api.get<ApiResponse<GreigeLaceForRateCard[]>>(`${BASE_URL}/laces`);
    return response.data.data;
  },

  /**
   * Get lace rate matrix for a processor
   */
  async getLaceProcessorMatrix(processorId: string): Promise<LaceRateMatrix> {
    const response = await api.get<ApiResponse<LaceRateMatrixFromAPI>>(
      `${BASE_URL}/processors/${processorId}/lace-matrix`
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
    await api.put(`${BASE_URL}/processors/${processorId}/lace-matrix`, request);
  },

  /**
   * Add lace row to processor's matrix
   */
  async addLace(processorId: string, laceId: string): Promise<void> {
    await api.post(`${BASE_URL}/processors/${processorId}/laces/${laceId}`, {});
  },

  /**
   * Remove lace row from processor's matrix
   */
  async removeLace(processorId: string, laceId: string): Promise<void> {
    await api.delete(`${BASE_URL}/processors/${processorId}/laces/${laceId}`);
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
      const response = await api.post<
        ApiResponse<{
          ratePerMeter: number;
          totalCost: number;
          shrinkagePercent: number | null;
          slab: { id: string; label: string; minQuantity: number; maxQuantity: number };
          processor: { id: string; name: string };
          lace: { id: string; name: string; costPerMeterGreige: number | null };
        }>
      >(`${BASE_URL}/lookup-lace`, { processorId, laceId, quantityMeters });
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
