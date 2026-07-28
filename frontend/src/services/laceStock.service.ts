/**
 * Lace Stock Service
 * API calls for lace stock management
 */

import api from '../lib/api';
import type {
  LaceStock,
  LaceStockAllocation,
  LaceStockTransaction,
  LaceStockListResponse,
  LaceStockListFilters,
  CreateLaceStockInput,
  AllocateStockInput,
  TransferStockInput,
  ConsumeStockInput,
  ReturnStockInput,
  LaceStockAgingItem,
  LaceStockUtilizationReport,
} from '../types/laceStock.types';

const BASE_URL = '/lace-stock';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Get all lace stock with pagination and filters
 */
export const getAllLaceStock = async (filters?: LaceStockListFilters): Promise<LaceStockListResponse> => {
  const { data } = await api.get<LaceStockListResponse>(BASE_URL, {
    params: filters,
  });
  return data;
};

/**
 * Get lace stock by ID
 */
export const getLaceStockById = async (id: string): Promise<LaceStock> => {
  const { data } = await api.get<ApiResponse<LaceStock>>(`${BASE_URL}/${id}`);
  return data.data;
};

/**
 * Create new lace stock entry
 */
export const createLaceStock = async (input: CreateLaceStockInput): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(BASE_URL, input);
  return data.data;
};

/**
 * Update lace stock entry
 */
export const updateLaceStock = async (id: string, input: Partial<CreateLaceStockInput>): Promise<LaceStock> => {
  const { data } = await api.put<ApiResponse<LaceStock>>(`${BASE_URL}/${id}`, input);
  return data.data;
};

/**
 * Get available stock for a specific lace
 */
export const getAvailableStockForLace = async (laceId: string): Promise<LaceStock[]> => {
  const { data } = await api.get<ApiResponse<LaceStock[]>>(`${BASE_URL}/available/${laceId}`);
  return data.data;
};

/**
 * Allocate stock to an order/style
 */
export const allocateStock = async (stockId: string, input: AllocateStockInput): Promise<LaceStockAllocation> => {
  const { data } = await api.post<ApiResponse<LaceStockAllocation>>(`${BASE_URL}/${stockId}/allocate`, input);
  return data.data;
};

/**
 * Transfer stock to another style
 */
export const transferStock = async (stockId: string, input: TransferStockInput): Promise<LaceStockAllocation> => {
  const { data } = await api.post<ApiResponse<LaceStockAllocation>>(`${BASE_URL}/${stockId}/transfer`, input);
  return data.data;
};

/**
 * Record consumption of stock
 */
export const consumeStock = async (stockId: string, input: ConsumeStockInput): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(`${BASE_URL}/${stockId}/consume`, input);
  return data.data;
};

/**
 * Return unused allocated stock back to available.
 * Backend route is allocation-scoped: POST /lace-stock/allocations/:allocationId/return
 * (there is no stock-level /:id/return route). Body must be { quantityToReturn, notes? }.
 */
export const returnStock = async (allocationId: string, input: ReturnStockInput): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(`${BASE_URL}/allocations/${allocationId}/return`, input);
  return data.data;
};

/**
 * Get stock allocations
 */
export const getStockAllocations = async (stockId: string): Promise<LaceStockAllocation[]> => {
  const { data } = await api.get<ApiResponse<LaceStockAllocation[]>>(`${BASE_URL}/${stockId}/allocations`);
  return data.data;
};

/**
 * Get stock transaction history
 */
export const getStockTransactions = async (stockId: string): Promise<LaceStockTransaction[]> => {
  const { data } = await api.get<ApiResponse<LaceStockTransaction[]>>(`${BASE_URL}/${stockId}/transactions`);
  return data.data;
};

/**
 * Get allocations for an order
 */
export const getOrderAllocations = async (orderId: string): Promise<LaceStockAllocation[]> => {
  const { data } = await api.get<ApiResponse<LaceStockAllocation[]>>(`${BASE_URL}/order/${orderId}/allocations`);
  return data.data;
};

/**
 * Get aging report
 */
export const getAgingReport = async (params?: {
  minDays?: number;
  maxDays?: number;
  laceId?: string;
}): Promise<LaceStockAgingItem[]> => {
  const { data } = await api.get<ApiResponse<LaceStockAgingItem[]>>(`${BASE_URL}/reports/aging`, { params });
  return data.data;
};

/**
 * Get utilization report
 */
export const getUtilizationReport = async (): Promise<LaceStockUtilizationReport> => {
  const { data } = await api.get<ApiResponse<LaceStockUtilizationReport>>(`${BASE_URL}/reports/utilization`);
  return data.data;
};

/**
 * Adjust stock quantity (admin operation)
 */
export const adjustStock = async (
  stockId: string,
  input: {
    quantityAdjustment: number;
    reason: string;
  }
): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(`${BASE_URL}/${stockId}/adjust`, input);
  return data.data;
};

/**
 * Downgrade quality grade
 */
export const downgradeQuality = async (
  stockId: string,
  input: {
    newGrade: 'B' | 'DEFECT';
    quantity: number;
    reason: string;
  }
): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(`${BASE_URL}/${stockId}/downgrade`, input);
  return data.data;
};

/**
 * Mark stock for return to supplier
 */
export const markForReturn = async (
  stockId: string,
  input: {
    reason: string;
    restockingFee?: number;
  }
): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(`${BASE_URL}/${stockId}/mark-for-return`, input);
  return data.data;
};

/**
 * Confirm return completed
 */
export const confirmReturn = async (stockId: string): Promise<LaceStock> => {
  const { data } = await api.post<ApiResponse<LaceStock>>(`${BASE_URL}/${stockId}/confirm-return`);
  return data.data;
};

// Export as object for consistency
export const laceStockService = {
  getAllLaceStock,
  getLaceStockById,
  createLaceStock,
  updateLaceStock,
  getAvailableStockForLace,
  allocateStock,
  transferStock,
  consumeStock,
  returnStock,
  getStockAllocations,
  getStockTransactions,
  getOrderAllocations,
  getAgingReport,
  getUtilizationReport,
  adjustStock,
  downgradeQuality,
  markForReturn,
  confirmReturn,
};

export default laceStockService;
