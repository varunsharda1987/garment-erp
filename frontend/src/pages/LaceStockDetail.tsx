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
import {
  ArrowLeft,
  Package,
  ArrowRightLeft,
  History,
  AlertTriangle,
  MapPin,
  DollarSign,
  Undo2,
  TrendingDown,
} from 'lucide-react';

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
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form states
  const [transferForm, setTransferForm] = useState({
    toStyleId: '',
    toOrderId: '',
    quantity: 0,
    transferNotes: '',
  });
  const [returnForm, setReturnForm] = useState({
    quantity: 0,
    notes: '',
  });
  const [downgradeForm, setDowngradeForm] = useState({
    newGrade: 'B' as 'B' | 'DEFECT',
    quantity: 0,
    reason: '',
  });

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [stockData, allocationsData, transactionsData] = await Promise.all([
        laceStockService.getLaceStockById(id),
        laceStockService.getStockAllocations(id),
        laceStockService.getStockTransactions(id),
      ]);
      setStock(stockData);
      setAllocations(allocationsData);
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
  }, [id]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
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
    if (transferForm.quantity <= 0 || transferForm.quantity > stock.quantityAvailable) {
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
      setTransferForm({ toStyleId: '', toOrderId: '', quantity: 0, transferNotes: '' });
      fetchData();
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to transfer stock');
    } finally {
      setProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!id || !stock) return;
    if (returnForm.quantity <= 0) {
      notify.error('Invalid return quantity');
      return;
    }

    setProcessing(true);
    try {
      await laceStockService.returnStock(id, returnForm);
      notify.success('Stock returned successfully');
      setShowReturnModal(false);
      setReturnForm({ quantity: 0, notes: '' });
      fetchData();
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to return stock');
    } finally {
      setProcessing(false);
    }
  };

  const handleDowngrade = async () => {
    if (!id || !stock) return;
    if (downgradeForm.quantity <= 0 || downgradeForm.quantity > stock.quantityAvailable) {
      notify.error('Invalid quantity');
      return;
    }
    if (!downgradeForm.reason) {
      notify.error('Please provide a reason');
      return;
    }

    setProcessing(true);
    try {
      await laceStockService.downgradeQuality(id, downgradeForm);
      notify.success('Quality grade updated');
      setShowDowngradeModal(false);
      setDowngradeForm({ newGrade: 'B', quantity: 0, reason: '' });
      fetchData();
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to downgrade quality');
    } finally {
      setProcessing(false);
    }
  };

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
        <div className="text-center py-12 text-gray-500">Stock not found</div>
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
          <h1 className="text-2xl font-bold">{stock.laceMaster?.laceName || 'Unknown Lace'}</h1>
          <p className="text-gray-500 font-mono">
            {stock.laceMaster?.laceCode || ''}
            {stock.lotNumber && ` / Lot: ${stock.lotNumber}`}
            {stock.dyeLotNumber && ` / Dye Lot: ${stock.dyeLotNumber}`}
          </p>
        </div>
        <div className="flex gap-2">
          {stock.status === 'AVAILABLE' && stock.quantityAvailable > 0 && (
            <>
              <Button onClick={() => setShowTransferModal(true)}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer
              </Button>
              {stock.qualityGrade === 'A' && (
                <Button variant="outline" onClick={() => setShowDowngradeModal(true)}>
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Downgrade
                </Button>
              )}
            </>
          )}
          {stock.status === 'ISSUED' && (
            <Button onClick={() => setShowReturnModal(true)}>
              <Undo2 className="h-4 w-4 mr-2" />
              Return
            </Button>
          )}
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
        <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-sm">
          {LACE_STOCK_TYPE_LABELS[stock.stockType]}
        </Badge>
        <Badge className={`${AGING_BUCKET_COLORS[agingBucket]} border text-sm`}>{stock.agingDays} days old</Badge>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 -mb-px border-b-2 ${
            activeTab === 'overview'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          <Package className="h-4 w-4 inline-block mr-2" />
          Overview
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 ${
            activeTab === 'allocations'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('allocations')}
        >
          <ArrowRightLeft className="h-4 w-4 inline-block mr-2" />
          Allocations ({allocations.length})
        </button>
        <button
          className={`px-4 py-2 -mb-px border-b-2 ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
                <span className="text-gray-500">Available</span>
                <span className="font-bold text-green-600 text-lg">{stock.quantityAvailable.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Reserved</span>
                <span className="font-bold text-blue-600">{stock.quantityReserved.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Consumed</span>
                <span className="font-bold text-gray-600">{stock.quantityConsumed.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Total Original</span>
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
                <span className="text-gray-500">Weighted Avg Cost</span>
                <span className="font-bold">{formatCurrency(stock.weightedAvgCost)}/m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Purchase Cost</span>
                <span className="font-bold">{formatCurrency(stock.purchaseCost)}/m</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Total Value (Available)</span>
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
                  <span className="text-gray-500">Origin Style</span>
                  <span className="font-mono">{stock.originStyleCode}</span>
                </div>
              )}
              {stock.originOrder && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-500">Origin Order</span>
                  <span className="font-mono">{stock.originOrder.orderNumber}</span>
                </div>
              )}
              {stock.procurementId && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-500">Procurement Ref</span>
                  <span className="font-mono text-sm">{stock.procurementId}</span>
                </div>
              )}
              {stock.processingBatchId && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-500">Processing Batch</span>
                  <span className="font-mono text-sm">{stock.processingBatchId}</span>
                </div>
              )}
              {!stock.originStyleCode && !stock.procurementId && (
                <div className="text-gray-400 text-center py-4">Generic stock - no origin tracking</div>
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
                <span className="text-gray-500">Warehouse</span>
                <span>{stock.warehouseLocation || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Rack</span>
                <span>{stock.rackNumber || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Received Date</span>
                <span>{formatDate(stock.receivedDate)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Last Consumed</span>
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
              <div className="text-center py-12 text-gray-500">No allocations found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Style</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Consumed</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <span className="font-mono">{alloc.styleCode}</span>
                          {alloc.originalStyleCode && alloc.originalStyleCode !== alloc.styleCode && (
                            <div className="text-xs text-gray-500">From: {alloc.originalStyleCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">{alloc.order?.orderNumber || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <Badge className="bg-gray-100 text-gray-800">{alloc.allocationType.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-4 text-right">{alloc.quantityAllocated.toLocaleString()}m</td>
                        <td className="px-4 py-4 text-right">{alloc.quantityConsumed.toLocaleString()}m</td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            className={
                              alloc.allocationStatus === 'CONSUMED'
                                ? 'bg-gray-100 text-gray-800'
                                : alloc.allocationStatus === 'IN_USE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {alloc.allocationStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm">{formatDate(alloc.createdAt)}</td>
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
              <div className="text-center py-12 text-gray-500">No transaction history</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {transactions.map((txn) => (
                  <div key={txn.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            txn.transactionType.includes('IN') || txn.transactionType === 'RETURN'
                              ? 'bg-green-100 text-green-800'
                              : txn.transactionType.includes('OUT') || txn.transactionType === 'CONSUMPTION'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {LACE_TRANSACTION_TYPE_LABELS[txn.transactionType]}
                        </Badge>
                        <span className="font-medium">
                          {txn.transactionType.includes('OUT') || txn.transactionType === 'CONSUMPTION'
                            ? `-${txn.quantity.toLocaleString()}m`
                            : `+${txn.quantity.toLocaleString()}m`}
                        </span>
                        <span className="text-gray-500">→ Balance: {txn.balanceAfter.toLocaleString()}m</span>
                      </div>
                      <span className="text-sm text-gray-500">{formatDateTime(txn.transactionDate)}</span>
                    </div>
                    {(txn.fromStyleCode || txn.toStyleCode || txn.notes) && (
                      <div className="mt-2 text-sm text-gray-600">
                        {txn.fromStyleCode && txn.toStyleCode && (
                          <span>
                            Transfer: {txn.fromStyleCode} → {txn.toStyleCode}
                          </span>
                        )}
                        {txn.notes && <span className="ml-4">{txn.notes}</span>}
                      </div>
                    )}
                    {txn.performedBy && (
                      <div className="mt-1 text-xs text-gray-400">
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
            <div className="text-sm text-gray-500">Available: {stock.quantityAvailable.toLocaleString()}m</div>
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
                value={transferForm.quantity || ''}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    quantity: parseFloat(e.target.value) || 0,
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

      {/* Return Modal */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Quantity (meters)</Label>
              <Input
                type="number"
                value={returnForm.quantity || ''}
                onChange={(e) =>
                  setReturnForm({
                    ...returnForm,
                    quantity: parseFloat(e.target.value) || 0,
                  })
                }
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
            <Button variant="outline" onClick={() => setShowReturnModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleReturn} disabled={processing}>
              {processing ? 'Returning...' : 'Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Downgrade Modal */}
      <Dialog open={showDowngradeModal} onOpenChange={setShowDowngradeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Downgrade Quality</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">This action cannot be undone</span>
            </div>
            <div>
              <Label>New Grade</Label>
              <select
                className="w-full border rounded p-2"
                value={downgradeForm.newGrade}
                onChange={(e) =>
                  setDowngradeForm({
                    ...downgradeForm,
                    newGrade: e.target.value as 'B' | 'DEFECT',
                  })
                }
              >
                <option value="B">Grade B</option>
                <option value="DEFECT">Defect</option>
              </select>
            </div>
            <div>
              <Label>Quantity (meters)</Label>
              <Input
                type="number"
                value={downgradeForm.quantity || ''}
                onChange={(e) =>
                  setDowngradeForm({
                    ...downgradeForm,
                    quantity: parseFloat(e.target.value) || 0,
                  })
                }
                max={stock.quantityAvailable}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={downgradeForm.reason}
                onChange={(e) => setDowngradeForm({ ...downgradeForm, reason: e.target.value })}
                placeholder="Reason for downgrade..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDowngradeModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDowngrade} disabled={processing}>
              {processing ? 'Processing...' : 'Downgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
