/**
 * Accounts Dashboard
 * Dashboard for ACCOUNTS role
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, DollarSign, AlertTriangle, TrendingUp, Clock, Receipt, BarChart3 } from 'lucide-react';
import { DashboardLayout, DashboardSection } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { TableWidget } from '@/components/dashboard/TableWidget';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import { formatCurrencyWhole, formatCurrency } from '@/lib/currency';

interface AccountsStats {
  outstandingInvoices: number;
  overdueAmount: number;
  monthlyCollections: number;
  pendingInvoices: number;
  gstPayable: number;
  totalReceivables: number;
}

interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  balanceAmount: number;
  status: string;
  dueDate: string;
  [key: string]: unknown;
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color: string;
}

interface AccountsDashboardData {
  stats: AccountsStats;
  recentInvoices: InvoiceSummary[];
  agingData: AgingBucket[];
}

const emptyAging: AgingBucket[] = [
  { label: '0-30 Days', amount: 0, count: 0, color: 'bg-green-500' },
  { label: '31-60 Days', amount: 0, count: 0, color: 'bg-yellow-500' },
  { label: '61-90 Days', amount: 0, count: 0, color: 'bg-orange-500' },
  { label: '90+ Days', amount: 0, count: 0, color: 'bg-red-500' },
];

export default function AccountsDashboard() {
  const navigate = useNavigate();

  const {
    data: dashboardData,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery<AccountsDashboardData>({
    queryKey: ['dashboard-accounts-stats'],
    queryFn: () => api.get('/dashboard/accounts-stats').then((r) => r.data.data),
  });

  const stats: AccountsStats = {
    outstandingInvoices: dashboardData?.stats?.outstandingInvoices ?? 0,
    overdueAmount: dashboardData?.stats?.overdueAmount ?? 0,
    monthlyCollections: dashboardData?.stats?.monthlyCollections ?? 0,
    pendingInvoices: dashboardData?.stats?.pendingInvoices ?? 0,
    gstPayable: dashboardData?.stats?.gstPayable ?? 0,
    totalReceivables: dashboardData?.stats?.totalReceivables ?? 0,
  };

  const recentInvoices: InvoiceSummary[] = dashboardData?.recentInvoices ?? [];
  const agingData: AgingBucket[] = dashboardData?.agingData ?? emptyAging;

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  const getInvoiceStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PARTIALLY_PAID: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <DashboardLayout
      title="Accounts Dashboard"
      subtitle="Monitor invoices, payments, and financial health"
      onRefresh={() => refetch()}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
    >
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Outstanding Invoices"
          value={formatCurrencyWhole(stats.outstandingInvoices)}
          icon={FileText}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          onClick={() => navigate('/invoices?status=PENDING')}
        />
        <StatCard
          title="Overdue Amount"
          value={formatCurrencyWhole(stats.overdueAmount)}
          icon={AlertTriangle}
          iconColor={stats.overdueAmount > 0 ? 'text-red-600' : 'text-gray-600'}
          iconBgColor={stats.overdueAmount > 0 ? 'bg-red-100' : 'bg-gray-100'}
          onClick={() => navigate('/invoices?status=OVERDUE')}
        />
        <StatCard
          title="This Month Collections"
          value={formatCurrencyWhole(stats.monthlyCollections)}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          trend={{ value: 8, direction: 'up', label: 'vs last month' }}
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingInvoices}
          description="Awaiting payment"
          icon={Clock}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-100"
        />
      </div>

      {/* Receivables Aging */}
      <DashboardSection title="Receivables Aging" description="Outstanding amounts by age">
        <div className="grid grid-cols-4 gap-4">
          {agingData.map((bucket) => (
            <Card key={bucket.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">{bucket.label}</span>
                  <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrencyWhole(bucket.amount)}</p>
                <p className="text-sm text-gray-500">{bucket.count} invoices</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Aging Bar */}
        <div className="mt-4 h-4 rounded-full overflow-hidden flex">
          {agingData.map((bucket, index) => {
            const total = agingData.reduce((sum, b) => sum + b.amount, 0);
            const width = total > 0 ? (bucket.amount / total) * 100 : 25;
            return (
              <div
                key={bucket.label}
                className={`${bucket.color} ${index === 0 ? 'rounded-l-full' : ''} ${
                  index === agingData.length - 1 ? 'rounded-r-full' : ''
                }`}
                style={{ width: `${width}%` }}
                title={`${bucket.label}: ${formatCurrencyWhole(bucket.amount)}`}
              />
            );
          })}
        </div>
      </DashboardSection>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          title="GST Payable"
          value={formatCurrencyWhole(stats.gstPayable)}
          description="CGST + SGST + IGST"
          icon={Receipt}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Collection Rate"
          value="78%"
          description="On-time payments"
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          trend={{ value: 3, direction: 'up' }}
        />
        <StatCard
          title="Avg. Payment Days"
          value="32"
          description="Days to receive payment"
          icon={BarChart3}
          iconColor="text-indigo-600"
          iconBgColor="bg-indigo-100"
        />
      </div>

      {/* Recent Invoices */}
      <TableWidget
        title="Recent Invoices"
        description="Latest invoice activity"
        columns={[
          { key: 'invoiceNumber', label: 'Invoice #' },
          { key: 'customerName', label: 'Customer' },
          {
            key: 'totalAmount',
            label: 'Total',
            align: 'right',
            render: (value) => formatCurrency(value as number),
          },
          {
            key: 'balanceAmount',
            label: 'Balance',
            align: 'right',
            render: (value) => (
              <span className={(value as number) > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                {formatCurrency(value as number)}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (value) => getInvoiceStatusBadge(value as string),
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            render: (value) => {
              if (!value) return '-';
              const date = new Date(value as string);
              const isOverdue = date < new Date();
              return (
                <span className={isOverdue ? 'text-red-600' : ''}>
                  <Clock className="h-4 w-4 inline mr-1" />
                  {date.toLocaleDateString()}
                </span>
              );
            },
          },
        ]}
        data={recentInvoices}
        viewAllPath="/invoices"
        onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        emptyMessage="No invoices found"
        isLoading={isLoading}
      />
    </DashboardLayout>
  );
}
