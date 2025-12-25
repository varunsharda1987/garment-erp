/**
 * General Dashboard
 * Default dashboard for roles without a specific dashboard
 * Also used as Admin dashboard with role switcher
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  Users,
  TrendingUp,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { usePermissions } from '@/hooks/usePermissions';
import { UserRole } from '@/types/user.types';
import { formatCurrencyWhole } from '@/lib/currency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [viewAsRole, setViewAsRole] = useState<string>('all');
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    activeWorkOrders: 0,
    lowStockItems: 0,
    activeCustomers: 0,
    pendingQuotations: 0,
    outstandingInvoices: 0,
    monthlyRevenue: 0,
    overdueOrders: 0,
  });

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch summary data from various endpoints
      const [ordersRes, workOrdersRes, customersRes] = await Promise.all([
        api.get('/orders', { params: { limit: 1 } }),
        api.get('/work-orders', { params: { limit: 1, status: 'IN_PRODUCTION' } }),
        api.get('/customers', { params: { limit: 1, isActive: true } }),
      ]);

      setStats({
        totalOrders: ordersRes.data.pagination?.total || 0,
        activeWorkOrders: workOrdersRes.data.pagination?.total || 0,
        lowStockItems: 12, // Placeholder
        activeCustomers: customersRes.data.pagination?.total || 0,
        pendingQuotations: 8, // Placeholder
        outstandingInvoices: 250000, // Placeholder
        monthlyRevenue: 1500000, // Placeholder
        overdueOrders: 3, // Placeholder
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  const roleDisplayName = userRole
    ? userRole.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'User';

  return (
    <DashboardLayout
      title={isAdmin ? 'Admin Dashboard' : `${roleDisplayName} Dashboard`}
      subtitle="System-wide overview and key metrics"
      onRefresh={fetchDashboardData}
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
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          onClick={() => navigate('/orders')}
        />
        <StatCard
          title="Active Work Orders"
          value={stats.activeWorkOrders}
          icon={Factory}
          iconColor="text-indigo-600"
          iconBgColor="bg-indigo-100"
          onClick={() => navigate('/production/work-orders')}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrencyWhole(stats.monthlyRevenue)}
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          trend={{ value: 12, direction: 'up', label: 'vs last month' }}
        />
        <StatCard
          title="Overdue Orders"
          value={stats.overdueOrders}
          icon={AlertTriangle}
          iconColor={stats.overdueOrders > 0 ? 'text-red-600' : 'text-gray-600'}
          iconBgColor={stats.overdueOrders > 0 ? 'bg-red-100' : 'bg-gray-100'}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Customers"
          value={stats.activeCustomers}
          icon={Users}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          title="Pending Quotations"
          value={stats.pendingQuotations}
          icon={FileText}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-100"
          onClick={() => navigate('/quotations')}
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockItems}
          icon={Package}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
          onClick={() => navigate('/inventory/stock-levels')}
        />
        <StatCard
          title="Outstanding Invoices"
          value={formatCurrencyWhole(stats.outstandingInvoices)}
          icon={FileText}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
          onClick={() => navigate('/invoices')}
        />
      </div>

      {/* Quick Actions for Admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div
            className="p-4 bg-white rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/dashboard/production')}
          >
            <Factory className="h-8 w-8 text-indigo-600 mb-2" />
            <h3 className="font-medium">Production View</h3>
            <p className="text-sm text-gray-500">Shop floor operations</p>
          </div>
          <div
            className="p-4 bg-white rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/dashboard/sales')}
          >
            <ShoppingCart className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-medium">Sales View</h3>
            <p className="text-sm text-gray-500">Orders & quotations</p>
          </div>
          <div
            className="p-4 bg-white rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/dashboard/accounts')}
          >
            <FileText className="h-8 w-8 text-green-600 mb-2" />
            <h3 className="font-medium">Accounts View</h3>
            <p className="text-sm text-gray-500">Invoices & payments</p>
          </div>
          <div
            className="p-4 bg-white rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => navigate('/users')}
          >
            <Users className="h-8 w-8 text-purple-600 mb-2" />
            <h3 className="font-medium">User Management</h3>
            <p className="text-sm text-gray-500">Manage team access</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
