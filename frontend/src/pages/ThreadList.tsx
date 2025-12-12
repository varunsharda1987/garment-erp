import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllThreads, deleteThread } from '@/services/thread.service';
import type { Thread } from '@/types/thread.types';
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

export default function ThreadList() {
  const navigate = useNavigate();
  const [threadItems, setThreadItems] = useState<Thread[]>([]);
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
  const [threadToDelete, setThreadToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchThreadItems();
  }, [currentPage, pageSize, searchQuery]);

  const fetchThreadItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllThreads({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setThreadItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load thread items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setThreadToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!threadToDelete) return;

    try {
      await deleteThread(threadToDelete.id);
      handleApiSuccess('Thread deleted', `${threadToDelete.name} has been successfully deleted.`);
      fetchThreadItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete thread');
    } finally {
      setThreadToDelete(null);
    }
  };

  const formatPrice = (price: number | string | null | undefined) => {
    if (!price) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `₹${numPrice.toFixed(2)}`;
  };

  // Define columns for DataTable
  const columns: Column<Thread>[] = [
    {
      key: 'threadCode',
      header: 'Code',
      render: (thread) => (
        <Badge variant="outline" className="font-mono text-xs">
          {thread.threadCode}
        </Badge>
      ),
    },
    {
      key: 'threadName',
      header: 'Thread Name',
      render: (thread) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{thread.threadName}</div>
          {thread.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{thread.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (thread) => (
        <div className="text-sm text-gray-700">
          {thread.brand || '-'}
        </div>
      ),
    },
    {
      key: 'packagingType',
      header: 'Packaging',
      render: (thread) => (
        thread.packagingType ? (
          <Badge variant={thread.packagingType === 'CONE' ? 'default' : 'secondary'} className="text-xs">
            {thread.packagingType}
            <span className="ml-1 opacity-70">({thread.piecesPerBox || (thread.packagingType === 'CONE' ? 6 : 10)}/box)</span>
          </Badge>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'metersPerUnit',
      header: 'Meters',
      render: (thread) => (
        <div className="text-sm text-gray-700">
          {thread.metersPerUnit ? `${thread.metersPerUnit}m` : '-'}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (thread) => (
        <div className="text-sm text-gray-700">
          {thread.color || '-'}
        </div>
      ),
    },
    {
      key: 'styleCodes',
      header: 'Style Codes',
      render: (thread) => (
        <div className="flex flex-wrap gap-1">
          {thread.styleCodes && thread.styleCodes.length > 0 ? (
            thread.styleCodes.slice(0, 2).map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">
                {code}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
          {thread.styleCodes && thread.styleCodes.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{thread.styleCodes.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      render: (thread) => (
        <div className="flex flex-wrap gap-1">
          {thread.threadSuppliers && thread.threadSuppliers.length > 0 ? (
            thread.threadSuppliers.slice(0, 2).map((s) => (
              <Badge
                key={s.id}
                variant={s.isPreferred ? 'default' : 'secondary'}
                className="text-xs"
                title={`${s.supplier.name}${s.pricePerCone ? ` - ₹${s.pricePerCone}/cone` : ''}`}
              >
                {s.supplier.code}
                {s.pricePerCone ? ` ₹${s.pricePerCone}` : ''}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
          {thread.threadSuppliers && thread.threadSuppliers.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{thread.threadSuppliers.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'pricePerCone',
      header: 'Price',
      render: (thread) => (
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(thread.pricePerCone)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (thread) => (
        <StatusBadge
          status={thread.isActive ? 'active' : 'inactive'}
          variant={thread.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (thread) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/materials/thread/${thread.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(thread.id, thread.threadName);
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
            <CardTitle>Thread Management</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="thread"
                filters={{}}
              />
              <ImportButton
                module="thread"
                onSuccess={fetchThreadItems}
              />
              <Button onClick={() => navigate('/materials/thread/new')}>
                + Add New Thread
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, brand, color, or style code..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={threadItems}
            columns={columns}
            keyExtractor={(thread) => thread.id}
            loading={isLoading}
            error={error}
            onRowClick={(thread) => navigate(`/materials/thread/${thread.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No thread items found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first thread item',
              actionLabel: 'Create First Thread',
              onAction: () => navigate('/materials/thread/new'),
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
        title="Delete Thread"
        description={`Are you sure you want to delete ${threadToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
