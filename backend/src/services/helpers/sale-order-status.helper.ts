/**
 * Sale-order status helper — the single authority for sale_orders.status PROGRESS states
 * (data-ownership landmine №2, fixed 2026-08-24).
 *
 * The status column carries two different kinds of fact:
 *   - COMMERCIAL/TERMINAL states, written only by explicit business events:
 *       DRAFT (creation), CONFIRMED (confirm endpoint), CANCELLED (cancel endpoint),
 *       DELIVERED (POD delivery confirmation).
 *   - PROGRESS states, DERIVED from the item quantities and never written by hand:
 *       PARTIALLY_ALLOCATED / FULLY_ALLOCATED (from allocatedQty),
 *       PARTIALLY_DISPATCHED / DISPATCHED (from dispatchedQty).
 *
 * Before this helper, allocation flows overwrote the status from allocation facts alone,
 * so releasing reserved stock on a partly-shipped order flipped the buyer-facing badge
 * (read live by the House of Kasya B2B app — docs/B2B_INTEGRATION_GUIDE.md §4) back to
 * CONFIRMED, after which the POD path could never reach DELIVERED. Owner rule 2026-08-24:
 * dispatch facts rank ABOVE allocation facts — releasing stock can never step a dispatch
 * badge backward. Dispatch progress steps back only when dispatchedQty itself is reduced
 * (a rejected/returned delivery — a real physical event).
 *
 * Call recomputeSaleOrderStatus after EVERY change to sale_order_items.allocatedQty or
 * dispatchedQty. Never write a progress status directly; event writers (confirm, cancel,
 * DELIVERED) carry an `allow-sale-order-status` marker for the smart-check.
 */

import { Prisma, PrismaClient, SaleOrderStatus } from '@prisma/client';
import { logInfo } from '../../utils/logger';

type DbClient = Prisma.TransactionClient | PrismaClient;

/** Commercial/terminal states the recompute must never overwrite. */
export const SALE_ORDER_PINNED_STATUSES: SaleOrderStatus[] = ['DRAFT', 'CANCELLED', 'DELIVERED'];

export interface SaleOrderItemFacts {
  quantity: number;
  allocatedQty: number;
  dispatchedQty: number;
}

/**
 * Pure derivation — dispatch facts outrank allocation facts. Per-item (not aggregate):
 * an over-dispatch on one item must not mask a shortfall on another.
 */
export function deriveSaleOrderProgress(items: SaleOrderItemFacts[]): SaleOrderStatus {
  if (items.length === 0) return 'CONFIRMED';
  if (items.every((i) => i.dispatchedQty >= i.quantity)) return 'DISPATCHED';
  if (items.some((i) => i.dispatchedQty > 0)) return 'PARTIALLY_DISPATCHED';
  if (items.every((i) => i.allocatedQty >= i.quantity)) return 'FULLY_ALLOCATED';
  if (items.some((i) => i.allocatedQty > 0)) return 'PARTIALLY_ALLOCATED';
  return 'CONFIRMED';
}

/**
 * Recompute and persist the progress status from the order's items. Returns the derived
 * status (or the pinned status when the order is DRAFT/CANCELLED/DELIVERED), null when
 * the order no longer exists. Pass the caller's tx so the recompute commits atomically
 * with the quantity change.
 */
export async function recomputeSaleOrderStatus(client: DbClient, saleOrderId: string): Promise<SaleOrderStatus | null> {
  const so = await client.sale_orders.findUnique({
    where: { id: saleOrderId },
    select: { status: true },
  });
  if (!so) return null;
  if (SALE_ORDER_PINNED_STATUSES.includes(so.status)) return so.status;

  const items = await client.sale_order_items.findMany({
    where: { saleOrderId },
    select: { quantity: true, allocatedQty: true, dispatchedQty: true },
  });
  const derived = deriveSaleOrderProgress(items);

  if (derived !== so.status) {
    // Guarded write: a concurrent cancel/deliver wins — the pin is re-checked in the WHERE.
    await client.sale_orders.updateMany({
      where: { id: saleOrderId, status: { notIn: SALE_ORDER_PINNED_STATUSES } },
      data: { status: derived }, // allow-sale-order-status: the recompute authority itself
    });
    logInfo(`[SaleOrderStatus] ${saleOrderId} status ${so.status} -> ${derived}`);
  }
  return derived;
}
