/**
 * Purchase Order List
 * Material POs (processing and service work moved to Job Work Orders) with stats cards,
 * tab-based filtering, and contextual actions
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useListQuery, useDetailQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CancelPoDialog } from '@/components/purchase-orders/CancelPoDialog';
import { getAllPurchaseOrders, getPOStats, deletePurchaseOrder } from '@/services/purchaseOrder.service';
import { getOrderById } from '@/services/order.service';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import Pagination from '@/components/Pagination';
import { getUrlLimit } from '@/lib/url-filters';
import type { PurchaseOrderStatus, POSource, PurchaseOrderFilters, POStats } from '@/types/purchaseOrder.types';
import {
  PurchaseOrderStatusLabels,
  POSourceLabels,
  POSourceColors,
  PO_GROUP_CATEGORIES,
  PO_CATEGORY_LABELS,
  PO_CATEGORY_COLORS,
  type POGroup,
  type PurchaseOrderItem,
} from '@/types/purchaseOrder.types';
import type { Order } from '@/types/order.types';
import { getErrorMessage, handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { deliveryUndecidedSoon, FINISHED_STATUSES, planMode } from '@/lib/delivery-plan';
import { groupLabelLines, type GroupedLine } from '@/lib/label-lines';
import { poItemLabelKey } from '@/lib/label-line-keys';
import { summarizePOStats } from '@/lib/po-list-stats';
import { materialDetailLine } from '@/lib/material-detail';
import {
  ShoppingBag,
  Clock,
  Truck,
  IndianRupee,
  Eye,
  Edit,
  Trash2,
  XCircle,
  FileMinus,
  MoreHorizontal,
  RefreshCw,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react';

/** The tabs this page has. Processing / Service went to Job Work Orders; an old `?tab=processing` link lands on All. */
const TAB_VALUES: POGroup[] = ['all', 'material'];

/** Statuses a material PO can be in. PENDING_GREIGE / READY_FOR_PROCESSING were processing-PO states (now job work). */
const STATUS_FILTER_OPTIONS: PurchaseOrderStatus[] = [
  'DRAFT',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'SHORT_CLOSED',
  'CANCELLED',
];

/** Where a material PO comes from. SERVICE_REQUIREMENT retired with service POs (c95804c0). */
const SOURCE_FILTER_OPTIONS: POSource[] = ['MANUAL', 'COST_SHEET', 'MRP'];

/** The URL params that narrow the list (the tab, the page and the page size are not filters) */
const FILTER_KEYS = ['search', 'status', 'supplierId', 'source', 'poCategory', 'delivery', 'orderId'] as const;

/** Cancel starts once the PO is sent (owner, 2026-09-27): a draft is deleted, a part-delivered PO is closed short. */
const CANCELLABLE_STATUSES: PurchaseOrderStatus[] = ['SENT', 'ACKNOWLEDGED'];

/** A filter's options plus the URL's value when it is not one of them (an old link), so the control shows what filters. */
function withCurrent(values: readonly string[], current: string | null): string[] {
  return current && !values.includes(current) ? [...values, current] : [...values];
}

const lineName = (item: PurchaseOrderItem) => item.materials?.name || item.serviceDescription || 'Item';

/** One line — or a label bought in sizes, as one: "Main Cum Size Label Black · 6 sizes" (+ the sizes, for the tooltip). */
function describeLine(g: GroupedLine<PurchaseOrderItem>, withSizes = false): string {
  if (g.kind === 'single') return lineName(g.line);
  const count = `${g.rows.length} ${g.rows.length === 1 ? 'size' : 'sizes'}`;
  const sizes = g.rows.map((r) => r.size ?? 'Base').join(', ');
  return `${g.name} · ${count}${withSizes ? ` (${sizes})` : ''}`;
}

/** Who a line is for · what tells it apart — a label's sizes all read one label master, so its first size speaks for it */
const lineDetail = (g: GroupedLine<PurchaseOrderItem>) =>
  materialDetailLine(g.kind === 'single' ? g.line.materials : g.rows[0]?.line.materials);

/** The tooltip's line for one item: its name (and sizes), then its detail when it has one */
function tooltipLine(g: GroupedLine<PurchaseOrderItem>): string {
  const detail = lineDetail(g);
  return detail ? `${describeLine(g, true)} — ${detail}` : describeLine(g, true);
}

/**
 * What is on the PO: the first line's material (a service line falls back to its description, as on the
 * detail page) — a label's sizes counted as one, as on the PO page — plus a count of the others.
 */
