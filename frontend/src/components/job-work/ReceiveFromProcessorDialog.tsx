// Receive from processor — the one action that records a job-work return and books it into stock.
import { unitShort } from '@/lib/units';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, PackageCheck } from 'lucide-react';
import { invalidateControlCenter } from '@/lib/control-center-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { lineName } from '@/lib/jwo-lines';
import ReceiptDetailRows, {
  sumDetailRows,
  type ReceiptDetailRow,
  type ReceiptEntryMode,
} from '@/components/job-work/ReceiptDetailRows';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { warehouseService } from '@/services/warehouse.service';
import type { WarehouseType } from '@/types/inventory.types';
import { handleApiError, handleApiSuccess, isOutcomeUnknown } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import { toDateInputValue } from '@/lib/date';
import { foldActual } from '@/lib/fold-length';
import { FoldActualField } from '@/components/FoldActualField';
import { generateId } from '@/lib/utils';
import { useDefaultSettings } from '@/hooks/useDefaultSettings';

interface ReceiveFromProcessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The job whose material came back. The dialog loads the job itself, so any list can open it. */
  jobWorkOrderId: string | null;
  onSuccess?: () => void;
}

// A return is booked into a place that holds stock — never a processor's virtual location or
// "in transit". The default must not come from the greige lot either: greige is often delivered
// straight to the dyer, so the lot's warehouse IS the processor's (owner, 2026-09-19).
const NOT_A_STORE: WarehouseType[] = ['JOB_WORK', 'TRANSIT'];

const fmt = (n: number | null | undefined) => (n == null ? '-' : Number(n).toFixed(2));

/**
 * The figures a short close is confirmed on. From the server's preview (asked for the cumulative
 * quantity) or, when the server refused an unconfirmed short close, from that refusal's details —
 * the dialog never works these out itself.
 */
interface ShortCloseFigures {
  qtyThisReceipt: number;
  cumulative: number;
  expected: number;
  shortfall: number;
  beyondAllowance: number;
  tolerancePercent: number;
  debitNoteAmount: number | null;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
};

