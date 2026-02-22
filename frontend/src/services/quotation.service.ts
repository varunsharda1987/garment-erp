/**
 * Quotation Service
 * API client for quotation management
 */

import api from '@/lib/api';
import type {
  Quotation,
  QuotationListResponse,
  QuotationSummary,
  QuotationQueryParams,
  CreateQuotationRequest,
  UpdateQuotationRequest,
  UpdateQuotationStatusRequest,
} from '../types/quotation.types';

const QUOTATION_API_PATH = '/quotations';

/**
 * Get all quotations with pagination and filters
 */
export const getQuotations = async (
  params: QuotationQueryParams = {}
): Promise<QuotationListResponse> => {
  const response = await api.get<QuotationListResponse>(QUOTATION_API_PATH, { params });
  return response.data;
};

/**
 * Get quotation by ID
 */
export const getQuotationById = async (id: string): Promise<Quotation> => {
  const response = await api.get<{ data: Quotation }>(`${QUOTATION_API_PATH}/${id}`);
  return response.data.data;
};

/**
 * Create a new quotation
 */
export const createQuotation = async (data: CreateQuotationRequest): Promise<Quotation> => {
  const response = await api.post<{ data: Quotation; message: string }>(
    QUOTATION_API_PATH,
    data
  );
  return response.data.data;
};

/**
 * Update quotation
 */
export const updateQuotation = async (
  id: string,
  data: UpdateQuotationRequest
): Promise<Quotation> => {
  const response = await api.put<{ data: Quotation; message: string }>(
    `${QUOTATION_API_PATH}/${id}`,
    data
  );
  return response.data.data;
};

/**
 * Update quotation status
 */
export const updateQuotationStatus = async (
  id: string,
  data: UpdateQuotationStatusRequest
): Promise<Quotation> => {
  const response = await api.put<{ data: Quotation; message: string }>(
    `${QUOTATION_API_PATH}/${id}/status`,
    data
  );
  return response.data.data;
};

/**
 * Delete quotation
 */
export const deleteQuotation = async (id: string): Promise<void> => {
  await api.delete(`${QUOTATION_API_PATH}/${id}`);
};

/**
 * Get quotation summary statistics
 */
export const getQuotationSummary = async (customerId?: string): Promise<QuotationSummary> => {
  const params = customerId ? { customerId } : {};
  const response = await api.get<{ data: QuotationSummary }>(
    `${QUOTATION_API_PATH}/summary`,
    { params }
  );
  return response.data.data;
};

/**
 * Mark expired quotations (admin only)
 */
export const markExpiredQuotations = async (): Promise<{ count: number }> => {
  const response = await api.post<{ data: { count: number }; message: string }>(
    `${QUOTATION_API_PATH}/mark-expired`
  );
  return response.data.data;
};

export default {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  getQuotationSummary,
  markExpiredQuotations,
};
