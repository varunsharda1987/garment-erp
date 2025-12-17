import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllPackaging, deletePackaging } from '@/services/packaging.service';
import type { Packaging } from '@/types/packaging.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Package } from 'lucide-react';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function PackagingList() {
  const navigate = useNavigate();
  const [packagingItems, setPackagingItems] = useState<Packaging[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packagingToDelete, setPackagingToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchPackagingItems();
  }, [currentPage, pageSize, searchQuery]);

  const fetchPackagingItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllPackaging({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setPackagingItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load packaging items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setPackagingToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!packagingToDelete) return;

    try {
      await deletePackaging(packagingToDelete.id);
      handleApiSuccess('Packaging deleted', `${packagingToDelete.name} has been successfully deleted.`);
      fetchPackagingItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete packaging');
    } finally {
      setPackagingToDelete(null);
    }
  };

  const formatPrice = (price: number | string | null | undefined) => {
    if (!price) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `₹${numPrice.toFixed(2)}`;
  };

  // Define columns for DataTable
  const columns: Column<Packaging>[] = [
    {
      key: 'packagingCode',
      header: 'Code',
      render: (packaging) => (
        <Badge variant="outline" className="font-mono text-xs">
          {packaging.packagingCode}
        </Badge>
      ),
    },
    {
      key: 'packagingName',
      header: 'Packaging Name',
      render: (packaging) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{packaging.packagingName}</div>
          {packaging.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{packaging.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (packaging) => (
        <div className="text-sm text-gray-700">
          {packaging.customer ? (
            <span className="font-medium">{packaging.customer.name}</span>
          ) : (
            <span className="text-gray-400 italic">Generic</span>
          )}
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (packaging) => (
        <div className="text-sm text-gray-700">
          {packaging.brandCategory ? (
            <div>
              <div className="font-medium">{packaging.brandCategory.brandName}</div>
              {packaging.brandCategory.category && (
                <div className="text-xs text-gray-500">{packaging.brandCategory.category}</div>
              )}
            </div>
          ) : (
            <span className="text-gray-400 italic">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'packagingType',
      header: 'Type',
      render: (packaging) => (
        <div className="text-sm text-gray-700">
          {packaging.packagingType || '-'}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (packaging) => (
        <div className="text-sm text-gray-700">
          {packaging.size || '-'}
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material',
      render: (packaging) => (
        <div className="text-sm text-gray-700">
          {packaging.material || '-'}
        </div>
      ),
    },
    {
      key: 'pricePerPiece',
      header: 'Price/Piece',
      render: (packaging) => (
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(packaging.pricePerPiece)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (packaging) => (
        <StatusBadge
          status={packaging.isActive ? 'active' : 'inactive'}
          variant={packaging.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (packaging) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/materials/packaging/${packaging.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(packaging.id, packaging.packagingName);
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
            <CardTitle>Packaging Management</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="packaging"
                filters={{}}
              />
              <ImportButton
                module="packaging"
                onSuccess={fetchPackagingItems}
              />
              <Button onClick={() => navigate('/materials/packaging/new')}>
                + Add New Packaging
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, or type..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={packagingItems}
            columns={columns}
            keyExtractor={(packaging) => packaging.id}
            loading={isLoading}
            error={error}
            onRowClick={(packaging) => navigate(`/materials/packaging/${packaging.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No packaging items found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first packaging item',
              actionLabel: 'Create First Packaging',
              onAction: () => navigate('/materials/packaging/new'),
            }}
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
        title="Delete Packaging"
        description={`Are you sure you want to delete ${packagingToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
