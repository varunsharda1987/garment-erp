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

  // Accessory Presets
  getAccessoryPresets: async (customerId: string): Promise<any[]> => {
    const response = await api.get(`/customers/${customerId}/accessory-presets`);
    return response.data.data || [];
  },

  getDefaultAccessoryPreset: async (customerId: string): Promise<any | null> => {
    const response = await api.get(`/customers/${customerId}/accessory-presets/default`);
    return response.data.data || null;
  },
};
