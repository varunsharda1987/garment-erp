import api from '../lib/api';
import type {
  CostSheet,
  CreateCostSheetInput,
  UpdateCostSheetInput,
  CostSheetListFilters,
  CostSheetListResponse,
} from '../types/costSheet.types';

const BASE_URL = '/style-costing';

/**
 * Create a new cost sheet
 */
export const createCostSheet = async (data: CreateCostSheetInput): Promise<CostSheet> => {
  const response = await api.post(BASE_URL, data);
  return response.data.data;
};

/**
 * Get all cost sheets with filtering and pagination
 */
export const getAllCostSheets = async (
  filters?: CostSheetListFilters
): Promise<CostSheetListResponse> => {
  const params = new URLSearchParams();

  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.search) params.append('search', filters.search);
  if (filters?.approved) params.append('approved', filters.approved);

  const response = await api.get(`${BASE_URL}?${params.toString()}`);
  return response.data;
};

/**
 * Get cost sheet by ID
 */
export const getCostSheetById = async (id: string): Promise<CostSheet> => {
  const response = await api.get(`${BASE_URL}/${id}`);
  return response.data.data;
};

/**
 * Get cost sheet by style ID
 */
export const getCostSheetByStyle = async (styleId: string): Promise<CostSheet> => {
  const response = await api.get(`${BASE_URL}/style/${styleId}`);
  return response.data.data;
};

/**
 * Update cost sheet (only if not approved)
 */
export const updateCostSheet = async (
  id: string,
  data: UpdateCostSheetInput
): Promise<CostSheet> => {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data.data;
};

/**
 * Approve or reject cost sheet
 */
export const approveCostSheet = async (
  id: string,
  approved: boolean
): Promise<CostSheet> => {
  const response = await api.patch(`${BASE_URL}/${id}/approve`, { approved });
  return response.data.data;
};

/**
 * Delete cost sheet (only if not approved)
 */
export const deleteCostSheet = async (id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${id}`);
};

export default {
  createCostSheet,
  getAllCostSheets,
  getCostSheetById,
  getCostSheetByStyle,
  updateCostSheet,
  approveCostSheet,
  deleteCostSheet,
};
