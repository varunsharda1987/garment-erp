import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { productionStatusService } from '@/services/productionStatus.service';
import { orderProductionStatusService } from '@/services/orderProductionStatus.service';
import type { ProductionStatusItem, ProductionStatusSummary, StatusFilter } from '@/types/productionStatus.types';
import type { OrderStatusItem, OrderStatusSummary } from '@/types/orderProductionStatus.types';
import type { ProductionStage } from '@/types/style.types';
import StatusSummaryCards from '@/components/status/StatusSummaryCards';
import StatusFilterBar from '@/components/status/StatusFilterBar';
import StatusListItem from '@/components/status/StatusListItem';
import OrderStatusListItem from '@/components/status/OrderStatusListItem';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Loader2, Layers, ShoppingCart, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type ViewMode = 'style' | 'order';

interface FilterState {
  status?: StatusFilter;
  stage?: ProductionStage;
  cadStatus?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  brand?: string;
  customer?: string;
}

export default function ProductionStatus() {
  // View mode - default to order-centric
  const [viewMode, setViewMode] = useState<ViewMode>('order');

  // Style-centric data
  const [styleItems, setStyleItems] = useState<ProductionStatusItem[]>([]);
  const [styleSummary, setStyleSummary] = useState<ProductionStatusSummary | null>(null);

  // Order-centric data
  const [orderItems, setOrderItems] = useState<OrderStatusItem[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderStatusSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
  });

  const [sortBy, setSortBy] = useState<'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue'>(
    'orderDate'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStyleData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await productionStatusService.getAll({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        brand: filters.brand,
        customer: filters.customer,
        status: filters.status !== 'all' ? filters.status : undefined,
        stage: filters.stage,
        cadStatus: filters.cadStatus,
        sortBy,
        sortOrder,
      });

      setStyleItems(result.data);
      setStyleSummary(result.summary);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load production status:', error);
      toast.error('Failed to load production status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, filters, sortBy, sortOrder]);

  const fetchOrderData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await orderProductionStatusService.getOrderStatusList({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        brand: filters.brand,
        customer: filters.customer,
        status: filters.status !== 'all' ? filters.status : undefined,
        stage: filters.stage,
        cadStatus: filters.cadStatus as 'PENDING' | 'SELECTED' | 'APPROVED' | undefined,
        sortBy,
        sortOrder,
      });

      setOrderItems(result.data);
      setOrderSummary(result.summary);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load order production status:', error);
      toast.error('Failed to load order status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, filters, sortBy, sortOrder]);

  useEffect(() => {
    if (viewMode === 'style') {
      fetchStyleData();
    } else {
      fetchOrderData();
    }
  }, [viewMode, fetchStyleData, fetchOrderData]);

  // Reset to page 1 when filters or view mode change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, sortBy, sortOrder, viewMode]);

  // CAD selection handler for order items
  const handleSelectCad = async (orderItemId: string, cadId: string, recalculate: boolean) => {
    try {
      await orderProductionStatusService.selectCadForOrder(orderItemId, {
        cadId,
        recalculateCosting: recalculate,
      });
      toast.success('CAD width selected and costing recalculated');
      fetchOrderData(); // Refresh data
    } catch (error) {
      console.error('Failed to select CAD:', error);
      toast.error('Failed to select CAD width');
    }
  };

  // Inheritance update handler
  const handleUpdateInheritance = async (
    orderItemId: string,
    data: { inheritStyleSamples?: boolean; inheritInspections?: boolean }
  ) => {
    try {
      await orderProductionStatusService.updateInheritance(orderItemId, data);
      toast.success('Inheritance settings updated');
      fetchOrderData(); // Refresh data
    } catch (error) {
      console.error('Failed to update inheritance:', error);
      toast.error('Failed to update inheritance settings');
    }
  };

  // Recalculate costing handler
  const handleRecalculateCosting = async (orderItemId: string) => {
    try {
      await orderProductionStatusService.recalculateOrderCosting(orderItemId);
      toast.success('Costing recalculated');
      fetchOrderData(); // Refresh data
    } catch (error) {
      console.error('Failed to recalculate costing:', error);
      toast.error('Failed to recalculate costing');
    }
  };

  // Refresh handler
  const handleRefresh = useCallback(() => {
    if (viewMode === 'style') {
      fetchStyleData();
    } else {
      fetchOrderData();
    }
  }, [viewMode, fetchStyleData, fetchOrderData]);

  // Get current items and summary based on view mode
  const items = viewMode === 'style' ? styleItems : orderItems;
  const summary = viewMode === 'style' ? styleSummary : orderSummary;

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Production Status Dashboard</h1>
          <p className="text-gray-600 mt-1">
            {viewMode === 'order'
              ? 'Monitor all orders, track progress, and manage CAD widths per order'
              : 'Monitor all running styles, track progress, and identify blockers'}
          </p>
        </div>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="grid w-[280px] grid-cols-2">
            <TabsTrigger value="order" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              By Order
            </TabsTrigger>
            <TabsTrigger value="style" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              By Style
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Last Updated & Refresh */}
      {!loading && (
        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <StatusSummaryCards summary={summary} loading={loading} />

      {/* Filters */}
      <StatusFilterBar
        search={search}
        setSearch={setSearch}
        filters={filters}
        setFilters={setFilters}
        sortBy={sortBy}
        setSortBy={(value: string) => setSortBy(value as typeof sortBy)}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {/* Results Count */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {items.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{' '}
            {total} {viewMode === 'order' ? 'orders' : 'styles'}
          </div>
          <div>
            Page {page} of {totalPages}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading production status...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600 text-lg">
            No {viewMode === 'order' ? 'orders' : 'styles'} found matching your filters.
          </p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Status List - Style View */}
      {!loading && items.length > 0 && viewMode === 'style' && (
        <div className="space-y-4">
          {styleItems.map((item) => (
            <StatusListItem key={item.styleId} item={item} />
          ))}
        </div>
      )}

      {/* Status List - Order View */}
      {!loading && items.length > 0 && viewMode === 'order' && (
        <div className="space-y-4">
          {orderItems.map((item) => (
            <OrderStatusListItem
              key={item.orderItemId}
              item={item}
              onSelectCad={handleSelectCad}
              onUpdateInheritance={handleUpdateInheritance}
              onRecalculateCosting={handleRecalculateCosting}
              onRefresh={handleRefresh}
              latestWorkOrderId={item.latestWorkOrderId || undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            disabled={page === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {/* Show page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setPage(pageNum);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={page === totalPages}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
