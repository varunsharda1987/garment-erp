/**
 * General Dashboard
 * Default dashboard for roles without a specific dashboard
 * Also used as Admin dashboard with role switcher
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Factory, Package, Users, TrendingUp, FileText, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { usePermissions } from '@/hooks/usePermissions';
import { UserRole } from '@/types/user.types';
import { formatCurrencyWhole } from '@/lib/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface DashboardStats {
  totalOrders: number;
  activeWorkOrders: number;
  lowStockItems: number;
  activeCustomers: number;
  pendingQuotations: number;
  outstandingInvoices: number;
  monthlyRevenue: number;
  overdueOrders: number;
}

export default function GeneralDashboard() {
  const navigate = useNavigate();
  const { userRole, isAdmin } = usePermissions();
  const [viewAsRole, setViewAsRole] = useState<string>('all');

  const {
    data: apiStats,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-general-stats'],
    queryFn: () => api.get('/dashboard/general-stats').then((r) => r.data.data),
  });

  const stats: DashboardStats = {
    totalOrders: apiStats?.totalOrders ?? 0,
    activeWorkOrders: apiStats?.activeWorkOrders ?? 0,
    lowStockItems: apiStats?.lowStockItems ?? 0,
    activeCustomers: apiStats?.activeCustomers ?? 0,
    pendingQuotations: apiStats?.pendingQuotations ?? 0,
    outstandingInvoices: apiStats?.outstandingInvoices ?? 0,
    monthlyRevenue: apiStats?.monthlyRevenue ?? 0,
    overdueOrders: apiStats?.overdueOrders ?? 0,
  };

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  const handleRoleSwitch = (role: string) => {
    setViewAsRole(role);
    if (role !== 'all') {
      // Navigate to role-specific dashboard
      const roleMap: Record<string, string> = {
        [UserRole.PRODUCTION_MANAGER]: '/dashboard/production',
        [UserRole.SALES]: '/dashboard/sales',
        [UserRole.MERCHANDISER]: '/dashboard/sales',
        [UserRole.ACCOUNTS]: '/dashboard/accounts',
      };
      if (roleMap[role]) {
        navigate(roleMap[role]);
      }
    }
  };

  const roleDisplayName = userRole ? userRole.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'User';

  return (
    <DashboardLayout
      title={isAdmin ? 'Admin Dashboard' : `${roleDisplayName} Dashboard`}
      subtitle="System-wide overview and key metrics"
      onRefresh={() => refetch()}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
      headerActions={
        isAdmin && (
          <Select value={viewAsRole} onValueChange={handleRoleSwitch}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="View as role..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (Admin View)</SelectItem>
              <SelectItem value={UserRole.PRODUCTION_MANAGER}>Production Manager</SelectItem>
              <SelectItem value={UserRole.SALES}>Sales</SelectItem>
              <SelectItem value={UserRole.MERCHANDISER}>Merchandiser</SelectItem>
              <SelectItem value={UserRole.ACCOUNTS}>Accounts</SelectItem>
            </SelectContent>
          </Select>
        )
      }
    >
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
          iconColor="text-info"
          iconBgColor="bg-info-muted"
          onClick={() => navigate('/orders')}
        />
        <StatCard
          title="Active Work Orders"
          value={stats.activeWorkOrders}
          icon={Factory}
          iconColor="text-primary"
          iconBgColor="bg-primary/10"
          onClick={() => navigate('/production/work-orders')}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrencyWhole(stats.monthlyRevenue)}
          icon={TrendingUp}
          iconColor="text-success"
          iconBgColor="bg-success-muted"
          trend={{ value: 12, direction: 'up', label: 'vs last month' }}
        />
        <StatCard
          title="Overdue Orders"
          value={stats.overdueOrders}
          icon={AlertTriangle}
          iconColor={stats.overdueOrders > 0 ? 'text-destructive' : 'text-muted-foreground'}
          iconBgColor={stats.overdueOrders > 0 ? 'bg-destructive/10' : 'bg-muted'}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Customers"
          value={stats.activeCustomers}
          icon={Users}
          iconColor="text-accent"
          iconBgColor="bg-accent/10"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          title="Pending Quotations"
          value={stats.pendingQuotations}
          icon={FileText}
          iconColor="text-warning"
          iconBgColor="bg-yellow-100"
          onClick={() => navigate('/quotations')}
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockItems}
          icon={Package}
          iconColor="text-primary"
          iconBgColor="bg-orange-100"
          onClick={() => navigate('/inventory/stock-levels')}
        />
        <StatCard
          title="Outstanding Invoices"
          value={formatCurrencyWhole(stats.outstandingInvoices)}
          icon={FileText}
          iconColor="text-destructive"
          iconBgColor="bg-destructive/10"
          onClick={() => navigate('/invoices')}
        />
      </div>

      {/* Quick Actions for Admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div
            className="p-4 bg-card rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/dashboard/production')}
          >
            <Factory className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-medium">Production View</h3>
            <p className="text-sm text-muted-foreground">Shop floor operations</p>
          </div>
          <div
            className="p-4 bg-card rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/dashboard/sales')}
          >
            <ShoppingCart className="h-8 w-8 text-info mb-2" />
            <h3 className="font-medium">Sales View</h3>
            <p className="text-sm text-muted-foreground">Orders & quotations</p>
          </div>
          <div
            className="p-4 bg-card rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/dashboard/accounts')}
          >
            <FileText className="h-8 w-8 text-success mb-2" />
            <h3 className="font-medium">Accounts View</h3>
            <p className="text-sm text-muted-foreground">Invoices & payments</p>
          </div>
          <div
            className="p-4 bg-card rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/users')}
          >
            <Users className="h-8 w-8 text-accent mb-2" />
            <h3 className="font-medium">User Management</h3>
            <p className="text-sm text-muted-foreground">Manage team access</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
