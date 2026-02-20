import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getPurchaseOrderById,
  sendPurchaseOrder,
  acknowledgePurchaseOrder,
  cancelPurchaseOrder,
} from '@/services/purchaseOrder.service';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/purchaseOrder.types';
import { PurchaseOrderStatusLabels, PurchaseOrderStatusColors } from '@/types/purchaseOrder.types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import {
  ArrowLeft,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  PackageOpen,
  Printer,
} from 'lucide-react';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder();
    }
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const po = await getPurchaseOrderById(id!);
      setPurchaseOrder(po);
    } catch (err) {
      setError(handleApiError(err, 'Failed to fetch purchase order', false));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      await sendPurchaseOrder(id!);
      handleApiSuccess('Purchase order sent', 'The purchase order has been sent to the supplier.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to send purchase order');
    } finally {
      setSendDialogOpen(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      await acknowledgePurchaseOrder(id!);
      handleApiSuccess('Purchase order acknowledged', 'The purchase order has been acknowledged.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to acknowledge purchase order');
    } finally {
      setAcknowledgeDialogOpen(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelPurchaseOrder(id!, { reason: 'Cancelled by user' });
      handleApiSuccess('Purchase order cancelled', 'The purchase order has been cancelled.');
      fetchPurchaseOrder();
    } catch (err) {
      handleApiError(err, 'Failed to cancel purchase order');
    } finally {
      setCancelDialogOpen(false);
    }
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
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateReceivingProgress = () => {
    if (!purchaseOrder?.purchaseOrderItems?.length) return 0;
    const totalOrdered = purchaseOrder.purchaseOrderItems.reduce(
      (sum, item) => sum + Number(item.orderedQuantity),
      0
    );
    const totalReceived = purchaseOrder.purchaseOrderItems.reduce(
      (sum, item) => sum + Number(item.receivedQuantity),
      0
    );
    return totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-8">Loading purchase order details...</div>
      </div>
    );
  }

  if (error || !purchaseOrder) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">{error || 'Purchase order not found'}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/procurement/purchase-orders')}>
                Back to Purchase Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const receivingProgress = calculateReceivingProgress();
  const canEdit = purchaseOrder.status === 'DRAFT';
  const canSend = purchaseOrder.status === 'DRAFT' || purchaseOrder.status === 'READY_FOR_PROCESSING';
  const canAcknowledge = purchaseOrder.status === 'SENT';
  const canReceive = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status);
  const canCancel = !['RECEIVED', 'CANCELLED'].includes(purchaseOrder.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/procurement/purchase-orders')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{purchaseOrder.poNumber}</h1>
            <p className="text-sm text-gray-500">
              Created on {formatDate(purchaseOrder.createdAt)}
            </p>
          </div>
          <StatusBadge
            status={PurchaseOrderStatusLabels[purchaseOrder.status]}
            variant={getStatusVariant(purchaseOrder.status)}
          />
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => navigate(`/procurement/purchase-orders/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canSend && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send to Supplier
            </Button>
          )}
          {canAcknowledge && (
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Acknowledge
            </Button>
          )}
          {canReceive && (
            <Button onClick={() => navigate(`/procurement/grn/new?poId=${id}`)}>
              <PackageOpen className="h-4 w-4 mr-2" />
              Receive Goods
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Amount</div>
            <div className="text-2xl font-bold">{formatCurrency(purchaseOrder.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Items</div>
            <div className="text-2xl font-bold">
              {purchaseOrder.purchaseOrderItems?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Expected Delivery</div>
            <div className="text-2xl font-bold">
              {formatDate(purchaseOrder.expectedDeliveryDate)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Receiving Progress</div>
            <div className="flex items-center gap-2">
              <Progress value={receivingProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium">{receivingProgress}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Info */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500">Supplier Name</div>
              <div className="font-medium">{purchaseOrder.suppliers?.name || '-'}</div>
              <div className="text-sm text-gray-500">
                {purchaseOrder.suppliers?.code}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Contact Person</div>
              <div className="font-medium">
                {purchaseOrder.suppliers?.contactPerson || '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-medium">{purchaseOrder.suppliers?.email || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Phone</div>
              <div className="font-medium">{purchaseOrder.suppliers?.phone || '-'}</div>
            </div>
          </div>
          {purchaseOrder.paymentTerms && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">Payment Terms</div>
              <div className="font-medium">{purchaseOrder.paymentTerms}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.purchaseOrderItems?.map((item) => {
                const pending = Number(item.orderedQuantity) - Number(item.receivedQuantity);
                const isFullyReceived = pending <= 0;
                const isPartiallyReceived = Number(item.receivedQuantity) > 0 && pending > 0;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.materials?.code}</div>
                        <div className="text-sm text-gray-500">
                          {item.materials?.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(item.orderedQuantity).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.receivedQuantity).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {pending > 0 ? pending.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(item.totalPrice))}
                    </TableCell>
                    <TableCell>
                      {isFullyReceived ? (
                        <span className="text-green-600 text-sm">Received</span>
                      ) : isPartiallyReceived ? (
                        <span className="text-yellow-600 text-sm">Partial</span>
                      ) : (
                        <span className="text-gray-500 text-sm">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Total */}
          <div className="flex justify-end mt-4 pt-4 border-t">
            <div className="text-right">
              <div className="text-sm text-gray-500">Grand Total</div>
              <div className="text-2xl font-bold">
                {formatCurrency(purchaseOrder.totalAmount)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receiving History */}
      {purchaseOrder.goodsReceivingNotes && purchaseOrder.goodsReceivingNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Receiving History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.goodsReceivingNotes.map((grn) => {
                  const totalReceived = grn.grnItems?.reduce(
                    (sum, item) => sum + Number(item.receivedQuantity),
                    0
                  ) || 0;

                  return (
                    <TableRow key={grn.id}>
                      <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                      <TableCell>{formatDate(grn.receivingDate)}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">{totalReceived.toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={grn.status}
                          variant={grn.status === 'ACCEPTED' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/procurement/grn/${grn.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {purchaseOrder.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{purchaseOrder.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        title="Send Purchase Order"
        description={`Are you sure you want to send PO ${purchaseOrder.poNumber} to the supplier? This will change the status to "Sent".`}
        confirmText="Send"
        cancelText="Cancel"
        onConfirm={handleSend}
      />

      <ConfirmDialog
        open={acknowledgeDialogOpen}
        onOpenChange={setAcknowledgeDialogOpen}
        title="Acknowledge Purchase Order"
        description={`Mark PO ${purchaseOrder.poNumber} as acknowledged by the supplier?`}
        confirmText="Acknowledge"
        cancelText="Cancel"
        onConfirm={handleAcknowledge}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Purchase Order"
        description={`Are you sure you want to cancel PO ${purchaseOrder.poNumber}? This action cannot be undone.`}
        confirmText="Cancel Order"
        cancelText="Keep Order"
        onConfirm={handleCancel}
        variant="destructive"
      />
    </div>
  );
}
