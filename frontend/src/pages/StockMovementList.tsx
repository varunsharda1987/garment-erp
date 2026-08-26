// Stock Movement List - Unified view of all material movements
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, ArrowDown, ArrowUp, ArrowLeftRight, Package, Search, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import stockMovementService, { type UnifiedMovement } from '../services/stockMovement.service';
import { SupplierCombobox } from '@/components/SupplierCombobox';

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

  // Filters
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionFilter, startDate, endDate, invoiceSearch, materialSearch, supplierId, pagination.page]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await stockMovementService.getUnifiedMovements({
        direction: directionFilter === 'ALL' ? undefined : directionFilter,
        dateFrom: startDate || undefined,
        dateTo: endDate || undefined,
        invoiceNumber: invoiceSearch || undefined,
        search: materialSearch || undefined,
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
      render: (mov) => <div className="text-sm text-foreground">{new Date(mov.date).toLocaleDateString()}</div>,
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
          <div className="text-sm font-medium text-foreground">{mov.materialCode}</div>
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
            {mov.quantity.toFixed(2)} {mov.unit}
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
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label htmlFor="supplierFilter">Supplier</Label>
              <SupplierCombobox
                value={supplierId}
                onValueChange={(v) => {
                  setSupplierId(v);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                placeholder="All Suppliers"
                allowAll
              />
            </div>
            <div className="w-40">
              <Label htmlFor="invoiceSearch">Invoice#</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invoiceSearch"
                  placeholder="Search..."
                  className="pl-8"
                  value={invoiceSearch}
                  onChange={(e) => {
                    setInvoiceSearch(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="materialSearch">Material</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="materialSearch"
                  placeholder="Name or code..."
                  className="pl-8"
                  value={materialSearch}
                  onChange={(e) => {
                    setMaterialSearch(e.target.value);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                />
              </div>
            </div>
            <div className="w-40">
              <Label htmlFor="startDate">From Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
            <div className="w-40">
              <Label htmlFor="endDate">To Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
          </div>
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
          emptyState={{
            icon: <Package className="h-16 w-16" />,
            title: 'No movements found',
            description:
              directionFilter !== 'ALL' || startDate || endDate || invoiceSearch || materialSearch
                ? 'Try adjusting your filter criteria'
                : 'Material movements will appear here',
          }}
        />
      </Card>

      {/* Pagination */}
      {!loading && pagination.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} movements
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
