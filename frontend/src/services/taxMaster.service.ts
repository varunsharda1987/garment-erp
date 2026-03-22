/**
 * Tax Master Service
 * API calls for tax master operations
 */

import api from '../lib/api';
import type {
  TaxMaster,
  CreateTaxMasterRequest,
  UpdateTaxMasterRequest,
  TaxMasterQueryParams,
  PaginatedTaxMasters,
} from '@/types/taxMaster.types';

const BASE_URL = '/tax-masters';

/**
 * Get all tax masters with pagination
 */
export async function getAllTaxMasters(params: TaxMasterQueryParams = {}): Promise<PaginatedTaxMasters> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

/**
 * Get applicable taxes
 */
export async function getApplicableTaxes(params: { date?: string; taxType?: string }): Promise<{ data: TaxMaster[] }> {
  const response = await api.get(`${BASE_URL}/applicable`, { params });
  return response.data;
}

/**
 * Get tax master by ID
 */
export async function getTaxMasterById(id: string): Promise<TaxMaster> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data.data;
}

/**
 * Create new tax master
 */
export async function createTaxMaster(data: CreateTaxMasterRequest): Promise<TaxMaster> {
  const response = await api.post(BASE_URL, data);
  return response.data.data;
}

/**
 * Update tax master
 */
export async function updateTaxMaster(id: string, data: UpdateTaxMasterRequest): Promise<TaxMaster> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data.data;
}

/**
 * Delete tax master (soft delete)
 */
export async function deleteTaxMaster(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}
