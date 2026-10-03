// Returned unprocessed — the processor sent the material back exactly as it went out.
//
// The third way a job ends, alongside "Receive from processor" and "Close short". It credits the
// lot back, files an inward challan and cancels the job in one transaction, so it is confirmed
// before it runs. On a job with several colours it can be ONE colour (2026-10-03): only that colour's
// greige comes back, its orders go back to "needs processing", and the other colours carry on.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Undo2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { invalidateControlCenter } from '@/lib/control-center-keys';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { toDateInputValue } from '@/lib/date';
import { qtyExceeds, snapToLimit } from '@/lib/quantity';
import { unitShort } from '@/lib/units';
import { notProcessedWord, processingVerb } from '@/lib/jwo-lines';

/** A greige lot the job's greige went out on — offered when the greige went out on several */
export interface ReturnLotOption {
  greigeStockLotId: string;
  label: string;
  qtyOut: number;
}

interface ReturnFromProcessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobWorkOrderId: string;
  jobWorkNumber: string;
  processorName: string;
  /** What went out — the return defaults to all of it, which is the ordinary case. */
  qtySent: number;
  uom: string;
  /**
   * The job took cloth that was already lying at the processor (nothing travelled out): it comes back
   * into a store the user names, as a new lot (Phase 4b).
   */
  drewWhereItLay?: boolean;
  /** The job's process — a colour back untouched is "undyed" on a dyeing job, "unprinted" on a printing one */
  processType?: string | null;
  /** One colour of the job (its line) — only this colour's greige comes back unprocessed */
  line?: { id: string; label: string } | null;
  /** The lots the job's greige went out on; with more than one, the user says how much came back on each */
  lots?: ReturnLotOption[];
  onSuccess?: () => void;
}

const today = () => toDateInputValue(new Date());

