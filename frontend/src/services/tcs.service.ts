/**
 * TCS Service
 * API calls for TCS (Tax Collected at Source) operations
 */

import api from '../lib/api';
import type { TCSEntry, CreateTCSRequest, TCSQueryParams, TCSListResponse, TCSSummary } from '@/types/tcs.types';

const BASE_URL = '/tcs';

/**
 * Get all TCS entries with pagination and filters
 */
export async function getTCSEntries(params?: TCSQueryParams): Promise<TCSListResponse> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

/**
 * Get TCS entry by ID
 */
export async function getTCSById(id: string): Promise<TCSEntry> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data;
}

/**
 * Create a new TCS entry
 */
export async function createTCS(data: CreateTCSRequest): Promise<TCSEntry> {
  const response = await api.post(BASE_URL, data);
  return response.data;
}

/**
 * Update a TCS entry
 */
export async function updateTCS(id: string, data: Partial<CreateTCSRequest>): Promise<TCSEntry> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

/**
 * Update TCS status
 */
export async function updateTCSStatus(id: string, status: string): Promise<TCSEntry> {
  const response = await api.put(`${BASE_URL}/${id}/status`, { status });
  return response.data;
}

/**
 * Delete a TCS entry
 */
export async function deleteTCS(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}

/**
 * Get TCS summary for a financial year
 */
export async function getTCSSummary(financialYear: string): Promise<TCSSummary> {
  const response = await api.get(`${BASE_URL}/summary`, { params: { financialYear } });
  return response.data;
}
