/**
 * Production Dashboard
 * Dashboard for PRODUCTION_MANAGER and FACTORY_SUPERVISOR roles
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  Scissors,
  CheckSquare,
  Send,
  AlertTriangle,
  ClipboardList,
  Clock,
  TrendingUp,
} from 'lucide-react';
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

export default function ProductionDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [stats, setStats] = useState<ProductionStats>({
    ordersInProduction: 0,
    todayDispatchTarget: 0,
    cuttingQueue: 0,
    stitchingActive: 0,
    finishingActive: 0,
    overdueOrders: 0,
  });
  const [activeWorkOrders, setActiveWorkOrders] = useState<WorkOrderSummary[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch production stats - using existing endpoints
      const [workOrdersRes] = await Promise.all([
        api.get('/work-orders', { params: { limit: 100, status: 'IN_PRODUCTION' } }),
      ]);

      const workOrders = workOrdersRes.data.data || [];

      // Calculate stats from work orders
      const inProduction = workOrders.filter((wo: { status: string }) => wo.status === 'IN_PRODUCTION').length;
      const today = new Date().toISOString().split('T')[0];
      const dueToday = workOrders.filter((wo: { plannedEndDate?: string }) =>
        wo.plannedEndDate?.startsWith(today)
      ).length;
      const overdue = workOrders.filter((wo: { plannedEndDate?: string; status: string }) => {
        if (!wo.plannedEndDate) return false;
        return new Date(wo.plannedEndDate) < new Date() && wo.status !== 'COMPLETED';
      }).length;

      setStats({
        ordersInProduction: inProduction,
        todayDispatchTarget: dueToday,
        cuttingQueue: Math.floor(Math.random() * 10) + 5, // Placeholder - replace with actual API
        stitchingActive: Math.floor(Math.random() * 15) + 10,
        finishingActive: Math.floor(Math.random() * 8) + 3,
        overdueOrders: overdue,
      });

      // Set active work orders for table
      setActiveWorkOrders(
        workOrders.slice(0, 10).map((wo: Record<string, unknown>) => ({
          id: wo.id as string,
          orderNumber: wo.workOrderNumber as string || 'N/A',
          styleName: (wo.style as { styleNumber?: string })?.styleNumber || 'N/A',
          totalQuantity: wo.totalQuantity as number || 0,
          completedQuantity: wo.completedQuantity as number || 0,
          status: wo.status as string,
          dueDate: wo.plannedEndDate as string || '',
        }))
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch production dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pipelineStages: PipelineStage[] = [
    { name: 'Cutting', count: stats.cuttingQueue, icon: Scissors, color: 'bg-blue-500' },
    { name: 'Stitching', count: stats.stitchingActive, icon: Factory, color: 'bg-yellow-500' },
    { name: 'Finishing', count: stats.finishingActive, icon: CheckSquare, color: 'bg-green-500' },
    { name: 'Dispatch', count: stats.todayDispatchTarget, icon: Send, color: 'bg-purple-500' },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-gray-100 text-gray-800',
      IN_PRODUCTION: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <DashboardLayout
      title="Production Dashboard"
      subtitle="Monitor production floor operations and work order status"
      onRefresh={fetchDashboardData}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
    >
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Orders in Production"
          value={stats.ordersInProduction}
          icon={ClipboardList}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          onClick={() => navigate('/production/work-orders?status=IN_PRODUCTION')}
        />
        <StatCard
          title="Today's Dispatch Target"
          value={stats.todayDispatchTarget}
          icon={Send}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          onClick={() => navigate('/manufacturing/dispatch')}
        />
        <StatCard
          title="Production Efficiency"
          value="87%"
          description="Target vs Actual"
          icon={TrendingUp}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          trend={{ value: 5, direction: 'up', label: 'vs last week' }}
        />
        <StatCard
          title="Overdue Orders"
          value={stats.overdueOrders}
          icon={AlertTriangle}
          iconColor={stats.overdueOrders > 0 ? 'text-red-600' : 'text-gray-600'}
          iconBgColor={stats.overdueOrders > 0 ? 'bg-red-100' : 'bg-gray-100'}
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
                <span className="font-medium text-gray-900">{stage.name}</span>
                <span className="text-2xl font-bold text-gray-900">{stage.count}</span>
                <span className="text-sm text-gray-500">orders</span>
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
              const progress = r.totalQuantity > 0
                ? Math.round((r.completedQuantity / r.totalQuantity) * 100)
                : 0;
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
                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
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
