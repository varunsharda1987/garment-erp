/**
 * Which greige rate the Fabric Costing grid shows, and what it is labelled.
 *
 * The price sources are resolved LIVE by the API — the newest placed greige PO or receipt (purchase
 * or priced stock lot), else the Greige Master default (backend greige-live-rate.helper, the one
 * lookup every screen shares). The rate stored on the CAD row is deliberately NOT one of them — it
 * is the number a finished costing was committed at.
 *
 * Rules:
 *   - A row that has never been costed shows the live rate, so a new GRN takes effect at once.
 *     (Rows used to display a CAD Planning snapshot taken months earlier — nine live rows were
 *     stuck at a December price while the fabric had been repurchased in August.)
 *   - A costed row keeps its committed number and is labelled "committed" — or "manual" with its
 *     reason when it was saved as a typed rate (MANUAL_OVERRIDE). The live rate travels alongside
 *     so the page can offer it without ever applying it silently.
 *   - A typed rate that departs from the live one needs a reason; the save refuses without it.
 *
 * `??` is used throughout rather than `||`: a genuine ₹0 must not fall through to the next source.
 */

import type { FabricForCosting, GreigeCostSource, LiveGreigeCostSource } from '../types/fabricCosting.types';
import { formatDate } from '@/lib/date';

/** Money equality at paise resolution — these are Decimal(10,2) round-trips. */
export function sameRate(a: number | null, b: number | null): boolean {
  return a != null && b != null && Math.abs(a - b) < 0.005;
}

export interface ResolvedGreigeRate {
  greigeCostPerMeter: number | null;
  greigeCostSource: GreigeCostSource | null;
  liveGreigeCostPerMeter: number | null;
  liveGreigeCostSource: LiveGreigeCostSource | null;
  liveGreigeCostSourceDate: string | null;
  liveGreigeCostSourceSupplier: string | null;
  liveGreigeCostSourceRef: string | null;
  /** The reason a saved manual rate carries (null for any other label) */
  greigeRateOverrideReason: string | null;
}

/**
 * @param isCosted whether this row already carries a completed costing
 *                 (`fabric.totalCostPerMeter != null`) — NOT whether it has a saved greige rate,
 *                 since CAD Planning stamps that onto uncosted rows too.
 */
export function resolveGreigeCost(fabric: FabricForCosting, isCosted: boolean): ResolvedGreigeRate {
  const live = fabric.greigeCostPerMeter ?? null;
  // A source without a rate is meaningless — guard so a null rate never carries a label.
  const liveSource: LiveGreigeCostSource | null = live == null ? null : (fabric.greigeCostSource ?? null);
  const committed = fabric.greigeCostPerMeterSaved ?? null;

  const liveInfo = {
    liveGreigeCostPerMeter: live,
    liveGreigeCostSource: liveSource,
    liveGreigeCostSourceDate: live == null ? null : (fabric.greigeCostSourceDate ?? null),
    liveGreigeCostSourceSupplier: live == null ? null : (fabric.greigeCostSourceSupplier ?? null),
    liveGreigeCostSourceRef: live == null ? null : (fabric.greigeCostSourceRef ?? null),
    greigeRateOverrideReason: null,
  };

  // 1. A finished costing keeps the rate it was priced at. Labelled by what it demonstrably is:
  //    if it still equals the live rate there is nothing to flag, so name the live source.
  if (isCosted && committed != null) {
    // Saved as a typed rate: it stays "manual", with the reason given for it
    if (fabric.savedGreigeRateSource === 'MANUAL_OVERRIDE' && !sameRate(committed, live)) {
      return {
        ...liveInfo,
        greigeCostPerMeter: committed,
        greigeCostSource: 'MANUAL',
        greigeRateOverrideReason: fabric.savedGreigeRateReason ?? null,
      };
    }
    return {
      ...liveInfo,
      greigeCostPerMeter: committed,
      greigeCostSource: sameRate(committed, live) && liveSource ? liveSource : 'COMMITTED',
    };
  }

  // 2. Never costed → today's rate.
  if (live != null) {
    return { ...liveInfo, greigeCostPerMeter: live, greigeCostSource: liveSource };
  }

  // 3. No live rate. Fall back to whatever this row already carries rather than blanking a
  //    number the user can see today.
  if (committed != null) {
    return { ...liveInfo, greigeCostPerMeter: committed, greigeCostSource: 'COMMITTED' };
  }

  // 4. Nothing anywhere: empty cell with NO label. The page used to render "default" here over
  //    an empty box, for a Greige Master default that was never set.
  const master = fabric.greigeDefaultCost ?? null;
  return {
    ...liveInfo,
    greigeCostPerMeter: master,
    greigeCostSource: master != null ? 'GREIGE_MASTER' : null,
  };
}

