import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllZippers, deleteZipper } from '@/services/zipper.service';
import type { Zipper } from '@/types/zipper.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { Package } from 'lucide-react';
import { ViewStockButton } from '@/components/ViewStockButton';
import stockLevelService from '@/services/stockLevel.service';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function ZipperList() {
  const navigate = useNavigate();
  const [zipperItems, setZipperItems] = useState<Zipper[]>([]);
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
  const [supplierFilter, setSupplierFilter] = useState<string | undefined>(undefined);

  // Stock count state
  const [stockCount, setStockCount] = useState<number | undefined>(undefined);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [zipperToDelete, setZipperToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchZipperItems();
    fetchStockCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, supplierFilter]);

  const fetchStockCount = async () => {
    try {
      const stockLevels = await stockLevelService.getByMaterialType('ZIPPER');
      setStockCount(stockLevels.length);
    } catch {
      // Silently fail - stock count is not critical
      setStockCount(undefined);
    }
  };

  const fetchZipperItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllZippers({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        supplierId: supplierFilter,
      });
      setZipperItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load zipper items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Every filter change starts again from page 1
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSupplierChange = (value: string) => {
    setSupplierFilter(value || undefined);
    setCurrentPage(1);
  };

  const activeFilterCount = (searchQuery ? 1 : 0) + (supplierFilter ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSupplierFilter(undefined);
    setCurrentPage(1);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setZipperToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!zipperToDelete) return;

    try {
      await deleteZipper(zipperToDelete.id);
      handleApiSuccess('Zipper deleted', `${zipperToDelete.name} has been successfully deleted.`);
      fetchZipperItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete zipper');
    } finally {
      setZipperToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<Zipper>[] = [
    {
      key: 'zipperCode',
      header: 'Code',
      render: (zipper) => (
        <Badge variant="outline" className="font-mono text-xs">
          {zipper.zipperCode}
        </Badge>
      ),
    },
    {
      key: 'zipperName',
      header: 'Zipper Name',
      render: (zipper) => (
        <div>
          <div className="text-sm font-medium text-foreground">{zipper.zipperName}</div>
          {zipper.description && <div className="text-xs text-muted-foreground line-clamp-1">{zipper.description}</div>}
        </div>
      ),
    },
    {
      key: 'length',
      header: 'Length',
      render: (zipper) => <div className="text-sm text-foreground">{zipper.length ? `${zipper.length}"` : '-'}</div>,
    },
    {
      key: 'teethType',
      header: 'Teeth Type',
      render: (zipper) => <div className="text-sm text-foreground">{zipper.teethType || '-'}</div>,
    },
    {
      key: 'color',
      header: 'Color',
      render: (zipper) => <div className="text-sm text-foreground">{zipper.color || '-'}</div>,
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      render: (zipper) => (
        <div className="flex flex-wrap gap-1">
          {zipper.zipperSuppliers && zipper.zipperSuppliers.length > 0 ? (
            zipper.zipperSuppliers.slice(0, 2).map((s) => (
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
          {zipper.zipperSuppliers && zipper.zipperSuppliers.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{zipper.zipperSuppliers.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'pricePerPiece',
      header: 'Price/Piece',
      render: (zipper) => (
        <div className="text-sm font-medium text-foreground">
          {zipper.pricePerPiece ? formatCurrency(zipper.pricePerPiece) : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (zipper) => (
        <StatusBadge
          status={zipper.isActive ? 'active' : 'inactive'}
          variant={zipper.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (zipper) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/materials/zipper/${zipper.id}/edit`)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(zipper.id, zipper.zipperName);
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
            <CardTitle>Zipper Management</CardTitle>
            <div className="flex gap-2">
              <ViewStockButton materialType="ZIPPER" stockCount={stockCount} />
              <ExportButton module="zipper" filters={{}} />
              <ImportButton module="zipper" onSuccess={fetchZipperItems} />
              <Button onClick={() => navigate('/materials/zipper/new')}>+ Add New Zipper</Button>
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
              className="min-w-[220px] max-w-md flex-1"
              placeholder="Search code, name, teeth type, colour, supplier…"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <SupplierCombobox
              allowAll
              allLabel="All suppliers"
              value={supplierFilter || ''}
              onValueChange={handleSupplierChange}
              placeholder="All suppliers"
              className="w-[220px]"
            />
          </FilterBar>

          {/* DataTable Component */}
          <DataTable
            data={zipperItems}
            columns={columns}
            keyExtractor={(zipper) => zipper.id}
            loading={isLoading}
            error={error}
            onRowClick={(zipper) => navigate(`/materials/zipper/${zipper.id}`)}
            emptyState={
              activeFilterCount > 0
                ? {
                    icon: <Package className="h-16 w-16" />,
                    title: 'No zipper items match these filters.',
                    actionLabel: 'Clear filters',
                    onAction: clearFilters,
                  }
                : {
                    icon: <Package className="h-16 w-16" />,
                    title: 'No zipper items found',
                    description: 'Get started by creating your first zipper item',
                    actionLabel: 'Create First Zipper',
                    onAction: () => navigate('/materials/zipper/new'),
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
        title="Delete Zipper"
        description={`Are you sure you want to delete ${zipperToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
