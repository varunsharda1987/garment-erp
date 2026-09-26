/**
 * Cancel a purchase order with a typed reason — the ONE cancel dialog, used by the PO list and the PO page
 * (2026-09-27). Before it, the PO page cancelled with a fixed "Cancelled by user", and the list's dialog
 * closed before the request ran, so a refusal wiped the reason that had been typed.
 *
 * It calls the service itself and stays open until the request settles: on success it closes and resets;
 * on a refusal it stays open with the reason intact, so the user can read why and try again.
 *
 * `force` is the admin-only cancel of a PO goods have already arrived against (owner decision 2026-09-27):
 * the normal exit for a part-delivered order is Close Short; the server refuses a force by anyone but an
 * ADMIN, refuses it while a receipt waits for QC, and logs it.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cancelPurchaseOrder } from '@/services/purchaseOrder.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { queryKeys } from '@/hooks/useQuery';

/** The server's limit on a cancellation reason */
export const CANCEL_REASON_MAX = 500;

export interface CancelPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: { id: string; poNumber: string } | null;
  /** Admin force-cancel of a PO goods have been received against */
  force?: boolean;
  onCancelled?: () => void;
}

export function CancelPoDialog({ open, onOpenChange, po, force = false, onCancelled }: CancelPoDialogProps) {
  const queryClient = useQueryClient();
  // The reason belongs to the PO it was typed for — opening the dialog on another PO starts empty
  const [draft, setDraft] = useState<{ poId: string | null; text: string }>({ poId: null, text: '' });
  const [pending, setPending] = useState(false);

  const reason = draft.poId === (po?.id ?? null) ? draft.text : '';
  const trimmed = reason.trim();

  const reset = () => setDraft({ poId: null, text: '' });

  const handleOpenChange = (next: boolean) => {
    // Neither Escape nor "Keep Order" closes it mid-request — the outcome must be seen
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!po || !trimmed || pending) return;
    setPending(true);
    try {
      await cancelPurchaseOrder(po.id, { reason: trimmed, force });
      handleApiSuccess(
        force ? 'Purchase order force-cancelled' : 'Purchase order cancelled',
        `${po.poNumber} has been cancelled.`
      );
      reset();
      onCancelled?.();
      onOpenChange(false);
    } catch (err) {
      // Stays open with the reason as typed: the refusal says why, and a retry needs no retyping
      handleApiError(err, `Could not cancel ${po.poNumber}`);
    } finally {
      setPending(false);
      // A refusal can mean the PO moved on (received, cancelled elsewhere) — the lists must show that too
      void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
    }
  };

  const poNumber = po?.poNumber ?? '';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{force ? 'Force cancel (admin)' : `Cancel ${poNumber}?`}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {force ? (
              <div className="space-y-2">
                <p>
                  Goods have already been received against <strong>{poNumber}</strong>. What arrived stays booked; the
                  balance not yet delivered goes back to its requirements so it can be ordered again.
                </p>
                <p>
                  The normal exit for a part-delivered order is Close Short. This cancellation is logged with your name.
                </p>
              </div>
            ) : (
              <p>
                <strong>{poNumber}</strong> will be cancelled and the supplier should not deliver against it. What it
                was ordered for goes back to its requirements so it can be ordered again. This cannot be undone.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-po-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cancel-po-reason"
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            rows={3}
            disabled={pending}
            onChange={(e) => setDraft({ poId: po?.id ?? null, text: e.target.value })}
            placeholder="e.g. Supplier cannot supply this quality; ordered from another mill"
          />
          <div className="text-right text-xs text-muted-foreground tabular-nums">
            {reason.length}/{CANCEL_REASON_MAX}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep Order</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !trimmed || !po}
            className={buttonVariants({ variant: 'destructive' })}
            onClick={(e) => {
              // Radix closes the dialog on click; it must stay open until the request settles
              e.preventDefault();
              void confirm();
            }}
          >
            {pending ? 'Cancelling…' : force ? 'Force Cancel' : 'Cancel Order'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CancelPoDialog;
