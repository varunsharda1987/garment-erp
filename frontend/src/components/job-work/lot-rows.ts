/**
 * Greige lot rows — the RULES half — "which lots leave the building, and how much of each".
 *
 * Extracted from the job work order issue dialog so the consolidated dispatch screen can show
 * the SAME control once per order. Keeping one implementation matters: the rules encoded here
 * (quantities must total the order, no lot twice, one cloth per order, width acknowledgement)
 * are the client-side half of guards the server enforces, and two copies would drift into two
 * different ideas of what a valid issue looks like.
 */
import type { GreigeStockDetail, JwoIssuePreviewLot } from '@/services/jobWorkOrder.service';
import { QTY_EPSILON, isQtyZero, minQty, prefillQty, qtyExceeds, qtyRemaining } from '@/lib/quantity';

/** One selected than/bale for detail-level issuance. */
export interface SelectedDetail {
  detailId: string;
  /** Kept as the raw input string so the field can be cleared mid-edit without snapping to 0 */
  metersToIssue: string;
}

/** One editable line: which lot, and how much of it leaves the building. */
export interface IssueLotRow {
  lotId: string;
  /** Kept as the raw input string so the field can be cleared mid-edit without snapping to 0 */
  qty: string;
  /** For detail-level issuance: available details loaded from the API */
  availableDetails?: GreigeStockDetail[];
  /** For detail-level issuance: selected details with meters to issue */
  selectedDetails?: SelectedDetail[];
  /** Whether the detail picker is expanded */
  detailsExpanded?: boolean;
}

/** Pins a value to 2dp — for DISPLAY only; quantities are compared through `@/lib/quantity`. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sums of typed values are pinned to 3dp (the finest storage step) — never 2dp, which would
 * re-round an exact 3-decimal pre-fill and leave dust against the limit.
 */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Slack when matching lot totals to the order quantity: the project's one quantity tolerance. */
export const ISSUE_QTY_TOLERANCE = QTY_EPSILON;

/** Nominal greige width varies loom to loom — mirrors WIDTH_TOLERANCE_INCHES on the server. */
export const ISSUE_WIDTH_TOLERANCE_INCHES = 1.0;

export const emptyLotRow = (): IssueLotRow => ({ lotId: '', qty: '' });

export interface LotRowsEvaluation {
  chosenLotIds: string[];
  totalQty: number;
  /** signed: negative is short of the order, positive is over */
  qtyDelta: number;
  totalMatches: boolean;
  hasDuplicateLot: boolean;
  /** One order mints ONE finished fabric, so its lots must all be the same cloth. */
  hasMixedGreige: boolean;
  rowsComplete: boolean;
  noLotChosen: boolean;
  unusedLotCount: number;
  widthMismatchLots: JwoIssuePreviewLot[];
  needsWidthAck: boolean;
}

export interface EvaluateLotRowsInput {
  rows: IssueLotRow[];
  lots: JwoIssuePreviewLot[];
  requiredQty: number;
  /** Greige width the order expects, when it has one. */
  orderWidthInches?: number | null;
}

/**
 * Everything derivable from the current rows — pure, so a screen showing many orders can evaluate
 * each one independently without a hook per order.
 */
