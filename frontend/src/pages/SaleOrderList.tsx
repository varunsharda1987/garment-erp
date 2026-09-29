import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '@/lib/query-client'; // BUG-ORD14 fix: standardized query key
import { Plus, Trash2, ShoppingBag, Eye, MoreHorizontal, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Combobox } from '@/components/ui/combobox';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import SearchInput from '@/components/SearchInput';
import { FilterBar, DateRangeFilter } from '@/components/filters';
import DataTable from '@/components/DataTable';
import { SaleOrderForm } from '@/components/sale-order';
import { orderSeasonLabels } from '@/components/sale-order/sale-order-lines';
import { getAllSaleOrders, createSaleOrder, deleteSaleOrder } from '@/services/saleOrder.service';
import { searchSeasons } from '@/services/season.service';
import type { SaleOrder, SaleOrderStatus, CreateSORequest, UpdateSORequest } from '@/types/saleOrder.types';
import { formatCurrency } from '@/lib/currency';
import { formatDate, toDateInputValue } from '@/lib/date';
import { BUYER_STYLE_CODE_LABEL, STYLE_CODE_LABEL, buyerStyleCode } from '@/lib/style-code';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type DateSortField = 'expectedShipDate' | 'buyerDeadline';

/** Once these are reached the goods have left, so a passed date is no longer "late". */
const SHIPPED_STATUSES: SaleOrderStatus[] = ['DISPATCHED', 'DELIVERED', 'CANCELLED'];

/** Whole days a date is behind today (IST calendar days), or 0 when it has not passed. */
function daysLate(value: string | null | undefined): number {
  if (!value) return 0;
  const days = Math.round(
    (Date.parse(toDateInputValue(new Date())) - Date.parse(toDateInputValue(value))) / 86_400_000
  );
  return days > 0 ? days : 0;
}

