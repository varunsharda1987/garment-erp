/**
 * Split delivery on a purchase order — the screen side of one rule (2026-09-26). The server's
 * `helpers/po-delivery-plan.helper.ts` is the authority; this mirrors it so the editor can show the
 * balance and refuse early:
 *  - a split has 2–10 distinct places, each receiving something;
 *  - each line's places add up to what it orders, within the one quantity tolerance (@/lib/quantity);
 *  - "put the balance into point 1" is the same rule the server applies when a draft line changes.
 * Quantities are strings while being typed (inputs use step="any"), numbers when sent.
 */
import { isQtyZero, prefillQty, qtyExceeds, qtyRemaining, toQty } from '@/lib/quantity';
import type {
  AmendDeliveryPlanRequest,
  DeliveryPlanMode,
  DeliveryPlanSnapshot,
  PurchaseOrder,
} from '@/types/purchaseOrder.types';

export const MAX_DELIVERY_POINTS = 10;

/** POs not yet sent — a delivery change there is part of composing the PO and needs no reason. */
export const PRE_SEND_STATUSES = ['DRAFT', 'PENDING_GREIGE', 'READY_FOR_PROCESSING'];

export interface SplitLine {
  id: string;
  label: string;
  ordered: number;
  unit?: string | null;
}

export interface SplitPointDraft {
  key: string;
  warehouseId: string;
  /** poItemId → quantity as typed */
  qty: Record<string, string>;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
let keySeq = 0;
export const newPointKey = () => `pt-${++keySeq}`;

export function emptyPoint(): SplitPointDraft {
  return { key: newPointKey(), warehouseId: '', qty: {} };
}

/** Placed, still unplaced (never negative) and over, for one line across the places. */
export function lineBalance(line: SplitLine, points: SplitPointDraft[]) {
  const placed = round3(points.reduce((sum, p) => sum + toQty(p.qty[line.id]), 0));
  return {
    placed,
    unplaced: qtyRemaining(line.ordered, placed),
    over: qtyExceeds(placed, line.ordered) ? round3(placed - line.ordered) : 0,
  };
}

/** Each line's unplaced balance goes to point 1 (a line over its quantity is left for the user). */
export function fillBalanceIntoFirst(lines: SplitLine[], points: SplitPointDraft[]): SplitPointDraft[] {
  if (points.length === 0) return points;
  const [first, ...rest] = points;
  const qty = { ...first.qty };
  for (const line of lines) {
    const { unplaced } = lineBalance(line, points);
    if (isQtyZero(unplaced)) continue;
    qty[line.id] = prefillQty(round3(toQty(qty[line.id]) + unplaced));
  }
  return [{ ...first, qty }, ...rest];
}

/** Everything that stops this split from being saved, in words; empty = fine. */
export function splitProblems(lines: SplitLine[], points: SplitPointDraft[], placeName: (id: string) => string) {
  const problems: string[] = [];
  if (points.length < 2) problems.push('A split needs at least two places.');
  if (points.length > MAX_DELIVERY_POINTS) problems.push(`At most ${MAX_DELIVERY_POINTS} places.`);
  if (points.some((p) => !p.warehouseId)) problems.push('Pick a place for every column.');
  const ids = points.map((p) => p.warehouseId).filter(Boolean);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) problems.push(`${placeName(dupe)} is listed twice.`);
  for (const p of points) {
    if (p.warehouseId && lines.every((l) => isQtyZero(toQty(p.qty[l.id])))) {
      problems.push(`${placeName(p.warehouseId)} has nothing to receive.`);
    }
    if (lines.some((l) => toQty(p.qty[l.id]) < 0)) problems.push('A quantity cannot be negative.');
  }
  for (const line of lines) {
    const { unplaced, over } = lineBalance(line, points);
    if (!isQtyZero(unplaced)) problems.push(`${line.label}: ${unplaced} not placed yet.`);
    if (over > 0) problems.push(`${line.label}: ${over} more than ordered.`);
  }
  return [...new Set(problems)];
}

/** The request body for a split. Lines typed as 0 or blank are left out. */
export function toSplitRequest(points: SplitPointDraft[], reason: string): AmendDeliveryPlanRequest {
  return {
    mode: 'SPLIT',
    points: points.map((p) => ({
      warehouseId: p.warehouseId,
      lines: Object.entries(p.qty)
        .map(([poItemId, q]) => ({ poItemId, quantity: round3(toQty(q)) }))
        .filter((l) => !isQtyZero(l.quantity)),
    })),
    reason: reason.trim() || null,
  };
}

/** The PO's plan as the editor starts it: its split, or its one place as point 1 with everything. */
export function seedSplit(po: PurchaseOrder, lines: SplitLine[]): SplitPointDraft[] {
  if (po.deliveryPoints && po.deliveryPoints.length > 0) {
    return po.deliveryPoints.map((p) => ({
      key: newPointKey(),
      warehouseId: p.warehouseId,
      qty: Object.fromEntries(p.lines.map((l) => [l.poItemId, prefillQty(toQty(l.quantity))])),
    }));
  }
  const first: SplitPointDraft = {
    key: newPointKey(),
    warehouseId: po.deliveryLocationId ?? '',
    qty: Object.fromEntries(lines.map((l) => [l.id, prefillQty(l.ordered)])),
  };
  return [first, emptyPoint()];
}

export function planMode(po: Pick<PurchaseOrder, 'deliveryPoints' | 'deliveryLocationId'>): DeliveryPlanMode {
  if (po.deliveryPoints && po.deliveryPoints.length > 0) return 'SPLIT';
  return po.deliveryLocationId ? 'ONE_PLACE' : 'TO_BE_ADVISED';
}

/** "Kashaya Fabs", "Split: Aryan Dyeing 4,000 · Kashaya Fabs 6,000", "To be advised" — for history rows. */
export function describePlan(plan: DeliveryPlanSnapshot): string {
  if (plan.mode === 'TO_BE_ADVISED') return 'To be advised';
  if (plan.mode === 'ONE_PLACE') return plan.points[0]?.warehouseName ?? 'One place';
  return `Split: ${plan.points
    .map((p) => `${p.warehouseName} ${p.lines.reduce((sum, l) => sum + l.quantity, 0).toLocaleString('en-IN')}`)
    .join(' · ')}`;
}

/** Has anything been received on this PO (a receipt that was not rejected or reversed)? */
export function anythingReceived(po: PurchaseOrder): boolean {
  return (po.goodsReceivingNotes ?? []).some((g) => g.status !== 'REJECTED' && g.status !== 'REVERSED');
}

/** "To be advised" and due within `days` — the supplier is about to dispatch with nowhere to go. */
export function deliveryUndecidedSoon(
  po: Pick<PurchaseOrder, 'deliveryPoints' | 'deliveryLocationId' | 'status' | 'expectedDeliveryDate'>,
  today = new Date(),
  days = 3
): boolean {
  if (planMode(po) !== 'TO_BE_ADVISED') return false;
  if (!['SENT', 'ACKNOWLEDGED'].includes(po.status)) return false;
  const due = new Date(po.expectedDeliveryDate);
  return due.getTime() - today.getTime() <= days * 24 * 60 * 60 * 1000;
}
