/**
 * Job Work Order Detail Page
 * View and manage a single job work order
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Factory,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Truck,
  FileText,
  Calculator,
  Send,
  Download,
  Trash2,
  Ban,
  MessageCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

import { jobWorkOrderService, type IssueJwoPayload } from '@/services/jobWorkOrder.service';
import { GreigeLotRows } from '@/components/job-work/GreigeLotRows';
import { evaluateLotRows, round2, type IssueLotRow } from '@/components/job-work/lot-rows';
import { dyeProcessPOService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import ConfirmDialog from '@/components/ConfirmDialog';
import { openPDF } from '@/lib/document-utils';
import { billableFromGreige, effectiveTolerancePercent } from '@/utils/shrinkage';
import { JwoWhatsAppSendDialog } from '@/components/JwoWhatsAppSendDialog';
import { useDefaultSettings } from '@/hooks/useDefaultSettings';

function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    DRAFT: 'outline',
    PENDING_APPROVAL: 'outline',
    APPROVED: 'secondary',
    ISSUED: 'default',
    IN_TRANSIT: 'default',
    AT_PROCESSOR: 'default',
    AT_MILL: 'default',
    PARTIALLY_RECEIVED: 'secondary',
    RECEIVED: 'secondary',
    QUALITY_CHECKED: 'secondary',
    STOCK_UPDATED: 'default',
    CLOSED: 'default',
    CANCELLED: 'destructive',
  };
  return <Badge variant={variants[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>;
}

function getDaysOutstanding(sentDate?: string): number | null {
  if (!sentDate) return null;
  const sent = new Date(sentDate);
  const today = new Date();
  const diffTime = today.getTime() - sent.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Blockers that no lot selection can clear, so only these may disable the action. Everything
 * else the preview reports is about the order's stamped lot, which the rows below replace.
 */
const ISSUE_FATAL_BLOCKER_CODES = new Set(['ALREADY_ISSUED', 'ORDER_CANCELLED', 'NOT_FOUND']);

/**
 * Issue failures that name a specific lot, quantity or width. The operator has to read the whole
 * sentence to know which row to fix, so these get a long-lived toast rather than the default flash.
 */
const DETAILED_ISSUE_ERROR_CODES = [
  'INSUFFICIENT_GREIGE',
  'LOT_GREIGE_MISMATCH',
  'LOT_GREIGE_MIXED',
  'LOT_DUPLICATE',
  'LOT_WIDTH_MISMATCH',
  'LOT_QTY_MISMATCH',
  'PURCHASED_ITEM_AS_COMPONENT',
  'LOT_AT_PROCESSOR',
];

