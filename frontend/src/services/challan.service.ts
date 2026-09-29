import api from '@/lib/api';
import type {
  Challan,
  ChallanFilters,
  ChallanStats,
  CreateChallanInput,
  CreateTransitChallanRequest,
  ReceiveChallanInput,
  TodaySummary,
  TransitChallan,
} from '@/types/challan.types';

const BASE_URL = '/challans';

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

  // Quick issue: Create + Issue challan in one step. takeHeld = the user confirmed taking goods held for other
  // orders (the server refuses with 409 STOCK_HELD_FOR_ORDER first — hooks/useHeldStockConfirm)
  async quickIssueChallan(input: CreateChallanInput, takeHeld = false): Promise<Challan> {
    const { data } = await api.post(`${BASE_URL}/quick-issue`, takeHeld ? { ...input, takeHeld } : input);
    return data.data;
  },

  // Issue challan (DRAFT → ISSUED); takeHeld as for quick issue
  async issueChallan(id: string, takeHeld = false): Promise<Challan> {
    const { data } = await api.put(`${BASE_URL}/${id}/issue`, takeHeld ? { takeHeld } : {});
    return data.data;
  },

  // Receive challan
  async receiveChallan(id: string, input: ReceiveChallanInput): Promise<Challan> {
    const { data } = await api.put(`${BASE_URL}/${id}/receive`, input);
    return data.data;
  },

  // Goods-in-transit challan (2026-09-29): our Rule 45 challan for goods a supplier despatched straight to a
  // processor, issued before they arrive; the receipt adopts it on arrival
  async issueTransitChallan(input: CreateTransitChallanRequest): Promise<{ id: string; challanNumber: string }> {
    const { data } = await api.post(`${BASE_URL}/goods-in-transit`, input);
    return data.data;
  },

  async getTransitChallans(poId: string): Promise<TransitChallan[]> {
    const { data } = await api.get(`${BASE_URL}/goods-in-transit`, { params: { poId } });
    return data.data;
  },

  // The truck never came / the goods went elsewhere — only while nothing was received against it
  async cancelTransitChallan(id: string, reason: string): Promise<{ challanNumber: string; warning: string | null }> {
    const { data } = await api.patch(`${BASE_URL}/${id}/cancel-transit`, { reason });
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

  // Get today's outward challan summary (greige dept register)
  async getTodaySummary(): Promise<TodaySummary> {
    const { data } = await api.get(`${BASE_URL}/today-summary`);
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
    const { data } = await api.get(`/po-rates/resolve?${searchParams.toString()}`);
    return data.data;
  },

  // Split production run
  async splitProductionRun(
    id: string,
    splits: { quantity: number; fabricLotInfo?: Record<string, unknown>; remarks?: string }[]
  ): Promise<{
    parent: { id: string; workOrderNumber: string; status: string; totalQuantity: number };
    children: { id: string; workOrderNumber: string; totalQuantity: number; fabricLotInfo?: Record<string, unknown> }[];
  }> {
    const { data } = await api.post(`/production-runs/${id}/split`, { splits });
    return data.data;
  },
};
