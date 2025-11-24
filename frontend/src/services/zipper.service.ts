// Zipper Service - API calls for zipper management
import api from '../lib/api';
import type {
  Zipper,
  ZipperFormData,
  ZipperListResponse,
  ZipperResponse,
  BulkImportResponse,
  TemplateResponse,
} from '../types/zipper.types';

/**
 * Get all zipper items with pagination and filters
 */
export const getAllZippers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
}): Promise<ZipperListResponse> => {
  const { data } = await api.get<ZipperListResponse>('/materials/zipper', {
    params,
  });
  return data;
};

/**
 * Get zipper by ID
 */
export const getZipperById = async (id: string): Promise<Zipper> => {
  const { data } = await api.get<Zipper>(`/materials/zipper/${id}`);
  return data;
};

/**
 * Create new zipper
 */
export const createZipper = async (zipperData: ZipperFormData): Promise<Zipper> => {
  // Convert string numbers to numbers
  const payload = {
    ...zipperData,
    length: zipperData.length ? Number(zipperData.length) : undefined,
    tapeWidth: zipperData.tapeWidth ? Number(zipperData.tapeWidth) : undefined,
    pricePerPiece: zipperData.pricePerPiece ? Number(zipperData.pricePerPiece) : undefined,
  };

  const { data } = await api.post<ZipperResponse>('/materials/zipper', payload);
  return data.zipper;
};

/**
 * Update zipper
 */
export const updateZipper = async (id: string, zipperData: ZipperFormData): Promise<Zipper> => {
  // Convert string numbers to numbers
  const payload = {
    ...zipperData,
    length: zipperData.length ? Number(zipperData.length) : undefined,
    tapeWidth: zipperData.tapeWidth ? Number(zipperData.tapeWidth) : undefined,
    pricePerPiece: zipperData.pricePerPiece ? Number(zipperData.pricePerPiece) : undefined,
  };

  const { data } = await api.put<ZipperResponse>(`/materials/zipper/${id}`, payload);
  return data.zipper;
};

/**
 * Delete zipper (hard delete with validation)
 */
export const deleteZipper = async (id: string): Promise<void> => {
  await api.delete(`/materials/zipper/${id}`);
};

/**
 * Bulk import zipper items from Excel data
 */
export const bulkImportZippers = async (
  data: any[],
  createStock?: boolean
): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>(
    '/materials/zipper/bulk-import',
    { data, createStock }
  );
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/zipper/template');
  return data;
};
