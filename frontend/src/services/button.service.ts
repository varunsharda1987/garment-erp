// Button Service - API calls for button management
import api from '../lib/api';
import type {
  Button,
  ButtonFormData,
  ButtonListResponse,
  ButtonResponse,
  BulkImportResponse,
  BulkImportRow,
  TemplateResponse,
} from '../types/button.types';

/**
 * Get all button items with pagination and filters
 */
export const getAllButtons = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
}): Promise<ButtonListResponse> => {
  const { data } = await api.get<ButtonListResponse>('/materials/button', {
    params,
  });
  return data;
};

/**
 * Get button by ID
 */
export const getButtonById = async (id: string): Promise<Button> => {
  const { data } = await api.get<Button>(`/materials/button/${id}`);
  return data;
};

/**
 * Create new button
 */
export const createButton = async (buttonData: ButtonFormData): Promise<Button> => {
  // Convert string numbers to numbers
  const payload = {
    ...buttonData,
    holes: buttonData.holes ? Number(buttonData.holes) : undefined,
    pricePerPiece: buttonData.pricePerPiece ? Number(buttonData.pricePerPiece) : undefined,
    pricePerGross: buttonData.pricePerGross ? Number(buttonData.pricePerGross) : undefined,
    styleCodes: buttonData.styleCodes || [],
  };

  const { data } = await api.post<ButtonResponse>('/materials/button', payload);
  return data.button;
};

/**
 * Update button
 */
export const updateButton = async (id: string, buttonData: ButtonFormData): Promise<Button> => {
  // Convert string numbers to numbers
  const payload = {
    ...buttonData,
    holes: buttonData.holes ? Number(buttonData.holes) : undefined,
    pricePerPiece: buttonData.pricePerPiece ? Number(buttonData.pricePerPiece) : undefined,
    pricePerGross: buttonData.pricePerGross ? Number(buttonData.pricePerGross) : undefined,
    styleCodes: buttonData.styleCodes || [],
  };

  const { data } = await api.put<ButtonResponse>(`/materials/button/${id}`, payload);
  return data.button;
};

/**
 * Delete button (hard delete with validation)
 */
export const deleteButton = async (id: string): Promise<void> => {
  await api.delete(`/materials/button/${id}`);
};

/**
 * Bulk import button items from Excel data
 */
export const bulkImportButtons = async (data: BulkImportRow[], createStock?: boolean): Promise<BulkImportResponse> => {
  const { data: response } = await api.post<BulkImportResponse>('/materials/button/bulk-import', { data, createStock });
  return response;
};

/**
 * Download template for bulk import
 */
export const downloadTemplate = async (): Promise<TemplateResponse> => {
  const { data } = await api.get<TemplateResponse>('/materials/button/template');
  return data;
};
