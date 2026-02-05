/**
 * Lace Defect Service
 * API calls for lace defect logging and claim management
 */

import api from '../lib/api';
import type {
  LaceDefect,
  DefectFilters,
  DefectListResponse,
  LogDefectInput,
  SubmitClaimInput,
  UpdateClaimStatusInput,
  RecordReplacementInput,
  PendingClaimsResponse,
  DefectStatistics,
} from '../types/laceDefect.types';

const BASE_URL = '/lace-defects';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Get all defects with filters and pagination
 */
export const getAllDefects = async (
  filters?: DefectFilters
): Promise<DefectListResponse> => {
  const { data } = await api.get<DefectListResponse>(BASE_URL, {
    params: filters,
  });
  return data;
};

/**
 * Get defect by ID
 */
export const getDefectById = async (id: string): Promise<LaceDefect> => {
  const { data } = await api.get<ApiResponse<LaceDefect>>(`${BASE_URL}/${id}`);
  return data.data;
};

/**
 * Log a new defect
 */
export const logDefect = async (input: LogDefectInput): Promise<LaceDefect> => {
  const { data } = await api.post<ApiResponse<LaceDefect>>(BASE_URL, input);
  return data.data;
};

/**
 * Submit claim for a defect
 */
export const submitClaim = async (
  defectId: string,
  input: SubmitClaimInput
): Promise<LaceDefect> => {
  const { data } = await api.post<ApiResponse<LaceDefect>>(
    `${BASE_URL}/${defectId}/claim/submit`,
    input
  );
  return data.data;
};

/**
 * Update claim status
 */
export const updateClaimStatus = async (
  defectId: string,
  input: UpdateClaimStatusInput
): Promise<LaceDefect> => {
  const { data } = await api.put<ApiResponse<LaceDefect>>(
    `${BASE_URL}/${defectId}/claim/status`,
    input
  );
  return data.data;
};

/**
 * Record replacement material
 */
export const recordReplacement = async (
  defectId: string,
  input: RecordReplacementInput
): Promise<LaceDefect> => {
  const { data } = await api.put<ApiResponse<LaceDefect>>(
    `${BASE_URL}/${defectId}/replacement`,
    input
  );
  return data.data;
};

/**
 * Get pending claims dashboard
 */
export const getPendingClaims = async (): Promise<PendingClaimsResponse> => {
  const { data } = await api.get<ApiResponse<PendingClaimsResponse>>(
    `${BASE_URL}/claims/pending`
  );
  return data.data;
};

/**
 * Get defect statistics
 */
export const getStatistics = async (): Promise<DefectStatistics> => {
  const { data } = await api.get<ApiResponse<DefectStatistics>>(
    `${BASE_URL}/statistics`
  );
  return data.data;
};

// Export as object for consistency
export const laceDefectService = {
  getAllDefects,
  getDefectById,
  logDefect,
  submitClaim,
  updateClaimStatus,
  recordReplacement,
  getPendingClaims,
  getStatistics,
};

export default laceDefectService;
