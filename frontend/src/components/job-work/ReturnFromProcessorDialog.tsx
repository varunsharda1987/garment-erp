// Returned unprocessed — the processor sent the material back exactly as it went out.
//
// The third way a job ends, alongside "Receive from processor" and "Close short". It credits the
// lot back, files an inward challan and cancels the job in one transaction, so it is confirmed
// before it runs.
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
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { invalidateControlCenter } from '@/lib/control-center-keys';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { toDateInputValue } from '@/lib/date';
import { qtyExceeds, snapToLimit } from '@/lib/quantity';

interface ReturnFromProcessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobWorkOrderId: string;
  jobWorkNumber: string;
  processorName: string;
  /** What went out — the return defaults to all of it, which is the ordinary case. */
  qtySent: number;
  uom: string;
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
  uom,
  onSuccess,
}: ReturnFromProcessorDialogProps) {
  const queryClient = useQueryClient();
  // Numbers as numbers, rendered as '' when zero — `||` on a quantity turns a real 0 into a blank.
  const [qty, setQty] = useState<number>(qtySent);
  const [returnDate, setReturnDate] = useState(today());
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (open) {
      setQty(qtySent);
      setReturnDate(today());
      setRemarks('');
    }
  }, [open, qtySent]);

  const mutation = useMutation({
    mutationFn: () =>
      jobWorkOrderService.returnUnprocessed(jobWorkOrderId, {
        // All of it typed at 2 decimals IS all of it (see @/lib/quantity)
        returnedQty: snapToLimit(qty, qtySent),
        returnDate,
        remarks: remarks || undefined,
      }),
    onSuccess: (result) => {
      handleApiSuccess(
        `${result.jobWorkNumber}: ${result.returnedQty} ${uom} back on challan ${result.inwardChallanNumber}`
      );
      queryClient.invalidateQueries({ queryKey: ['job-work-order', jobWorkOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      invalidateControlCenter(queryClient);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => handleApiError(error, 'Could not record the return'),
  });

  const short = qty > 0 && qtyExceeds(qtySent, qty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Returned unprocessed</DialogTitle>
          <DialogDescription>
            {processorName} sent {jobWorkNumber} back without working on it. The material goes back on the shelf, an
            inward challan is filed, and the job is closed.
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
                {qtySent} {uom} was sent
              </p>
            </div>
            <div>
              <Label htmlFor="ru-date">Date it came back</Label>
              <Input id="ru-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>

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

          {short && (
            <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This closes the job on {qty} {uom}, but {(qtySent - qty).toFixed(2)} {uom} of the {qtySent} sent will
                not be accounted for anywhere. If the processor still holds the rest, record the return once it is all
                back.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !(qty > 0)}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            Record the return &amp; close the job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
