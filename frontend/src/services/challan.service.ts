import api from '@/lib/api';
import type {
  Challan,
  ChallanFilters,
  ChallanStats,
  CreateChallanInput,
  ReceiveChallanInput,
} from '@/types/challan.types';

const BASE_URL = '/api/challans';

export const challanService = {
  // List challans with filters
  async getChallans(filters?: ChallanFilters): Promise<{
    data: Challan[];
    pagination: { total: number; limit: number; offset: number };
  }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const { data } = await api.get(`${BASE_URL}?${params.toString()}`);
    return data;
  },

  // Get single challan by ID
  async getChallanById(id: string): Promise<Challan> {
    const { data } = await api.get(`${BASE_URL}/${id}`);
    return data.data;
  },

  // Create new challan
  async createChallan(input: CreateChallanInput): Promise<Challan> {
    const { data } = await api.post(BASE_URL, input);
    return data.data;
  },

  // Issue challan (DRAFT → ISSUED)
  async issueChallan(id: string): Promise<Challan> {
    const { data } = await api.put(`${BASE_URL}/${id}/issue`);
    return data.data;
  },

  // Receive challan
  async receiveChallan(id: string, input: ReceiveChallanInput): Promise<Challan> {
    const { data } = await api.put(`${BASE_URL}/${id}/receive`, input);
    return data.data;
  },

  // Cancel challan
  async cancelChallan(id: string): Promise<Challan> {
    const { data } = await api.put(`${BASE_URL}/${id}/cancel`);
    return data.data;
  },

  // Get challan stats
  async getChallanStats(filters?: { orderId?: string; productionRunId?: string }): Promise<ChallanStats> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const { data } = await api.get(`${BASE_URL}/stats?${params.toString()}`);
    return data.data;
  },

  // Resolve PO rate
  async resolveRate(params: {
    poCategory: string;
    styleId?: string;
    supplierId?: string;
    materialId?: string;
    fabricId?: string;
    laceId?: string;
    serviceType?: string;
    costSheetId?: string;
  }): Promise<{
    rate: number | null;
    source: string;
    lastPriceForStyle?: { rate: number; poNumber: string; poDate: string } | null;
  }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value);
    });
    const { data } = await api.get(`/api/po-rates/resolve?${searchParams.toString()}`);
    return data.data;
  },

  // Split production run
  async splitProductionRun(
    id: string,
    splits: { quantity: number; fabricLotInfo?: Record<string, any>; remarks?: string }[]
  ): Promise<{
    parent: { id: string; workOrderNumber: string; status: string; totalQuantity: number };
    children: { id: string; workOrderNumber: string; totalQuantity: number; fabricLotInfo?: any }[];
  }> {
    const { data } = await api.post(`/api/production-runs/${id}/split`, { splits });
    return data.data;
  },
};
