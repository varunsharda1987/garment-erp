/**
 * Permission-related type definitions
 */

import type { UserRole } from './user.types';
import type { PermissionKey } from '@/config/permissions.config';

/**
 * Permission check result
 */
export interface PermissionCheck {
  hasAccess: boolean;
  userRole: UserRole | null;
  requiredRoles: readonly UserRole[];
}

/**
 * Menu item with permission requirement
 */
export interface PermissionedMenuItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  permission?: PermissionKey;
}

/**
 * Menu group with permission requirement
 */
export interface PermissionedMenuGroup {
  title: string;
  icon: React.ReactNode;
  permission?: PermissionKey;
  items: (PermissionedMenuItem | 'divider')[];
}

/**
 * Top-level navigation item with permission
 */
export interface PermissionedTopLevelItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  permission?: PermissionKey;
  badge?: string;
}

/**
 * Module definition for permission management UI
 */
export interface ModuleDefinition {
  name: string;
  description: string;
}

/**
 * Role permission summary for UI display
 */
export interface RolePermissionSummary {
  role: UserRole;
  roleName: string;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
}

/**
 * Permission matrix cell for visualization
 */
export interface PermissionMatrixCell {
  module: string;
  moduleName: string;
  role: UserRole;
  hasAccess: boolean;
  permissions: PermissionKey[];
}

/**
 * Full permission matrix for UI
 */
export interface PermissionMatrix {
  modules: {
    id: string;
    name: string;
    description: string;
    permissions: PermissionKey[];
  }[];
  roles: UserRole[];
  cells: Record<string, Record<UserRole, boolean>>;
}
