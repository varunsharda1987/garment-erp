import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Edit, Eye, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import type { WorkOrder, OrderStatus, Priority } from '@/types/production.types';
import { ClipboardList } from 'lucide-react';

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
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    loadWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, searchQuery, orderIdFilter]);

  const loadWorkOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await workOrderService.getAll({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchQuery || undefined,
        orderId: orderIdFilter || undefined,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateProgress = (workOrder: WorkOrder) => {
    if (workOrder.totalQuantity === 0) return 0;
    return Math.round((workOrder.completedQuantity / workOrder.totalQuantity) * 100);
  };

  const isOverdue = (wo: WorkOrder) =>
    !!wo.plannedEndDate &&
    new Date(wo.plannedEndDate) < new Date() &&
    !['COMPLETED', 'DISPATCHED', 'CANCELLED'].includes(wo.status);

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
      key: 'location',
      header: 'Location',
      render: (wo) => (
        <div className="text-sm text-foreground">
          {wo.warehouses?.warehouseName || <span className="text-warning">Not Assigned</span>}
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
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <TrendingUp className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </PageHeader>

      {/* Active drill-down filter indicators */}
      {(overdueOnly || orderIdFilter) && (
        <div className="mb-4 flex items-center gap-2">
          {overdueOnly && (
            <Badge variant="destructive" className="gap-1">
              Overdue only
              <button
                type="button"
                onClick={() => setOverdueOnly(false)}
                className="ml-1 hover:opacity-80"
                aria-label="Clear overdue filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {orderIdFilter && (
            <Badge variant="secondary" className="gap-1">
              Order: {workOrders.find((wo) => wo.orders)?.orders?.orderNumber || orderIdFilter}
              <button
                type="button"
                onClick={() => setOrderIdFilter('')}
                className="ml-1 hover:opacity-80"
                aria-label="Clear order filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by work order, style code..."
              />
            </div>
            <div className="w-40">
              <Label htmlFor="statusFilter">Status</Label>
              <Select
                value={statusFilter || 'ALL'}
                onValueChange={(value) => setStatusFilter(value === 'ALL' ? '' : (value as OrderStatus))}
              >
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PRODUCTION">In Production</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label htmlFor="priorityFilter">Priority</Label>
              <Select
                value={priorityFilter || 'ALL'}
                onValueChange={(value) => setPriorityFilter(value === 'ALL' ? '' : (value as Priority))}
              >
                <SelectTrigger id="priorityFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
          emptyState={{
            icon: <ClipboardList className="h-16 w-16" />,
            title: 'No production runs found',
            description:
              searchQuery || statusFilter || priorityFilter || overdueOnly || orderIdFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Production runs are auto-created when orders are saved',
          }}
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
