import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { challanService } from '@/services/challan.service';
import type { Challan, ChallanFilters, TodaySummary } from '@/types/challan.types';
import {
  ChallanTypeLabels,
  ChallanTypeColors,
  ChallanStatusLabels,
  ChallanStatusColors,
  CHALLAN_ITEM_TYPES,
} from '@/types/challan.types';
import DataTable, { type Column } from '@/components/DataTable';
import { handleApiError } from '@/lib/api-error-handler';
import { Plus, Eye, FileText, ArrowRight, Calendar, Package, Factory, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function ChallanList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('challanType') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const productionRunId = searchParams.get('productionRunId') || '';
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Today's summary query
  const {
    data: todaySummary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery<TodaySummary>({
    queryKey: ['challan-today-summary'],
    queryFn: () => challanService.getTodaySummary(),
  });

  useEffect(() => {
    loadChallans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, itemTypeFilter, page, search, productionRunId, fromDate, toDate, showTodayOnly]);

  async function loadChallans() {
    try {
      setIsLoading(true);
      const filters: ChallanFilters = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (typeFilter !== 'all') filters.challanType = typeFilter as ChallanFilters['challanType'];
      if (statusFilter !== 'all') filters.status = statusFilter as ChallanFilters['status'];
      if (itemTypeFilter !== 'all') filters.itemType = itemTypeFilter;
      if (productionRunId) filters.productionRunId = productionRunId;
      if (search) filters.search = search;
      if (showTodayOnly) {
        filters.todayOnly = true;
      } else {
        if (fromDate) filters.fromDate = fromDate;
        if (toDate) filters.toDate = toDate;
      }

      const result = await challanService.getChallans(filters);
      setChallans(result.data);
      setTotal(result.pagination.total);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns: Column<Challan>[] = [
    {
      key: 'challanNumber',
      header: 'Challan No.',
      render: (challan) => (
        <button
          onClick={() => navigate(`/manufacturing/challans/${challan.id}`)}
          className="text-primary font-medium hover:underline"
        >
          {challan.challanNumber}
        </button>
      ),
    },
    {
      key: 'challanType',
      header: 'Type',
      render: (challan) => (
        <Badge className={ChallanTypeColors[challan.challanType] || 'bg-muted'}>
          {ChallanTypeLabels[challan.challanType] || challan.challanType}
        </Badge>
      ),
    },
    {
      key: 'movement',
      header: 'From → To',
      render: (challan) => (
        <div className="flex items-center gap-1 text-sm">
          <span className="font-medium">{challan.fromName}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{challan.toName}</span>
        </div>
      ),
    },
    {
      key: 'itemTypes',
      header: 'Items',
      render: (challan) => {
        const types = [...new Set(challan.items?.map((i) => i.itemType) || [])];
        return (
          <div className="flex gap-1 flex-wrap">
            {types.slice(0, 2).map((type) => (
              <Badge key={type} variant="outline" className="text-xs">
                {CHALLAN_ITEM_TYPES.find((t) => t.value === type)?.label || type}
              </Badge>
            ))}
            {types.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{types.length - 2}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'challanDate',
      header: 'Date',
      render: (challan) => format(new Date(challan.challanDate), 'dd MMM yyyy'),
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (challan) => (
        <span>
          {Number(challan.totalQuantity).toLocaleString()} {challan.unit}
          {challan.receivedQuantity ? (
            <span className="text-xs text-muted-foreground ml-1">
              ({Number(challan.receivedQuantity).toLocaleString()} rcvd)
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'linkedTo',
      header: 'Linked To',
      render: (challan) => (
        <div className="text-sm">
          {challan.purchaseOrder && <span className="text-info">{challan.purchaseOrder.poNumber}</span>}
          {challan.order && <span className="text-accent">{challan.order.orderNumber}</span>}
          {challan.productionRun && <span className="text-primary">{challan.productionRun.workOrderNumber}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (challan) => (
        <Badge className={ChallanStatusColors[challan.status] || 'bg-muted'}>
          {ChallanStatusLabels[challan.status] || challan.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (challan) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/manufacturing/challans/${challan.id}`)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const clearFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setItemTypeFilter('all');
    setFromDate('');
    setToDate('');
    setShowTodayOnly(false);
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters =
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    itemTypeFilter !== 'all' ||
    fromDate ||
    toDate ||
    showTodayOnly ||
    search;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Challans
          </h1>
          <p className="text-muted-foreground">Material movement documents — internal and external</p>
        </div>
        <Button onClick={() => navigate('/manufacturing/challans/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Challan
        </Button>
      </div>

      {/* Today's Summary Card */}
      {todaySummary && todaySummary.totalChallans > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Today's Outward Issuance</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchSummary()}
                disabled={summaryLoading}
                className="h-8"
              >
                <RefreshCw className={`h-4 w-4 ${summaryLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CardDescription>
              {todaySummary.date} — {todaySummary.totalChallans} challan
              {todaySummary.totalChallans !== 1 ? 's' : ''}, {todaySummary.totalQuantity.toLocaleString()} total units
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {todaySummary.byProcessor.map((proc) => (
                <div
                  key={proc.processorId || proc.processorName}
                  className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-blue-100 dark:border-blue-900"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Factory className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm truncate">{proc.processorName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{proc.totalQuantity.toLocaleString()} units</span>
                    <span>•</span>
                    <span>
                      {proc.challanCount} challan{proc.challanCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {proc.itemTypes.slice(0, 2).map((type) => (
                      <Badge key={type} variant="secondary" className="text-xs py-0">
                        {CHALLAN_ITEM_TYPES.find((t) => t.value === type)?.label || type}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Production-run drill-down filter indicator */}
      {productionRunId && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Filtered to production run:{' '}
            {challans.find((c) => c.productionRun)?.productionRun?.workOrderNumber || productionRunId}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/challans')}>
            Clear filter
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-3">
            {/* First row: Search + Quick filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Search challans, processor, remarks..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-64"
              />
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(ChallanTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(ChallanStatusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={itemTypeFilter}
                onValueChange={(v) => {
                  setItemTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Item Types</SelectItem>
                  {CHALLAN_ITEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              <span className="text-sm text-muted-foreground ml-auto">
                {total} challan{total !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Second row: Date filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant={showTodayOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setShowTodayOnly(!showTodayOnly);
                  if (!showTodayOnly) {
                    setFromDate('');
                    setToDate('');
                  }
                  setPage(1);
                }}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Today Only
              </Button>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">From:</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setShowTodayOnly(false);
                    setPage(1);
                  }}
                  className="w-36 h-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">To:</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setShowTodayOnly(false);
                    setPage(1);
                  }}
                  className="w-36 h-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={challans}
            columns={columns}
            keyExtractor={(c) => c.id}
            loading={isLoading}
            emptyState={{ title: 'No challans found' }}
          />
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
