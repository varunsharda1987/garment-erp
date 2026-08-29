import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { queryKeys } from '@/lib/query-client'; // BUG-ORD14 fix: standardized query key
import { Plus, Trash2, ShoppingBag, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { SaleOrderForm } from '@/components/sale-order';
import { getAllSaleOrders, createSaleOrder, deleteSaleOrder } from '@/services/saleOrder.service';
import type { SaleOrder, SaleOrderStatus, CreateSORequest, UpdateSORequest } from '@/types/saleOrder.types';
import { formatCurrency } from '@/lib/currency';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function SaleOrderList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [soToDelete, setSoToDelete] = useState<SaleOrder | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, customerFilter, dateRange]);

  const fromDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
  const toDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

  // BUG-ORD14 fix: standardized query key
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.saleOrders.list({
      page,
      limit: pageSize,
      search,
      status: statusFilter,
      customerId: customerFilter,
      fromDate,
      toDate,
    }),
    queryFn: () =>
      getAllSaleOrders({
        page,
        limit: pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as SaleOrderStatus) : undefined,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        fromDate,
        toDate,
      }),
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

  const filtersActive = Boolean(search || statusFilter !== 'all' || customerFilter !== 'all' || dateRange);

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
      key: 'styles',
      header: 'Style(s)',
      render: (so) => {
        const uniqueByCode = new Map<string, { code: string; ref?: string | null }>();
        for (const item of so.items || []) {
          const code = item.style?.styleCode;
          if (code && !uniqueByCode.has(code)) {
            uniqueByCode.set(code, { code, ref: item.style?.buyerStyleRef });
          }
        }
        const unique = [...uniqueByCode.values()];
        if (unique.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {unique.map(({ code, ref }) => (
              <span key={code} className="text-xs bg-muted text-foreground px-1.5 py-0.5 rounded">
                {code}
                {ref && ref !== code ? ` (${ref})` : ''}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'saleDate',
      header: 'Sale Date',
      render: (so) => (
        <div className="text-sm">
          {formatDate(so.saleDate)}
          {so.expectedShipDate && (
            <div className="text-xs text-muted-foreground">Ship {formatDate(so.expectedShipDate)}</div>
          )}
        </div>
      ),
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/sale-orders/${so.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {so.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSoToDelete(so);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
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
          <div className="space-y-4">
            <SearchInput
              placeholder="Search by SO number, buyer PO or customer..."
              value={search}
              onChange={setSearch}
              className="max-w-md"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CustomerCombobox
                value={customerFilter === 'all' ? '' : customerFilter}
                onValueChange={(v) => setCustomerFilter(v || 'all')}
                placeholder="All Customers"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Sale date range" />
            </div>
          </div>
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
              title: 'No sale orders found',
              description: filtersActive
                ? 'Try adjusting your search or filter criteria'
                : 'Sale orders pushed from the B2B app will appear here',
              actionLabel: 'New Sale Order',
              onAction: () => setCreateSheetOpen(true),
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
