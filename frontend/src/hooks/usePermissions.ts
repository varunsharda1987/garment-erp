/**
 * Hook for checking user permissions
 *
 * Decides from the permission keys the server granted this user (`user.permissions`, set at
 * login and refreshed from `/auth/me` on every app load) — the Permissions page is the source of
 * truth. ADMIN holds every key.
 */

import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { PERMISSION_KEYS, getRoutePermission, type PermissionKey } from '@/config/permissions.config';
import { UserRole } from '@/types/user.types';

const NO_PERMISSIONS: readonly string[] = [];

/**
 * Hook for checking user permissions
 * @returns Object with permission checking utilities
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role as UserRole | undefined;
  const grantedList = user?.permissions ?? NO_PERMISSIONS;

  /**
   * Check if user is admin
   */
  const isAdmin = useMemo(() => userRole === UserRole.ADMIN, [userRole]);

  const granted = useMemo(() => new Set(grantedList), [grantedList]);

  /**
   * Check if user has permission for a specific feature
   */
  const can = useCallback(
    (permissionKey: PermissionKey): boolean => {
      if (!userRole) return false;
      return isAdmin || granted.has(permissionKey);
    },
    [userRole, isAdmin, granted]
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
      return can(permissionKey);
    },
    [can]
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
   * Get all permission keys the user has access to
   */
  const userPermissions = useMemo((): PermissionKey[] => {
    if (!userRole) return [];
    if (isAdmin) return [...PERMISSION_KEYS];
    return PERMISSION_KEYS.filter((key) => granted.has(key));
  }, [userRole, isAdmin, granted]);

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
  };
}

export type UsePermissionsReturn = ReturnType<typeof usePermissions>;
