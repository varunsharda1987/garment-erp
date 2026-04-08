/**
 * MRP (Material Requirement Planning) Dashboard
 * Overview of material requirements, shortfalls, and PO status
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getDashboardStats, getRequirementsNeedingPO, getOverdueRequirements } from '@/services/mrp.service';
import type { MRPDashboardStats, MaterialRequirement } from '@/types/mrp.types';
import { MaterialRequirementStatusColors, MaterialRequirementStatusLabels } from '@/types/mrp.types';
import { handleApiError } from '@/lib/api-error-handler';
import {
  Calculator,
  Package,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileText,
  ArrowRight,
  RefreshCw,
  ShoppingCart,
  Truck,
} from 'lucide-react';

export default function MRPDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MRPDashboardStats | null>(null);
  const [needingPO, setNeedingPO] = useState<MaterialRequirement[]>([]);
  const [overdueReqs, setOverdueReqs] = useState<MaterialRequirement[]>([]);
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
      setNeedingPO(needingPOData.data);
      setOverdueReqs(overdueData.data);
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
        <p>Loading MRP Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Material Requirement Planning
          </h1>
          <p className="text-muted-foreground">Track material needs, shortfalls, and purchase order status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/mrp/requirements')}>
            <FileText className="h-4 w-4 mr-2" />
            View All Requirements
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Requirements"
          value={stats?.totalPendingRequirements || 0}
          description="Awaiting processing"
          icon={Package}
          color="text-info"
          onClick={() => navigate('/mrp/requirements?status=PENDING,PO_REQUIRED,PARTIAL_STOCK')}
        />
        <StatCard
          title="Total Shortfall"
          value={stats?.totalShortfall?.toLocaleString() || '0'}
          description="Units needed across all materials"
          icon={AlertTriangle}
          color="text-primary"
          onClick={() => navigate('/mrp/requirements?hasShortfall=true')}
        />
        <StatCard
          title="Needs PO"
          value={stats?.requirementsNeedingPO || 0}
          description="Requirements awaiting purchase orders"
          icon={ShoppingCart}
          color="text-warning"
          onClick={() => navigate('/mrp/requirements?status=PO_REQUIRED,PARTIAL_STOCK')}
        />
        <StatCard
          title="Overdue"
          value={stats?.overdueRequirements || 0}
          description="Past required date"
          icon={Clock}
          color="text-destructive"
          onClick={() => navigate('/mrp/requirements?overdue=true')}
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="PO Generated"
          value={stats?.poInProgress || 0}
          description="Draft POs created"
          icon={FileText}
          color="text-primary"
          onClick={() => navigate('/mrp/requirements?status=PO_GENERATED')}
        />
        <StatCard
          title="Awaiting Receipt"
          value={stats?.awaitingReceipt || 0}
          description="POs sent, pending delivery"
          icon={Truck}
          color="text-accent"
          onClick={() => navigate('/mrp/requirements?status=PO_SENT')}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-success text-success hover:bg-success-muted"
              onClick={() => navigate('/mrp/requirements?status=PO_REQUIRED,PARTIAL_STOCK')}
            >
              <Package className="h-4 w-4 mr-2" />
              Bulk Generate POs
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => navigate('/mrp/requirements?status=PO_REQUIRED,PARTIAL_STOCK')}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Generate PO for Shortfalls
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate('/orders')}>
              <Calculator className="h-4 w-4 mr-2" />
              Calculate from Orders
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requirements Needing PO */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Requirements Needing PO</CardTitle>
                <CardDescription>Materials with shortfall requiring purchase</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/mrp/requirements?status=PO_REQUIRED,PARTIAL_STOCK')}
              >
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {needingPO.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No requirements currently need PO</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Shortfall</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needingPO.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/mrp/requirements/${req.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{req.material?.code}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {req.material?.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {req.shortfall.toLocaleString()} {req.unit}
                      </TableCell>
                      <TableCell>
                        <Badge className={MaterialRequirementStatusColors[req.status]}>
                          {MaterialRequirementStatusLabels[req.status]}
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
                  Overdue Requirements
                </CardTitle>
                <CardDescription>Requirements past their required date</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/mrp/requirements?overdue=true')}>
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {overdueReqs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No overdue requirements</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Required Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueReqs.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/mrp/requirements/${req.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{req.material?.code}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {req.material?.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-destructive">
                        {new Date(req.requiredDate).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge className={MaterialRequirementStatusColors[req.status]}>
                          {MaterialRequirementStatusLabels[req.status]}
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

      {/* By Material Type & Supplier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Material Type */}
        {stats?.byMaterialType && stats.byMaterialType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shortfall by Material Type</CardTitle>
              <CardDescription>Distribution of material shortages</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Type</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Shortfall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byMaterialType.map((item) => (
                    <TableRow key={item.materialType}>
                      <TableCell className="font-medium">{item.materialType.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right text-primary">{item.shortfall.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* By Supplier */}
        {stats?.bySupplier && stats.bySupplier.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requirements by Supplier</CardTitle>
              <CardDescription>Preferred suppliers for pending requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Requirements</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.bySupplier.map((item) => (
                    <TableRow
                      key={item.supplierId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/mrp/requirements?supplierId=${item.supplierId}`)}
                    >
                      <TableCell className="font-medium">{item.supplierName}</TableCell>
                      <TableCell className="text-right">{item.requirementCount}</TableCell>
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
