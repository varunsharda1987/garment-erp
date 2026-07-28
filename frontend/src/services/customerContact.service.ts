// Customer Contact service
import api from '../lib/api';
import type {
  CustomerContact,
  CreateCustomerContactRequest,
  UpdateCustomerContactRequest,
} from '../types/customerContact.types';

interface CustomerContactResponse {
  data: CustomerContact;
  message?: string;
}

interface CustomerContactListResponse {
  data: CustomerContact[];
}

export const customerContactService = {
  /**
   * Get all contacts for a customer
   */
  getByCustomerId: async (customerId: string, params?: { isActive?: boolean }): Promise<CustomerContact[]> => {
    const queryParams = new URLSearchParams();
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    const query = queryParams.toString();
    const url = `/customer-contacts/customer/${customerId}${query ? `?${query}` : ''}`;
    const response = await api.get<CustomerContactListResponse>(url);
    return response.data.data;
  },

  /**
   * Get contact by ID
   */
  getById: async (id: string): Promise<CustomerContact> => {
    const response = await api.get<CustomerContactResponse>(`/customer-contacts/${id}`);
    return response.data.data;
  },

  /**
   * Create new contact
   */
  create: async (data: CreateCustomerContactRequest): Promise<CustomerContact> => {
    const response = await api.post<CustomerContactResponse>('/customer-contacts', data);
    return response.data.data;
  },

  /**
   * Update contact
   */
  update: async (id: string, data: UpdateCustomerContactRequest): Promise<CustomerContact> => {
    const response = await api.put<CustomerContactResponse>(`/customer-contacts/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete contact
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/customer-contacts/${id}`);
  },

  /**
   * Set contact as primary
   */
  setPrimary: async (id: string): Promise<CustomerContact> => {
    const response = await api.put<CustomerContactResponse>(`/customer-contacts/${id}/set-primary`);
    return response.data.data;
  },
};
