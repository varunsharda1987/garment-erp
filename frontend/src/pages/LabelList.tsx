import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllLabels, deleteLabel } from '@/services/label.service';
import type { Label } from '@/types/label.types';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchLabelItems();
  }, [currentPage, pageSize, searchQuery]);

  const fetchLabelItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllLabels({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
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

  const formatPrice = (price: number | string | null | undefined) => {
    if (!price) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `₹${numPrice.toFixed(2)}`;
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
          <div className="text-sm font-medium text-gray-900">{label.labelName}</div>
          {label.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{label.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'labelType',
      header: 'Type',
      render: (label) => (
        <div className="text-sm text-gray-700">
          {label.labelType || '-'}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (label) => (
        <div className="text-sm text-gray-700">
          {label.size || '-'}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (label) => (
        <div className="text-sm text-gray-700">
          {label.color || '-'}
        </div>
      ),
    },
    {
      key: 'pricePerPiece',
      header: 'Price/Piece',
      render: (label) => (
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(label.pricePerPiece)}
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
            onClick={() => navigate(`/materials/label/${label.id}/edit`)}
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
              <ExportButton
                module="label"
                filters={{}}
              />
              <ImportButton
                module="label"
                onSuccess={fetchLabelItems}
              />
              <Button onClick={() => navigate('/materials/label/new')}>
                + Add New Label
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
            data={labelItems}
            columns={columns}
            keyExtractor={(label) => label.id}
            loading={isLoading}
            error={error}
            onRowClick={(label) => navigate(`/materials/label/${label.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No label items found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first label item',
              actionLabel: 'Create First Label',
              onAction: () => navigate('/materials/label/new'),
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
