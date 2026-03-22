/**
 * Agency Service
 * API calls for agency operations
 */

import api from '../lib/api';
import type {
  Agency,
  CreateAgencyRequest,
  UpdateAgencyRequest,
  AgencyQueryParams,
  AgencySearchResult,
  PaginatedAgencies,
} from '@/types/agency.types';

const BASE_URL = '/agencies';

/**
 * Get all agencies with pagination
 */
export async function getAllAgencies(params: AgencyQueryParams = {}): Promise<PaginatedAgencies> {
  const response = await api.get(BASE_URL, { params });
  return response.data;
}

/**
 * Get agency by ID
 */
export async function getAgencyById(id: string): Promise<Agency> {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data;
}

/**
 * Search agencies for dropdown
 */
export async function searchAgencies(params: { search?: string; limit?: number }): Promise<AgencySearchResult[]> {
  const response = await api.get(`${BASE_URL}/search`, { params });
  return response.data;
}

/**
 * Create new agency
 */
export async function createAgency(data: CreateAgencyRequest): Promise<Agency> {
  const response = await api.post(BASE_URL, data);
  return response.data;
}

/**
 * Update agency
 */
export async function updateAgency(id: string, data: UpdateAgencyRequest): Promise<Agency> {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data;
}

/**
 * Delete agency
 */
export async function deleteAgency(id: string): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`);
}
