/**
 * Manufacturing Control Center
 * Alerts dashboard showing problems that need attention + vendor tracking
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  AlertTriangle,
  Clock,
  Package,
  RefreshCw,
  ChevronRight,
  Factory,
  Truck,
  FlaskConical,
  FileCheck,
  Scissors,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import {
  manufacturingAlertsService,
  type AlertCount,
  type VendorSummary,
  type VarianceAlert,
} from '@/services/manufacturingAlerts.service';

const ALERT_CONFIG: Record<string, { label: string; icon: React.ElementType; route: string; description: string }> = {
  overdueLabDips: {
    label: 'Overdue Lab Dips',
    icon: FlaskConical,
    route: '/manufacturing/dyeing?status=SUBMITTED',
    description: 'Lab dips sent to mill but not received',
  },
  overdueProcessPOs: {
    label: 'Overdue Process POs',
    icon: Factory,
    route: '/processing/batches?status=AT_MILL',
    description: 'Fabric at mill past expected return date',
  },
  overdueExternalWork: {
    label: 'Overdue External Work',
    icon: Truck,
    route: '/manufacturing/smocking',
    description: 'Smocking/Handwork/Embroidery past due',
  },
  stuckCutting: {
    label: 'Stuck Cutting Batches',
    icon: Scissors,
    route: '/manufacturing/cutting?status=IN_PROGRESS',
    description: 'Cutting batches with no progress in 7+ days',
  },
  qualityFailures: {
    label: 'Quality Failures',
    icon: AlertTriangle,
    route: '/testing?result=FAIL',
    description: 'Failed FPT/GPT tests needing resolution',
  },
  pendingApprovals: {
    label: 'Pending Buyer Approvals',
    icon: FileCheck,
    route: '/manufacturing/dyeing?buyerApproval=PENDING',
    description: 'Lab dips awaiting buyer approval',
  },
  overdueChallans: {
    label: 'Overdue Challans',
    icon: Package,
    route: '/manufacturing/challans?status=ISSUED',
    description: 'Outward challans not yet returned',
  },
};

function AlertRow({ alertKey, alert, onClick }: { alertKey: string; alert: AlertCount; onClick: () => void }) {
  const config = ALERT_CONFIG[alertKey];
  if (!config || alert.count === 0) return null;

  const Icon = config.icon;
  const isUrgent = alert.oldestDays >= 14;
  const isWarning = alert.oldestDays >= 7 && alert.oldestDays < 14;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b last:border-b-0"
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${
            isUrgent
              ? 'bg-destructive/10 text-destructive'
              : isWarning
                ? 'bg-warning/10 text-warning'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <div className="font-medium text-foreground flex items-center gap-2">
            {config.label}
            <Badge variant={isUrgent ? 'destructive' : isWarning ? 'secondary' : 'outline'} className="ml-1">
              {alert.count}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">{config.description}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div
            className={`text-sm font-medium ${
              isUrgent ? 'text-destructive' : isWarning ? 'text-warning' : 'text-muted-foreground'
            }`}
          >
            Oldest: {alert.oldestDays} days
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    </button>
  );
}

function VendorStatusBadge({ status }: { status: VendorSummary['status'] }) {
  const variants: Record<VendorSummary['status'], { className: string; label: string }> = {
    ON_TRACK: { className: 'bg-success/10 text-success border-success/20', label: 'On Track' },
    DUE_SOON: { className: 'bg-warning/10 text-warning border-warning/20', label: 'Due Soon' },
    OVERDUE: { className: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Overdue' },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const bgColors = {
    default: 'bg-muted',
    warning: 'bg-warning/10',
    danger: 'bg-destructive/10',
  };
  const textColors = {
    default: 'text-muted-foreground',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  return (
    <Card className={`${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold ${value > 0 ? textColors[variant] : 'text-foreground'}`}>{value}</p>
          </div>
          <div className={`p-3 rounded-full ${bgColors[variant]}`}>
            <Icon className={`h-6 w-6 ${textColors[variant]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManufacturingControlCenter() {
  const navigate = useNavigate();

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['manufacturing-alerts'],
    queryFn: manufacturingAlertsService.getAlerts,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  const alerts = data?.alerts;
  const vendorSummary = data?.vendorSummary || [];
  const quickStats = data?.quickStats;

  const hasAlerts = alerts && Object.values(alerts).some((a) => a.count > 0);
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader title="Manufacturing Control Center">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </PageHeader>

      <p className="text-muted-foreground -mt-4 mb-4">What needs your attention right now</p>

      {lastUpdated && <p className="text-xs text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</p>}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Alerts"
          value={quickStats?.totalAlerts || 0}
          icon={AlertTriangle}
          variant={quickStats?.totalAlerts ? 'danger' : 'default'}
        />
        <StatCard title="Items with Vendors" value={quickStats?.itemsWithVendors || 0} icon={Package} />
        <StatCard
          title="Due This Week"
          value={quickStats?.dueThisWeek || 0}
          icon={Clock}
          variant={quickStats?.dueThisWeek ? 'warning' : 'default'}
        />
        <StatCard
          title="Overdue"
          value={quickStats?.overdue || 0}
          icon={AlertTriangle}
          variant={quickStats?.overdue ? 'danger' : 'default'}
        />
      </div>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alerts Requiring Action
          </CardTitle>
          <CardDescription>Click any alert to view and resolve the items</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {hasAlerts ? (
            <div className="divide-y">
              {alerts &&
                Object.entries(alerts).map(([key, alert]) => (
                  <AlertRow
                    key={key}
                    alertKey={key}
                    alert={alert}
                    onClick={() => navigate(ALERT_CONFIG[key]?.route || '/')}
                  />
                ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
              <p className="text-lg font-medium">All Clear!</p>
              <p className="text-sm">No manufacturing alerts at this time.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendor Tracker Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Materials with External Vendors
          </CardTitle>
          <CardDescription>Track materials at mills and processors</CardDescription>
        </CardHeader>
        <CardContent>
          {vendorSummary.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Oldest</TableHead>
                    <TableHead>Expected Back</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorSummary.map((vendor, idx) => (
                    <TableRow
                      key={`${vendor.vendorId}-${vendor.type}-${idx}`}
                      className={vendor.status === 'OVERDUE' ? 'bg-destructive/5' : ''}
                    >
                      <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{vendor.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{vendor.itemsOut}</TableCell>
                      <TableCell className="text-right">
                        {vendor.totalQty.toLocaleString('en-IN')} {vendor.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            vendor.oldestSendoutDays >= 14
                              ? 'text-destructive font-medium'
                              : vendor.oldestSendoutDays >= 7
                                ? 'text-warning font-medium'
                                : ''
                          }
                        >
                          {vendor.oldestSendoutDays} days
                        </span>
                      </TableCell>
                      <TableCell>{vendor.nextExpectedBack || '-'}</TableCell>
                      <TableCell>
                        <VendorStatusBadge status={vendor.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Navigate to appropriate list filtered by vendor
                            const routes: Record<string, string> = {
                              DYEING: `/manufacturing/dyeing`,
                              PRINTING: `/manufacturing/printing`,
                              SMOCKING: `/manufacturing/smocking`,
                              HANDWORK: `/manufacturing/handwork`,
                              EMBROIDERY_PIECE: `/embroidery-stock/pieces`,
                            };
                            navigate(routes[vendor.type] || '/processing/batches');
                          }}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No materials currently with external vendors.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P5.4: Variance Watchtower Section */}
      <VarianceWatchtower varianceAlerts={data?.varianceAlerts || []} navigate={navigate} />
    </div>
  );
}

