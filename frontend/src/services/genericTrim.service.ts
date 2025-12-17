/**
 * Generic Trim Service
 * API calls for all new trim types using dynamic endpoints
 */

import api from '../lib/api';
import type {
  GenericTrimItem,
  GenericTrimListResponse,
  GenericTrimResponse,
  TrimConfigResponse,
  TrimCountsResponse
} from '../types/genericTrim.types';

const BASE_URL = '/generic-trims';

/**
 * Get all items for a specific trim type
 */
export const getAll = async (
  trimType: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }
): Promise<GenericTrimListResponse> => {
  const response = await api.get(`${BASE_URL}/${trimType}`, { params });
  return response.data;
};

/**
 * Get a single item by ID
 */
export const getById = async (
  trimType: string,
  id: string
): Promise<GenericTrimItem> => {
  const response = await api.get(`${BASE_URL}/${trimType}/${id}`);
  return response.data;
};

/**
 * Create a new item
 */
export const create = async (
  trimType: string,
  data: Partial<GenericTrimItem>
): Promise<GenericTrimResponse> => {
  const response = await api.post(`${BASE_URL}/${trimType}`, data);
  return response.data;
};

/**
 * Update an existing item
 */
export const update = async (
  trimType: string,
  id: string,
  data: Partial<GenericTrimItem>
): Promise<GenericTrimResponse> => {
  const response = await api.put(`${BASE_URL}/${trimType}/${id}`, data);
  return response.data;
};

/**
 * Delete an item (soft delete)
 */
export const remove = async (
  trimType: string,
  id: string
): Promise<{ message: string }> => {
  const response = await api.delete(`${BASE_URL}/${trimType}/${id}`);
  return response.data;
};

/**
 * Get all trim type configurations
 */
export const getConfigs = async (): Promise<TrimConfigResponse[]> => {
  const response = await api.get(`${BASE_URL}/configs`);
  return response.data;
};

/**
 * Get counts for all trim types (for dashboard)
 */
export const getCounts = async (): Promise<TrimCountsResponse> => {
  const response = await api.get(`${BASE_URL}/counts`);
  return response.data;
};

// Export as named object for convenience
export const genericTrimService = {
  getAll,
  getById,
  create,
  update,
  remove,
  getConfigs,
  getCounts
};

export default genericTrimService;
