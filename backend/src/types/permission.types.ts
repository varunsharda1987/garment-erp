/**
 * Permission Types
 * Type definitions for permission management
 */

import { UserRole } from '@prisma/client';

/**
 * Single permission toggle update
 */
export interface PermissionToggleInput {
  role: UserRole;
  permissionKey: string;
  allowed: boolean;
}

/**
 * Bulk permission update request
 */
export interface BulkPermissionUpdateInput {
  updates: PermissionToggleInput[];
}

/**
 * Result of bulk operation
 */
export interface BulkUpdateResult {
  success: boolean;
  updated: number;
  failed: number;
  errors: Array<{
    role: UserRole;
    permissionKey: string;
    error: string;
  }>;
}

/**
 * Permission matrix row (for API response)
 */
export interface PermissionMatrixRow {
  permissionKey: string;
  displayName: string;
  description: string | null;
  moduleGroup: string;
  roles: Record<UserRole, boolean>;
}

/**
 * Complete permission matrix response
 */
export interface PermissionMatrixResponse {
  permissions: PermissionMatrixRow[];
  roles: Array<{
    role: UserRole;
    name: string;
    description: string;
    permissionCount: number;
  }>;
  modules: Array<{
    key: string;
    name: string;
    description: string;
  }>;
  lastUpdated: string;
}

/**
 * Audit log entry for permissions
 */
export interface PermissionAuditEntry {
  id: string;
  action: string;
  role: UserRole;
  permissionKey: string;
  oldValue: boolean;
  newValue: boolean;
  updatedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedAt: string;
}
