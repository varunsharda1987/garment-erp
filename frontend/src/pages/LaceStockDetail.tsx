/**
 * Lace Stock Detail Page
 * View stock details, allocations, and transaction history
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { laceStockService } from '../services/laceStock.service';
import type { LaceStock, LaceStockAllocation, LaceStockTransaction } from '../types/laceStock.types';
import {
  LACE_STOCK_STATUS_COLORS,
  LACE_STOCK_STATUS_LABELS,
  LACE_QUALITY_GRADE_COLORS,
  LACE_STOCK_TYPE_LABELS,
  LACE_TRANSACTION_TYPE_LABELS,
  AGING_BUCKET_COLORS,
} from '../types/laceStock.types';
import { notify } from '../lib/notify';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';
import { ArrowLeft, Package, ArrowRightLeft, History, MapPin, DollarSign, Undo2 } from 'lucide-react';

export default function LaceStockDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [stock, setStock] = useState<LaceStock | null>(null);
  const [allocations, setAllocations] = useState<LaceStockAllocation[]>([]);
  const [transactions, setTransactions] = useState<LaceStockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'allocations' | 'history'>('overview');

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Return is allocation-scoped (backend route POST /lace-stock/allocations/:allocationId/return).
  // The row-level Return action in the Allocations tab selects which allocation to return.
  const [selectedAllocation, setSelectedAllocation] = useState<LaceStockAllocation | null>(null);

  // Form states
  const [transferForm, setTransferForm] = useState({
    toStyleId: '',
    toOrderId: '',
    quantityToTransfer: 0,
    transferNotes: '',
  });
  const [returnForm, setReturnForm] = useState({
    quantityToReturn: 0,
    notes: '',
  });

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // getLaceStockById already returns allocations on the stock object. There is no
      // GET /lace-stock/:id/allocations route, so calling it 404'd inside the Promise.all
      // and the shared catch nulled the whole page ('Stock not found'). Read allocations
      // from the stock response instead.
      const [stockData, transactionsData] = await Promise.all([
        laceStockService.getLaceStockById(id),
        laceStockService.getStockTransactions(id),
      ]);
      setStock(stockData);
      setAllocations(stockData.allocations ?? []);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Failed to fetch stock details:', error);
      notify.error('Failed to load stock details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAgingBucket = (days: number): string => {
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
  };

  const handleTransfer = async () => {
    if (!id || !stock) return;
    if (transferForm.quantityToTransfer <= 0 || transferForm.quantityToTransfer > stock.quantityAvailable) {
      notify.error('Invalid transfer quantity');
      return;
    }
    if (!transferForm.toStyleId || !transferForm.toOrderId) {
      notify.error('Please select target style and order');
      return;
    }

    setProcessing(true);
    try {
      await laceStockService.transferStock(id, transferForm);
      notify.success('Stock transferred successfully');
      setShowTransferModal(false);
      setTransferForm({ toStyleId: '', toOrderId: '', quantityToTransfer: 0, transferNotes: '' });
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      notify.error(err.response?.data?.error || 'Failed to transfer stock');
    } finally {
      setProcessing(false);
    }
  };

  // Unused-but-not-yet-consumed quantity that can be returned for a given allocation.
  const getReturnableQty = (alloc: LaceStockAllocation) =>
    alloc.quantityAllocated - alloc.quantityConsumed - alloc.quantityReturned;

  const openReturnModal = (alloc: LaceStockAllocation) => {
    setSelectedAllocation(alloc);
    setReturnForm({ quantityToReturn: 0, notes: '' });
    setShowReturnModal(true);
  };

  const handleReturn = async () => {
    if (!id || !selectedAllocation) return;
    const maxReturnable = getReturnableQty(selectedAllocation);
    if (returnForm.quantityToReturn <= 0 || returnForm.quantityToReturn > maxReturnable) {
      notify.error('Invalid return quantity');
      return;
    }

    setProcessing(true);
    try {
      await laceStockService.returnStock(selectedAllocation.id, returnForm);
      notify.success('Stock returned successfully');
      setShowReturnModal(false);
      setSelectedAllocation(null);
      setReturnForm({ quantityToReturn: 0, notes: '' });
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      notify.error(err.response?.data?.error || 'Failed to return stock');
    } finally {
      setProcessing(false);
    }
  };

  // NOTE: Quality downgrade (A -> B/DEFECT) was removed here. No backend
  // POST /lace-stock/:id/downgrade route or service method exists, so the old
  // Downgrade button 404'd every time. Deferred as a real build (see wave notes).

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Stock not found</div>
      </div>
    );
  }

  const agingBucket = getAgingBucket(stock.agingDays);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/lace-stock')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-medium">{stock.laceMaster?.laceName || 'Unknown Lace'}</h1>
          <p className="text-muted-foreground font-mono">
            {stock.laceMaster?.laceCode || ''}
            {stock.lotNumber && ` / Lot: ${stock.lotNumber}`}
            {stock.dyeLotNumber && ` / Dye Lot: ${stock.dyeLotNumber}`}
          </p>
        </div>
        <div className="flex gap-2">
          {stock.status === 'AVAILABLE' && stock.quantityAvailable > 0 && (
            <Button onClick={() => setShowTransferModal(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Transfer
            </Button>
          )}
          {/* Return is now a per-allocation action in the Allocations tab (backend route is
              allocation-scoped). Downgrade removed: no backend endpoint exists (deferred). */}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2 mb-6">
        <Badge className={`${LACE_STOCK_STATUS_COLORS[stock.status]} border text-sm`}>
          {LACE_STOCK_STATUS_LABELS[stock.status]}
        </Badge>
        <Badge className={`${LACE_QUALITY_GRADE_COLORS[stock.qualityGrade]} border text-sm`}>
          Grade {stock.qualityGrade}
        </Badge>
        <Badge className="bg-muted text-foreground border-border text-sm">
          {LACE_STOCK_TYPE_LABELS[stock.stockType]}
        </Badge>
        <Badge className={`${AGING_BUCKET_COLORS[agingBucket]} border text-sm`}>{stock.agingDays} days old</Badge>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 -mb-px border-b-2 ${
            activeTab === 'overview'
              ? 'border-info text-info'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          <Package className="h-4 w-4 inline-block mr-2" />
          Overview
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 ${
            activeTab === 'allocations'
              ? 'border-info text-info'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('allocations')}
        >
          <ArrowRightLeft className="h-4 w-4 inline-block mr-2" />
          Allocations ({allocations.length})
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 ${
            activeTab === 'history'
              ? 'border-info text-info'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('history')}
        >
          <History className="h-4 w-4 inline-block mr-2" />
          History ({transactions.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quantities Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock Quantities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Available</span>
                <span className="font-bold text-success text-lg">{stock.quantityAvailable.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Reserved</span>
                <span className="font-bold text-info">{stock.quantityReserved.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Consumed</span>
                <span className="font-bold text-muted-foreground">{stock.quantityConsumed.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Total Original</span>
                <span className="font-bold">
                  {(stock.quantityAvailable + stock.quantityReserved + stock.quantityConsumed).toLocaleString()}m
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cost Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Weighted Avg Cost</span>
                <span className="font-bold">{formatCurrency(stock.weightedAvgCost)}/m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Purchase Cost</span>
                <span className="font-bold">{formatCurrency(stock.purchaseCost)}/m</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Total Value (Available)</span>
                <span className="font-bold text-lg">
                  {formatCurrency(stock.quantityAvailable * stock.weightedAvgCost)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Origin Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Origin & Traceability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stock.originStyleCode && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Origin Style</span>
                  <span className="font-mono">
                    {stock.originStyleCode}
                    {stock.originBuyerStyleRef && (
                      <span className="ml-1 text-xs text-muted-foreground">({stock.originBuyerStyleRef})</span>
                    )}
                  </span>
                </div>
              )}
              {stock.originOrder && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Origin Order</span>
                  <span className="font-mono">{stock.originOrder.orderNumber}</span>
                </div>
              )}
              {stock.procurementId && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Procurement Ref</span>
                  <span className="font-mono text-sm">{stock.procurementId}</span>
                </div>
              )}
              {stock.processingBatchId && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Processing Batch</span>
                  <span className="font-mono text-sm">{stock.processingBatchId}</span>
                </div>
              )}
              {!stock.originStyleCode && !stock.procurementId && (
                <div className="text-muted-foreground text-center py-4">Generic stock - no origin tracking</div>
              )}
            </CardContent>
          </Card>

          {/* Location & Dates Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location & Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Warehouse</span>
                <span>{stock.warehouseLocation || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Rack</span>
                <span>{stock.rackNumber || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Received Date</span>
                <span>{formatDate(stock.receivedDate)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Last Consumed</span>
                <span>{formatDate(stock.lastConsumedDate)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'allocations' && (
        <Card>
          <CardContent className="p-0">
            {allocations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No allocations found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Style</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Order</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Allocated
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Consumed
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-muted">
                        <td className="px-4 py-4">
                          <span className="font-mono">
                            {alloc.styleCode}
                            {alloc.style?.buyerStyleRef && (
                              <span className="ml-1 text-xs text-muted-foreground">({alloc.style.buyerStyleRef})</span>
                            )}
                          </span>
                          {alloc.originalStyleCode && alloc.originalStyleCode !== alloc.styleCode && (
                            <div className="text-xs text-muted-foreground">From: {alloc.originalStyleCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">{alloc.order?.orderNumber || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <Badge className="bg-muted text-foreground">{alloc.allocationType.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-4 text-right">{alloc.quantityAllocated.toLocaleString()}m</td>
                        <td className="px-4 py-4 text-right">{alloc.quantityConsumed.toLocaleString()}m</td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            className={
                              alloc.allocationStatus === 'CONSUMED'
                                ? 'bg-muted text-foreground'
                                : alloc.allocationStatus === 'IN_USE'
                                  ? 'bg-info-muted text-info'
                                  : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {alloc.allocationStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm">{formatDate(alloc.createdAt)}</td>
                        <td className="px-4 py-4 text-right">
                          {getReturnableQty(alloc) > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReturnModal(alloc)}
                              title="Return unused stock to available"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No transaction history</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {transactions.map((txn) => (
                  <div key={txn.id} className="p-4 hover:bg-muted">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            txn.transactionType.includes('IN') || txn.transactionType === 'RETURN'
                              ? 'bg-success-muted text-success'
                              : txn.transactionType.includes('OUT') || txn.transactionType === 'CONSUMPTION'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-foreground'
                          }
                        >
                          {LACE_TRANSACTION_TYPE_LABELS[txn.transactionType]}
                        </Badge>
                        <span className="font-medium">
                          {txn.transactionType.includes('OUT') || txn.transactionType === 'CONSUMPTION'
                            ? `-${txn.quantity.toLocaleString()}m`
                            : `+${txn.quantity.toLocaleString()}m`}
                        </span>
                        <span className="text-muted-foreground">→ Balance: {txn.balanceAfter.toLocaleString()}m</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatDateTime(txn.transactionDate)}</span>
                    </div>
                    {(txn.fromStyleCode || txn.toStyleCode || txn.notes) && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {txn.fromStyleCode && txn.toStyleCode && (
                          <span>
                            Transfer: {txn.fromStyleCode} → {txn.toStyleCode}
                          </span>
                        )}
                        {txn.notes && <span className="ml-4">{txn.notes}</span>}
                      </div>
                    )}
                    {txn.performedBy && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        By: {txn.performedBy.firstName} {txn.performedBy.lastName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">Available: {stock.quantityAvailable.toLocaleString()}m</div>
            <div>
              <Label>Target Style ID</Label>
              <Input
                value={transferForm.toStyleId}
                onChange={(e) => setTransferForm({ ...transferForm, toStyleId: e.target.value })}
                placeholder="Enter style ID"
              />
            </div>
            <div>
              <Label>Target Order ID</Label>
              <Input
                value={transferForm.toOrderId}
                onChange={(e) => setTransferForm({ ...transferForm, toOrderId: e.target.value })}
                placeholder="Enter order ID"
              />
            </div>
            <div>
              <Label>Quantity (meters)</Label>
              <Input
                type="number"
                value={transferForm.quantityToTransfer || ''}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    quantityToTransfer: parseFloat(e.target.value) || 0,
                  })
                }
                max={stock.quantityAvailable}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={transferForm.transferNotes}
                onChange={(e) => setTransferForm({ ...transferForm, transferNotes: e.target.value })}
                placeholder="Transfer reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={processing}>
              {processing ? 'Transferring...' : 'Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Modal (per-allocation) */}
      <Dialog
        open={showReturnModal}
        onOpenChange={(open) => {
          setShowReturnModal(open);
          if (!open) setSelectedAllocation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedAllocation && (
              <div className="text-sm text-muted-foreground">
                Allocation:{' '}
                {selectedAllocation.styleCode
                  ? formatStyleCodeWithRef(selectedAllocation.styleCode, selectedAllocation.style?.buyerStyleRef)
                  : selectedAllocation.styleId}{' '}
                &middot; Returnable: {getReturnableQty(selectedAllocation).toLocaleString()}m
              </div>
            )}
            <div>
              <Label>Quantity (meters)</Label>
              <Input
                type="number"
                value={returnForm.quantityToReturn || ''}
                onChange={(e) =>
                  setReturnForm({
                    ...returnForm,
                    quantityToReturn: parseFloat(e.target.value) || 0,
                  })
                }
                max={selectedAllocation ? getReturnableQty(selectedAllocation) : undefined}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={returnForm.notes}
                onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                placeholder="Return reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReturnModal(false);
                setSelectedAllocation(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReturn} disabled={processing}>
              {processing ? 'Returning...' : 'Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