export default function ReceiveFromProcessorDialog({
  open,
  onOpenChange,
  jobWorkOrderId,
  onSuccess,
}: ReceiveFromProcessorDialogProps) {
  const queryClient = useQueryClient();
  const today = toDateInputValue(new Date());

  // Numbers are held as numbers and normalised at the input, never as raw strings: '' or NaN
  // reaching the payload is a known 400 class on this frontend.
  const [entryMode, setEntryMode] = useState<ReceiptEntryMode>('TOTAL_METERS');
  const [qtyMeters, setQtyMeters] = useState<number>(0);
  const [thanCount, setThanCount] = useState<number>(0);
  const [rows, setRows] = useState<ReceiptDetailRow[]>([]);
  const [foldLengthCm, setFoldLengthCm] = useState<number>(0);
  const [widthInches, setWidthInches] = useState<number>(0);
  // Selvedge in inches: the lot's cutable width = measured − this (lot-width.helper on the server)
  const { cutableWidthDeduction } = useDefaultSettings();
  const [challanRef, setChallanRef] = useState('');
  // The processor's bill for THIS delivery — or "Invoice not received yet" (2026-09-28)
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceToFollow, setInvoiceToFollow] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  // Delivered straight to another processor (Phase 4d): `warehouseId` is then that processor's unit
  const [toProcessor, setToProcessor] = useState(false);
  const [vehicle, setVehicle] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [qualityGrade, setQualityGrade] = useState<'' | 'A' | 'B' | 'Reject'>('');
  const [defectMeters, setDefectMeters] = useState<number>(0);
  // null = untouched: the "final delivery" box follows the quantity (ticked once the expected total
  // is reached); a click pins it either way until the dialog is next opened.
  const [finalOverride, setFinalOverride] = useState<boolean | null>(null);
  // "Close … short?" — open when a final receipt would leave the total short beyond the tolerance.
  // `serverShort` carries the figures when it was the SERVER that refused (a fast click before the
  // preview ran, or a stale tab that posted no isFinal); otherwise the preview's figures are used.
  const [shortCloseOpen, setShortCloseOpen] = useState(false);
  const [serverShort, setServerShort] = useState<ShortCloseFigures | null>(null);
  // The job line (colour / order) this delivery is. A job that brings back several fabrics is received one
  // colour at a time; '' = not chosen yet (picked for you when only one line is still open).
  const [lineId, setLineId] = useState('');

  const { data: jwo } = useQuery({
    queryKey: ['job-work-order', jobWorkOrderId],
    queryFn: () => jobWorkOrderService.getById(jobWorkOrderId!),
    enabled: open && !!jobWorkOrderId,
  });

  // Physical stores only — used for the one-store default; the picker filters the same way.
  const { data: stores } = useQuery({
    queryKey: ['warehouses', 'physical'],
    queryFn: async () =>
      (await warehouseService.getAll({ isActive: true })).filter((w) => !NOT_A_STORE.includes(w.warehouseType)),
    enabled: open,
  });

  // One delivery, one receipt (2026-09-25: a stalled server answered the first press "Response timeout"
  // while still saving, the user pressed again, and six receipts were filed for one delivery).
  //   submissionKey — minted per opening and sent with every submit of it; the server answers a
  //     repeat of the same key with the receipt it already filed instead of filing another.
  //   inFlight — a synchronous guard: isPending only lands on the next render, so two presses in the
  //     same frame both got through.
  const submissionKey = useRef('');
  const inFlight = useRef(false);
  // "Receive, then another colour" survives the short-close question: the answer sends what was pressed
  const nextAfterConfirm = useRef(false);

  // Reset on the open edge. (The previous handler reset inside Radix's onOpenChange(true), which never
  // fires here — the parent controls `open` — so a second opening showed the last receipt's figures.)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      submissionKey.current = generateId();
      inFlight.current = false;
      setEntryMode('TOTAL_METERS');
      setQtyMeters(0);
      setThanCount(0);
      setRows([]);
      setFoldLengthCm(0);
      setWidthInches(0);
      setChallanRef('');
      setInvoiceNumber('');
      setInvoiceDate('');
      setInvoiceToFollow(false);
      setWarehouseId('');
      setToProcessor(false);
      setVehicle('');
      setReceivedDate(today);
      setQualityGrade('');
      setDefectMeters(0);
      setFinalOverride(null);
      setShortCloseOpen(false);
      setServerShort(null);
      setLineId('');
    }
    wasOpen.current = open;
  }, [open, today]);

  // Exactly one physical store → pre-select it; never overwrite a choice.
  useEffect(() => {
    if (open && !toProcessor && !warehouseId && stores?.length === 1) setWarehouseId(stores[0].id);
  }, [open, toProcessor, warehouseId, stores]);

  // The job's lines — one per fabric it brings back. Exactly one still open → it is this delivery.
  const lines = jwo?.lines ?? [];
  const severalLines = lines.length > 1;
  const openLines = lines.filter((l) => !l.closedAt);
  const line = lines.find((l) => l.id === lineId) ?? (openLines.length === 1 ? openLines[0] : null);
  // Another colour is still to come after this one — the dialog can stay open for it
  const anotherColourAfter = severalLines && !!line && openLines.some((l) => l.id !== line.id);

  // The quantity the receipt will book.
  //   Counted: the metres typed, or the sum of the than/bale rows (the server derives the than count
  //   from them) — the processor's own count.
  //   Actual: counted × L/100 when a fold length under 100 cm is given — what goes to stock, and what
  //   the split, the cap and the "final" tick below all run on.
  const rowsValid = rows.length > 0 && rows.every((r) => r.meters > 0);
  const countedQty = entryMode === 'TOTAL_METERS' ? qtyMeters : rowsValid ? sumDetailRows(rows) : 0;
  const effectiveQty = foldActual(countedQty, foldLengthCm);

  // Parts: what earlier deliveries already booked. The cap and the "final" tick work on the CUMULATIVE
  // figure of the LINE (its own fabric — on a one-line job, the job's); the loss split on the JOB's total —
  // a short first delivery is not a loss until the last one is in.
  const jobReceivedSoFar = Number(jwo?.qtyReceivedMeters ?? 0);
  const receivedSoFar = line ? Number(line.receivedQty ?? 0) : jobReceivedSoFar;
  const expected =
    line?.qtyExpected != null ? Number(line.qtyExpected) : severalLines ? null : (jwo?.qtyBillable ?? null);
  const sentForExpected = line ? Number(line.qtySent) : jwo?.qtySentMeters;
  const shrinkageForExpected = line ? line.expectedShrinkage : jwo?.expectedShrinkage;
  const cumulativeQty = receivedSoFar + effectiveQty;

  // Warn on a short return BEFORE commit. Debounced; the figures come from the server's own loss
  // split so the dialog and the booked numbers cannot disagree. Asked for the job's cumulative total,
  // with the line for its over-receipt ceiling.
  const [previewQty, setPreviewQty] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPreviewQty(effectiveQty), 300);
    return () => clearTimeout(t);
  }, [effectiveQty]);

  const { data: preview } = useQuery({
    queryKey: ['jwo-receive-preview', jobWorkOrderId, line?.id ?? null, jobReceivedSoFar, previewQty],
    queryFn: () => jobWorkOrderService.getReceivePreview(jobWorkOrderId!, jobReceivedSoFar + previewQty, line?.id),
    enabled: open && !!jobWorkOrderId && previewQty > 0 && (!severalLines || !!line),
  });

  // "This is the final delivery": pre-ticked once the line's total reaches its expected quantity less the
  // processor's tolerance (the server's own figure: job → process type → 0), editable either way.
  const tolerancePercent = preview?.tolerancePercent ?? jwo?.tolerancePercent ?? 0;
  const autoFinal = expected != null && expected > 0 ? cumulativeQty >= expected * (1 - tolerancePercent / 100) : true;
  const isFinal = finalOverride ?? autoFinal;
  // A final delivery closes its line; the job closes with its last open line, and only then is the loss
  // judged — on the whole job (closing an earlier colour short is noted, not a short close of the job).
  const closesJob = isFinal && (!line || openLines.every((l) => l.id === line.id));
  const jobShort = closesJob && !!preview?.isOverTolerance;
  const lineShortBy =
    isFinal && !closesJob && expected != null && cumulativeQty < expected * (1 - tolerancePercent / 100)
      ? expected - cumulativeQty
      : null;
  const thisLineName = line && severalLines ? lineName(line) : null;

  const receiveMutation = useMutation({
    // `next`: "Receive, then another colour" — the dialog stays open for the next colour of this delivery
    mutationFn: ({ shortCloseConfirmed }: { shortCloseConfirmed: boolean; next: boolean }) =>
      jobWorkOrderService.receiveToStock({
        jobWorkOrderId: jobWorkOrderId!,
        ...(line ? { lineId: line.id } : {}),
        entryMode,
        ...(entryMode === 'TOTAL_METERS'
          ? {
              qtyReceivedMeters: qtyMeters > 0 ? qtyMeters : undefined,
              // The than count is a count of pieces, recorded as given.
              thanCount: thanCount > 0 ? thanCount : undefined,
            }
          : {
              // The lot keeps these pieces (rolls are rolls), with the processor's tags when typed
              details: rows.map((r, i) => ({
                detailType: entryMode === 'ROLL_WISE' ? ('ROLL' as const) : ('THAN' as const),
                baleNumber: entryMode === 'BALE_WISE' ? r.baleNumber : null,
                sequenceNo: i + 1,
                meters: r.meters,
                baleNo: entryMode === 'BALE_WISE' ? r.baleNo?.trim() || null : null,
                thanNo: r.thanNo?.trim() || null,
              })),
            }),
        foldLengthCm: foldLengthCm > 0 ? foldLengthCm : undefined,
        receivedWidthInches: widthInches > 0 ? widthInches : undefined,
        receivedChallan: challanRef.trim() || undefined,
        ...(invoiceToFollow
          ? { invoiceToFollow: true }
          : { invoiceNumber: invoiceNumber.trim() || undefined, invoiceDate: invoiceDate || undefined }),
        receivedDate,
        warehouseId,
        ...(toProcessor ? { deliveredToProcessor: true, vehicleNumber: vehicle.trim() || undefined } : {}),
        isFinal,
        // Only ever true after the user has answered "Close … short?" — never sent by default.
        shortCloseConfirmed: shortCloseConfirmed || undefined,
        processingQC:
          qualityGrade || defectMeters > 0
            ? { qualityGrade: qualityGrade || undefined, defectMeters: defectMeters > 0 ? defectMeters : undefined }
            : undefined,
        submissionKey: submissionKey.current || undefined,
      }),
    onSettled: () => {
      inFlight.current = false;
    },
    onSuccess: (result, { next }) => {
      const abnormal = Number(result.lossSplit?.qtyAbnormalLoss ?? 0);
      if (thisLineName && !result.replayed) {
        // One colour of a job that brings back several
        handleApiSuccess(
          `${thisLineName} received into stock`,
          `Receipt ${result.data.grnNumber} filed on ${jwo?.jobWorkNumber ?? 'the job'}. ` +
            (closesJob
              ? abnormal > 0
                ? `That was the last colour: the job is complete — ${abnormal.toFixed(2)} m abnormal loss, a debit note against the processor is needed before it can close.`
                : 'That was the last colour: the job is complete.'
              : isFinal
                ? `${thisLineName} is complete; the job stays open for its other colours.`
                : `More of ${thisLineName} is still to come.`)
        );
      } else if (result.replayed) {
        handleApiSuccess(
          `${jwo?.jobWorkNumber ?? 'Job'} was already received`,
          `Receipt ${result.data.grnNumber} was filed by the earlier press — no second receipt was made.`
        );
      } else if (result.onwardChallan) {
        handleApiSuccess(
          `${jwo?.jobWorkNumber ?? 'Job'} received — now held at ${result.onwardChallan.toName}`,
          `Receipt ${result.data.grnNumber} filed, and challan ${result.onwardChallan.challanNumber} from ` +
            `${jwo?.processor?.name ?? 'the processor'} to ${result.onwardChallan.toName}.` +
            (abnormal > 0
              ? ` ${abnormal.toFixed(2)} m abnormal loss — a debit note is needed before the job can close.`
              : '')
        );
      } else if (abnormal > 0) {
        handleApiSuccess(
          `${jwo?.jobWorkNumber ?? 'Job'} received into stock`,
          `${abnormal.toFixed(2)} m abnormal loss — a debit note against the processor is needed before the job can close.`
        );
      } else if (!isFinal) {
        handleApiSuccess(
          `${jwo?.jobWorkNumber ?? 'Job'} — part received into stock`,
          `Receipt ${result.data.grnNumber} filed. The job stays open for the next delivery.`
        );
      } else {
        handleApiSuccess(
          `${jwo?.jobWorkNumber ?? 'Job'} received into stock`,
          `Receipt ${result.data.grnNumber} filed.`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['job-work-order', jobWorkOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['process-pos'] });
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      // Receiving closes the outward challan and puts fabric in stock, so both halves of the
      // Control Center change: the vendor/challan alerts and any material-shortage blocker.
      invalidateControlCenter(queryClient);
      if (next && !result.replayed) {
        // The next colour of the same delivery: keep the challan, date, store, invoice and vehicle; clear what
        // belongs to the colour just received, and take a fresh key — this is a new receipt, never a retry.
        submissionKey.current = generateId();
        setLineId('');
        setEntryMode('TOTAL_METERS');
        setQtyMeters(0);
        setThanCount(0);
        setRows([]);
        setFoldLengthCm(0);
        setWidthInches(0);
        setQualityGrade('');
        setDefectMeters(0);
        setFinalOverride(null);
        setServerShort(null);
        onSuccess?.();
        return;
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      // The server is the authority on a short close. When it refused an unconfirmed one (a fast click
      // before the preview ran, or a stale tab), ask the same question here instead of toasting.
      const data = (err as { response?: { data?: { details?: Partial<ShortCloseFigures> & { reason?: string } } } })
        ?.response?.data;
      const d = data?.details;
      if (d?.reason === 'SHORT_CLOSE_UNCONFIRMED') {
        setServerShort({
          qtyThisReceipt: Number(d.qtyThisReceipt ?? 0),
          cumulative: Number(d.cumulative ?? 0),
          expected: Number(d.expected ?? 0),
          shortfall: Number(d.shortfall ?? 0),
          beyondAllowance: Number(d.beyondAllowance ?? 0),
          tolerancePercent: Number(d.tolerancePercent ?? 0),
          debitNoteAmount: d.debitNoteAmount == null ? null : Number(d.debitNoteAmount),
        });
        setShortCloseOpen(true);
        return;
      }
      // Timed out / no answer / 502-504: the server may still be saving — never call that a failure.
      // Saying "failed" is what made the user press again on 2026-09-25. Pressing again IS safe now:
      // this opening's submissionKey makes the server answer with the receipt it already filed. Refresh
      // the job so a receipt that did land shows up under "Received so far" and in Return receipts.
      if (isOutcomeUnknown(err)) {
        notify.warning('The server is slow — this receipt may still be saving', {
          description:
            'Wait a moment and press Receive again. It is safe: if the first press went in, you will ' +
            'be shown that receipt — a second one is never filed.',
          duration: 15000,
        });
        queryClient.invalidateQueries({ queryKey: ['job-work-order', jobWorkOrderId] });
        queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
        return;
      }
      handleApiError(err, 'Could not receive from processor');
    },
  });

  if (!jobWorkOrderId) return null;

  const isLace = jwo?.fabricType === 'LACE';
  const uom = jwo?.uom ?? 'MTR';
  const processorName = jwo?.processor?.name ?? 'the processor';
  // A return cannot be dated before the greige went out — the server refuses it too.
  const sentDay = jwo?.sentDate ? jwo.sentDate.slice(0, 10) : undefined;
  const dateBeforeSend = !!sentDay && !!receivedDate && receivedDate < sentDay;
  // The processor's invoice number and date — or the tick that it has not come yet
  const invoiceReady = invoiceToFollow || (!!invoiceNumber.trim() && !!invoiceDate);
  // A fabric lot's widths come from what was measured on arrival — never the asked width (server refuses too)
  const widthReady = isLace || widthInches > 0;
  const cutablePreview =
    widthInches > 0 && cutableWidthDeduction != null
      ? widthInches > cutableWidthDeduction
        ? Math.round((widthInches - cutableWidthDeduction) * 100) / 100
        : widthInches
      : null;
  const canSubmit =
    // A job that brings back several fabrics: which colour this is, and it must still be open
    (!severalLines || (!!line && !line.closedAt)) &&
    effectiveQty > 0 &&
    widthReady &&
    !!warehouseId &&
    !!receivedDate &&
    !dateBeforeSend &&
    invoiceReady &&
    !receiveMutation.isPending;

  // A final delivery that leaves the total short beyond the tolerance is a SHORT CLOSE: it is asked
  // about, in words, before anything is sent. The server refuses it anyway if the question was skipped.
  const shortClose: ShortCloseFigures | null =
    serverShort ??
    (preview && jobShort
      ? {
          qtyThisReceipt: effectiveQty,
          cumulative: jobReceivedSoFar + effectiveQty,
          expected: preview.qtyExpected,
          shortfall: preview.shortfall,
          beyondAllowance: preview.qtyAbnormalLoss,
          tolerancePercent: preview.tolerancePercent,
          debitNoteAmount: preview.debitNoteAmount,
        }
      : null);
  // Every send goes through here: a press while one is already on its way is dropped.
  const send = (shortCloseConfirmed: boolean, next = nextAfterConfirm.current) => {
    if (inFlight.current) return;
    inFlight.current = true;
    receiveMutation.mutate({ shortCloseConfirmed, next });
  };
  const handleSubmit = (next = false) => {
    if (inFlight.current) return;
    nextAfterConfirm.current = next;
    if (jobShort) {
      setServerShort(null);
      setShortCloseOpen(true);
      return;
    }
    send(false, next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-success" />
            Receive from {jwo?.processor?.name ?? 'processor'}
          </DialogTitle>
          <DialogDescription>
            {jwo?.jobWorkNumber ?? '…'} — one action: the receipt is filed and the stock lot, inward challan and loss
            split are booked together.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {severalLines && (
            // A job that brings back several fabrics is received one colour at a time: each is its own fabric
            // lot and is credited to its own order only.
            <div className="space-y-2">
              <Label>Which colour / order came back? *</Label>
              <RadioGroup
                value={line?.id ?? ''}
                onValueChange={(v) => {
                  setLineId(v);
                  setFinalOverride(null);
                  setServerShort(null);
                }}
                className="space-y-2"
              >
                {lines.map((l) => {
                  const closed = !!l.closedAt;
                  const orders = l.requirementLinks
                    .map((link) => link.materialRequirements.orders?.orderNumber)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <label
                      key={l.id}
                      htmlFor={`rfp-line-${l.id}`}
                      className={`flex items-start gap-3 rounded-md border p-2 text-sm ${
                        closed ? 'opacity-60' : 'cursor-pointer'
                      } ${l.id === lineId ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <RadioGroupItem value={l.id} id={`rfp-line-${l.id}`} disabled={closed} className="mt-0.5" />
                      <span className="flex-1">
                        <span className="font-medium">{lineName(l)}</span>
                        {orders && <span className="text-muted-foreground"> — {orders}</span>}
                        <span className="block text-xs text-muted-foreground">
                          {fmt(Number(l.receivedQty ?? 0))} of{' '}
                          {l.qtyExpected != null ? fmt(Number(l.qtyExpected)) : '-'} {uom} received
                          {closed ? (l.closedHow === 'SHORT' ? ' · closed short' : ' · complete') : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
              {!line && (
                <p className="text-xs text-amber-700">
                  Choose the colour this delivery is — each comes back as its own fabric and counts only for its own
                  order.
                </p>
              )}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isLace ? 'Expected dyed lace' : 'Expected back'}
                {thisLineName ? ` — ${thisLineName}` : ''}
              </span>
              <span className="font-medium">
                {expected != null ? `${fmt(expected)} ${uom}` : '-'}
                {sentForExpected != null && shrinkageForExpected != null && (!severalLines || !!line) && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    ({fmt(Number(sentForExpected))} sent − {Number(shrinkageForExpected)}% shrinkage)
                  </span>
                )}
              </span>
            </div>
            {receivedSoFar > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Received so far</span>
                <span className="font-medium">
                  {fmt(receivedSoFar)} {uom}
                  {expected != null && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      — {fmt(Math.max(expected - receivedSoFar, 0))} still to come
                    </span>
                  )}
                </span>
              </div>
            )}
            {preview && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {receivedSoFar > 0 ? 'Maximum you can still receive' : 'Maximum you can receive'}
                </span>
                <span className="font-medium">
                  {fmt(Math.max(preview.maxReceivable - receivedSoFar, 0))} {uom}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Entry mode</Label>
            <RadioGroup
              value={entryMode}
              onValueChange={(v) => {
                setEntryMode(v as ReceiptEntryMode);
                setRows([]);
              }}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="TOTAL_METERS" id="rfp-mode-total" />
                <Label htmlFor="rfp-mode-total" className="font-normal">
                  Total metres
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="THAN_WISE" id="rfp-mode-than" />
                <Label htmlFor="rfp-mode-than" className="font-normal">
                  Than-wise
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="BALE_WISE" id="rfp-mode-bale" />
                <Label htmlFor="rfp-mode-bale" className="font-normal">
                  Bale-wise
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ROLL_WISE" id="rfp-mode-roll" />
                <Label htmlFor="rfp-mode-roll" className="font-normal">
                  Roll-wise
                </Label>
              </div>
            </RadioGroup>
            {entryMode !== 'TOTAL_METERS' && (
              <p className="text-xs text-muted-foreground">
                The fabric lot keeps these {entryMode === 'ROLL_WISE' ? 'rolls' : 'thans'} — cutting picks them later.{' '}
                {entryMode === 'ROLL_WISE' ? 'Roll No.' : 'Than No.'}
                {entryMode === 'BALE_WISE' ? ' and Bale No. are' : ' is'} optional.
              </p>
            )}
          </div>

          {entryMode === 'TOTAL_METERS' ? (
            <div className="space-y-2">
              <Label htmlFor="rfp-qty">How much came back ({uom}) *</Label>
              <Input
                id="rfp-qty"
                type="number"
                min={0.01}
                step="any"
                value={qtyMeters > 0 ? qtyMeters : ''}
                onChange={(e) => setQtyMeters(parseFloat(e.target.value) || 0)}
                placeholder={expected != null ? `e.g. ${fmt(expected)}` : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Enter the metres the processor counted. With a fold length under 100 cm, stock takes the actual metres
                (counted × L/100).
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rfp-than" className="text-xs">
                    Than count
                  </Label>
                  <Input
                    id="rfp-than"
                    type="number"
                    min={1}
                    step={1}
                    value={thanCount > 0 ? thanCount : ''}
                    onChange={(e) => setThanCount(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rfp-fold" className="text-xs">
                    Fold length L (cm)
                  </Label>
                  <Input
                    id="rfp-fold"
                    type="number"
                    min={0.01}
                    max={999.99}
                    step={0.01}
                    value={foldLengthCm > 0 ? foldLengthCm : ''}
                    onChange={(e) => setFoldLengthCm(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rfp-actual" className="text-xs">
                    Actual metres (after L)
                  </Label>
                  <FoldActualField id="rfp-actual" counted={countedQty} foldLengthCm={foldLengthCm} unit={uom} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ReceiptDetailRows mode={entryMode} rows={rows} onChange={setRows} unit={unitShort(uom)} withTags />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rfp-fold" className="text-xs">
                    Fold length L (cm)
                  </Label>
                  <Input
                    id="rfp-fold"
                    type="number"
                    min={0.01}
                    max={999.99}
                    step={0.01}
                    value={foldLengthCm > 0 ? foldLengthCm : ''}
                    onChange={(e) => setFoldLengthCm(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rfp-actual" className="text-xs">
                    Actual metres (after L)
                  </Label>
                  <FoldActualField id="rfp-actual" counted={countedQty} foldLengthCm={foldLengthCm} unit={uom} />
                </div>
              </div>
            </div>
          )}

          {lineShortBy != null && (
            <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <div>
                This completes {thisLineName} {fmt(lineShortBy)} {uom} short of its {fmt(expected)} {uom}. Any loss is
                worked out on the whole job when its last colour is in.
              </div>
            </div>
          )}

          {preview && jobShort && (
            <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <div>
                <span className="font-medium">
                  {fmt(previewQty)} entered
                  {jobReceivedSoFar > 0 ? ` (${fmt(jobReceivedSoFar + previewQty)} on the job in total)` : ''}
                </span>{' '}
                — {fmt(preview.qtyAbnormalLoss)} {uom} beyond the {fmt(preview.tolerancePercent)}% allowance on{' '}
                {fmt(preview.qtyExpected)} expected. This will need a debit note against{' '}
                {jwo?.processor?.name ?? 'the processor'}
                {preview.debitNoteAmount != null ? ` (about ₹${fmt(preview.debitNoteAmount)})` : ''} before the job can
                close. You can still receive it.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!isLace && (
              <div className="space-y-2">
                <Label htmlFor="rfp-width">Measured width (inches) *</Label>
                <Input
                  id="rfp-width"
                  type="number"
                  min={0.01}
                  step="any"
                  value={widthInches > 0 ? widthInches : ''}
                  onChange={(e) => setWidthInches(parseFloat(e.target.value) || 0)}
                  placeholder={
                    (line?.sentWidthInches ?? jwo?.sentWidthInches)
                      ? `asked ${Number(line?.sentWidthInches ?? jwo?.sentWidthInches)}"`
                      : undefined
                  }
                />
                <p className={`text-xs ${widthInches > 0 ? 'text-muted-foreground' : 'text-amber-700'}`}>
                  {widthInches > 0
                    ? cutablePreview != null
                      ? `Cutable: ${cutablePreview}" (after ${cutableWidthDeduction}" selvedge)`
                      : 'Cutable width is worked out after saving'
                    : 'Measure the fabric — the CAD for this lot is made on its cutable width'}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rfp-challan">Their challan no.</Label>
              <Input id="rfp-challan" value={challanRef} onChange={(e) => setChallanRef(e.target.value)} />
            </div>
          </div>

          {/* The processor's bill for this delivery — every inward records its invoice (2026-09-28) */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rfp-invoice">Processor&apos;s invoice no.{invoiceToFollow ? '' : ' *'}</Label>
                <Input
                  id="rfp-invoice"
                  value={invoiceNumber}
                  maxLength={100}
                  disabled={invoiceToFollow}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfp-invoice-date">Invoice date{invoiceToFollow ? '' : ' *'}</Label>
                <Input
                  id="rfp-invoice-date"
                  type="date"
                  value={invoiceDate}
                  max={today}
                  disabled={invoiceToFollow}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={invoiceToFollow}
                onCheckedChange={(v) => {
                  const ticked = v === true;
                  setInvoiceToFollow(ticked);
                  if (ticked) {
                    setInvoiceNumber('');
                    setInvoiceDate('');
                  }
                }}
              />
              Invoice not received yet
            </label>
            {invoiceToFollow ? (
              <p className="text-xs text-muted-foreground">
                {processorName}&apos;s bill will follow — add it on the receipt (Add invoice), or type it when you close
                the job.
              </p>
            ) : (
              !invoiceReady && (
                <p className="text-xs text-muted-foreground">
                  Enter {processorName}&apos;s invoice number and date, or tick &quot;Invoice not received yet&quot;.
                </p>
              )
            )}
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="rfp-to-processor"
              checked={toProcessor}
              onCheckedChange={(v) => {
                setToProcessor(v === true);
                setWarehouseId('');
              }}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="rfp-to-processor" className="font-normal">
                Delivered straight to another processor
              </Label>
              <p className="text-xs text-muted-foreground">
                {processorName} sent the {isLace ? 'dyed lace' : 'fabric'} on to the next processor instead of to our
                store. It is booked there, held by them, and a challan from {processorName} to them is filed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{toProcessor ? "Next processor's unit *" : 'Into warehouse *'}</Label>
              {toProcessor ? (
                <WarehouseCombobox
                  key="to-processor"
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  placeholder="Pick the processor's unit"
                  warehouseTypeFilter="JOB_WORK"
                />
              ) : (
                <WarehouseCombobox
                  key="to-store"
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  placeholder="Select warehouse"
                  excludeTypes={NOT_A_STORE}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfp-date">Date received *</Label>
              <Input
                id="rfp-date"
                type="date"
                min={sentDay}
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
              {dateBeforeSend && sentDay && (
                <p className="text-xs text-destructive">
                  {fmtDay(receivedDate)} is before the day the greige was sent ({fmtDay(sentDay)}).
                </p>
              )}
            </div>
          </div>
          {toProcessor && (
            <div className="space-y-2">
              <Label htmlFor="rfp-vehicle">Vehicle (for the challan)</Label>
              <Input id="rfp-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quality (optional)</Label>
              <Select
                value={qualityGrade || 'none'}
                onValueChange={(v) => setQualityGrade(v === 'none' ? '' : (v as 'A' | 'B' | 'Reject'))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not recorded" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not recorded</SelectItem>
                  <SelectItem value="A">A - Good</SelectItem>
                  <SelectItem value="B">B - Minor Defects</SelectItem>
                  <SelectItem value="Reject">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfp-defects">Defect metres</Label>
              <Input
                id="rfp-defects"
                type="number"
                min={0}
                step="any"
                value={defectMeters > 0 ? defectMeters : ''}
                onChange={(e) => setDefectMeters(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="rfp-final"
              checked={isFinal}
              onCheckedChange={(v) => setFinalOverride(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="rfp-final" className="font-normal">
                {thisLineName
                  ? `This is the final delivery of ${thisLineName} — nothing more of it is expected from ${processorName}`
                  : `This is the final delivery — nothing more is expected from ${processorName}`}
              </Label>
              <p className={`text-xs ${jobShort ? 'text-destructive' : 'text-muted-foreground'}`}>
                {jobShort && preview
                  ? `Short by ${fmt(preview.shortfall)} ${uom}. Only tick this if nothing more is coming from ${processorName}: the job closes and the shortfall becomes a loss against them.`
                  : isFinal && !closesJob
                    ? `${thisLineName} is complete. The job stays open for its other colours, and closes when the last one is in.`
                    : isFinal
                      ? thisLineName
                        ? 'This is the last colour: the job closes on the total received — shrinkage and any loss against the processor are worked out now.'
                        : 'The job closes on the total received: shrinkage and any loss against the processor are worked out now.'
                      : 'More is still to come. This part is booked into stock and the job stays open for the next delivery.'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={receiveMutation.isPending}>
            Cancel
          </Button>
          {anotherColourAfter && (
            // Same truck, another colour: files this receipt and keeps the challan, date, store and invoice
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={!canSubmit}>
              Receive, then another colour
            </Button>
          )}
          <Button onClick={() => handleSubmit(false)} disabled={!canSubmit}>
            {receiveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isFinal ? 'Receive & add to stock' : 'Receive part & add to stock'}
          </Button>
        </DialogFooter>

        {/* Close … short? — the one question that must be answered in words before a short final goes in. */}
        <ConfirmDialog
          open={shortCloseOpen}
          onOpenChange={setShortCloseOpen}
          title={`Close ${jwo?.jobWorkNumber ?? 'this job'} short?`}
          description={
            shortClose
              ? `You are receiving ${fmt(shortClose.qtyThisReceipt)} ${uom}. That brings the total to ` +
                `${fmt(shortClose.cumulative)} ${uom} of the ${fmt(shortClose.expected)} ${uom} expected back from ` +
                `${processorName} — ${fmt(shortClose.shortfall)} ${uom} short, ${fmt(shortClose.beyondAllowance)} ${uom} ` +
                `beyond the ${shortClose.tolerancePercent}% allowance. Confirm only if you do not expect anything more ` +
                `from ${processorName} on this job: the job closes, the shortfall becomes a loss against them` +
                (shortClose.debitNoteAmount != null
                  ? `, and a debit note of about ₹${fmt(shortClose.debitNoteAmount)} is due against them.`
                  : '.') +
                ` If more is still on its way, go back and untick "This is the final delivery" to receive this as a part.`
              : 'This delivery leaves the total short of what was expected back. Confirm only if nothing more is coming.'
          }
          confirmText="Yes — nothing more is coming, close it short"
          cancelText="Go back"
          variant="destructive"
          isLoading={receiveMutation.isPending}
          onConfirm={() => send(true)}
        />
      </DialogContent>
    </Dialog>
  );
}
