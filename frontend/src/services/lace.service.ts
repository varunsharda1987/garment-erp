// Lace Service - API calls for lace management
import api from '../lib/api';
import type {
  Lace,
  LaceFormData,
  LaceListResponse,
  LaceResponse,
  BulkImportResponse,
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
  // Convert string numbers to numbers
  const payload = {
    ...laceData,
    width: laceData.width ? Number(laceData.width) : undefined,
    pricePerMeter: laceData.pricePerMeter ? Number(laceData.pricePerMeter) : undefined,
  };

  const { data } = await api.post<LaceResponse>('/materials/lace', payload);
  return data.lace;
};

/**
 * Update lace
 */
export const updateLace = async (id: string, laceData: LaceFormData): Promise<Lace> => {
  // Convert string numbers to numbers
  const payload = {
    ...laceData,
    width: laceData.width ? Number(laceData.width) : undefined,
    pricePerMeter: laceData.pricePerMeter ? Number(laceData.pricePerMeter) : undefined,
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
  data: any[],
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
