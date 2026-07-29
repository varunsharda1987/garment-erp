// Stock Count List - View all physical inventory counts
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import stockCountService from '../services/stockCount.service';
import type { StockCount, CountStatus, CountType } from '../types/inventory.types';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function StockCountList() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<CountStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CountType | ''>('');

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter]);

  const loadCounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await stockCountService.getAll({
        status: statusFilter || undefined,
        countType: typeFilter || undefined,
      });
      setCounts(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load stock counts', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: CountStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary' as const;
      case 'IN_PROGRESS':
        return 'info' as const;
      case 'COUNTED':
        return 'info' as const;
      case 'VERIFIED':
        return 'warning' as const;
      case 'APPROVED':
        return 'success' as const;
      case 'CANCELLED':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getTypeVariant = (type: CountType) => {
    switch (type) {
      case 'FULL':
        return 'info' as const;
      case 'PARTIAL':
        return 'warning' as const;
      case 'CYCLE':
        return 'secondary' as const;
      case 'SPOT_CHECK':
        return 'secondary' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getProgressPercentage = (count: StockCount) => {
    if (count.totalItems === 0) return 0;
    return (count.countedItems / count.totalItems) * 100;
  };

  // Define columns for DataTable
  const columns: Column<StockCount>[] = [
    {
      key: 'countNumber',
      header: 'Count Number',
      render: (count) => <div className="font-medium text-foreground">{count.countNumber}</div>,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (count) => <div className="text-sm text-foreground">{count.warehouses?.warehouseName}</div>,
    },
    {
      key: 'countType',
      header: 'Type',
      render: (count) => <StatusBadge status={count.countType} variant={getTypeVariant(count.countType)} />,
    },
    {
      key: 'countDate',
      header: 'Count Date',
      render: (count) => (
        <div className="text-sm text-foreground">{new Date(count.countDate).toLocaleDateString()}</div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (count) => (
        <div className="flex items-center gap-2 min-w-[150px]">
          <Progress value={getProgressPercentage(count)} className="flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {count.countedItems}/{count.totalItems}
          </span>
        </div>
      ),
    },
    {
      key: 'varianceItems',
      header: 'Variance Items',
      render: (count) =>
        count.varianceItems > 0 ? (
          <StatusBadge status={count.varianceItems.toString()} variant="warning" />
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (count) => <StatusBadge status={count.status} variant={getStatusVariant(count.status)} />,
    },
  ];

  return (
    <>
      <PageHeader title="Stock Counts">
        <Button onClick={() => navigate('/inventory/stock-counts/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Stock Count
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label htmlFor="statusFilter">Status</Label>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => setStatusFilter(value === 'all' ? '' : (value as CountStatus))}
              >
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COUNTED">Counted</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="typeFilter">Count Type</Label>
              <Select
                value={typeFilter || 'all'}
                onValueChange={(value) => setTypeFilter(value === 'all' ? '' : (value as CountType))}
              >
                <SelectTrigger id="typeFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="FULL">Full</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="CYCLE">Cycle</SelectItem>
                  <SelectItem value="SPOT_CHECK">Spot Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={counts}
          columns={columns}
          keyExtractor={(count) => count.id}
          loading={loading}
          error={error}
          onRowClick={(count) => navigate(`/inventory/stock-counts/${count.id}`)}
          emptyState={{
            icon: <ClipboardList className="h-16 w-16" />,
            title: 'No stock counts found',
            description:
              statusFilter || typeFilter
                ? 'Try adjusting your filter criteria'
                : 'Create your first stock count to get started',
            actionLabel: !statusFilter && !typeFilter ? 'Create First Stock Count' : undefined,
            onAction: !statusFilter && !typeFilter ? () => navigate('/inventory/stock-counts/new') : undefined,
          }}
        />
      </Card>

      {/* Summary */}
      {!loading && counts.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {counts.length} stock count{counts.length !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}
