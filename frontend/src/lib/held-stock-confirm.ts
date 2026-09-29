/**
 * Goods held for another order (owner decision D10, docs/plans/po-allocation-design.md).
 *
 * Goods that arrived on a PO line linked to an order are held for that order. An issue screen (challan,
 * job-work issue, work-order issue) that would take them is refused with STOCK_HELD_FOR_ORDER and a list of
 * who holds them. It is a warning, not a wall: the user may take them anyway after confirming, and the screen
 * sends the same request again with `takeHeld: true`. The order that loses them gets its need back, to be
 * bought again.
 *
 * This file reads the refusal and words the question; `useHeldStockConfirm` (hooks/useHeldStockConfirm.tsx)
 * asks it and retries. Every gate builds the refusal with the backend's `heldStockConflict`
 * (services/helpers/po-allocation.helper.ts): details `{ code, heldFor: HeldForEntry[] }`.
 */
import { formatQuantity } from '@/lib/formatters';
import { styleCodeLabel } from '@/lib/style-code';

export const STOCK_HELD_FOR_ORDER = 'STOCK_HELD_FOR_ORDER';

export interface HeldForEntry {
  orderNumber: string | null;
  styleCode: string | null;
  /** The style's buyer style code, named first when the server sends it (older servers do not) */
  buyerStyleRef?: string | null;
  qty: number;
  /** When the server names it; otherwise the caller's unit is used */
  unit?: string | null;
  requirementNumber?: string | null;
}

export interface HeldStockRefusal {
  /** The server's message */
  message: string;
  heldFor: HeldForEntry[];
}

/**
 * The refusal, or null when the error is anything else. Read before getErrorMessage(), which would print the
 * object `details` as "Code: STOCK_HELD_FOR_ORDER" (see lib/rate-slab-change.ts).
 */
export function extractHeldStock(error: unknown): HeldStockRefusal | null {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: {
          message?: string;
          code?: string;
          heldFor?: unknown;
          details?: { code?: string; heldFor?: unknown };
        };
      };
    }
  )?.response;
  if (response?.status !== 409 && response?.status !== 422) return null;
  const data = response.data;
  const code = data?.details?.code ?? data?.code;
  if (code !== STOCK_HELD_FOR_ORDER) return null;
  const raw = data?.details?.heldFor ?? data?.heldFor;
  const heldFor = (Array.isArray(raw) ? raw : [])
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
    .map((h) => ({
      orderNumber: typeof h.orderNumber === 'string' ? h.orderNumber : null,
      styleCode: typeof h.styleCode === 'string' ? h.styleCode : null,
      buyerStyleRef: typeof h.buyerStyleRef === 'string' ? h.buyerStyleRef : null,
      qty: Number(h.qty ?? 0),
      unit: typeof h.unit === 'string' ? h.unit : null,
      requirementNumber: typeof h.requirementNumber === 'string' ? h.requirementNumber : null,
    }));
  return { message: data?.message ?? 'These goods are held for another order.', heldFor };
}

/** "Held for ORD2026080025 · EB-77 (ESSKY085LS): 300 pcs" — the style by its Buyer Style Code first */
export function heldForLine(entry: HeldForEntry, unit?: string | null): string {
  const who = entry.orderNumber ?? entry.requirementNumber ?? 'another order';
  const label = styleCodeLabel({ styleCode: entry.styleCode, buyerStyleRef: entry.buyerStyleRef }, null, '');
  const style = label ? ` · ${label}` : '';
  return `Held for ${who}${style}: ${formatQuantity(entry.qty, entry.unit ?? unit ?? null, 3)}`;
}

/** The question under the list — one order or several */
export function heldStockQuestion(refusal: HeldStockRefusal): string {
  const orders = new Set(refusal.heldFor.map((h) => h.orderNumber ?? h.requirementNumber ?? ''));
  return orders.size > 1
    ? 'Take them anyway? Those orders will need them bought again.'
    : 'Take them anyway? That order will need them bought again.';
}
