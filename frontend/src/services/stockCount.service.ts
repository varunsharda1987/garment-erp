// Stock Count Service - API calls for physical inventory counts
import api from '@/lib/api';
import type {
  StockCount,
  CreateStockCountDTO,
  UpdateCountItemDTO,
  VarianceReport,
  CountSummary,
  StockCountFilters,
  ApiResponse,
  StockMovement,
} from '../types/inventory.types';

const BASE_URL = '/stock-counts';

export const stockCountService = {
  /**
   * Get all stock counts with optional filters
   */
  async getAll(filters?: StockCountFilters): Promise<StockCount[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters?.countType) params.append('countType', filters.countType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get<ApiResponse<StockCount[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || [];
  },

  /**
   * Get stock count by ID (with items)
   */
  async getById(id: string): Promise<StockCount> {
    const response = await api.get<ApiResponse<StockCount>>(`${BASE_URL}/${id}`);
    if (!response.data.data) throw new Error('Stock count not found');
    return response.data.data;
  },

  /**
   * Get variance report
   */
  async getVarianceReport(id: string): Promise<VarianceReport> {
    const response = await api.get<ApiResponse<VarianceReport>>(`${BASE_URL}/${id}/variance`);
    return response.data.data || { totalVariance: 0, positiveVariance: 0, negativeVariance: 0, items: [] };
  },

  /**
   * Get count summary for warehouse
   */
  async getCountSummary(warehouseId: string, startDate?: string, endDate?: string): Promise<CountSummary> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get<ApiResponse<CountSummary>>(
      `${BASE_URL}/summary/${warehouseId}${params.toString() ? '?' + params.toString() : ''}`
    );
    return (
      response.data.data || {
        totalCounts: 0,
        draftCounts: 0,
        inProgressCounts: 0,
        completedCounts: 0,
        totalVariance: 0,
      }
    );
  },

  /**
   * Create new stock count
   */
  async create(data: CreateStockCountDTO): Promise<StockCount> {
    const response = await api.post<ApiResponse<StockCount>>(BASE_URL, data);
    if (!response.data.data) throw new Error('Failed to create stock count');
    return response.data.data;
  },

  /**
   * Start counting (DRAFT → IN_PROGRESS)
   */
  async startCounting(id: string): Promise<StockCount> {
    const response = await api.post<ApiResponse<StockCount>>(`${BASE_URL}/${id}/start`, {});
    if (!response.data.data) throw new Error('Failed to start counting');
    return response.data.data;
  },

  /**
   * Update count item (enter physical quantity)
   */
  async updateCountItem(countId: string, itemId: string, data: UpdateCountItemDTO): Promise<StockCount> {
    const response = await api.put<ApiResponse<StockCount>>(`${BASE_URL}/${countId}/items/${itemId}`, data);
    if (!response.data.data) throw new Error('Failed to update count item');
    return response.data.data;
  },

  /**
   * Verify stock count (COUNTED → VERIFIED)
   */
  async verifyCount(id: string): Promise<StockCount> {
    const response = await api.post<ApiResponse<StockCount>>(`${BASE_URL}/${id}/verify`, {});
    if (!response.data.data) throw new Error('Failed to verify count');
    return response.data.data;
  },

  /**
   * Approve stock count (VERIFIED → APPROVED, creates adjustments)
   */
  async approveCount(id: string): Promise<{ stockCount: StockCount; adjustmentCount: number }> {
    const response = await api.post<
      ApiResponse<{ stockCount: StockCount; adjustments: StockMovement[]; adjustmentCount: number }>
    >(`${BASE_URL}/${id}/approve`, {});
    if (!response.data.data) throw new Error('Failed to approve count');
    return {
      stockCount: response.data.data.stockCount,
      adjustmentCount: response.data.data.adjustmentCount,
    };
  },

  /**
   * Cancel stock count
   */
  async cancelCount(id: string): Promise<StockCount> {
    const response = await api.post<ApiResponse<StockCount>>(`${BASE_URL}/${id}/cancel`, {});
    if (!response.data.data) throw new Error('Failed to cancel count');
    return response.data.data;
  },
};

export default stockCountService;
