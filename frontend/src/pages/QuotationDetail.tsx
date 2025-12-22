import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getQuotationById, updateQuotationStatus, deleteQuotation } from '@/services/quotation.service';
import type { Quotation, QuotationStatus } from '@/types/quotation.types';
import { QuotationStatusLabels } from '@/types/quotation.types';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ArrowLeft, FileText, Edit, Trash2, CheckCircle2, XCircle, Send } from 'lucide-react';

export default function QuotationDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStatus, setNewStatus] = useState<QuotationStatus>('SENT');

  useEffect(() => {
    if (id) {
      fetchQuotation(id);
    }
  }, [id]);

  const fetchQuotation = async (quotationId: string) => {
    try {
      setIsLoading(true);
      const data = await getQuotationById(quotationId);
      setQuotation(data);
    } catch (err) {
      handleApiError(err, 'Failed to load quotation');
      navigate('/quotations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!id || !quotation) return;

    try {
      setIsSubmitting(true);
      await updateQuotationStatus(id, { status: newStatus });
      handleApiSuccess(
        'Status updated',
        `Quotation status has been updated to ${QuotationStatusLabels[newStatus]}.`
      );
      setStatusDialogOpen(false);
      fetchQuotation(id);
    } catch (err) {
      handleApiError(err, 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteQuotation(id);
      handleApiSuccess('Quotation deleted', 'Quotation has been successfully deleted.');
      navigate('/quotations');
    } catch (err) {
      handleApiError(err, 'Failed to delete quotation');
    }
  };

  const formatAmount = (amount: number) => {
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'info';
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      case 'EXPIRED':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading quotation...</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-6">
        <div className="text-center">Quotation not found</div>
      </div>
    );
  }

  const canEdit = quotation.status === 'DRAFT';
  const canDelete = quotation.status === 'DRAFT';
  const canUpdateStatus = quotation.status !== 'ACCEPTED' && quotation.status !== 'REJECTED';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/quotations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quotation.quotationNumber}</h1>
              <p className="text-sm text-gray-500">Quotation Details</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quotation.status === 'DRAFT' && (
            <Button
              onClick={() => {
                setNewStatus('SENT');
                setStatusDialogOpen(true);
              }}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Mark as Sent
            </Button>
          )}
          {quotation.status === 'SENT' && (
            <>
              <Button
                onClick={() => {
                  setNewStatus('ACCEPTED');
                  setStatusDialogOpen(true);
                }}
                variant="outline"
                className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept
              </Button>
              <Button
                onClick={() => {
                  setNewStatus('REJECTED');
                  setStatusDialogOpen(true);
                }}
                variant="outline"
                className="gap-2 border-red-600 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/quotations/${id}/edit`)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Status and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={QuotationStatusLabels[quotation.status]} variant={getStatusVariant(quotation.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {quotation.totalAmount ? formatAmount(quotation.totalAmount) : 'N/A'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{quotation.quotationItems?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quotation Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quotation Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Quotation Date</p>
                <p className="text-sm text-gray-900">{formatDate(quotation.quotationDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Valid Until</p>
                <p
                  className={`text-sm font-medium ${
                    new Date(quotation.validUntil) < new Date() &&
                    quotation.status !== 'ACCEPTED' &&
                    quotation.status !== 'REJECTED'
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                >
                  {formatDate(quotation.validUntil)}
                </p>
              </div>
            </div>
            {quotation.remarks && (
              <div>
                <p className="text-sm font-medium text-gray-600">Remarks</p>
                <p className="text-sm text-gray-700">{quotation.remarks}</p>
              </div>
            )}
            {quotation.termsAndConditions && (
              <div>
                <p className="text-sm font-medium text-gray-600">Terms and Conditions</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.termsAndConditions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Customer</p>
              <p className="text-sm font-semibold text-gray-900">
                {quotation.customers?.billingName || quotation.customers?.name || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">{quotation.customers?.code}</p>
            </div>
            {quotation.customers?.email && (
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <p className="text-sm text-gray-900">{quotation.customers.email}</p>
              </div>
            )}
            {quotation.customers?.phone && (
              <div>
                <p className="text-sm font-medium text-gray-600">Phone</p>
                <p className="text-sm text-gray-900">{quotation.customers.phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Created By</p>
              <p className="text-sm text-gray-900">
                {quotation.createdBy ? `${quotation.createdBy.firstName} ${quotation.createdBy.lastName}` : 'N/A'}
              </p>
            </div>
            {quotation.approvedBy && (
              <div>
                <p className="text-sm font-medium text-gray-600">Approved By</p>
                <p className="text-sm text-gray-900">
                  {`${quotation.approvedBy.firstName} ${quotation.approvedBy.lastName}`}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Created At</p>
              <p className="text-sm text-gray-700">{formatDateTime(quotation.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotation Items */}
      {quotation.quotationItems && quotation.quotationItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quotation Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quotation.quotationItems.map((item, index) => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        Item {index + 1}: {item.styles?.styleCode} - {item.styles?.styleName}
                      </h4>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Quantity</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.totalQuantity.toLocaleString()} pcs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Unit Price</p>
                      <p className="text-sm font-semibold text-gray-900">{formatAmount(Number(item.unitPrice))}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Total Price</p>
                      <p className="text-sm font-semibold text-purple-600">{formatAmount(Number(item.totalPrice))}</p>
                    </div>
                    {item.deliveryDays && (
                      <div>
                        <p className="text-xs font-medium text-gray-600">Delivery</p>
                        <p className="text-sm text-gray-900">{item.deliveryDays} days</p>
                      </div>
                    )}
                  </div>
                  {item.remarks && (
                    <p className="text-xs text-gray-600 mt-2 pt-2 border-t">Note: {item.remarks}</p>
                  )}
                </div>
              ))}

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-4 border-t-2 border-gray-300">
                <div className="text-lg font-semibold text-gray-900">Total Amount:</div>
                <div className="text-2xl font-bold text-purple-600">
                  {quotation.totalAmount ? formatAmount(quotation.totalAmount) : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Quotation Status</DialogTitle>
            <DialogDescription>
              Change the status of quotation {quotation.quotationNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Current Status: <strong>{QuotationStatusLabels[quotation.status]}</strong>
              </p>
              <p className="text-sm text-gray-600">
                New Status: <strong>{QuotationStatusLabels[newStatus]}</strong>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Quotation"
        description={`Are you sure you want to delete quotation ${quotation.quotationNumber}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
