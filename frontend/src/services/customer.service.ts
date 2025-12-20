// Customer service
import api from '../lib/api';
import type {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerListResponse,
  CustomerResponse,
} from '../types/customer.types';

export const customerService = {
  getAllCustomers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    category?: string;
  }): Promise<CustomerListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.category) queryParams.append('category', params.category);

    const response = await api.get<CustomerListResponse>(`/customers?${queryParams.toString()}`);
    return response.data;
  },

  getCustomerById: async (id: string): Promise<Customer> => {
    const response = await api.get<CustomerResponse>(`/customers/${id}`);
    return response.data.data;
  },

  createCustomer: async (data: CreateCustomerRequest): Promise<Customer> => {
    const response = await api.post<CustomerResponse>('/customers', data);
    return response.data.data;
  },

  updateCustomer: async (id: string, data: UpdateCustomerRequest): Promise<Customer> => {
    const response = await api.put<CustomerResponse>(`/customers/${id}`, data);
    return response.data.data;
  },

  deleteCustomer: async (id: string): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },

  canDeactivate: async (id: string): Promise<DeactivationCheck> => {
    const response = await api.get<DeactivationCheck>(`/customers/${id}/can-deactivate`);
    return response.data;
  },

  // Accessory Presets
  getAccessoryPresets: async (customerId: string): Promise<AccessoryPreset[]> => {
    const response = await api.get(`/customers/${customerId}/accessory-presets`);
    return response.data.data || [];
  },

  getDefaultAccessoryPreset: async (customerId: string): Promise<AccessoryPreset | null> => {
    const response = await api.get(`/customers/${customerId}/accessory-presets/default`);
    return response.data.data || null;
  },

  getAccessoryPresetById: async (customerId: string, presetId: string): Promise<AccessoryPreset> => {
    const response = await api.get(`/customers/${customerId}/accessory-presets/${presetId}`);
    return response.data.data;
  },

  createAccessoryPreset: async (customerId: string, data: CreateAccessoryPresetRequest): Promise<AccessoryPreset> => {
    const response = await api.post(`/customers/${customerId}/accessory-presets`, data);
    return response.data.data;
  },

  updateAccessoryPreset: async (customerId: string, presetId: string, data: UpdateAccessoryPresetRequest): Promise<AccessoryPreset> => {
    const response = await api.put(`/customers/${customerId}/accessory-presets/${presetId}`, data);
    return response.data.data;
  },

  deleteAccessoryPreset: async (customerId: string, presetId: string): Promise<void> => {
    await api.delete(`/customers/${customerId}/accessory-presets/${presetId}`);
  },

  setDefaultAccessoryPreset: async (customerId: string, presetId: string): Promise<AccessoryPreset> => {
    const response = await api.post(`/customers/${customerId}/accessory-presets/${presetId}/set-default`);
    return response.data.data;
  },
};

// Types for Accessory Presets
export interface AccessoryPresetItem {
  id: string;
  materialType: string;
  materialId?: string;
  itemName: string;
  quantity: number;
  unit?: string;
  usageCategory: 'GARMENT' | 'PACKAGING';
  specification?: string;
  sortOrder?: number;
}

export interface AccessoryPreset {
  id: string;
  customerId: string;
  presetName: string;
  description?: string;
  accessoryItems: AccessoryPresetItem[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccessoryPresetRequest {
  presetName: string;
  description?: string;
  accessoryItems: Omit<AccessoryPresetItem, 'id' | 'sortOrder'>[];
  isDefault?: boolean;
}

export interface UpdateAccessoryPresetRequest {
  presetName?: string;
  description?: string;
  accessoryItems?: Omit<AccessoryPresetItem, 'id' | 'sortOrder'>[];
  isDefault?: boolean;
  isActive?: boolean;
}

// Named exports for convenience (these call the customerService methods)
export const getAllCustomers = customerService.getAllCustomers;
export const getCustomerById = customerService.getCustomerById;
export const createCustomer = customerService.createCustomer;
export const updateCustomer = customerService.updateCustomer;
export const deleteCustomer = customerService.deleteCustomer;
export const getAccessoryPresets = customerService.getAccessoryPresets;
export const getDefaultAccessoryPreset = customerService.getDefaultAccessoryPreset;
export const getAccessoryPresetById = customerService.getAccessoryPresetById;
export const createAccessoryPreset = customerService.createAccessoryPreset;
export const updateAccessoryPreset = customerService.updateAccessoryPreset;
export const deleteAccessoryPreset = customerService.deleteAccessoryPreset;
export const setDefaultAccessoryPreset = customerService.setDefaultAccessoryPreset;
export const canDeactivate = customerService.canDeactivate;

// Deactivation check type
export interface DeactivationCheck {
  canDeactivate: boolean;
  blockers: { type: string; count: number }[];
  message: string;
}
