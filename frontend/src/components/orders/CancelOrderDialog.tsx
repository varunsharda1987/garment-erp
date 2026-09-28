import { useEffect, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';
import { cancelOrder, getOrderLaceAllocationSummary, type LaceHandling } from '@/services/order.service';
import { getErrorMessage, handleApiSuccess } from '@/lib/api-error-handler';
import { formatQuantity } from '@/lib/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onCancelled: () => void;
}

/**
 * Cancelling an order is its own decision — never the fallback of a refused Delete (2026-09-28: a
 * Delete click on an order being cut cancelled it). The server refuses once any production run has
 * started and names the runs; that refusal is shown here, in the dialog, not as a passing toast.
 */
export default function CancelOrderDialog({ open, onOpenChange, orderId, orderNumber, onCancelled }: Props) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [laceHandling, setLaceHandling] = useState<LaceHandling>('RELEASE_TO_STOCK');
  const [lace, setLace] = useState<{ activeAllocations: number; releasableQuantity: number } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setReason('');
    setLaceHandling('RELEASE_TO_STOCK');
    setRefusal(null);
    setLace(null);
    let live = true;
    getOrderLaceAllocationSummary(orderId)
      .then((summary) => {
        if (live) setLace(summary);
      })
      .catch((err) => {
        if (live) setRefusal(getErrorMessage(err));
      });
    return () => {
      live = false;
    };
  }, [open, orderId]);

  const hasLace = (lace?.activeAllocations ?? 0) > 0;
  const confirmed = typed.trim().toUpperCase() === orderNumber.toUpperCase();

  const submit = async () => {
    setSaving(true);
    setRefusal(null);
    try {
      await cancelOrder(orderId, {
        laceHandling: hasLace ? laceHandling : undefined,
        cancellationReason: reason.trim() || undefined,
      });
      handleApiSuccess('Order cancelled', `Order ${orderNumber} has been cancelled.`);
      onOpenChange(false);
      onCancelled();
    } catch (err) {
      setRefusal(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel order {orderNumber}</DialogTitle>
          <DialogDescription>
            The order, its production runs that have not started, its BOMs and its open material requirements are
            cancelled, and its reserved stock is released. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {refusal && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          )}

          {hasLace && (
            <div className="space-y-2">
              <Label>
                Lace still reserved for this order ({lace?.activeAllocations} allocation
                {lace?.activeAllocations === 1 ? '' : 's'}, {formatQuantity(lace?.releasableQuantity ?? 0, 'METER')})
              </Label>
              <RadioGroup value={laceHandling} onValueChange={(v) => setLaceHandling(v as LaceHandling)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="RELEASE_TO_STOCK" id="lace-release" />
                  <Label htmlFor="lace-release" className="font-normal">
                    Release it to stock
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="RETURN_TO_SUPPLIER" id="lace-return" />
                  <Label htmlFor="lace-return" className="font-normal">
                    Return it to the supplier
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this order being cancelled?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-confirm">
              Type <span className="font-mono font-semibold">{orderNumber}</span> to confirm
            </Label>
            <Input id="cancel-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!confirmed || saving || lace === null}>
            {saving ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
