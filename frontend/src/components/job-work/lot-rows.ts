/**
 * Greige lot rows — the RULES half — "which lots leave the building, and how much of each".
 *
 * Extracted from the job work order issue dialog so the consolidated dispatch screen can show
 * the SAME control once per order. Keeping one implementation matters: the rules encoded here
 * (quantities must total the order, no lot twice, one cloth per order, width acknowledgement)
 * are the client-side half of guards the server enforces, and two copies would drift into two
 * different ideas of what a valid issue looks like.
 */
import type {
  GreigeLotThans,
  GreigeStockDetail,
  IssueDetailInput,
  JwoIssuePreviewLot,
} from '@/services/jobWorkOrder.service';
import { foldActual, foldCounted } from '@/lib/fold-length';
import { QTY_EPSILON, isQtyZero, minQty, prefillQty, qtyAtLeast, qtyExceeds, qtyRemaining } from '@/lib/quantity';

/** One picked than. `metersToIssue` is COUNTED (tag) metres at the lot's fold length. */
export interface SelectedDetail {
  detailId: string;
  /** Kept as the raw input string so the field can be cleared mid-edit without snapping to 0 */
  metersToIssue: string;
}

/** One editable line: which lot, and how much of it leaves the building. */
export interface IssueLotRow {
  lotId: string;
  /**
   * ACTUAL metres — what the lot and the job are measured in. Kept as the raw input string so the
   * field can be cleared mid-edit without snapping to 0. When thans are picked it is DERIVED from
   * them (the picks' counted metres converted at the lot's fold length), never typed.
   */
  qty: string;
  /** The lot's thans still in the godown (loaded when the lot is chosen, on screens that pick thans) */
  lotThans?: GreigeLotThans;
  /** The thans picked to leave, in COUNTED metres. Empty / undefined = issue by quantity only */
  selectedDetails?: SelectedDetail[];
  /** Whether the than picker is open */
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
  /** A picked than is blank / zero or asks for more counted metres than the than has left */
  hasThanErrors: boolean;
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
    hasThanErrors: rows.some((row) => rowThanErrors(row)),
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

/** Sum of the picked thans' COUNTED metres. */
export function totalDetailMeters(selectedDetails?: SelectedDetail[]): number {
  if (!selectedDetails) return 0;
  return round3(selectedDetails.reduce((sum, d) => sum + (parseFloat(d.metersToIssue) || 0), 0));
}

/** Mirrors THAN_ROUNDING_SLACK_M on the server: taking every than empties the lot within this. */
const THAN_ROUNDING_SLACK_M = 0.1;

/**
 * The ACTUAL metres a set of picked thans takes out of the lot — the same rule the server applies
 * (greige-stock.service `thanPickActualQty`): the picks' counted total converted ONCE at the lot's
 * fold length; and when every remaining than is taken whole, the lot's own availability, so
 * rounding never strands a sliver.
 */
export function thanPickActual(
  selectedDetails: SelectedDetail[] | undefined,
  lotThans: GreigeLotThans | undefined,
  /** false when the lot's stock already left (recording thans after the fact): no snap to the lot */
  snapToLot = true
): number {
  const counted = totalDetailMeters(selectedDetails);
  let actual = foldActual(counted, lotThans?.foldLengthCm);
  if (snapToLot && lotThans && selectedDetails && lotThans.details.length > 0) {
    const picked = new Map(selectedDetails.map((d) => [d.detailId, parseFloat(d.metersToIssue) || 0]));
    const emptiesEveryThan = lotThans.details.every((t) => {
      const qty = picked.get(t.id);
      return qty != null && qtyAtLeast(qty, t.metersRemaining);
    });
    if (emptiesEveryThan && Math.abs(lotThans.totalAvailable - actual) <= THAN_ROUNDING_SLACK_M) {
      actual = lotThans.totalAvailable;
    }
  }
  return actual;
}

/** True when the row names thans. */
export function rowHasPicks(row: IssueLotRow): boolean {
  return (row.selectedDetails?.length ?? 0) > 0;
}

/** True when the chosen lot carries a than breakdown (so its thans can — and should — be picked). */
export function lotHasThans(row: IssueLotRow): boolean {
  return (row.lotThans?.details.length ?? 0) > 0;
}

/** The row with new picks, its ACTUAL quantity re-derived from them. */
export function withPicks(row: IssueLotRow, selectedDetails: SelectedDetail[]): IssueLotRow {
  if (selectedDetails.length === 0) return { ...row, selectedDetails: [] };
  return { ...row, selectedDetails, qty: prefillQty(thanPickActual(selectedDetails, row.lotThans)) };
}

/** The picks as the API takes them (COUNTED metres; blank / zero picks dropped). */
export function picksPayload(selectedDetails: SelectedDetail[] | undefined): IssueDetailInput[] {
  return (selectedDetails ?? [])
    .map((d) => ({ greigeStockDetailId: d.detailId, metersToIssue: parseFloat(d.metersToIssue) || 0 }))
    .filter((d) => !isQtyZero(d.metersToIssue));
}

/**
 * Any picked than asking for more COUNTED metres than it has left (counted vs counted).
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

/** A picked than left blank / at zero, or over what the than has left. */
export function thanPickErrors(
  selectedDetails: SelectedDetail[] | undefined,
  lotThans: GreigeLotThans | undefined
): boolean {
  if (!selectedDetails || selectedDetails.length === 0) return false;
  if (selectedDetails.some((d) => isQtyZero(parseFloat(d.metersToIssue) || 0))) return true;
  return hasDetailOverSelection(selectedDetails, lotThans?.details).length > 0;
}

function rowThanErrors(row: IssueLotRow): boolean {
  return thanPickErrors(row.selectedDetails, row.lotThans);
}

/**
 * Group thans by bale for display — bale 1, 2, 3… then any than received outside a bale. The same
 * order the server lists them in, and the order "Pick thans for me" takes them.
 */
export function groupDetailsByBale(
  details: GreigeStockDetail[]
): Array<{ baleNumber: number | null; baleLabel: string | null; thans: GreigeStockDetail[] }> {
  const groups = new Map<number | null, GreigeStockDetail[]>();
  for (const detail of details) {
    const bale = detail.baleNumber;
    if (!groups.has(bale)) groups.set(bale, []);
    groups.get(bale)!.push(detail);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    })
    .map(([baleNumber, thans]) => {
      const sorted = [...thans].sort((x, y) => x.sequenceNo - y.sequenceNo);
      const printed = sorted.find((t) => t.baleNo)?.baleNo ?? null;
      return {
        baleNumber,
        baleLabel: printed ?? (baleNumber != null ? String(baleNumber) : null),
        thans: sorted,
      };
    });
}

