import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmDialog from '@/components/ConfirmDialog';
import { createFromCostSheet } from '@/services/orderBom.service';
import { queryKeys } from '@/hooks/useQuery';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { extractRateSlabChange } from '@/lib/rate-slab-change';

export interface CreateBomTarget {
  orderId: string;
  styleId: string;
  orderItemId?: string;
}

/**
 * ONE "Create BOM" for the Orders list and the order page. It used to be written twice: the order
 * page's copy could not accept a rate-slab change, and each copy picked the cost sheet with its own
 * filter (retired purposes, superseded versions). The server now picks the sheet; this hook only
 * sends the order line and, on RATE_SLAB_CHANGED, asks and re-sends with the acceptance.
 *
 * Render `dialog` once on the page.
 */
export function useCreateOrderBom() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null);
  const [slabPrompt, setSlabPrompt] = useState<{ target: CreateBomTarget; message: string } | null>(null);

  const createBom = async (target: CreateBomTarget, acceptRateChanges = false) => {
    setCreatingOrderId(target.orderId);
    try {
      const bom = await createFromCostSheet(target.orderId, {
        styleId: target.styleId,
        orderItemId: target.orderItemId,
        acceptRateChanges,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.boms.all });
      handleApiSuccess('BOM Created', 'BOM created successfully. Redirecting to review...');
      navigate(`/order-bom/${bom.id}`);
    } catch (err) {
      const slabMessage = extractRateSlabChange(err);
      if (slabMessage && !acceptRateChanges) {
        // Order-quantity rate-slab change (qty-rate audit 2026-08-24): show the diff, retry with
        // acceptance — the accepted rates apply to THIS order's BOM only.
        setSlabPrompt({ target, message: slabMessage });
      } else {
        handleApiError(err, 'Failed to create BOM');
      }
    } finally {
      setCreatingOrderId(null);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={slabPrompt != null}
      onOpenChange={(open) => {
        if (!open) setSlabPrompt(null);
      }}
      title="Processor rate differs at this order quantity"
      description={slabPrompt?.message ?? ''}
      confirmText="Accept order-quantity rates"
      cancelText="Cancel"
      onConfirm={() => {
        const target = slabPrompt?.target;
        setSlabPrompt(null);
        if (target) void createBom(target, true);
      }}
      variant="default"
    />
  );

  return { createBom, creatingOrderId, dialog };
}
