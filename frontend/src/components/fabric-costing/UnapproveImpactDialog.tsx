/**
 * Unapprove Impact Dialog (ESSKY091LS guard)
 *
 * Shown when unapproving a fabric-costing option returns 409
 * COSTING_OPTION_IN_USE: downstream documents (cost sheets → order BOMs →
 * requirements → POs) froze their fabric rate from this option.
 *
 * blocking=true  → an active APPROVED cost sheet was built from this price.
 *                  Unapproval is refused; re-version/unapprove the sheet first.
 * blocking=false → only draft sheets / BOMs / POs depend on it. The user may
 *                  proceed ("Unapprove anyway"), which retries with
 *                  confirmImpact: true. Those documents keep their frozen
 *                  rates and will show as drifted from the source.
 */

import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
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
import { Badge } from '@/components/ui/badge';
import type { CadCostingDependents, CostingInUseErrorDetails } from '../../types/fabricCosting.types';

/**
 * Extract the COSTING_OPTION_IN_USE payload from an unapprove error, or null
 * when the error is something else (falls through to normal error handling).
 */
export function getCostingInUseDetails(error: unknown): CostingInUseErrorDetails | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const axiosError = error as AxiosError<{ details?: CostingInUseErrorDetails }>;
  if (axiosError.response?.status !== 409) return null;
  const details = axiosError.response.data?.details;
  if (!details || details.code !== 'COSTING_OPTION_IN_USE') return null;
  return details;
}

interface UnapproveImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocking: boolean;
  dependents: CadCostingDependents | null;
  /** Retry the unapprove with confirmImpact: true (non-blocking case only). */
  onConfirm: () => void;
  isLoading?: boolean;
}

const sheetStatusVariant = (status: string) =>
  status === 'APPROVED' ? 'destructive' : status === 'REJECTED' ? 'outline' : 'secondary';

export default function UnapproveImpactDialog({
  open,
  onOpenChange,
  blocking,
  dependents,
  onConfirm,
  isLoading = false,
}: UnapproveImpactDialogProps) {
  const navigate = useNavigate();
  const firstBlockingSheet = dependents?.blockingCostSheets[0];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocking ? 'Costing is in use — cannot unapprove' : 'Costing is in use — unapprove anyway?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {blocking
              ? 'An approved cost sheet was built from this price. Create a new cost sheet version (or unapprove the cost sheet) first, then change the costing — otherwise the sheet silently stops matching its source.'
              : 'These documents froze their fabric rate from this costing. They keep their current numbers, but will be marked as drifted from the source until refreshed.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {dependents && (
          <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
            {dependents.costSheets.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Cost sheets</p>
                <ul className="space-y-1">
                  {dependents.costSheets.map((sheet) => (
                    <li key={sheet.costSheetId} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{sheet.costSheetId}</span>
                      {sheet.styleCode && <span className="text-muted-foreground">{sheet.styleCode}</span>}
                      <Badge variant="outline">v{sheet.version}</Badge>
                      <Badge variant={sheetStatusVariant(sheet.costSheetApprovalStatus)}>
                        {sheet.costSheetApprovalStatus}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dependents.orderBoms.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Order BOMs</p>
                <ul className="space-y-1">
                  {dependents.orderBoms.map((bom) => (
                    <li key={bom.orderBomId} className="flex flex-wrap items-center gap-2">
                      <span>{bom.orderNumber}</span>
                      <Badge variant="outline">BOM v{bom.bomVersion}</Badge>
                      <Badge variant={bom.bomStatus === 'APPROVED' ? 'destructive' : 'secondary'}>
                        {bom.bomStatus}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dependents.purchaseOrders.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Purchase orders</p>
                <ul className="space-y-1">
                  {dependents.purchaseOrders.map((po) => (
                    <li key={po.purchaseOrderId} className="flex items-center gap-2">
                      <span>{po.poNumber}</span>
                      <Badge variant="secondary">{po.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(dependents.counts.materialRequirements > 0 ||
              dependents.counts.orderItems > 0 ||
              dependents.counts.orderItemCostingCount > 0) && (
              <p className="text-muted-foreground">
                Also linked:{' '}
                {[
                  dependents.counts.materialRequirements > 0
                    ? `${dependents.counts.materialRequirements} material requirement(s)`
                    : null,
                  dependents.counts.orderItems > 0 ? `${dependents.counts.orderItems} order item(s)` : null,
                  dependents.counts.orderItemCostingCount > 0
                    ? `${dependents.counts.orderItemCostingCount} order-item costing(s)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          {blocking ? (
            <>
              {firstBlockingSheet && (
                <AlertDialogAction onClick={() => navigate(`/cost-sheets/${firstBlockingSheet.costSheetId}`)}>
                  View cost sheet
                </AlertDialogAction>
              )}
              <AlertDialogCancel>Close</AlertDialogCancel>
            </>
          ) : (
            <>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                disabled={isLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading ? 'Please wait…' : 'Unapprove anyway'}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