export function evaluateLotRows({
  rows,
  lots,
  requiredQty,
  orderWidthInches,
}: EvaluateLotRowsInput): LotRowsEvaluation {
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const chosenLotIds = rows.map((row) => row.lotId).filter(Boolean);
  const totalQty = round3(rows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0));
  const qtyDelta = round3(totalQty - requiredQty);
  const chosenGreigeIds = new Set(chosenLotIds.map((id) => lotById.get(id)?.greigeId).filter(Boolean));

  const width = orderWidthInches != null ? Number(orderWidthInches) : null;
  const widthMismatchLots =
    width == null
      ? []
      : chosenLotIds
          .map((id) => lotById.get(id))
          .filter(
            (lot): lot is JwoIssuePreviewLot =>
              !!lot && lot.greigeWidth != null && Math.abs(lot.greigeWidth - width) > ISSUE_WIDTH_TOLERANCE_INCHES
          );

  return {
    chosenLotIds,
    totalQty,
    qtyDelta,
    totalMatches: !qtyExceeds(totalQty, requiredQty) && !qtyExceeds(requiredQty, totalQty),
    hasDuplicateLot: new Set(chosenLotIds).size !== chosenLotIds.length,
    hasMixedGreige: chosenGreigeIds.size > 1,
    rowsComplete: rows.length > 0 && rows.every((row) => row.lotId && qtyExceeds(parseFloat(row.qty) || 0, 0)),
    noLotChosen: chosenLotIds.length === 0,
    unusedLotCount: lots.filter((lot) => !chosenLotIds.includes(lot.id)).length,
    widthMismatchLots,
    needsWidthAck: widthMismatchLots.length > 0,
  };
}

/**
 * Greedy largest-first fill. Lots arrive sorted quantity-desc, so taking from the top covers the
 * order in the fewest lots — the least paperwork at the gate. Anchored to whatever greige is
 * already chosen (else the largest lot's), because rows may not mix cloths.
 */
export function autoFillLotRows(
  lots: JwoIssuePreviewLot[],
  requiredQty: number,
  currentRows: IssueLotRow[]
): IssueLotRow[] | null {
  if (lots.length === 0) return null;
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const anchorGreigeId =
    currentRows
      .map((row) => row.lotId)
      .filter(Boolean)
      .map((id) => lotById.get(id)?.greigeId)
      .find(Boolean) ?? lots[0].greigeId;

  let remaining = qtyRemaining(requiredQty, 0);
  const filled: IssueLotRow[] = [];
  for (const lot of lots) {
    if (isQtyZero(remaining)) break;
    if (lot.greigeId !== anchorGreigeId) continue;
    // Exact value, never rounded: toFixed(2) could round a take up past the lot's availability
    const take = minQty(lot.quantityAvailable, remaining);
    if (isQtyZero(take) || take < 0) continue;
    filled.push({ lotId: lot.id, qty: prefillQty(take) });
    remaining = qtyRemaining(remaining, take);
  }
  return filled.length > 0 ? filled : null;
}

/**
 * Calculate the total meters from selected details.
 */
export function totalDetailMeters(selectedDetails?: SelectedDetail[]): number {
  if (!selectedDetails) return 0;
  return round3(selectedDetails.reduce((sum, d) => sum + (parseFloat(d.metersToIssue) || 0), 0));
}

/**
 * Check if any detail selection exceeds available meters.
 */
export function hasDetailOverSelection(
  selectedDetails: SelectedDetail[] | undefined,
  availableDetails: GreigeStockDetail[] | undefined
): { detailId: string; over: number }[] {
  if (!selectedDetails || !availableDetails) return [];
  const detailById = new Map(availableDetails.map((d) => [d.id, d]));
  return selectedDetails
    .map((sel) => {
      const detail = detailById.get(sel.detailId);
      if (!detail) return null;
      const requested = parseFloat(sel.metersToIssue) || 0;
      if (qtyExceeds(requested, detail.metersRemaining)) {
        return { detailId: sel.detailId, over: round3(requested - detail.metersRemaining) };
      }
      return null;
    })
    .filter((x): x is { detailId: string; over: number } => x !== null);
}

/**
 * Group details by bale number for display.
 */
export function groupDetailsByBale(
  details: GreigeStockDetail[]
): Array<{ baleNumber: number | null; thans: GreigeStockDetail[] }> {
  const groups = new Map<number | null, GreigeStockDetail[]>();
  for (const detail of details) {
    const bale = detail.baleNumber;
    if (!groups.has(bale)) groups.set(bale, []);
    groups.get(bale)!.push(detail);
  }
  // Sort by bale number (unbaled thans first as null, then numbered)
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === null) return -1;
      if (b === null) return 1;
      return a - b;
    })
    .map(([baleNumber, thans]) => ({ baleNumber, thans }));
}