/** "Bale 3 · T27" — the printed bale / than tag when entered at receipt, else the internal numbers. */
export function thanLabel(detail: GreigeStockDetail): string {
  const bale = detail.baleNo ?? (detail.baleNumber != null ? String(detail.baleNumber) : '—');
  return `Bale ${bale} · T${detail.thanNo ?? detail.sequenceNo}`;
}

/** Number of distinct bales among the thans still in the godown. */
export function baleCountOf(lotThans: GreigeLotThans): number {
  return new Set(lotThans.details.map((d) => d.baleNumber)).size;
}

/**
 * "Pick thans for me": whole thans in bale / sequence order until `targetActual` ACTUAL metres are
 * covered, the last than partial.
 *
 * The target is converted to COUNTED metres once, through the fold-length helper (actual ÷ L/100,
 * 2 dp) — the same single conversion the server applies to the picks' total, and exact: converting
 * that counted figure back lands on the (2 dp) target. The last than takes the counted metres still
 * needed, never more than that than has left. If the lot cannot cover the target, every than is
 * picked.
 */
export function autoPickThans(lotThans: GreigeLotThans, targetActual: number): SelectedDetail[] {
  if (isQtyZero(targetActual) || targetActual < 0) return [];
  let neededCounted = foldCounted(targetActual, lotThans.foldLengthCm);
  const picks: SelectedDetail[] = [];
  for (const group of groupDetailsByBale(lotThans.details)) {
    for (const than of group.thans) {
      if (isQtyZero(neededCounted)) return picks;
      if (isQtyZero(than.metersRemaining)) continue;
      // Within rounding dust of the whole than IS the whole than
      const take = qtyAtLeast(neededCounted, than.metersRemaining)
        ? than.metersRemaining
        : minQty(round3(neededCounted), than.metersRemaining);
      picks.push({ detailId: than.id, metersToIssue: prefillQty(take) });
      neededCounted = qtyRemaining(neededCounted, take);
    }
  }
  return picks;
}
