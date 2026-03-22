/**
 * Sales Dashboard
 * Dashboard for SALES and MERCHANDISER roles
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, FileText, Users, Calendar, DollarSign, TrendingUp, Clock, Shirt } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { TableWidget } from '@/components/dashboard/TableWidget';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatCurrencyWhole, formatCurrency } from '@/lib/currency';

interface SalesStats {
  activeOrders: number;
  pendingQuotations: number;
  activeCustomers: number;
  upcomingDeliveries: number;
  monthlyRevenue: number;
  stylesPendingCosting: number;
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  deliveryDate: string;
  [key: string]: unknown;
}

interface QuotationSummary {
  id: string;
  quotationNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  validUntil: string;
  [key: string]: unknown;
}

interface SalesDashboardData {
  stats: SalesStats;
  recentOrders: OrderSummary[];
  pendingQuotations: QuotationSummary[];
}

export default function SalesDashboard() {
  const navigate = useNavigate();

  const {
    data: dashboardData,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery<SalesDashboardData>({
    queryKey: ['dashboard-sales-stats'],
    queryFn: () => api.get('/dashboard/sales-stats').then((r) => r.data.data),
  });

  const stats: SalesStats = {
    activeOrders: dashboardData?.stats?.activeOrders ?? 0,
    pendingQuotations: dashboardData?.stats?.pendingQuotations ?? 0,
    activeCustomers: dashboardData?.stats?.activeCustomers ?? 0,
    upcomingDeliveries: dashboardData?.stats?.upcomingDeliveries ?? 0,
    monthlyRevenue: dashboardData?.stats?.monthlyRevenue ?? 0,
    stylesPendingCosting: dashboardData?.stats?.stylesPendingCosting ?? 0,
  };

  const recentOrders: OrderSummary[] = dashboardData?.recentOrders ?? [];
  const pendingQuotations: QuotationSummary[] = dashboardData?.pendingQuotations ?? [];

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  const getOrderStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      IN_PRODUCTION: 'bg-indigo-100 text-indigo-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status.replace('_', ' ')}</Badge>;
  };

  const getQuotationStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SENT: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-orange-100 text-orange-800',
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  // Use getQuotationStatusBadge for quotations table if needed
  void getQuotationStatusBadge;

  return (
    <DashboardLayout
      title="Sales Dashboard"
      subtitle="Monitor orders, quotations, and customer relationships"
      onRefresh={() => refetch()}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
    >
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Orders"
          value={stats.activeOrders}
          icon={ShoppingCart}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          onClick={() => navigate('/orders')}
        />
        <StatCard
          title="Pending Quotations"
          value={stats.pendingQuotations}
          icon={FileText}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-100"
          onClick={() => navigate('/quotations?status=SENT')}
        />
        <StatCard
          title="This Month Revenue"
          value={formatCurrencyWhole(stats.monthlyRevenue)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          trend={{ value: 12, direction: 'up', label: 'vs last month' }}
        />
        <StatCard
          title="Upcoming Deliveries"
          value={stats.upcomingDeliveries}
          description="Next 7 days"
          icon={Calendar}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
      </div>

      {/* Second row of stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Active Customers"
          value={stats.activeCustomers}
          icon={Users}
          iconColor="text-indigo-600"
          iconBgColor="bg-indigo-100"
          onClick={() => navigate('/customers')}
        />
        <StatCard
          title="Styles Pending Costing"
          value={stats.stylesPendingCosting}
          icon={Shirt}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
          onClick={() => navigate('/cost-sheets')}
        />
        <StatCard
          title="Conversion Rate"
          value="68%"
          description="Quotation to Order"
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          trend={{ value: 5, direction: 'up' }}
        />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <TableWidget
          title="Recent Orders"
          columns={[
            { key: 'orderNumber', label: 'Order #' },
            { key: 'customerName', label: 'Customer' },
            {
              key: 'totalAmount',
              label: 'Amount',
              align: 'right',
              render: (value) => formatCurrency(value as number),
            },
            {
              key: 'status',
              label: 'Status',
              render: (value) => getOrderStatusBadge(value as string),
            },
          ]}
          data={recentOrders}
          viewAllPath="/orders"
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          emptyMessage="No recent orders"
          isLoading={isLoading}
        />

        {/* Pending Quotations */}
        <TableWidget
          title="Pending Quotations"
          columns={[
            { key: 'quotationNumber', label: 'Quotation #' },
            { key: 'customerName', label: 'Customer' },
            {
              key: 'totalAmount',
              label: 'Amount',
              align: 'right',
              render: (value) => formatCurrency(value as number),
            },
            {
              key: 'validUntil',
              label: 'Valid Until',
              render: (value) => {
                if (!value) return '-';
                const date = new Date(value as string);
                const isExpired = date < new Date();
                return (
                  <span className={isExpired ? 'text-red-600' : ''}>
                    <Clock className="h-4 w-4 inline mr-1" />
                    {date.toLocaleDateString()}
                  </span>
                );
              },
            },
          ]}
          data={pendingQuotations}
          viewAllPath="/quotations"
          onRowClick={(row) => navigate(`/quotations/${row.id}`)}
          emptyMessage="No pending quotations"
          isLoading={isLoading}
        />
      </div>
    </DashboardLayout>
  );
}
