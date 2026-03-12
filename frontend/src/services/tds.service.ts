/**
 * TDS Service
 * API calls for TDS (Tax Deducted at Source) operations
 */

import api from '../lib/api';
import type {
  TDSEntry,
  CreateTDSRequest,
  TDSQueryParams,
  TDSListResponse,
  TDSSummary,
} from '@/types/tds.types';

const BASE_URL = '/tds';

/**
 * Get all TDS entries with pagination and filters
 */
export async function getTDSEntries(params?: TDSQueryParams): Promise<TDSListResponse> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

/**
 * Get TDS entry by ID
 */
export async function getTDSById(id: string): Promise<TDSEntry> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data;
}

/**
 * Create a new TDS entry
 */
export async function createTDS(data: CreateTDSRequest): Promise<TDSEntry> {
  const response = await api.post(BASE_URL, data);
  return response.data;
}

/**
 * Update a TDS entry
 */
export async function updateTDS(id: string, data: Partial<CreateTDSRequest>): Promise<TDSEntry> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

/**
 * Update TDS status (with optional certificate number)
 */
export async function updateTDSStatus(
  id: string,
  status: string,
  certificateNo?: string
): Promise<TDSEntry> {
  const response = await api.put(`${BASE_URL}/${id}/status`, { status, certificateNo });
  return response.data;
}

/**
 * Delete a TDS entry
 */
export async function deleteTDS(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}

/**
 * Get TDS summary for a financial year
 */
export async function getTDSSummary(financialYear: string): Promise<TDSSummary> {
  const response = await api.get(`${BASE_URL}/summary`, { params: { financialYear } });
  return response.data;
}
