import api from '@/lib/api';
import type {
  MachinePart,
  MachinePartListResponse,
  CreateMachinePartRequest,
  UpdateMachinePartRequest,
} from '@/types/machinePart.types';

/**
 * Get all machine parts with pagination and filters
 */
export const getAllMachineParts = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
}): Promise<MachinePartListResponse> => {
  const response = await api.get('/materials/machine-part', { params });
  return response.data;
};

/**
 * Get a single machine part by ID
 */
export const getMachinePartById = async (id: string): Promise<MachinePart> => {
  const response = await api.get(`/materials/machine-part/${id}`);
  return response.data;
};

/**
 * Create a new machine part
 */
export const createMachinePart = async (
  data: CreateMachinePartRequest
): Promise<{ machinePart: MachinePart; material: any; message: string }> => {
  const response = await api.post('/materials/machine-part', data);
  return response.data;
};

/**
 * Update an existing machine part
 */
export const updateMachinePart = async (
  id: string,
  data: UpdateMachinePartRequest
): Promise<{ machinePart: MachinePart; message: string }> => {
  const response = await api.put(`/materials/machine-part/${id}`, data);
  return response.data;
};

/**
 * Delete a machine part
 */
export const deleteMachinePart = async (id: string): Promise<void> => {
  await api.delete(`/materials/machine-part/${id}`);
};

/**
 * Bulk import machine parts from Excel
 */
export const bulkImportMachineParts = async (data: { data: any[]; createStock?: boolean }): Promise<any> => {
  const response = await api.post('/materials/machine-part/bulk-import', data);
  return response.data;
};

/**
 * Download Excel template for bulk import
 */
export const downloadMachinePartTemplate = async (): Promise<any> => {
  const response = await api.get('/materials/machine-part/template');
  return response.data;
};