export default function JobWorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const { cutableWidthDeduction } = useDefaultSettings();
  const [cancelReason, setCancelReason] = useState('');
  const [qtyReceived, setQtyReceived] = useState('');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeInvoiceNumber, setCloseInvoiceNumber] = useState('');
  // Phase 4c: operational issue dialog (greige lots + transport)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueRows, setIssueRows] = useState<IssueLotRow[]>([{ lotId: '', qty: '' }]);
  const [issueWidthAcknowledged, setIssueWidthAcknowledged] = useState(false);
  const [issueVehicle, setIssueVehicle] = useState('');

  const {
    data: jwo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['job-work-order', id],
    queryFn: () => jobWorkOrderService.getById(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      jwo?.processType === 'PRINTING' ? printProcessPOService.delete(id!) : dyeProcessPOService.delete(id!),
    onSuccess: () => {
      toast.success(`${jwo?.jobWorkNumber ?? 'Job work order'} deleted. Linked requirements are open again.`);
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['mrp'] });
      navigate('/job-work-orders');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete job work order';
      toast.error(msg);
    },
  });

  // Cancel is the universal withdrawal path: it works for every process type (delete exists only
  // on the legacy dyeing/printing routes), credits issued material back to stock, and reverts the
  // requirements this order covered to open. Refused once anything has been received.
  const cancelMutation = useMutation({
    mutationFn: () => jobWorkOrderService.cancel(id!, cancelReason || undefined),
    onSuccess: () => {
      toast.success(`${jwo?.jobWorkNumber ?? 'Job work order'} cancelled. Covered requirements are open again.`);
      setCancelDialogOpen(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['mrp'] });
      queryClient.invalidateQueries({ queryKey: ['service-requirements'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to cancel job work order';
      toast.error(msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => jobWorkOrderService.approve(id!),
    onSuccess: () => {
      toast.success('Job work order approved');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve');
    },
  });

  // Phase 4c: the server's read-only dry run — blockers, the anchored greige, and the lots that
  // could serve this order. staleTime 0 because stock moves under us: every open re-reads.
  const {
    data: issuePreview,
    isLoading: issuePreviewLoading,
    isError: issuePreviewFailed,
  } = useQuery({
    queryKey: ['jwo-issue-preview', id],
    queryFn: () => jobWorkOrderService.getIssuePreview(id!),
    enabled: issueDialogOpen && !!id,
    staleTime: 0,
  });

  // Seed one row on open — preselecting a lot only when a single lot covers the whole order, so
  // the common case stays one click. Guarded to the pristine state: a background refetch of the
  // preview must never overwrite a split the operator has already typed.
  useEffect(() => {
    if (!issueDialogOpen) {
      setIssueRows([{ lotId: '', qty: '' }]);
      setIssueWidthAcknowledged(false);
      return;
    }
    if (!issuePreview) return;
    setIssueRows((rows) => {
      if (rows.length !== 1 || rows[0].lotId || rows[0].qty) return rows;
      // A non-greige (service) order consumes nothing by default — preselecting a lot for it would
      // quietly send material that nobody asked to send.
      if (issuePreview.fabricType !== 'GREIGE') return rows;
      const required = issuePreview.requiredQty;
      const singleCoveringLot = issuePreview.availableLots.find((lot) => lot.quantityAvailable >= required);
      return [{ lotId: singleCoveringLot?.id ?? '', qty: required > 0 ? String(round2(required)) : '' }];
    });
  }, [issueDialogOpen, issuePreview]);

  const issueMutation = useMutation({
    mutationFn: () => {
      const filledRows = issueRows.filter((row) => row.lotId && parseFloat(row.qty) > 0);
      const payload: IssueJwoPayload = {
        vehicleNumber: issueVehicle || undefined,
        acknowledgeWidthMismatch: issueWidthAcknowledged || undefined,
      };
      // One lot goes on the wire exactly as it always has. The server then consumes the order's
      // own qtySentMeters, so the issued quantity cannot drift from a re-typed number; lots[] is
      // reserved for a genuine split, where only the operator knows how it divides.
      if (filledRows.length === 1) {
        payload.greigeStockLotId = filledRows[0].lotId;
      } else if (filledRows.length > 1) {
        payload.lots = filledRows.map((row) => ({
          greigeStockLotId: row.lotId,
          qty: round2(parseFloat(row.qty)),
        }));
      }
      return jobWorkOrderService.issue(id!, payload);
    },
    onSuccess: (result) => {
      setIssueDialogOpen(false);
      setIssueRows([{ lotId: '', qty: '' }]);
      setIssueWidthAcknowledged(false);
      setIssueVehicle('');
      toast.success(`Job work order issued — Challan ${result.challanNumber} created`);
      if (result.warning) toast.warning(result.warning);
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-order-reconciliation', id] });
      queryClient.invalidateQueries({ queryKey: ['jwo-issue-preview', id] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.code;
      const message = err.response?.data?.message;
      if (message && DETAILED_ISSUE_ERROR_CODES.includes(code)) {
        toast.error(message, { duration: 8000 });
      } else {
        toast.error(message || 'Failed to issue');
      }
    },
  });

  const computeTotalsMutation = useMutation({
    mutationFn: () => jobWorkOrderService.computeTotals(id!),
    onSuccess: () => {
      toast.success('Commercial totals computed');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.code;
      if (code === 'GST_RATE_UNRESOLVED') {
        toast.error('Cannot compute totals: GST rate is unresolved for this process type.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to compute totals');
      }
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (qty: number) => jobWorkOrderService.receive(id!, qty),
    onSuccess: (result) => {
      setReceiveDialogOpen(false);
      setQtyReceived('');

      const { lossSplit } = result;
      if (lossSplit.qtyAbnormalLoss > 0) {
        toast.warning(`Received with ${lossSplit.qtyAbnormalLoss.toFixed(2)} MTR abnormal loss (debit note required)`);
      } else {
        toast.success('Material received successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to receive material');
    },
  });

  // Phase 3b: computed reconciliation (challan-line balances, D5)
  const { data: reconciliation } = useQuery({
    queryKey: ['job-work-order-reconciliation', id],
    queryFn: () => jobWorkOrderService.getReconciliation(id!),
    enabled: !!id,
  });

  // Phase 3b: close (RECEIVED → CLOSED, invoice match required)
  const closeMutation = useMutation({
    mutationFn: () => jobWorkOrderService.close(id!, closeInvoiceNumber || undefined),
    onSuccess: (result) => {
      setCloseDialogOpen(false);
      setCloseInvoiceNumber('');
      toast.success('Job work order closed');
      if (result.warning) toast.warning(result.warning);
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-order-reconciliation', id] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.code;
      if (code === 'DEBIT_NOTE_REQUIRED') {
        toast.error(err.response?.data?.message, { duration: 8000 });
      } else {
        toast.error(err.response?.data?.message || 'Failed to close job work order');
      }
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !jwo) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load job work order. {(error as any)?.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const daysOutstanding = getDaysOutstanding(jwo.sentDate);
  // Colour ladder, order-linked rungs first — mirrors the server's fabric-identity helper and
  // the challan. The last two only ever fire on a stock job, which has no requirement chain.
  const colourName =
    jwo.requirementLinks?.[0]?.materialRequirements?.colorName ?? jwo.colorMaster?.colorName ?? jwo.colorName ?? null;
  const isOverdue = daysOutstanding !== null && daysOutstanding > 300 && !jwo.receivedDate;
  const hasAbnormalLoss = (jwo.qtyAbnormalLoss || 0) > 0;
  const currentStatus = jwo.jwoStatus || jwo.status;

  // Job Work Consolidation left the lifecycle actions on the old dyeing/printing screens, so the
  // page named after the document could not delete it — you had to know to go to
  // /manufacturing/dyeing instead. This reuses the SAME guarded endpoint that screen calls
  // (it is already keyed on the JWO id), rather than adding a second delete path: the backend
  // refuses unless status is READY_TO_SEND and jwoStatus is DRAFT, and it reverts the linked MRP
  // requirements back to open so they can be re-planned.
  // Mirrors the backend guard: not already cancelled, and nothing received yet.
  const canCancel = jwo.jwoStatus !== 'CANCELLED' && !jwo.receivedDate && !jwo.qtyReceivedMeters;

  const canDelete =
    jwo.status === 'READY_TO_SEND' &&
    // Mirror the backend guard EXACTLY (dyeing.controller deleteProcessPO). Being stricter here is
    // what caused the original problem: the dyeing list only offered Delete for status 'DRAFT',
    // so records the backend was happy to delete had no button anywhere in the UI.
    (!jwo.jwoStatus || ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(jwo.jwoStatus)) &&
    (jwo.processType === 'DYEING' || jwo.processType === 'PRINTING');

  // ── Issue dialog: multi-lot state derived from the server's preview ──────────────────────────
  // A greige order stitched from two deliveries needs two rows. The old dialog offered only lots
  // that could cover the whole order alone, which left such an order with an empty dropdown and
  // no way to issue it at all — so nothing here filters the options by quantity.
  const issuesFromFabricRoll = !!jwo.fabricStockLotId;
  const issuesGreige = jwo.fabricType === 'GREIGE';
  const issueRequiredQty = issuePreview?.requiredQty ?? jwo.qtySentMeters;
  const issueUom = issuePreview?.uom ?? jwo.uom;
  const issueAvailableLots = issuePreview?.availableLots ?? [];

  // The preview is computed with NO lots supplied, so it validates whatever lot the order was
  // STAMPED with at creation — a lot the operator is about to replace in the rows below. Only
  // order-level blockers survive that replacement and may veto the action; every lot-level one
  // (no lot yet, stale//exhausted/at-processor/wrong-cloth/wrong-width stored lot) is answered by
  // the selection itself, and the server re-validates the chosen lots on submit.
  const issueBlockers = (issuePreview?.blockers ?? []).filter((b) => ISSUE_FATAL_BLOCKER_CODES.has(b.code));

  // Shared with the consolidated dispatch screen: the rules a valid issue must satisfy are the
  // client-side half of the server's guards, so there is deliberately only ONE implementation.
  const issueOrderWidth = jwo.greigeWidthInches != null ? Number(jwo.greigeWidthInches) : null;
  const issueEval = evaluateLotRows({
    rows: issueRows,
    lots: issueAvailableLots,
    requiredQty: issueRequiredQty,
    orderWidthInches: issueOrderWidth,
  });
  const {
    totalMatches: issueTotalMatches,
    hasDuplicateLot: issueHasDuplicateLot,
    hasMixedGreige: issueHasMixedGreige,
    rowsComplete: issueRowsComplete,
    noLotChosen: issueNoLotChosen,
    widthMismatchLots: issueWidthMismatchLots,
    needsWidthAck: issueNeedsWidthAck,
  } = issueEval;

  // Non-greige service work legitimately consumes nothing, so leaving every row blank is a valid
  // answer there — but a greige order that issues no material is the bug this dialog was built for.
  const issueAllowsNoLot = !issuesGreige && !issuesFromFabricRoll;
  const issueSelectionValid = issuesFromFabricRoll
    ? true
    : issueAllowsNoLot && issueNoLotChosen
      ? true
      : issueRowsComplete &&
        issueTotalMatches &&
        !issueHasDuplicateLot &&
        !issueHasMixedGreige &&
        (!issueNeedsWidthAck || issueWidthAcknowledged);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Factory className="h-6 w-6" />
              {jwo.jobWorkNumber}
            </h1>
            <p className="text-muted-foreground">
              {jwo.processType} • {jwo.processor?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(currentStatus)}
          <Button variant="outline" size="sm" onClick={() => openPDF(`/documents/job-work-orders/${id}/pdf`)}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWaDialogOpen(true)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Send via WhatsApp
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelMutation.isPending}
            >
              <Ban className="mr-2 h-4 w-4" />
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Section 143 Warning</AlertTitle>
          <AlertDescription>
            Material has been at processor for {daysOutstanding} days.
            {daysOutstanding! > 365
              ? ' BREACHED: Deemed taxable supply applies.'
              : ' Action required to avoid statutory breach.'}
          </AlertDescription>
        </Alert>
      )}

      {hasAbnormalLoss && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Abnormal Loss Detected</AlertTitle>
          <AlertDescription>
            {jwo.qtyAbnormalLoss?.toFixed(2)} {jwo.uom} loss beyond tolerance. Debit note required for processor.
          </AlertDescription>
        </Alert>
      )}

      {jwo.gstRate === null && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>GST Rate Pending</AlertTitle>
          <AlertDescription>
            GST rate for {jwo.processType} is unresolved. Commercial documents cannot be generated until CA confirms the
            rate (5% vs 18%).
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Process Type</Label>
                  <p className="font-medium">{jwo.processTypeMaster?.name || jwo.processType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SAC Code</Label>
                  <p className="font-medium">{jwo.processTypeMaster?.sacCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Style</Label>
                  <p className="font-medium">
                    {jwo.style?.styleCode || '-'}
                    {jwo.style?.buyerStyleRef && (
                      <span className="text-sm text-muted-foreground ml-1">({jwo.style.buyerStyleRef})</span>
                    )}
                  </p>
                </div>
                {colourName && (
                  <div>
                    {/* Same ladder as the server: requirement chain first, then the shade stamped
                        on a stock order, which is the only place a style-less job can carry one. */}
                    <Label className="text-muted-foreground">Colour</Label>
                    <p className="font-medium flex items-center gap-2">
                      {jwo.colorMaster?.hexCode && (
                        <span
                          className="h-4 w-4 rounded border border-border flex-shrink-0"
                          style={{ backgroundColor: jwo.colorMaster.hexCode }}
                          title={jwo.colorMaster.hexCode}
                        />
                      )}
                      {colourName}
                    </p>
                  </div>
                )}
                {jwo.fabricType === 'GREIGE' ? (
                  <div>
                    {/* We ISSUE greige — the finished fabric gets its identity on receipt */}
                    <Label className="text-muted-foreground">Greige</Label>
                    <p className="font-medium">
                      {jwo.greigeStockLot?.greige?.greigeName ??
                        jwo.requirementLinks?.[0]?.materialRequirements?.orderBomItem?.greige?.greigeName ??
                        jwo.requirementLinks?.[0]?.materialRequirements?.materials?.name ??
                        '-'}
                    </p>
                    {(jwo.greigeStockLot?.greige?.greigeCode ??
                      jwo.requirementLinks?.[0]?.materialRequirements?.orderBomItem?.greige?.greigeCode) && (
                      <p className="text-xs text-muted-foreground">
                        {jwo.greigeStockLot?.greige?.greigeCode ??
                          jwo.requirementLinks?.[0]?.materialRequirements?.orderBomItem?.greige?.greigeCode}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label className="text-muted-foreground">Fabric</Label>
                    <p className="font-medium">{jwo.fabric?.fabricName || jwo.fabric?.fabricCode || '-'}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Rate per {jwo.uom}</Label>
                  <p className="font-medium">
                    {formatCurrency(jwo.agreedRatePerMeter)}
                    {jwo.isRateTbd && (
                      <Badge variant="outline" className="ml-2">
                        TBD
                      </Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tolerance</Label>
                  <p className="font-medium">{effectiveTolerancePercent(jwo).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quantities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Quantities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* DB-field vocabulary (user 2026-08-17): Greige = qtySentMeters, Fabric = qtyBillable.
                  Non-greige jobs (embroidery pieces etc.) keep the neutral labels. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground">{jwo.fabricType === 'GREIGE' ? 'Greige' : 'Qty Sent'}</Label>
                  <p className="text-xl font-bold">
                    {jwo.qtySentMeters.toFixed(2)} {jwo.uom}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    {jwo.fabricType === 'GREIGE' ? 'Fabric' : 'Expected Back'}
                  </Label>
                  <p className="text-xl font-bold">
                    {jwo.qtyBillable != null ? `${jwo.qtyBillable.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Qty Received</Label>
                  <p className="text-xl font-bold">
                    {jwo.qtyReceivedMeters ? `${jwo.qtyReceivedMeters.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Abnormal Loss</Label>
                  <p className={`text-xl font-bold ${hasAbnormalLoss ? 'text-red-500' : ''}`}>
                    {jwo.qtyAbnormalLoss ? `${jwo.qtyAbnormalLoss.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Widths (industry model 2026-08-18): greige loom width in; the processor is asked
                  for a FINISHED (stenter) width = cutable + selvedge deduction; received is measured.
                  received < asked ⟺ the cutable target is missed. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground">Greige Width</Label>
                  <p className="font-medium">
                    {jwo.greigeWidthInches != null ? `${Number(jwo.greigeWidthInches)}"` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Finished Width (Asked)</Label>
                  <p className="font-medium">{jwo.sentWidthInches != null ? `${Number(jwo.sentWidthInches)}"` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cutable Width (CAD)</Label>
                  <p className="font-medium">
                    {jwo.sentWidthInches != null && cutableWidthDeduction != null
                      ? `${(Number(jwo.sentWidthInches) - cutableWidthDeduction).toFixed(1)}"`
                      : '-'}
                  </p>
                  {jwo.sentWidthInches != null && cutableWidthDeduction != null && (
                    <p className="text-xs text-muted-foreground">after {cutableWidthDeduction}" selvedge</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Finished Width (Received)</Label>
                  <p
                    className={`font-medium ${
                      jwo.receivedWidthInches != null &&
                      jwo.sentWidthInches != null &&
                      Number(jwo.receivedWidthInches) < Number(jwo.sentWidthInches)
                        ? 'text-red-500'
                        : ''
                    }`}
                  >
                    {jwo.receivedWidthInches != null ? `${Number(jwo.receivedWidthInches)}"` : '-'}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground">Sent Date</Label>
                  <p className="font-medium">{jwo.sentDate ? format(new Date(jwo.sentDate), 'dd MMM yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Need By</Label>
                  <p
                    className={`font-medium ${
                      jwo.expectedReturnDate &&
                      !jwo.receivedDate &&
                      jwo.jwoStatus !== 'CLOSED' &&
                      jwo.jwoStatus !== 'CANCELLED' &&
                      new Date(jwo.expectedReturnDate) < new Date()
                        ? 'text-red-500'
                        : ''
                    }`}
                  >
                    {jwo.expectedReturnDate ? format(new Date(jwo.expectedReturnDate), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Received Date</Label>
                  <p className="font-medium">
                    {jwo.receivedDate ? format(new Date(jwo.receivedDate), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Days Outstanding</Label>
                  <p className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>
                    {daysOutstanding !== null ? `${daysOutstanding} days` : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <Label className="text-muted-foreground">Shrinkage</Label>
                  <p className="font-medium">{jwo.expectedShrinkage != null ? `${jwo.expectedShrinkage}%` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Actual Shrinkage</Label>
                  <p className="font-medium">{jwo.actualShrinkage ? `${jwo.actualShrinkage.toFixed(2)}%` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Process Loss (shrinkage + tolerance)</Label>
                  <p className="font-medium text-muted-foreground">
                    {jwo.qtyNormalLoss ? `${jwo.qtyNormalLoss.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Components */}
          {jwo.components && jwo.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Components</CardTitle>
                <CardDescription>Materials included in this job work order</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty Sent</TableHead>
                      <TableHead className="text-right">Qty Received</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jwo.components.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>{comp.componentName || comp.materialType}</TableCell>
                        <TableCell>
                          {comp.greige?.greigeCode || comp.fabric?.fabricCode || comp.lace?.laceCode || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {comp.qtySent.toFixed(2)} {comp.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {comp.qtyReceived ? `${comp.qtyReceived.toFixed(2)} ${comp.unit}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(comp.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Reconciliation (Phase 3b — computed from challan lines, D5) */}
          {reconciliation && reconciliation.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reconciliation</CardTitle>
                <CardDescription>
                  Balance with processor, computed from challan lines
                  {reconciliation.source === 'ORDER_SNAPSHOT' && ' (order snapshot — no challan attribution yet)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Sent Out</TableHead>
                      <TableHead className="text-right">Received Back</TableHead>
                      <TableHead className="text-right">With Processor</TableHead>
                      <TableHead className="text-right">Abnormal Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliation.components.map((c, idx) => (
                      <TableRow key={c.id || idx}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="text-right">
                          {c.outward.toFixed(2)} {c.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.inward.toFixed(2)} {c.unit}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {c.balanceWithVendor.toFixed(2)} {c.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.qtyAbnormalLoss != null && c.qtyAbnormalLoss > 0 ? (
                            <span className="text-red-600 font-medium">
                              {c.qtyAbnormalLoss.toFixed(2)} {c.unit}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Commercial & Actions */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentStatus === 'DRAFT' && (
                <Button
                  className="w-full"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              )}

              {(currentStatus === 'APPROVED' || currentStatus === 'READY_TO_SEND') && (
                <Button className="w-full" onClick={() => setIssueDialogOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Issue to Processor
                </Button>
              )}

              {(currentStatus === 'ISSUED' ||
                currentStatus === 'AT_MILL' ||
                currentStatus === 'AT_PROCESSOR' ||
                currentStatus === 'SENT_TO_MILL') &&
                !jwo.receivedDate && (
                  <Button className="w-full" onClick={() => setReceiveDialogOpen(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Receive Material
                  </Button>
                )}

              {jwo.jwoStatus !== 'CLOSED' &&
                (jwo.jwoStatus === 'RECEIVED' ||
                  ['RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED'].includes(jwo.status)) && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => {
                      setCloseInvoiceNumber(jwo.invoiceNumber || '');
                      setCloseDialogOpen(true);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Close Order
                  </Button>
                )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => computeTotalsMutation.mutate()}
                disabled={computeTotalsMutation.isPending}
              >
                <Calculator className="mr-2 h-4 w-4" />
                Compute Totals
              </Button>

              <Button
                variant="outline"
                className="w-full"
                disabled={!jwo.outwardChallanId}
                onClick={() => jwo.outwardChallanId && openPDF(`/documents/challans/${jwo.outwardChallanId}/pdf`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                {jwo.outwardChallanId ? 'Print Challan' : 'Print Challan (issue first)'}
              </Button>
            </CardContent>
          </Card>

          {/* Commercial */}
          <Card>
            <CardHeader>
              <CardTitle>Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(jwo.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST ({jwo.gstRate !== null ? `${jwo.gstRate}%` : 'TBD'})</span>
                <span className="font-medium">{formatCurrency(jwo.totalTaxAmount)}</span>
              </div>
              {jwo.isInterstate ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{formatCurrency(jwo.igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatCurrency(jwo.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatCurrency(jwo.sgstAmount)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{formatCurrency(jwo.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Statutory */}
          <Card>
            <CardHeader>
              <CardTitle>Statutory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date (Section 143)</span>
                <span className="font-medium">
                  {jwo.statutoryDueDate ? format(new Date(jwo.statutoryDueDate), 'dd MMM yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-way Bill</span>
                <span className="font-medium">{jwo.ewayBillNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="font-medium">{jwo.paymentTerms || '-'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receive Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Material</DialogTitle>
            <DialogDescription>
              Enter the quantity received from the processor. Loss split will be calculated automatically based on
              tolerance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Quantity Sent</Label>
              <p className="text-lg font-medium">
                {jwo.qtySentMeters.toFixed(2)} {jwo.uom}
              </p>
            </div>
            <div>
              <Label htmlFor="qtyReceived">Quantity Received ({jwo.uom})</Label>
              <Input
                id="qtyReceived"
                type="number"
                step="0.01"
                value={qtyReceived}
                onChange={(e) => setQtyReceived(e.target.value)}
                placeholder={`Expected: ~${(jwo.qtyBillable ?? billableFromGreige(jwo.qtySentMeters, jwo.expectedShrinkage)).toFixed(2)}`}
              />
            </div>
            <div>
              <Label>Tolerance</Label>
              <p className="text-sm text-muted-foreground">
                {effectiveTolerancePercent(jwo).toFixed(1)}% allowed extra loss beyond expected shrinkage
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => receiveMutation.mutate(parseFloat(qtyReceived))}
              disabled={!qtyReceived || receiveMutation.isPending}
            >
              Receive & Calculate Loss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Dialog (Phase 4c: operational issue, multi-lot) */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue to Processor</DialogTitle>
            <DialogDescription>
              Consumes {issueRequiredQty.toFixed(2)} {issueUom} — from one lot or several — creates the outward challan,
              and locks the Section 143 due date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {issueBlockers.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>This order cannot be issued</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {issueBlockers.map((blocker, index) => (
                      <li key={`${blocker.code}-${index}`}>{blocker.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {issuesFromFabricRoll ? (
              <Alert>
                <AlertDescription>
                  This order issues from its selected fabric lot ({jwo.qtySentMeters.toFixed(2)} {jwo.uom} will be
                  consumed{jwo.processType === 'EMBROIDERY' ? ' for embroidery' : ''}).
                </AlertDescription>
              </Alert>
            ) : issuePreviewLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : issuePreviewFailed ? (
              // Without this the empty lot list below would read as a confident "there is no
              // stock" — a factual claim we cannot make when the request never answered.
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not load the available lots</AlertTitle>
                <AlertDescription>
                  The stock check did not answer, so this dialog cannot say what is issuable. Close and reopen it to
                  retry; if it keeps failing the API may be restarting.
                </AlertDescription>
              </Alert>
            ) : issueAvailableLots.length === 0 ? (
              issueAllowsNoLot ? (
                <Alert>
                  <AlertDescription>
                    No greige lot applies to this order — it will be issued as service work, with no material consumed
                    from stock.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No greige available to issue</AlertTitle>
                  <AlertDescription>
                    {issuePreview?.expectedGreige
                      ? `No available greige lots for ${issuePreview.expectedGreige.greigeCode} — ${issuePreview.expectedGreige.greigeName}. `
                      : 'No available greige lots for this order. '}
                    Receive the greige purchase order into stock first. Lots already sitting at a processor, and lots
                    created by a transfer, are deliberately excluded from this list.
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <div className="space-y-3">
                {issuePreview && !issuePreview.greigeAnchored && (
                  <Alert>
                    <AlertDescription>
                      This order has no requirement chain naming its cloth, so any greige may be issued — but every row
                      must be the SAME greige, because one job work order sends one cloth.
                    </AlertDescription>
                  </Alert>
                )}

                <GreigeLotRows
                  rows={issueRows}
                  onRowsChange={setIssueRows}
                  lots={issueAvailableLots}
                  requiredQty={issueRequiredQty}
                  uom={issueUom}
                  evaluation={issueEval}
                  required={issuesGreige}
                  allowNoLot={issueAllowsNoLot}
                  disabled={issueMutation.isPending}
                />

                {issueAllowsNoLot && (
                  <p className="text-xs text-muted-foreground">
                    Leave the lot unselected to issue this as service work, with no material consumed.
                  </p>
                )}
              </div>
            )}

            {issueNeedsWidthAck && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Width differs from the order</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    This order was planned on {issueOrderWidth}″ greige, but{' '}
                    {issueWidthMismatchLots
                      .map((lot) => `${lot.greigeCode ?? 'a chosen lot'} is ${lot.greigeWidth}″`)
                      .join(', ')}
                    . The cutting marker's yield was calculated on the planned width.
                  </p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="issue-width-ack"
                      checked={issueWidthAcknowledged}
                      onCheckedChange={(checked) => setIssueWidthAcknowledged(checked === true)}
                    />
                    <Label htmlFor="issue-width-ack" className="text-sm font-medium cursor-pointer">
                      Issue anyway — I confirm the width difference
                    </Label>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label>Vehicle Number</Label>
              <Input value={issueVehicle} onChange={(e) => setIssueVehicle(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || issueBlockers.length > 0 || !issueSelectionValid}
            >
              <Send className="mr-2 h-4 w-4" />
              {issueMutation.isPending ? 'Issuing...' : 'Issue & Create Challan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Dialog (Phase 3b) */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Job Work Order</DialogTitle>
            <DialogDescription>
              Closing confirms the processor invoice is matched. Orders with abnormal loss need a debit note against the
              linked PO first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="closeInvoice">Processor Invoice Number *</Label>
              <Input
                id="closeInvoice"
                value={closeInvoiceNumber}
                onChange={(e) => setCloseInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-0412"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => closeMutation.mutate()}
              disabled={!closeInvoiceNumber.trim() || closeMutation.isPending}
            >
              Close Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel job work order</DialogTitle>
            <DialogDescription>
              {jwo.jobWorkNumber} will be withdrawn. Any material already issued is credited back to stock, and the
              requirements this order covered return to open so you can adjust the quantity and generate again. The
              record is kept with an audit trail rather than removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. quantity revised after checking greige stock"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep
            </Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel job work order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete job work order"
        description={
          `Delete ${jwo.jobWorkNumber}? Nothing has been sent to ${jwo.processor?.name ?? 'the processor'} yet, ` +
          'so no goods or documents are affected. Any material requirements this order covered go back to ' +
          'open, so they can be planned again. This cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Keep"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
      />

      <JwoWhatsAppSendDialog jwo={jwo} open={waDialogOpen} onOpenChange={setWaDialogOpen} />
    </div>
  );
}
