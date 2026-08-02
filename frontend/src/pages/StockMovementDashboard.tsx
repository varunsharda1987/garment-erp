import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import DataTable, { type Column } from '@/components/DataTable';
import {
  stockMovementDashboardService,
  SOURCE_TYPES,
  type PendingInwardItem,
  type PendingOutwardItem,
  type DashboardSummary,
} from '@/services/stockMovement.service';
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  AlertTriangle,
  Factory,
  Truck,
  RefreshCw,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function StockMovementDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'inward' | 'outward' | 'today'>('inward');
  const [inwardSourceType, setInwardSourceType] = useState<string>('');
  const [outwardSourceType, setOutwardSourceType] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [inwardPage, setInwardPage] = useState(1);
  const [outwardPage, setOutwardPage] = useState(1);
  const pageSize = 25;

  // Dashboard summary query
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery<DashboardSummary>({
    queryKey: ['stock-movement-dashboard-summary'],
    queryFn: () => stockMovementDashboardService.getDashboardSummary(),
  });

  // Pending inward query
  const {
    data: pendingInward,
    isLoading: inwardLoading,
    refetch: refetchInward,
  } = useQuery({
    queryKey: ['stock-movement-pending-inward', inwardSourceType, overdueOnly, inwardPage],
    queryFn: () =>
      stockMovementDashboardService.getPendingInward({
        sourceType: inwardSourceType || undefined,
        overdueOnly,
        page: inwardPage,
        limit: pageSize,
      }),
  });

  // Pending outward query
  const {
    data: pendingOutward,
    isLoading: outwardLoading,
    refetch: refetchOutward,
  } = useQuery({
    queryKey: ['stock-movement-pending-outward', outwardSourceType, outwardPage],
    queryFn: () =>
      stockMovementDashboardService.getPendingOutward({
        sourceType: outwardSourceType || undefined,
        page: outwardPage,
        limit: pageSize,
      }),
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchInward();
    refetchOutward();
  };

  // Inward columns
  const inwardColumns: Column<PendingInwardItem>[] = [
    {
      key: 'sourceType',
      header: 'Type',
      render: (item) => (
        <Badge variant="outline" className="text-xs">
          {SOURCE_TYPES.find((t) => t.value === item.sourceType)?.label || item.sourceType}
        </Badge>
      ),
    },
    {
      key: 'documentNumber',
      header: 'Doc #',
      render: (item) => <span className="font-mono text-sm">{item.documentNumber}</span>,
    },
    {
      key: 'partyName',
      header: 'Supplier / Processor',
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.partyType === 'PROCESSOR' ? (
            <Factory className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Truck className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm">{item.partyName}</span>
        </div>
      ),
    },
    {
      key: 'materialDescription',
      header: 'Material',
      render: (item) => <span className="text-sm truncate max-w-[200px]">{item.materialDescription}</span>,
    },
    {
      key: 'qtyPending',
      header: 'Pending',
      render: (item) => (
        <span className="font-medium">
          {item.qtyPending.toLocaleString()} {item.unit}
        </span>
      ),
    },
    {
      key: 'daysOut',
      header: 'Days Out',
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.isOverdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
          <span className={item.isOverdue ? 'text-destructive font-medium' : ''}>
            {item.daysOut !== null ? `${item.daysOut} days` : '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (item) => (
        <Button variant="outline" size="sm" onClick={() => navigate(item.actionRoute)}>
          {item.actionLabel}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      ),
    },
  ];

  // Outward columns
  const outwardColumns: Column<PendingOutwardItem>[] = [
    {
      key: 'sourceType',
      header: 'Type',
      render: (item) => (
        <Badge variant="outline" className="text-xs">
          {SOURCE_TYPES.find((t) => t.value === item.sourceType)?.label || item.sourceType}
        </Badge>
      ),
    },
    {
      key: 'documentNumber',
      header: 'Doc #',
      render: (item) => <span className="font-mono text-sm">{item.documentNumber}</span>,
    },
    {
      key: 'partyName',
      header: 'Processor / Vendor',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{item.partyName || 'Not assigned'}</span>
        </div>
      ),
    },
    {
      key: 'materialDescription',
      header: 'Material',
      render: (item) => <span className="text-sm truncate max-w-[200px]">{item.materialDescription}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (item) => (
        <span className="font-medium">
          {item.quantity.toLocaleString()} {item.unit}
        </span>
      ),
    },
    {
      key: 'createdDate',
      header: 'Created',
      render: (item) => (
        <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(item.createdDate))} ago</span>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (item) => (
        <Button variant="default" size="sm" onClick={() => navigate(item.actionRoute)}>
          {item.actionLabel}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      ),
    },
  ];

  // New Issue tiles
  const newIssueTiles = [
    { label: 'Dyeing', desc: 'Send greige for dyeing', route: '/manufacturing/processing', icon: Package },
    { label: 'Printing', desc: 'Send fabric for printing', route: '/manufacturing/processing', icon: Package },
    {
      label: 'Lace Dyeing',
      desc: 'Send greige lace for dyeing',
      route: '/manufacturing/processing-batches',
      icon: Package,
    },
    {
      label: 'Embroidery (Fabric)',
      desc: 'Send fabric roll for embroidery',
      route: '/embroidery-stock/send-out',
      icon: Factory,
    },
    {
      label: 'Embroidery (Piece)',
      desc: 'Send cut pieces for embroidery',
      route: '/embroidery-stock/piece-send-out',
      icon: Factory,
    },
    { label: 'Smocking', desc: 'Send for smocking', route: '/manufacturing/smocking/send-out', icon: Factory },
    { label: 'Handwork', desc: 'Send for handwork', route: '/manufacturing/handwork/send-out', icon: Factory },
    {
      label: 'Purchase Return',
      desc: 'Return material to supplier',
      route: '/inventory/stock-out',
      icon: ArrowUpFromLine,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <Package className="h-6 w-6" />
            Stock Movement Dashboard
          </h1>
          <p className="text-muted-foreground">Unified view of all pending external goods and services</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={summaryLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${summaryLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">Received Today</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.received.total}</div>
              <div className="text-xs text-muted-foreground mt-1">
                GRN: {summary.received.grn} | Dyeing: {summary.received.dyeing} | Printing: {summary.received.printing}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Sent Today</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.sent.total}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Challans: {summary.sent.challans} | Dyeing: {summary.sent.dyeing} | Printing: {summary.sent.printing}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-lg">Pending Inward</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingInward?.pagination.total || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Items awaiting receipt</div>
            </CardContent>
          </Card>

          <Card className={summary.overdue.total > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${summary.overdue.total > 0 ? 'text-destructive' : 'text-muted'}`} />
                <CardTitle className="text-lg">Overdue</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${summary.overdue.total > 0 ? 'text-destructive' : ''}`}>
                {summary.overdue.total}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Past expected return date</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'inward' | 'outward' | 'today')}>
        <TabsList>
          <TabsTrigger value="inward" className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Pending Inward
            {pendingInward && pendingInward.pagination.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingInward.pagination.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outward" className="gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Pending Outward
            {pendingOutward && pendingOutward.pagination.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingOutward.pagination.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today" className="gap-2">
            <Plus className="h-4 w-4" />
            New Issue
          </TabsTrigger>
        </TabsList>

        {/* Pending Inward Tab */}
        <TabsContent value="inward" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pending External Receipts</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="overdueOnly"
                      checked={overdueOnly}
                      onCheckedChange={(checked) => {
                        setOverdueOnly(!!checked);
                        setInwardPage(1);
                      }}
                    />
                    <Label htmlFor="overdueOnly" className="text-sm cursor-pointer">
                      Overdue only
                    </Label>
                  </div>
                  <Select
                    value={inwardSourceType}
                    onValueChange={(v) => {
                      setInwardSourceType(v);
                      setInwardPage(1);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Types</SelectItem>
                      {SOURCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={pendingInward?.data || []}
                columns={inwardColumns}
                keyExtractor={(item) => item.id}
                loading={inwardLoading}
                emptyState={{ title: 'No pending inward items', description: 'All external receipts are up to date' }}
              />
              {pendingInward && pendingInward.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={inwardPage === 1}
                    onClick={() => setInwardPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {inwardPage} of {pendingInward.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={inwardPage >= pendingInward.pagination.totalPages}
                    onClick={() => setInwardPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Outward Tab */}
        <TabsContent value="outward" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Drafts Awaiting Send</CardTitle>
                <Select
                  value={outwardSourceType}
                  onValueChange={(v) => {
                    setOutwardSourceType(v);
                    setOutwardPage(1);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {SOURCE_TYPES.filter((t) => t.value !== 'PURCHASE').map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={pendingOutward?.data || []}
                columns={outwardColumns}
                keyExtractor={(item) => item.id}
                loading={outwardLoading}
                emptyState={{ title: 'No pending outward items', description: 'No drafts awaiting send' }}
              />
              {pendingOutward && pendingOutward.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={outwardPage === 1}
                    onClick={() => setOutwardPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {outwardPage} of {pendingOutward.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={outwardPage >= pendingOutward.pagination.totalPages}
                    onClick={() => setOutwardPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Issue Tab */}
        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create New Issue</CardTitle>
              <CardDescription>Select what you want to send out for external processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {newIssueTiles.map((tile) => (
                  <button
                    key={tile.label}
                    onClick={() => navigate(tile.route)}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
                  >
                    <tile.icon className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <div className="font-medium text-sm">{tile.label}</div>
                      <div className="text-xs text-muted-foreground">{tile.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
