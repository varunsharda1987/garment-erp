/**
 * Hook for checking user permissions
 * Provides utility functions for role-based access control
 */

import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import {
  PERMISSIONS,
  hasPermission,
  getRoutePermission,
  getPermissionsForRole,
  type PermissionKey,
} from '@/config/permissions.config';
import { UserRole } from '@/types/user.types';

/**
 * Hook for checking user permissions
 * @returns Object with permission checking utilities
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role;

  /**
   * Check if user has permission for a specific feature
   */
  const can = useCallback(
    (permissionKey: PermissionKey): boolean => {
      return hasPermission(userRole, permissionKey);
    },
    [userRole]
  );

  /**
   * Check if user can access a specific route
   */
  const canAccessRoute = useCallback(
    (path: string): boolean => {
      const permissionKey = getRoutePermission(path);
      if (!permissionKey) {
        // No permission defined = accessible to all authenticated users
        return true;
      }
      return hasPermission(userRole, permissionKey);
    },
    [userRole]
  );

  /**
   * Check if user has any of the specified roles
   */
  const hasRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!userRole) return false;
      return roles.includes(userRole);
    },
    [userRole]
  );

  /**
   * Check if user is admin
   */
  const isAdmin = useMemo(() => userRole === UserRole.ADMIN, [userRole]);

  /**
   * Get all permission keys the user has access to
   */
  const userPermissions = useMemo(() => {
    if (!userRole) return [];
    return getPermissionsForRole(userRole);
  }, [userRole]);

  /**
   * Filter an array of items by permission
   * Items without a permission key are included by default
   */
  const filterByPermission = useCallback(
    <T extends { permission?: PermissionKey }>(items: T[]): T[] => {
      return items.filter((item) => {
        if (!item.permission) return true;
        return can(item.permission);
      });
    },
    [can]
  );

  /**
   * Check if user can perform multiple permissions (AND logic)
   */
  const canAll = useCallback(
    (...permissionKeys: PermissionKey[]): boolean => {
      return permissionKeys.every((key) => can(key));
    },
    [can]
  );

  /**
   * Check if user can perform any of the permissions (OR logic)
   */
  const canAny = useCallback(
    (...permissionKeys: PermissionKey[]): boolean => {
      return permissionKeys.some((key) => can(key));
    },
    [can]
  );

  return {
    userRole,
    can,
    canAccessRoute,
    hasRole,
    isAdmin,
    userPermissions,
    filterByPermission,
    canAll,
    canAny,
    permissions: PERMISSIONS,
  };
}

export type UsePermissionsReturn = ReturnType<typeof usePermissions>;
