import api from '@/lib/api';
import type {
  CustomerSizePreset,
  CreateCustomerSizePresetRequest,
  UpdateCustomerSizePresetRequest,
  CloneCustomerSizePresetRequest,
} from '@/types/customerSizePreset.types';

/**
 * Get all size category presets for a customer
 */
export const getAllPresetsForCustomer = async (
  customerId: string
): Promise<CustomerSizePreset[]> => {
  const response = await api.get(`/customers/${customerId}/size-category-presets`);
  return response.data.data;
};

/**
 * Get default size category preset for a customer
 */
export const getDefaultPreset = async (
  customerId: string
): Promise<CustomerSizePreset> => {
  const response = await api.get(`/customers/${customerId}/size-category-presets/default`);
  return response.data.data;
};

/**
 * Get a specific size category preset by ID
 */
export const getPresetById = async (
  customerId: string,
  presetId: string
): Promise<CustomerSizePreset> => {
  const response = await api.get(`/customers/${customerId}/size-category-presets/${presetId}`);
  return response.data.data;
};

/**
 * Create a new size category preset
 */
export const createPreset = async (
  customerId: string,
  data: CreateCustomerSizePresetRequest
): Promise<CustomerSizePreset> => {
  const response = await api.post(`/customers/${customerId}/size-category-presets`, data);
  return response.data.data;
};

/**
 * Update a size category preset
 */
export const updatePreset = async (
  customerId: string,
  presetId: string,
  data: UpdateCustomerSizePresetRequest
): Promise<CustomerSizePreset> => {
  const response = await api.put(`/customers/${customerId}/size-category-presets/${presetId}`, data);
  return response.data.data;
};

/**
 * Delete a size category preset
 */
export const deletePreset = async (
  customerId: string,
  presetId: string
): Promise<void> => {
  await api.delete(`/customers/${customerId}/size-category-presets/${presetId}`);
};

/**
 * Set a preset as default
 */
export const setAsDefault = async (
  customerId: string,
  presetId: string
): Promise<CustomerSizePreset> => {
  const response = await api.post(`/customers/${customerId}/size-category-presets/${presetId}/set-default`);
  return response.data.data;
};

/**
 * Clone a size category preset
 */
export const clonePreset = async (
  customerId: string,
  presetId: string,
  data: CloneCustomerSizePresetRequest
): Promise<CustomerSizePreset> => {
  const response = await api.post(`/customers/${customerId}/size-category-presets/${presetId}/clone`, data);
  return response.data.data;
};
