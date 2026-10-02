// Kept out of UnapproveImpactDialog.tsx: a component file exports only components (Vite fast refresh).
import type { AxiosError } from 'axios';
import type { CostingInUseErrorDetails } from '../../types/fabricCosting.types';

/**
 * Extract the COSTING_OPTION_IN_USE payload from an unapprove error, or null
 * when the error is something else (falls through to normal error handling).
 */
export function getCostingInUseDetails(error: unknown): CostingInUseErrorDetails | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const axiosError = error as AxiosError<{ details?: CostingInUseErrorDetails }>;
  if (axiosError.response?.status !== 409) return null;
  const details = axiosError.response.data?.details;
  if (!details || details.code !== 'COSTING_OPTION_IN_USE') return null;
  return details;
}
