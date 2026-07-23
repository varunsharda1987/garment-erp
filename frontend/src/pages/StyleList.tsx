import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { styleService, type DeactivationCheck } from '@/services/style.service';
import type { Style } from '@/types/style.types';
import { PRODUCTION_STAGE_LABELS, CADStatus } from '@/types/style.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CADStatusBadge } from '@/components/cad/CADStatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import ExportButton from '@/components/ExportButton';
import { Shirt, Archive, RotateCcw, Trash2, AlertTriangle, FileEdit, Send } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'active' | 'drafts' | 'deleted'>('active');

  // Active styles state
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft styles state
  const [draftStyles, setDraftStyles] = useState<Style[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [errorDrafts, setErrorDrafts] = useState<string | null>(null);
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [draftCurrentPage, setDraftCurrentPage] = useState(1);
  const [draftTotalPages, setDraftTotalPages] = useState(1);
  const [draftTotalStyles, setDraftTotalStyles] = useState(0);

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DRAFT'>('ALL');
  const stageFilter = searchParams.get('stage') || undefined;

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

  // Publish dialog state
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [styleToPublish, setStyleToPublish] = useState<{ id: string; styleCode: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Permission checks
  const canCreateEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'MERCHANDISER';
  const isAdmin = currentUser?.role === 'ADMIN';

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [location.pathname, stageFilter, statusFilter]);

  const fetchStyles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Pass undefined for 'ALL' to get both active and draft styles
      const statusParam = statusFilter === 'ALL' ? undefined : statusFilter;
      const response = await styleService.getAllStyles(
        currentPage,
        pageSize,
        searchQuery || undefined,
        stageFilter,
        undefined,
        undefined,
        statusParam
      );
      setStyles(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalStyles(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load styles', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, stageFilter, statusFilter]);

  // ✅ FIX: Add location.key to refetch when navigating back (e.g., after CAD changes)
  useEffect(() => {
    fetchStyles();
  }, [fetchStyles, location.key]);

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
      handleApiSuccess(
        'Style archived',
        `Style ${styleToDelete.styleCode} has been archived. You can restore it from the Inactive tab.`
      );
      fetchStyles();
      fetchDraftStyles();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete style');
    } finally {
      setStyleToDelete(null);
    }
  };

  const handlePublishClick = (id: string, styleCode: string) => {
    setStyleToPublish({ id, styleCode });
    setPublishDialogOpen(true);
  };

  const confirmPublish = async () => {
    if (!styleToPublish) return;

    setPublishing(true);
    try {
      await styleService.publishDraft(styleToPublish.id);
      handleApiSuccess(
        'Style published',
        `Style ${styleToPublish.styleCode} has been published and is now available for orders.`
      );
      fetchStyles();
      fetchDraftStyles();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to publish style');
    } finally {
      setPublishing(false);
      setStyleToPublish(null);
      setPublishDialogOpen(false);
    }
  };

  // Fetch deleted styles
  const fetchDeletedStyles = useCallback(async () => {
    try {
      setIsLoadingDeleted(true);
      setErrorDeleted(null);
      const response = await styleService.getDeletedStyles(
        deletedCurrentPage,
        pageSize,
        deletedSearchQuery || undefined
      );
      setDeletedStyles(response.data);
      setDeletedTotalPages(response.pagination.totalPages);
      setDeletedTotalStyles(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load deleted styles', false);
      setErrorDeleted(errorMessage);
    } finally {
      setIsLoadingDeleted(false);
    }
  }, [deletedCurrentPage, pageSize, deletedSearchQuery]);

  // Fetch draft styles
  const fetchDraftStyles = useCallback(async () => {
    try {
      setIsLoadingDrafts(true);
      setErrorDrafts(null);
      const response = await styleService.getAllStyles(
        draftCurrentPage,
        pageSize,
        draftSearchQuery || undefined,
        undefined,
        undefined,
        undefined,
        'DRAFT'
      );
      setDraftStyles(response.data);
      setDraftTotalPages(response.pagination.totalPages);
      setDraftTotalStyles(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load draft styles', false);
      setErrorDrafts(errorMessage);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [draftCurrentPage, pageSize, draftSearchQuery]);

  // Fetch draft count on mount, and full data when tab is active
  useEffect(() => {
    fetchDraftStyles();
  }, [fetchDraftStyles]);

  // Load deleted styles when tab changes or pagination/search changes
  useEffect(() => {
    if (activeTab === 'deleted') {
      fetchDeletedStyles();
    }
  }, [activeTab, fetchDeletedStyles]);

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
      fetchStyles();
      fetchDraftStyles();
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
      handleApiSuccess(
        'Style permanently deleted',
        `Style ${styleToPermanentDelete.styleCode} has been permanently deleted. This cannot be undone.`
      );
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
          const greigeName = fab.genericGreigeName || fab.fabric?.genericGreigeName || fab.fabric?.fabricName;
          const finishType = fab.fabricFinishType || '';
          const designColor = fab.printDesign || fab.colorMaster?.colorName || '';

          // Build display: "PRINTED Floral • Cambric" or "DYED Red • Cotton"
          let displayName = '';
          if (finishType) {
            displayName = finishType;
            if (designColor) displayName += ` ${designColor}`;
            if (greigeName) displayName += ` • ${greigeName}`;
          } else {
            displayName = greigeName || '';
          }

          if (displayName && !fabricNames.includes(displayName)) {
            fabricNames.push(displayName);
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
    const cost = style.costPerPiece || style.costing?.totalCostPerPiece;
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
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.innerHTML =
                    '<div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-muted-foreground text-xs">No Image</div>';
                }
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-muted-foreground text-xs">
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{style.styleCode}</span>
            {style.status === 'DRAFT' && (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                Draft
              </Badge>
            )}
          </div>
          {style.styleName && (
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">{style.styleName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer / Brand',
      render: (style) => (
        <div>
          <div className="text-sm text-foreground">{style.customerName}</div>
          <div className="text-xs text-muted-foreground">{style.brandName}</div>
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (style) => (
        <div className="text-sm text-foreground max-w-[150px] truncate" title={getFabricNames(style)}>
          {getFabricNames(style)}
        </div>
      ),
    },
    {
      key: 'productCategory',
      header: 'Product Category',
      render: (style) => <div className="text-sm text-foreground">{style.productCategory?.name || '-'}</div>,
    },
    {
      key: 'components',
      header: 'Components',
      render: (style) => (
        <div className="text-sm text-foreground text-center">
          {style.numberOfComponents || style.components?.length || '-'}
        </div>
      ),
    },
    {
      key: 'componentName',
      header: 'Component Name',
      render: (style) => {
        const componentNames = style.components?.map((c) => c.componentName).filter(Boolean) || [];
        if (componentNames.length === 0) return <div className="text-sm text-muted-foreground">-</div>;
        return <div className="text-sm text-foreground">{componentNames.join(', ')}</div>;
      },
    },
    {
      key: 'cadStatus',
      header: 'CAD Status',
      render: (style) => (
        <CADStatusBadge
          status={
            ((style as Style & { effectiveCadStatus?: CADStatus }).effectiveCadStatus ?? style.cadStatus) ||
            CADStatus.PENDING
          }
          size="sm"
        />
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (style) => <div className="text-sm text-foreground font-medium">{getCost(style)}</div>,
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

  // Define columns for Drafts DataTable (adds Publish button)
  const draftColumns: Column<Style>[] = [
    ...columns.slice(0, -1),
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
          {canCreateEdit && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handlePublishClick(style.id, style.styleCode);
              }}
              disabled={publishing}
              className="flex items-center gap-1 bg-success hover:bg-success text-white"
            >
              <Send className="h-3 w-3" />
              Publish
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
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.innerHTML =
                    '<div class="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-muted-foreground text-xs">No Image</div>';
                }
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-muted-foreground text-xs">
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
          <div className="text-sm font-medium text-muted-foreground">{style.styleCode}</div>
          {style.internalCode && <div className="text-xs text-muted-foreground">{style.internalCode}</div>}
        </div>
      ),
    },
    {
      key: 'styleName',
      header: 'Style Name',
      render: (style) => (
        <div>
          <div className="text-sm text-muted-foreground">{style.styleName}</div>
          {style.description && (
            <div className="text-xs text-muted-foreground truncate max-w-xs">{style.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer / Brand',
      render: (style) => (
        <div>
          <div className="text-sm text-muted-foreground">{style.customerName}</div>
          <div className="text-xs text-muted-foreground">{style.brandName}</div>
        </div>
      ),
    },
    {
      key: 'deletedAt',
      header: 'Deleted',
      render: (style) => (
        <div className="text-sm text-muted-foreground">
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
              <CardTitle className="text-2xl">Style Master</CardTitle>
              <CardDescription>
                {stageFilter
                  ? `Showing styles in stage: ${PRODUCTION_STAGE_LABELS[stageFilter as keyof typeof PRODUCTION_STAGE_LABELS] || stageFilter}`
                  : activeTab === 'deleted'
                    ? `Inactive/archived styles (${deletedTotalStyles} total)`
                    : activeTab === 'drafts'
                      ? `Unpublished styles in progress (${draftTotalStyles} total)`
                      : statusFilter === 'ALL'
                        ? `All styles - active and drafts (${totalStyles} total)`
                        : statusFilter === 'DRAFT'
                          ? `Draft styles only (${totalStyles} total)`
                          : `Published garment styles (${totalStyles} total)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportButton module="styles" filters={{ stage: stageFilter }} />
              {canCreateEdit && activeTab !== 'deleted' && (
                <>
                  <Button variant="outline" onClick={() => navigate('/styles/import')}>
                    Bulk Import
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/reports/style-fabric')}>
                    Stock Report
                  </Button>
                  <Button onClick={() => navigate('/styles/new')}>+ Create New Style</Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Active/Deleted Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'active' | 'drafts' | 'deleted')}
            className="mb-6"
          >
            <TabsList>
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Shirt className="h-4 w-4" />
                Active Styles
                <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">{totalStyles}</span>
              </TabsTrigger>
              <TabsTrigger value="drafts" className="flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                Drafts
                {draftTotalStyles > 0 && (
                  <span className="ml-1 text-xs bg-warning-muted0/10 text-warning px-2 py-0.5 rounded-full">
                    {draftTotalStyles}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="deleted" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Inactive
                {deletedTotalStyles > 0 && (
                  <span className="ml-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                    {deletedTotalStyles}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Active Styles Tab */}
            <TabsContent value="active" className="mt-6">
              {/* Search Bar with Status Filter */}
              <div className="mb-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <SearchInput
                      placeholder="Search by style code, name, buyer, or brand..."
                      value={searchQuery}
                      onChange={setSearchQuery}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'ALL' | 'ACTIVE' | 'DRAFT')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Styles</SelectItem>
                      <SelectItem value="ACTIVE">Active Only</SelectItem>
                      <SelectItem value="DRAFT">Drafts Only</SelectItem>
                    </SelectContent>
                  </Select>
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
                  description:
                    searchQuery || stageFilter
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
            </TabsContent>

            {/* Drafts Tab */}
            <TabsContent value="drafts" className="mt-6">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <SearchInput
                      placeholder="Search draft styles by code, name, buyer, or brand..."
                      value={draftSearchQuery}
                      onChange={setDraftSearchQuery}
                    />
                  </div>
                </div>
              </div>

              {/* Drafts DataTable */}
              <DataTable
                data={draftStyles}
                columns={draftColumns}
                keyExtractor={(style) => style.id}
                loading={isLoadingDrafts}
                error={errorDrafts}
                emptyState={{
                  icon: <FileEdit className="h-16 w-16" />,
                  title: 'No draft styles',
                  description: draftSearchQuery
                    ? 'No draft styles match your search criteria'
                    : 'Draft styles will appear here. Create a new style to get started.',
                  actionLabel: canCreateEdit && !draftSearchQuery ? 'Create New Style' : undefined,
                  onAction: canCreateEdit && !draftSearchQuery ? () => navigate('/styles/new') : undefined,
                }}
                pagination={{
                  currentPage: draftCurrentPage,
                  totalPages: draftTotalPages,
                  pageSize,
                  totalItems: draftTotalStyles,
                  onPageChange: setDraftCurrentPage,
                  onPageSizeChange: setPageSize,
                }}
                onRowClick={(style) => navigate(`/styles/${style.id}`)}
              />
            </TabsContent>

            {/* Inactive Styles Tab */}
            <TabsContent value="deleted" className="mt-6">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <SearchInput
                      placeholder="Search inactive styles by code, name, or buyer..."
                      value={deletedSearchQuery}
                      onChange={setDeletedSearchQuery}
                    />
                  </div>
                </div>
              </div>

              {/* Inactive Styles DataTable */}
              <DataTable
                data={deletedStyles}
                columns={deletedColumns}
                keyExtractor={(style) => style.id}
                loading={isLoadingDeleted}
                error={errorDeleted}
                emptyState={{
                  icon: <Archive className="h-16 w-16" />,
                  title: 'No inactive styles',
                  description: deletedSearchQuery
                    ? 'No inactive styles match your search criteria'
                    : 'Inactive styles will appear here. You can restore them or permanently delete them.',
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
        </CardContent>
      </Card>

      {/* Archive (Soft Delete) Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Archive Style"
        description={`Are you sure you want to archive style ${styleToDelete?.styleCode}? You can restore it later from the Inactive tab.`}
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

      {/* Publish Confirmation Dialog */}
      <ConfirmDialog
        open={publishDialogOpen}
        onOpenChange={(open) => {
          setPublishDialogOpen(open);
          if (!open) setStyleToPublish(null);
        }}
        title="Publish Style"
        description={`Are you sure you want to publish style ${styleToPublish?.styleCode}? Once published, it will be available for orders and production planning.`}
        confirmText={publishing ? 'Publishing...' : 'Publish'}
        cancelText="Cancel"
        onConfirm={confirmPublish}
        variant="default"
      />

      {/* Blocked Deactivation Dialog */}
      <Dialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
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
