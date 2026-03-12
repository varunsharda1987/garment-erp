/**
 * HSN/SAC Master Service
 * API calls for HSN/SAC code operations
 */

import api from '../lib/api';
import type {
  HSNSACMaster,
  CreateHSNSACRequest,
  UpdateHSNSACRequest,
  HSNSACQueryParams,
  HSNSACSearchResult,
  PaginatedHSNSACMasters,
  HSNSACType,
} from '@/types/hsnSacMaster.types';

const BASE_URL = '/hsn-sac-masters';

/**
 * Get all HSN/SAC codes with pagination
 */
export async function getAllHSNSACMasters(params: HSNSACQueryParams = {}): Promise<PaginatedHSNSACMasters> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

/**
 * Get HSN/SAC code by ID
 */
export async function getHSNSACById(id: string): Promise<HSNSACMaster> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data.data;
}

/**
 * Search HSN/SAC codes for dropdown/autocomplete
 */
export async function searchHSNSACMasters(params: {
  search?: string;
  type?: HSNSACType;
  limit?: number;
}): Promise<HSNSACSearchResult[]> {
  const response = await api.get(`${BASE_URL}/search`, { params });
  return response.data;
}

/**
 * Get HSN/SAC by code string
 */
export async function getHSNSACByCode(code: string): Promise<HSNSACMaster> {
  const response = await api.get(`${BASE_URL}/code/${code}`);
  return response.data.data;
}

/**
 * Get default GST rate for a code
 */
export async function getDefaultGSTRate(code: string): Promise<{ code: string; defaultGstRate: number }> {
  const response = await api.get(`${BASE_URL}/rate/${code}`);
  return response.data.data;
}

/**
 * Create new HSN/SAC code
 */
export async function createHSNSACMaster(data: CreateHSNSACRequest): Promise<HSNSACMaster> {
  const response = await api.post(BASE_URL, data);
  return response.data.data;
}

/**
 * Update HSN/SAC code
 */
export async function updateHSNSACMaster(id: string, data: UpdateHSNSACRequest): Promise<HSNSACMaster> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data.data;
}

/**
 * Delete HSN/SAC code (soft delete)
 */
export async function deleteHSNSACMaster(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}
