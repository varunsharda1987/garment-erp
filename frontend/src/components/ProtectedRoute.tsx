/**
 * ProtectedRoute Component
 * Handles authentication and role-based access control for routes
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/config/permissions.config';
import type { UserRole } from '@/types/user.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Permission key required to access this route */
  permission?: PermissionKey;
  /** Specific roles allowed (alternative to permission) */
  allowedRoles?: UserRole[];
  /** Where to redirect if unauthorized (default: /dashboard) */
  unauthorizedRedirect?: string;
}

/**
 * Protected route wrapper that checks authentication and authorization
 *
 * @example
 * // Basic authentication check
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * @example
 * // With permission requirement
 * <ProtectedRoute permission="admin">
 *   <AdminPanel />
 * </ProtectedRoute>
 *
 * @example
 * // With specific roles
 * <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.ACCOUNTS]}>
 *   <FinanceModule />
 * </ProtectedRoute>
 */
export default function ProtectedRoute({
  children,
  permission,
  allowedRoles,
  unauthorizedRedirect = '/dashboard',
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const { can, hasRole, canAccessRoute } = usePermissions();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check role/permission if specified
  let hasAccess = true;

  if (permission) {
    // Explicit permission requirement
    hasAccess = can(permission);
  } else if (allowedRoles && allowedRoles.length > 0) {
    // Explicit role requirement
    hasAccess = hasRole(...allowedRoles);
  } else {
    // No explicit permission - check route-based permissions
    hasAccess = canAccessRoute(location.pathname);
  }

  if (!hasAccess) {
    // Redirect to dashboard with unauthorized state
    return (
      <Navigate
        to={unauthorizedRedirect}
        replace
        state={{ unauthorized: true, from: location }}
      />
    );
  }

  return <>{children}</>;
}
