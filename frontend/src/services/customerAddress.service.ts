// Customer Address service
import api from '../lib/api';
import type {
  CustomerAddress,
  CustomerAddressType,
  CreateCustomerAddressRequest,
  UpdateCustomerAddressRequest,
} from '../types/customerAddress.types';

interface CustomerAddressResponse {
  data: CustomerAddress;
  message?: string;
}

interface CustomerAddressListResponse {
  data: CustomerAddress[];
}

interface FormattedAddressResponse {
  data: {
    formatted: string;
  };
}

export const customerAddressService = {
  /**
   * Get all addresses for a customer
   */
  getByCustomerId: async (
    customerId: string,
    params?: { addressType?: CustomerAddressType; isActive?: boolean }
  ): Promise<CustomerAddress[]> => {
    const queryParams = new URLSearchParams();
    if (params?.addressType) queryParams.append('addressType', params.addressType);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    const query = queryParams.toString();
    const url = `/customer-addresses/customer/${customerId}${query ? `?${query}` : ''}`;
    const response = await api.get<CustomerAddressListResponse>(url);
    return response.data.data;
  },

  /**
   * Get addresses by type for a customer
   */
  getByType: async (customerId: string, type: CustomerAddressType): Promise<CustomerAddress[]> => {
    const response = await api.get<CustomerAddressListResponse>(`/customer-addresses/customer/${customerId}/${type}`);
    return response.data.data;
  },

  /**
   * Get address by ID
   */
  getById: async (id: string): Promise<CustomerAddress> => {
    const response = await api.get<CustomerAddressResponse>(`/customer-addresses/${id}`);
    return response.data.data;
  },

  /**
   * Get formatted address for copying
   */
  getFormatted: async (id: string): Promise<string> => {
    const response = await api.get<FormattedAddressResponse>(`/customer-addresses/${id}/formatted`);
    return response.data.data.formatted;
  },

  /**
   * Create new address
   */
  create: async (data: CreateCustomerAddressRequest): Promise<CustomerAddress> => {
    const response = await api.post<CustomerAddressResponse>('/customer-addresses', data);
    return response.data.data;
  },

  /**
   * Update address
   */
  update: async (id: string, data: UpdateCustomerAddressRequest): Promise<CustomerAddress> => {
    const response = await api.put<CustomerAddressResponse>(`/customer-addresses/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete address
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/customer-addresses/${id}`);
  },

  /**
   * Set address as primary for its type
   */
  setPrimary: async (id: string): Promise<CustomerAddress> => {
    const response = await api.put<CustomerAddressResponse>(`/customer-addresses/${id}/set-primary`);
    return response.data.data;
  },
};
