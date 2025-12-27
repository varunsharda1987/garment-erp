// Pattern Part Service - API calls for pattern part management
import api from '../lib/api';
import type {
  PatternPart,
  PatternPartFormData,
  PatternPartListResponse,
  PatternPartResponse,
  ReorderPatternPartsInput,
} from '../types/patternPart.types';

/**
 * Get all pattern parts with pagination and filters
 */
export const getAllPatternParts = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  activeOnly?: boolean;
}): Promise<PatternPartListResponse> => {
  const { data } = await api.get<PatternPartListResponse>('/pattern-parts', {
    params,
  });
  return data;
};

/**
 * Get pattern part by ID
 */
export const getPatternPartById = async (id: string): Promise<PatternPart> => {
  const { data } = await api.get<PatternPartResponse>(`/pattern-parts/${id}`);
  return data.data;
};

/**
 * Get pattern part by code
 */
export const getPatternPartByCode = async (code: string): Promise<PatternPart> => {
  const { data } = await api.get<PatternPartResponse>(`/pattern-parts/code/${code}`);
  return data.data;
};

/**
 * Create new pattern part
 */
export const createPatternPart = async (
  patternPartData: PatternPartFormData
): Promise<PatternPart> => {
  const { data } = await api.post<PatternPartResponse>('/pattern-parts', patternPartData);
  return data.data;
};

/**
 * Update pattern part
 */
export const updatePatternPart = async (
  id: string,
  patternPartData: PatternPartFormData
): Promise<PatternPart> => {
  const { data } = await api.put<PatternPartResponse>(
    `/pattern-parts/${id}`,
    patternPartData
  );
  return data.data;
};

/**
 * Delete pattern part (soft delete)
 */
export const deletePatternPart = async (id: string): Promise<void> => {
  await api.delete(`/pattern-parts/${id}`);
};

/**
 * Reorder pattern parts
 */
export const reorderPatternParts = async (
  reorderData: ReorderPatternPartsInput
): Promise<void> => {
  await api.post('/pattern-parts/reorder', reorderData);
};
