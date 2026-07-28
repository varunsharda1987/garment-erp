/**
 * Permission Types (Frontend)
 */

import { UserRole } from './user.types';

export interface PermissionToggleInput {
  role: UserRole;
  permissionKey: string;
  allowed: boolean;
}

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

export interface PermissionMatrixRow {
  permissionKey: string;
  displayName: string;
  description: string | null;
  moduleGroup: string;
  roles: Record<UserRole, boolean>;
}

export interface RoleInfo {
  role: UserRole;
  name: string;
  description: string;
  permissionCount: number;
}

export interface ModuleInfo {
  key: string;
  name: string;
  description: string;
}

export interface PermissionMatrixResponse {
  permissions: PermissionMatrixRow[];
  roles: RoleInfo[];
  modules: ModuleInfo[];
  lastUpdated: string;
}

export interface PermissionAuditEntry {
  id: string;
  action: string;
  entityId: string;
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

export interface AuditLogResponse {
  logs: PermissionAuditEntry[];
  total: number;
}
