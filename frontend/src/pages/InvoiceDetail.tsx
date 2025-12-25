import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getInvoiceById, recordPayment, deleteInvoice } from '@/services/invoice.service';
import type { Invoice, PaymentMethod } from '@/types/invoice.types';
import { InvoiceStatusLabels, PaymentMethodLabels } from '@/types/invoice.types';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, FileText, CreditCard, Trash2, Edit, Download } from 'lucide-react';

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  useEffect(() => {
    if (id) {
      fetchInvoice(id);
    }
  }, [id]);

  const fetchInvoice = async (invoiceId: string) => {
    try {
      setIsLoading(true);
      const data = await getInvoiceById(invoiceId);
      setInvoice(data);
    } catch (err) {
      handleApiError(err, 'Failed to load invoice');
      navigate('/invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !invoice) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > invoice.balanceAmount) {
      handleApiError(
        new Error(`Payment amount must be between 0 and ${invoice.balanceAmount}`),
        'Invalid Amount'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await recordPayment(id, {
        amount,
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        remarks: paymentRemarks.trim() || undefined,
      });

      handleApiSuccess(
        'Payment recorded',
        `Payment of ₹${amount.toLocaleString('en-IN')} has been successfully recorded.`
      );

      // Reset form
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('BANK_TRANSFER');
      setReferenceNumber('');
      setPaymentRemarks('');
      setPaymentDialogOpen(false);

      // Refresh invoice
      fetchInvoice(id);
    } catch (err) {
      handleApiError(err, 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteInvoice(id);
      handleApiSuccess('Invoice deleted', 'Invoice has been successfully deleted.');
      navigate('/invoices');
    } catch (err) {
      handleApiError(err, 'Failed to delete invoice');
    }
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
      case 'PENDING':
        return 'warning';
      case 'PARTIALLY_PAID':
        return 'info';
      case 'PAID':
        return 'success';
      case 'OVERDUE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="text-center">Invoice not found</div>
      </div>
    );
  }

  const canRecordPayment = invoice.balanceAmount > 0 && invoice.status !== 'PAID';
  const canDelete = invoice.status === 'PENDING' && invoice.paidAmount === 0;
  const canEdit = invoice.status === 'PENDING';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-gray-500">Invoice Details</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canRecordPayment && (
            <Button onClick={() => setPaymentDialogOpen(true)} className="gap-2">
              <CreditCard className="h-4 w-4" />
              Record Payment
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/invoices/${id}/edit`)} className="gap-2">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={InvoiceStatusLabels[invoice.status]} variant={getStatusVariant(invoice.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(invoice.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Paid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">{formatCurrency(invoice.paidAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${invoice.balanceAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatCurrency(invoice.balanceAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Invoice Date</p>
                <p className="text-sm text-gray-900">{formatDate(invoice.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Due Date</p>
                <p className={`text-sm font-medium ${new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID' ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Subtotal</p>
                <p className="text-sm text-gray-900">{formatCurrency(invoice.subtotal)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Tax Amount</p>
                <p className="text-sm text-gray-900">{formatCurrency(invoice.taxAmount)}</p>
              </div>
            </div>
            {invoice.remarks && (
              <div>
                <p className="text-sm font-medium text-gray-600">Remarks</p>
                <p className="text-sm text-gray-700">{invoice.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer & Order Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Customer</p>
              <p className="text-sm font-semibold text-gray-900">
                {invoice.customers?.billingName || invoice.customers?.name || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">{invoice.customers?.code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Order Number</p>
              <p className="text-sm text-gray-900">{invoice.orders?.orderNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Created By</p>
              <p className="text-sm text-gray-900">
                {invoice.users ? `${invoice.users.firstName} ${invoice.users.lastName}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Created At</p>
              <p className="text-sm text-gray-700">{formatDateTime(invoice.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History ({invoice.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(payment.paymentDate)}</p>
                      </div>
                      <div>
                        <StatusBadge status={PaymentMethodLabels[payment.paymentMethod]} variant="secondary" />
                      </div>
                    </div>
                    {payment.referenceNumber && (
                      <p className="text-xs text-gray-600 mt-1">Ref: {payment.referenceNumber}</p>
                    )}
                    {payment.remarks && (
                      <p className="text-xs text-gray-600 mt-1">{payment.remarks}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Received by {payment.users ? `${payment.users.firstName} ${payment.users.lastName}` : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <form onSubmit={handleRecordPayment}>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a payment for invoice {invoice.invoiceNumber}. Balance due: {formatCurrency(invoice.balanceAmount)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">
                  Payment Amount (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={invoice.balanceAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-gray-500">Maximum: {formatCurrency(invoice.balanceAmount)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Payment Date</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">
                    Payment Method <span className="text-red-500">*</span>
                  </Label>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                    <SelectTrigger id="paymentMethod">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input
                  id="referenceNumber"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Transaction ID, Cheque number, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentRemarks">Remarks</Label>
                <Textarea
                  id="paymentRemarks"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