/** The displayed rate differs from today's — either a committed costing or a hand-typed value. */
export function isGreigeRateStale(row: {
  greigeCostPerMeter: number | null;
  liveGreigeCostPerMeter: number | null;
}): boolean {
  return (
    row.liveGreigeCostPerMeter != null &&
    row.greigeCostPerMeter != null &&
    !sameRate(row.greigeCostPerMeter, row.liveGreigeCostPerMeter)
  );
}

const LIVE_SOURCE_TEXT: Record<LiveGreigeCostSource, string> = {
  PURCHASE_ORDER: 'from PO',
  // A fabric_procurement purchase — not a GRN, which this label used to claim
  PROCUREMENT: 'from purchase',
  STOCK_VALUATION: 'from stock',
  GREIGE_MASTER: 'default',
};

/** The document named first on the live-rate line */
const LIVE_SOURCE_NOUN: Record<LiveGreigeCostSource, string> = {
  PURCHASE_ORDER: 'PO',
  PROCUREMENT: 'purchase',
  STOCK_VALUATION: 'stock lot',
  GREIGE_MASTER: 'Greige Master default',
};

/** Short label under the input, e.g. "from GRN". */
export function greigeSourceLabel(source: GreigeCostSource | null): string | null {
  if (source == null) return null;
  if (source === 'MANUAL') return 'manual';
  if (source === 'COMMITTED') return 'committed';
  return LIVE_SOURCE_TEXT[source];
}

/** "PO2609-0004 · Hardik International · 21-Sep-2026" (or "purchase · Bhuval · 20-Aug-2026") for the live-rate line. */
export function describeLiveRate(row: {
  liveGreigeCostPerMeter: number | null;
  liveGreigeCostSource: LiveGreigeCostSource | null;
  liveGreigeCostSourceDate: string | null;
  liveGreigeCostSourceSupplier: string | null;
  liveGreigeCostSourceRef?: string | null;
}): string | null {
  if (row.liveGreigeCostPerMeter == null) return null;
  const source = row.liveGreigeCostSource;
  const parts = [
    source === 'PURCHASE_ORDER' && row.liveGreigeCostSourceRef
      ? row.liveGreigeCostSourceRef
      : source
        ? LIVE_SOURCE_NOUN[source]
        : null,
  ];
  if (row.liveGreigeCostSourceSupplier) parts.push(row.liveGreigeCostSourceSupplier);
  if (row.liveGreigeCostSourceDate) {
    const d = new Date(row.liveGreigeCostSourceDate);
    if (!isNaN(d.getTime())) parts.push(formatDate(d));
  }
  return parts.filter(Boolean).join(' · ');
}

/** A typed rate that departs from today's needs a reason before the save will take it. */
export function needsGreigeReason(row: {
  greigeCostPerMeter: number | null;
  liveGreigeCostPerMeter: number | null;
  greigeCostSource: GreigeCostSource | null;
  greigeRateOverrideReason: string | null;
}): boolean {
  return (
    row.greigeCostSource === 'MANUAL' &&
    isGreigeRateStale(row) &&
    (row.greigeRateOverrideReason?.trim().length ?? 0) < 3
  );
}
