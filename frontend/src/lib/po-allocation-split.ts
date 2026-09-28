/**
 * The Allocate dialog's split of a PO line among the orders that need it (docs/plans/po-allocation-design.md §7).
 *
 * The default (owner decision): every running order gets its full need, earliest delivery first, until the line
 * runs out — the last one it reaches may get part. The server sends that split as each candidate's
 * `suggestedQty`. After the user changes anything, `walkDefaultSplit` shares the line again the same way over
 * the rows that are ticked and NOT typed by hand: a typed quantity stays as typed and comes off the line first.
 *
 * A requirement is linked on one line only, so once ticked on a line it cannot be ticked on another.
 * Pure — no React, no API — so it can be tested on its own.
 */
import { prefillQty, qtyExceeds, snapToLimit } from '@/lib/quantity';
import type { PoAllocationInput, PoAllocationLine } from '@/types/po-allocation.types';

export interface SplitCandidate {
  requirementId: string;
  /** What it still needs bought */
  needQty: number;
  linkable: boolean;
  dyer: { id: string } | null;
  /** The server's default split (0 = not ticked) */
  suggestedQty: number;
}

export interface SplitLine {
  itemId: string;
  /** What more can be linked on the line */
  freeToLink: number;
  /** Greige / lace: what a link for an order dyed at this processor may take. Omitted = freeToLink for everyone */
  freeFor?: (dyerId: string | null) => number;
  /** Earliest need first (server order) */
  candidates: readonly SplitCandidate[];
}

export interface SplitRow {
  ticked: boolean;
  /** Typed by hand — the walk leaves it alone */
  edited: boolean;
  /** The input's text */
  qty: string;
}

export type SplitState = Readonly<Record<string, SplitRow>>;

export const splitKey = (itemId: string, requirementId: string): string => `${itemId}:${requirementId}`;

const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Down to 3 decimals, so a share is never more than the room it came from */
const floor3 = (n: number) => Math.floor(n * 1000 + 1e-6) / 1000;
const sum = (xs: readonly number[]) => round3(xs.reduce((a, b) => a + b, 0));

const STORE_POOL = 'STORE';
const isEligibleLink = (l: PoAllocationLine['links'][number]) =>
  l.requirementStatus !== 'CANCELLED' && l.orderStatus !== 'CANCELLED';

/**
 * Room on a greige / lace line for a link whose order is dyed at `dyerId` — the server's `lineFigures(credits,
 * dyer)`: goods it can reach (our store and its own processor) + what is still to come − what earlier links are
 * still owed, and never past the line. The server re-checks; this only keeps the suggestion and the warning honest.
 */
export function lineFreeFor(line: PoAllocationLine, dyerId: string | null): number {
  if (!line.located || dyerId == null) return line.freeToLink;
  const reachable = sum(line.plainByPlace.filter((p) => p.pool === STORE_POOL || p.pool === dyerId).map((p) => p.qty));
  const owed = sum(line.links.filter(isEligibleLink).map((l) => Math.max(0, l.allocatedQty - l.receivedQty)));
  const formula = round3(reachable + line.toComeQty - owed);
  const lineRoom = round3(line.orderedStockQty - line.linkedQty);
  return floor3(Math.max(0, Math.min(formula, lineRoom, line.freeToLink)));
}

/** A server line as the split sees it */
export function splitLineOf(line: PoAllocationLine): SplitLine {
  return {
    itemId: line.itemId,
    freeToLink: line.freeToLink,
    ...(line.located ? { freeFor: (dyerId: string | null) => lineFreeFor(line, dyerId) } : {}),
    candidates: line.candidates,
  };
}

/** The typed quantity as a number; NaN when it is not one */
export function parseSplitQty(text: string): number {
  const t = text.trim();
  return t === '' ? NaN : Number(t);
}

