// Stock Count Detail - Physical inventory count execution workflow
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ClipboardList,
  Warehouse,
  Calendar,
  User,
  Play,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Save,
  Loader2,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import stockCountService from '@/services/stockCount.service';
import type { StockCountItem, CountStatus } from '@/types/inventory.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

const STATUS_CONFIG: Record<
  CountStatus,
  { variant: 'secondary' | 'info' | 'warning' | 'success' | 'destructive'; label: string }
> = {
  DRAFT: { variant: 'secondary', label: 'Draft' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress' },
  COUNTED: { variant: 'info', label: 'Counted' },
  VERIFIED: { variant: 'warning', label: 'Verified' },
  APPROVED: { variant: 'success', label: 'Approved' },
  CANCELLED: { variant: 'destructive', label: 'Cancelled' },
};

const TYPE_LABELS: Record<string, string> = {
  FULL: 'Full Count',
  PARTIAL: 'Partial Count',
  CYCLE: 'Cycle Count',
  SPOT_CHECK: 'Spot Check',
};

interface EditingItem {
  itemId: string;
  physicalQuantity: string;
  remarks: string;
}

export default function StockCountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Editing state for items
  const [editingItems, setEditingItems] = useState<Record<string, EditingItem>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  // Dialog states
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Fetch stock count
  const {
    data: stockCount,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['stock-count', id],
    queryFn: () => stockCountService.getById(id!),
    enabled: !!id,
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => stockCountService.startCounting(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-count', id] });
      handleApiSuccess('Counting started');
      setStartDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to start counting'),
  });

  const verifyMutation = useMutation({
    mutationFn: () => stockCountService.verifyCount(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-count', id] });
      handleApiSuccess('Stock count verified');
      setVerifyDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to verify count'),
  });

  const approveMutation = useMutation({
    mutationFn: () => stockCountService.approveCount(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stock-count', id] });
      handleApiSuccess(`Stock count approved. ${data.adjustmentCount} adjustment(s) created.`);
      setApproveDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to approve count'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => stockCountService.cancelCount(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-count', id] });
      handleApiSuccess('Stock count cancelled');
      setCancelDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to cancel count'),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { physicalQuantity: number; remarks?: string } }) =>
      stockCountService.updateCountItem(id!, itemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock-count', id] });
      handleApiSuccess('Item updated');
      // Clear editing state for this item
      setEditingItems((prev) => {
        const next = { ...prev };
        delete next[variables.itemId];
        return next;
      });
      setSavingItemId(null);
    },
    onError: (err) => {
      handleApiError(err, 'Failed to update item');
      setSavingItemId(null);
    },
  });

  // Helpers
  const formatDate = (value: string | Date | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (value: string | Date | undefined) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatQty = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const getProgressPercentage = () => {
    if (!stockCount || stockCount.totalItems === 0) return 0;
    return (stockCount.countedItems / stockCount.totalItems) * 100;
  };

  const getVarianceStats = () => {
    if (!stockCount?.items) return { positive: 0, negative: 0, zero: 0 };

    let positive = 0,
      negative = 0,
      zero = 0;
    stockCount.items.forEach((item) => {
      if (item.variance === undefined || item.variance === null) return;
      if (item.variance > 0) positive++;
      else if (item.variance < 0) negative++;
      else zero++;
    });
    return { positive, negative, zero };
  };

  const canEdit = stockCount?.status === 'DRAFT' || stockCount?.status === 'IN_PROGRESS';

  // Handle item editing
  const startEditingItem = (item: StockCountItem) => {
    setEditingItems((prev) => ({
      ...prev,
      [item.id]: {
        itemId: item.id,
        physicalQuantity: item.physicalQuantity?.toString() ?? '',
        remarks: item.remarks ?? '',
      },
    }));
  };

  const updateEditingItem = (itemId: string, field: 'physicalQuantity' | 'remarks', value: string) => {
    setEditingItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const saveItem = (itemId: string) => {
    const editing = editingItems[itemId];
    if (!editing) return;

    const physicalQty = parseFloat(editing.physicalQuantity);
    if (isNaN(physicalQty) || physicalQty < 0) {
      handleApiError(new Error('Invalid quantity'), 'Please enter a valid quantity');
      return;
    }

    setSavingItemId(itemId);
    updateItemMutation.mutate({
      itemId,
      data: {
        physicalQuantity: physicalQty,
        remarks: editing.remarks || undefined,
      },
    });
  };

  const cancelEditingItem = (itemId: string) => {
    setEditingItems((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // Variance icon
  const VarianceIcon = ({ variance }: { variance: number | null | undefined }) => {
    if (variance === undefined || variance === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !stockCount) {
    return (
      <div className="container mx-auto py-6">
        <Button variant="ghost" onClick={() => navigate('/inventory/stock-counts')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stock Counts
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{error ? 'Failed to load stock count' : 'Stock count not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const varianceStats = getVarianceStats();
  const statusConfig = STATUS_CONFIG[stockCount.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/inventory/stock-counts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-display font-medium">{stockCount.countNumber}</h1>
              <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {TYPE_LABELS[stockCount.countType] || stockCount.countType} • {stockCount.totalItems} items
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {stockCount.status === 'DRAFT' && (
            <>
              <Button onClick={() => setStartDialogOpen(true)}>
                <Play className="h-4 w-4 mr-2" />
                Start Counting
              </Button>
              <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
          {stockCount.status === 'IN_PROGRESS' && (
            <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {stockCount.status === 'COUNTED' && (
            <>
              <Button onClick={() => setVerifyDialogOpen(true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Verify Count
              </Button>
              <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
          {stockCount.status === 'VERIFIED' && (
            <>
              <Button onClick={() => setApproveDialogOpen(true)}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Approve & Adjust Stock
              </Button>
              <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Warehouse className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Warehouse</p>
                <p className="font-medium">{stockCount.warehouses?.warehouseName || '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{stockCount.warehouses?.warehouseCode}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Count Date</p>
                <p className="font-medium">{formatDate(stockCount.countDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Counted By</p>
                <p className="font-medium">
                  {stockCount.countedBy ? `${stockCount.countedBy.firstName} ${stockCount.countedBy.lastName}` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {stockCount.countedItems}/{stockCount.totalItems}
                </span>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(getProgressPercentage())}% complete</span>
                <span>{stockCount.varianceItems} variance</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Variance Summary (when counting is done) */}
      {(stockCount.status === 'COUNTED' || stockCount.status === 'VERIFIED' || stockCount.status === 'APPROVED') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-success-muted rounded-lg">
                <TrendingUp className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-semibold text-success">{varianceStats.positive}</p>
                <p className="text-sm text-muted-foreground">Overage</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg">
                <TrendingDown className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-2xl font-semibold text-destructive">{varianceStats.negative}</p>
                <p className="text-sm text-muted-foreground">Shortage</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-semibold">{varianceStats.zero}</p>
                <p className="text-sm text-muted-foreground">Match</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Count Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stockCount.items || stockCount.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No items to count</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">System Qty</TableHead>
                    <TableHead className="text-right">Physical Qty</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Remarks</TableHead>
                    {canEdit && <TableHead className="text-center">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockCount.items.map((item) => {
                    const isEditing = !!editingItems[item.id];
                    const editing = editingItems[item.id];
                    const isSaving = savingItemId === item.id;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.materials?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.materials?.code || item.materialId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatQty(item.systemQuantity)}</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editing.physicalQuantity}
                              onChange={(e) => updateEditingItem(item.id, 'physicalQuantity', e.target.value)}
                              className="w-24 text-right font-mono"
                              disabled={isSaving}
                            />
                          ) : (
                            <span className="font-mono">
                              {item.physicalQuantity !== undefined && item.physicalQuantity !== null
                                ? formatQty(item.physicalQuantity)
                                : '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <VarianceIcon variance={item.variance} />
                            <span
                              className={`font-mono ${
                                item.variance === undefined || item.variance === null
                                  ? 'text-muted-foreground'
                                  : item.variance > 0
                                    ? 'text-success'
                                    : item.variance < 0
                                      ? 'text-destructive'
                                      : ''
                              }`}
                            >
                              {item.variance !== undefined && item.variance !== null
                                ? (item.variance > 0 ? '+' : '') + formatQty(item.variance)
                                : '-'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editing.remarks}
                              onChange={(e) => updateEditingItem(item.id, 'remarks', e.target.value)}
                              placeholder="Add remarks..."
                              className="w-40"
                              disabled={isSaving}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">{item.remarks || '-'}</span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" onClick={() => saveItem(item.id)} disabled={isSaving}>
                                  {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelEditingItem(item.id)}
                                  disabled={isSaving}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => startEditingItem(item)}>
                                Count
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail */}
      {(stockCount.verifiedAt || stockCount.approvedAt) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stockCount.verifiedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-warning" />
                  <span>
                    Verified by{' '}
                    <span className="font-medium">
                      {stockCount.verifiedBy
                        ? `${stockCount.verifiedBy.firstName} ${stockCount.verifiedBy.lastName}`
                        : 'Unknown'}
                    </span>{' '}
                    on {formatDateTime(stockCount.verifiedAt)}
                  </span>
                </div>
              )}
              {stockCount.approvedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  <span>
                    Approved by{' '}
                    <span className="font-medium">
                      {stockCount.approvedBy
                        ? `${stockCount.approvedBy.firstName} ${stockCount.approvedBy.lastName}`
                        : 'Unknown'}
                    </span>{' '}
                    on {formatDateTime(stockCount.approvedAt)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remarks */}
      {stockCount.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{stockCount.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        title="Start Counting"
        description={`This will change the status to "In Progress" and allow you to enter physical quantities for ${stockCount.totalItems} items. Continue?`}
        confirmText="Start Counting"
        onConfirm={() => startMutation.mutate()}
        isLoading={startMutation.isPending}
      />

      <ConfirmDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        title="Verify Stock Count"
        description={`You are about to verify this stock count with ${stockCount.varianceItems} variance item(s). This will mark it ready for approval.`}
        confirmText="Verify Count"
        onConfirm={() => verifyMutation.mutate()}
        isLoading={verifyMutation.isPending}
      />

      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve & Adjust Stock"
        description={`Approving this count will automatically create stock adjustment entries for ${stockCount.varianceItems} item(s) with variance. This action cannot be undone.`}
        confirmText="Approve & Adjust"
        variant="default"
        onConfirm={() => approveMutation.mutate()}
        isLoading={approveMutation.isPending}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Stock Count"
        description="Are you sure you want to cancel this stock count? This action cannot be undone."
        confirmText="Cancel Count"
        variant="destructive"
        onConfirm={() => cancelMutation.mutate()}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
