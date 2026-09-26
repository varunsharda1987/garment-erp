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
import { foldActual, foldLabel } from '@/lib/fold-length';
import { generateId } from '@/lib/utils';

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
  const [challanRef, setChallanRef] = useState('');
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
      setWarehouseId('');
      setToProcessor(false);
      setVehicle('');
      setReceivedDate(today);
      setQualityGrade('');
      setDefectMeters(0);
      setFinalOverride(null);
      setShortCloseOpen(false);
      setServerShort(null);
    }
    wasOpen.current = open;
  }, [open, today]);

  // Exactly one physical store → pre-select it; never overwrite a choice.
  useEffect(() => {
    if (open && !toProcessor && !warehouseId && stores?.length === 1) setWarehouseId(stores[0].id);
  }, [open, toProcessor, warehouseId, stores]);

  // The quantity the receipt will book.
  //   Counted: the metres typed, or the sum of the than/bale rows (the server derives the than count
  //   from them) — the processor's own count.
  //   Actual: counted × L/100 when a fold length under 100 cm is given — what goes to stock, and what
  //   the split, the cap and the "final" tick below all run on.
  const rowsValid = rows.length > 0 && rows.every((r) => r.meters > 0);
  const countedQty = entryMode === 'TOTAL_METERS' ? qtyMeters : rowsValid ? sumDetailRows(rows) : 0;
  const effectiveQty = foldActual(countedQty, foldLengthCm);
  const foldNote = countedQty > 0 ? foldLabel(countedQty, foldLengthCm, jwo?.uom ?? 'MTR') : null;

  // Parts: what earlier deliveries already booked. The split, the cap and the "final" tick all work
  // on the CUMULATIVE figure — a short first delivery is not a loss until the last one is in.
  const receivedSoFar = Number(jwo?.qtyReceivedMeters ?? 0);
  const expected = jwo?.qtyBillable ?? null;
  const cumulativeQty = receivedSoFar + effectiveQty;

  // Warn on a short return BEFORE commit. Debounced; the figures come from the server's own loss
  // split so the dialog and the booked numbers cannot disagree. Asked for the cumulative total.
  const [previewQty, setPreviewQty] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPreviewQty(effectiveQty), 300);
    return () => clearTimeout(t);
  }, [effectiveQty]);

  const { data: preview } = useQuery({
    queryKey: ['jwo-receive-preview', jobWorkOrderId, receivedSoFar, previewQty],
    queryFn: () => jobWorkOrderService.getReceivePreview(jobWorkOrderId!, receivedSoFar + previewQty),
    enabled: open && !!jobWorkOrderId && previewQty > 0,
  });

  // "This is the final delivery": pre-ticked once the total reaches the expected quantity less the
  // processor's tolerance (the server's own figure: job → process type → 0), editable either way.
  const tolerancePercent = preview?.tolerancePercent ?? jwo?.tolerancePercent ?? 0;
  const autoFinal = expected != null && expected > 0 ? cumulativeQty >= expected * (1 - tolerancePercent / 100) : true;
  const isFinal = finalOverride ?? autoFinal;

  const receiveMutation = useMutation({
    mutationFn: ({ shortCloseConfirmed }: { shortCloseConfirmed: boolean }) =>
      jobWorkOrderService.receiveToStock({
        jobWorkOrderId: jobWorkOrderId!,
        entryMode,
        ...(entryMode === 'TOTAL_METERS'
          ? {
              qtyReceivedMeters: qtyMeters > 0 ? qtyMeters : undefined,
              // The than count is a count of pieces, recorded as given.
              thanCount: thanCount > 0 ? thanCount : undefined,
            }
          : {
              details: rows.map((r, i) => ({
                detailType: 'THAN' as const,
                baleNumber: entryMode === 'BALE_WISE' ? r.baleNumber : null,
                sequenceNo: i + 1,
                meters: r.meters,
              })),
            }),
        foldLengthCm: foldLengthCm > 0 ? foldLengthCm : undefined,
        receivedWidthInches: widthInches > 0 ? widthInches : undefined,
        receivedChallan: challanRef.trim() || undefined,
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
    onSuccess: (result) => {
      const abnormal = Number(result.lossSplit?.qtyAbnormalLoss ?? 0);
      if (result.replayed) {
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
  const canSubmit =
    effectiveQty > 0 && !!warehouseId && !!receivedDate && !dateBeforeSend && !receiveMutation.isPending;

  // A final delivery that leaves the total short beyond the tolerance is a SHORT CLOSE: it is asked
  // about, in words, before anything is sent. The server refuses it anyway if the question was skipped.
  const shortClose: ShortCloseFigures | null =
    serverShort ??
    (preview && preview.isOverTolerance
      ? {
          qtyThisReceipt: effectiveQty,
          cumulative: receivedSoFar + effectiveQty,
          expected: preview.qtyExpected,
          shortfall: preview.shortfall,
          beyondAllowance: preview.qtyAbnormalLoss,
          tolerancePercent: preview.tolerancePercent,
          debitNoteAmount: preview.debitNoteAmount,
        }
      : null);
  // Every send goes through here: a press while one is already on its way is dropped.
  const send = (shortCloseConfirmed: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    receiveMutation.mutate({ shortCloseConfirmed });
  };
  const handleSubmit = () => {
    if (inFlight.current) return;
    if (isFinal && preview?.isOverTolerance) {
      setServerShort(null);
      setShortCloseOpen(true);
      return;
    }
    send(false);
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
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isLace ? 'Expected dyed lace' : 'Expected back'}</span>
              <span className="font-medium">
                {expected != null ? `${fmt(expected)} ${uom}` : '-'}
                {jwo?.qtySentMeters != null && jwo?.expectedShrinkage != null && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    ({fmt(jwo.qtySentMeters)} sent − {jwo.expectedShrinkage}% shrinkage)
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
            </RadioGroup>
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
              <div className="grid grid-cols-2 gap-3">
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
                    Fold length (cm, under 1000)
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
              </div>
              {foldNote && <p className="text-xs text-info">{foldNote}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <ReceiptDetailRows mode={entryMode} rows={rows} onChange={setRows} unit={unitShort(uom)} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rfp-fold" className="text-xs">
                    Fold length (cm, under 1000)
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
              </div>
              {foldNote && <p className="text-xs text-info">{foldNote}</p>}
            </div>
          )}

          {preview?.isOverTolerance && isFinal && (
            <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <div>
                <span className="font-medium">
                  {fmt(previewQty)} entered{receivedSoFar > 0 ? ` (${fmt(receivedSoFar + previewQty)} in total)` : ''}
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
                <Label htmlFor="rfp-width">Measured width (inches)</Label>
                <Input
                  id="rfp-width"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={widthInches > 0 ? widthInches : ''}
                  onChange={(e) => setWidthInches(parseFloat(e.target.value) || 0)}
                  placeholder={jwo?.sentWidthInches ? `asked ${jwo.sentWidthInches}"` : undefined}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rfp-challan">Their challan no.</Label>
              <Input id="rfp-challan" value={challanRef} onChange={(e) => setChallanRef(e.target.value)} />
            </div>
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
                This is the final delivery — nothing more is expected from {processorName}
              </Label>
              <p
                className={`text-xs ${isFinal && preview?.isOverTolerance ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {isFinal && preview?.isOverTolerance
                  ? `Short by ${fmt(preview.shortfall)} ${uom}. Only tick this if nothing more is coming from ${processorName}: the job closes and the shortfall becomes a loss against them.`
                  : isFinal
                    ? 'The job closes on the total received: shrinkage and any loss against the processor are worked out now.'
                    : 'More is still to come. This part is booked into stock and the job stays open for the next delivery.'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={receiveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
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
