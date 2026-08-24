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
import { pushInvoiceToTally } from '@/services/tally.service';
import { generateIrn, cancelIrn } from '@/services/einvoice.service';
import type { Invoice, InvoiceItem, PaymentMethod } from '@/types/invoice.types';
import { InvoiceStatusLabels, PaymentMethodLabels } from '@/types/invoice.types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import {
  ArrowLeft,
  FileText,
  CreditCard,
  Trash2,
  Edit,
  Database,
  Loader2,
  CheckCircle,
  AlertCircle,
  QrCode,
  Ban,
  Lock,
} from 'lucide-react';
import { DocumentShareMenu } from '@/components/DocumentShareMenu';

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPushingToTally, setIsPushingToTally] = useState(false);
  const [isGeneratingIrn, setIsGeneratingIrn] = useState(false);
  const [cancelIrnDialogOpen, setCancelIrnDialogOpen] = useState(false);
  const [irnCancelReason, setIrnCancelReason] = useState<'1' | '2' | '3' | '4'>('2');
  const [irnCancelRemarks, setIrnCancelRemarks] = useState('');
  const [isCancellingIrn, setIsCancellingIrn] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      handleApiError(new Error(`Payment amount must be between 0 and ${invoice.balanceAmount}`), 'Invalid Amount');
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

  const handlePushToTally = async () => {
    if (!id) return;

    try {
      setIsPushingToTally(true);
      const result = await pushInvoiceToTally(id);
      if (result.success) {
        handleApiSuccess('Pushed to Tally', `Invoice pushed successfully (Voucher: ${result.voucherNumber})`);
        fetchInvoice(id);
      } else {
        handleApiError(new Error(result.error || 'Push failed'), 'Failed to push to Tally');
      }
    } catch (err) {
      handleApiError(err, 'Failed to push to Tally');
    } finally {
      setIsPushingToTally(false);
    }
  };

  const handleGenerateIrn = async () => {
    if (!id) return;

    try {
      setIsGeneratingIrn(true);
      const result = await generateIrn(id);
      if (result.success) {
        handleApiSuccess('IRN generated', 'e-Invoice registered on the government portal. The invoice is now locked.');
        fetchInvoice(id);
      } else {
        const detail = result.problems?.join(' ') || result.error || 'Generation failed';
        handleApiError(new Error(detail), 'IRN generation failed');
      }
    } catch (err) {
      handleApiError(err, 'IRN generation failed');
    } finally {
      setIsGeneratingIrn(false);
    }
  };

  const handleCancelIrn = async () => {
    if (!id) return;

    try {
      setIsCancellingIrn(true);
      const result = await cancelIrn(id, { reason: irnCancelReason, remarks: irnCancelRemarks });
      if (result.success) {
        handleApiSuccess('IRN cancelled', 'The IRN has been cancelled on the government portal.');
        setCancelIrnDialogOpen(false);
        setIrnCancelRemarks('');
        fetchInvoice(id);
      } else {
        handleApiError(new Error(result.error || 'Cancel failed'), 'IRN cancel failed');
      }
    } catch (err) {
      handleApiError(err, 'IRN cancel failed');
    } finally {
      setIsCancellingIrn(false);
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
      case 'SETTLED_WITH_CREDIT':
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
  // e-Invoice freeze: an IRN-registered document is legally immutable (even after IRN cancel)
  const irnLocked = !!invoice.eInvoiceIrn;
  const canDelete = invoice.status === 'PENDING' && invoice.paidAmount === 0 && !irnLocked;
  const canEdit = invoice.status === 'PENDING' && !irnLocked;
  const irnCancelDeadline = invoice.eInvoiceAckDate
    ? new Date(new Date(invoice.eInvoiceAckDate).getTime() + 24 * 60 * 60 * 1000)
    : null;
  const canCancelIrn =
    invoice.eInvoiceStatus === 'GENERATED' && (!irnCancelDeadline || irnCancelDeadline.getTime() > Date.now());

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-muted rounded-lg">
              <FileText className="h-6 w-6 text-info" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-medium text-foreground">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-muted-foreground">Invoice Details</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Document Download/Share Menu */}
          <DocumentShareMenu
            documentType="invoice"
            documentId={id || ''}
            documentNumber={invoice.invoiceNumber}
            customerPhone={invoice.customer?.phone}
          />

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
          {/* Generate IRN Button */}
          {!invoice.eInvoiceIrn && (
            <Button
              variant="secondary"
              onClick={handleGenerateIrn}
              disabled={isGeneratingIrn}
              className="gap-2"
              title={invoice.eInvoiceLastError || 'Register this invoice on the government e-Invoice portal'}
            >
              {isGeneratingIrn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : invoice.eInvoiceLastError ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              Generate IRN
            </Button>
          )}
          {/* Push to Tally Button */}
          <Button
            variant={invoice.tallyPushedAt ? 'outline' : 'secondary'}
            onClick={handlePushToTally}
            disabled={isPushingToTally}
            className="gap-2"
            title={invoice.tallyLastError || undefined}
          >
            {isPushingToTally ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : invoice.tallyPushedAt ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : invoice.tallyLastError ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {invoice.tallyPushedAt ? 'Re-push to Tally' : 'Push to Tally'}
          </Button>
        </div>
      </div>

      {/* Status and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={InvoiceStatusLabels[invoice.status]} variant={getStatusVariant(invoice.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(invoice.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-success">{formatCurrency(invoice.paidAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${invoice.balanceAmount > 0 ? 'text-primary' : 'text-success'}`}>
              {formatCurrency(invoice.balanceAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tally Status */}
      {(invoice.tallyPushedAt || invoice.tallyLastError) && (
        <Card
          className={
            invoice.tallyLastError && !invoice.tallyPushedAt
              ? 'border-red-200 bg-red-50'
              : 'border-green-200 bg-green-50'
          }
        >
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              {invoice.tallyPushedAt ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-800">
                    Pushed to Tally on {formatDateTime(invoice.tallyPushedAt)}
                    {invoice.tallyVoucherNumber && ` (Voucher: ${invoice.tallyVoucherNumber})`}
                  </span>
                </>
              ) : invoice.tallyLastError ? (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800">Tally push failed: {invoice.tallyLastError}</span>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* e-Invoice (IRN) Status */}
      {(invoice.eInvoiceIrn || invoice.eInvoiceLastError) && (
        <Card
          className={
            invoice.eInvoiceStatus === 'GENERATED'
              ? 'border-green-200 bg-green-50'
              : invoice.eInvoiceStatus === 'CANCELLED'
                ? 'border-gray-200 bg-gray-50'
                : 'border-red-200 bg-red-50'
          }
        >
          <CardContent className="py-3 space-y-2">
            {invoice.eInvoiceIrn ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {invoice.eInvoiceStatus === 'CANCELLED' ? (
                      <Ban className="h-5 w-5 text-gray-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    <span
                      className={
                        invoice.eInvoiceStatus === 'CANCELLED'
                          ? 'text-gray-700 font-medium'
                          : 'text-green-800 font-medium'
                      }
                    >
                      {invoice.eInvoiceStatus === 'CANCELLED'
                        ? `e-Invoice CANCELLED${invoice.eInvoiceCancelledAt ? ` on ${formatDateTime(invoice.eInvoiceCancelledAt)}` : ''}`
                        : 'e-Invoice registered (IRN generated)'}
                    </span>
                    <span title="Invoice is locked — IRN-registered documents cannot be edited or deleted">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </div>
                  {canCancelIrn && (
                    <Button variant="outline" size="sm" onClick={() => setCancelIrnDialogOpen(true)} className="gap-1">
                      <Ban className="h-4 w-4 text-red-500" />
                      Cancel IRN
                    </Button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground font-mono break-all">IRN: {invoice.eInvoiceIrn}</div>
                <div className="text-sm text-muted-foreground">
                  {invoice.eInvoiceAckNo && <>Ack No: {invoice.eInvoiceAckNo}</>}
                  {invoice.eInvoiceAckDate && <> • Ack Date: {formatDateTime(invoice.eInvoiceAckDate)}</>}
                  {canCancelIrn && irnCancelDeadline && (
                    <> • Cancel window closes {formatDateTime(irnCancelDeadline.toISOString())}</>
                  )}
                </div>
                {invoice.eInvoiceCancelReason && (
                  <div className="text-sm text-muted-foreground">Cancel reason: {invoice.eInvoiceCancelReason}</div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">IRN generation failed: {invoice.eInvoiceLastError}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Invoice Date</p>
                <p className="text-sm text-foreground">{formatDate(invoice.invoiceDate)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                <p
                  className={`text-sm font-medium ${new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID' ? 'text-destructive' : 'text-foreground'}`}
                >
                  {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subtotal</p>
                <p className="text-sm text-foreground">{formatCurrency(invoice.subtotal)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tax Amount</p>
                <p className="text-sm text-foreground">{formatCurrency(invoice.taxAmount)}</p>
              </div>
            </div>
            {invoice.remarks && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remarks</p>
                <p className="text-sm text-foreground">{invoice.remarks}</p>
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
              <p className="text-sm font-medium text-muted-foreground">Customer</p>
              <p className="text-sm font-semibold text-foreground">
                {invoice.customer?.billingName || invoice.customer?.name || 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">{invoice.customer?.code}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Order Number</p>
              {invoice.orderId && invoice.orders?.orderNumber ? (
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${invoice.orderId}`)}
                  className="text-sm text-info hover:underline"
                >
                  {invoice.orders.orderNumber}
                </button>
              ) : (
                <p className="text-sm text-foreground">{invoice.orders?.orderNumber || 'N/A'}</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created By</p>
              <p className="text-sm text-foreground">
                {invoice.users ? `${invoice.users.firstName} ${invoice.users.lastName}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created At</p>
              <p className="text-sm text-foreground">{formatDateTime(invoice.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Items */}
      {invoice.invoiceItems && invoice.invoiceItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Items ({invoice.invoiceItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.invoiceItems.map((item: InvoiceItem) => {
                  const taxAmt = Number(item.taxAmount || 0);
                  const lineWithTax = Number(item.totalPrice) + taxAmt;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.description}</div>
                          {item.style && (
                            <div className="text-xs text-muted-foreground">
                              {item.style.styleCode}
                              {item.style.buyerStyleRef && ` (${item.style.buyerStyleRef})`}
                              {' - '}
                              {item.style.styleName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.hsnCode || '-'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell className="text-right text-xs">
                        {item.gstRate ? `${Number(item.gstRate)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-xs">{taxAmt > 0 ? formatCurrency(taxAmt) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(lineWithTax)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Tax Breakdown + Grand Total */}
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="w-64 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.isInterstate ? (
                  Number(invoice.igstAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IGST</span>
                      <span>{formatCurrency(invoice.igstAmount)}</span>
                    </div>
                  )
                ) : (
                  <>
                    {Number(invoice.cgstAmount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CGST</span>
                        <span>{formatCurrency(invoice.cgstAmount)}</span>
                      </div>
                    )}
                    {Number(invoice.sgstAmount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SGST</span>
                        <span>{formatCurrency(invoice.sgstAmount)}</span>
                      </div>
                    )}
                  </>
                )}
                {Number(invoice.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm border-t pt-1">
                    <span className="text-muted-foreground">Total Tax</span>
                    <span>{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Grand Total</span>
                  <span className="text-xl font-bold">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History ({invoice.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                      </div>
                      <div>
                        <StatusBadge status={PaymentMethodLabels[payment.paymentMethod]} variant="secondary" />
                      </div>
                    </div>
                    {payment.referenceNumber && (
                      <p className="text-xs text-muted-foreground mt-1">Ref: {payment.referenceNumber}</p>
                    )}
                    {payment.remarks && <p className="text-xs text-muted-foreground mt-1">{payment.remarks}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
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
                Record a payment for invoice {invoice.invoiceNumber}. Balance due:{' '}
                {formatCurrency(invoice.balanceAmount)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">
                  Payment Amount (₹) <span className="text-destructive">*</span>
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
                <p className="text-xs text-muted-foreground">Maximum: {formatCurrency(invoice.balanceAmount)}</p>
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
                    Payment Method <span className="text-destructive">*</span>
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

      {/* Cancel IRN Dialog */}
      <Dialog open={cancelIrnDialogOpen} onOpenChange={setCancelIrnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel IRN — {invoice.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Cancelling removes the IRN on the government portal. This is only possible within 24 hours of generation
              and cannot be undone — this invoice number can never be registered again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="irnCancelReason">Reason</Label>
              <Select value={irnCancelReason} onValueChange={(v) => setIrnCancelReason(v as typeof irnCancelReason)}>
                <SelectTrigger id="irnCancelReason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Duplicate</SelectItem>
                  <SelectItem value="2">Data entry mistake</SelectItem>
                  <SelectItem value="3">Order cancelled</SelectItem>
                  <SelectItem value="4">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="irnCancelRemarks">Remarks</Label>
              <Textarea
                id="irnCancelRemarks"
                value={irnCancelRemarks}
                onChange={(e) => setIrnCancelRemarks(e.target.value)}
                placeholder="Short explanation (min 3 characters)"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelIrnDialogOpen(false)} disabled={isCancellingIrn}>
              Keep IRN
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelIrn}
              disabled={irnCancelRemarks.trim().length < 3 || isCancellingIrn}
            >
              {isCancellingIrn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel IRN
            </Button>
          </DialogFooter>
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
