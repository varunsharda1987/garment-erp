import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllLace, deleteLace } from '@/services/lace.service';
import type { Lace } from '@/types/lace.types';
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

export default function LaceList() {
  const navigate = useNavigate();
  const [laceItems, setLaceItems] = useState<Lace[]>([]);
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
  const [laceToDelete, setLaceToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchLaceItems();
  }, [currentPage, pageSize, searchQuery]);

  const fetchLaceItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllLace({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setLaceItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to load lace items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setLaceToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!laceToDelete) return;

    try {
      await deleteLace(laceToDelete.id);
      handleApiSuccess('Lace deleted', `${laceToDelete.name} has been successfully deleted.`);
      fetchLaceItems();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete lace');
    } finally {
      setLaceToDelete(null);
    }
  };

  const formatPrice = (price: number | string | null | undefined) => {
    if (!price) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `₹${numPrice.toFixed(2)}`;
  };

  // Define columns for DataTable
  const columns: Column<Lace>[] = [
    {
      key: 'laceCode',
      header: 'Code',
      render: (lace) => (
        <Badge variant="outline" className="font-mono text-xs">
          {lace.laceCode}
        </Badge>
      ),
    },
    {
      key: 'laceName',
      header: 'Lace Name',
      render: (lace) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{lace.laceName}</div>
          {lace.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{lace.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'width',
      header: 'Width',
      render: (lace) => (
        <div className="text-sm text-gray-700">
          {lace.width ? `${lace.width}"` : '-'}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (lace) => (
        <div className="text-sm text-gray-700">
          {lace.color || '-'}
        </div>
      ),
    },
    {
      key: 'supplierCode',
      header: 'Supplier Code',
      render: (lace) => (
        <div className="text-sm text-gray-700">
          {lace.supplierCode || '-'}
        </div>
      ),
    },
    {
      key: 'pricePerMeter',
      header: 'Price/Meter',
      render: (lace) => (
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(lace.pricePerMeter)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (lace) => (
        <StatusBadge
          status={lace.isActive ? 'active' : 'inactive'}
          variant={lace.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (lace) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/materials/lace/${lace.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(lace.id, lace.laceName);
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
            <CardTitle>Lace Management</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="lace"
                filters={{}}
              />
              <ImportButton
                module="lace"
                onSuccess={fetchLaceItems}
              />
              <Button onClick={() => navigate('/materials/lace/new')}>
                + Add New Lace
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, or color..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={laceItems}
            columns={columns}
            keyExtractor={(lace) => lace.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No lace items found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first lace item',
              actionLabel: 'Create First Lace',
              onAction: () => navigate('/materials/lace/new'),
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
        title="Delete Lace"
        description={`Are you sure you want to delete ${laceToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
