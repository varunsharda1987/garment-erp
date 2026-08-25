/**
 * CancelOrderDialog - Confirmation dialog for canceling a sale order.
 * Blocks cancellation if:
 * - Active production orders exist (not cancelled)
 * - Any items have been dispatched (dispatchedQty > 0)
 * Shows warning about allocations that will be released.
 */

import { useMemo } from 'react';
import { AlertTriangle, XCircle, Factory, Truck, Package } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { SaleOrder } from '@/types/saleOrder.types';

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  saleOrder: SaleOrder;
  isLoading?: boolean;
}

export function CancelOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  saleOrder,
  isLoading = false,
}: CancelOrderDialogProps) {
  const analysis = useMemo(() => {
    const activeProductionOrders = (saleOrder.productionOrders || []).filter((po) => po.status !== 'CANCELLED');
    const hasActiveProduction = activeProductionOrders.length > 0;

    const totalDispatched = (saleOrder.items || []).reduce((sum, item) => sum + (item.dispatchedQty || 0), 0);
    const hasDispatched = totalDispatched > 0;

    const totalAllocated = (saleOrder.items || []).reduce((sum, item) => sum + (item.allocatedQty || 0), 0);

    const canCancel = !hasActiveProduction && !hasDispatched;

    return {
      hasActiveProduction,
      activeProductionOrders,
      hasDispatched,
      totalDispatched,
      totalAllocated,
      canCancel,
    };
  }, [saleOrder]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancel Sale Order?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {analysis.canCancel
              ? `This will cancel ${saleOrder.saleOrderNumber} and release all allocations.`
              : 'This sale order cannot be cancelled.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {/* Production Order Block */}
          {analysis.hasActiveProduction && (
            <Alert variant="destructive">
              <Factory className="h-4 w-4" />
              <AlertTitle>Active Production</AlertTitle>
              <AlertDescription>
                {analysis.activeProductionOrders.length} active production order
                {analysis.activeProductionOrders.length !== 1 ? 's' : ''} exist
                {analysis.activeProductionOrders.length === 1 && (
                  <>: {analysis.activeProductionOrders[0].orderNumber}</>
                )}
                . Cancel the production order{analysis.activeProductionOrders.length !== 1 ? 's' : ''} first.
              </AlertDescription>
            </Alert>
          )}

          {/* Dispatch Block */}
          {analysis.hasDispatched && (
            <Alert variant="destructive">
              <Truck className="h-4 w-4" />
              <AlertTitle>Items Dispatched</AlertTitle>
              <AlertDescription>
                {analysis.totalDispatched} pcs have already been dispatched. Orders with dispatched items cannot be
                cancelled.
              </AlertDescription>
            </Alert>
          )}

          {/* Allocation Warning */}
          {analysis.canCancel && analysis.totalAllocated > 0 && (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertTitle>Allocations Will Be Released</AlertTitle>
              <AlertDescription>
                {analysis.totalAllocated} pcs are currently allocated from FG stock. These allocations will be released
                and the stock will become available again.
              </AlertDescription>
            </Alert>
          )}

          {/* No Issues */}
          {analysis.canCancel && analysis.totalAllocated === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Confirm Cancellation</AlertTitle>
              <AlertDescription>
                This action cannot be undone. The sale order will be marked as cancelled.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{analysis.canCancel ? 'Keep Order' : 'Close'}</AlertDialogCancel>
          {analysis.canCancel && (
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Cancelling...' : 'Cancel Order'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CancelOrderDialog;
