import api from '@/lib/api';
import type {
  OtherMaterial,
  OtherMaterialListResponse,
  CreateOtherMaterialRequest,
  UpdateOtherMaterialRequest,
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
  material: { id: number; materialType: string; code: string; name: string };
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
 * Bulk import other materials from Excel
 */
export const bulkImportOtherMaterials = async (data: {
  data: Record<string, unknown>[];
  createStock?: boolean;
}): Promise<{ imported: number; errors: string[] }> => {
  const response = await api.post('/materials/other/bulk-import', data);
  return response.data;
};

/**
 * Download Excel template for bulk import
 */
export const downloadOtherMaterialTemplate = async (): Promise<{
  columns: string[];
  sampleData: Record<string, unknown>[];
}> => {
  const response = await api.get('/materials/other/template');
  return response.data;
};
