/**
 * Accounts Dashboard
 * Dashboard for ACCOUNTS role
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  CreditCard,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { DashboardLayout, DashboardSection } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { TableWidget } from '@/components/dashboard/TableWidget';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color: string;
}

export default function AccountsDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [stats, setStats] = useState<AccountsStats>({
    outstandingInvoices: 0,
    overdueAmount: 0,
    monthlyCollections: 0,
    pendingInvoices: 0,
    gstPayable: 0,
    totalReceivables: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<InvoiceSummary[]>([]);
  const [agingData, setAgingData] = useState<AgingBucket[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch invoices
      const invoicesRes = await api.get('/invoices', { params: { limit: 50 } });
      const invoices = invoicesRes.data.data || [];

      // Calculate stats
      const outstanding = invoices
        .filter((inv: { status: string }) => inv.status !== 'PAID')
        .reduce((sum: number, inv: { balanceAmount?: number }) => sum + (inv.balanceAmount || 0), 0);

      const today = new Date();
      const overdue = invoices
        .filter((inv: { dueDate?: string; status: string }) => {
          if (!inv.dueDate || inv.status === 'PAID') return false;
          return new Date(inv.dueDate) < today;
        })
        .reduce((sum: number, inv: { balanceAmount?: number }) => sum + (inv.balanceAmount || 0), 0);

      const pendingCount = invoices.filter(
        (inv: { status: string }) => inv.status === 'PENDING' || inv.status === 'PARTIALLY_PAID'
      ).length;

      // Calculate GST (placeholder - would need actual calculation)
      const gst = invoices.reduce(
        (sum: number, inv: { cgstAmount?: number; sgstAmount?: number; igstAmount?: number }) =>
          sum + (inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0),
        0
      );

      setStats({
        outstandingInvoices: outstanding,
        overdueAmount: overdue,
        monthlyCollections: 450000, // Placeholder
        pendingInvoices: pendingCount,
        gstPayable: gst,
        totalReceivables: outstanding,
      });

      // Calculate aging buckets
      const aging: AgingBucket[] = [
        { label: '0-30 Days', amount: 0, count: 0, color: 'bg-green-500' },
        { label: '31-60 Days', amount: 0, count: 0, color: 'bg-yellow-500' },
        { label: '61-90 Days', amount: 0, count: 0, color: 'bg-orange-500' },
        { label: '90+ Days', amount: 0, count: 0, color: 'bg-red-500' },
      ];

      invoices.forEach((inv: { dueDate?: string; status: string; balanceAmount?: number }) => {
        if (inv.status === 'PAID' || !inv.dueDate) return;
        const daysDue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        const amount = inv.balanceAmount || 0;

        if (daysDue <= 30) {
          aging[0].amount += amount;
          aging[0].count++;
        } else if (daysDue <= 60) {
          aging[1].amount += amount;
          aging[1].count++;
        } else if (daysDue <= 90) {
          aging[2].amount += amount;
          aging[2].count++;
        } else {
          aging[3].amount += amount;
          aging[3].count++;
        }
      });

      setAgingData(aging);

      // Set recent invoices
      setRecentInvoices(
        invoices.slice(0, 5).map((inv: Record<string, unknown>) => ({
          id: inv.id as string,
          invoiceNumber: inv.invoiceNumber as string || 'N/A',
          customerName: (inv.customer as { name?: string })?.name || 'N/A',
          totalAmount: inv.totalAmount as number || 0,
          balanceAmount: inv.balanceAmount as number || 0,
          status: inv.status as string,
          dueDate: inv.dueDate as string || '',
        }))
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch accounts dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getInvoiceStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PARTIALLY_PAID: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <DashboardLayout
      title="Accounts Dashboard"
      subtitle="Monitor invoices, payments, and financial health"
      onRefresh={fetchDashboardData}
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
