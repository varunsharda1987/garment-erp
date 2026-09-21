/**
 * Manufacturing Control Center
 * Alerts dashboard showing problems that need attention + vendor tracking
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PipelineSection } from '@/components/manufacturing/PipelineSection';
import { CONTROL_CENTER_KEYS } from '@/lib/control-center-keys';
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

/**
 * Where each alert drills down to.
 *
 * Every route here has been checked against `App.tsx` AND against whether the destination page
 * actually READS the query string — a tile that lands on an unfiltered list is a dead end even
 * though the URL "works". Each entry names the file that reads its param, so the next person can
 * re-check it. A param no page reads has been dropped rather than shipped as a lie.
 */
const ALERT_CONFIG: Record<string, { label: string; icon: React.ElementType; route: string; description: string }> = {
  overdueLabDips: {
    label: 'Overdue Lab Dips',
    icon: FlaskConical,
    // DyeingList.tsx seeds statusFilter from searchParams.get('status').
    route: '/manufacturing/dyeing?tab=lab-dips&status=SUBMITTED',
    description: 'Lab dips sent to mill but not received',
  },
  overdueProcessPOs: {
    label: 'Overdue Job Work Orders',
    icon: Factory,
    // Was /processing/batches?status=AT_MILL — the WRONG ENTITY. The count comes from
    // job_work_orders, not processing batches, and that page has no AT_MILL status and reads no
    // search params. No status param: JobWorkOrderList reads processType, not status.
    route: '/job-work-orders',
    description: 'Fabric at mill past expected return date',
  },
  overdueExternalWork: {
    label: 'Overdue Smocking / Handwork',
    icon: Truck,
    // SmockingDashboard hardcodes processType SMOCKING, so handwork items counted here are not
    // visible at this destination. Renamed the label to stop over-promising.
    route: '/manufacturing/smocking',
    description: 'Smocking/Handwork/Embroidery past due',
  },
  stuckCutting: {
    label: 'Stuck Cutting Batches',
    icon: Scissors,
    // CuttingList reads only workOrderId — ?status= was ignored, so it is not shipped.
    route: '/manufacturing/cutting',
    description: 'Cutting batches with no progress in 7+ days',
  },
  qualityFailures: {
    label: 'Quality Failures',
    icon: AlertTriangle,
    // Was /testing?result=FAIL — TestingDashboard reads no params and `result` is not a param name
    // anywhere. FabricPhysicalTests.tsx does read ?status=. (The count merges FPT+GPT, so this
    // destination shows the fabric half; the garment half is at /garment-physical-tests.)
    route: '/fabric-physical-tests?status=FAIL',
    description: 'Failed FPT/GPT tests needing resolution',
  },
  pendingApprovals: {
    label: 'Pending Buyer Approvals',
    icon: FileCheck,
    // DyeingList reads tab and status only — ?buyerApproval= was invented and ignored.
    route: '/manufacturing/dyeing?tab=lab-dips',
    description: 'Lab dips awaiting buyer approval',
  },
  overdueChallans: {
    label: 'Overdue Challans',
    icon: Package,
    // ChallanList reads ?status=. The count also includes IN_TRANSIT and PARTIALLY_RECEIVED, so
    // the destination can show fewer rows than the badge.
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
  /** `null` means "we don't know" and renders as —. It must never be drawn as 0. */
  value: number | null;
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
            <p
              className={`text-3xl font-bold ${
                value == null ? 'text-muted-foreground' : value > 0 ? textColors[variant] : 'text-foreground'
              }`}
              title={value == null ? "Couldn't load — see the banner above" : undefined}
            >
              {value ?? '—'}
            </p>
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

  // Two independent queries, not one. A heavy pipeline query must never be able to blank the
  // exceptions inbox, and each gets the cadence it deserves.
  //
  // staleTime: 0 overrides the app-wide 5-minute default (lib/query-client.ts), which was the
  // direct cause of "this page isn't updating": navigating back inside 5 minutes served cache with
  // no network call at all. A monitoring view has no legitimate freshness window.
  const alertsQuery = useQuery({
    queryKey: CONTROL_CENTER_KEYS.alerts,
    queryFn: manufacturingAlertsService.getAlerts,
    refetchInterval: 60000,
    staleTime: 0,
    refetchOnMount: 'always',
    // Deliberately NOT refetchIntervalInBackground: polling a hidden tab would run these queries
    // every minute forever per idle tab. Refetching on focus covers the same need for free.
    refetchOnWindowFocus: true,
  });

  const pipelineQuery = useQuery({
    queryKey: CONTROL_CENTER_KEYS.pipeline,
    queryFn: manufacturingAlertsService.getPipeline,
    // Slower: this runs several validation queries per order.
    refetchInterval: 120000,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const data = alertsQuery.data;
  const alerts = data?.alerts;
  const vendorSummary = data?.vendorSummary ?? [];
  const quickStats = data?.quickStats;

  const isFetchingAny = alertsQuery.isFetching || pipelineQuery.isFetching;
  const lastUpdated = alertsQuery.dataUpdatedAt ? new Date(alertsQuery.dataUpdatedAt) : null;

  const failed = [alertsQuery.error ? 'Alerts' : null, pipelineQuery.error ? 'Pipeline' : null].filter(
    (x): x is string => x != null
  );

  const refreshAll = () => {
    void alertsQuery.refetch();
    void pipelineQuery.refetch();
  };

  // First paint only. Background refreshes show in the header, not as a full-page spinner.
  if (alertsQuery.isLoading && pipelineQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  // Which checks ran at all. A feeder with nothing to look at is NOT "all clear" — that distinction
  // is the whole point: the page used to render a confident green tick over seven checks that had
  // no rows to examine and one that was structurally incapable of firing.
  const alertEntries = alerts ? Object.entries(alerts) : [];
  const firingAlerts = alertEntries.filter(([, a]) => a.count > 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader title="Manufacturing Control Center">
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={isFetchingAny}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetchingAny ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      <p className="text-muted-foreground -mt-4 mb-4">What needs your attention right now</p>

      <p className="text-xs text-muted-foreground">
        {isFetchingAny
          ? 'Updating…'
          : lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refresh every 60s`
            : 'Not yet loaded'}
      </p>

      {failed.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some data couldn't be loaded</AlertTitle>
          <AlertDescription className="flex items-center gap-3 flex-wrap">
            <span>{failed.join(' and ')} failed to load, so the numbers below are incomplete.</span>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={refreshAll}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats. `null` renders as "—": an unknown number must never be drawn as zero. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Alerts"
          value={quickStats?.totalAlerts ?? null}
          icon={AlertTriangle}
          variant={quickStats?.totalAlerts ? 'danger' : 'default'}
        />
        <StatCard title="Items with Vendors" value={quickStats?.itemsWithVendors ?? null} icon={Package} />
        <StatCard
          title="Due This Week"
          value={quickStats?.dueThisWeek ?? null}
          icon={Clock}
          variant={quickStats?.dueThisWeek ? 'warning' : 'default'}
        />
        <StatCard
          title="Blocked Orders"
          value={pipelineQuery.data?.counts.blocked ?? null}
          icon={Factory}
          variant={pipelineQuery.data?.counts.blocked ? 'danger' : 'default'}
        />
      </div>

      <PipelineSection
        data={pipelineQuery.data}
        isLoading={pipelineQuery.isLoading}
        error={pipelineQuery.error as Error | null}
        onRetry={() => void pipelineQuery.refetch()}
      />

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
          {alertsQuery.error ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-medium text-foreground">Checks did not run</p>
              <p className="text-sm">{(alertsQuery.error as Error).message}</p>
            </div>
          ) : firingAlerts.length > 0 ? (
            <div className="divide-y">
              {firingAlerts.map(([key, alert]) => (
                <AlertRow
                  key={key}
                  alertKey={key}
                  alert={alert}
                  onClick={() => {
                    const route = ALERT_CONFIG[key]?.route;
                    if (route) navigate(route);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="p-6">
              <div className="text-center text-muted-foreground mb-4">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 text-success" />
                <p className="text-lg font-medium text-foreground">
                  All {alertEntries.length} checks ran · nothing needs action
                </p>
              </div>
              {/* Show the work. "Nothing found" is only trustworthy if you can see what was looked at. */}
              <div className="border rounded-lg divide-y text-sm">
                {alertEntries.map(([key, alert]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-2">
                    <span className="text-muted-foreground">{ALERT_CONFIG[key]?.label ?? key}</span>
                    <span className="text-muted-foreground tabular-nums">{alert.count}</span>
                  </div>
                ))}
              </div>
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
