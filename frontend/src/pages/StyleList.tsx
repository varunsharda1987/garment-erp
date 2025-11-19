import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { styleService } from '@/services/style.service';
import type { Style } from '@/types/style.types';
import { PRODUCTION_STAGE_LABELS } from '@/types/style.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import { Shirt } from 'lucide-react';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function StyleList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentUser = useAuthStore((state) => state.user);
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStyles, setTotalStyles] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const stageFilter = searchParams.get('stage') || undefined;

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [styleToDelete, setStyleToDelete] = useState<{ id: string; styleCode: string } | null>(null);

  // Permission checks
  const canCreateEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'MERCHANDISER';
  const isAdmin = currentUser?.role === 'ADMIN';

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [location.pathname, stageFilter]);

  useEffect(() => {
    fetchStyles();
  }, [currentPage, pageSize, searchQuery, stageFilter]);

  const fetchStyles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await styleService.getAllStyles(currentPage, pageSize, searchQuery || undefined, stageFilter);
      setStyles(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalStyles(response.pagination.total);
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to load styles', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, styleCode: string) => {
    setStyleToDelete({ id, styleCode });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!styleToDelete) return;

    try {
      await styleService.deleteStyle(styleToDelete.id);
      handleApiSuccess('Style deleted', `Style ${styleToDelete.styleCode} has been successfully deleted.`);
      fetchStyles();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete style');
    } finally {
      setStyleToDelete(null);
    }
  };

  // Get production stage info for status badge
  const getProductionStageInfo = (style: Style) => {
    const tracking = style.productionTracking?.[0];
    if (!tracking) return { stage: 'No tracking', pieces: 0, variant: 'secondary' as const };

    const stageLabel = PRODUCTION_STAGE_LABELS[tracking.currentStage] || tracking.currentStage;

    // Determine variant based on stage
    let variant: 'secondary' | 'warning' | 'info' | 'success' | 'destructive' = 'secondary';
    if (tracking.currentStage.startsWith('ORDER_') || tracking.currentStage.startsWith('PENDING_') || tracking.currentStage.includes('NOT_ORDERED')) {
      variant = 'warning';
    } else if (tracking.currentStage.startsWith('IN_PRINT') || tracking.currentStage.startsWith('IN_DY') || tracking.currentStage.startsWith('IN_EMB') || tracking.currentStage.startsWith('IN_HAND')) {
      variant = 'info';
    } else if (tracking.currentStage.startsWith('IN_CUT') || tracking.currentStage.startsWith('IN_STIT') || tracking.currentStage.startsWith('IN_FIN')) {
      variant = 'info';
    } else if (tracking.currentStage === 'READY_TO_SHIP') {
      variant = 'success';
    } else if (tracking.currentStage === 'SHIPPED' || tracking.currentStage === 'COMPLETED') {
      variant = 'secondary';
    }

    return {
      stage: stageLabel,
      pieces: tracking.piecesInStage,
      variant
    };
  };

  // Define columns for DataTable
  const columns: Column<Style>[] = [
    {
      key: 'image',
      header: 'Image',
      render: (style) => (
        <div>
          {style.imageUrl ? (
            <img
              src={`http://localhost:5000${style.imageUrl}`}
              alt={style.styleName}
              className="w-12 h-12 object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.innerHTML = '<div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">No Image</div>';
                }
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
              No Image
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'styleCode',
      header: 'Style Code',
      render: (style) => (
        <div className="text-sm font-medium text-gray-900">{style.styleCode}</div>
      ),
    },
    {
      key: 'styleName',
      header: 'Style Name',
      render: (style) => (
        <div>
          <div className="text-sm text-gray-900">{style.styleName}</div>
          {style.description && (
            <div className="text-xs text-gray-500 truncate max-w-xs">
              {style.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer / Brand',
      render: (style) => (
        <div>
          <div className="text-sm text-gray-900">{style.buyerName}</div>
          <div className="text-xs text-gray-500">{style.brandName}</div>
        </div>
      ),
    },
    {
      key: 'orderQuantity',
      header: 'Order Qty',
      render: (style) => (
        <div className="text-sm text-gray-900">
          {style.orderQuantity || '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (style) => {
        const stageInfo = getProductionStageInfo(style);
        return (
          <div>
            <StatusBadge status={stageInfo.stage} variant={stageInfo.variant} />
            <div className="text-xs text-gray-500 mt-1">
              {stageInfo.pieces} pcs
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (style) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/styles/${style.id}`);
            }}
          >
            View
          </Button>
          {canCreateEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/styles/${style.id}/edit`);
              }}
            >
              Edit
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(style.id, style.styleCode);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Style Master</CardTitle>
              <CardDescription>
                {stageFilter
                  ? `Showing styles in stage: ${PRODUCTION_STAGE_LABELS[stageFilter as keyof typeof PRODUCTION_STAGE_LABELS] || stageFilter}`
                  : `Manage and track all garment styles (${totalStyles} total)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportButton
                module="styles"
                filters={{ stage: stageFilter }}
              />
              {canCreateEdit && (
                <>
                  <ImportButton
                    module="styles"
                    onSuccess={fetchStyles}
                  />
                  <Button onClick={() => navigate('/styles/new')}>
                    + Create New Style
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <SearchInput
                  placeholder="Search by style code, name, buyer, or brand..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
              </div>
              {stageFilter && (
                <Button variant="outline" onClick={() => navigate('/styles')}>
                  Clear Filter
                </Button>
              )}
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={styles}
            columns={columns}
            keyExtractor={(style) => style.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <Shirt className="h-16 w-16" />,
              title: 'No styles found',
              description: searchQuery || stageFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first style',
              actionLabel: canCreateEdit && !searchQuery && !stageFilter ? 'Create First Style' : undefined,
              onAction: canCreateEdit && !searchQuery && !stageFilter ? () => navigate('/styles/new') : undefined,
            }}
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems: totalStyles,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            onRowClick={(style) => navigate(`/styles/${style.id}`)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Style"
        description={`Are you sure you want to delete style ${styleToDelete?.styleCode}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