function DueDateCell({ value, status }: { value?: string | null; status: SaleOrderStatus }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const late = SHIPPED_STATUSES.includes(status) ? 0 : daysLate(value);
  return (
    <div className={late > 0 ? 'text-sm text-destructive font-medium' : 'text-sm'}>
      {formatDate(value)}
      {late > 0 && <div className="text-xs font-normal">{late === 1 ? '1 day late' : `${late} days late`}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<SaleOrderStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  CONFIRMED: 'bg-info-muted text-info',
  PARTIALLY_ALLOCATED: 'bg-warning/10 text-warning',
  FULLY_ALLOCATED: 'bg-success-muted text-success',
  PARTIALLY_DISPATCHED: 'bg-accent/10 text-accent',
  DISPATCHED: 'bg-teal-100 text-teal-800',
  DELIVERED: 'bg-success-muted text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

// One entry per distinct style on the order, in line order — the Buyer Style Code and Style Code
// columns both render from this list so a multi-style order's two stacks line up row for row.
function uniqueStyles(so: SaleOrder): Array<{ code: string; buyer: string }> {
  const uniqueByCode = new Map<string, { code: string; buyer: string }>();
  for (const item of so.items || []) {
    const code = item.style?.styleCode;
    if (code && !uniqueByCode.has(code)) {
      // The line's captured buyer code first — the style master's copy shows today's value
      // even on an order placed under an older one.
      uniqueByCode.set(code, { code, buyer: buyerStyleCode(item.style, item.buyerStyleRef) });
    }
  }
  return [...uniqueByCode.values()];
}

const STATUS_OPTIONS: Array<{ value: SaleOrderStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PARTIALLY_ALLOCATED', label: 'Partially Allocated' },
  { value: 'FULLY_ALLOCATED', label: 'Fully Allocated' },
  { value: 'PARTIALLY_DISPATCHED', label: 'Partially Dispatched' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function SaleOrderList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // '' = all customers / all seasons
  const [customerFilter, setCustomerFilter] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  // Sale date range — ISO yyyy-MM-dd, '' = open end
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [shipRange, setShipRange] = useState({ from: '', to: '' });
  const [deadlineRange, setDeadlineRange] = useState({ from: '', to: '' });
  const [sort, setSort] = useState<{ field: DateSortField; order: 'asc' | 'desc' } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soToDelete, setSoToDelete] = useState<SaleOrder | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // BUG-ORD14 fix: standardized query key
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.saleOrders.list({
      page,
      limit: pageSize,
      search,
      status: statusFilter,
      customerId: customerFilter,
      seasonId: seasonFilter,
      fromDate,
      toDate,
      shipRange,
      deadlineRange,
      sortBy: sort?.field,
      sortOrder: sort?.order,
    }),
    queryFn: () =>
      getAllSaleOrders({
        page,
        limit: pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as SaleOrderStatus) : undefined,
        customerId: customerFilter || undefined,
        seasonId: seasonFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        shipFrom: shipRange.from || undefined,
        shipTo: shipRange.to || undefined,
        deadlineFrom: deadlineRange.from || undefined,
        deadlineTo: deadlineRange.to || undefined,
        sortBy: sort?.field,
        sortOrder: sort?.order,
      }),
  });

  // The seasons the Style form offers (Season master). An order's season is its styles' season.
  const { data: seasons } = useQuery({
    queryKey: ['seasons', 'search', { limit: 100 }],
    queryFn: () => searchSeasons({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createSaleOrder,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saleOrders.all }); // BUG-ORD14 fix: standardized query key
      toast.success('Sale Order created');
      setCreateSheetOpen(false);
      navigate(`/sale-orders/${created.id}`);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to create sale order');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSaleOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.saleOrders.all }); // BUG-ORD14 fix: standardized query key
      toast.success('Sale Order deleted');
      setDeleteDialogOpen(false);
      setSoToDelete(null);
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to delete sale order');
    },
  });

  const handleCreateSubmit = async (data: CreateSORequest | UpdateSORequest) => {
    createMutation.mutate(data as CreateSORequest);
  };

  const activeFilterCount = [
    search,
    statusFilter !== 'all',
    customerFilter,
    seasonFilter,
    fromDate || toDate,
    shipRange.from || shipRange.to,
    deadlineRange.from || deadlineRange.to,
  ].filter(Boolean).length;
  const filtersActive = activeFilterCount > 0;

  // Clears every filter; page size stays as chosen
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCustomerFilter('');
    setSeasonFilter('');
    setFromDate('');
    setToDate('');
    setShipRange({ from: '', to: '' });
    setDeadlineRange({ from: '', to: '' });
    setPage(1);
  };

  // Click cycles: earliest first → latest first → back to newest orders first
  const toggleSort = (field: DateSortField) => {
    setSort((cur) =>
      cur?.field !== field ? { field, order: 'asc' } : cur.order === 'asc' ? { field, order: 'desc' } : null
    );
    setPage(1);
  };
  const sortHeader = (field: DateSortField, label: string) => {
    const Icon = sort?.field !== field ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground"
        title={`Sort by ${label}`}
      >
        {label}
        <Icon className={sort?.field === field ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 opacity-40'} />
      </button>
    );
  };

  const columns: Column<SaleOrder>[] = [
    {
      key: 'saleOrderNumber',
      header: 'SO Number',
      render: (so) => (
        <div className="font-mono font-medium">
          {so.saleOrderNumber}
          {(so.buyerPos?.length ? so.buyerPos.length > 0 : so.buyerPoNumber) && (
            <div className="text-xs text-muted-foreground font-normal">
              {so.buyerPos?.length ? (
                so.buyerPos.length === 1 ? (
                  <>PO {so.buyerPos[0].buyerPoNumber}</>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          PO {so.buyerPos.find((p) => p.isPrimary)?.buyerPoNumber || so.buyerPos[0].buyerPoNumber}
                          <span className="ml-1 text-info">+{so.buyerPos.length - 1}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          {so.buyerPos.map((po) => (
                            <div key={po.id}>
                              {po.isPrimary ? '★ ' : ''}
                              {po.buyerPoNumber}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              ) : (
                <>PO {so.buyerPoNumber}</>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (so) => (
        <div>
          <div className="font-medium">{so.customer?.name}</div>
          <div className="text-xs text-muted-foreground">{so.customer?.code}</div>
        </div>
      ),
    },
    {
      key: 'buyerStyles',
      header: BUYER_STYLE_CODE_LABEL,
      render: (so) => {
        const unique = uniqueStyles(so);
        if (unique.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {unique.map(({ code, buyer }) => (
              <span key={code} className="text-xs font-medium bg-muted text-foreground px-1.5 py-0.5 rounded">
                {buyer}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'styles',
      header: STYLE_CODE_LABEL,
      render: (so) => {
        const unique = uniqueStyles(so);
        if (unique.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {unique.map(({ code }) => (
              <span key={code} className="text-xs text-foreground px-1.5 py-0.5">
                {code}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      // The style's season — a sale order has none of its own (styles.seasonId → Season master)
      key: 'season',
      header: 'Season',
      render: (so) => {
        const seasons = orderSeasonLabels(so.items);
        if (seasons.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {seasons.map((season) => (
              <span key={season} className="text-xs text-foreground px-1.5 py-0.5">
                {season}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'saleDate',
      header: 'Sale Date',
      render: (so) => <div className="text-sm">{formatDate(so.saleDate)}</div>,
    },
    {
      key: 'expectedShipDate',
      header: sortHeader('expectedShipDate', 'Expected Ship Date'),
      render: (so) => <DueDateCell value={so.expectedShipDate} status={so.status} />,
    },
    {
      key: 'buyerDeadline',
      header: sortHeader('buyerDeadline', 'Buyer Deadline'),
      render: (so) => <DueDateCell value={so.buyerDeadline} status={so.status} />,
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (so) => {
        const items = so.items || [];
        if (items.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const allocated = items.reduce((sum, i) => sum + (i.allocatedQty || 0), 0);
        const dispatched = items.reduce((sum, i) => sum + (i.dispatchedQty || 0), 0);
        return (
          <div className="text-sm font-medium">
            {totalQty.toLocaleString()} pcs
            {(allocated > 0 || dispatched > 0) && (
              <div className="text-xs text-muted-foreground font-normal">
                {allocated.toLocaleString()} alloc · {dispatched.toLocaleString()} disp
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (so) => <span className="font-medium">{formatCurrency(so.totalAmount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (so) => (
        <Badge className={STATUS_COLORS[so.status]} variant="secondary">
          {so.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (so) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            {/* stopPropagation: the menu renders in a portal, so its clicks still bubble up the
                React tree to the row's own onClick and would navigate instead of firing the item. */}
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => navigate(`/sale-orders/${so.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {so.status === 'DRAFT' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      setSoToDelete(so);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Sale Orders
          </h1>
          <p className="text-muted-foreground">Sell from existing finished goods stock</p>
        </div>
        <Button onClick={() => setCreateSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sale Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={filtersActive}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              placeholder="Search SO number, buyer PO, customer, style, buyer style code, season…"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              className="min-w-[220px] flex-1 max-w-md"
              aria-label="Search sale orders"
            />
            <CustomerCombobox
              value={customerFilter}
              onValueChange={(v) => {
                setCustomerFilter(v || '');
                setPage(1);
              }}
              allowAll
              allLabel="All customers"
              placeholder="All customers"
              className="w-[220px]"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Combobox
              options={[
                { value: '', label: 'All seasons', searchText: 'all seasons' },
                ...(seasons ?? []).map((season) => ({
                  value: season.id,
                  label: `${season.code} — ${season.name}`,
                })),
              ]}
              value={seasonFilter}
              onValueChange={(v) => {
                setSeasonFilter(v || '');
                setPage(1);
              }}
              placeholder="All seasons"
              searchPlaceholder="Search season…"
              emptyText="No seasons found."
              className="w-[220px]"
            />
            <DateRangeFilter
              label="Sale date"
              from={fromDate}
              to={toDate}
              onChange={({ from, to }) => {
                setFromDate(from);
                setToDate(to);
                setPage(1);
              }}
            />
            <DateRangeFilter
              label="Expected ship date"
              from={shipRange.from}
              to={shipRange.to}
              onChange={(range) => {
                setShipRange(range);
                setPage(1);
              }}
            />
            <DateRangeFilter
              label="Buyer deadline"
              from={deadlineRange.from}
              to={deadlineRange.to}
              onChange={(range) => {
                setDeadlineRange(range);
                setPage(1);
              }}
            />
          </FilterBar>
        </CardHeader>
        <CardContent>
          <DataTable
            data={data?.data}
            columns={columns}
            keyExtractor={(so) => so.id}
            loading={isLoading}
            error={isError ? 'Failed to load sale orders' : null}
            emptyState={{
              icon: <ShoppingBag className="h-16 w-16" />,
              ...(filtersActive
                ? {
                    title: 'No sale orders match these filters.',
                    actionLabel: 'Clear filters',
                    onAction: clearFilters,
                  }
                : {
                    title: 'No sale orders found',
                    description: 'Sale orders pushed from the B2B app will appear here',
                    actionLabel: 'New Sale Order',
                    onAction: () => setCreateSheetOpen(true),
                  }),
            }}
            pagination={{
              currentPage: page,
              totalPages: data?.pagination?.totalPages ?? 1,
              pageSize,
              totalItems: data?.pagination?.total ?? 0,
              onPageChange: setPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              },
            }}
            onRowClick={(so) => navigate(`/sale-orders/${so.id}`)}
          />
        </CardContent>
      </Card>

      {/* Create Sale Order Sheet */}
      <SaleOrderForm
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        onSubmit={handleCreateSubmit}
        mode="create"
        isSubmitting={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {soToDelete?.saleOrderNumber}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive"
              onClick={() => soToDelete && deleteMutation.mutate(soToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