// P5.4: Variance alert icon and color mapping
const VARIANCE_CONFIG: Record<
  VarianceAlert['type'],
  { label: string; icon: React.ElementType; bgColor: string; textColor: string }
> = {
  CUTTING: {
    label: 'Cutting Variance',
    icon: Scissors,
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
  },
  GRN_OVER: {
    label: 'GRN Over-Receipt',
    icon: TrendingUp,
    bgColor: 'bg-info/10',
    textColor: 'text-info',
  },
  GRN_UNDER: {
    label: 'GRN Under-Receipt',
    icon: TrendingDown,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
  },
  COST: {
    label: 'Cost Variance',
    icon: DollarSign,
    bgColor: 'bg-amber-100 dark:bg-amber-900/20',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
};

function VarianceWatchtower({
  varianceAlerts,
  navigate,
}: {
  varianceAlerts: VarianceAlert[];
  navigate: (path: string) => void;
}) {
  if (varianceAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Variance Watchtower
          </CardTitle>
          <CardDescription>Monitor cutting, GRN, and cost variances above threshold</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
            <p className="text-lg font-medium">No Significant Variances</p>
            <p className="text-sm">All recent operations are within acceptable variance thresholds.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group alerts by type
  const grouped = varianceAlerts.reduce(
    (acc, alert) => {
      if (!acc[alert.type]) acc[alert.type] = [];
      acc[alert.type].push(alert);
      return acc;
    },
    {} as Record<VarianceAlert['type'], VarianceAlert[]>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Variance Watchtower
          <Badge variant="secondary" className="ml-2">
            {varianceAlerts.length}
          </Badge>
        </CardTitle>
        <CardDescription>Items exceeding variance threshold - click to investigate</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {Object.entries(grouped).map(([type, alerts]) => {
            const config = VARIANCE_CONFIG[type as VarianceAlert['type']];
            const Icon = config.icon;

            return (
              <div key={type} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.textColor}`} />
                  </div>
                  <span className="font-medium">{config.label}</span>
                  <Badge variant="outline" className="ml-auto">
                    {alerts.length}
                  </Badge>
                </div>
                <div className="space-y-2 ml-8">
                  {alerts.slice(0, 5).map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => navigate(alert.route)}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{alert.referenceNumber}</div>
                        <div className="text-xs text-muted-foreground truncate">{alert.description}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge
                          variant={Math.abs(alert.variancePercent) > 10 ? 'destructive' : 'secondary'}
                          className="whitespace-nowrap"
                        >
                          {alert.variancePercent > 0 ? '+' : ''}
                          {alert.variancePercent.toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">{alert.date}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                  {alerts.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{alerts.length - 5} more {config.label.toLowerCase()} alerts
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
