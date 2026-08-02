import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deliveryNoteService } from '@/services/dispatch.service';
import type { DeliveryNote } from '@/types/dispatch.types';
import { DeliveryStatusLabels, DeliveryStatusColors, DeliveryConfirmationLabels } from '@/types/dispatch.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Loader2, Truck, Package, ClipboardCheck, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

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

  useEffect(() => {
    if (id) loadNote(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadNote(noteId: string) {
    try {
      setIsLoading(true);
      const data = await deliveryNoteService.getById(noteId);
      setNote(data);
    } catch (error) {
      handleApiError(error, 'Failed to load delivery note');
    } finally {
      setIsLoading(false);
    }
  }

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
        {note.status === 'IN_TRANSIT' && (
          <Button asChild>
            <Link to={`/manufacturing/dispatch/delivery/${note.id}/pod`}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Record POD
            </Link>
          </Button>
        )}
      </div>

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
              {note.deliveryDate ? format(new Date(note.deliveryDate), 'dd MMM yyyy') : '-'}
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
                    {format(new Date(transport.expectedDeliveryDate), 'dd MMM yyyy')}
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
              {pod.deliveryDate ? format(new Date(pod.deliveryDate), 'dd MMM yyyy') : '-'}
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
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
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
                    <TableCell>{item.color?.colorName || '-'}</TableCell>
                    <TableCell>{item.size?.sizeName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No items
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
