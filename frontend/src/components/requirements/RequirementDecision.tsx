/**
 * A new Order BOM version and a requirement already on a PO / job work (2026-09-26).
 *
 * The PO is never grown or changed by a recalculation. When the new version needs MORE, the difference
 * arrives as its own requirement in status DECISION_PENDING — not orderable — and the team decides case
 * by case: "Order the extra" (→ PO Required) or "Don't order more" (closed as not ordered, remembered by
 * every later recalculation). When it needs LESS, the committed row carries `surplusQty`.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { declineExtraRequirement, orderExtraRequirement } from '@/services/mrp.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatQuantity } from '@/lib/formatters';
import { isQtyZero } from '@/lib/quantity';
import { queryKeys } from '@/hooks/useQuery';
import type { MaterialRequirement } from '@/types/mrp.types';

/** The line under a requirement's quantity: why a decision row exists, or how much a PO row is over */
export function RequirementQtyNote({ req }: { req: MaterialRequirement }) {
  if (req.status === 'DECISION_PENDING') {
    return (
      <div className="text-xs text-amber-800" title="The rest is already on a PO or job work">
        more needed by BOM{req.orderBom ? ` v${req.orderBom.version}` : ''} — order it?
      </div>
    );
  }
  if (req.surplusQty != null && !isQtyZero(req.surplusQty)) {
    return (
      <div
        className="text-xs text-info"
        title="The current BOM version needs less than this PO / job work holds. The PO is not changed."
      >
        {formatQuantity(req.surplusQty, req.unit)} more than now needed
      </div>
    );
  }
  return null;
}

/** "Order the extra" / "Don't order more" for a DECISION_PENDING row; nothing for any other row */
export function RequirementDecisionActions({ req }: { req: MaterialRequirement }) {
  const queryClient = useQueryClient();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (req.status !== 'DECISION_PENDING') return null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequirements.all });
  };

  const orderExtra = async () => {
    setBusy(true);
    try {
      await orderExtraRequirement(req.id);
      handleApiSuccess('Extra can be ordered', `${req.requirementNumber} is now PO Required`);
      refresh();
    } catch (err) {
      handleApiError(err, 'Could not mark the extra for ordering');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await declineExtraRequirement(req.id, reason.trim() || undefined);
      handleApiSuccess('Recorded', `The extra ${formatQuantity(req.totalRequired, req.unit)} will not be ordered`);
      setDeclineOpen(false);
      setReason('');
      refresh();
    } catch (err) {
      handleApiError(err, 'Could not record the decision');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-success hover:text-success"
        disabled={busy}
        onClick={orderExtra}
      >
        Order the extra
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        disabled={busy}
        onClick={() => setDeclineOpen(true)}
      >
        Don&apos;t order more
      </Button>

      <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Don&apos;t order the extra {formatQuantity(req.totalRequired, req.unit)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {req.requirementNumber} ({req.material?.name || 'material'}) closes as not ordered. What is already on the
              PO or job work stays as it is, and recalculating the order will not ask about this quantity again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`decline-${req.id}`}>Reason (optional)</Label>
            <Textarea
              id={`decline-${req.id}`}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. enough on the PO — the extra wastage is covered"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void decline();
              }}
            >
              Don&apos;t order more
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
