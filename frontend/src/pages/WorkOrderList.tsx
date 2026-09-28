import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Edit, Eye, TrendingUp, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { OrderCombobox } from '@/components/OrderCombobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import type { WorkOrder, OrderStatus, Priority } from '@/types/production.types';
import { ClipboardList } from 'lucide-react';
import { formatDate, toDateInputValue } from '@/lib/date';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function WorkOrderList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state (seed from dashboard drill-down query params)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>((searchParams.get('status') as OrderStatus) || '');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  // Backend has no "overdue" filter — applied client-side over plannedEndDate
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get('overdue') === 'true');
  // Scope to a single order when arriving from the order detail drill-down link
  const [orderIdFilter, setOrderIdFilter] = useState(searchParams.get('orderId') || '');
  const [styleFilter, setStyleFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  useEffect(() => {
    loadWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, searchQuery, orderIdFilter, styleFilter, warehouseFilter]);

  const loadWorkOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await workOrderService.getAll({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchQuery || undefined,
        orderId: orderIdFilter || undefined,
        styleId: styleFilter || undefined,
        warehouseId: warehouseFilter || undefined,
      });
      setWorkOrders(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load work orders', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'warning' as const;
      case 'IN_PRODUCTION':
        return 'info' as const;
      case 'COMPLETED':
        return 'success' as const;
      case 'DISPATCHED':
        return 'success' as const;
      case 'CANCELLED':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getPriorityVariant = (priority: Priority) => {
    switch (priority) {
      case 'URGENT':
        return 'destructive' as const;
      case 'HIGH':
        return 'warning' as const;
      case 'MEDIUM':
        return 'info' as const;
      case 'LOW':
        return 'success' as const;
      default:
        return 'secondary' as const;
    }
  };

  const calculateProgress = (workOrder: WorkOrder) => {
    if (workOrder.totalQuantity === 0) return 0;
    return Math.round((workOrder.completedQuantity / workOrder.totalQuantity) * 100);
  };

  // Overdue once the planned end DAY (IST) has passed — not from 05:30 on the day itself
  const isOverdue = (wo: WorkOrder) =>
    !!wo.plannedEndDate &&
    toDateInputValue(wo.plannedEndDate) < toDateInputValue(new Date()) &&
    !['COMPLETED', 'DISPATCHED', 'CANCELLED', 'SPLIT'].includes(wo.status);

  // Drop drill-down params from the URL once their filter is changed or cleared, so a reload does not bring them back
  const clearUrlFilters = (...keys: string[]) => {
    const next = new URLSearchParams(searchParams);
    keys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const activeFilterCount = [
    searchQuery,
    statusFilter,
    priorityFilter,
    orderIdFilter,
    styleFilter,
    warehouseFilter,
    overdueOnly,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setOrderIdFilter('');
    setStyleFilter('');
    setWarehouseFilter('');
    setOverdueOnly(false);
    clearUrlFilters('status', 'overdue', 'orderId');
  };

  // Overdue is filtered client-side (no backend param); status/priority/search are server-side
  const displayedWorkOrders = overdueOnly ? workOrders.filter(isOverdue) : workOrders;

  // Define columns for DataTable
  const columns: Column<WorkOrder>[] = [
    {
      key: 'workOrderNumber',
      header: 'Production Run #',
      render: (wo) => <div className="font-medium text-foreground">{wo.workOrderNumber}</div>,
    },
    {
      key: 'order',
      header: 'Order / Source',
      render: (wo) => (
        <div>
          {wo.orders ? (
            <>
              <div className="font-medium text-foreground">{wo.orders.orderNumber}</div>
              <div className="text-xs text-muted-foreground">{wo.orders.customer?.name || '-'}</div>
            </>
          ) : wo.stockProductionOrderId ? (
            <>
              <div className="font-medium text-info">{wo.stockProductionOrder?.spoNumber || 'Stock Production'}</div>
              <div className="text-xs text-info">Make-to-Stock</div>
            </>
          ) : (
            <div className="text-muted-foreground">-</div>
          )}
        </div>
      ),
    },
    {
      key: 'style',
      header: 'Style',
      render: (wo) => (
        <div>
          <div className="font-medium text-foreground">{wo.style?.styleCode || '-'}</div>
          <div className="text-xs text-muted-foreground">{wo.style?.styleName || ''}</div>
        </div>
      ),
    },
    {
      key: 'buyerStyleRef',
      header: 'Buyer Ref',
      render: (wo) => <span className="text-sm">{wo.style?.buyerStyleRef || '—'}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      render: (wo) => (
        <div className="text-sm text-foreground">
          {wo.warehouse?.warehouseName || <span className="text-warning">Not Assigned</span>}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (wo) => (
        <div>
          <div className="font-medium text-foreground">
            {wo.completedQuantity} / {wo.totalQuantity}
          </div>
          <div className="text-xs text-muted-foreground">{calculateProgress(wo)}% complete</div>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (wo) => {
        const progress = calculateProgress(wo);
        return (
          <div className="w-full">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${progress === 100 ? 'bg-success' : 'bg-info'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (wo) => <StatusBadge status={wo.priority} variant={getPriorityVariant(wo.priority)} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (wo) => <StatusBadge status={wo.status.replace(/_/g, ' ')} variant={getStatusVariant(wo.status)} />,
    },
    {
      key: 'dates',
      header: 'Planned Dates',
      render: (wo) => (
        <div className="text-sm">
          <div className="text-foreground">{formatDate(wo.plannedStartDate)}</div>
          <div className="text-xs text-muted-foreground">to {formatDate(wo.plannedEndDate)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (wo) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/production/work-orders/${wo.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {wo.status === 'PENDING' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/production/work-orders/${wo.id}/edit`);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Production Runs">
        <div className="flex gap-2">
          <Button onClick={() => navigate('/dashboard/production')} variant="outline">
            <TrendingUp className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button onClick={() => navigate('/production/work-orders/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Work Order
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="min-w-[220px] max-w-md flex-1"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search run number, order, customer, SPO, style, buyer style, location…"
              aria-label="Search production runs"
            />
            <Select
              value={statusFilter || 'ALL'}
              onValueChange={(value) => {
                setStatusFilter(value === 'ALL' ? '' : (value as OrderStatus));
                clearUrlFilters('status');
              }}
            >
              <SelectTrigger className="w-[180px]" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PRODUCTION">In Production</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="SPLIT">Split</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter || 'ALL'}
              onValueChange={(value) => setPriorityFilter(value === 'ALL' ? '' : (value as Priority))}
            >
              <SelectTrigger className="w-[160px]" aria-label="Priority">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <OrderCombobox
              value={orderIdFilter}
              onValueChange={(v) => {
                setOrderIdFilter(v || '');
                clearUrlFilters('orderId');
              }}
              allowAll
              allLabel="All orders"
              placeholder="All orders"
              className="w-[220px]"
            />
            <StyleCombobox
              value={styleFilter}
              onValueChange={(v) => setStyleFilter(v || '')}
              status={null}
              allowAll
              allLabel="All styles"
              placeholder="All styles"
              className="w-[220px]"
            />
            <WarehouseCombobox
              value={warehouseFilter}
              onValueChange={(v) => setWarehouseFilter(v || '')}
              allowAll
              allLabel="All locations"
              placeholder="All locations"
              className="w-[200px]"
            />
            {/* Dashboard drill-down (no backend param — filtered client-side): say so, and let it be removed */}
            {overdueOnly && (
              <Badge variant="destructive" className="h-9 gap-1 pl-3 pr-1 text-sm font-normal">
                Overdue only
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent hover:opacity-80"
                  aria-label="Remove the overdue filter"
                  onClick={() => {
                    setOverdueOnly(false);
                    clearUrlFilters('overdue');
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </Badge>
            )}
          </FilterBar>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={displayedWorkOrders}
          columns={columns}
          keyExtractor={(wo) => wo.id}
          loading={isLoading}
          error={error}
          emptyState={
            activeFilterCount > 0
              ? {
                  icon: <ClipboardList className="h-16 w-16" />,
                  title: 'No production runs match these filters.',
                  actionLabel: 'Clear filters',
                  onAction: clearFilters,
                }
              : {
                  icon: <ClipboardList className="h-16 w-16" />,
                  title: 'No production runs found',
                  description: 'Create a work order manually or start production from a sale order',
                }
          }
          onRowClick={(wo) => navigate(`/production/work-orders/${wo.id}`)}
        />
      </Card>

      {/* Summary */}
      {!isLoading && displayedWorkOrders.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {displayedWorkOrders.length} production run{displayedWorkOrders.length !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}
