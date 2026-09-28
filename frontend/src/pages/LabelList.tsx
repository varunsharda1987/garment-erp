import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllLabels, deleteLabel } from '@/services/label.service';
import type { Label } from '@/types/label.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { Package } from 'lucide-react';
import { ViewStockButton } from '@/components/ViewStockButton';
import stockLevelService from '@/services/stockLevel.service';
import { compareSizes } from '@/utils/sku-generator';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function LabelList() {
  const navigate = useNavigate();
  const [labelItems, setLabelItems] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [customerId, setCustomerId] = useState<string>('');
  const [labelCategory, setLabelCategory] = useState<string>('');
  const [supplierId, setSupplierId] = useState('');

  // Stock count state
  const [stockCount, setStockCount] = useState<number | undefined>(undefined);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchLabelItems();
    fetchStockCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, customerId, labelCategory, supplierId]);

  const fetchStockCount = async () => {
    try {
      const stockLevels = await stockLevelService.getByMaterialType('LABEL');
      setStockCount(stockLevels.length);
    } catch {
      // Silently fail - stock count is not critical
      setStockCount(undefined);
    }
  };

  const fetchLabelItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllLabels({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        customerId: customerId || undefined,
        labelCategory: labelCategory || undefined,
        supplierId: supplierId || undefined,
      });
      setLabelItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load label items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCustomerId('');
    setLabelCategory('');
    setSupplierId('');
    setCurrentPage(1);
  };

  const activeFilterCount = [searchQuery, customerId, labelCategory, supplierId].filter(Boolean).length;

  const handleDeleteClick = (id: string, name: string) => {
    setLabelToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!labelToDelete) return;

    try {
      await deleteLabel(labelToDelete.id);
      handleApiSuccess('Label deleted', `${labelToDelete.name} has been successfully deleted.`);
      fetchLabelItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete label');
    } finally {
      setLabelToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<Label>[] = [
    {
      key: 'labelCode',
      header: 'Code',
      render: (label) => (
        <Badge variant="outline" className="font-mono text-xs">
          {label.labelCode}
        </Badge>
      ),
    },
    {
      key: 'labelName',
      header: 'Label Name',
      render: (label) => (
        <div>
          <div className="text-sm font-medium text-foreground">{label.labelName}</div>
          {label.description && <div className="text-xs text-muted-foreground line-clamp-1">{label.description}</div>}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (label) => (
        <div className="text-sm text-foreground">
          {label.customer ? (
            <span className="font-medium">{label.customer.name}</span>
          ) : (
            <span className="text-muted-foreground italic">Generic</span>
          )}
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (label) => (
        <div className="text-sm text-foreground">
          {label.brandCategory ? (
            <div>
              <div className="font-medium">{label.brandCategory.brandName}</div>
              {label.brandCategory.category && (
                <div className="text-xs text-muted-foreground">{label.brandCategory.category}</div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground italic">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'labelType',
      header: 'Type',
      render: (label) => <div className="text-sm text-foreground">{label.labelType || '-'}</div>,
    },
    {
      key: 'size',
      header: 'Size / Stock',
      render: (label) => (
        <div className="text-sm text-foreground">
          {label.sizeVariants && label.sizeVariants.length > 0 ? (
            <div>
              <div className="flex flex-wrap gap-1">
                {/* Every size, in size order — a sized label is ordered and stocked as its whole size set */}
                {[...label.sizeVariants]
                  .sort((a, b) => compareSizes(a.size, b.size))
                  .map((variant) => {
                    const totalStock =
                      variant.material?.stockLevels?.reduce(
                        (sum: number, level: { quantity: number }) => sum + Number(level.quantity),
                        0
                      ) || 0;
                    return (
                      <Badge
                        key={variant.id}
                        variant={totalStock > 0 ? 'default' : 'outline'}
                        className="text-xs"
                        title={`${variant.size}: ${totalStock} pcs in stock`}
                      >
                        {variant.size} ({totalStock})
                      </Badge>
                    );
                  })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{label.sizeVariants.length} sizes</div>
            </div>
          ) : label.size ? (
            <span>{label.size}</span>
          ) : (
            '-'
          )}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (label) => <div className="text-sm text-foreground">{label.color || '-'}</div>,
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      render: (label) => (
        <div className="flex flex-wrap gap-1">
          {label.labelSuppliers && label.labelSuppliers.length > 0 ? (
            label.labelSuppliers.slice(0, 2).map((s) => (
              <Badge
                key={s.id}
                variant={s.isPreferred ? 'default' : 'secondary'}
                className="text-xs"
                title={`${s.supplier.name}${s.pricePerPiece ? ` - ₹${s.pricePerPiece}/pc` : ''}`}
              >
                {s.supplier.code}
                {s.pricePerPiece ? ` ₹${s.pricePerPiece}` : ''}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
          {label.labelSuppliers && label.labelSuppliers.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{label.labelSuppliers.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'pricePerPiece',
      header: 'Price/Piece',
      render: (label) => (
        <div className="text-sm font-medium text-foreground">
          {label.pricePerPiece ? formatCurrency(label.pricePerPiece) : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (label) => (
        <StatusBadge
          status={label.isActive ? 'active' : 'inactive'}
          variant={label.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (label) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/materials/label/${label.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(label.id, label.labelName);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Label Management</CardTitle>
            <div className="flex gap-2">
              <ViewStockButton materialType="LABEL" stockCount={stockCount} />
              <ExportButton module="label" filters={{}} />
              <ImportButton module="label" onSuccess={fetchLabelItems} />
              <Button onClick={() => navigate('/materials/label/new')}>+ Add New Label</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <FilterBar
            className="mb-6"
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="min-w-[220px] flex-1 max-w-md"
              placeholder="Search code, name, customer, brand, type, size, color, supplier…"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setCurrentPage(1);
              }}
            />

            {/* A customer shows its own labels plus the generic ones (no customer) */}
            <CustomerCombobox
              value={customerId}
              onValueChange={(value) => {
                setCustomerId(value || '');
                setCurrentPage(1);
              }}
              allowAll
              allLabel="All customers"
              placeholder="All customers"
              className="w-[220px]"
            />

            <Select
              value={labelCategory || '_all_'}
              onValueChange={(val) => {
                setLabelCategory(val === '_all_' ? '' : val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]" aria-label="Category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">All categories</SelectItem>
                <SelectItem value="SEWN_IN">Sewn-in labels</SelectItem>
                <SelectItem value="HANGTAG">Hangtags</SelectItem>
                <SelectItem value="PRICE_TAG">Price tags</SelectItem>
              </SelectContent>
            </Select>

            <SupplierCombobox
              value={supplierId}
              onValueChange={(value) => {
                setSupplierId(value || '');
                setCurrentPage(1);
              }}
              allowAll
              allLabel="All suppliers"
              placeholder="All suppliers"
              className="w-[220px]"
            />
          </FilterBar>

          {/* DataTable Component */}
          <DataTable
            data={labelItems}
            columns={columns}
            keyExtractor={(label) => label.id}
            loading={isLoading}
            error={error}
            onRowClick={(label) => navigate(`/materials/label/${label.id}`)}
            emptyState={
              activeFilterCount > 0
                ? {
                    icon: <Package className="h-16 w-16" />,
                    title: 'No labels match these filters.',
                    actionLabel: 'Clear filters',
                    onAction: clearFilters,
                  }
                : {
                    icon: <Package className="h-16 w-16" />,
                    title: 'No label items found',
                    description: 'Get started by creating your first label item',
                    actionLabel: 'Create First Label',
                    onAction: () => navigate('/materials/label/new'),
                  }
            }
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Label"
        description={`Are you sure you want to delete ${labelToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
