// Label Service - API calls for label management
import api from '../lib/api';
import type {
  Label,
  LabelFormData,
  LabelListResponse,
  LabelResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/label.types';

/**
 * Get all label items with pagination and filters
 */
export const getAllLabels = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
}): Promise<LabelListResponse> => {
  const { data } = await api.get<LabelListResponse>('/materials/label', {
    params,
  });
  return data;
};

/**
 * Get label by ID
 */
export const getLabelById = async (id: string): Promise<Label> => {
  const { data } = await api.get<Label>(`/materials/label/${id}`);
  return data;
};

/**
 * Create new label
 */
export const createLabel = async (labelData: LabelFormData): Promise<Label> => {
  // Convert string numbers to numbers
  const payload = {
    ...labelData,
    pricePerPiece: labelData.pricePerPiece ? Number(labelData.pricePerPiece) : undefined,
    pricePerHundred: labelData.pricePerHundred ? Number(labelData.pricePerHundred) : undefined,
  };

  const { data } = await api.post<LabelResponse>('/materials/label', payload);
  return data.label;
};

/**
 * Update label
 */
export const updateLabel = async (id: string, labelData: LabelFormData): Promise<Label> => {
  // Convert string numbers to numbers
  const payload = {
    ...labelData,
    pricePerPiece: labelData.pricePerPiece ? Number(labelData.pricePerPiece) : undefined,
    pricePerHundred: labelData.pricePerHundred ? Number(labelData.pricePerHundred) : undefined,
  };

  const { data } = await api.put<LabelResponse>(`/materials/label/${id}`, payload);
  return data.label;
};

/**
 * Delete label (hard delete with validation)
 */
export const deleteLabel = async (id: string): Promise<void> => {
  await api.delete(`/materials/label/${id}`);
};

/**
 * Bulk import label items from Excel data
 */
export const bulkImportLabels = async (
  data: BulkImportRow[],
  createStock?: boolean
): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>(
    '/materials/label/bulk-import',
    { data, createStock }
  );
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/label/template');
  return data;
};
