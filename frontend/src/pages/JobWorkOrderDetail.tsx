/**
 * Job Work Order Detail Page
 * View and manage a single job work order
 */

import { unitPer, unitShort } from '@/lib/units';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  PackageCheck,
  Trash2,
  Ban,
  MessageCircle,
  Undo2,
  ListChecks,
  Boxes,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { jobWorkOrderService, type IssueJwoPayload } from '@/services/jobWorkOrder.service';
import { GreigeLotRows } from '@/components/job-work/GreigeLotRows';
import ReceiveFromProcessorDialog from '@/components/job-work/ReceiveFromProcessorDialog';
import ReturnFromProcessorDialog from '@/components/job-work/ReturnFromProcessorDialog';
import MoveHeldStockDialog, { type MoveLot } from '@/components/job-work/MoveHeldStockDialog';
import {
  bestFitThansForJobs,
  checkSentDate,
  earliestSentDate,
  evaluateLotRows,
  groupLotsForIssue,
  issueMovement,
  lotHasThans,
  picksPayload,
  rowHasPicks,
  thanPickErrors,
  THAN_PICK_TOLERANCE_PCT,
  totalDetailMeters,
  type IssueLotRow,
  type SelectedDetail,
} from '@/components/job-work/lot-rows';
import { ThanPicker } from '@/components/job-work/ThanPicker';
import { foldActual } from '@/lib/fold-length';
import { formatQuantity } from '@/lib/formatters';
import { dyeProcessPOService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import ConfirmDialog from '@/components/ConfirmDialog';
import { openPDF } from '@/lib/document-utils';
import { billableFromGreige, effectiveTolerancePercent } from '@/utils/shrinkage';
import { JwoWhatsAppSendDialog } from '@/components/JwoWhatsAppSendDialog';
import { useDefaultSettings } from '@/hooks/useDefaultSettings';
import { formatDate, toDateInputValue } from '@/lib/date';
import { section143Days, SECTION_143_CRITICAL_DAYS } from '@/lib/section143';
import { isQtyZero, prefillQty, qtyAtLeast, qtyExceeds, qtyRemaining, snapToLimit } from '@/lib/quantity';

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

/**
 * Blockers that no lot selection can clear, so only these may disable the action. Everything
 * else the preview reports is about the order's stamped lot, which the rows below replace.
 */
const ISSUE_FATAL_BLOCKER_CODES = new Set(['ALREADY_ISSUED', 'ORDER_CANCELLED', 'NOT_FOUND']);

/** Job statuses after the material left — mirrors ISSUED_JOB_STATUSES behind record-thans. */
const ISSUED_JOB_STATUSES = [
  'ISSUED',
  'IN_TRANSIT',
  'AT_PROCESSOR',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'QUALITY_CHECKED',
  'STOCK_UPDATED',
  'CLOSED',
];

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
  'LOT_AT_WRONG_PROCESSOR',
  'LOT_HELD_WITHOUT_CHALLAN',
  'SENT_DATE_IN_FUTURE',
  'SENT_DATE_BEFORE_RECEIPT',
  'SENT_BEFORE_ARRIVAL',
];

