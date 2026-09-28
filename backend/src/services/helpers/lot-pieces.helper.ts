/**
 * Lot pieces — the rules a lot's roll / than list follows, for greige AND finished fabric (2026-09-28).
 *
 * A lot's quantity is ACTUAL metres; its pieces carry the COUNTED tag figure at the lot's fold length.
 * These rules are pure (no database): greige-stock.service.ts (greige_stock_details) and
 * fabric-lot-pieces.service.ts (fabric_stock_details) both read them, so "how close is close enough"
 * and "is this list still true" have one answer. greige-stock.service.ts re-exports the constants and
 * word helpers its callers already import.
 */
import { isQtyZero, qtyExceeds, toQty } from '../../utils/quantity';

/**
 * Than tags are 3 dp and counted; a lot is 2 dp and actual. A pick that empties every than may differ from
 * what the lot holds by the half-cents each earlier issue rounded away.
 */
export const THAN_ROUNDING_SLACK_M = 0.1;

/**
 * Named whole pieces rarely add up to an exact figure. When an issue names its thans / rolls, the lots may
 * total within this share of the job's metres either way (owner, 2026-09-24: ±1%); a lot's count ("Record
 * bales & thans", "Record / Check rolls & thans") must land within it of what the lot holds.
 */
export const THAN_PICK_TOLERANCE_PCT = 1;

/** A piece: a than (folded, usually baled) or a roll. Wording only — the arithmetic is the same. */
export type GreigePieceType = 'THAN' | 'ROLL';

/** How pieces of one lot are listed: all thans, all rolls, both (two receipts), or none recorded. */
export type GreigePieceKind = GreigePieceType | 'MIXED' | null;

/** The same words for any lot — greige or finished fabric */
export type LotPieceType = GreigePieceType;
export type LotPieceKind = GreigePieceKind;

export function pieceKindOf(types: Iterable<string>): GreigePieceKind {
  const set = new Set(types);
  if (set.size === 0) return null;
  if (set.size > 1) return 'MIXED';
  return set.has('ROLL') ? 'ROLL' : 'THAN';
}

/** "than" / "thans" / "roll" / "rolls" / "piece" / "pieces" */
export function pieceWord(kind: GreigePieceKind, n: number): string {
  const word = kind === 'ROLL' ? 'roll' : kind === 'MIXED' ? 'piece' : 'than';
  return n === 1 ? word : `${word}s`;
}

/**
 * Does a lot's list still describe what is on the rack?
 *  - NO_LIST      the lot never had a list (received as Total Meters, typed in, split off another lot)
 *  - LIST_EMPTY   every listed piece has gone but the lot still holds metres — record the pieces again
 *  - OUT_OF_STEP  the pieces left on the list and the lot's metres are more than ±1% apart (a door took
 *                 metres without naming pieces) — Check rolls & thans puts it right
 *  - IN_STEP      within ±1% (both near zero counts as in step: an empty lot with an empty list)
 * Flag, never refuse (owner, 2026-09-28): nothing is blocked for a list that is out of step.
 */
export type LotListState = 'NO_LIST' | 'IN_STEP' | 'LIST_EMPTY' | 'OUT_OF_STEP';

export function listStateOf(input: {
  /** Every piece ever listed on the lot, any status */
  piecesRecorded: number;
  /** The pieces still on the list, in ACTUAL metres (their counted metres left × the lot's fold) */
  listActual: number;
  /** The lot's quantityAvailable (ACTUAL) */
  onHand: number;
}): LotListState {
  if (input.piecesRecorded <= 0) return 'NO_LIST';
  const listActual = toQty(input.listActual);
  const onHand = toQty(input.onHand);
  if (isQtyZero(listActual)) return isQtyZero(onHand) ? 'IN_STEP' : 'LIST_EMPTY';
  const allowed = Math.max((Math.abs(onHand) * THAN_PICK_TOLERANCE_PCT) / 100, THAN_ROUNDING_SLACK_M);
  return qtyExceeds(Math.abs(listActual - onHand), allowed) ? 'OUT_OF_STEP' : 'IN_STEP';
}

/**
 * The ACTUAL metres a pick of named pieces takes out of its lot. Taking every piece still listed takes the
 * whole lot when the two are within rounding slack, so the last pieces never strand a sliver on the lot or
 * get refused against it.
 */
export function snapWholeList(actual: number, opts: { takesEveryPiece: boolean; onHand: number }): number {
  const onHand = toQty(opts.onHand);
  if (opts.takesEveryPiece && Math.abs(onHand - actual) <= THAN_ROUNDING_SLACK_M) return onHand;
  return actual;
}
