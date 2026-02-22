import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { embroideryService } from '@/services/embroidery.service';
import type { Embroidery } from '@/types/embroidery.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Sparkles, Plus, Eye, Pencil, Trash2 } from 'lucide-react';

// Local type definition
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function EmbroideryList() {
  const navigate = useNavigate();
  const [embroideryItems, setEmbroideryItems] = useState<Embroidery[]>([]);
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
  const [embroideryToDelete, setEmbroideryToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchEmbroideryItems();
  }, [currentPage, pageSize, searchQuery]);

  const fetchEmbroideryItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await embroideryService.getAllEmbroidery({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setEmbroideryItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load embroidery designs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setEmbroideryToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!embroideryToDelete) return;

    try {
      await embroideryService.deleteEmbroidery(embroideryToDelete.id);
      handleApiSuccess('Embroidery deleted', `${embroideryToDelete.name} has been successfully deleted.`);
      fetchEmbroideryItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete embroidery design');
    } finally {
      setEmbroideryToDelete(null);
    }
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    if (!value) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return `₹${numValue.toFixed(2)}`;
  };

  // Define columns for DataTable
  const columns: Column<Embroidery>[] = [
    {
      key: 'embroideryCode',
      header: 'Code',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.embroideryCode}
        </Badge>
      ),
    },
    {
      key: 'designName',
      header: 'Design Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.designImage ? (
            <img
              src={item.designImage}
              alt={item.designName}
              className="h-10 w-10 rounded object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-gray-400" />
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{item.designName}</div>
            {item.description && (
              <div className="text-xs text-gray-500 line-clamp-1">{item.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'stitchCount',
      header: 'Stitches',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.stitchCount ? item.stitchCount.toLocaleString() : '-'}
        </div>
      ),
    },
    {
      key: 'threadColors',
      header: 'Colors',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.threadColors || '-'}
        </div>
      ),
    },
    {
      key: 'usableWidthAfter',
      header: 'Usable Width',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.usableWidthAfter ? `${item.usableWidthAfter}"` : '-'}
        </div>
      ),
    },
    {
      key: 'costPerMeter',
      header: 'Cost/Meter',
      render: (item) => (
        <div className="text-sm font-medium text-gray-900">
          {formatCurrency(item.costPerMeter)}
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.supplier?.name || '-'}
        </div>
      ),
    },
    {
      key: 'usageCount',
      header: 'Used In',
      render: (item) => (
        <Badge variant={item.usageCount && item.usageCount > 0 ? 'default' : 'secondary'}>
          {item.usageCount || 0} styles
        </Badge>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item) => (
        <Badge variant={item.isActive ? 'default' : 'secondary'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/embroidery/${item.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/embroidery/${item.id}/edit`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(item.id, item.designName);
            }}
            disabled={item.usageCount !== undefined && item.usageCount > 0}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <CardTitle>Embroidery Designs</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/embroidery/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Design
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                placeholder="Search designs..."
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={() => setCurrentPage(1)}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>Total: {totalItems} designs</span>
          </div>

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={embroideryItems}
            isLoading={isLoading}
            onRowClick={(item) => navigate(`/embroidery/${item.id}`)}
            emptyMessage="No embroidery designs found"
            pagination={{
              currentPage,
              pageSize,
              totalPages,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setCurrentPage(1);
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Embroidery Design"
        description={`Are you sure you want to delete "${embroideryToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