export default function JobWorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveFromProcessorOpen, setReceiveFromProcessorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const { cutableWidthDeduction } = useDefaultSettings();
  const [cancelReason, setCancelReason] = useState('');
  // Two-step cancel: disposition dialog shown after cancellation for issued JWOs
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<
    'RETURNED_TO_STOCK' | 'AT_PROCESSOR' | 'WRITTEN_OFF' | 'TRANSFERRED' | 'RETURNED_TO_SUPPLIER'
  >('RETURNED_TO_STOCK');
  const [dispositionNotes, setDispositionNotes] = useState('');
  const [qtyReceived, setQtyReceived] = useState('');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeInvoiceNumber, setCloseInvoiceNumber] = useState('');
  // Close short — nothing more is coming: the "Close … short?" confirmation on a Partial Receipt job.
  const [closeShortOpen, setCloseShortOpen] = useState(false);
  // Returned unprocessed — the processor sent it back untouched.
  const [returnUnprocessedOpen, setReturnUnprocessedOpen] = useState(false);
  // Phase 4c: operational issue dialog (greige lots + transport)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueRows, setIssueRows] = useState<IssueLotRow[]>([{ lotId: '', qty: '' }]);
  const [issueWidthAcknowledged, setIssueWidthAcknowledged] = useState(false);
  const [issueVehicle, setIssueVehicle] = useState('');
  // The day the goods left (or the job took the cloth at the processor) — today unless told otherwise
  const [issueSentDate, setIssueSentDate] = useState(() => toDateInputValue(new Date()));
  // Record thans sent — name the thans that left on a job issued by quantity only
  const [recordThansOpen, setRecordThansOpen] = useState(false);
  const [recordLotId, setRecordLotId] = useState('');
  const [recordPicks, setRecordPicks] = useState<SelectedDetail[]>([]);
  // "Best fit for all jobs": the thans fitted to the OTHER same-trip jobs, keyed by their job id
  const [recordGroupPicks, setRecordGroupPicks] = useState<Record<string, SelectedDetail[]>>({});
  const [recordGroupNote, setRecordGroupNote] = useState<string | null>(null);

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

  // Cancel is the universal withdrawal path: it works for every process type, reverts the
  // requirements this order covered to open. For ISSUED JWOs, shows disposition dialog after.
  const cancelMutation = useMutation({
    mutationFn: () => jobWorkOrderService.cancel(id!, cancelReason || undefined),
    onSuccess: (result) => {
      setCancelDialogOpen(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['mrp'] });
      queryClient.invalidateQueries({ queryKey: ['service-requirements'] });

      // Two-step cancel: if material was issued, prompt for disposition
      if (result.pendingDisposition) {
        toast.success(`${jwo?.jobWorkNumber ?? 'Job work order'} cancelled. Now decide what happens to the material.`);
        setDispositionDialogOpen(true);
      } else {
        toast.success(`${jwo?.jobWorkNumber ?? 'Job work order'} cancelled.`);
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to cancel job work order';
      toast.error(msg);
    },
  });

  // Two-step cancel: dispose inventory after cancellation
  const dispositionMutation = useMutation({
    mutationFn: () =>
      jobWorkOrderService.disposeInventory(id!, selectedDisposition, {
        notes: dispositionNotes || undefined,
      }),
    onSuccess: () => {
      const messages: Record<string, string> = {
        RETURNED_TO_STOCK: 'Material credited back to warehouse stock',
        AT_PROCESSOR: 'Material left at processor for future use',
        WRITTEN_OFF: 'Material marked as written off',
        TRANSFERRED: 'Material transferred to another JWO',
        RETURNED_TO_SUPPLIER: 'Material marked for return to supplier',
      };
      toast.success(messages[selectedDisposition]);
      setDispositionDialogOpen(false);
      setDispositionNotes('');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['greige-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to dispose inventory';
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
  // "Move here" from another processor in the Issue dialog (Phase 4c): the holder whose lots to move
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const {
    data: issuePreview,
    isLoading: issuePreviewLoading,
    isError: issuePreviewFailed,
    refetch: refetchIssuePreview,
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
      setIssueSentDate(toDateInputValue(new Date()));
      return;
    }
    if (!issuePreview) return;
    setIssueRows((rows) => {
      if (rows.length !== 1 || rows[0].lotId || rows[0].qty) return rows;
      // A service order consumes nothing by default — preselecting a lot for it would quietly
      // send material that nobody asked to send. Greige and lace jobs both do consume.
      if (issuePreview.fabricType !== 'GREIGE' && issuePreview.fabricType !== 'LACE') return rows;
      const required = issuePreview.requiredQty;
      const singleCoveringLot = issuePreview.availableLots.find((lot) => qtyAtLeast(lot.quantityAvailable, required));
      return [{ lotId: singleCoveringLot?.id ?? '', qty: required > 0 ? prefillQty(required) : '' }];
    });
  }, [issueDialogOpen, issuePreview]);

  const issueMutation = useMutation({
    mutationFn: () => {
      const filledRows = issueRows.filter((row) => row.lotId && parseFloat(row.qty) > 0);
      const lotAvailable = (lotId: string, fallback: number) =>
        issuePreview?.availableLots.find((lot) => lot.id === lotId)?.quantityAvailable ?? fallback;
      const isGreigeIssue =
        jwo?.fabricType === 'GREIGE' && !jwo?.fabricStockLotId && issuePreview?.fabricType !== 'LACE';
      // A lot that has thans but went out by quantity leaves its thans unnamed — say so after the issue
      const thansUnrecorded = isGreigeIssue && filledRows.some((row) => lotHasThans(row) && !rowHasPicks(row));
      // Any picked than sends the whole issue through issue-with-details: rows with picks name their
      // thans (COUNTED — the server converts them), rows without travel as an ACTUAL quantity.
      if (isGreigeIssue && filledRows.some(rowHasPicks)) {
        return jobWorkOrderService
          .issueWithDetails(id!, {
            sentDate: issueSentDate || undefined,
            vehicleNumber: issueVehicle || undefined,
            acknowledgeWidthMismatch: issueWidthAcknowledged || undefined,
            lots: filledRows.map((row) =>
              rowHasPicks(row)
                ? { greigeStockLotId: row.lotId, details: picksPayload(row.selectedDetails) }
                : {
                    greigeStockLotId: row.lotId,
                    qty: snapToLimit(parseFloat(row.qty), lotAvailable(row.lotId, parseFloat(row.qty))),
                  }
            ),
          })
          .then((result) => ({ ...result, thansUnrecorded }));
      }
      const payload: IssueJwoPayload = {
        sentDate: issueSentDate || undefined,
        vehicleNumber: issueVehicle || undefined,
        acknowledgeWidthMismatch: issueWidthAcknowledged || undefined,
      };
      // A lace job always sends lots[], single row included: the order header has no lace-lot
      // pointer to fall back on, so the row IS the only statement of which lot leaves.
      if (issuePreview?.fabricType === 'LACE') {
        payload.lots = filledRows.map((row) => ({
          laceStockLotId: row.lotId,
          // A full lot typed at 2 decimals IS the full lot (see @/lib/quantity)
          qty: snapToLimit(parseFloat(row.qty), lotAvailable(row.lotId, parseFloat(row.qty))),
        }));
      }
      // One lot goes on the wire exactly as it always has. The server then consumes the order's
      // own qtySentMeters, so the issued quantity cannot drift from a re-typed number; lots[] is
      // reserved for a genuine split, where only the operator knows how it divides.
      else if (filledRows.length === 1) {
        payload.greigeStockLotId = filledRows[0].lotId;
      } else if (filledRows.length > 1) {
        payload.lots = filledRows.map((row) => ({
          greigeStockLotId: row.lotId,
          qty: snapToLimit(parseFloat(row.qty), lotAvailable(row.lotId, parseFloat(row.qty))),
        }));
      }
      return jobWorkOrderService.issue(id!, payload).then((result) => ({ ...result, thansUnrecorded }));
    },
    onSuccess: (result) => {
      setIssueDialogOpen(false);
      setIssueRows([{ lotId: '', qty: '' }]);
      setIssueWidthAcknowledged(false);
      setIssueVehicle('');
      // Virtual issuance (stock already at processor) vs physical dispatch
      const thansNote = result.thansUnrecorded
        ? {
            description: 'Thans not recorded — you can record them later from the job (Record thans sent).',
            duration: 8000,
          }
        : undefined;
      // Cloth already at the processor is drawn where it lies under the challan that covers it
      const drawn = result.drawnAt
        ? `allocated at ${result.drawnAt}${result.coveringChallans ? ` under challan ${result.coveringChallans}` : ''}`
        : null;
      if (!result.challanCreated) {
        toast.success(`Job work order ${drawn ?? 'issued'} — nothing dispatched, no new challan`, thansNote);
      } else {
        toast.success(
          `Job work order issued — Challan ${result.challanNumber} created${drawn ? `; the rest ${drawn}` : ''}`,
          thansNote
        );
      }
      if (result.warning) toast.warning(result.warning);
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-order-reconciliation', id] });
      queryClient.invalidateQueries({ queryKey: ['jwo-issue-preview', id] });
      queryClient.invalidateQueries({ queryKey: ['jwo-than-record', id] });
      queryClient.invalidateQueries({ queryKey: ['greige-lot-thans'] });
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

  // Record thans sent: which greige lots this issued job took, and how much of each is named by than
  const thanRecordEnabled = !!id && jwo?.fabricType === 'GREIGE' && ISSUED_JOB_STATUSES.includes(jwo.jwoStatus);
  const { data: thanRecord } = useQuery({
    queryKey: ['jwo-than-record', id],
    queryFn: () => jobWorkOrderService.getThanRecord(id!),
    enabled: thanRecordEnabled,
  });
  const thanRecordPending = (thanRecord?.lots ?? []).filter(
    (lot) => lot.lotHasThans && qtyExceeds(lot.takenActual, lot.recordedActual)
  );
  const recordLot = thanRecordPending.find((lot) => lot.greigeStockLotId === recordLotId);
  const { data: recordLotThans, isLoading: recordLotThansLoading } = useQuery({
    queryKey: ['greige-lot-thans', recordLotId],
    queryFn: () => jobWorkOrderService.getAvailableDetails(recordLotId),
    enabled: recordThansOpen && !!recordLotId,
    staleTime: 0,
  });
  // ACTUAL metres still to name on this lot
  const recordTarget = recordLot ? qtyRemaining(recordLot.takenActual, recordLot.recordedActual) : 0;
  // The server's own check: everything named on the lot, converted once, must not exceed what the job took
  const recordAfterActual = recordLot
    ? foldActual(recordLot.recordedCounted + totalDetailMeters(recordPicks), recordLot.foldLengthCm)
    : 0;
  const recordOverTaken =
    !!recordLot && qtyExceeds(recordAfterActual, (recordLot.takenActual * (100 + THAN_PICK_TOLERANCE_PCT)) / 100);
  const recordPickErrors = thanPickErrors(recordPicks, recordLotThans);

  // Other jobs that went to this processor the same day from this lot, thans still unnamed
  const recordSiblings = (thanRecord?.siblings ?? []).flatMap((sib) =>
    sib.lots
      .filter((lot) => lot.greigeStockLotId === recordLotId)
      .map((lot) => ({
        jwoId: sib.jwoId,
        jobWorkNumber: sib.jobWorkNumber,
        target: qtyRemaining(lot.takenActual, lot.recordedActual),
      }))
  );
  const groupJobs = recordSiblings.filter((sib) => (recordGroupPicks[sib.jwoId] ?? []).length > 0);
  // The picker for THIS job hides thans already fitted to the other jobs
  const groupTaken = new Set(Object.values(recordGroupPicks).flatMap((picks) => picks.map((p) => p.detailId)));
  const recordPickerThans =
    recordLotThans && groupTaken.size > 0
      ? { ...recordLotThans, details: recordLotThans.details.filter((d) => !groupTaken.has(d.id)) }
      : recordLotThans;

  const clearRecordGroup = () => {
    setRecordGroupPicks({});
    setRecordGroupNote(null);
  };

  const fitRecordGroup = () => {
    if (!recordLotThans || !id) return;
    const fit = bestFitThansForJobs(recordLotThans, [
      { key: id, targetActual: recordTarget },
      ...recordSiblings.map((sib) => ({ key: sib.jwoId, targetActual: sib.target })),
    ]);
    if (!fit) {
      clearRecordGroup();
      setRecordGroupNote(
        `No set of whole thans fits all ${recordSiblings.length + 1} jobs within ${THAN_PICK_TOLERANCE_PCT}% each — record them one by one.`
      );
      return;
    }
    setRecordPicks(fit.perJob[id]?.picks ?? []);
    setRecordGroupPicks(
      Object.fromEntries(recordSiblings.map((sib) => [sib.jwoId, fit.perJob[sib.jwoId]?.picks ?? []]))
    );
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const parts = [plural(fit.balesWhole, 'whole bale')];
    if (fit.balesBroken > 0) parts.push(`${plural(fit.balesBroken, 'bale')} broken`);
    if (fit.balesShared > 0) parts.push(`${plural(fit.balesShared, 'bale')} shared between jobs`);
    setRecordGroupNote(
      `Fitted on the total: ${parts.join(', ')} — ${formatQuantity(fit.actual, jwo?.uom ?? 'MTR')} actual, no than cut.` +
        (fit.combined ? '' : ' (The total would not share out, so the jobs were fitted one after another.)')
    );
  };

  const openRecordThans = () => {
    setRecordLotId(thanRecordPending[0]?.greigeStockLotId ?? '');
    setRecordPicks([]);
    clearRecordGroup();
    setRecordThansOpen(true);
  };

  const recordThansMutation = useMutation({
    mutationFn: async () => {
      const own = { greigeStockLotId: recordLotId, details: picksPayload(recordPicks) };
      if (groupJobs.length === 0) {
        const result = await jobWorkOrderService.recordThans(id!, { lots: [own] });
        return [result.jobWorkNumber];
      }
      const results = await jobWorkOrderService.recordThansBatch([
        { jwoId: id!, lots: [own] },
        ...groupJobs.map((sib) => ({
          jwoId: sib.jwoId,
          lots: [{ greigeStockLotId: recordLotId, details: picksPayload(recordGroupPicks[sib.jwoId]) }],
        })),
      ]);
      return results.map((r) => r.jobWorkNumber);
    },
    onSuccess: (jobNumbers) => {
      toast.success(`Thans recorded on ${jobNumbers.join(', ')}`);
      setRecordThansOpen(false);
      setRecordPicks([]);
      clearRecordGroup();
      queryClient.invalidateQueries({ queryKey: ['jwo-than-record'] });
      queryClient.invalidateQueries({ queryKey: ['greige-lot-thans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['greige-stock'] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not record the thans', { duration: 8000 });
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

  // Close short — nothing more is coming. The figures in the confirmation are the server's own loss
  // split for the total already received (the same preview the receive dialog uses); the page works
  // out no money math.
  const receivedSoFar = Number(jwo?.qtyReceivedMeters ?? 0);
  const { data: closeShortPreview } = useQuery({
    queryKey: ['jwo-receive-preview', id, receivedSoFar, 'close-short'],
    queryFn: () => jobWorkOrderService.getReceivePreview(id!, receivedSoFar),
    enabled: closeShortOpen && !!id && receivedSoFar > 0,
  });
  const closeShortMutation = useMutation({
    mutationFn: () => jobWorkOrderService.closeShort(id!, { shortCloseConfirmed: true }),
    onSuccess: (result) => {
      const abnormal = Number(result.lossSplit?.qtyAbnormalLoss ?? 0);
      toast.success(
        `${result.data.jobWorkNumber} closed short on ${receivedSoFar.toFixed(2)} ${unitShort(result.data.uom)}`,
        {
          description:
            abnormal > 0
              ? `${abnormal.toFixed(2)} ${unitShort(result.data.uom)} abnormal loss — a debit note against the processor is needed before the job can be closed.`
              : undefined,
          duration: abnormal > 0 ? 8000 : undefined,
        }
      );
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-order-reconciliation', id] });
      queryClient.invalidateQueries({ queryKey: ['process-pos'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not close the job short');
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

  // From the day the processor got the goods — before the send date for cloth taken where it lay
  const daysOutstanding = section143Days(jwo);
  // Colour ladder, order-linked rungs first — mirrors the server's fabric-identity helper and
  // the challan. The last two only ever fire on a stock job, which has no requirement chain.
  const colourName =
    jwo.requirementLinks?.[0]?.materialRequirements?.colorName ?? jwo.colorMaster?.colorName ?? jwo.colorName ?? null;
  const isOverdue = daysOutstanding !== null && daysOutstanding > SECTION_143_CRITICAL_DAYS && !jwo.receivedDate;
  const hasAbnormalLoss = (jwo.qtyAbnormalLoss || 0) > 0;
  const currentStatus = jwo.jwoStatus;

  // Job Work Consolidation left the lifecycle actions on the old dyeing/printing screens, so the
  // page named after the document could not delete it — you had to know to go to
  // /manufacturing/dyeing instead. This reuses the SAME guarded endpoint that screen calls
  // (it is already keyed on the JWO id), rather than adding a second delete path: the backend
  // refuses unless status is READY_TO_SEND and jwoStatus is DRAFT, and it reverts the linked MRP
  // requirements back to open so they can be re-planned.
  // Mirrors the backend guard: not already cancelled, and nothing received yet.
  const canCancel = jwo.jwoStatus !== 'CANCELLED' && !jwo.receivedDate && !jwo.qtyReceivedMeters;

  const canDelete =
    // Mirror the backend guard EXACTLY (dyeing.controller deleteProcessPO). Being stricter here is
    // what caused the original problem: the dyeing list only offered Delete for status 'DRAFT',
    // so records the backend was happy to delete had no button anywhere in the UI.
    ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(jwo.jwoStatus) &&
    (jwo.processType === 'DYEING' || jwo.processType === 'PRINTING');

  // ── Issue dialog: multi-lot state derived from the server's preview ──────────────────────────
  // A greige order stitched from two deliveries needs two rows. The old dialog offered only lots
  // that could cover the whole order alone, which left such an order with an empty dropdown and
  // no way to issue it at all — so nothing here filters the options by quantity.
  const issuesFromFabricRoll = !!jwo.fabricStockLotId;
  const issuesGreige = jwo.fabricType === 'GREIGE';
  /** A dyeing job whose material is lace: consumes lace_stock lots, mints no fabric. */
  const issuesLace = jwo.fabricType === 'LACE';
  const issueRequiredQty = issuePreview?.requiredQty ?? jwo.qtySentMeters;
  const issueUom = issuePreview?.uom ?? jwo.uom;
  const issueProcessorName = issuePreview?.processorName ?? jwo.processor?.name ?? 'Processor';
  // Everything this job may draw: at the processor first (oldest first), then our stores
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

  // Where the chosen cloth is: drawn where it lies at the processor, travelling on a challan, or both
  const issueMove = issueMovement(issueRows, issueAvailableLots);
  // A fabric-roll job has no lot rows: its lot already at the processor means nothing travels (Phase 4a)
  const issueNothingTravels = issuesFromFabricRoll
    ? !!issuePreview?.fabricLot?.heldHere
    : !issueMove.travels && issueMove.drawsHere;
  // Where the offered lots are — one badge per place
  const issueLotGroups = groupLotsForIssue(issueAvailableLots, issueProcessorName);
  // The same cloth at OTHER processors: shown so nobody hunts for it, never offered on this job
  const issueElsewhere = Object.entries(
    (issuePreview?.greigeAnchored ? (issuePreview?.elsewhere ?? []) : []).reduce<Record<string, number>>((acc, lot) => {
      const holder = lot.location?.holderName ?? 'another processor';
      acc[holder] = (acc[holder] ?? 0) + lot.quantityAvailable;
      return acc;
    }, {})
  );
  // The same cloth's lots at each OTHER processor — "Move here" sends them on to this job's processor
  // with a challan (Phase 4c), after which they are offered above
  const issueElsewhereLots = (issuePreview?.greigeAnchored ? (issuePreview?.elsewhere ?? []) : []).reduce<
    Record<string, MoveLot[]>
  >((acc, lot) => {
    const holder = lot.location?.holderName ?? 'another processor';
    (acc[holder] ??= []).push({
      lotType: issuesLace ? 'LACE' : 'GREIGE',
      id: lot.id,
      code: lot.greigeCode ?? lot.greigeName ?? 'Lot',
      quantityAvailable: lot.quantityAvailable,
      receivedDate: lot.receivedDate ?? null,
    });
    return acc;
  }, {});
  const issueChosenLots = issueRows
    .map((row) => issueAvailableLots.find((lot) => lot.id === row.lotId))
    .filter((lot): lot is (typeof issueAvailableLots)[number] => !!lot);
  const issueToday = toDateInputValue(new Date());
  const issueDateCheck = checkSentDate(issueSentDate, issueChosenLots, issueToday);

  // Non-greige service work legitimately consumes nothing, so leaving every row blank is a valid
  // answer there — but a greige order that issues no material is the bug this dialog was built for.
  // A lace job is in the same boat as a greige one: it exists to send material out.
  const issueAllowsNoLot = !issuesGreige && !issuesLace && !issuesFromFabricRoll;
  const issueSelectionValid = issuesFromFabricRoll
    ? true
    : issueAllowsNoLot && issueNoLotChosen
      ? true
      : issueRowsComplete &&
        issueTotalMatches &&
        !issueEval.hasThanErrors &&
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
      {/* Two-step cancel: pending disposition banner */}
      {jwo.jwoStatus === 'CANCELLED' && jwo.inventoryDisposition === 'PENDING' && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <Package className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">Inventory disposition pending</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              This JWO was cancelled but {jwo.qtySentMeters} meters of material is still at{' '}
              {jwo.processor?.name ?? 'the processor'}.
            </span>
            <Button size="sm" variant="outline" onClick={() => setDispositionDialogOpen(true)}>
              Decide now
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
            {jwo.qtyAbnormalLoss?.toFixed(2)} {unitShort(jwo.uom)} loss beyond tolerance. Debit note required for
            processor.
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
                {issuesLace ? (
                  <>
                    <div>
                      {/* Both ends are known up front on a lace job: the variant was chosen when
                          the job was raised, so nothing has to be named at receipt. */}
                      <Label className="text-muted-foreground">Greige Lace</Label>
                      <p className="font-medium">{jwo.greigeLace?.laceName ?? '-'}</p>
                      {jwo.greigeLace?.laceCode && (
                        <p className="text-xs text-muted-foreground">{jwo.greigeLace.laceCode}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Dyed Variant</Label>
                      <p className="font-medium">{jwo.finishedLace?.laceName ?? '-'}</p>
                      {jwo.finishedLace?.laceCode && (
                        <p className="text-xs text-muted-foreground">
                          {jwo.finishedLace.laceCode}
                          {jwo.finishedLace.color ? ` — ${jwo.finishedLace.color}` : ''}
                        </p>
                      )}
                    </div>
                  </>
                ) : jwo.fabricType === 'GREIGE' ? (
                  <div>
                    {/* We ISSUE greige — the finished fabric gets its identity on receipt.
                        A hand-raised stock job names the greige on its header (that is what its
                        rate and shrinkage were quoted on, and the only cloth it can be issued
                        from); order-linked jobs still read it off the lot or the chain. */}
                    <Label className="text-muted-foreground">Greige</Label>
                    <p className="font-medium">
                      {jwo.greige?.greigeName ??
                        jwo.greigeStockLot?.greige?.greigeName ??
                        jwo.requirementLinks?.[0]?.materialRequirements?.orderBomItem?.greige?.greigeName ??
                        jwo.requirementLinks?.[0]?.materialRequirements?.materials?.name ??
                        '-'}
                    </p>
                    {(jwo.greige?.greigeCode ??
                      jwo.greigeStockLot?.greige?.greigeCode ??
                      jwo.requirementLinks?.[0]?.materialRequirements?.orderBomItem?.greige?.greigeCode) && (
                      <p className="text-xs text-muted-foreground">
                        {jwo.greige?.greigeCode ??
                          jwo.greigeStockLot?.greige?.greigeCode ??
                          jwo.requirementLinks?.[0]?.materialRequirements?.orderBomItem?.greige?.greigeCode}
                        {jwo.greige && !jwo.greigeStockLot ? ' — only lots of this greige can be issued' : ''}
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
                  <Label className="text-muted-foreground">Rate per {unitPer(jwo.uom)}</Label>
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
                  <Label className="text-muted-foreground">
                    {issuesLace ? 'Greige Lace Sent' : jwo.fabricType === 'GREIGE' ? 'Greige' : 'Qty Sent'}
                  </Label>
                  <p className="text-xl font-bold">
                    {jwo.qtySentMeters.toFixed(2)} {unitShort(jwo.uom)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    {issuesLace ? 'Dyed Lace Expected Back' : jwo.fabricType === 'GREIGE' ? 'Fabric' : 'Expected Back'}
                  </Label>
                  <p className="text-xl font-bold">
                    {jwo.qtyBillable != null ? `${jwo.qtyBillable.toFixed(2)} ${unitShort(jwo.uom)}` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Qty Received</Label>
                  <p className="text-xl font-bold">
                    {jwo.qtyReceivedMeters ? `${jwo.qtyReceivedMeters.toFixed(2)} ${unitShort(jwo.uom)}` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Abnormal Loss</Label>
                  <p className={`text-xl font-bold ${hasAbnormalLoss ? 'text-red-500' : ''}`}>
                    {jwo.qtyAbnormalLoss ? `${jwo.qtyAbnormalLoss.toFixed(2)} ${unitShort(jwo.uom)}` : '-'}
                  </p>
                </div>
              </div>

              {jwo.jwoStatus === 'PARTIALLY_RECEIVED' && jwo.qtyBillable != null && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Received so far{' '}
                  <span className="font-medium text-foreground">
                    {(jwo.qtyReceivedMeters ?? 0).toFixed(2)} {unitShort(jwo.uom)}
                  </span>{' '}
                  of {jwo.qtyBillable.toFixed(2)} expected —{' '}
                  {qtyRemaining(jwo.qtyBillable, jwo.qtyReceivedMeters ?? 0).toFixed(2)} {unitShort(jwo.uom)} still to
                  come. Tick "This is the final delivery" on the last receipt, or use Close short if nothing more is
                  coming.
                </p>
              )}

              {/* Recorded at receipt and stored on the job — shown here rather than only on the receipt. */}
              {(jwo.thanCount != null || jwo.qualityGrade || jwo.defectMeters != null) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <Label className="text-muted-foreground">Than Count</Label>
                    <p className="font-medium">{jwo.thanCount ?? '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fold Length</Label>
                    <p className="font-medium">{jwo.foldLengthCm != null ? `${jwo.foldLengthCm} cm` : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Quality Grade</Label>
                    <p className="font-medium">{jwo.qualityGrade ?? '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Defect Metres</Label>
                    <p className="font-medium">{jwo.defectMeters != null ? jwo.defectMeters.toFixed(2) : '-'}</p>
                  </div>
                </div>
              )}

              {/* Widths (industry model 2026-08-18): greige loom width in; the processor is asked
                  for a FINISHED (stenter) width = cutable + selvedge deduction; received is measured.
                  received < asked ⟺ the cutable target is missed.
                  A lace job has none of this: the width lives on the lace master and dyeing does
                  not change it, so four empty width boxes would only invite someone to fill them. */}
              {!issuesLace && <Separator className="my-4" />}
              <div className={`grid grid-cols-2 md:grid-cols-4 gap-4${issuesLace ? ' hidden' : ''}`}>
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
                  <p className="font-medium">{jwo.sentDate ? formatDate(new Date(jwo.sentDate)) : '-'}</p>
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
                    {jwo.expectedReturnDate ? formatDate(new Date(jwo.expectedReturnDate)) : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Received Date</Label>
                  <p className="font-medium">{jwo.receivedDate ? formatDate(new Date(jwo.receivedDate)) : '-'}</p>
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
                    {jwo.qtyNormalLoss ? `${jwo.qtyNormalLoss.toFixed(2)} ${unitShort(jwo.uom)}` : '-'}
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
                          {comp.qtySent.toFixed(2)} {unitShort(comp.unit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {comp.qtyReceived ? `${comp.qtyReceived.toFixed(2)} ${unitShort(comp.unit)}` : '-'}
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
                          {c.outward.toFixed(2)} {unitShort(c.unit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.inward.toFixed(2)} {unitShort(c.unit)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {c.balanceWithVendor.toFixed(2)} {unitShort(c.unit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.qtyAbnormalLoss != null && c.qtyAbnormalLoss > 0 ? (
                            <span className="text-red-600 font-medium">
                              {c.qtyAbnormalLoss.toFixed(2)} {unitShort(c.unit)}
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

              {currentStatus === 'APPROVED' && (
                <Button className="w-full" onClick={() => setIssueDialogOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Issue to Processor
                </Button>
              )}

              {['ISSUED', 'IN_TRANSIT', 'AT_PROCESSOR', 'PARTIALLY_RECEIVED'].includes(currentStatus) &&
                !jwo.receivedDate &&
                // Metre goods come back through ONE action that books the stock lot; Receive
                // Material books no stock, so it stays for piece work only.
                (jwo.uom === 'MTR' ? (
                  <Button className="w-full" onClick={() => setReceiveFromProcessorOpen(true)}>
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Receive from processor
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => setReceiveDialogOpen(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Receive Material
                  </Button>
                ))}

              {/* The mirror of the unintended-tick mistake: a part is in, the box was left unticked, and
                  nothing more is coming. Closes on what was received, behind the same confirmation. */}
              {currentStatus === 'PARTIALLY_RECEIVED' && !jwo.receivedDate && jwo.uom === 'MTR' && (
                <Button className="w-full" variant="secondary" onClick={() => setCloseShortOpen(true)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Close short — nothing more is coming
                </Button>
              )}

              {/* The third ending: it came back exactly as it went out. Only while nothing has been
                  received — once a delivery is in, Close short is the right action, and this path
                  would zero that receipt. */}
              {['ISSUED', 'IN_TRANSIT', 'AT_PROCESSOR'].includes(currentStatus) &&
                !jwo.receivedDate &&
                isQtyZero(receivedSoFar) && (
                  <Button className="w-full" variant="outline" onClick={() => setReturnUnprocessedOpen(true)}>
                    <Undo2 className="mr-2 h-4 w-4" />
                    Returned unprocessed
                  </Button>
                )}

              {/* A job issued by quantity left its thans unnamed — name them now so the godown list is right */}
              {thanRecordPending.length > 0 && (
                <div className="space-y-1">
                  <Button className="w-full" variant="outline" onClick={openRecordThans}>
                    <ListChecks className="mr-2 h-4 w-4" />
                    Record thans sent
                  </Button>
                  {thanRecordPending.map((lot) => (
                    <p key={lot.greigeStockLotId} className="text-xs text-muted-foreground">
                      {thanRecordPending.length > 1 && lot.greigeCode ? `${lot.greigeCode}: ` : ''}
                      {formatQuantity(lot.recordedActual, jwo.uom)} of {formatQuantity(lot.takenActual, jwo.uom)}{' '}
                      recorded by than
                    </p>
                  ))}
                </div>
              )}

              {jwo.jwoStatus !== 'CLOSED' &&
                ['RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED'].includes(jwo.jwoStatus) && (
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

              {/* The inward challan is raised by the receive action; it was stored but never printable here. */}
              {jwo.inwardChallanId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openPDF(`/documents/challans/${jwo.inwardChallanId}/pdf`)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Print Inward Challan
                </Button>
              )}

              {(() => {
                // A job may come back in parts — one receipt each. Older payloads carry only the
                // latest receipt on `grn`, so that stays as the fallback.
                const receipts = jwo.receivingGRNs?.length
                  ? jwo.receivingGRNs
                  : jwo.grn
                    ? [
                        {
                          id: jwo.grn.id,
                          grnNumber: jwo.grn.grnNumber,
                          receivingDate: jwo.receivedDate ?? '',
                          items: [],
                        },
                      ]
                    : [];
                if (receipts.length === 0) return null;
                return (
                  <div className="space-y-1 pt-1">
                    <Label className="text-muted-foreground">
                      {receipts.length > 1 ? `Return receipts (${receipts.length})` : 'Return receipt'}
                    </Label>
                    {receipts.map((r) => {
                      const qty = r.items?.[0]?.acceptedQuantity;
                      return (
                        <Button
                          key={r.id}
                          variant="outline"
                          className="w-full justify-between"
                          onClick={() => navigate(`/procurement/grn/${r.id}`)}
                        >
                          <span className="flex items-center">
                            <PackageCheck className="mr-2 h-4 w-4" />
                            {r.grnNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {qty != null ? `${Number(qty).toFixed(2)} ${unitShort(jwo.uom)}` : ''}
                            {r.receivingDate ? ` · ${formatDate(new Date(r.receivingDate))}` : ''}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                );
              })()}
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
                  {jwo.statutoryDueDate ? formatDate(new Date(jwo.statutoryDueDate)) : '-'}
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

      {/* Receive from processor — metre jobs: one action, stock booked */}
      <ReceiveFromProcessorDialog
        open={receiveFromProcessorOpen}
        onOpenChange={setReceiveFromProcessorOpen}
        jobWorkOrderId={jwo.id}
      />

      {/* Returned unprocessed — it came back exactly as it went out */}
      <ReturnFromProcessorDialog
        open={returnUnprocessedOpen}
        onOpenChange={setReturnUnprocessedOpen}
        jobWorkOrderId={jwo.id}
        jobWorkNumber={jwo.jobWorkNumber}
        processorName={jwo.processor?.name ?? 'The processor'}
        qtySent={Number(jwo.qtySentMeters ?? 0)}
        uom={jwo.uom}
        // Took its cloth where it lay at the processor (no outward challan): the user names the store it came into
        drewWhereItLay={!jwo.outwardChallanId && !!jwo.sentDate}
      />

      {/* Receive Dialog — piece work only */}
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
                {jwo.qtySentMeters.toFixed(2)} {unitShort(jwo.uom)}
              </p>
            </div>
            <div>
              <Label htmlFor="qtyReceived">Quantity Received ({unitShort(jwo.uom)})</Label>
              <Input
                id="qtyReceived"
                type="number"
                step="any"
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
              Consumes {issueRequiredQty.toFixed(2)} {issueUom} — from one lot or several —{' '}
              {issueNothingTravels
                ? `takes it at ${issueProcessorName} under the challan already covering it (nothing is dispatched)`
                : 'creates the outward challan'}
              , and locks the Section 143 due date.
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
                  This order issues from its selected fabric lot ({jwo.qtySentMeters.toFixed(2)} {unitShort(jwo.uom)}{' '}
                  will be consumed{jwo.processType === 'EMBROIDERY' ? ' for embroidery' : ''}).
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
                  <AlertTitle>No {issuesLace ? 'greige lace' : 'greige'} available to issue</AlertTitle>
                  <AlertDescription>
                    {issuePreview?.expectedGreige
                      ? `No available ${issuesLace ? 'greige lace' : 'greige'} lots for ${issuePreview.expectedGreige.greigeCode} — ${issuePreview.expectedGreige.greigeName}. `
                      : `No available ${issuesLace ? 'greige lace' : 'greige'} lots for this order. `}
                    {issuesLace
                      ? 'Receive the greige lace purchase into stock first.'
                      : `Receive the greige purchase order into stock first. Lots at another processor cannot go on a job for ${issueProcessorName}.`}
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <div className="space-y-4">
                {issuePreview && !issuePreview.greigeAnchored && !issuesLace && (
                  <Alert>
                    <AlertDescription>
                      This order has no requirement chain naming its cloth, so any greige may be issued — but every row
                      must be the SAME greige, because one job work order sends one cloth.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Where the offered lots are: one badge per place (the server placed every lot) */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {issueLotGroups.map((group) => {
                    const total = group.lots.reduce((sum, lot) => sum + lot.quantityAvailable, 0);
                    return (
                      <div key={group.key} className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {group.key === 'held'
                            ? `Already at ${issueProcessorName}:`
                            : group.key === 'unit'
                              ? `In ${issueProcessorName}'s unit (not yet booked there):`
                              : `${group.label}:`}
                        </span>
                        <Badge variant={group.key === 'held' ? 'default' : 'outline'}>
                          {formatQuantity(total, issueUom)} ({group.lots.length}{' '}
                          {group.lots.length === 1 ? 'lot' : 'lots'})
                        </Badge>
                        {group.key === 'held' && <span className="text-xs text-green-600">(no dispatch needed)</span>}
                      </div>
                    );
                  })}
                </div>
                {issueElsewhere.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Elsewhere:{' '}
                    {issueElsewhere.map(([holder, qty], i) => (
                      <span key={holder}>
                        {i > 0 ? ', ' : ''}
                        {formatQuantity(qty, issueUom)} at {holder}{' '}
                        <button type="button" className="text-info hover:underline" onClick={() => setMoveFrom(holder)}>
                          Move here
                        </button>
                      </span>
                    ))}{' '}
                    — cloth at another processor goes on this job only after it is moved here, with a challan.
                  </p>
                )}
                {moveFrom && (
                  <MoveHeldStockDialog
                    open={!!moveFrom}
                    onOpenChange={(open) => !open && setMoveFrom(null)}
                    lots={issueElsewhereLots[moveFrom] ?? []}
                    fromName={moveFrom}
                    toProcessorId={jwo.processorId}
                    toName={issueProcessorName}
                    onMoved={() => void refetchIssuePreview()}
                  />
                )}

                <GreigeLotRows
                  rows={issueRows}
                  onRowsChange={setIssueRows}
                  lots={issueAvailableLots}
                  requiredQty={issueRequiredQty}
                  uom={issueUom}
                  evaluation={issueEval}
                  required={issuesGreige || issuesLace}
                  allowNoLot={issueAllowsNoLot}
                  disabled={issueMutation.isPending}
                  // Greige leaves the godown by the than: guide the operator to name them
                  enableDetailSelection={issuesGreige && !issuesLace && !issuesFromFabricRoll}
                  processorName={issueProcessorName}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="issue-sent-date">Sent date</Label>
                <Input
                  id="issue-sent-date"
                  type="date"
                  value={issueSentDate}
                  max={issueToday}
                  min={earliestSentDate(issueChosenLots)}
                  onChange={(e) => setIssueSentDate(e.target.value)}
                  disabled={issueMutation.isPending}
                />
                {issueNothingTravels && !issueDateCheck.error && (
                  <p className="text-xs text-muted-foreground">
                    The day the job takes the cloth at {issueProcessorName}.
                  </p>
                )}
                {issueDateCheck.error && <p className="text-xs text-red-600">{issueDateCheck.error}</p>}
                {issueDateCheck.warning && <p className="text-xs text-amber-700">{issueDateCheck.warning}</p>}
              </div>
              {!issueNothingTravels && (
                <div className="space-y-1.5">
                  <Label>Vehicle Number</Label>
                  <Input value={issueVehicle} onChange={(e) => setIssueVehicle(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={
                issueMutation.isPending || issueBlockers.length > 0 || !issueSelectionValid || !!issueDateCheck.error
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {issueMutation.isPending
                ? 'Issuing...'
                : issueNothingTravels
                  ? `Allocate at ${issueProcessorName}`
                  : 'Issue & Create Challan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record thans sent — the thans that left on a job issued by quantity */}
      <Dialog open={recordThansOpen} onOpenChange={setRecordThansOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record thans sent</DialogTitle>
            <DialogDescription>
              {jwo.jobWorkNumber} went out by quantity. Tick the thans that were on the vehicle — this only updates the
              godown's than list; the lot's stock already moved when the job was issued.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {thanRecordPending.length > 1 && (
              <div className="space-y-1.5">
                <Label>Lot</Label>
                <Select
                  value={recordLotId}
                  onValueChange={(v) => {
                    setRecordLotId(v);
                    setRecordPicks([]);
                    clearRecordGroup();
                  }}
                  disabled={recordThansMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {thanRecordPending.map((lot) => (
                      <SelectItem key={lot.greigeStockLotId} value={lot.greigeStockLotId}>
                        {lot.greigeCode ?? 'Lot'} — {formatQuantity(lot.recordedActual, jwo.uom)} of{' '}
                        {formatQuantity(lot.takenActual, jwo.uom)} recorded
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recordLot && (
              <p className="text-sm">
                {recordLot.greigeCode ?? 'This lot'}: the job took {formatQuantity(recordLot.takenActual, jwo.uom)};{' '}
                {formatQuantity(recordLot.recordedActual, jwo.uom)} already recorded by than.
              </p>
            )}

            {recordSiblings.length > 0 && recordLotThans && (
              <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p>
                  {recordSiblings.map((sib) => sib.jobWorkNumber).join(', ')} also went to this processor the same day
                  from this lot, with thans still to record. Fit them together so whole bales are used across all the
                  jobs:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={fitRecordGroup}
                    disabled={recordThansMutation.isPending || isQtyZero(recordTarget)}
                  >
                    <Boxes className="mr-1 h-3.5 w-3.5" />
                    Best fit for all {recordSiblings.length + 1} jobs
                  </Button>
                  {groupJobs.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={clearRecordGroup}
                      disabled={recordThansMutation.isPending}
                    >
                      Record this job only
                    </Button>
                  )}
                </div>
                {recordGroupNote && <p className="text-xs">{recordGroupNote}</p>}
                {groupJobs.map((sib) => {
                  const picks = recordGroupPicks[sib.jwoId] ?? [];
                  return (
                    <p key={sib.jwoId} className="text-xs">
                      {sib.jobWorkNumber}: {picks.length} thans ·{' '}
                      {formatQuantity(foldActual(totalDetailMeters(picks), recordLotThans.foldLengthCm), jwo.uom)}{' '}
                      actual of {formatQuantity(sib.target, jwo.uom)} — recorded together with this job
                    </p>
                  );
                })}
              </div>
            )}

            {recordLotThansLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : recordPickerThans ? (
              <div className="rounded-md border bg-muted/30 p-3">
                {groupJobs.length > 0 && <p className="mb-2 text-xs font-medium">{jwo.jobWorkNumber} (this job)</p>}
                <ThanPicker
                  lotThans={recordPickerThans}
                  selected={recordPicks}
                  onChange={setRecordPicks}
                  targetActual={recordTarget}
                  uom={jwo.uom}
                  disabled={recordThansMutation.isPending}
                  snapToLot={false}
                />
              </div>
            ) : null}

            {recordOverTaken && recordLot && (
              <p className="text-xs text-red-600">
                These thans come to more than the job took from this lot ({formatQuantity(recordAfterActual, jwo.uom)}{' '}
                against {formatQuantity(recordLot.takenActual, jwo.uom)} actual) — untick some or send a part of the
                last than.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordThansOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recordThansMutation.mutate()}
              disabled={
                recordThansMutation.isPending ||
                !recordLot ||
                picksPayload(recordPicks).length === 0 ||
                recordPickErrors ||
                recordOverTaken
              }
            >
              <ListChecks className="mr-2 h-4 w-4" />
              {recordThansMutation.isPending
                ? 'Recording…'
                : groupJobs.length > 0
                  ? `Record thans for ${groupJobs.length + 1} jobs`
                  : 'Record thans sent'}
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
              {jwo.jobWorkNumber} will be withdrawn. Requirements this order covered return to open so you can adjust
              the quantity and generate again.{' '}
              {jwo.sentDate
                ? 'You will then decide what to do with the material at the processor.'
                : 'The record is kept with an audit trail.'}
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

      {/* Two-step cancel: inventory disposition dialog */}
      <Dialog open={dispositionDialogOpen} onOpenChange={setDispositionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What should happen to the material?</DialogTitle>
            <DialogDescription>
              {jwo.qtySentMeters} meters of greige is at {jwo.processor?.name ?? 'the processor'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {(
              [
                {
                  value: 'RETURNED_TO_STOCK',
                  label: 'Return to warehouse stock',
                  desc: 'Credit back to greige inventory',
                },
                { value: 'AT_PROCESSOR', label: 'Leave at processor', desc: 'Keep for future jobs at this processor' },
                {
                  value: 'TRANSFERRED',
                  label: 'Transfer to another JWO',
                  desc: 'Move to a different job (coming soon)',
                },
                {
                  value: 'RETURNED_TO_SUPPLIER',
                  label: 'Return to supplier',
                  desc: 'Send back to the greige supplier',
                },
                { value: 'WRITTEN_OFF', label: 'Write off', desc: 'Mark as lost or damaged' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  selectedDisposition === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                } ${opt.value === 'TRANSFERRED' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="disposition"
                  value={opt.value}
                  checked={selectedDisposition === opt.value}
                  onChange={() => opt.value !== 'TRANSFERRED' && setSelectedDisposition(opt.value)}
                  disabled={opt.value === 'TRANSFERRED'}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-sm text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
            <div className="pt-2">
              <Label htmlFor="disposition-notes">Notes (optional)</Label>
              <Input
                id="disposition-notes"
                value={dispositionNotes}
                onChange={(e) => setDispositionNotes(e.target.value)}
                placeholder="Any additional details..."
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispositionDialogOpen(false)}>
              Decide later
            </Button>
            <Button onClick={() => dispositionMutation.mutate()} disabled={dispositionMutation.isPending}>
              {dispositionMutation.isPending ? 'Processing…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close … short? — nothing more is coming after a part. Figures come from the server's preview. */}
      <ConfirmDialog
        open={closeShortOpen}
        onOpenChange={setCloseShortOpen}
        title={`Close ${jwo.jobWorkNumber} short?`}
        description={(() => {
          const processor = jwo.processor?.name ?? 'the processor';
          const uom = jwo.uom;
          if (!closeShortPreview) {
            return `Nothing more will be received on this job. It closes on the ${receivedSoFar.toFixed(2)} ${uom} already received.`;
          }
          const p = closeShortPreview;
          if (!p.isOverTolerance) {
            return (
              `Nothing more will be received on this job. The total stays at ${receivedSoFar.toFixed(2)} ${uom} of the ` +
              `${p.qtyExpected.toFixed(2)} ${uom} expected back from ${processor} — within the ${p.tolerancePercent}% ` +
              `allowance. The job closes on that total.`
            );
          }
          return (
            `Nothing more will be received on this job. The total stays at ${receivedSoFar.toFixed(2)} ${uom} of the ` +
            `${p.qtyExpected.toFixed(2)} ${uom} expected back from ${processor} — ${p.shortfall.toFixed(2)} ${uom} short, ` +
            `${p.qtyAbnormalLoss.toFixed(2)} ${uom} beyond the ${p.tolerancePercent}% allowance. The job closes on that ` +
            `total, the shortfall becomes a loss against ${processor}` +
            (p.debitNoteAmount != null
              ? `, and a debit note of about ₹${p.debitNoteAmount.toFixed(2)} is due against them.`
              : '.') +
            ` If more is still on its way, keep the job open and receive it as a part instead.`
          );
        })()}
        confirmText="Yes — nothing more is coming, close it short"
        cancelText="Keep it open"
        variant="destructive"
        isLoading={closeShortMutation.isPending}
        onConfirm={() => closeShortMutation.mutate()}
      />

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
