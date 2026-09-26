/**
 * The PO list's cards and tab badges read the stats' enum keys as the API sends them. Until 2026-09-27 the
 * page rewrote SENT → S_E_N_T first, so every card and badge read 0 beside a table of 13 POs.
 */
import { describe, it, expect } from 'vitest';
import { summarizePOStats } from '../po-list-stats';
import type { POStats } from '@/types/purchaseOrder.types';

// GET /api/purchase-orders/stats on the live system, 2026-09-26 (scratchpad v_stats.json)
const LIVE: POStats = {
  bySource: { MANUAL: 13 },
  byCategory: { GREIGE: 12, TRIMS: 1 },
  byStatus: { SENT: 2, RECEIVED: 10, CANCELLED: 1 },
  totalValue: 5394815.06,
};

describe('summarizePOStats', () => {
  it('counts the real payload: 13 POs, 2 awaiting delivery, none pending', () => {
    expect(summarizePOStats(LIVE)).toEqual({
      materialPOs: 13,
      pendingAction: 0,
      awaitingDelivery: 2,
      totalValue: 5394815.06,
    });
  });

  it('pending action is drafts only — the retired processing statuses no longer count', () => {
    const s = summarizePOStats({
      ...LIVE,
      byStatus: { DRAFT: 3, PENDING_GREIGE: 4, READY_FOR_PROCESSING: 5, ACKNOWLEDGED: 1, PARTIALLY_RECEIVED: 2 },
    });
    expect(s.pendingAction).toBe(3);
    expect(s.awaitingDelivery).toBe(3);
  });

  it('counts every material category (THREAD included) and no deprecated processing/service category', () => {
    const s = summarizePOStats({
      ...LIVE,
      byCategory: { GREIGE: 1, FABRIC: 1, TRIMS: 1, THREAD: 1, LACE: 1, GREIGE_LACE: 1, GENERAL: 1, PROCESSING: 9 },
    });
    expect(s.materialPOs).toBe(7);
  });

  it('is all zeros before the stats load, and survives a missing record', () => {
    const zero = { materialPOs: 0, pendingAction: 0, awaitingDelivery: 0, totalValue: 0 };
    expect(summarizePOStats(undefined)).toEqual(zero);
    expect(summarizePOStats({ totalValue: 0 } as unknown as POStats)).toEqual(zero);
  });
});
