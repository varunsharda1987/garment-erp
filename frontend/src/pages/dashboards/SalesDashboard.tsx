/**
 * Sales Dashboard
 * Dashboard for SALES and MERCHANDISER roles
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  FileText,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Shirt,
} from 'lucide-react';
import { DashboardLayout, DashboardSection } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { TableWidget } from '@/components/dashboard/TableWidget';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';

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
}

interface QuotationSummary {
  id: string;
  quotationNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  validUntil: string;
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [stats, setStats] = useState<SalesStats>({
    activeOrders: 0,
    pendingQuotations: 0,
    activeCustomers: 0,
    upcomingDeliveries: 0,
    monthlyRevenue: 0,
    stylesPendingCosting: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [pendingQuotations, setPendingQuotations] = useState<QuotationSummary[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch data from existing endpoints
      const [ordersRes, quotationsRes, customersRes] = await Promise.all([
        api.get('/orders', { params: { limit: 10 } }),
        api.get('/quotations', { params: { limit: 10, status: 'SENT' } }),
        api.get('/customers', { params: { limit: 1, isActive: true } }),
      ]);

      const orders = ordersRes.data.data || [];
      const quotations = quotationsRes.data.data || [];
      const customerTotal = customersRes.data.pagination?.total || 0;

      // Calculate stats
      const activeOrderCount = orders.filter(
        (o: { status: string }) => ['PENDING', 'IN_PRODUCTION', 'CONFIRMED'].includes(o.status)
      ).length;

      const pendingQuotCount = quotations.filter(
        (q: { status: string }) => q.status === 'SENT' || q.status === 'DRAFT'
      ).length;

      // Calculate upcoming deliveries (next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcoming = orders.filter((o: { expectedDeliveryDate?: string; status: string }) => {
        if (!o.expectedDeliveryDate) return false;
        const deliveryDate = new Date(o.expectedDeliveryDate);
        return deliveryDate >= new Date() && deliveryDate <= nextWeek && o.status !== 'COMPLETED';
      }).length;

      // Calculate monthly revenue
      const thisMonth = new Date().getMonth();
      const monthlyRev = orders
        .filter((o: { createdAt: string }) => new Date(o.createdAt).getMonth() === thisMonth)
        .reduce((sum: number, o: { totalAmount?: number }) => sum + (o.totalAmount || 0), 0);

      setStats({
        activeOrders: activeOrderCount,
        pendingQuotations: pendingQuotCount,
        activeCustomers: customerTotal,
        upcomingDeliveries: upcoming,
        monthlyRevenue: monthlyRev,
        stylesPendingCosting: 5, // Placeholder - replace with actual API
      });

      // Set recent orders
      setRecentOrders(
        orders.slice(0, 5).map((o: Record<string, unknown>) => ({
          id: o.id as string,
          orderNumber: o.orderNumber as string || 'N/A',
          customerName: (o.customer as { name?: string })?.name || 'N/A',
          totalAmount: o.totalAmount as number || 0,
          status: o.status as string,
          deliveryDate: o.expectedDeliveryDate as string || '',
        }))
      );

      // Set pending quotations
      setPendingQuotations(
        quotations.slice(0, 5).map((q: Record<string, unknown>) => ({
          id: q.id as string,
          quotationNumber: q.quotationNumber as string || 'N/A',
          customerName: (q.customer as { name?: string })?.name || 'N/A',
          totalAmount: q.totalAmount as number || 0,
          status: q.status as string,
          validUntil: q.validUntil as string || '',
        }))
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch sales dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getOrderStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      IN_PRODUCTION: 'bg-indigo-100 text-indigo-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getQuotationStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SENT: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout
      title="Sales Dashboard"
      subtitle="Monitor orders, quotations, and customer relationships"
      onRefresh={fetchDashboardData}
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
          value={formatCurrency(stats.monthlyRevenue)}
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
