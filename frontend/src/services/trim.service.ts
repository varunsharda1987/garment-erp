/**
 * Trim Masters Dashboard Service
 * Provides API calls for the unified trim masters dashboard
 */
import api from '../lib/api';

// Types
export interface TrimSummary {
  buttons: { count: number; active: number };
  zippers: { count: number; active: number };
  laces: { count: number; active: number };
  threads: { count: number; active: number };
  elastic: { count: number; active: number };
  labels: { count: number; active: number };
}

export interface TrimSummaryResponse {
  data: TrimSummary;
  total: number;
}

export interface TrimItem {
  id: string;
  code: string;
  name: string;
  type: 'BUTTON' | 'ZIPPER' | 'LACE' | 'THREAD' | 'ELASTIC' | 'LABEL';
  color: string | null;
  price: number | null;
  unit: string;
  isActive?: boolean;
  createdAt: string;
}

export interface TrimSearchResponse {
  data: TrimItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TrimRecentResponse {
  data: TrimItem[];
  count: number;
}

export type TrimType = 'BUTTON' | 'ZIPPER' | 'LACE' | 'THREAD' | 'ELASTIC' | 'LABEL' | '';

export interface TrimSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: TrimType;
}

export const trimService = {
  /**
   * Get summary counts for all trim types
   */
  getSummary: async (): Promise<TrimSummaryResponse> => {
    const response = await api.get<TrimSummaryResponse>('/trims/summary');
    return response.data;
  },

  /**
   * Search across all trim types with unified results
   */
  searchAll: async (params: TrimSearchParams = {}): Promise<TrimSearchResponse> => {
    const { page = 1, limit = 20, search = '', type = '' } = params;
    let url = `/trims/search?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (type) {
      url += `&type=${type}`;
    }
    const response = await api.get<TrimSearchResponse>(url);
    return response.data;
  },

  /**
   * Get recent trims across all types
   */
  getRecent: async (limit: number = 10): Promise<TrimRecentResponse> => {
    const response = await api.get<TrimRecentResponse>(`/trims/recent?limit=${limit}`);
    return response.data;
  }
};

export default trimService;
