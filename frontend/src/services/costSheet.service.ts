import api from '../lib/api';
import type {
  CostSheet,
  CreateCostSheetInput,
  UpdateCostSheetInput,
  CostSheetListFilters,
  CostSheetListResponse,
  BudgetSuggestions,
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
export const getAllCostSheets = async (filters?: CostSheetListFilters): Promise<CostSheetListResponse> => {
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
 * Get cost sheet by style ID (latest version)
 */
export const getCostSheetByStyle = async (styleId: string): Promise<CostSheet> => {
  const response = await api.get(`${BASE_URL}/style/${styleId}`);
  return response.data.data;
};

/**
 * Get all cost sheet versions for a style
 */
export const getCostSheetVersionsByStyle = async (styleId: string): Promise<CostSheet[]> => {
  const response = await api.get(`${BASE_URL}/style/${styleId}/versions`);
  // Backend returns data as { currentVersion, allVersions, totalVersions }
  // We need to return the allVersions array
  return response.data.data?.allVersions || [];
};

/**
 * Response type for grouped cost sheets
 */
export interface CostSheetsGroupedByWidthResponse {
  styleId: string;
  widthCombinations: Array<{
    widthCombinationHash: string;
    widthCombinationDescription: string;
    costSheets: CostSheet[];
  }>;
  totalCostSheets: number;
  totalWidthCombinations: number;
}

/**
 * Get all cost sheets for a style grouped by width combination
 */
export const getCostSheetsGroupedByWidth = async (styleId: string): Promise<CostSheetsGroupedByWidthResponse> => {
  const response = await api.get(`${BASE_URL}/style/${styleId}/grouped`);
  return response.data.data;
};

/**
 * Create a new version of a cost sheet
 */
export const createCostSheetVersion = async (
  costSheetId: string,
  data: { versionReason?: string }
): Promise<CostSheet> => {
  const response = await api.post(`${BASE_URL}/${costSheetId}/create-version`, data);
  return response.data.data;
};

/**
 * Update cost sheet (only if not approved)
 */
export const updateCostSheet = async (id: string, data: UpdateCostSheetInput): Promise<CostSheet> => {
  const response = await api.put(`${BASE_URL}/${id}`, data);
  return response.data.data;
};

/**
 * Approve cost sheet
 */
export const approveCostSheet = async (id: string, approved: boolean): Promise<CostSheet> => {
  const response = await api.patch(`${BASE_URL}/${id}/approve`, { approved });
  return response.data.data;
};

/**
 * Reject cost sheet with notes
 */
export const rejectCostSheet = async (id: string, rejectionNotes: string): Promise<CostSheet> => {
  const response = await api.patch(`${BASE_URL}/${id}/reject`, { rejectionNotes });
  return response.data.data;
};

/**
 * Delete cost sheet (only if not approved)
 */
export const deleteCostSheet = async (id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${id}`);
};

/**
 * Auto-generate cost sheet from approved CAD data
 */
export const generateCostSheetFromStyle = async (styleId: string): Promise<CostSheet> => {
  const response = await api.post(`${BASE_URL}/generate/${styleId}`);
  return response.data.data;
};

/**
 * Get budget suggestions for direct procurement
 * Used when creating RAW_MATERIAL_CALCULATION or PRODUCTION cost sheets
 * without going through COSTING approval first
 */
export const getBudgetSuggestions = async (styleId: string): Promise<BudgetSuggestions> => {
  const response = await api.get(`${BASE_URL}/budget-suggestions/${styleId}`);
  return response.data.data;
};

export default {
  createCostSheet,
  getAllCostSheets,
  getCostSheetById,
  getCostSheetByStyle,
  getCostSheetVersionsByStyle,
  getCostSheetsGroupedByWidth,
  createCostSheetVersion,
  updateCostSheet,
  approveCostSheet,
  rejectCostSheet,
  deleteCostSheet,
  generateCostSheetFromStyle,
  getBudgetSuggestions,
};
