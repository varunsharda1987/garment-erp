// Production Dashboard - Real-time production monitoring
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, TrendingUp, AlertCircle, Clock, CheckCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import workOrderService from '../services/workOrder.service';
import { OrderStatus } from '../types/production.types';
import type { ProductionDashboardSummary, WorkOrder } from '../types/production.types';

export default function ProductionDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ProductionDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await workOrderService.getDashboard();
      setDashboard(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'IN_PRODUCTION':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'DISPATCHED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateProgress = (workOrder: WorkOrder) => {
    if (workOrder.totalQuantity === 0) return 0;
    return Math.round((workOrder.completedQuantity / workOrder.totalQuantity) * 100);
  };

  const getTotalQuantity = (status: OrderStatus) => {
    const summary = dashboard?.statusSummary.find(s => s.status === status);
    return summary?._sum.totalQuantity || 0;
  };

  const getCompletedQuantity = (status: OrderStatus) => {
    const summary = dashboard?.statusSummary.find(s => s.status === status);
    return summary?._sum.completedQuantity || 0;
  };

  const getWorkOrderCount = (status: OrderStatus) => {
    const summary = dashboard?.statusSummary.find(s => s.status === status);
    return summary?._count.id || 0;
  };

  if (loading && !dashboard) {
    return (
      <div className="container mx-auto py-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="Production Dashboard">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <Home className="mr-2 h-4 w-4" />
            Main Dashboard
          </Button>
          <Button variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/production/work-orders/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Work Order
          </Button>
        </div>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {/* Pending */}
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getWorkOrderCount(OrderStatus.PENDING)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {getTotalQuantity(OrderStatus.PENDING).toLocaleString()} pieces
            </p>
          </CardContent>
        </Card>

        {/* In Production */}
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Production
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getWorkOrderCount(OrderStatus.IN_PRODUCTION)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {getCompletedQuantity(OrderStatus.IN_PRODUCTION).toLocaleString()} / {getTotalQuantity(OrderStatus.IN_PRODUCTION).toLocaleString()} completed
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getWorkOrderCount(OrderStatus.COMPLETED)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {getTotalQuantity(OrderStatus.COMPLETED).toLocaleString()} pieces
            </p>
          </CardContent>
        </Card>

        {/* Dispatched */}
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dispatched
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getWorkOrderCount(OrderStatus.DISPATCHED)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {getTotalQuantity(OrderStatus.DISPATCHED).toLocaleString()} pieces
            </p>
          </CardContent>
        </Card>

        {/* Cancelled */}
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cancelled
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getWorkOrderCount(OrderStatus.CANCELLED)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {getTotalQuantity(OrderStatus.CANCELLED).toLocaleString()} pieces
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Work Orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Work Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order #</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard?.activeWorkOrders && dashboard.activeWorkOrders.length > 0 ? (
                  dashboard.activeWorkOrders.map((wo) => (
                    <TableRow
                      key={wo.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/production/work-orders/${wo.id}`)}
                    >
                      <TableCell className="font-medium">
                        {wo.workOrderNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{wo.styles.styleCode}</div>
                          <div className="text-sm text-muted-foreground">
                            {wo.styles.styleName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{wo.locations.locationName}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{wo.completedQuantity} / {wo.totalQuantity}</span>
                            <span className="text-muted-foreground">
                              {calculateProgress(wo)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${calculateProgress(wo)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(wo.status)}>
                          {wo.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{formatDate(wo.plannedStartDate)}</div>
                        <div className="text-muted-foreground">
                          to {formatDate(wo.plannedEndDate)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No active work orders
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Updates */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Production Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard?.recentUpdates && dashboard.recentUpdates.length > 0 ? (
                dashboard.recentUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-start space-x-4 p-3 rounded-lg border hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">
                          {update.work_orders?.workOrderNumber || 'N/A'}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(update.updateDate).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {update.productionStage.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-muted-foreground">
                          {update.quantityCompleted} pieces completed
                        </span>
                      </div>
                      {update.remarks && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {update.remarks}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated by: {update.users.firstName} {update.users.lastName}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent updates
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
