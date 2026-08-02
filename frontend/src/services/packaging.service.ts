// Packaging Service - API calls for packaging management
import api from '../lib/api';
import type {
  Packaging,
  PackagingFormData,
  PackagingListResponse,
  PackagingResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/packaging.types';

/**
 * Get all packaging items with pagination and filters
 */
export const getAllPackaging = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  customerId?: string; // Filter by customer
}): Promise<PackagingListResponse> => {
  const { data } = await api.get<PackagingListResponse>('/materials/packaging', {
    params,
  });
  return data;
};

/**
 * Get packaging by ID
 */
export const getPackagingById = async (id: string): Promise<Packaging> => {
  const { data } = await api.get<Packaging>(`/materials/packaging/${id}`);
  return data;
};

/**
 * Create new packaging
 */
export const createPackaging = async (packagingData: PackagingFormData): Promise<Packaging> => {
  // Convert numeric fields; thickness stays as string (e.g. "40 microns", "3 ply")
  const payload = {
    ...packagingData,
    thickness: packagingData.thickness || undefined,
    pricePerPiece: packagingData.pricePerPiece != null ? Number(packagingData.pricePerPiece) : undefined,
    pricePerHundred: packagingData.pricePerHundred != null ? Number(packagingData.pricePerHundred) : undefined,
  };

  const { data } = await api.post<PackagingResponse>('/materials/packaging', payload);
  return data.packaging;
};

/**
 * Update packaging
 */
export const updatePackaging = async (id: string, packagingData: PackagingFormData): Promise<Packaging> => {
  // Convert numeric fields; thickness stays as string (e.g. "40 microns", "3 ply")
  const payload = {
    ...packagingData,
    thickness: packagingData.thickness || undefined,
    pricePerPiece: packagingData.pricePerPiece != null ? Number(packagingData.pricePerPiece) : undefined,
    pricePerHundred: packagingData.pricePerHundred != null ? Number(packagingData.pricePerHundred) : undefined,
  };

  const { data } = await api.put<PackagingResponse>(`/materials/packaging/${id}`, payload);
  return data.packaging;
};

/**
 * Delete packaging (hard delete with validation)
 */
export const deletePackaging = async (id: string): Promise<void> => {
  await api.delete(`/materials/packaging/${id}`);
};

/**
 * Bulk import packaging items from Excel data
 */
export const bulkImportPackaging = async (
  data: BulkImportRow[],
  createStock?: boolean
): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>('/materials/packaging/bulk-import', {
    data,
    createStock,
  });
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/packaging/template');
  return data;
};