const qtyOf = (row: SplitRow | undefined): number => {
  if (!row?.ticked) return 0;
  const n = parseSplitQty(row.qty);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Share each line again over its ticked rows that were not typed by hand, earliest first, each up to its need,
 * until the line runs out (the rows after that get 0). Typed rows keep their quantity and come off the line first.
 */
export function walkDefaultSplit(lines: readonly SplitLine[], state: SplitState): SplitState {
  const next: Record<string, SplitRow> = { ...state };
  for (const line of lines) {
    let used = sum(
      line.candidates
        .map((c) => next[splitKey(line.itemId, c.requirementId)])
        .filter((r) => r?.ticked && r.edited)
        .map(qtyOf)
    );
    for (const c of line.candidates) {
      const key = splitKey(line.itemId, c.requirementId);
      const row = next[key];
      if (!row?.ticked || row.edited) continue;
      const cap = Math.min(line.freeToLink, line.freeFor ? line.freeFor(c.dyer?.id ?? null) : line.freeToLink);
      let share = floor3(Math.max(0, Math.min(c.needQty, cap - used)));
      if (!qtyExceeds(share, 0)) share = 0;
      next[key] = { ...row, qty: prefillQty(share) };
      used = round3(used + share);
    }
  }
  return next;
}

/** The line a requirement is ticked on, or null */
export function tickedOn(lines: readonly SplitLine[], state: SplitState, requirementId: string): string | null {
  for (const line of lines) {
    if (state[splitKey(line.itemId, requirementId)]?.ticked) return line.itemId;
  }
  return null;
}

/**
 * Where the dialog starts. With no focus: the server's default split. With focus ids (the Requirements page's
 * Link): only those requirements are ticked — each on the first line with room for it — and the line is shared
 * among them alone.
 */
export function initialSplit(lines: readonly SplitLine[], focusRequirementIds?: readonly string[]): SplitState {
  const state: Record<string, SplitRow> = {};
  const focus = focusRequirementIds && focusRequirementIds.length > 0 ? new Set(focusRequirementIds) : null;

  if (!focus) {
    const taken = new Set<string>();
    for (const line of lines) {
      for (const c of line.candidates) {
        const ticked = c.linkable && qtyExceeds(c.suggestedQty, 0) && !taken.has(c.requirementId);
        if (ticked) taken.add(c.requirementId);
        state[splitKey(line.itemId, c.requirementId)] = {
          ticked,
          edited: false,
          qty: ticked ? prefillQty(c.suggestedQty) : '',
        };
      }
    }
    return state;
  }

  const roomFor = (line: SplitLine, c: SplitCandidate) =>
    Math.min(line.freeToLink, line.freeFor ? line.freeFor(c.dyer?.id ?? null) : line.freeToLink);
  const home = new Map<string, string>();
  for (const id of focus) {
    const options = lines.filter((l) => l.candidates.some((c) => c.requirementId === id && c.linkable));
    const withRoom = options.find((l) => qtyExceeds(roomFor(l, l.candidates.find((c) => c.requirementId === id)!), 0));
    const chosen = withRoom ?? options[0];
    if (chosen) home.set(id, chosen.itemId);
  }
  for (const line of lines) {
    for (const c of line.candidates) {
      state[splitKey(line.itemId, c.requirementId)] = {
        ticked: home.get(c.requirementId) === line.itemId,
        edited: false,
        qty: '',
      };
    }
  }
  return walkDefaultSplit(lines, state);
}

/** Tick or untick a row; unticking forgets a typed quantity. The line is shared again. */
export function toggleSplitRow(
  lines: readonly SplitLine[],
  state: SplitState,
  itemId: string,
  requirementId: string,
  ticked: boolean
): SplitState {
  const key = splitKey(itemId, requirementId);
  return walkDefaultSplit(lines, { ...state, [key]: { ticked, edited: false, qty: '' } });
}

/** Type a quantity: the row is ticked and keeps what was typed; the untyped rows share what is left. */
export function editSplitRow(
  lines: readonly SplitLine[],
  state: SplitState,
  itemId: string,
  requirementId: string,
  text: string
): SplitState {
  const key = splitKey(itemId, requirementId);
  return walkDefaultSplit(lines, { ...state, [key]: { ticked: true, edited: true, qty: text } });
}

export type SplitRowProblem = 'NOT_A_NUMBER' | 'OVER_NEED' | null;

/** What is wrong with a ticked row as typed */
export function splitRowProblem(candidate: SplitCandidate, row: SplitRow | undefined): SplitRowProblem {
  if (!row?.ticked) return null;
  const n = parseSplitQty(row.qty);
  if (!Number.isFinite(n) || n < 0) return 'NOT_A_NUMBER';
  if (qtyExceeds(n, candidate.needQty)) return 'OVER_NEED';
  return null;
}

export interface SplitLineSummary {
  /** Σ ticked quantities */
  requested: number;
  /** freeToLink − requested; below 0 when the line is over */
  leftFree: number;
  over: boolean;
  /** Greige / lace: processors whose orders ask for more than can reach them (the server refuses these too) */
  overForDyer: Array<{ dyerId: string; requested: number; free: number }>;
}

export function splitLineSummary(line: SplitLine, state: SplitState): SplitLineSummary {
  const rows = line.candidates.map((c) => ({ c, row: state[splitKey(line.itemId, c.requirementId)] }));
  const requested = sum(rows.map(({ row }) => qtyOf(row)));
  const overForDyer: SplitLineSummary['overForDyer'] = [];
  if (line.freeFor) {
    const dyers = [...new Set(rows.filter(({ row }) => row?.ticked).map(({ c }) => c.dyer?.id ?? null))];
    for (const dyerId of dyers) {
      if (!dyerId) continue;
      const mine = sum(rows.filter(({ c, row }) => row?.ticked && c.dyer?.id === dyerId).map(({ row }) => qtyOf(row)));
      const free = line.freeFor(dyerId);
      if (qtyExceeds(mine, free)) overForDyer.push({ dyerId, requested: mine, free });
    }
  }
  return {
    requested,
    leftFree: round3(line.freeToLink - requested),
    over: qtyExceeds(requested, line.freeToLink),
    overForDyer,
  };
}

/** The POST body's rows: ticked rows with a quantity, a hair's breadth from the need snapped to it */
export function splitAllocations(lines: readonly SplitLine[], state: SplitState): PoAllocationInput[] {
  const out: PoAllocationInput[] = [];
  for (const line of lines) {
    for (const c of line.candidates) {
      const qty = qtyOf(state[splitKey(line.itemId, c.requirementId)]);
      if (!qtyExceeds(qty, 0)) continue;
      out.push({
        purchaseOrderItemId: line.itemId,
        requirementId: c.requirementId,
        quantity: round3(snapToLimit(qty, c.needQty)),
      });
    }
  }
  return out;
}

/** Nothing typed wrong, no line over, and something to link */
export function splitIsSavable(lines: readonly SplitLine[], state: SplitState): boolean {
  for (const line of lines) {
    if (splitLineSummary(line, state).over) return false;
    for (const c of line.candidates) {
      if (splitRowProblem(c, state[splitKey(line.itemId, c.requirementId)])) return false;
    }
  }
  return splitAllocations(lines, state).length > 0;
}
