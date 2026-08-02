import api from '@/lib/api';
import type {
  OtherMaterial,
  OtherMaterialListResponse,
  CreateOtherMaterialRequest,
  UpdateOtherMaterialRequest,
  OtherMaterialTemplateColumn,
  OtherMaterialTemplateResponse,
} from '@/types/otherMaterial.types';

/**
 * Get all other materials with pagination and filters
 */
export const getAllOtherMaterials = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  category?: string;
}): Promise<OtherMaterialListResponse> => {
  const response = await api.get('/materials/other', { params });
  return response.data;
};

/**
 * Get a single other material by ID
 */
export const getOtherMaterialById = async (id: string): Promise<OtherMaterial> => {
  const response = await api.get(`/materials/other/${id}`);
  return response.data;
};

/**
 * Create a new other material
 */
export const createOtherMaterial = async (
  data: CreateOtherMaterialRequest
): Promise<{
  otherMaterial: OtherMaterial;
  // BUG-OM5 fix: Backend creates string IDs like `mat-${code}`, not numbers
  material: { id: string; materialType: string; code: string; name: string };
  message: string;
}> => {
  const response = await api.post('/materials/other', data);
  return response.data;
};

/**
 * Update an existing other material
 */
export const updateOtherMaterial = async (
  id: string,
  data: UpdateOtherMaterialRequest
): Promise<{ otherMaterial: OtherMaterial; message: string }> => {
  const response = await api.put(`/materials/other/${id}`, data);
  return response.data;
};

/**
 * Delete an other material
 */
export const deleteOtherMaterial = async (id: string): Promise<void> => {
  await api.delete(`/materials/other/${id}`);
};

/**
 * Bulk import result for a single row
 */
// BUG-OM2 fix: row result structure matches backend controller lines 494-509
interface BulkImportRowResult {
  success: boolean;
  row: number;
  materialCode?: string;
  materialName?: string;
  stockCreated?: boolean;
  error?: string;
}

/**
 * Bulk import response from backend
 * Backend returns: { results, summary, message } (controller lines 518-522)
 */
// BUG-OM2 fix: aligned with backend response - was expecting { imported, errors }
export interface BulkImportOtherMaterialsResponse {
  results: BulkImportRowResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  message: string;
}

/**
 * Bulk import other materials from Excel
 */
// BUG-OM2 fix: return type matches backend response structure
export const bulkImportOtherMaterials = async (data: {
  data: Record<string, unknown>[];
  createStock?: boolean;
}): Promise<BulkImportOtherMaterialsResponse> => {
  const response = await api.post('/materials/other/bulk-import', data);
  return response.data;
};

/**
 * Download Excel template for bulk import
 * BUG-OM3 fix: Updated return type to match backend response
 * Backend returns: { columns: [{field, header, required, description}], exampleData: [...] }
 */
export const downloadOtherMaterialTemplate = async (): Promise<OtherMaterialTemplateResponse> => {
  const response = await api.get('/materials/other/template');
  return response.data;
};

// Re-export template types for consumers that import from service
// BUG-OM3 fix
export type { OtherMaterialTemplateColumn, OtherMaterialTemplateResponse };
