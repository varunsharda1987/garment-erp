import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getGRNById, approveGRN, rejectGRN } from '@/services/grn.service';
import type { GRN, GRNStatus } from '@/types/grn.types';
import { GRNStatusLabels } from '@/types/grn.types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  FileText,
} from 'lucide-react';

export default function GRNDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [grn, setGRN] = useState<GRN | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (id) {
      fetchGRN();
    }
  }, [id]);

  const fetchGRN = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getGRNById(id!);
      setGRN(data);
    } catch (err) {
      setError(handleApiError(err, 'Failed to fetch GRN', false));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await approveGRN(id!);
      handleApiSuccess('GRN approved', 'The goods have been accepted and stock has been updated.');
      fetchGRN();
    } catch (err) {
      handleApiError(err, 'Failed to approve GRN');
    } finally {
      setApproveDialogOpen(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      handleApiError(new Error('Please provide a rejection reason'), 'Validation Error');
      return;
    }

    try {
      await rejectGRN(id!, { reason: rejectReason });
      handleApiSuccess('GRN rejected', 'The GRN has been rejected.');
      fetchGRN();
    } catch (err) {
      handleApiError(err, 'Failed to reject GRN');
    } finally {
      setRejectDialogOpen(false);
      setRejectReason('');
    }
  };

  const getStatusVariant = (status: GRNStatus) => {
    switch (status) {
      case 'PENDING_QC':
        return 'warning';
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      case 'PARTIALLY_ACCEPTED':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-8">Loading GRN details...</div>
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">{error || 'GRN not found'}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/procurement/grn')}>Back to GRNs</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canApprove = grn.status === 'PENDING_QC';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/procurement/grn')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{grn.grnNumber}</h1>
            <p className="text-sm text-gray-500">
              Received on {formatDate(grn.receivingDate)}
            </p>
          </div>
          <StatusBadge
            status={GRNStatusLabels[grn.status]}
            variant={getStatusVariant(grn.status)}
          />
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <>
              <Button onClick={() => setApproveDialogOpen(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
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
            <div className="text-sm text-gray-500">Total Items</div>
            <div className="text-2xl font-bold">{grn.items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Received</div>
            <div className="text-2xl font-bold">
              {grn.items
                ?.reduce((sum, item) => sum + Number(item.receivedQuantity), 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Accepted</div>
            <div className="text-2xl font-bold text-green-600">
              {grn.items
                ?.reduce((sum, item) => sum + Number(item.acceptedQuantity), 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-500">Total Rejected</div>
            <div className="text-2xl font-bold text-red-600">
              {grn.items
                ?.reduce((sum, item) => sum + Number(item.rejectedQuantity), 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PO & Supplier Info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Purchase Order</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">PO Number:</span>
                  <button
                    onClick={() => navigate(`/procurement/purchase-orders/${grn.poId}`)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {grn.purchaseOrder?.poNumber}
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expected Delivery:</span>
                  <span>{formatDate(grn.purchaseOrder?.expectedDeliveryDate || null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">PO Status:</span>
                  <span>{grn.purchaseOrder?.status}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Supplier</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-medium">{grn.supplier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Code:</span>
                  <span>{grn.supplier?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact:</span>
                  <span>{grn.supplier?.contactPerson || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          {(grn.invoiceNumber || grn.invoiceDate) && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Invoice Number:</span>
                  <p className="font-medium">{grn.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Invoice Date:</span>
                  <p>{formatDate(grn.invoiceDate)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Received Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.materials?.code}</div>
                      <div className="text-sm text-gray-500">{item.materials?.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(item.orderedQuantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(item.receivedQuantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {Number(item.acceptedQuantity).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {Number(item.rejectedQuantity) > 0
                      ? Number(item.rejectedQuantity).toLocaleString()
                      : '-'}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {item.remarks || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Info */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-gray-500">Received By:</span>
              <p className="font-medium">
                {grn.receivedBy ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : '-'}
              </p>
              <p className="text-gray-500">
                {grn.receivedBy?.email}
              </p>
            </div>
            {grn.approvedById && (
              <div>
                <span className="text-gray-500">Approved/Rejected By:</span>
                <p className="font-medium">
                  {grn.approvedBy ? `${grn.approvedBy.firstName} ${grn.approvedBy.lastName}` : '-'}
                </p>
                <p className="text-gray-500">
                  {grn.approvedBy?.email}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {grn.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{grn.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve GRN"
        description={`Are you sure you want to approve GRN ${grn.grnNumber}? This will update the stock levels for all accepted items.`}
        confirmText="Approve"
        cancelText="Cancel"
        onConfirm={handleApprove}
      />

      {/* Reject Dialog */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reject GRN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to reject GRN {grn.grnNumber}? This will revert the received
                quantities on the purchase order.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection Reason *</label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectDialogOpen(false);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject}>
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
