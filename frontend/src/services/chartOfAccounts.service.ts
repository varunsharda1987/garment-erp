import api from '../lib/api';
import type {
  ChartOfAccount,
  ChartOfAccountCreate,
} from '../types/financial.types';

const BASE_URL = '/chart-of-accounts';

export const chartOfAccountsService = {
  // Get all accounts with pagination
  getAll: async (page = 1, limit = 100): Promise<{ data: ChartOfAccount[]; total: number; page: number; limit: number }> => {
    const response = await api.get(`${BASE_URL}?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get hierarchy (tree structure)
  getHierarchy: async (): Promise<ChartOfAccount[]> => {
    const response = await api.get(`${BASE_URL}/hierarchy`);
    return response.data.data; // API returns { data: [...] }
  },

  // Get single account
  getById: async (id: number): Promise<ChartOfAccount> => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create account
  create: async (data: ChartOfAccountCreate): Promise<ChartOfAccount> => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update account
  update: async (id: number, data: Partial<ChartOfAccountCreate>): Promise<ChartOfAccount> => {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete account (soft delete)
  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  },
};
