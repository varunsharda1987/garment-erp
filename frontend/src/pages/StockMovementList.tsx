// Stock Movement List - Unified view of all material movements
import { unitShort } from '@/lib/units';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, ArrowDown, ArrowUp, ArrowLeftRight, Package, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import { FilterBar, DateRangeFilter, type DateRangeValue } from '@/components/filters';
import DataTable from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import stockMovementService, { type UnifiedMovement } from '../services/stockMovement.service';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { formatDate } from '@/lib/date';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type DirectionFilter = 'ALL' | 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT';

export default function StockMovementList() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<UnifiedMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  // Filters (the direction tabs are a view, not a filter — Clear keeps them)
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');

  const toFirstPage = () => setPagination((p) => ({ ...p, page: 1 }));
  const activeFilterCount = [search, supplierId, dateRange.from || dateRange.to].filter(Boolean).length;
  const clearFilters = () => {
    setSearch('');
    setSupplierId('');
    setDateRange({ from: '', to: '' });
    toFirstPage();
  };

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionFilter, dateRange, search, supplierId, pagination.page, pagination.limit]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await stockMovementService.getUnifiedMovements({
        direction: directionFilter === 'ALL' ? undefined : directionFilter,
        // Whole days in IST: movements carry a time, so a bare "to" date (midnight UTC) dropped that day's
        // movements after 05:30. The picked yyyy-MM-dd values themselves are never reformatted.
        dateFrom: dateRange.from ? `${dateRange.from}T00:00:00+05:30` : undefined,
        dateTo: dateRange.to ? `${dateRange.to}T23:59:59.999+05:30` : undefined,
        search: search || undefined,
        supplierId: supplierId || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      setMovements(result.data);
      setPagination(result.pagination);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load movements', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getDirectionIcon = (direction: UnifiedMovement['direction']) => {
    switch (direction) {
      case 'INWARD':
        return <ArrowDown className="h-3 w-3 text-green-600" />;
      case 'OUTWARD':
        return <ArrowUp className="h-3 w-3 text-red-600" />;
      case 'TRANSFER':
        return <ArrowLeftRight className="h-3 w-3 text-blue-600" />;
      default:
        return <Package className="h-3 w-3 text-yellow-600" />;
    }
  };

  const getDirectionVariant = (direction: UnifiedMovement['direction']) => {
    switch (direction) {
      case 'INWARD':
        return 'success' as const;
      case 'OUTWARD':
        return 'destructive' as const;
      case 'TRANSFER':
        return 'info' as const;
      default:
        return 'warning' as const;
    }
  };

  const getSourceLink = (mov: UnifiedMovement): string | null => {
    switch (mov.sourceType) {
      case 'GRN':
        return `/procurement/grn/${mov.sourceId}`;
      case 'CHALLAN':
        return `/manufacturing/challans/${mov.sourceId}`;
      case 'GREIGE_STOCK':
        return `/greige-stock`;
      // PROCUREMENT: no fabric-procurement detail route exists yet — render as plain text (B07-11)
      default:
        return null;
    }
  };

  const columns: Column<UnifiedMovement>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (mov) => <div className="text-sm text-foreground">{formatDate(new Date(mov.date))}</div>,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (mov) => (
        <div className="flex items-center gap-1">
          {getDirectionIcon(mov.direction)}
          <StatusBadge status={mov.direction} variant={getDirectionVariant(mov.direction)} />
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier/Party',
      render: (mov) => (
        <div className="text-sm text-foreground">
          {mov.supplierName ? (
            <>
              <div className="font-medium">{mov.supplierCode || ''}</div>
              <div className="text-xs text-muted-foreground">{mov.supplierName}</div>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material',
      render: (mov) => (
        <div>
          {mov.materialId ? (
            <Link
              to={`/inventory/material-ledger?materialId=${mov.materialId}`}
              className="text-sm font-medium text-foreground hover:underline"
              title="Open this material's ledger"
            >
              {mov.materialCode}
            </Link>
          ) : (
            <div className="text-sm font-medium text-foreground">{mov.materialCode}</div>
          )}
          <div className="text-xs text-muted-foreground">{mov.materialName}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (mov) => {
        const isInbound = mov.direction === 'INWARD';
        return (
          <div className={`font-medium ${isInbound ? 'text-green-600' : 'text-red-600'}`}>
            {isInbound ? '+' : '-'}
            {mov.quantity.toFixed(2)} {unitShort(mov.unit)}
          </div>
        );
      },
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice#',
      render: (mov) => (
        <div className="text-sm text-foreground">
          {mov.invoiceNumber ? (
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{mov.invoiceNumber}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (mov) => (
        <div className="text-sm text-foreground">{mov.rate !== null ? `Rs ${mov.rate.toFixed(2)}` : '-'}</div>
      ),
    },
    {
      key: 'totalValue',
      header: 'Value',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (mov) => (
        <div className="text-sm font-medium text-foreground">
          {mov.totalValue !== null ? `Rs ${mov.totalValue.toFixed(2)}` : '-'}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source Doc',
      render: (mov) => {
        const link = getSourceLink(mov);
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{mov.sourceType}</span>
            </div>
            {link ? (
              <Link to={link} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                {mov.sourceNumber}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">{mov.sourceNumber}</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Material Movements (Unified View)">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Movement
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/stock-in')}>
              Stock IN (Receipt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/stock-out')}>
              Stock OUT (Issue)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/transfer')}>Transfer</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/inventory/movements/adjustment')}>Adjustment</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Direction Tabs */}
      <Tabs
        value={directionFilter}
        onValueChange={(v) => {
          setDirectionFilter(v as DirectionFilter);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="INWARD" className="text-green-600">
            <ArrowDown className="h-3 w-3 mr-1" /> Inward
          </TabsTrigger>
          <TabsTrigger value="OUTWARD" className="text-red-600">
            <ArrowUp className="h-3 w-3 mr-1" /> Outward
          </TabsTrigger>
          <TabsTrigger value="TRANSFER" className="text-blue-600">
            <ArrowLeftRight className="h-3 w-3 mr-1" /> Transfer
          </TabsTrigger>
          <TabsTrigger value="ADJUSTMENT" className="text-yellow-600">
            Adjustment
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="flex-1 min-w-[240px]"
              placeholder="Search material, supplier / party, invoice or document number..."
              value={search}
              onChange={(v) => {
                setSearch(v);
                toFirstPage();
              }}
            />
            <SupplierCombobox
              value={supplierId}
              onValueChange={(v) => {
                setSupplierId(v);
                toFirstPage();
              }}
              placeholder="All suppliers"
              allowAll
              allLabel="All suppliers"
              className="w-[220px]"
            />
            <DateRangeFilter
              label="Date"
              from={dateRange.from}
              to={dateRange.to}
              onChange={(range) => {
                setDateRange(range);
                toFirstPage();
              }}
            />
          </FilterBar>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={movements}
          columns={columns}
          keyExtractor={(mov) => mov.id}
          loading={loading}
          error={error}
          emptyState={
            activeFilterCount > 0
              ? {
                  icon: <Package className="h-16 w-16" />,
                  title: 'No movements match these filters.',
                  actionLabel: 'Clear filters',
                  onAction: clearFilters,
                }
              : {
                  icon: <Package className="h-16 w-16" />,
                  title: 'No movements found',
                  description:
                    directionFilter !== 'ALL' ? 'Nothing in this direction yet' : 'Material movements will appear here',
                }
          }
        />
      </Card>

      {/* Pagination */}
      {!loading && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.limit}
          totalItems={pagination.total}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          onPageSizeChange={(limit) => setPagination((p) => ({ ...p, page: 1, limit }))}
          pageSizeOptions={[20, 50, 100]}
          itemLabel="movements"
        />
      )}
    </>
  );
}
