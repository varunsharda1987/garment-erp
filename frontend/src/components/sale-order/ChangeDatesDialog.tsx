import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { changeSaleOrderDates } from '@/services/saleOrder.service';
import { getErrorMessage } from '@/lib/api-error-handler';
import { toDateInputValue } from '@/lib/date';
import type { SaleOrder } from '@/types/saleOrder.types';

interface ChangeDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleOrder: SaleOrder;
  onSaved: () => void;
}

export function ChangeDatesDialog({ open, onOpenChange, saleOrder, onSaved }: ChangeDatesDialogProps) {
  const [shipDate, setShipDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setShipDate(toDateInputValue(saleOrder.expectedShipDate));
    setDeadline(toDateInputValue(saleOrder.buyerDeadline));
    setReason('');
  }, [open, saleOrder.expectedShipDate, saleOrder.buyerDeadline]);

  const initialShip = toDateInputValue(saleOrder.expectedShipDate);
  const initialDeadline = toDateInputValue(saleOrder.buyerDeadline);
  const shipChanged = shipDate !== initialShip;
  const deadlineChanged = deadline !== initialDeadline;
  const shipAfterDeadline = Boolean(shipDate && deadline && shipDate > deadline);
  const linked = (saleOrder.productionOrders ?? []).find((po) => po.status !== 'CANCELLED');

  const mutation = useMutation({
    mutationFn: () =>
      changeSaleOrderDates(saleOrder.id, {
        ...(shipChanged ? { expectedShipDate: shipDate || null } : {}),
        ...(deadlineChanged ? { buyerDeadline: deadline || null } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      onSaved();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Dates</DialogTitle>
          <DialogDescription>
            {saleOrder.saleOrderNumber} is confirmed. Leave a date empty to clear it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="so-ship-date">Expected Ship Date</Label>
            <Input id="so-ship-date" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="so-buyer-deadline">Buyer Deadline</Label>
            <Input id="so-buyer-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          {shipAfterDeadline && (
            <p className="text-sm text-destructive">
              The Expected Ship Date is after the Buyer Deadline — the goods would leave after the buyer's last day.
            </p>
          )}
          {linked && (
            <Alert>
              <AlertDescription>
                {shipChanged && shipDate
                  ? `${linked.orderNumber} and its unfinished runs will move to the new ship date.`
                  : `Linked to ${linked.orderNumber}: a new ship date moves its delivery date and unfinished runs too.`}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="so-dates-reason">Reason (optional)</Label>
            <Textarea
              id="so-dates-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Buyer moved the delivery by a week"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!shipChanged && !deadlineChanged) || shipAfterDeadline}
          >
            {mutation.isPending ? 'Saving…' : 'Save Dates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
