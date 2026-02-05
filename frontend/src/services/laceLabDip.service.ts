/**
 * Lace Lab Dip Service
 * API calls for lace lab dip management
 */

import api from '../lib/api';
import type {
  LaceLabDip,
  LabDipListResponse,
  LabDipListFilters,
  CreateLabDipInput,
  UpdateLabDipInput,
  UpdateLabDipStatusInput,
} from '../types/laceLabDip.types';

const BASE_URL = '/lace-lab-dips';

/**
 * Get all lab dips with pagination and filters
 */
export const getAllLabDips = async (
  filters?: LabDipListFilters
): Promise<LabDipListResponse> => {
  const { data } = await api.get<LabDipListResponse>(BASE_URL, {
    params: filters,
  });
  return data;
};

/**
 * Get lab dip by ID
 */
export const getLabDipById = async (id: string): Promise<LaceLabDip> => {
  const { data } = await api.get<{ success: boolean; data: LaceLabDip }>(
    `${BASE_URL}/${id}`
  );
  return data.data;
};

/**
 * Create new lab dip request
 */
export const createLabDip = async (
  input: CreateLabDipInput
): Promise<LaceLabDip> => {
  const { data } = await api.post<{ success: boolean; data: LaceLabDip }>(
    BASE_URL,
    input
  );
  return data.data;
};

/**
 * Update lab dip details
 */
export const updateLabDip = async (
  id: string,
  input: UpdateLabDipInput
): Promise<LaceLabDip> => {
  const { data } = await api.put<{ success: boolean; data: LaceLabDip }>(
    `${BASE_URL}/${id}`,
    input
  );
  return data.data;
};

/**
 * Update lab dip status (workflow transitions)
 */
export const updateLabDipStatus = async (
  id: string,
  input: UpdateLabDipStatusInput
): Promise<LaceLabDip> => {
  const { data } = await api.post<{ success: boolean; data: LaceLabDip }>(
    `${BASE_URL}/${id}/status`,
    input
  );
  return data.data;
};

/**
 * Delete lab dip (only if PENDING status)
 */
export const deleteLabDip = async (id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${id}`);
};

/**
 * Get approved lab dips for a greige lace (for processor selection)
 */
export const getApprovedForLace = async (
  greigeLaceId: string
): Promise<LaceLabDip[]> => {
  const { data } = await api.get<{ success: boolean; data: LaceLabDip[] }>(
    `${BASE_URL}/approved/${greigeLaceId}`
  );
  return data.data;
};

// Export as object for consistency
export const laceLabDipService = {
  getAllLabDips,
  getLabDipById,
  createLabDip,
  updateLabDip,
  updateLabDipStatus,
  deleteLabDip,
  getApprovedForLace,
};

export default laceLabDipService;
