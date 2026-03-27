// Stock Level List - View all stock levels
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, TrendingDown, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError } from '@/lib/api-error-handler';
import { formatMaterialType } from '@/lib/formatters';
import stockLevelService from '../services/stockLevel.service';
import warehouseService from '../services/warehouse.service';
import type { StockLevel } from '../types/inventory-exports';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function StockLevelList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; warehouseCode: string; warehouseName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialMaterialType = searchParams.get('materialType') || 'all';
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [materialTypeFilter, setMaterialTypeFilter] = useState(initialMaterialType);

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadStockLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseFilter, showLowStockOnly, searchTerm, materialTypeFilter]);

  const loadWarehouses = async () => {
    try {
      const data = await warehouseService.getAll({ isActive: true });
      setWarehouses(data);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to load warehouses', false);
    }
  };

  const loadStockLevels = async () => {
    try {
      setLoading(true);
      setError(null);
      let data;
      if (materialTypeFilter && materialTypeFilter !== 'all') {
        // Filter by material type
        data = await stockLevelService.getByMaterialType(materialTypeFilter);
        // Apply warehouse filter client-side if needed
        if (warehouseFilter && warehouseFilter !== 'all') {
          data = data.filter((sl: StockLevel) => sl.warehouseId === warehouseFilter);
        }
        // Apply search filter client-side if needed
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          data = data.filter(
            (sl: StockLevel) =>
              sl.materials?.code?.toLowerCase().includes(search) || sl.materials?.name?.toLowerCase().includes(search)
          );
        }
      } else if (showLowStockOnly) {
        data = await stockLevelService.getBelowReorderLevel(warehouseFilter !== 'all' ? warehouseFilter : undefined);
      } else {
        data = await stockLevelService.getAll({
          warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
          search: searchTerm || undefined,
        });
      }
      setStockLevels(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load stock levels', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (stock: StockLevel) => {
    if (!stock.minStockLevel && !stock.reorderLevel) return { label: 'Normal', variant: 'secondary' as const };

    const qty = Number(stock.quantity);
    if (stock.minStockLevel && qty < Number(stock.minStockLevel)) {
      return { label: 'Critical', variant: 'destructive' as const };
    }
    if (stock.reorderLevel && qty <= Number(stock.reorderLevel)) {
      return { label: 'Low Stock', variant: 'warning' as const };
    }
    if (stock.maxStockLevel && qty > Number(stock.maxStockLevel)) {
      return { label: 'Overstock', variant: 'info' as const };
    }
    return { label: 'Normal', variant: 'success' as const };
  };

  // Define columns for DataTable
  const columns: Column<StockLevel>[] = [
    {
      key: 'code',
      header: 'Material Code',
      render: (stock) => <div className="font-medium text-gray-900">{stock.materials?.code}</div>,
    },
    {
      key: 'name',
      header: 'Material Name',
      render: (stock) => <div className="text-sm text-gray-900">{stock.materials?.name}</div>,
    },
    {
      key: 'materialType',
      header: 'Type',
      render: (stock) => <Badge variant="outline">{formatMaterialType(stock.materials?.materialType || '')}</Badge>,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (stock) => (
        <div>
          <div className="text-sm text-gray-900">{stock.warehouses?.warehouseCode}</div>
          <div className="text-xs text-gray-500">{stock.warehouses?.warehouseName}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Current Stock',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => {
        const status = getStockStatus(stock);
        const isLow = status.variant === 'destructive' || status.variant === 'warning';
        return (
          <div className={`font-medium ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
            {Number(stock.quantity).toFixed(2)} {stock.unit}
          </div>
        );
      },
    },
    {
      key: 'valuationRate',
      header: 'Valuation Rate',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => <div className="text-sm text-gray-900">₹{Number(stock.valuationRate).toFixed(2)}</div>,
    },
    {
      key: 'stockValue',
      header: 'Stock Value',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => (
        <div className="font-medium text-gray-900">₹{Number(stock.stockValue).toLocaleString('en-IN')}</div>
      ),
    },
    {
      key: 'reorderLevel',
      header: 'Reorder Level',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => (
        <div className="text-sm text-gray-700">{stock.reorderLevel ? Number(stock.reorderLevel).toFixed(2) : '-'}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (stock) => {
        const status = getStockStatus(stock);
        return (
          <div className="flex items-center gap-1">
            {(status.variant === 'destructive' || status.variant === 'warning') && (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <StatusBadge status={status.label} variant={status.variant} />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Stock Levels">
        <Button
          variant={showLowStockOnly ? 'default' : 'outline'}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Low Stock Only
        </Button>
      </PageHeader>

      {/* Filtered State Indicator */}
      {materialTypeFilter && materialTypeFilter !== 'all' && (
        <Alert className="mb-4">
          <Package className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Showing stock for:{' '}
              <Badge variant="secondary" className="ml-2">
                {formatMaterialType(materialTypeFilter)}
              </Badge>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMaterialTypeFilter('all');
                setSearchParams({});
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear filter
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search Material</Label>
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search materials..." />
            </div>
            <div className="w-64">
              <Label htmlFor="materialTypeFilter">Material Type</Label>
              <Select
                value={materialTypeFilter}
                onValueChange={(value) => {
                  setMaterialTypeFilter(value);
                  setSearchParams(value !== 'all' ? { materialType: value } : {});
                }}
              >
                <SelectTrigger id="materialTypeFilter">
                  <SelectValue placeholder="All Material Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Material Types</SelectItem>
                  <SelectItem value="THREAD">Thread</SelectItem>
                  <SelectItem value="BUTTON">Button</SelectItem>
                  <SelectItem value="ZIPPER">Zipper</SelectItem>
                  <SelectItem value="ELASTIC">Elastic</SelectItem>
                  <SelectItem value="LACE">Lace</SelectItem>
                  <SelectItem value="LABEL">Label</SelectItem>
                  <SelectItem value="PACKAGING">Packaging</SelectItem>
                  <SelectItem value="MACHINE_PART">Machine Parts</SelectItem>
                  <SelectItem value="OTHER">Other Materials</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <Label htmlFor="warehouseFilter">Warehouse</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger id="warehouseFilter">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.warehouseCode} - {wh.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={stockLevels}
          columns={columns}
          keyExtractor={(stock) => stock.id}
          loading={loading}
          error={error}
          emptyState={{
            icon: <Package className="h-16 w-16" />,
            title: showLowStockOnly ? 'No low stock items' : 'No stock levels found',
            description:
              searchTerm || warehouseFilter
                ? 'Try adjusting your search or filter criteria'
                : showLowStockOnly
                  ? 'All materials are adequately stocked'
                  : 'Stock levels will appear here once materials are added to warehouses',
          }}
        />
      </Card>

      {/* Summary */}
      {!loading && stockLevels.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {stockLevels.length} stock level{stockLevels.length !== 1 ? 's' : ''}
          {showLowStockOnly && ' (low stock items only)'}
        </div>
      )}
    </>
  );
}