function POMaterialCell({ lines }: { lines: GroupedLine<PurchaseOrderItem>[] }) {
  const [first] = lines;
  if (!first) return <span className="text-sm text-muted-foreground">—</span>;

  const code = first.kind === 'label' ? first.code : first.line.materials?.code;
  const extra = lines.length - 1;
  const detail = lineDetail(first);
  return (
    // Wider on big screens so a greige's quality suffix ("… (Super Dyeing)") is not cut off
    <div className="max-w-[260px] 2xl:max-w-[420px]" title={lines.map(tooltipLine).join('\n')}>
      <div className="text-sm font-medium truncate">{describeLine(first)}</div>
      {detail && <div className="text-xs text-muted-foreground truncate">{detail}</div>}
      <div className="text-xs text-muted-foreground truncate">
        {code}
        {extra > 0 && `${code ? ' · ' : ''}+${extra} more`}
      </div>
    </div>
  );
}

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; poNumber: string } | null>(null);

  // Active tab from URL — an unknown value (a stale ?tab=processing link) falls back to All instead of
  // indexing a category group that no longer exists, which crashed the whole app
  const tabParam = searchParams.get('tab');
  const activeTab: POGroup = TAB_VALUES.includes(tabParam as POGroup) ? (tabParam as POGroup) : 'all';

  const statusParam = searchParams.get('status');
  const sourceParam = searchParams.get('source');
  const poCategoryParam = searchParams.get('poCategory');
  const orderIdParam = searchParams.get('orderId');

  // URL param helpers
  const updateURLParams = (updates: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams, { replace: true });
  };

  // Filters from URL
  const filters = useMemo((): PurchaseOrderFilters => {
    const specificCategory = searchParams.get('poCategory') || undefined;
    const pageParam = Number.parseInt(searchParams.get('page') ?? '', 10);

    return {
      status: (searchParams.get('status') as PurchaseOrderStatus) || undefined,
      source: (searchParams.get('source') as POSource) || undefined,
      // BUG-JWC2: 'all' tab must also be material-only so the table agrees with the
      // material-only stat cards/tab counts. Processing/service work lives in Job Work
      // Orders; deprecated-category POs stay reachable via the ?poCategory= URL param.
      poCategories: specificCategory ? [specificCategory] : [...PO_GROUP_CATEGORIES.material],
      supplierId: searchParams.get('supplierId') || undefined,
      // Scoped from OrderDetail "View POs" action (?orderId=...) — B09-11 handoff
      orderId: searchParams.get('orderId') || undefined,
      delivery: searchParams.get('delivery') === 'TO_BE_ADVISED' ? 'TO_BE_ADVISED' : undefined,
      search: searchParams.get('search') || undefined,
      page: Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1,
      // ?limit= from the pager's size choice; the API accepts 1-100
      limit: getUrlLimit(searchParams, 20),
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
  }, [searchParams]);
  const currentPage = filters.page ?? 1;

  // ─── Queries ───────────────────────────────────────────────
  // refetchOnMount 'always': coming back from a PO (sent, received, cancelled there) must not show the
  // cached rows and counts for another 30-60 s

  const { data: stats } = useListQuery<POStats>(queryKeys.purchaseOrders.stats(), getPOStats, {
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const {
    data: poResponse,
    isLoading,
    isError,
    error: listError,
    refetch: refetchList,
  } = useListQuery(
    queryKeys.purchaseOrders.list(filters as unknown as Record<string, unknown>),
    () => getAllPurchaseOrders(filters),
    { staleTime: 30 * 1000, refetchOnMount: 'always' }
  );

  // The order a ?orderId= link scopes the list to — named on its filter chip
  const { data: scopedOrder } = useDetailQuery<Order>(
    queryKeys.orders.detail(orderIdParam ?? ''),
    () => getOrderById(orderIdParam!),
    { enabled: !!orderIdParam, staleTime: 5 * 60 * 1000 }
  );

  const purchaseOrders = poResponse?.data || [];
  const pagination = poResponse?.pagination || { page: 1, limit: filters.limit ?? 20, total: 0, totalPages: 1 };

  // A page past the end (rows deleted, a narrower filter, an old link) showed the empty state with no pager
  // to get back — go to page 1 instead
  useEffect(() => {
    if (poResponse && currentPage > Math.max(1, poResponse.pagination.totalPages)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('page');
          return next;
        },
        { replace: true }
      );
    }
  }, [poResponse, currentPage, setSearchParams]);

  // ─── Computed Stats ────────────────────────────────────────

  // The stats keep their enum keys as stored ({ SENT: 2 }) — read them directly (lib/po-list-stats)
  const summary = useMemo(() => summarizePOStats(stats), [stats]);

  // Category options: the material categories, plus a deprecated one reached by link (?poCategory=PROCESSING)
  const categoryOptions = useMemo(
    () =>
      withCurrent(PO_GROUP_CATEGORIES.material, poCategoryParam).map((cat) => ({
        value: cat,
        label: PO_CATEGORY_LABELS[cat] || cat,
      })),
    [poCategoryParam]
  );

  // A filter set by URL keeps its control visible on either tab, or it filters with nothing to show or clear it
  const showSourceFilter = activeTab === 'all' || !!sourceParam;
  const showCategoryFilter = (activeTab !== 'all' && categoryOptions.length > 2) || !!poCategoryParam;

  // Everything a person narrowed by — "Clear N filters" removes these; the tab and the page size stay
  const activeFilterCount = FILTER_KEYS.filter((key) => !!searchParams.get(key)).length;
  const hasActiveFilters = activeFilterCount > 0;

  const colSpan = activeTab === 'all' ? 10 : 9;

  // ─── Handlers ──────────────────────────────────────────────

  const handleTabChange = (tab: string) => {
    const newParams = new URLSearchParams();
    if (tab !== 'all') newParams.set('tab', tab);
    setSearchParams(newParams, { replace: true });
  };

  const handleClearFilters = () =>
    updateURLParams({ ...Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])), page: undefined });

  const handleDeleteClick = (id: string, poNumber: string) => {
    setDeleteTarget({ id, poNumber });
    setDeleteDialogOpen(true);
  };

  const handleCancelClick = (id: string, poNumber: string) => {
    setCancelTarget({ id, poNumber });
    setCancelDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, poNumber } = deleteTarget;
    try {
      await deletePurchaseOrder(id);
      handleApiSuccess('Purchase order deleted', `${poNumber} has been deleted.`);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete purchase order');
    } finally {
      // A refusal usually means the row moved on elsewhere (sent from the PO page) — show that too
      void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
    }
  };

  const getStatusVariant = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'info';
      case 'ACKNOWLEDGED':
        return 'info';
      case 'PARTIALLY_RECEIVED':
        return 'warning';
      case 'RECEIVED':
        return 'success';
      case 'SHORT_CLOSED':
        return 'warning';
      case 'CANCELLED':
        return 'destructive';
      case 'PENDING_GREIGE':
        return 'warning';
      case 'READY_FOR_PROCESSING':
        return 'info';
      default:
        return 'secondary';
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-medium flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Purchase Orders
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/procurement/purchase-orders/new')}>
            <Plus className="h-4 w-4 mr-1" />
            Create PO
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards — 4 across only from xl: beside the sidebar, 4 across at 1280-1366 px ran the
          Total Value amount into its icon */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total POs</p>
                <p className="text-2xl font-bold min-w-0 truncate tabular-nums">{summary.materialPOs}</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-full bg-info-muted flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Pending Action</p>
                <p className="text-2xl font-bold min-w-0 truncate tabular-nums">{summary.pendingAction}</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-full bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Awaiting Delivery</p>
                <p className="text-2xl font-bold min-w-0 truncate tabular-nums">{summary.awaitingDelivery}</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p
                  className="text-2xl font-bold min-w-0 truncate tabular-nums"
                  title={formatCurrency(summary.totalValue)}
                >
                  {formatCurrency(summary.totalValue)}
                </p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-full bg-success-muted flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Content */}
      {/* NOTE: Processing/Service tabs removed - those POs are now Job Work Orders */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">
            All{' '}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {summary.materialPOs}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="material">
            Material{' '}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {summary.materialPOs}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Shared content for all tabs */}
        <div className="mt-4 space-y-4">
          {/* Filter Bar */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <FilterBar
                onClear={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
                clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
              >
                <div className="flex-1 min-w-[200px]">
                  <SearchInput
                    placeholder="Search by PO number, supplier, style or material..."
                    value={searchParams.get('search') || ''}
                    onChange={(value) => updateURLParams({ search: value || undefined, page: undefined })}
                    // The API refuses a longer search (purchaseOrderQuerySchema: max 100)
                    maxLength={100}
                  />
                </div>

                <Select
                  value={statusParam || 'all'}
                  onValueChange={(v) => updateURLParams({ status: v === 'all' ? undefined : v, page: undefined })}
                >
                  <SelectTrigger className="w-[180px]" aria-label="Status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {withCurrent(STATUS_FILTER_OPTIONS, statusParam).map((status) => (
                      <SelectItem key={status} value={status}>
                        {PurchaseOrderStatusLabels[status as PurchaseOrderStatus] || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <SupplierCombobox
                  value={searchParams.get('supplierId') || ''}
                  onValueChange={(v) => updateURLParams({ supplierId: v || undefined, page: undefined })}
                  placeholder="All suppliers"
                  allowAll
                  allLabel="All suppliers"
                  className="w-[220px]"
                />

                {/* Source filter on the All tab — and wherever ?source= is set */}
                {showSourceFilter && (
                  <Select
                    value={sourceParam || 'all'}
                    onValueChange={(v) => updateURLParams({ source: v === 'all' ? undefined : v, page: undefined })}
                  >
                    <SelectTrigger className="w-[160px]" aria-label="Source">
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {withCurrent(SOURCE_FILTER_OPTIONS, sourceParam).map((source) => (
                        <SelectItem key={source} value={source}>
                          {POSourceLabels[source as POSource] || source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Category filter on typed tabs — and wherever ?poCategory= is set */}
                {showCategoryFilter && (
                  <Select
                    value={poCategoryParam || 'all'}
                    onValueChange={(v) => updateURLParams({ poCategory: v === 'all' ? undefined : v, page: undefined })}
                  >
                    <SelectTrigger className="w-[180px]" aria-label="Category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Delivery place not decided yet (to be advised) */}
                <Select
                  value={searchParams.get('delivery') || 'all'}
                  onValueChange={(v) => updateURLParams({ delivery: v === 'all' ? undefined : v, page: undefined })}
                >
                  <SelectTrigger className="w-[190px]" aria-label="Delivery place">
                    <SelectValue placeholder="Any delivery place" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any delivery place</SelectItem>
                    <SelectItem value="TO_BE_ADVISED">Delivery: to be advised</SelectItem>
                  </SelectContent>
                </Select>

                {/* Scoped to one order (OrderDetail "View POs") — say so, and let it be removed on its own */}
                {orderIdParam && (
                  <Badge variant="secondary" className="h-9 gap-1 pl-3 pr-1 text-sm font-normal">
                    Order: {scopedOrder?.orderNumber ?? 'this order'}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label="Remove the order filter"
                      onClick={() => updateURLParams({ orderId: undefined, page: undefined })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </Badge>
                )}
              </FilterBar>
            </CardContent>
          </Card>

          {/* Results summary */}
          {!(isError && !poResponse) && (
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>
                Showing {purchaseOrders.length} of {pagination.total} purchase orders
              </span>
              {isError && (
                // A refresh failed but an earlier load is on screen — say it may be out of date
                <span className="flex items-center gap-2 text-destructive">
                  Could not refresh: {getErrorMessage(listError)}
                  <Button variant="outline" size="sm" onClick={() => void refetchList()}>
                    Retry
                  </Button>
                </span>
              )}
            </div>
          )}

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {activeTab === 'all' && <TableHead>Source</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                        Loading purchase orders...
                      </TableCell>
                    </TableRow>
                  ) : isError && !poResponse ? (
                    // A failed load is not "no purchase orders" — say what went wrong and offer a retry
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-12">
                        <div role="alert" className="flex flex-col items-center gap-2 text-muted-foreground">
                          <AlertCircle className="h-12 w-12 text-destructive opacity-70" />
                          <p className="text-lg font-medium text-foreground">Could not load purchase orders</p>
                          <p className="text-sm">{getErrorMessage(listError)}</p>
                          <Button variant="outline" className="mt-2" onClick={() => void refetchList()}>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : purchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ShoppingBag className="h-12 w-12 opacity-50" />
                          <p className="text-lg font-medium">
                            {orderIdParam
                              ? 'No purchase orders for this order'
                              : hasActiveFilters
                                ? 'No purchase orders match these filters'
                                : 'No purchase orders found'}
                          </p>
                          <p className="text-sm">
                            {hasActiveFilters
                              ? 'Try adjusting your filters, or clear them to see every purchase order'
                              : 'Get started by creating your first purchase order'}
                          </p>
                          {hasActiveFilters ? (
                            <Button variant="outline" className="mt-2" onClick={handleClearFilters}>
                              <X className="h-4 w-4 mr-1" />
                              Clear filters
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="mt-2"
                              onClick={() => navigate('/procurement/purchase-orders/new')}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create Purchase Order
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchaseOrders.map((po) => {
                      // A label bought in sizes is one line here, as on the PO page
                      const lines = groupLabelLines(po.items ?? [], poItemLabelKey);
                      const lineCount = po.itemCount || po.items?.length || 0;
                      return (
                        <TableRow
                          key={po.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}
                        >
                          {/* PO Number — a real link: ctrl/middle-click opens a tab, Tab + Enter opens it */}
                          <TableCell>
                            <div>
                              <Link
                                to={`/procurement/purchase-orders/${po.id}`}
                                // The row navigates too; without this a click would navigate twice
                                onClick={(e) => e.stopPropagation()}
                                className="whitespace-nowrap text-sm font-medium text-info hover:underline"
                              >
                                {po.poNumber}
                              </Link>
                              <div className="whitespace-nowrap text-xs text-muted-foreground mt-0.5">
                                {formatDate(po.poDate)}
                              </div>
                            </div>
                          </TableCell>

                          {/* Supplier */}
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium">{po.supplier?.name || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground">{po.supplier?.code}</div>
                            </div>
                          </TableCell>

                          {/* Material */}
                          <TableCell>
                            <POMaterialCell lines={lines} />
                          </TableCell>

                          {/* Category */}
                          <TableCell>
                            {po.poCategory && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PO_CATEGORY_COLORS[po.poCategory] || 'bg-muted text-muted-foreground'}`}
                              >
                                {PO_CATEGORY_LABELS[po.poCategory] || po.poCategory}
                              </span>
                            )}
                          </TableCell>

                          {/* Expected Delivery — and where, when it is not decided yet */}
                          <TableCell>
                            <span className="text-sm">{formatDate(po.expectedDeliveryDate)}</span>
                            {planMode(po) === 'TO_BE_ADVISED' && !FINISHED_STATUSES.includes(po.status) && (
                              <Badge
                                variant="outline"
                                className={`mt-1 block w-fit text-[10px] ${
                                  deliveryUndecidedSoon(po) ? 'border-warning bg-warning/10 text-warning' : ''
                                }`}
                                title="The delivery place is not decided — set it from the PO page before the supplier dispatches"
                              >
                                Delivery: to be advised
                              </Badge>
                            )}
                          </TableCell>

                          {/* Items — a label's sizes count as one */}
                          <TableCell className="text-center">
                            <span
                              className="text-sm"
                              title={lines.length && lines.length !== lineCount ? `${lineCount} PO lines` : undefined}
                            >
                              {lines.length || lineCount}
                            </span>
                          </TableCell>

                          {/* Amount */}
                          <TableCell className="text-right">
                            <span className="text-sm font-medium">{formatCurrency(po.totalAmount)}</span>
                          </TableCell>

                          {/* Source (All tab only) */}
                          {activeTab === 'all' && (
                            <TableCell>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${po.poSource ? POSourceColors[po.poSource] : 'bg-muted text-muted-foreground'}`}
                              >
                                {po.poSource ? POSourceLabels[po.poSource] : 'Unknown'}
                              </span>
                            </TableCell>
                          )}

                          {/* Status */}
                          <TableCell>
                            <StatusBadge
                              status={PurchaseOrderStatusLabels[po.status]}
                              variant={getStatusVariant(po.status)}
                            />
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Actions for ${po.poNumber}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* stopPropagation: menu clicks bubble through the React tree to the row's
                                  navigate onClick (portal ≠ DOM tree) — a separator or padding click opened the PO */}
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>

                                {po.status === 'DRAFT' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => navigate(`/procurement/purchase-orders/${po.id}/edit`)}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteClick(po.id, po.poNumber)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {po.status === 'PARTIALLY_RECEIVED' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        // Carry the intent: without it this item is identical to
                                        // "View Details" and simply lands the user on the page.
                                        navigate(`/procurement/purchase-orders/${po.id}?action=short-close`)
                                      }
                                    >
                                      <FileMinus className="h-4 w-4 mr-2" />
                                      Close Short
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {/* Sent or acknowledged only: a draft is deleted, and once goods have arrived
                                    the honest exit is Close Short (an admin force-cancel lives on the PO page). */}
                                {CANCELLABLE_STATUSES.includes(po.status) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleCancelClick(po.id, po.poNumber)}
                                      className="text-destructive"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel PO
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* The shared pager (a page past the end is sent back to page 1 by the effect above) */}
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, pagination.totalPages)}
            pageSize={filters.limit ?? 20}
            totalItems={pagination.total}
            onPageChange={(p) => updateURLParams({ page: p > 1 ? String(p) : undefined })}
            onPageSizeChange={(size) =>
              updateURLParams({ limit: size === 20 ? undefined : String(size), page: undefined })
            }
            pageSizeOptions={[20, 50, 100]}
            itemLabel="purchase orders"
          />
        </div>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Purchase Order"
        description={`Are you sure you want to delete ${deleteTarget?.poNumber ?? 'this purchase order'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Cancel with a typed reason — the shared dialog (stays open until the request settles) */}
      <CancelPoDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} po={cancelTarget} />
    </div>
  );
}