export default function ReturnFromProcessorDialog({
  open,
  onOpenChange,
  jobWorkOrderId,
  jobWorkNumber,
  processorName,
  qtySent,
  uom: rawUom,
  processType = null,
  drewWhereItLay = false,
  line = null,
  lots = [],
  onSuccess,
}: ReturnFromProcessorDialogProps) {
  const queryClient = useQueryClient();
  const uom = unitShort(rawUom);
  const untouched = notProcessedWord(processType);
  // Numbers as numbers, rendered as '' when zero — `||` on a quantity turns a real 0 into a blank.
  const [qty, setQty] = useState<number>(qtySent);
  const [returnDate, setReturnDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const [storeWarehouseId, setStoreWarehouseId] = useState('');
  const [lotQty, setLotQty] = useState<Record<string, number>>({});
  // The last colour out finishes a job that came back short: the server asks first, the user answers here
  const [shortQuestion, setShortQuestion] = useState<string | null>(null);
  const splitLots = !!line && lots.length > 1;

  useEffect(() => {
    if (open) {
      setQty(qtySent);
      setReturnDate(today());
      setRemarks('');
      setLotQty({});
      setShortQuestion(null);
    }
  }, [open, qtySent]);

  const lotTotal = Object.values(lotQty).reduce((sum, q) => sum + (q || 0), 0);
  const lotsAddUp = !splitLots || (!qtyExceeds(lotTotal, qty) && !qtyExceeds(qty, lotTotal));

  const mutation = useMutation({
    mutationFn: (shortCloseConfirmed: boolean) =>
      jobWorkOrderService.returnUnprocessed(jobWorkOrderId, {
        ...(shortCloseConfirmed ? { shortCloseConfirmed: true } : {}),
        // All of it typed at 2 decimals IS all of it (see @/lib/quantity)
        returnedQty: snapToLimit(qty, qtySent),
        returnDate,
        remarks: remarks || undefined,
        ...(drewWhereItLay ? { storeWarehouseId } : {}),
        ...(line ? { lineId: line.id } : {}),
        ...(splitLots
          ? {
              lots: Object.entries(lotQty)
                .filter(([, q]) => q > 0)
                .map(([greigeStockLotId, q]) => ({ greigeStockLotId, qty: q })),
            }
          : {}),
      }),
    onSuccess: (result) => {
      handleApiSuccess(
        line
          ? `${result.lineLabel ?? line.label}: ${result.returnedQty} ${uom} back ${untouched} on challan ${result.inwardChallanNumber}` +
              (result.jobClosed ? ` — ${result.jobWorkNumber} is finished` : '')
          : `${result.jobWorkNumber}: ${result.returnedQty} ${uom} back on challan ${result.inwardChallanNumber}`
      );
      queryClient.invalidateQueries({ queryKey: ['job-work-order', jobWorkOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      invalidateControlCenter(queryClient);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      const data = (error as { response?: { data?: { message?: string; details?: { reason?: string } } } })?.response
        ?.data;
      if (data?.details?.reason === 'SHORT_CLOSE_UNCONFIRMED') {
        setShortQuestion(data.message ?? 'This finishes the job short.');
        return;
      }
      handleApiError(error, 'Could not record the return');
    },
  });

  const short = qty > 0 && qtyExceeds(qtySent, qty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{line ? `${line.label} came back ${untouched}` : 'Returned unprocessed'}</DialogTitle>
          <DialogDescription>
            {line
              ? `${processorName} sent ${line.label}'s greige back without ${processingVerb(processType)} it. The greige goes back on the shelf, ` +
                `an inward challan is filed, and ${line.label} leaves ${jobWorkNumber}: its order goes back to "needs ` +
                `processing" so a new job can be raised. The other colours carry on.`
              : `${processorName} sent ${jobWorkNumber} back without working on it. The material goes back on the shelf, an ` +
                `inward challan is filed, and the job is closed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ru-qty">How much came back ({uom})</Label>
              <Input
                id="ru-qty"
                type="number"
                step="any"
                min="0"
                value={qty > 0 ? qty : ''}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {qtySent} {uom} {line ? `of greige went out for ${line.label}` : 'was sent'}
              </p>
            </div>
            <div>
              <Label htmlFor="ru-date">Date it came back</Label>
              <Input id="ru-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>

          {splitLots && (
            <div className="space-y-2">
              <Label>Which lot(s) it came back on</Label>
              {lots.map((lot) => (
                <div key={lot.greigeStockLotId} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">
                    {lot.label}
                    <span className="text-xs text-muted-foreground">
                      {' '}
                      · {lot.qtyOut} {uom} out on this job
                    </span>
                  </span>
                  <Input
                    className="w-32"
                    type="number"
                    step="any"
                    min="0"
                    aria-label={`Metres back on ${lot.label}`}
                    value={(lotQty[lot.greigeStockLotId] ?? 0) > 0 ? lotQty[lot.greigeStockLotId] : ''}
                    onChange={(e) => setLotQty((prev) => ({ ...prev, [lot.greigeStockLotId]: Number(e.target.value) }))}
                  />
                </div>
              ))}
              {!lotsAddUp && (
                <p className="text-xs text-destructive">
                  The lots add up to {lotTotal} {uom} — they must add up to the {qty} {uom} that came back.
                </p>
              )}
            </div>
          )}

          {drewWhereItLay && (
            <div>
              <Label>Came back into *</Label>
              <WarehouseCombobox
                value={storeWarehouseId}
                onValueChange={setStoreWarehouseId}
                placeholder="Pick our store"
                excludeTypes={['JOB_WORK']}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This job took cloth already lying at {processorName}, so it comes back into the store you pick, as a new
                lot on the inward challan.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="ru-remarks">Why (optional)</Label>
            <Textarea
              id="ru-remarks"
              rows={2}
              placeholder="e.g. shade rejected, mill could not take it"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {shortQuestion && (
            <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{shortQuestion}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShortQuestion(null)}>
                  Go back
                </Button>
                <Button size="sm" onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>
                  Yes — nothing more is coming, finish it short
                </Button>
              </div>
            </div>
          )}

          {short && (
            <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {line
                  ? `This takes ${line.label} off the job on ${qty} ${uom}, but ${(qtySent - qty).toFixed(2)} ${uom} of its ` +
                    `${qtySent} went out — the rest will not be accounted for. If the processor still holds it, record ` +
                    `the return once it is all back.`
                  : `This closes the job on ${qty} ${uom}, but ${(qtySent - qty).toFixed(2)} ${uom} of the ${qtySent} sent ` +
                    `will not be accounted for anywhere. If the processor still holds the rest, record the return once it ` +
                    `is all back.`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate(false)}
            disabled={mutation.isPending || !(qty > 0) || (drewWhereItLay && !storeWarehouseId) || !lotsAddUp}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            {line ? `Record ${line.label} back ${untouched}` : 'Record the return & close the job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
