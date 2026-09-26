import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PencilLine, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/date';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/api-error-handler';
import { cadPlanningService } from '@/services/cad-planning.service';

const avg = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(4));

/**
 * Shown on a cost-sheet version made by a CAD correction (cad-correction.service): what the correction is,
 * that approving this version applies it to the CAD, its fabric price approval and the orders built on the
 * previous version, and — when it was only partly applied — which orders are left, with Retry.
 */
export function CadCorrectionBanner({ costSheetId }: { costSheetId: string }) {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const { data: correction } = useQuery({
    queryKey: ['cadCorrectionForCostSheet', costSheetId],
    queryFn: () => cadPlanningService.getCorrectionForCostSheet(costSheetId),
  });
  if (!correction) return null;

  const by = correction.correctedBy
    ? [correction.correctedBy.firstName, correction.correctedBy.lastName].filter(Boolean).join(' ') ||
      correction.correctedBy.email
    : 'someone';
  const orders = correction.appliedOrders?.orders ?? [];
  const leftOver = orders.filter((o) => o.status !== 'UPDATED');

  const retry = async () => {
    setRetrying(true);
    try {
      const result = await cadPlanningService.retryCadCorrection(correction.id);
      notify.success(result.message ?? 'Correction retried');
      await queryClient.invalidateQueries({ queryKey: ['cadCorrectionForCostSheet', costSheetId] });
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Alert className="mb-6 border-info/40 bg-info/10 [&>svg]:text-info">
      <PencilLine className="h-4 w-4" />
      <AlertTitle>Made by a CAD correction</AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>
          CAD average {avg(correction.before?.cadAverage)} → <strong>{avg(correction.after?.cadAverage)}</strong> m/pc,
          corrected by {by} on {formatDateTime(correction.correctedAt)} — {correction.reason}.
        </p>
        {correction.status === 'PENDING_APPROVAL' && (
          <p>
            Approving this version applies the correction: the CAD row, its fabric price approval, and every order built
            on the previous version (a new BOM version and its requirements). Rejecting it drops the correction and
            keeps the previous version.
          </p>
        )}
        {correction.status === 'APPLIED' && <p>The correction has been applied to the CAD and its orders.</p>}
        {correction.status === 'REJECTED' && <p>The correction was rejected — the CAD was not changed.</p>}
        {correction.status === 'PARTIAL' && (
          <div className="space-y-1">
            <p>Applied to the CAD, but some orders could not be updated:</p>
            <ul className="list-disc pl-5">
              {leftOver.map((o) => (
                <li key={o.orderNumber}>
                  {o.orderNumber} — {o.message ?? o.status}
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
              {retrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Retry
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
