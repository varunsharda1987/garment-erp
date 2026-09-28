// Stock Level List - View all stock levels
import { unitShort } from '@/lib/units';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, TrendingDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { matchesSearch } from '@/hooks/usePickerOptions';
import { handleApiError } from '@/lib/api-error-handler';
import { formatMaterialType } from '@/lib/formatters';
import { MaterialTypeLabels } from '@/types/material.types';
import stockLevelService from '../services/stockLevel.service';
import type { StockLevel } from '../types/inventory-exports';

/** At or below its reorder level — the same test as the API's low-stock list */
const isBelowReorder = (stock: StockLevel) =>
  stock.reorderLevel != null && Number(stock.quantity) <= Number(stock.reorderLevel);

/** What the table shows, for the search: material code and name, warehouse code and name */
const searchText = (stock: StockLevel) =>
  `${stock.materials?.code ?? ''} ${stock.materials?.name ?? ''} ${stock.warehouses?.warehouseCode ?? ''} ${stock.warehouses?.warehouseName ?? ''}`;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // '' = all types; kept in the URL (?materialType=) so a link can open one type
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [materialTypeFilter, setMaterialTypeFilter] = useState(searchParams.get('materialType') || '');

  const materialTypeOptions: ComboboxOption[] = useMemo(
    () => [
      { value: '', label: 'All material types', searchText: 'All material types' },
      ...Object.entries(MaterialTypeLabels)
        .sort(([, a], [, b]) => a.localeCompare(b))
        .map(([value, label]) => ({ value, label })),
    ],
    []
  );

  const changeMaterialType = (value: string) => {
    setMaterialTypeFilter(value);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('materialType', value);
        else next.delete('materialType');
        return next;
      },
      { replace: true }
    );
  };

  const activeFilterCount = [searchTerm, materialTypeFilter, warehouseFilter, showLowStockOnly].filter(Boolean).length;
  const clearFilters = () => {
    setSearchTerm('');
    setWarehouseFilter('');
    setShowLowStockOnly(false);
    changeMaterialType('');
  };

  useEffect(() => {
    loadStockLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseFilter, showLowStockOnly, searchTerm, materialTypeFilter]);

  const loadStockLevels = async () => {
    try {
      setLoading(true);
      setError(null);
      let data: StockLevel[];
      if (materialTypeFilter) {
        data = await stockLevelService.getByMaterialType(materialTypeFilter);
      } else if (showLowStockOnly) {
        data = await stockLevelService.getBelowReorderLevel(warehouseFilter || undefined);
      } else {
        data = await stockLevelService.getAll({
          warehouseId: warehouseFilter || undefined,
          search: searchTerm || undefined,
        });
      }
      // The type and low-stock lists take no search (and the type list no warehouse or low-stock either), so
      // every filter is applied here too — combining two used to drop one of them without a word
      data = data.filter(
        (sl) =>
          (!warehouseFilter || sl.warehouseId === warehouseFilter) &&
          (!showLowStockOnly || isBelowReorder(sl)) &&
          matchesSearch(searchText(sl), searchTerm)
      );
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
      render: (stock) =>
        stock.materialId ? (
          // "Why is this figure what it is" is one click away: the ledger for this material in
          // this warehouse shows every receipt and issue behind the number on this row.
          <Link
            to={`/inventory/material-ledger?materialId=${stock.materialId}${stock.warehouseId ? `&warehouseId=${stock.warehouseId}` : ''}`}
            className="font-medium text-foreground hover:underline"
            title="Open this material's ledger"
          >
            {stock.materials?.code}
          </Link>
        ) : (
          <div className="font-medium text-foreground">{stock.materials?.code}</div>
        ),
    },
    {
      key: 'name',
      header: 'Material Name',
      render: (stock) => <div className="text-sm text-foreground">{stock.materials?.name}</div>,
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
          <div className="text-sm text-foreground">{stock.warehouses?.warehouseCode}</div>
          <div className="text-xs text-muted-foreground">{stock.warehouses?.warehouseName}</div>
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
          <div className={`font-medium ${isLow ? 'text-destructive' : 'text-foreground'}`}>
            {Number(stock.quantity).toFixed(2)} {unitShort(stock.unit)}
          </div>
        );
      },
    },
    {
      key: 'valuationRate',
      header: 'Valuation Rate',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => <div className="text-sm text-foreground">₹{Number(stock.valuationRate).toFixed(2)}</div>,
    },
    {
      key: 'stockValue',
      header: 'Stock Value',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => (
        <div className="font-medium text-foreground">₹{Number(stock.stockValue).toLocaleString('en-IN')}</div>
      ),
    },
    {
      key: 'reorderLevel',
      header: 'Reorder Level',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (stock) => (
        <div className="text-sm text-foreground">
          {stock.reorderLevel ? Number(stock.reorderLevel).toFixed(2) : '-'}
        </div>
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
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <StatusBadge status={status.label} variant={status.variant} />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Stock Levels" />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="flex-1 min-w-[220px]"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search material code or name, warehouse..."
              // The API refuses a longer search (stockLevelQuerySchema: max 100)
              maxLength={100}
            />
            <Combobox
              options={materialTypeOptions}
              value={materialTypeFilter}
              onValueChange={changeMaterialType}
              placeholder="All material types"
              searchPlaceholder="Material type..."
              emptyText="No material type matches"
              className="w-[200px]"
            />
            <WarehouseCombobox
              value={warehouseFilter}
              onValueChange={setWarehouseFilter}
              allowAll
              placeholder="All warehouses"
              className="w-[220px]"
            />
            <Button
              variant={showLowStockOnly ? 'default' : 'outline'}
              aria-pressed={showLowStockOnly}
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Low stock only
            </Button>
          </FilterBar>
        </CardContent>
      </Card>

      {/* DataTable */}
      <Card>
        <DataTable
          data={stockLevels}
          columns={columns}
          // The type and low-stock lists send no id — key those rows by material + warehouse, as the API does
          keyExtractor={(stock) => stock.id || `${stock.materialId}_${stock.warehouseId}`}
          loading={loading}
          error={error}
          emptyState={
            activeFilterCount > 0
              ? {
                  icon: <Package className="h-16 w-16" />,
                  title: 'No stock levels match these filters.',
                  description: showLowStockOnly ? 'Nothing here is at or below its reorder level.' : undefined,
                  actionLabel: 'Clear filters',
                  onAction: clearFilters,
                }
              : {
                  icon: <Package className="h-16 w-16" />,
                  title: 'No stock levels found',
                  description: 'Stock levels will appear here once materials are added to warehouses',
                }
          }
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
