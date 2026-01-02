import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { styleService, type DeactivationCheck } from '@/services/style.service';
import type { Style } from '@/types/style.types';
import { PRODUCTION_STAGE_LABELS } from '@/types/style.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CADStatusBadge } from '@/components/CADStatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import ExportButton from '@/components/ExportButton';
import { Shirt, Archive, RotateCcw, Trash2, Clock, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getUploadUrl } from '../config/api.config';

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

  // Tab state
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');

  // CAD Planning mode - when cadStatusFilter is present, show CAD status tabs
  const isCADPlanningMode = !!searchParams.get('cadStatus');
  const [cadStatusTab, setCadStatusTab] = useState<'PENDING' | 'IN_PROGRESS' | 'APPROVED'>('PENDING');

  // Counts for CAD status tabs
  const [cadPendingCount, setCadPendingCount] = useState(0);
  const [cadInProgressCount, setCadInProgressCount] = useState(0);
  const [cadApprovedCount, setCadApprovedCount] = useState(0);

  // Active styles state
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deleted styles state
  const [deletedStyles, setDeletedStyles] = useState<Style[]>([]);
  const [isLoadingDeleted, setIsLoadingDeleted] = useState(false);
  const [errorDeleted, setErrorDeleted] = useState<string | null>(null);
  const [deletedSearchQuery, setDeletedSearchQuery] = useState('');
  const [deletedCurrentPage, setDeletedCurrentPage] = useState(1);
  const [deletedTotalPages, setDeletedTotalPages] = useState(1);
  const [deletedTotalStyles, setDeletedTotalStyles] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStyles, setTotalStyles] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const stageFilter = searchParams.get('stage') || undefined;
  const cadStatusFilter = searchParams.get('cadStatus') || undefined;

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [styleToDelete, setStyleToDelete] = useState<{ id: string; styleCode: string } | null>(null);

  // Permanent delete dialog state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [styleToPermanentDelete, setStyleToPermanentDelete] = useState<{ id: string; styleCode: string } | null>(null);

  // Restore dialog state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [styleToRestore, setStyleToRestore] = useState<{ id: string; styleCode: string } | null>(null);

  // Deactivation validation state
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [deactivationCheck, setDeactivationCheck] = useState<DeactivationCheck | null>(null);
  const [checkingDeactivation, setCheckingDeactivation] = useState(false);

  // Permission checks
  const canCreateEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'MERCHANDISER';
  const isAdmin = currentUser?.role === 'ADMIN';

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [location.pathname, stageFilter, cadStatusTab]);

  // In CAD Planning mode, use cadStatusTab for filtering
  const effectiveCadStatus = isCADPlanningMode ? cadStatusTab : searchParams.get('cadStatus') || undefined;

  useEffect(() => {
    fetchStyles();
  }, [currentPage, pageSize, searchQuery, stageFilter, effectiveCadStatus]);

  // Fetch CAD status counts when in CAD Planning mode
  useEffect(() => {
    if (isCADPlanningMode) {
      fetchCADStatusCounts();
    }
  }, [isCADPlanningMode]);

  const fetchCADStatusCounts = async () => {
    try {
      // Fetch counts for each CAD status in parallel
      const [pendingRes, inProgressRes, approvedRes] = await Promise.all([
        styleService.getAllStyles(1, 1, undefined, undefined, 'PENDING'),
        styleService.getAllStyles(1, 1, undefined, undefined, 'IN_PROGRESS'),
        styleService.getAllStyles(1, 1, undefined, undefined, 'APPROVED'),
      ]);
      setCadPendingCount(pendingRes.pagination.total);
      setCadInProgressCount(inProgressRes.pagination.total);
      setCadApprovedCount(approvedRes.pagination.total);
    } catch (err) {
      console.error('Failed to fetch CAD status counts:', err);
    }
  };

  const fetchStyles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await styleService.getAllStyles(currentPage, pageSize, searchQuery || undefined, stageFilter, effectiveCadStatus);
      setStyles(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalStyles(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load styles', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (id: string, styleCode: string) => {
    setStyleToDelete({ id, styleCode });
    setCheckingDeactivation(true);

    try {
      const check = await styleService.canDeactivate(id);
      setDeactivationCheck(check);

      if (check.canDeactivate) {
        setDeleteDialogOpen(true);
      } else {
        setBlockedDialogOpen(true);
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to check deactivation status');
    } finally {
      setCheckingDeactivation(false);
    }
  };

  const confirmDelete = async () => {
    if (!styleToDelete) return;

    try {
      await styleService.deleteStyle(styleToDelete.id);
      handleApiSuccess('Style archived', `Style ${styleToDelete.styleCode} has been archived. You can restore it from the Deleted Styles tab.`);
      fetchStyles();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete style');
    } finally {
      setStyleToDelete(null);
    }
  };

  // Fetch deleted styles
  const fetchDeletedStyles = async () => {
    try {
      setIsLoadingDeleted(true);
      setErrorDeleted(null);
      const response = await styleService.getDeletedStyles(deletedCurrentPage, pageSize, deletedSearchQuery || undefined);
      setDeletedStyles(response.data);
      setDeletedTotalPages(response.pagination.totalPages);
      setDeletedTotalStyles(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load deleted styles', false);
      setErrorDeleted(errorMessage);
    } finally {
      setIsLoadingDeleted(false);
    }
  };

  // Load deleted styles when tab changes or pagination/search changes
  useEffect(() => {
    if (activeTab === 'deleted') {
      fetchDeletedStyles();
    }
  }, [activeTab, deletedCurrentPage, pageSize, deletedSearchQuery]);

  // Handle restore click
  const handleRestoreClick = (id: string, styleCode: string) => {
    setStyleToRestore({ id, styleCode });
    setRestoreDialogOpen(true);
  };

  // Confirm restore
  const confirmRestore = async () => {
    if (!styleToRestore) return;

    try {
      await styleService.restoreStyle(styleToRestore.id);
      handleApiSuccess('Style restored', `Style ${styleToRestore.styleCode} has been restored successfully.`);
      fetchDeletedStyles();
      fetchStyles(); // Refresh active list too
    } catch (err: unknown) {
      handleApiError(err, 'Failed to restore style');
    } finally {
      setStyleToRestore(null);
    }
  };

  // Handle permanent delete click
  const handlePermanentDeleteClick = (id: string, styleCode: string) => {
    setStyleToPermanentDelete({ id, styleCode });
    setPermanentDeleteDialogOpen(true);
  };

  // Confirm permanent delete
  const confirmPermanentDelete = async () => {
    if (!styleToPermanentDelete) return;

    try {
      await styleService.permanentDeleteStyle(styleToPermanentDelete.id);
      handleApiSuccess('Style permanently deleted', `Style ${styleToPermanentDelete.styleCode} has been permanently deleted. This cannot be undone.`);
      fetchDeletedStyles();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to permanently delete style');
    } finally {
      setStyleToPermanentDelete(null);
    }
  };

  // Helper function to get fabric names from components
  const getFabricNames = (style: Style): string => {
    // Access components array (serialized from style_components)
    const components = style.components || [];
    const fabricNames: string[] = [];

    components.forEach((comp) => {
      if (comp.fabrics) {
        comp.fabrics.forEach((fab) => {
          const name = fab.genericFabricName || fab.fabricName;
          if (name && !fabricNames.includes(name)) {
            fabricNames.push(name);
          }
        });
      }
    });

    if (fabricNames.length === 0) return '-';
    if (fabricNames.length <= 2) return fabricNames.join(', ');
    return `${fabricNames.slice(0, 2).join(', ')} +${fabricNames.length - 2}`;
  };

  // Helper function to get cost
  const getCost = (style: Style): string => {
    const cost = style.costPerPiece || style.styleCosting?.totalCostPerPiece || style.costing?.totalCostPerPiece;
    if (!cost) return '-';
    return `₹${cost.toFixed(2)}`;
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
              src={getUploadUrl(style.imageUrl)}
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
        <div>
          <div className="text-sm font-medium text-gray-900">{style.styleCode}</div>
          {style.styleName && (
            <div className="text-xs text-gray-500 truncate max-w-[150px]">{style.styleName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer / Brand',
      render: (style) => (
        <div>
          <div className="text-sm text-gray-900">{style.customerName}</div>
          <div className="text-xs text-gray-500">{style.brandName}</div>
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (style) => (
        <div className="text-sm text-gray-900 max-w-[150px] truncate" title={getFabricNames(style)}>
          {getFabricNames(style)}
        </div>
      ),
    },
    {
      key: 'productCategory',
      header: 'Product Category',
      render: (style) => (
        <div className="text-sm text-gray-900">
          {style.productCategory?.name || '-'}
        </div>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      render: (style) => (
        <div className="text-sm text-gray-900 text-center">
          {style.numberOfComponents || style.components?.length || '-'}
        </div>
      ),
    },
    {
      key: 'componentName',
      header: 'Component Name',
      render: (style) => {
        const componentNames = style.components?.map(c => c.componentName).filter(Boolean) || [];
        if (componentNames.length === 0) return <div className="text-sm text-gray-500">-</div>;
        return <div className="text-sm text-gray-900">{componentNames.join(', ')}</div>;
      },
    },
    {
      key: 'cadStatus',
      header: 'CAD Status',
      render: (style) => (
        <CADStatusBadge status={style.cadStatus} size="sm" />
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (style) => (
        <div className="text-sm text-gray-900 font-medium">
          {getCost(style)}
        </div>
      ),
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
              // In CAD Planning mode, navigate to CAD planning page
              navigate(isCADPlanningMode ? `/styles/${style.id}/cad-planning` : `/styles/${style.id}`);
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
                // In CAD Planning mode, navigate to CAD planning page for editing
                navigate(isCADPlanningMode ? `/styles/${style.id}/cad-planning` : `/styles/${style.id}/edit`);
              }}
            >
              Edit
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              disabled={checkingDeactivation}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(style.id, style.styleCode);
              }}
            >
              {checkingDeactivation && styleToDelete?.id === style.id ? 'Checking...' : 'Archive'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Define columns for Deleted Styles DataTable
  const deletedColumns: Column<Style>[] = [
    {
      key: 'image',
      header: 'Image',
      render: (style) => (
        <div>
          {style.imageUrl ? (
            <img
              src={getUploadUrl(style.imageUrl)}
              alt={style.styleName}
              className="w-12 h-12 object-cover rounded opacity-60"
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
        <div>
          <div className="text-sm font-medium text-gray-500">{style.styleCode}</div>
          {style.internalCode && (
            <div className="text-xs text-gray-400">{style.internalCode}</div>
          )}
        </div>
      ),
    },
    {
      key: 'styleName',
      header: 'Style Name',
      render: (style) => (
        <div>
          <div className="text-sm text-gray-500">{style.styleName}</div>
          {style.description && (
            <div className="text-xs text-gray-400 truncate max-w-xs">
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
          <div className="text-sm text-gray-500">{style.customerName}</div>
          <div className="text-xs text-gray-400">{style.brandName}</div>
        </div>
      ),
    },
    {
      key: 'deletedAt',
      header: 'Deleted',
      render: (style) => (
        <div className="text-sm text-gray-500">
          {style.updatedAt ? new Date(style.updatedAt).toLocaleDateString() : '-'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (style) => (
        <div className="flex justify-end gap-2">
          {canCreateEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRestoreClick(style.id, style.styleCode);
              }}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Restore
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handlePermanentDeleteClick(style.id, style.styleCode);
              }}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Delete Forever
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">
                {isCADPlanningMode ? 'CAD Planning' : 'Style Master'}
              </CardTitle>
              <CardDescription>
                {isCADPlanningMode
                  ? `Manage CAD planning for styles (${totalStyles} styles in ${cadStatusTab} status)`
                  : stageFilter
                  ? `Showing styles in stage: ${PRODUCTION_STAGE_LABELS[stageFilter as keyof typeof PRODUCTION_STAGE_LABELS] || stageFilter}`
                  : activeTab === 'deleted'
                  ? `Manage deleted/archived styles (${deletedTotalStyles} total)`
                  : `Manage and track all garment styles (${totalStyles} total)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportButton
                module="styles"
                filters={{ stage: stageFilter }}
              />
              {canCreateEdit && activeTab === 'active' && (
                <>
                  <Button variant="outline" onClick={() => navigate('/styles/import')}>
                    Bulk Import
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/reports/style-fabric')}>
                    Stock Report
                  </Button>
                  <Button onClick={() => navigate('/styles/new')}>
                    + Create New Style
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* CAD Planning Mode: Show CAD Status Tabs */}
          {isCADPlanningMode ? (
            <Tabs value={cadStatusTab} onValueChange={(v) => setCadStatusTab(v as 'PENDING' | 'IN_PROGRESS' | 'APPROVED')} className="mb-6">
              <TabsList>
                <TabsTrigger value="PENDING" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending
                  {cadPendingCount > 0 && (
                    <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      {cadPendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="IN_PROGRESS" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  In Progress
                  {cadInProgressCount > 0 && (
                    <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {cadInProgressCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="APPROVED" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Approved
                  {cadApprovedCount > 0 && (
                    <span className="ml-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {cadApprovedCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* CAD Planning Content - Same for all tabs */}
              <TabsContent value={cadStatusTab} className="mt-6">
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
                    title: `No ${cadStatusTab.toLowerCase().replace('_', ' ')} styles found`,
                    description: searchQuery
                      ? 'Try adjusting your search criteria'
                      : cadStatusTab === 'PENDING'
                      ? 'All styles have CAD planning started or completed'
                      : cadStatusTab === 'IN_PROGRESS'
                      ? 'No styles currently in CAD planning progress'
                      : 'No styles have completed CAD planning yet',
                  }}
                  pagination={{
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems: totalStyles,
                    onPageChange: setCurrentPage,
                    onPageSizeChange: setPageSize,
                  }}
                  onRowClick={(style) => navigate(`/styles/${style.id}/cad-planning`)}
                />
              </TabsContent>
            </Tabs>
          ) : (
          /* Normal Mode: Show Active/Deleted Tabs */
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'deleted')} className="mb-6">
            <TabsList>
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Shirt className="h-4 w-4" />
                Active Styles
                <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                  {totalStyles}
                </span>
              </TabsTrigger>
              <TabsTrigger value="deleted" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Deleted Styles
                {deletedTotalStyles > 0 && (
                  <span className="ml-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                    {deletedTotalStyles}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Active Styles Tab */}
            <TabsContent value="active" className="mt-6">
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
                onRowClick={(style) => navigate(cadStatusFilter ? `/styles/${style.id}/cad-planning` : `/styles/${style.id}`)}
              />
            </TabsContent>

            {/* Deleted Styles Tab */}
            <TabsContent value="deleted" className="mt-6">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <SearchInput
                      placeholder="Search deleted styles by code, name, or buyer..."
                      value={deletedSearchQuery}
                      onChange={setDeletedSearchQuery}
                    />
                  </div>
                </div>
              </div>

              {/* Deleted Styles DataTable */}
              <DataTable
                data={deletedStyles}
                columns={deletedColumns}
                keyExtractor={(style) => style.id}
                loading={isLoadingDeleted}
                error={errorDeleted}
                emptyState={{
                  icon: <Archive className="h-16 w-16" />,
                  title: 'No deleted styles',
                  description: deletedSearchQuery
                    ? 'No deleted styles match your search criteria'
                    : 'Deleted styles will appear here. You can restore them or permanently delete them.',
                }}
                pagination={{
                  currentPage: deletedCurrentPage,
                  totalPages: deletedTotalPages,
                  pageSize,
                  totalItems: deletedTotalStyles,
                  onPageChange: setDeletedCurrentPage,
                  onPageSizeChange: setPageSize,
                }}
              />
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Archive (Soft Delete) Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Archive Style"
        description={`Are you sure you want to archive style ${styleToDelete?.styleCode}? You can restore it later from the Deleted Styles tab.`}
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        title="Restore Style"
        description={`Are you sure you want to restore style ${styleToRestore?.styleCode}? It will be moved back to the Active Styles list.`}
        confirmText="Restore"
        cancelText="Cancel"
        onConfirm={confirmRestore}
        variant="default"
      />

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        open={permanentDeleteDialogOpen}
        onOpenChange={setPermanentDeleteDialogOpen}
        title="Permanently Delete Style"
        description={`Are you sure you want to PERMANENTLY delete style ${styleToPermanentDelete?.styleCode}? This action cannot be undone and all associated data will be lost forever.`}
        confirmText="Delete Forever"
        cancelText="Cancel"
        onConfirm={confirmPermanentDelete}
        variant="destructive"
      />

      {/* Blocked Deactivation Dialog */}
      <Dialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cannot Archive Style
            </DialogTitle>
            <DialogDescription>
              {styleToDelete?.styleCode} cannot be archived due to active dependencies.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Please resolve the following:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2">
                {deactivationCheck?.blockers.map((blocker, index) => (
                  <li key={index}>
                    {blocker.count} {blocker.type}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
