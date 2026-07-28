/**
 * Accounts Dashboard
 * Dashboard for ACCOUNTS role
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, DollarSign, AlertTriangle, Clock, Receipt } from 'lucide-react';
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
  { label: '0-30 Days', amount: 0, count: 0, color: 'bg-success-muted0' },
  { label: '31-60 Days', amount: 0, count: 0, color: 'bg-warning-muted0' },
  { label: '61-90 Days', amount: 0, count: 0, color: 'bg-primary/100' },
  { label: '90+ Days', amount: 0, count: 0, color: 'bg-destructive/100' },
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
      DRAFT: 'bg-muted text-foreground',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PARTIALLY_PAID: 'bg-info-muted text-info',
      PAID: 'bg-success-muted text-success',
      OVERDUE: 'bg-destructive/10 text-destructive',
      CANCELLED: 'bg-muted text-foreground',
    };
    return <Badge className={colors[status] || 'bg-muted text-foreground'}>{status.replace('_', ' ')}</Badge>;
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
          iconColor="text-info"
          iconBgColor="bg-info-muted"
          onClick={() => navigate('/invoices?status=PENDING')}
        />
        <StatCard
          title="Overdue Amount"
          value={formatCurrencyWhole(stats.overdueAmount)}
          icon={AlertTriangle}
          iconColor={stats.overdueAmount > 0 ? 'text-destructive' : 'text-muted-foreground'}
          iconBgColor={stats.overdueAmount > 0 ? 'bg-destructive/10' : 'bg-muted'}
          onClick={() => navigate('/invoices?status=OVERDUE')}
        />
        <StatCard
          title="This Month Collections"
          value={formatCurrencyWhole(stats.monthlyCollections)}
          icon={DollarSign}
          iconColor="text-success"
          iconBgColor="bg-success-muted"
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingInvoices}
          description="Awaiting payment"
          icon={Clock}
          iconColor="text-warning"
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
                  <span className="text-sm font-medium text-muted-foreground">{bucket.label}</span>
                  <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                </div>
                <p className="text-xl font-bold text-foreground">{formatCurrencyWhole(bucket.amount)}</p>
                <p className="text-sm text-muted-foreground">{bucket.count} invoices</p>
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
          iconColor="text-accent"
          iconBgColor="bg-accent/10"
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
              <span className={(value as number) > 0 ? 'text-destructive font-medium' : 'text-success'}>
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
                <span className={isOverdue ? 'text-destructive' : ''}>
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
