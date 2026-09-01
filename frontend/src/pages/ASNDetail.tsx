// ASN Detail - View Advance Shipping Notice with status workflow
// BUG-DASH10 fix: corrected route path - /manufacturing/dispatch/asn/:id
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft,
  FileText,
  ShoppingCart,
  Calendar,
  Package,
  User,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Send,
  AlertTriangle,
  Loader2,
  Clock,
  Truck,
  Hash,
  Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { asnService } from '@/services/dispatch.service';
import type { ApproveASNRequest } from '@/types/dispatch.types';
import { ASNStatusLabels, ASNStatusColors } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

export default function ASNDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dialog states
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);

  // Form states
  const [approveForm, setApproveForm] = useState<ApproveASNRequest>({
    appointmentDate: '',
    appointmentTime: '',
    buyerRefNumber: '',
    approvedQty: 0,
  });
  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Fetch ASN
  const {
    data: asn,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['asn', id],
    queryFn: () => asnService.getById(id!),
    enabled: !!id,
  });

  // Initialize approve form when ASN loads
  const initApproveForm = () => {
    if (asn) {
      setApproveForm({
        appointmentDate: '',
        appointmentTime: '',
        buyerRefNumber: '',
        approvedQty: asn.plannedDispatchQty,
      });
    }
    setApproveDialogOpen(true);
  };

  // Mutations
  const applyMutation = useMutation({
    mutationFn: () => asnService.apply(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asn', id] });
      handleApiSuccess('ASN submitted to buyer');
      setApplyDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to apply ASN'),
  });

  const approveMutation = useMutation({
    mutationFn: (data: ApproveASNRequest) => asnService.approve(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asn', id] });
      handleApiSuccess('ASN approved');
      setApproveDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to approve ASN'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => asnService.reject(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asn', id] });
      handleApiSuccess('ASN rejected');
      setRejectDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to reject ASN'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (date: string) => asnService.reschedule(id!, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asn', id] });
      handleApiSuccess('ASN rescheduled');
      setRescheduleDialogOpen(false);
    },
    onError: (err) => handleApiError(err, 'Failed to reschedule ASN'),
  });

  // Helpers
  const formatDate = (value: string | undefined) => {
    if (!value) return '-';
    return format(new Date(value), 'dd MMM yyyy');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !asn) {
    return (
      <div className="container mx-auto py-6">
        <Button variant="ghost" onClick={() => navigate('/manufacturing/dispatch')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dispatch
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{error ? 'Failed to load ASN' : 'ASN not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/manufacturing/dispatch')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-display font-medium">{asn.asnNumber}</h1>
              <Badge className={`${ASNStatusColors[asn.status]} border`}>{ASNStatusLabels[asn.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Advance Shipping Notice</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {asn.status === 'PENDING' && (
            <Button onClick={() => setApplyDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Submit to Buyer
            </Button>
          )}
          {asn.status === 'APPLIED' && (
            <>
              <Button onClick={initApproveForm}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setRescheduleDialogOpen(true)}>
                <CalendarClock className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              <Button variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {asn.status === 'APPROVED' && (
            <Button asChild>
              <Link to={`/manufacturing/dispatch/delivery/new?asnId=${asn.id}`}>
                <Truck className="h-4 w-4 mr-2" />
                Create Delivery Note
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Order</p>
                <Link to={`/orders/${asn.orderId}`} className="font-medium text-primary hover:underline">
                  {asn.order?.orderNumber || asn.orderId}
                </Link>
                {asn.order?.customer && (
                  <p className="text-xs text-muted-foreground">
                    {asn.order.customer.billingName || asn.order.customer.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Requested Ship Date</p>
                <p className="font-medium">{formatDate(asn.requestedShipDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Planned Quantity</p>
                <p className="font-medium text-lg">{asn.plannedDispatchQty.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Box className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cartons Planned</p>
                <p className="font-medium text-lg">{asn.cartonsPlanned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Details (if approved) */}
      {(asn.status === 'APPROVED' || asn.appointmentDate) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Appointment Date</p>
                <p className="font-medium">{formatDate(asn.appointmentDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Appointment Time</p>
                <p className="font-medium">{asn.appointmentTime || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Buyer Ref #</p>
                <p className="font-medium font-mono">{asn.buyerRefNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved Qty</p>
                <p className="font-medium">{asn.approvedQty?.toLocaleString() || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejection/Reschedule Info */}
      {asn.status === 'REJECTED' && asn.rejectionReason && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Rejection Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{asn.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {asn.status === 'RESCHEDULE' && asn.rescheduleDate && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-warning flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Rescheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              New date requested: <span className="font-medium">{formatDate(asn.rescheduleDate)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* SKU Breakdown */}
      {/* Always rendered: hiding this card when the breakdown was empty is what made a
          SKU-less ASN look identical to a correct one right after saving. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            SKU Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!asn.skus || asn.skus.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No SKU breakdown — this ASN records the total quantity only.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Planned Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asn.skus.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sku.color?.colorCode && (
                          <div className="w-4 h-4 rounded border" style={{ backgroundColor: sku.color.colorCode }} />
                        )}
                        <span>{sku.color?.colorName || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{sku.size?.sizeName || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{sku.plannedQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Remarks */}
      {asn.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{asn.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Audit Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Document Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created By</p>
              <p className="font-medium">{asn.createdBy?.name || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Application Date</p>
              <p className="font-medium">{formatDate(asn.applicationDate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="font-medium">{formatDate(asn.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apply Dialog */}
      <ConfirmDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        title="Submit ASN to Buyer"
        description={`This will submit ASN ${asn.asnNumber} to the buyer for approval. The requested ship date is ${formatDate(asn.requestedShipDate)} for ${asn.plannedDispatchQty} units.`}
        confirmText="Submit"
        onConfirm={() => applyMutation.mutate()}
        isLoading={applyMutation.isPending}
      />

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve ASN</DialogTitle>
            <DialogDescription>Enter the appointment details from the buyer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointmentDate">Appointment Date</Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  value={approveForm.appointmentDate}
                  onChange={(e) => setApproveForm({ ...approveForm, appointmentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointmentTime">Appointment Time</Label>
                <Input
                  id="appointmentTime"
                  type="time"
                  value={approveForm.appointmentTime}
                  onChange={(e) => setApproveForm({ ...approveForm, appointmentTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerRefNumber">Buyer Reference Number</Label>
              <Input
                id="buyerRefNumber"
                value={approveForm.buyerRefNumber}
                onChange={(e) => setApproveForm({ ...approveForm, buyerRefNumber: e.target.value })}
                placeholder="PO#, BOL#, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approvedQty">Approved Quantity</Label>
              <Input
                id="approvedQty"
                type="number"
                value={approveForm.approvedQty}
                onChange={(e) => setApproveForm({ ...approveForm, approvedQty: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => approveMutation.mutate(approveForm)} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject ASN</DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule ASN</DialogTitle>
            <DialogDescription>Select a new date for the shipment.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rescheduleDate">New Date</Label>
            <Input
              id="rescheduleDate"
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => rescheduleMutation.mutate(rescheduleDate)}
              disabled={rescheduleMutation.isPending || !rescheduleDate}
            >
              {rescheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
