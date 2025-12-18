import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { productionStatusService } from '@/services/productionStatus.service';
import type {
  ProductionStatusItem,
  ProductionStatusSummary,
  StatusFilter,
} from '@/types/productionStatus.types';
import type { ProductionStage } from '@/types/style.types';
import StatusSummaryCards from '@/components/status/StatusSummaryCards';
import StatusFilterBar from '@/components/status/StatusFilterBar';
import StatusListItem from '@/components/status/StatusListItem';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FilterState {
  status?: StatusFilter;
  stage?: ProductionStage;
  cadStatus?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  brand?: string;
  customer?: string;
}

export default function ProductionStatus() {
  const [items, setItems] = useState<ProductionStatusItem[]>([]);
  const [summary, setSummary] = useState<ProductionStatusSummary | null>(null);
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

  const [sortBy, setSortBy] = useState<'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue'>('orderDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
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

      setItems(result.data);
      setSummary(result.summary);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch (error) {
      console.error('Failed to load production status:', error);
      toast.error('Failed to load production status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, filters, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, sortBy, sortOrder]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Production Status Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor all running styles, track progress, and identify blockers
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <StatusSummaryCards summary={summary} loading={loading} />

      {/* Filters */}
      <StatusFilterBar
        search={search}
        setSearch={setSearch}
        filters={filters}
        setFilters={setFilters}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {/* Results Count */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {items.length === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} styles
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
          <p className="text-gray-600 text-lg">No styles found matching your filters.</p>
          <p className="text-gray-500 text-sm mt-2">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Status List */}
      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <StatusListItem key={item.styleId} item={item} />
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
