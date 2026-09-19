// Receive from processor — the one action that records a job-work return and books it into stock.
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, PackageCheck } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import ReceiptDetailRows, {
  sumDetailRows,
  type ReceiptDetailRow,
  type ReceiptEntryMode,
} from '@/components/job-work/ReceiptDetailRows';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { warehouseService } from '@/services/warehouse.service';
import type { WarehouseType } from '@/types/inventory.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

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
  const today = new Date().toISOString().split('T')[0];

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
  const [receivedDate, setReceivedDate] = useState(today);
  const [qualityGrade, setQualityGrade] = useState<'' | 'A' | 'B' | 'Reject'>('');
  const [defectMeters, setDefectMeters] = useState<number>(0);

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

  // Reset on the open edge. (The previous handler reset inside Radix's onOpenChange(true), which never
  // fires here — the parent controls `open` — so a second opening showed the last receipt's figures.)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setEntryMode('TOTAL_METERS');
      setQtyMeters(0);
      setThanCount(0);
      setRows([]);
      setFoldLengthCm(0);
      setWidthInches(0);
      setChallanRef('');
      setWarehouseId('');
      setReceivedDate(today);
      setQualityGrade('');
      setDefectMeters(0);
    }
    wasOpen.current = open;
  }, [open, today]);

  // Exactly one physical store → pre-select it; never overwrite a choice.
  useEffect(() => {
    if (open && !warehouseId && stores?.length === 1) setWarehouseId(stores[0].id);
  }, [open, warehouseId, stores]);

  // The quantity the receipt will book.
  //   Total metres: what was typed; or than count × fold length when metres are blank.
  //   Than-/bale-wise: the sum of the rows (the server derives the than count from them).
  const rowsValid = rows.length > 0 && rows.every((r) => r.meters > 0);
  const effectiveQty =
    entryMode === 'TOTAL_METERS'
      ? qtyMeters > 0
        ? qtyMeters
        : thanCount > 0 && foldLengthCm > 0
          ? (thanCount * foldLengthCm) / 100
          : 0
      : rowsValid
        ? sumDetailRows(rows)
        : 0;

  // Warn on a short return BEFORE commit. Debounced; the figures come from the server's own loss
  // split so the dialog and the booked numbers cannot disagree.
  const [previewQty, setPreviewQty] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPreviewQty(effectiveQty), 300);
    return () => clearTimeout(t);
  }, [effectiveQty]);

  const { data: preview } = useQuery({
    queryKey: ['jwo-receive-preview', jobWorkOrderId, previewQty],
    queryFn: () => jobWorkOrderService.getReceivePreview(jobWorkOrderId!, previewQty),
    enabled: open && !!jobWorkOrderId && previewQty > 0,
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      jobWorkOrderService.receiveToStock({
        jobWorkOrderId: jobWorkOrderId!,
        entryMode,
        ...(entryMode === 'TOTAL_METERS'
          ? {
              qtyReceivedMeters: qtyMeters > 0 ? qtyMeters : undefined,
              // A count typed beside a total is stored as given (the server only derives the
              // quantity from than × fold when the metres are blank).
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
        processingQC:
          qualityGrade || defectMeters > 0
            ? { qualityGrade: qualityGrade || undefined, defectMeters: defectMeters > 0 ? defectMeters : undefined }
            : undefined,
      }),
    onSuccess: (result) => {
      const abnormal = Number(result.lossSplit?.qtyAbnormalLoss ?? 0);
      if (abnormal > 0) {
        handleApiSuccess(
          `${jwo?.jobWorkNumber ?? 'Job'} received into stock`,
          `${abnormal.toFixed(2)} m abnormal loss — a debit note against the processor is needed before the job can close.`
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
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => handleApiError(err, 'Could not receive from processor'),
  });

  if (!jobWorkOrderId) return null;

  const isLace = jwo?.fabricType === 'LACE';
  const uom = jwo?.uom ?? 'MTR';
  const expected = jwo?.qtyBillable ?? null;
  // A return cannot be dated before the greige went out — the server refuses it too.
  const sentDay = jwo?.sentDate ? jwo.sentDate.slice(0, 10) : undefined;
  const dateBeforeSend = !!sentDay && !!receivedDate && receivedDate < sentDay;
  const canSubmit =
    effectiveQty > 0 && !!warehouseId && !!receivedDate && !dateBeforeSend && !receiveMutation.isPending;

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
            {preview && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maximum you can receive</span>
                <span className="font-medium">
                  {fmt(preview.maxReceivable)} {uom}
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
                step={0.01}
                value={qtyMeters > 0 ? qtyMeters : ''}
                onChange={(e) => setQtyMeters(parseFloat(e.target.value) || 0)}
                placeholder={expected != null ? `e.g. ${fmt(expected)}` : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Than count and fold length are recorded with the receipt. Leave the metres blank to work them out from
                than count × fold length.
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
            </div>
          ) : (
            <div className="space-y-2">
              <ReceiptDetailRows mode={entryMode} rows={rows} onChange={setRows} unit={uom === 'MTR' ? 'm' : uom} />
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
            </div>
          )}

          {preview?.isOverTolerance && (
            <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
              <div>
                <span className="font-medium">{fmt(previewQty)} entered</span> — {fmt(preview.qtyAbnormalLoss)} {uom}{' '}
                beyond the {fmt(preview.tolerancePercent)}% allowance on {fmt(preview.qtyExpected)} expected. This will
                need a debit note against {jwo?.processor?.name ?? 'the processor'}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Into warehouse *</Label>
              <WarehouseCombobox
                value={warehouseId}
                onValueChange={setWarehouseId}
                placeholder="Select warehouse"
                excludeTypes={NOT_A_STORE}
              />
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
                step={0.01}
                value={defectMeters > 0 ? defectMeters : ''}
                onChange={(e) => setDefectMeters(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={receiveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => receiveMutation.mutate()} disabled={!canSubmit}>
            {receiveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Receive &amp; add to stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
