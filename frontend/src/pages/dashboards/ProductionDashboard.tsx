/**
 * Production Dashboard
 * Dashboard for PRODUCTION_MANAGER and FACTORY_SUPERVISOR roles
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Factory, Scissors, CheckSquare, Send, AlertTriangle, ClipboardList, Clock, TrendingUp } from 'lucide-react';
import { DashboardLayout, DashboardSection } from '@/components/dashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { TableWidget } from '@/components/dashboard/TableWidget';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/api';

interface ProductionStats {
  ordersInProduction: number;
  todayDispatchTarget: number;
  cuttingQueue: number;
  stitchingActive: number;
  finishingActive: number;
  overdueOrders: number;
}

interface WorkOrderSummary {
  id: string;
  orderNumber: string;
  styleName: string;
  totalQuantity: number;
  completedQuantity: number;
  status: string;
  dueDate: string;
}

interface PipelineStage {
  name: string;
  count: number;
  icon: React.ElementType;
  color: string;
}

interface ProductionDashboardData {
  stats: ProductionStats;
  activeWorkOrders: WorkOrderSummary[];
}

export default function ProductionDashboard() {
  const navigate = useNavigate();

  const {
    data: dashboardData,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery<ProductionDashboardData>({
    queryKey: ['dashboard-production-stats'],
    queryFn: () => api.get('/dashboard/production-stats').then((r) => r.data.data),
  });

  const stats: ProductionStats = {
    ordersInProduction: dashboardData?.stats?.ordersInProduction ?? 0,
    todayDispatchTarget: dashboardData?.stats?.todayDispatchTarget ?? 0,
    cuttingQueue: dashboardData?.stats?.cuttingQueue ?? 0,
    stitchingActive: dashboardData?.stats?.stitchingActive ?? 0,
    finishingActive: dashboardData?.stats?.finishingActive ?? 0,
    overdueOrders: dashboardData?.stats?.overdueOrders ?? 0,
  };

  const activeWorkOrders: WorkOrderSummary[] = dashboardData?.activeWorkOrders ?? [];

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date();

  const pipelineStages: PipelineStage[] = [
    { name: 'Cutting', count: stats.cuttingQueue, icon: Scissors, color: 'bg-info-muted0' },
    { name: 'Stitching', count: stats.stitchingActive, icon: Factory, color: 'bg-warning-muted0' },
    { name: 'Finishing', count: stats.finishingActive, icon: CheckSquare, color: 'bg-success-muted0' },
    { name: 'Dispatch', count: stats.todayDispatchTarget, icon: Send, color: 'bg-accent/100' },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-muted text-foreground',
      IN_PRODUCTION: 'bg-info-muted text-info',
      COMPLETED: 'bg-success-muted text-success',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
    };
    return <Badge className={colors[status] || 'bg-muted text-foreground'}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <DashboardLayout
      title="Production Dashboard"
      subtitle="Monitor production floor operations and work order status"
      onRefresh={() => refetch()}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
    >
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Orders in Production"
          value={stats.ordersInProduction}
          icon={ClipboardList}
          iconColor="text-info"
          iconBgColor="bg-info-muted"
          onClick={() => navigate('/production/work-orders?status=IN_PRODUCTION')}
        />
        <StatCard
          title="Today's Dispatch Target"
          value={stats.todayDispatchTarget}
          icon={Send}
          iconColor="text-accent"
          iconBgColor="bg-accent/10"
          onClick={() => navigate('/manufacturing/dispatch')}
        />
        <StatCard
          title="Production Efficiency"
          value="87%"
          description="Target vs Actual"
          icon={TrendingUp}
          iconColor="text-success"
          iconBgColor="bg-success-muted"
          trend={{ value: 5, direction: 'up', label: 'vs last week' }}
        />
        <StatCard
          title="Overdue Orders"
          value={stats.overdueOrders}
          icon={AlertTriangle}
          iconColor={stats.overdueOrders > 0 ? 'text-destructive' : 'text-muted-foreground'}
          iconBgColor={stats.overdueOrders > 0 ? 'bg-destructive/10' : 'bg-muted'}
          onClick={() => navigate('/production/work-orders?overdue=true')}
        />
      </div>

      {/* Production Pipeline */}
      <DashboardSection title="Production Pipeline" description="Current status across manufacturing stages">
        <div className="flex items-center justify-between gap-4 py-4">
          {pipelineStages.map((stage, index) => (
            <div key={stage.name} className="flex-1 relative">
              <div className="flex flex-col items-center">
                <div className={`p-4 rounded-full ${stage.color} text-white mb-2`}>
                  <stage.icon className="h-6 w-6" />
                </div>
                <span className="font-medium text-foreground">{stage.name}</span>
                <span className="text-2xl font-bold text-foreground">{stage.count}</span>
                <span className="text-sm text-muted-foreground">orders</span>
              </div>
              {index < pipelineStages.length - 1 && (
                <div className="absolute top-8 left-[60%] w-[80%] h-0.5 bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* Active Work Orders */}
      <TableWidget
        title="Active Work Orders"
        description="Currently in production"
        columns={[
          { key: 'orderNumber', label: 'Work Order #' },
          { key: 'styleName', label: 'Style' },
          {
            key: 'progress',
            label: 'Progress',
            render: (_: unknown, row: Record<string, unknown>) => {
              const r = row as unknown as WorkOrderSummary;
              const progress = r.totalQuantity > 0 ? Math.round((r.completedQuantity / r.totalQuantity) * 100) : 0;
              return (
                <div className="w-32">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{r.completedQuantity}</span>
                    <span>{r.totalQuantity}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            },
          },
          {
            key: 'status',
            label: 'Status',
            render: (value) => getStatusBadge(value as string),
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            render: (value) => {
              if (!value) return '-';
              const date = new Date(value as string);
              const isOverdue = date < new Date();
              return (
                <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                  <Clock className="h-4 w-4 inline mr-1" />
                  {date.toLocaleDateString()}
                </span>
              );
            },
          },
        ]}
        data={activeWorkOrders as unknown as Record<string, unknown>[]}
        maxRows={5}
        viewAllPath="/production/work-orders"
        onRowClick={(row) => navigate(`/production/work-orders/${row.id}`)}
        emptyMessage="No active work orders"
        isLoading={isLoading}
      />
    </DashboardLayout>
  );
}
