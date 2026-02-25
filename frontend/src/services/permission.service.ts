/**
 * Permission Service (Frontend)
 * API calls for permission management
 */

import api from '../lib/api';
import type {
  PermissionMatrixResponse,
  PermissionToggleInput,
  BulkUpdateResult,
  AuditLogResponse,
} from '../types/permission.types';

/**
 * Get complete permission matrix
 */
export const getPermissionMatrix = async (): Promise<PermissionMatrixResponse> => {
  const { data } = await api.get<{ data: PermissionMatrixResponse }>(
    '/permissions/matrix'
  );
  return data.data;
};

/**
 * Toggle single permission
 */
export const togglePermission = async (
  input: PermissionToggleInput
): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.patch<{ success: boolean; message: string }>(
    '/permissions/toggle',
    input
  );
  return data;
};

/**
 * Bulk update permissions
 */
export const bulkUpdatePermissions = async (
  updates: PermissionToggleInput[]
): Promise<BulkUpdateResult> => {
  const { data } = await api.post<{ data: BulkUpdateResult }>(
    '/permissions/bulk-update',
    { updates }
  );
  return data.data;
};

/**
 * Reset permissions to defaults
 */
export const resetToDefaults = async (): Promise<{
  success: boolean;
  reset: number;
}> => {
  const { data } = await api.post<{ data: { success: boolean; reset: number } }>(
    '/permissions/reset-defaults'
  );
  return data.data;
};

/**
 * Get audit log
 */
export const getAuditLog = async (options?: {
  limit?: number;
  offset?: number;
  role?: string;
  permissionKey?: string;
}): Promise<AuditLogResponse> => {
  const { data } = await api.get<{ data: AuditLogResponse }>(
    '/permissions/audit-log',
    { params: options }
  );
  return data.data;
};

/**
 * Seed permissions (one-time setup)
 */
export const seedPermissions = async (): Promise<{
  created: number;
  skipped: number;
}> => {
  const { data } = await api.post<{
    data: { created: number; skipped: number };
  }>('/permissions/seed');
  return data.data;
};
