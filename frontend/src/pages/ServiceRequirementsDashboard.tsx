/**
 * Service Requirements Dashboard
 * Overview of work order service requirements, processor assignments, and service PO status
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getDashboardStats,
  getRequirementsNeedingPO,
  getOverdueRequirements,
} from '@/services/serviceRequirement.service';
import type { ServiceDashboardStats, ServiceRequirement } from '@/types/serviceRequirement.types';
import {
  ServiceRequirementStatusColors,
  ServiceRequirementStatusLabels,
  ServiceTypeLabels,
} from '@/types/serviceRequirement.types';
import { handleApiError } from '@/lib/api-error-handler';
import {
  Zap,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  ArrowRight,
  RefreshCw,
  ShoppingCart,
  UserCheck,
  DollarSign,
} from 'lucide-react';

export default function ServiceRequirementsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ServiceDashboardStats | null>(null);
  const [needingPO, setNeedingPO] = useState<ServiceRequirement[]>([]);
  const [overdueReqs, setOverdueReqs] = useState<ServiceRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsData, needingPOData, overdueData] = await Promise.all([
        getDashboardStats(),
        getRequirementsNeedingPO({ limit: 5 }),
        getOverdueRequirements({ limit: 5 }),
      ]);

      setStats(statsData);
      setNeedingPO(needingPOData.data || []);
      setOverdueReqs(overdueData.data || []);
    } catch (error) {
      handleApiError(error, 'Failed to load dashboard data', false);
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    color = 'text-primary',
    onClick,
  }: {
    title: string;
    value: number | string;
    description?: string;
    icon: React.ElementType;
    color?: string;
    onClick?: () => void;
  }) => (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Loading Service Requirements Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <Zap className="h-6 w-6 text-accent" />
            Service Requirements
          </h1>
          <p className="text-muted-foreground">
            Track service needs, processor assignments, and service purchase order status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/service-requirements/list')}>
            <FileText className="h-4 w-4 mr-2" />
            View All Services
          </Button>
        </div>
      </div>

      {/* Stats Cards - First Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Services"
          value={stats?.totalServices || 0}
          description="Across all work orders"
          icon={Package}
          color="text-info"
          onClick={() => navigate('/service-requirements/list')}
        />
        <StatCard
          title="Pending"
          value={stats?.pendingServices || 0}
          description="Awaiting PO generation"
          icon={Clock}
          color="text-primary"
          onClick={() => navigate('/service-requirements/list?status=PENDING')}
        />
        <StatCard
          title="PO Generated"
          value={stats?.poGeneratedServices || 0}
          description="Purchase orders created"
          icon={CheckCircle}
          color="text-success"
          onClick={() => navigate('/service-requirements/list?status=PO_GENERATED')}
        />
        <StatCard
          title="In Progress"
          value={stats?.inProgressServices || 0}
          description="Services being executed"
          icon={RefreshCw}
          color="text-warning"
          onClick={() => navigate('/service-requirements/list?status=IN_PROGRESS')}
        />
      </div>

      {/* Stats Cards - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Completed"
          value={stats?.completedServices || 0}
          description="Services finished"
          icon={CheckCircle}
          color="text-emerald-600"
          onClick={() => navigate('/service-requirements/list?status=COMPLETED')}
        />
        <StatCard
          title="Without Processor"
          value={stats?.servicesWithoutProcessor || 0}
          description="Needs processor assignment"
          icon={AlertTriangle}
          color="text-destructive"
          onClick={() => navigate('/service-requirements/list?unassigned=true')}
        />
        <StatCard
          title="Estimated Cost"
          value={`₹${(stats?.totalEstimatedCost || 0).toLocaleString()}`}
          description="Total service cost estimate"
          icon={DollarSign}
          color="text-accent"
        />
      </div>

      {/* Quick Actions Card */}
      <Card className="border-success/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-success" />
            Quick Actions
          </CardTitle>
          <CardDescription>Common service requirement operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="w-full justify-start border-accent text-accent hover:bg-accent/10"
              onClick={() => navigate('/work-orders')}
            >
              <Zap className="h-4 w-4 mr-2" />
              Calculate Services for Work Order
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-info text-info hover:bg-info-muted"
              onClick={() => navigate('/service-requirements/list?status=PENDING')}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Assign Processors
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-success text-success hover:bg-success-muted"
              onClick={() => navigate('/service-requirements/list?status=PENDING')}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Bulk Generate Service POs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requirements Needing PO */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Services Needing PO</CardTitle>
                <CardDescription>Services pending purchase order generation</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/service-requirements/list?status=PENDING')}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {needingPO.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No services currently need PO</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needingPO.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/work-orders/${req.workOrderId}`)}
                    >
                      <TableCell>
                        <Badge variant="outline">{ServiceTypeLabels[req.serviceType]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{req.workOrder?.workOrderNumber || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={ServiceRequirementStatusColors[req.status]}>
                          {ServiceRequirementStatusLabels[req.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Overdue Requirements */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Overdue Service Requirements
                </CardTitle>
                <CardDescription>Services behind schedule</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/service-requirements/list?overdue=true')}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {overdueReqs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No overdue service requirements</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueReqs.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/work-orders/${req.workOrderId}`)}
                    >
                      <TableCell>
                        <Badge variant="outline">{ServiceTypeLabels[req.serviceType]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{req.workOrder?.workOrderNumber || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={ServiceRequirementStatusColors[req.status]}>
                          {ServiceRequirementStatusLabels[req.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Service Type & Processor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Service Type */}
        {stats?.byServiceType && stats.byServiceType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Services by Type</CardTitle>
              <CardDescription>Distribution of service requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byServiceType.map((item) => (
                    <TableRow
                      key={item.serviceType}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/service-requirements/list?serviceType=${item.serviceType}`)}
                    >
                      <TableCell className="font-medium">{ServiceTypeLabels[item.serviceType]}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right text-accent">₹{item.estimatedCost.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* By Processor */}
        {stats?.byProcessor && stats.byProcessor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requirements by Processor</CardTitle>
              <CardDescription>Assigned processors for pending services</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processor</TableHead>
                    <TableHead className="text-right">Requirements</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byProcessor.map((item) => (
                    <TableRow
                      key={item.processorId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/service-requirements/list?processorId=${item.processorId}`)}
                    >
                      <TableCell className="font-medium">{item.processorName}</TableCell>
                      <TableCell className="text-right">{item.requirementCount}</TableCell>
                      <TableCell className="text-right text-success">₹{item.totalValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
