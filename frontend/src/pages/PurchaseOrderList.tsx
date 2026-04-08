/**
 * Unified Purchase Order List
 * Shows all Material, Processing, and Service POs in one page
 * with stats cards, tab-based filtering, and contextual actions
 */

import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import SearchInput from '@/components/SearchInput';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  getAllPurchaseOrders,
  getPOStats,
  deletePurchaseOrder,
  cancelPurchaseOrder,
} from '@/services/purchaseOrder.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { PurchaseOrderStatus, POSource, PurchaseOrderFilters, POStats } from '@/types/purchaseOrder.types';
import {
  PurchaseOrderStatusLabels,
  POSourceLabels,
  POSourceColors,
  PO_GROUP_CATEGORIES,
  PO_CATEGORY_LABELS,
  PO_CATEGORY_COLORS,
  type POGroup,
} from '@/types/purchaseOrder.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { normalizeEnumRecord } from '@/lib/utils';
import {
  ShoppingBag,
  Clock,
  Truck,
  IndianRupee,
  Eye,
  Edit,
  Trash2,
  XCircle,
  MoreHorizontal,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Active tab from URL
  const activeTab = (searchParams.get('tab') || 'all') as POGroup;

  // URL param helpers
  const updateURLParams = (updates: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams, { replace: true });
  };

  // Filters from URL
  const filters = useMemo((): PurchaseOrderFilters => {
    const specificCategory = searchParams.get('poCategory') || undefined;
    let poCategories: string[] | undefined;

    if (specificCategory) {
      poCategories = [specificCategory];
    } else if (activeTab !== 'all') {
      poCategories = [...PO_GROUP_CATEGORIES[activeTab]];
    }

    return {
      status: (searchParams.get('status') as PurchaseOrderStatus) || undefined,
      source: (searchParams.get('source') as POSource) || undefined,
      poCategories,
      supplierId: searchParams.get('supplierId') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
  }, [searchParams, activeTab]);

  // ─── Queries ───────────────────────────────────────────────

  const { data: stats } = useListQuery<POStats>(queryKeys.purchaseOrders.stats(), getPOStats, { staleTime: 60 * 1000 });

  const { data: poResponse, isLoading } = useListQuery(
    queryKeys.purchaseOrders.list(filters as unknown as Record<string, unknown>),
    () => getAllPurchaseOrders(filters),
    { staleTime: 30 * 1000 }
  );

  const { data: suppliersResponse } = useListQuery(
    queryKeys.suppliers.list({ limit: 200 }),
    () => getAllSuppliers({ limit: 200 }),
    { staleTime: 5 * 60 * 1000 }
  );

  const purchaseOrders = poResponse?.data || [];
  const pagination = poResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const suppliers: Supplier[] = (suppliersResponse as { data?: Supplier[] })?.data || [];

  // ─── Computed Stats ────────────────────────────────────────

  // Normalize stats: humps.camelizeKeys converts enum keys (PROCESSING → processing)
  const normalizedStats = useMemo(() => {
    if (!stats) return null;
    return {
      bySource: normalizeEnumRecord(stats.bySource),
      byCategory: normalizeEnumRecord(stats.byCategory),
      byStatus: normalizeEnumRecord(stats.byStatus),
      totalValue: stats.totalValue,
    };
  }, [stats]);

  const tabCounts = useMemo(() => {
    if (!normalizedStats) return { all: 0, material: 0, processing: 0, service: 0 };
    const { byCategory } = normalizedStats;
    const sum = (cats: string[]) => cats.reduce((s, c) => s + (byCategory[c] || 0), 0);
    return {
      all: Object.values(byCategory).reduce((s, n) => s + n, 0),
      material: sum(PO_GROUP_CATEGORIES.material),
      processing: sum(PO_GROUP_CATEGORIES.processing),
      service: sum(PO_GROUP_CATEGORIES.service),
    };
  }, [normalizedStats]);

  const pendingAction = useMemo(() => {
    if (!normalizedStats) return 0;
    const s = normalizedStats.byStatus;
    return (s['DRAFT'] || 0) + (s['PENDING_GREIGE'] || 0) + (s['READY_FOR_PROCESSING'] || 0);
  }, [normalizedStats]);

  const awaitingDelivery = useMemo(() => {
    if (!normalizedStats) return 0;
    const s = normalizedStats.byStatus;
    return (s['SENT'] || 0) + (s['ACKNOWLEDGED'] || 0) + (s['PARTIALLY_RECEIVED'] || 0);
  }, [normalizedStats]);

  // Category options for current tab
  const categoryOptions = useMemo(() => {
    if (activeTab === 'all') return [];
    return PO_GROUP_CATEGORIES[activeTab].map((cat) => ({
      value: cat,
      label: PO_CATEGORY_LABELS[cat] || cat,
    }));
  }, [activeTab]);

  const hasActiveFilters = !!(
    searchParams.get('status') ||
    searchParams.get('source') ||
    searchParams.get('supplierId') ||
    searchParams.get('search') ||
    searchParams.get('poCategory')
  );

  // ─── Handlers ──────────────────────────────────────────────

  const handleTabChange = (tab: string) => {
    const newParams = new URLSearchParams();
    if (tab !== 'all') newParams.set('tab', tab);
    setSearchParams(newParams, { replace: true });
  };

  const handleClearFilters = () => {
    const newParams = new URLSearchParams();
    if (activeTab !== 'all') newParams.set('tab', activeTab);
    setSearchParams(newParams, { replace: true });
  };

  const handleDeleteClick = (id: string, poNumber: string) => {
    setSelectedPO({ id, poNumber });
    setDeleteDialogOpen(true);
  };

  const handleCancelClick = (id: string, poNumber: string) => {
    setSelectedPO({ id, poNumber });
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPO) return;
    try {
      await deletePurchaseOrder(selectedPO.id);
      handleApiSuccess('Purchase order deleted', `PO ${selectedPO.poNumber} has been deleted.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete purchase order');
    } finally {
      setSelectedPO(null);
      setDeleteDialogOpen(false);
    }
  };

  const confirmCancel = async () => {
    if (!selectedPO) return;
    try {
      await cancelPurchaseOrder(selectedPO.id, { reason: cancelReason });
      handleApiSuccess('Purchase order cancelled', `PO ${selectedPO.poNumber} has been cancelled.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
    } catch (err: unknown) {
      handleApiError(err, 'Failed to cancel purchase order');
    } finally {
      setSelectedPO(null);
      setCancelDialogOpen(false);
      setCancelReason('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'info';
      case 'ACKNOWLEDGED':
        return 'info';
      case 'PARTIALLY_RECEIVED':
        return 'warning';
      case 'RECEIVED':
        return 'success';
      case 'CANCELLED':
        return 'destructive';
      case 'PENDING_GREIGE':
        return 'warning';
      case 'READY_FOR_PROCESSING':
        return 'info';
      default:
        return 'secondary';
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-medium flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Purchase Orders
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/procurement/purchase-orders/new')}>
            <Plus className="h-4 w-4 mr-1" />
            Create PO
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total POs</p>
                <p className="text-2xl font-bold">{tabCounts.all}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Action</p>
                <p className="text-2xl font-bold">{pendingAction}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Awaiting Delivery</p>
                <p className="text-2xl font-bold">{awaitingDelivery}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(normalizedStats?.totalValue || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All{' '}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {tabCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="material">
            Material{' '}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {tabCounts.material}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="processing">
            Processing{' '}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {tabCounts.processing}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="service">
            Service{' '}
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {tabCounts.service}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Shared content for all tabs */}
        <div className="mt-4 space-y-4">
          {/* Filter Bar */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <SearchInput
                    placeholder="Search by PO number or supplier..."
                    value={searchParams.get('search') || ''}
                    onChange={(value) => updateURLParams({ search: value || undefined, page: undefined })}
                  />
                </div>

                <Select
                  value={searchParams.get('status') || 'all'}
                  onValueChange={(v) => updateURLParams({ status: v === 'all' ? undefined : v, page: undefined })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                    <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="PENDING_GREIGE">Pending Greige</SelectItem>
                    <SelectItem value="READY_FOR_PROCESSING">Ready for Processing</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={searchParams.get('supplierId') || 'all'}
                  onValueChange={(v) => updateURLParams({ supplierId: v === 'all' ? undefined : v, page: undefined })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Source filter only on All tab */}
                {activeTab === 'all' && (
                  <Select
                    value={searchParams.get('source') || 'all'}
                    onValueChange={(v) => updateURLParams({ source: v === 'all' ? undefined : v, page: undefined })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="COST_SHEET">Cost Sheet</SelectItem>
                      <SelectItem value="MRP">MRP</SelectItem>
                      <SelectItem value="SERVICE_REQUIREMENT">Service</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Category filter on typed tabs */}
                {activeTab !== 'all' && categoryOptions.length > 2 && (
                  <Select
                    value={searchParams.get('poCategory') || 'all'}
                    onValueChange={(v) => updateURLParams({ poCategory: v === 'all' ? undefined : v, page: undefined })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>
              Showing {purchaseOrders.length} of {pagination.total} purchase orders
            </span>
          </div>

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {activeTab === 'all' && <TableHead>Source</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={activeTab === 'all' ? 9 : 8}
                        className="text-center py-12 text-muted-foreground"
                      >
                        Loading purchase orders...
                      </TableCell>
                    </TableRow>
                  ) : purchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeTab === 'all' ? 9 : 8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ShoppingBag className="h-12 w-12 opacity-50" />
                          <p className="text-lg font-medium">No purchase orders found</p>
                          <p className="text-sm">
                            {hasActiveFilters
                              ? 'Try adjusting your filters'
                              : 'Get started by creating your first purchase order'}
                          </p>
                          {!hasActiveFilters && (
                            <Button
                              variant="outline"
                              className="mt-2"
                              onClick={() => navigate('/procurement/purchase-orders/new')}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create Purchase Order
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchaseOrders.map((po) => (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}
                      >
                        {/* PO Number */}
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium text-info hover:underline">{po.poNumber}</span>
                            <div className="text-xs text-muted-foreground mt-0.5">{formatDate(po.poDate)}</div>
                          </div>
                        </TableCell>

                        {/* Supplier */}
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium">{po.supplier?.name || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">{po.supplier?.code}</div>
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          {po.poCategory && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PO_CATEGORY_COLORS[po.poCategory] || 'bg-muted text-muted-foreground'}`}
                            >
                              {PO_CATEGORY_LABELS[po.poCategory] || po.poCategory}
                            </span>
                          )}
                        </TableCell>

                        {/* Expected Delivery */}
                        <TableCell>
                          <span className="text-sm">{formatDate(po.expectedDeliveryDate)}</span>
                        </TableCell>

                        {/* Items */}
                        <TableCell className="text-center">
                          <span className="text-sm">{po.itemCount || po.items?.length || 0}</span>
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-right">
                          <span className="text-sm font-medium">{formatCurrency(po.totalAmount)}</span>
                        </TableCell>

                        {/* Source (All tab only) */}
                        {activeTab === 'all' && (
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${po.poSource ? POSourceColors[po.poSource] : 'bg-muted text-muted-foreground'}`}
                            >
                              {po.poSource ? POSourceLabels[po.poSource] : 'Unknown'}
                            </span>
                          </TableCell>
                        )}

                        {/* Status */}
                        <TableCell>
                          <StatusBadge
                            status={PurchaseOrderStatusLabels[po.status]}
                            variant={getStatusVariant(po.status)}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/procurement/purchase-orders/${po.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>

                              {po.status === 'DRAFT' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/procurement/purchase-orders/${po.id}/edit`);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(po.id, po.poNumber);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}

                              {po.status !== 'DRAFT' && po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelClick(po.id, po.poNumber);
                                    }}
                                    className="text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel PO
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => updateURLParams({ page: String(pagination.page - 1) })}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateURLParams({ page: String(pagination.page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Purchase Order"
        description={`Are you sure you want to delete PO ${selectedPO?.poNumber}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Cancel Confirmation Dialog with Reason */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel PO {selectedPO?.poNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              Cancellation Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Please provide a reason for cancelling this purchase order..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              disabled={!cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
