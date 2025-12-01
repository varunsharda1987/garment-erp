// Elastic Service - API calls for elastic management
import api from '../lib/api';
import type {
  Elastic,
  ElasticFormData,
  ElasticListResponse,
  ElasticResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/elastic.types';

/**
 * Get all elastic items with pagination and filters
 */
export const getAllElastics = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
}): Promise<ElasticListResponse> => {
  const { data } = await api.get<ElasticListResponse>('/materials/elastic', {
    params,
  });
  return data;
};

/**
 * Get elastic by ID
 */
export const getElasticById = async (id: string): Promise<Elastic> => {
  const { data } = await api.get<Elastic>(`/materials/elastic/${id}`);
  return data;
};

/**
 * Create new elastic
 */
export const createElastic = async (elasticData: ElasticFormData): Promise<Elastic> => {
  // Convert string numbers to numbers
  const payload = {
    ...elasticData,
    width: elasticData.width ? Number(elasticData.width) : undefined,
    stretchPercent: elasticData.stretchPercent ? Number(elasticData.stretchPercent) : undefined,
    pricePerMeter: elasticData.pricePerMeter ? Number(elasticData.pricePerMeter) : undefined,
  };

  const { data } = await api.post<ElasticResponse>('/materials/elastic', payload);
  return data.elastic;
};

/**
 * Update elastic
 */
export const updateElastic = async (id: string, elasticData: ElasticFormData): Promise<Elastic> => {
  // Convert string numbers to numbers
  const payload = {
    ...elasticData,
    width: elasticData.width ? Number(elasticData.width) : undefined,
    stretchPercent: elasticData.stretchPercent ? Number(elasticData.stretchPercent) : undefined,
    pricePerMeter: elasticData.pricePerMeter ? Number(elasticData.pricePerMeter) : undefined,
  };

  const { data } = await api.put<ElasticResponse>(`/materials/elastic/${id}`, payload);
  return data.elastic;
};

/**
 * Delete elastic (hard delete with validation)
 */
export const deleteElastic = async (id: string): Promise<void> => {
  await api.delete(`/materials/elastic/${id}`);
};

/**
 * Bulk import elastic items from Excel data
 */
export const bulkImportElastics = async (
  data: BulkImportRow[],
  createStock?: boolean
): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>(
    '/materials/elastic/bulk-import',
    { data, createStock }
  );
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/elastic/template');
  return data;
};
