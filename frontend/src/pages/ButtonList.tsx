import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllButtons, deleteButton } from '@/services/button.service';
import type { Button as ButtonType } from '@/types/button.types';
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

export default function ButtonList() {
  const navigate = useNavigate();
  const [buttonItems, setButtonItems] = useState<ButtonType[]>([]);
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
  const [buttonToDelete, setButtonToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchButtonItems();
  }, [currentPage, pageSize, searchQuery]);

  const fetchButtonItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllButtons({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setButtonItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load button items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setButtonToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!buttonToDelete) return;

    try {
      await deleteButton(buttonToDelete.id);
      handleApiSuccess('Button deleted', `${buttonToDelete.name} has been successfully deleted.`);
      fetchButtonItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete button');
    } finally {
      setButtonToDelete(null);
    }
  };

  const formatPrice = (price: number | string | null | undefined) => {
    if (!price) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `₹${numPrice.toFixed(2)}`;
  };

  // Define columns for DataTable
  const columns: Column<ButtonType>[] = [
    {
      key: 'buttonCode',
      header: 'Code',
      render: (button) => (
        <Badge variant="outline" className="font-mono text-xs">
          {button.buttonCode}
        </Badge>
      ),
    },
    {
      key: 'buttonName',
      header: 'Button Name',
      render: (button) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{button.buttonName}</div>
          {button.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{button.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (button) => (
        <div className="text-sm text-gray-700">
          {button.size || '-'}
        </div>
      ),
    },
    {
      key: 'holes',
      header: 'Holes',
      render: (button) => (
        <div className="text-sm text-gray-700">
          {button.holes !== null && button.holes !== undefined ? button.holes : '-'}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (button) => (
        <div className="text-sm text-gray-700">
          {button.color || '-'}
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material',
      render: (button) => (
        <div className="text-sm text-gray-700">
          {button.material || '-'}
        </div>
      ),
    },
    {
      key: 'styleCodes',
      header: 'Style Codes',
      render: (button) => (
        <div className="flex flex-wrap gap-1">
          {button.styleCodes && button.styleCodes.length > 0 ? (
            button.styleCodes.map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">
                {code}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'shape',
      header: 'Shape',
      render: (button) => (
        <div className="text-sm text-gray-700">
          {button.shape || '-'}
        </div>
      ),
    },
    {
      key: 'pricePerPiece',
      header: 'Price/Piece',
      render: (button) => (
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(button.pricePerPiece)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (button) => (
        <StatusBadge
          status={button.isActive ? 'active' : 'inactive'}
          variant={button.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (button) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/materials/button/${button.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(button.id, button.buttonName);
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
            <CardTitle>Button Management</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="button"
                filters={{}}
              />
              <ImportButton
                module="button"
                onSuccess={fetchButtonItems}
              />
              <Button onClick={() => navigate('/materials/button/new')}>
                + Add New Button
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, color, material, or style code..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={buttonItems}
            columns={columns}
            keyExtractor={(button) => button.id}
            loading={isLoading}
            error={error}
            onRowClick={(button) => navigate(`/materials/button/${button.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No button items found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first button item',
              actionLabel: 'Create First Button',
              onAction: () => navigate('/materials/button/new'),
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
        title="Delete Button"
        description={`Are you sure you want to delete ${buttonToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
