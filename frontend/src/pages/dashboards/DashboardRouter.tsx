/**
 * DashboardRouter Component
 * Routes users to their role-specific dashboard
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types/user.types';

// Map roles to their specific dashboard routes
const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/dashboard/admin',
  [UserRole.PRODUCTION_MANAGER]: '/dashboard/production',
  [UserRole.SALES]: '/dashboard/sales',
  [UserRole.MERCHANDISER]: '/dashboard/sales', // Same as SALES
  [UserRole.ACCOUNTS]: '/dashboard/accounts',
  [UserRole.INVENTORY]: '/dashboard/inventory',
  [UserRole.PURCHASE]: '/dashboard/procurement',
  [UserRole.QUALITY]: '/dashboard/quality',
  [UserRole.FACTORY_SUPERVISOR]: '/dashboard/production', // Same as Production Manager
};

/**
 * Redirects to the appropriate dashboard based on user role
 */
export default function DashboardRouter() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const dashboardPath = ROLE_DASHBOARD_MAP[user.role] || '/dashboard/general';

  return <Navigate to={dashboardPath} replace />;
}
