/**
 * Greige lot rows — the RULES half — "which lots leave the building, and how much of each".
 *
 * Extracted from the job work order issue dialog so the consolidated dispatch screen can show
 * the SAME control once per order. Keeping one implementation matters: the rules encoded here
 * (quantities must total the order, no lot twice, one cloth per order, width acknowledgement)
 * are the client-side half of guards the server enforces, and two copies would drift into two
 * different ideas of what a valid issue looks like.
 */
import type { JwoIssuePreviewLot } from '@/services/jobWorkOrder.service';

/** One editable line: which lot, and how much of it leaves the building. */
export interface IssueLotRow {
  lotId: string;
  /** Kept as the raw input string so the field can be cleared mid-edit without snapping to 0 */
  qty: string;
}

/** Metres are quoted to 2dp everywhere; sums of typed values must be pinned there before comparing. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The server's own slack when matching lot totals to the order quantity. */
export const ISSUE_QTY_TOLERANCE = 0.01;

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
  const totalQty = round2(rows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0));
  const qtyDelta = round2(totalQty - requiredQty);
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
    totalMatches: Math.abs(qtyDelta) <= ISSUE_QTY_TOLERANCE,
    hasDuplicateLot: new Set(chosenLotIds).size !== chosenLotIds.length,
    hasMixedGreige: chosenGreigeIds.size > 1,
    rowsComplete: rows.length > 0 && rows.every((row) => row.lotId && parseFloat(row.qty) > 0),
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

  let remaining = requiredQty;
  const filled: IssueLotRow[] = [];
  for (const lot of lots) {
    if (remaining <= ISSUE_QTY_TOLERANCE) break;
    if (lot.greigeId !== anchorGreigeId) continue;
    const take = round2(Math.min(lot.quantityAvailable, remaining));
    if (take <= 0) continue;
    filled.push({ lotId: lot.id, qty: take.toFixed(2) });
    remaining = round2(remaining - take);
  }
  return filled.length > 0 ? filled : null;
}
