import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deliveryNoteService } from '@/services/dispatch.service';
import { createInvoiceFromDeliveryNote } from '@/services/invoice.service';
import type { DeliveryNote } from '@/types/dispatch.types';
import { DeliveryStatusLabels, DeliveryStatusColors, DeliveryConfirmationLabels } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { usePermissions } from '@/hooks/usePermissions';
import { BuyerPoCard } from '@/components/sale-order';
import { ArrowLeft, Loader2, Truck, Package, ClipboardCheck, CheckCircle, FileText, XCircle } from 'lucide-react';

import { formatDate, formatDateTime, toDateInputValue } from '@/lib/date';

/**
 * Read-only Delivery Note detail (finding B10-02, BUG-DASH10 fix: corrected route path).
 * The list's View button pointed at /manufacturing/dispatch/delivery/:id, which had no route or page
 * (landed on NotFound). This mirrors the read pattern of ChallanDetail / DispatchPODForm using the
 * existing deliveryNoteService.getById endpoint (returns items + ext.transport/pod/cartons).
 */
export default function DispatchDeliveryNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { can } = usePermissions();
  // The Dispatch list's Cancel / Invoice row icons open this page with ?cancel=1 / ?invoice=1
  const [searchParams, setSearchParams] = useSearchParams();

  // Cancel (a pending note; the record is kept)
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Create Invoice (a delivered note; bills what was received)
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(toDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [invoiceRemarks, setInvoiceRemarks] = useState('');
  const [invoicing, setInvoicing] = useState(false);

  useEffect(() => {
    if (id) loadNote(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadNote(noteId: string) {
    try {
      setIsLoading(true);
      const data = await deliveryNoteService.getById(noteId);
      setNote(data);
      if (searchParams.get('cancel') === '1' && data.status === 'PENDING') {
        setCancelReason('');
        setCancelOpen(true);
      }
      if (searchParams.get('invoice') === '1' && data.status === 'DELIVERED' && !data.invoices?.length) {
        const due = new Date();
        due.setDate(due.getDate() + (data.customer?.creditDays ?? 30));
        setInvoiceDate(toDateInputValue(new Date()));
        setDueDate(toDateInputValue(due));
        setInvoiceRemarks('');
        setInvoiceOpen(true);
      }
      if (searchParams.has('cancel') || searchParams.has('invoice')) setSearchParams({}, { replace: true });
    } catch (error) {
      handleApiError(error, 'Failed to load delivery note');
    } finally {
      setIsLoading(false);
    }
  }

  const openInvoiceDialog = () => {
    if (!note) return;
    // Due date: the customer's credit days after today, else 30
    const due = new Date();
    due.setDate(due.getDate() + (note.customer?.creditDays ?? 30));
    setInvoiceDate(toDateInputValue(new Date()));
    setDueDate(toDateInputValue(due));
    setInvoiceRemarks('');
    setInvoiceOpen(true);
  };

  const submitCancel = async () => {
    if (!note) return;
    try {
      setCancelling(true);
      const { message } = await deliveryNoteService.cancel(note.id, cancelReason.trim());
      handleApiSuccess(message || `${note.deliveryNumber} cancelled`);
      setCancelOpen(false);
      await loadNote(note.id);
    } catch (error) {
      handleApiError(error, 'Failed to cancel the delivery note');
    } finally {
      setCancelling(false);
    }
  };

  const submitInvoice = async () => {
    if (!note) return;
    try {
      setInvoicing(true);
      const invoice = await createInvoiceFromDeliveryNote(note.id, {
        invoiceDate,
        dueDate,
        remarks: invoiceRemarks.trim() || undefined,
      });
      handleApiSuccess(`Invoice ${invoice.invoiceNumber} created`);
      navigate(`/invoices/${invoice.id}`);
    } catch (error) {
      handleApiError(error, 'Failed to create the invoice');
    } finally {
      setInvoicing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!note) {
    return <div className="text-center py-8 text-muted-foreground">Delivery note not found</div>;
  }

  const transport = note.ext?.transport;
  const pod = note.ext?.pod;
  const cartonCount = note.ext?.cartons?.length || 0;
  const totalPieces = note.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const invoice = note.invoices?.[0];
  const canInvoice = note.status === 'DELIVERED' && !invoice && pod?.deliveryStatus !== 'REJECTED' && can('invoices');
  // What the invoice will bill: the received quantity per line (the full quantity before per-line receipt)
  const billable = (note.items ?? [])
    .map((item) => ({ item, qty: item.receivedQty ?? item.quantity }))
    .filter((l) => l.qty > 0);

  // Prefer the dedicated transport record, fall back to the note-level fields.
  const transporterName = transport?.transporterName;
  const vehicleNumber = transport?.vehicleNumber || note.vehicleNumber;
  const driverName = transport?.driverName || note.driverName;
  const driverPhone = transport?.driverPhone || note.driverPhone;
  const hasTransport = Boolean(transporterName || vehicleNumber || driverName || driverPhone);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/dispatch')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium">{note.deliveryNumber}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={DeliveryStatusColors[note.status]}>{DeliveryStatusLabels[note.status]}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note.status === 'PENDING' && (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setCancelReason('');
                setCancelOpen(true);
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Delivery Note
            </Button>
          )}
          {note.status === 'IN_TRANSIT' && (
            <Button asChild>
              <Link to={`/manufacturing/dispatch/delivery/${note.id}/pod`}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Record POD
              </Link>
            </Button>
          )}
          {invoice && (
            <Button variant="outline" asChild>
              <Link to={`/invoices/${invoice.id}`}>
                <FileText className="h-4 w-4 mr-2" />
                Invoice {invoice.invoiceNumber}
              </Link>
            </Button>
          )}
          {canInvoice && (
            <Button onClick={openInvoiceDialog}>
              <FileText className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          )}
        </div>
      </div>

      {note.status === 'CANCELLED' && (
        <Alert variant="destructive">
          <AlertDescription>
            Cancelled{note.cancelledAt ? ` on ${formatDateTime(new Date(note.cancelledAt))}` : ''}
            {note.cancelReason ? ` — ${note.cancelReason}` : ''}. The stock and the sale order&apos;s dispatched
            quantity were handed back; this record is kept.
          </AlertDescription>
        </Alert>
      )}
      {note.stockOverrideReason && (
        <Alert>
          <AlertDescription>
            Shipped past finished-goods stock on an administrator&apos;s override: {note.stockOverrideReason}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Delivery Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Order:</span> {note.order?.orderNumber || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Customer:</span>{' '}
              {note.customer?.billingName || note.customer?.name || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Dispatch Date:</span>{' '}
              {note.deliveryDate ? formatDate(new Date(note.deliveryDate)) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Total Pieces:</span> {totalPieces.toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">Cartons:</span> {cartonCount}
            </div>
            {note.ext?.asn?.asnNumber && (
              <div>
                <span className="text-muted-foreground">ASN:</span> {note.ext.asn.asnNumber}
              </div>
            )}
            {note.remarks && (
              <div>
                <span className="text-muted-foreground">Remarks:</span> {note.remarks}
              </div>
            )}
          </CardContent>
        </Card>

        {/* The customer's own PO paperwork, so the packing team can check what the buyer ordered
            without asking sales. Renders nothing on a note raised from a production order — those
            carry no sale-order link. */}
        <BuyerPoCard buyerPos={note.saleOrder?.buyerPos} saleOrderNumber={note.saleOrder?.saleOrderNumber} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Transport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hasTransport ? (
              <>
                {transporterName && (
                  <div>
                    <span className="text-muted-foreground">Transporter:</span> {transporterName}
                  </div>
                )}
                {vehicleNumber && (
                  <div>
                    <span className="text-muted-foreground">Vehicle:</span> {vehicleNumber}
                    {transport?.vehicleType ? ` (${transport.vehicleType})` : ''}
                  </div>
                )}
                {driverName && (
                  <div>
                    <span className="text-muted-foreground">Driver:</span> {driverName}
                    {driverPhone ? ` (${driverPhone})` : ''}
                  </div>
                )}
                {transport?.lrNumber && (
                  <div>
                    <span className="text-muted-foreground">LR No:</span> {transport.lrNumber}
                  </div>
                )}
                {transport?.expectedDeliveryDate && (
                  <div>
                    <span className="text-muted-foreground">Expected Delivery:</span>{' '}
                    {formatDate(new Date(transport.expectedDeliveryDate))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No transport assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* POD */}
      {pod && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Proof of Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Delivered On:</span>{' '}
              {pod.deliveryDate ? formatDate(new Date(pod.deliveryDate)) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Received By:</span> {pod.receivedBy || '-'}
              {pod.designation ? ` (${pod.designation})` : ''}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              {DeliveryConfirmationLabels[pod.deliveryStatus] || pod.deliveryStatus}
            </div>
            {pod.customerGrnNumber && (
              <div>
                <span className="text-muted-foreground">Customer GRN:</span> {pod.customerGrnNumber}
              </div>
            )}
            {pod.shortageQty != null && pod.shortageQty > 0 && (
              <div>
                <span className="text-muted-foreground">Shortage:</span> {pod.shortageQty}
              </div>
            )}
            {pod.rejectionReason && (
              <div className="md:col-span-3">
                <span className="text-muted-foreground">Rejection Reason:</span> {pod.rejectionReason}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Items ({note.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Style</TableHead>
                <TableHead>Buyer Ref</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                {pod && <TableHead className="text-right">Received</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {note.items && note.items.length > 0 ? (
                note.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.style?.styleCode || '-'}
                      <span className="text-muted-foreground ml-2">{item.style?.styleName}</span>
                    </TableCell>
                    <TableCell>{item.style?.buyerStyleRef || '—'}</TableCell>
                    <TableCell>{item.color?.colorName || '-'}</TableCell>
                    <TableCell>{item.size?.sizeName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    {pod && <TableCell className="text-right">{item.receivedQty ?? '—'}</TableCell>}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={pod ? 6 : 5} className="text-center text-muted-foreground py-6">
                    No items
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel — the record stays, marked Cancelled */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {note.deliveryNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The pieces go back into finished-goods stock and come off the sale order&apos;s Dispatched quantity. The
              note stays in the list, marked Cancelled, with its number.
            </p>
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Reason *</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Why is this delivery note being cancelled?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={cancelling || cancelReason.trim().length < 3}
              onClick={submitCancel}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Delivery Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice — bills what the buyer received */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice for {note.deliveryNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Billed (what the buyer received)</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Style</TableHead>
                    <TableHead>Colour</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billable.map(({ item, qty }) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.style?.styleCode || '-'}</TableCell>
                      <TableCell>{item.color?.colorName || '-'}</TableCell>
                      <TableCell>{item.size?.sizeName || '-'}</TableCell>
                      <TableCell className="text-right">{qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                Priced from the sale order (or the production order when there is no sale order); GST is worked out from
                the customer&apos;s billing state.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceRemarks">Remarks</Label>
              <Textarea
                id="invoiceRemarks"
                value={invoiceRemarks}
                onChange={(e) => setInvoiceRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button disabled={invoicing || !invoiceDate || !dueDate} onClick={submitInvoice}>
              {invoicing ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
