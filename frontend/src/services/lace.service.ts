// Lace Service - API calls for lace management
import api from '../lib/api';
import type {
  Lace,
  LaceFormData,
  LaceListResponse,
  LaceResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/lace.types';

/**
 * Get all lace items with pagination and filters
 */
export const getAllLace = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  styleCode?: string;
  isGreige?: string; // 'true' or 'false' - filter by greige status
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace', {
    params,
  });
  return data;
};

/**
 * Get lace by ID
 */
export const getLaceById = async (id: string): Promise<Lace> => {
  const { data } = await api.get<Lace>(`/materials/lace/${id}`);
  return data;
};

/**
 * Create new lace
 */
export const createLace = async (laceData: LaceFormData): Promise<Lace> => {
  // Convert string numbers to numbers and format suppliers
  const payload = {
    ...laceData,
    width: laceData.width ? Number(laceData.width) : undefined,
    styleCodes: laceData.styleCodes || [],
    suppliers: laceData.suppliers?.map(s => ({
      supplierId: s.supplierId,
      isPreferred: s.isPreferred,
      isActive: s.isActive,
      notes: s.notes,
      pricePerMeter: s.pricePerMeter ? Number(s.pricePerMeter) : undefined,
    })) || [],
    // Greige-specific fields
    isGreige: laceData.isGreige || false,
    expectedShrinkagePercent: laceData.expectedShrinkagePercent
      ? Number(laceData.expectedShrinkagePercent)
      : undefined,
    costPerMeterGreige: laceData.costPerMeterGreige
      ? Number(laceData.costPerMeterGreige)
      : undefined,
    sourceGreigeLaceId: laceData.sourceGreigeLaceId || undefined,
  };

  const { data } = await api.post<LaceResponse>('/materials/lace', payload);
  return data.lace;
};

/**
 * Update lace
 */
export const updateLace = async (id: string, laceData: LaceFormData): Promise<Lace> => {
  // Convert string numbers to numbers and format suppliers
  const payload = {
    ...laceData,
    width: laceData.width ? Number(laceData.width) : undefined,
    styleCodes: laceData.styleCodes || [],
    suppliers: laceData.suppliers?.map(s => ({
      supplierId: s.supplierId,
      isPreferred: s.isPreferred,
      isActive: s.isActive,
      notes: s.notes,
      pricePerMeter: s.pricePerMeter ? Number(s.pricePerMeter) : undefined,
    })) || [],
    // Greige-specific fields
    isGreige: laceData.isGreige || false,
    expectedShrinkagePercent: laceData.expectedShrinkagePercent
      ? Number(laceData.expectedShrinkagePercent)
      : undefined,
    costPerMeterGreige: laceData.costPerMeterGreige
      ? Number(laceData.costPerMeterGreige)
      : undefined,
    sourceGreigeLaceId: laceData.sourceGreigeLaceId || undefined,
  };

  const { data } = await api.put<LaceResponse>(`/materials/lace/${id}`, payload);
  return data.lace;
};

/**
 * Delete lace (hard delete with validation)
 */
export const deleteLace = async (id: string): Promise<void> => {
  await api.delete(`/materials/lace/${id}`);
};

/**
 * Bulk import lace items from Excel data
 */
export const bulkImportLace = async (
  data: BulkImportRow[],
  createStock?: boolean
): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>(
    '/materials/lace/bulk-import',
    { data, createStock }
  );
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/lace/template');
  return data;
};

/**
 * Get greige (raw) lace items only - for dyeing/processing selection
 */
export const getGreigeLace = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace/greige', {
    params,
  });
  return data;
};

/**
 * Get finished (ready-to-use) lace items only
 */
export const getFinishedLace = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  color?: string;
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace/finished', {
    params,
  });
  return data;
};

/**
 * Get lace items formatted for cost sheet selection
 */
export const getLaceForCosting = async (params?: {
  search?: string;
}): Promise<LaceListResponse> => {
  const { data } = await api.get<LaceListResponse>('/materials/lace/for-costing', {
    params,
  });
  return data;
};
