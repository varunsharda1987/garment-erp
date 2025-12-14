import api from '@/lib/api';
import type {
  ProductionStatusListResponse,
  ProductionStatusQueryOptions,
  ProductionStatusSummary,
} from '@/types/productionStatus.types';

export const productionStatusService = {
  getAll: async (options: Partial<ProductionStatusQueryOptions> = {}): Promise<ProductionStatusListResponse> => {
    const { data } = await api.get('/production-status', { params: options });
    return data;
  },

  getSummary: async (): Promise<ProductionStatusSummary> => {
    const { data } = await api.get('/production-status/summary');
    return data.data;
  },
};
