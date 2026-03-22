/**
 * RoleGate Component
 * Conditionally renders children based on user role/permission
 * If user doesn't have access, renders nothing (hidden) or fallback
 */

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/config/permissions.config';
import type { UserRole } from '@/types/user.types';

interface RoleGateProps {
  children: ReactNode;
  /** Permission key to check */
  permission?: PermissionKey;
  /** Specific roles to allow (alternative to permission) */
  allowedRoles?: UserRole[];
  /** What to render if access denied (default: null/hidden) */
  fallback?: ReactNode;
  /** If true, requires ALL permissions/roles instead of ANY */
  requireAll?: boolean;
}

/**
 * Conditionally renders children based on user role/permission
 *
 * @example
 * // Using permission key
 * <RoleGate permission="admin">
 *   <DangerZoneSettings />
 * </RoleGate>
 *
 * @example
 * // Using specific roles
 * <RoleGate allowedRoles={[UserRole.ADMIN, UserRole.ACCOUNTS]}>
 *   <FinancialReports />
 * </RoleGate>
 *
 * @example
 * // With fallback
 * <RoleGate permission="admin" fallback={<p>Access denied</p>}>
 *   <AdminPanel />
 * </RoleGate>
 */
export function RoleGate({ children, permission, allowedRoles, fallback = null, requireAll = false }: RoleGateProps) {
  const { can, hasRole } = usePermissions();

  let hasAccess = true;

  if (permission) {
    hasAccess = can(permission);
  } else if (allowedRoles && allowedRoles.length > 0) {
    if (requireAll) {
      // Must have ALL specified roles (usually doesn't make sense, but supported)
      hasAccess = allowedRoles.every((role) => hasRole(role));
    } else {
      // Must have ANY of the specified roles
      hasAccess = hasRole(...allowedRoles);
    }
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Admin-only gate (shortcut for common use case)
 */
export function AdminGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate permission="admin" fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export default RoleGate;
