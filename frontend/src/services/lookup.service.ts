/**
 * Lookup Service - API calls for managing configurable dropdown values
 */
import api from '../lib/api';
import type {
  LookupValue,
  LookupListResponse,
  LookupCategoriesResponse,
  CreateLookupRequest,
  UpdateLookupRequest,
  BulkCreateRequest,
  BulkCreateResponse,
} from '../types/lookup.types';

/**
 * Get lookup values by category
 */
export const getLookupsByCategory = async (
  category: string,
  includeInactive = false
): Promise<LookupValue[]> => {
  const { data } = await api.get<LookupListResponse>('/lookups', {
    params: { category, includeInactive }
  });
  return data.data;
};

/**
 * Get all categories with counts
 */
export const getAllCategories = async (): Promise<LookupCategoriesResponse> => {
  const { data } = await api.get<LookupCategoriesResponse>('/lookups/categories');
  return data;
};

/**
 * Create a new lookup value
 */
export const createLookup = async (request: CreateLookupRequest): Promise<LookupValue> => {
  const { data } = await api.post<{ data: LookupValue; message: string }>('/lookups', request);
  return data.data;
};

/**
 * Update a lookup value
 */
export const updateLookup = async (
  id: string,
  updates: UpdateLookupRequest
): Promise<LookupValue> => {
  const { data } = await api.put<{ data: LookupValue; message: string }>(`/lookups/${id}`, updates);
  return data.data;
};

/**
 * Delete a lookup value
 */
export const deleteLookup = async (id: string): Promise<void> => {
  await api.delete(`/lookups/${id}`);
};

/**
 * Bulk create lookup values
 */
export const bulkCreateLookups = async (request: BulkCreateRequest): Promise<BulkCreateResponse> => {
  const { data } = await api.post<BulkCreateResponse>('/lookups/bulk', request);
  return data;
};
