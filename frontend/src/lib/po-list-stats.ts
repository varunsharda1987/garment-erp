/**
 * The Purchase Orders list's count cards and tab badges, from GET /purchase-orders/stats.
 *
 * The stats are keyed by the enum VALUE as stored — `{ byCategory: { GREIGE: 12 }, byStatus: { SENT: 2 } }` —
 * because the response serializer leaves SCREAMING_CASE keys alone. Until 2026-09-27 the page "un-camelized"
 * them first, which turned SENT into S_E_N_T, so every card and badge read 0 beside a table of 13 POs.
 * Read the keys directly.
 */
import { PO_GROUP_CATEGORIES, type POStats } from '@/types/purchaseOrder.types';

/** Still with us: a draft is edited, sent or deleted. */
export const PENDING_ACTION_STATUSES = ['DRAFT'] as const;

/** Sent to the supplier and not fully received. */
export const AWAITING_DELIVERY_STATUSES = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] as const;

export interface POListSummary {
  /** Material POs of every status — the "Total POs" card and both tab badges (the list is material-only) */
  materialPOs: number;
  pendingAction: number;
  awaitingDelivery: number;
  totalValue: number;
}

const countOf = (record: Record<string, number> | undefined, keys: readonly string[]) =>
  keys.reduce((sum, key) => sum + (Number(record?.[key]) || 0), 0);

/** The card and badge figures; all zero until the stats have loaded. */
export function summarizePOStats(stats: POStats | null | undefined): POListSummary {
  return {
    materialPOs: countOf(stats?.byCategory, PO_GROUP_CATEGORIES.material),
    pendingAction: countOf(stats?.byStatus, PENDING_ACTION_STATUSES),
    awaitingDelivery: countOf(stats?.byStatus, AWAITING_DELIVERY_STATUSES),
    totalValue: Number(stats?.totalValue) || 0,
  };
}
