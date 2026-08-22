/**
 * GRN (Goods Receiving Notes) Service
 * Frontend API client for goods receiving management
 */

import api from '../lib/api';
import type {
  GRN,
  GRNListResponse,
  GRNResponse,
  GRNFilters,
  CreateGRNRequest,
  RejectGRNRequest,
  PendingItemsResponse,
  ReceivingSummary,
  ProcessingQCData,
  ProcessingContext,
} from '../types/grn.types';

const BASE_URL = '/grn';

/**
 * Get all GRNs with filters and pagination
 */
export const getAllGRNs = async (filters?: GRNFilters): Promise<GRNListResponse> => {
  const { data } = await api.get(BASE_URL, {
    params: {
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      poId: filters?.poId || undefined,
      supplierId: filters?.supplierId || undefined,
      status: filters?.status || undefined,
      search: filters?.search || undefined,
      startDate: filters?.startDate || undefined,
      endDate: filters?.endDate || undefined,
      sortBy: filters?.sortBy || undefined,
      sortOrder: filters?.sortOrder || undefined,
    },
  });
  return data;
};

/**
 * Get GRN by ID
 */
export const getGRNById = async (id: string): Promise<GRN> => {
  const { data } = await api.get<GRNResponse>(`${BASE_URL}/${id}`);
  return data.data;
};

/**
 * Get all GRNs for a specific PO
 */
export const getGRNsByPO = async (poId: string): Promise<{ success: boolean; data: GRN[]; count: number }> => {
  const { data } = await api.get(`${BASE_URL}/po/${poId}`);
  return data;
};

/**
 * Get pending items for a PO (for GRN creation)
 */
export const getPendingItemsForPO = async (poId: string): Promise<PendingItemsResponse> => {
  const { data } = await api.get(`${BASE_URL}/po/${poId}/pending`);
  return data;
};

/**
 * Get receiving summary by warehouse for a PO
 */
export const getReceivingSummaryByPO = async (poId: string): Promise<ReceivingSummary> => {
  const { data } = await api.get(`${BASE_URL}/po/${poId}/summary`);
  return data;
};

/**
 * Create a new GRN
 */
export const createGRN = async (grnData: CreateGRNRequest): Promise<GRN> => {
  const { data } = await api.post<GRNResponse>(BASE_URL, grnData);
  return data.data;
};

/** Detail row for bale/than entry on JWO receipt */
export interface JwoReceiptDetail {
  detailType: 'THAN' | 'ROLL';
  baleNumber?: number | null;
  sequenceNo: number;
  meters: number;
  remarks?: string | null;
}

/**
 * Phase 4b: create a GRN against a Job Work Order (no purchase order)
 */
export const createGRNFromJWO = async (payload: {
  jobWorkOrderId: string;
  qtyReceivedMeters?: number;
  receivedWidthInches?: number;
  thanCount?: number;
  foldLengthCm?: number;
  receivedChallan?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  warehouseId?: string;
  remarks?: string;
  /** Entry mode for bale/than tracking */
  entryMode?: 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE';
  /** Detail rows for THAN_WISE / BALE_WISE entry modes */
  details?: JwoReceiptDetail[];
}): Promise<GRN> => {
  const { data } = await api.post<GRNResponse>(`${BASE_URL}/jwo`, payload);
  return data.data;
};

/**
 * Approve a GRN (PENDING_QC -> ACCEPTED)
 */
export interface PendingCuttingInfo {
  workOrderNumber: string;
  workOrderId: string;
  pendingQty: number;
}

export const approveGRN = async (
  id: string,
  warehouseId?: string,
  processingQC?: ProcessingQCData
): Promise<{ grn: GRN; pendingCutting?: PendingCuttingInfo[] }> => {
  const { data } = await api.patch<GRNResponse & { pendingCutting?: PendingCuttingInfo[] }>(
    `${BASE_URL}/${id}/approve`,
    {
      ...(warehouseId && { warehouseId }),
      ...(processingQC && { processingQC }),
    }
  );
  return { grn: data.data, pendingCutting: data.pendingCutting };
};

/**
 * Get processing context for a PROCESSING PO (for GRN form pre-population)
 */
export const getProcessingContext = async (poId: string): Promise<ProcessingContext> => {
  const { data } = await api.get<{ success: boolean; data: ProcessingContext }>(
    `${BASE_URL}/po/${poId}/processing-context`
  );
  return data.data;
};

/**
 * Reject a GRN (PENDING_QC -> REJECTED)
 */
export const rejectGRN = async (id: string, request: RejectGRNRequest): Promise<GRN> => {
  const { data } = await api.patch<GRNResponse>(`${BASE_URL}/${id}/reject`, request);
  return data.data;
};

// ============================================
// Export all functions as default object
// ============================================

export default {
  getAllGRNs,
  getGRNById,
  getGRNsByPO,
  getPendingItemsForPO,
  getReceivingSummaryByPO,
  createGRN,
  approveGRN,
  rejectGRN,
  getProcessingContext,
};
