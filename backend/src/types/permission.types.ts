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
 * BUG-ADM1 fix: Type now matches actual audit_logs table structure returned by getAuditLog()
 */
export interface PermissionAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string; // Format: "ROLE:permissionKey"
  oldValues: {
    role: UserRole;
    permissionKey: string;
    allowed: boolean;
  } | null;
  newValues: {
    role: UserRole;
    permissionKey: string;
    allowed: boolean;
  } | null;
  users: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  timestamp: string;
}
