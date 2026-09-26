/**
 * Where a purchase order delivers — the ONE writer of a PO's delivery plan (Phase 3 of the
 * direct-to-processor plan, 2026-09-26: C:\Users\NEW\.claude\plans\we-have-recently-made-wondrous-volcano.md).
 *
 * A PO delivers in one of three shapes:
 *  - TO_BE_ADVISED — no place yet (header deliveryLocationId empty). The supplier is told before dispatch.
 *  - ONE_PLACE     — the header's deliveryLocationId, no po_delivery_points rows.
 *  - SPLIT         — po_delivery_points, each with how much of each line goes there. The header mirrors
 *                    point 1. Each line's points add up to its ordered quantity within the one quantity
 *                    tolerance (utils/quantity).
 *
 * Received per point is DERIVED from the receipts that name it (goods_receiving_notes.poDeliveryPointId),
 * in ACTUAL metres (fold-length rule), never stored. Every change made through the Change delivery door
 * writes a po_delivery_plan_revisions row with who, when and why; once the PO has left DRAFT such a change
 * is an amendment and the printout says so.
 *
 * Rules held here, for every caller (PO create / edit, the Change delivery dialog, the old single-place
 * endpoint, GRN create):
 *  - metres already received cannot be moved, and a place that has received cannot be dropped;
 *  - a point that a receipt names cannot be removed; a PO cannot go back to "to be advised", or be
 *    un-split, once anything was received;
 *  - a change after the PO was sent needs a reason.
 */
import type { GRNStatus, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { BusinessError } from '../../errors';
import { Decimal } from '../../utils/currency';
import { foldActual } from '../../utils/fold-length';
import { isQtyZero, qtyAtLeast, qtyExceeds, qtyRemaining } from '../../utils/quantity';
import { isReceiptComplete } from './receipt-split.helper';
import { grnLineActualQty } from './grn-line-value.helper';

export const MAX_DELIVERY_POINTS = 10;

export type DeliveryPlanMode = 'TO_BE_ADVISED' | 'ONE_PLACE' | 'SPLIT';

export interface DeliveryPlanLineInput {
  poItemId: string;
  quantity: number;
}

export interface DeliveryPlanPointInput {
  warehouseId: string;
  lines: DeliveryPlanLineInput[];
}

export type DeliveryPlanInput =
  | { mode: 'TO_BE_ADVISED' }
  | { mode: 'ONE_PLACE'; warehouseId: string }
  | { mode: 'SPLIT'; points: DeliveryPlanPointInput[] };

/** A plan as stored in a revision's before / after. ONE_PLACE carries one point with no lines (all of it). */
export interface DeliveryPlanSnapshot {
  mode: DeliveryPlanMode;
  points: Array<{ warehouseId: string; warehouseName: string; lines: DeliveryPlanLineInput[] }>;
}

/** POs not yet sent to the supplier — a change there is part of composing the PO, not an amendment. */
export const PRE_SEND_STATUSES: readonly PurchaseOrderStatus[] = ['DRAFT', 'PENDING_GREIGE', 'READY_FOR_PROCESSING'];
const FINISHED_STATUSES: readonly PurchaseOrderStatus[] = ['RECEIVED', 'SHORT_CLOSED', 'CANCELLED'];

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const sumQty = (values: number[]) => values.reduce((acc, v) => acc.plus(v), new Decimal(0)).toNumber();

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Receipts → metres per place (pure)
// ─────────────────────────────────────────────────────────────────────────────────────────────

type Qty = Prisma.Decimal | number | string;

export interface ReceiptLine {
  poItemId: string | null;
  receivedQuantity: Qty;
  acceptedQuantity: Qty;
  foldLengthCm?: Qty | null;
}

export interface ReceiptRow {
  grnNumber?: string;
  status: GRNStatus;
  warehouseId: string | null;
  poDeliveryPointId: string | null;
  grn_items: ReceiptLine[];
}

/**
 * The ACTUAL quantity one receipt line counts toward its place: awaiting QC = what arrived; accepted (in
 * full or part) = what was accepted; rejected or reversed = nothing.
 */
export function receiptLineQty(status: GRNStatus, line: ReceiptLine): number {
  if (status === 'REJECTED' || status === 'REVERSED') return 0;
  if (status === 'PENDING_QC') return foldActual(line.receivedQuantity, line.foldLengthCm ?? null).toNumber();
  return grnLineActualQty({
    acceptedQuantity: line.acceptedQuantity,
    foldLengthCm: line.foldLengthCm ?? null,
  }).toNumber();
}

/**
 * The place a receipt counts for: the warehouse of the point it names (the PLANNED ship-to), else the
 * warehouse it was booked into (an unsplit PO, or a receipt from before the split).
 */
export function receiptPlace(grn: ReceiptRow, pointWarehouse: Map<string, string>): string | null {
  if (grn.poDeliveryPointId) return pointWarehouse.get(grn.poDeliveryPointId) ?? grn.warehouseId;
  return grn.warehouseId;
}

/** Metres received per place (warehouse id) per PO line. */
export function foldReceipts(
  grns: ReceiptRow[],
  pointWarehouse: Map<string, string>
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const grn of grns) {
    const place = receiptPlace(grn, pointWarehouse) ?? '__none__';
    for (const line of grn.grn_items) {
      if (!line.poItemId) continue;
      const qty = receiptLineQty(grn.status, line);
      if (isQtyZero(qty)) continue;
      const byLine = out.get(place) ?? new Map<string, number>();
      byLine.set(line.poItemId, round3((byLine.get(line.poItemId) ?? 0) + qty));
      out.set(place, byLine);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The target plan (pure validation)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface PlanItem {
  id: string;
  orderedQuantity: Qty;
  label: string; // material code / name for messages
}

/**
 * Validate a requested plan against the PO's lines and normalise it. SPLIT needs 2–10 distinct places;
 * each place names at least one line; every line's places add up to what it orders (one tolerance).
 */
export function buildTargetPlan(
  input: DeliveryPlanInput,
  items: PlanItem[],
  warehouseName: (id: string) => string
): DeliveryPlanSnapshot {
  if (input.mode === 'TO_BE_ADVISED') return { mode: 'TO_BE_ADVISED', points: [] };
  if (input.mode === 'ONE_PLACE') {
    return {
      mode: 'ONE_PLACE',
      points: [{ warehouseId: input.warehouseId, warehouseName: warehouseName(input.warehouseId), lines: [] }],
    };
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const points = input.points.map((p) => {
    if (seen.has(p.warehouseId)) {
      throw new BusinessError(`${warehouseName(p.warehouseId)} is listed twice — one row per place.`, {
        code: 'DELIVERY_POINT_DUPLICATE',
      });
    }
    seen.add(p.warehouseId);
    const lineSeen = new Set<string>();
    const lines = p.lines
      .filter((l) => !isQtyZero(l.quantity))
      .map((l) => {
        if (!itemById.has(l.poItemId)) {
          throw new BusinessError('A delivery line names an item that is not on this PO.', {
            code: 'DELIVERY_LINE_UNKNOWN',
          });
        }
        if (lineSeen.has(l.poItemId)) {
          throw new BusinessError(
            `${itemById.get(l.poItemId)!.label} is listed twice for ${warehouseName(p.warehouseId)}.`,
            {
              code: 'DELIVERY_LINE_DUPLICATE',
            }
          );
        }
        if (l.quantity < 0) {
          throw new BusinessError('A delivery quantity cannot be negative.', { code: 'DELIVERY_QTY_NEGATIVE' });
        }
        lineSeen.add(l.poItemId);
        return { poItemId: l.poItemId, quantity: round3(l.quantity) };
      });
    if (lines.length === 0) {
      throw new BusinessError(
        `${warehouseName(p.warehouseId)} has nothing to receive — give it a quantity or remove it.`,
        {
          code: 'DELIVERY_POINT_EMPTY',
        }
      );
    }
    return { warehouseId: p.warehouseId, warehouseName: warehouseName(p.warehouseId), lines };
  });

  if (points.length < 2) {
    throw new BusinessError('A split needs at least two places. For one place, choose "One place".', {
      code: 'DELIVERY_SPLIT_TOO_FEW',
    });
  }
  if (points.length > MAX_DELIVERY_POINTS) {
    throw new BusinessError(`A PO can be split across at most ${MAX_DELIVERY_POINTS} places.`, {
      code: 'DELIVERY_SPLIT_TOO_MANY',
    });
  }

  for (const item of items) {
    const planned = sumQty(points.flatMap((p) => p.lines.filter((l) => l.poItemId === item.id).map((l) => l.quantity)));
    const ordered = Number(item.orderedQuantity);
    if (!isQtyZero(planned - ordered)) {
      const gap = qtyExceeds(planned, ordered)
        ? `${round3(planned - ordered)} more than`
        : `${qtyRemaining(ordered, planned)} short of`;
      throw new BusinessError(
        `${item.label}: the places add up to ${planned}, ${gap} the ${ordered} ordered. Every line must be fully placed.`,
        { code: 'DELIVERY_SPLIT_NOT_BALANCED', poItemId: item.id, planned, ordered }
      );
    }
  }
  return { mode: 'SPLIT', points };
}

/**
 * Per-line deliveries sent on PO create / edit (`items[].deliveries`) → a plan. One place across all
 * lines is ONE_PLACE; places appear in the order they are first named (point 1 = the first).
 */
export function planFromItemDeliveries(
  items: Array<{ id: string; deliveries?: Array<{ warehouseId: string; quantity: number }> | null }>
): DeliveryPlanInput | null {
  if (!items.some((i) => (i.deliveries?.length ?? 0) > 0)) return null;
  const order: string[] = [];
  const byPlace = new Map<string, DeliveryPlanLineInput[]>();
  for (const item of items) {
    for (const d of item.deliveries ?? []) {
      if (!byPlace.has(d.warehouseId)) {
        byPlace.set(d.warehouseId, []);
        order.push(d.warehouseId);
      }
      byPlace.get(d.warehouseId)!.push({ poItemId: item.id, quantity: d.quantity });
    }
  }
  if (order.length === 1) return { mode: 'ONE_PLACE', warehouseId: order[0] };
  return { mode: 'SPLIT', points: order.map((warehouseId) => ({ warehouseId, lines: byPlace.get(warehouseId)! })) };
}

function samePlan(a: DeliveryPlanSnapshot, b: DeliveryPlanSnapshot): boolean {
  if (a.mode !== b.mode || a.points.length !== b.points.length) return false;
  return a.points.every((p, i) => {
    const q = b.points[i];
    if (p.warehouseId !== q.warehouseId || p.lines.length !== q.lines.length) return false;
    const qLines = new Map(q.lines.map((l) => [l.poItemId, l.quantity]));
    return p.lines.every((l) => qLines.has(l.poItemId) && isQtyZero(l.quantity - qLines.get(l.poItemId)!));
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Reading and writing (transaction)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Serialise every writer of one PO's delivery plan (and its receipts' point checks). */
export async function lockPurchaseOrder(tx: Prisma.TransactionClient, poId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${poId} FOR UPDATE`;
}

const PLAN_PO_SELECT = {
  id: true,
  poNumber: true,
  status: true,
  deliveryLocationId: true,
  originalDeliveryLocationId: true,
  deliveryWarehouse: { select: { id: true, warehouseName: true } },
  purchase_order_items: {
    select: {
      id: true,
      orderedQuantity: true,
      materials: { select: { code: true, name: true } },
      serviceDescription: true,
    },
  },
  deliveryPoints: {
    orderBy: { sequence: 'asc' },
    select: {
      id: true,
      sequence: true,
      warehouseId: true,
      warehouse: { select: { warehouseName: true } },
      lines: { select: { poItemId: true, quantity: true } },
    },
  },
  goods_receiving_notes: {
    select: {
      grnNumber: true,
      status: true,
      warehouseId: true,
      poDeliveryPointId: true,
      grn_items: { select: { poItemId: true, receivedQuantity: true, acceptedQuantity: true, foldLengthCm: true } },
    },
  },
} as const satisfies Prisma.purchase_ordersSelect;

type PlanPo = Prisma.purchase_ordersGetPayload<{ select: typeof PLAN_PO_SELECT }>;

type PlanReader = Pick<Prisma.TransactionClient, 'purchase_orders'>;

async function loadPlanPo(client: PlanReader, poId: string): Promise<PlanPo> {
  const po = await client.purchase_orders.findUnique({ where: { id: poId }, select: PLAN_PO_SELECT });
  if (!po) throw new BusinessError('Purchase order not found.', { code: 'PO_NOT_FOUND' });
  return po;
}

const itemLabel = (i: PlanPo['purchase_order_items'][number]) =>
  i.materials?.code ?? i.materials?.name ?? i.serviceDescription ?? 'A line';

/** The plan a PO has now. */
export function currentPlan(po: PlanPo): DeliveryPlanSnapshot {
  if (po.deliveryPoints.length > 0) {
    return {
      mode: 'SPLIT',
      points: po.deliveryPoints.map((p) => ({
        warehouseId: p.warehouseId,
        warehouseName: p.warehouse.warehouseName,
        lines: p.lines.map((l) => ({ poItemId: l.poItemId, quantity: Number(l.quantity) })),
      })),
    };
  }
  if (po.deliveryLocationId) {
    return {
      mode: 'ONE_PLACE',
      points: [
        {
          warehouseId: po.deliveryLocationId,
          warehouseName: po.deliveryWarehouse?.warehouseName ?? 'Unknown place',
          lines: [],
        },
      ],
    };
  }
  return { mode: 'TO_BE_ADVISED', points: [] };
}

export interface ApplyDeliveryPlanOptions {
  userId: string;
  reason?: string | null;
  /** Write a revision row (the Change delivery door, the old endpoint). PO create / draft edit do not. */
  revision: boolean;
}

export interface ApplyDeliveryPlanResult {
  changed: boolean;
  before: DeliveryPlanSnapshot;
  after: DeliveryPlanSnapshot;
  revisionNumber: number | null;
}

/**
 * Set a PO's delivery plan. Call inside a transaction; it takes the PO row lock itself.
 */
export async function applyDeliveryPlan(
  tx: Prisma.TransactionClient,
  poId: string,
  input: DeliveryPlanInput,
  opts: ApplyDeliveryPlanOptions
): Promise<ApplyDeliveryPlanResult> {
  await lockPurchaseOrder(tx, poId);
  const po = await loadPlanPo(tx, poId);

  if (FINISHED_STATUSES.includes(po.status)) {
    throw new BusinessError(
      `Cannot change where ${po.poNumber} delivers — it is ${po.status}; there is nothing left to deliver.`,
      {
        code: 'DELIVERY_PO_FINISHED',
      }
    );
  }

  // Places named by the request must exist; a NEW place must also be active
  const before = currentPlan(po);
  const requestedIds =
    input.mode === 'ONE_PLACE'
      ? [input.warehouseId]
      : input.mode === 'SPLIT'
        ? input.points.map((p) => p.warehouseId)
        : [];
  const warehouses = requestedIds.length
    ? await tx.warehouses.findMany({
        where: { id: { in: requestedIds } },
        select: { id: true, warehouseName: true, warehouseType: true, isActive: true },
      })
    : [];
  const known = new Set(before.points.map((p) => p.warehouseId));
  for (const id of requestedIds) {
    const wh = warehouses.find((w) => w.id === id);
    if (!wh)
      throw new BusinessError('A delivery place no longer exists — pick it again.', { code: 'DELIVERY_PLACE_UNKNOWN' });
    if (!wh.isActive && !known.has(id)) {
      throw new BusinessError(`${wh.warehouseName} is inactive — pick an active place.`, {
        code: 'DELIVERY_PLACE_INACTIVE',
      });
    }
  }
  const nameOf = (id: string) => warehouses.find((w) => w.id === id)?.warehouseName ?? 'Unknown place';

  const after = buildTargetPlan(
    input,
    po.purchase_order_items.map((i) => ({ id: i.id, orderedQuantity: i.orderedQuantity, label: itemLabel(i) })),
    nameOf
  );
  if (samePlan(before, after)) return { changed: false, before, after, revisionNumber: null };

  const sent = !PRE_SEND_STATUSES.includes(po.status);
  const reason = opts.reason?.trim() || null;
  if (opts.revision && sent && !reason) {
    throw new BusinessError(`${po.poNumber} has been sent to the supplier — say why the delivery is changing.`, {
      code: 'DELIVERY_REASON_REQUIRED',
    });
  }

  // What was received where. Metres received cannot move; a place that received cannot be dropped.
  const pointWarehouse = new Map(po.deliveryPoints.map((p) => [p.id, p.warehouseId]));
  const received = foldReceipts(po.goods_receiving_notes, pointWarehouse);
  const anyReceived = received.size > 0;
  const placeName = (id: string) =>
    po.deliveryPoints.find((p) => p.warehouseId === id)?.warehouse.warehouseName ??
    (po.deliveryWarehouse?.id === id ? po.deliveryWarehouse.warehouseName : null) ??
    nameOf(id);
  const receivedAt = (id: string) => sumQty([...(received.get(id)?.values() ?? [])]);

  if (after.mode === 'TO_BE_ADVISED' && anyReceived) {
    throw new BusinessError(
      `Goods have already been received on ${po.poNumber} — it cannot go back to "to be advised".`,
      {
        code: 'DELIVERY_TBA_AFTER_RECEIPT',
      }
    );
  }
  if (after.mode === 'ONE_PLACE') {
    if (before.mode === 'SPLIT' && anyReceived) {
      throw new BusinessError(`${po.poNumber} has received goods against its split — it cannot be un-split now.`, {
        code: 'DELIVERY_UNSPLIT_AFTER_RECEIPT',
      });
    }
    const target = after.points[0].warehouseId;
    for (const place of received.keys()) {
      if (place === target || place === '__none__') continue;
      throw new BusinessError(
        `${placeName(place)} has already received ${receivedAt(place)} on ${po.poNumber}, and those metres cannot move. ` +
          `Split the delivery instead: ${placeName(place)} keeps what it received, ${after.points[0].warehouseName} gets the rest.`,
        { code: 'DELIVERY_PLACE_HAS_RECEIPTS', warehouseId: place }
      );
    }
  }
  if (after.mode === 'SPLIT') {
    for (const [place, byLine] of received) {
      if (place === '__none__') continue;
      const point = after.points.find((p) => p.warehouseId === place);
      if (!point) {
        throw new BusinessError(
          `${placeName(place)} has already received ${receivedAt(place)} on ${po.poNumber} — keep it in the split with at least that much.`,
          { code: 'DELIVERY_PLACE_HAS_RECEIPTS', warehouseId: place }
        );
      }
      for (const [poItemId, qty] of byLine) {
        const planned = point.lines.find((l) => l.poItemId === poItemId)?.quantity ?? 0;
        if (!qtyAtLeast(planned, qty)) {
          const item = po.purchase_order_items.find((i) => i.id === poItemId);
          throw new BusinessError(
            `${point.warehouseName} has already received ${qty} of ${item ? itemLabel(item) : 'a line'} — its share cannot be less than that.`,
            { code: 'DELIVERY_POINT_BELOW_RECEIVED', warehouseId: place, poItemId, received: qty, planned }
          );
        }
      }
    }
  }

  // A point a receipt names stays (FK Restrict) — refuse its removal by name
  const keptPlaces = new Set(after.mode === 'SPLIT' ? after.points.map((p) => p.warehouseId) : []);
  for (const point of po.deliveryPoints) {
    if (keptPlaces.has(point.warehouseId)) continue;
    const naming = po.goods_receiving_notes.filter((g) => g.poDeliveryPointId === point.id).map((g) => g.grnNumber);
    if (naming.length > 0) {
      throw new BusinessError(
        `${point.warehouse.warehouseName} cannot be removed — ${naming.join(', ')} ${naming.length === 1 ? 'was' : 'were'} received against it.`,
        { code: 'DELIVERY_POINT_HAS_GRN', warehouseId: point.warehouseId }
      );
    }
  }

  // Write the points
  const existingByPlace = new Map(po.deliveryPoints.map((p) => [p.warehouseId, p]));
  const removed = po.deliveryPoints.filter((p) => !keptPlaces.has(p.warehouseId)).map((p) => p.id);
  if (removed.length > 0) await tx.po_delivery_points.deleteMany({ where: { id: { in: removed } } });
  if (after.mode === 'SPLIT') {
    for (const [index, point] of after.points.entries()) {
      const existing = existingByPlace.get(point.warehouseId);
      const lines = point.lines.map((l) => ({ poItemId: l.poItemId, quantity: l.quantity }));
      let pointId: string;
      if (existing) {
        pointId = existing.id;
        await tx.po_delivery_point_lines.deleteMany({ where: { deliveryPointId: existing.id } });
        await tx.po_delivery_points.update({
          where: { id: existing.id },
          data: { sequence: index + 1, lines: { create: lines } },
        });
      } else {
        pointId = (
          await tx.po_delivery_points.create({
            data: { poId, warehouseId: point.warehouseId, sequence: index + 1, lines: { create: lines } },
            select: { id: true },
          })
        ).id;
      }
      // Receipts from before the split count for the point at the place they were booked into
      await tx.goods_receiving_notes.updateMany({
        where: { poId, poDeliveryPointId: null, warehouseId: point.warehouseId },
        data: { poDeliveryPointId: pointId },
      });
    }
  }

  // The header mirrors the plan's first place (or is empty: to be advised)
  const first = after.points[0] ?? null;
  const firstWh = first ? warehouses.find((w) => w.id === first.warehouseId) : null;
  await tx.purchase_orders.update({
    where: { id: poId },
    data: {
      deliveryLocationId: first?.warehouseId ?? null,
      deliveryLocationType: firstWh ? (firstWh.warehouseType === 'JOB_WORK' ? 'PROCESSOR' : 'WAREHOUSE') : null,
      originalDeliveryLocationId: po.originalDeliveryLocationId ?? po.deliveryLocationId ?? null,
      ...(opts.revision ? { deliveryLocationAmendedAt: new Date(), deliveryLocationAmendedById: opts.userId } : {}),
    },
  });

  let revisionNumber: number | null = null;
  if (opts.revision) {
    const last = await tx.po_delivery_plan_revisions.findFirst({
      where: { poId },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    });
    revisionNumber = (last?.revisionNumber ?? 0) + 1;
    await tx.po_delivery_plan_revisions.create({
      data: {
        poId,
        revisionNumber,
        kind: after.mode,
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
        reason,
        poStatus: po.status,
        changedById: opts.userId,
      },
    });
  }
  return { changed: true, before, after, revisionNumber };
}

/**
 * Keep a split PO consistent after a pre-send line edit (quantity changed, line added or removed): each
 * line's gap goes to point 1 — the same rule the split editor uses. A point left with nothing is dropped,
 * and a split left with one place becomes ONE_PLACE. Refuses when point 1 would go below zero.
 */
export async function rebalanceSplitToFirstPoint(tx: Prisma.TransactionClient, poId: string): Promise<void> {
  await lockPurchaseOrder(tx, poId);
  const po = await loadPlanPo(tx, poId);
  if (po.deliveryPoints.length === 0) return;
  const first = po.deliveryPoints[0];
  for (const item of po.purchase_order_items) {
    const lines = po.deliveryPoints.flatMap((p) => p.lines.filter((l) => l.poItemId === item.id));
    const gap = Number(item.orderedQuantity) - sumQty(lines.map((l) => Number(l.quantity)));
    if (isQtyZero(gap)) continue;
    const firstLine = first.lines.find((l) => l.poItemId === item.id);
    const next = round3(Number(firstLine?.quantity ?? 0) + gap);
    if (next < 0 && !isQtyZero(next)) {
      throw new BusinessError(
        `${itemLabel(item)} now orders less than its other delivery places add up to — change the split on the PO page first.`,
        { code: 'DELIVERY_SPLIT_NOT_BALANCED', poItemId: item.id }
      );
    }
    if (isQtyZero(next)) {
      await tx.po_delivery_point_lines.deleteMany({ where: { deliveryPointId: first.id, poItemId: item.id } });
    } else if (firstLine) {
      await tx.po_delivery_point_lines.updateMany({
        where: { deliveryPointId: first.id, poItemId: item.id },
        data: { quantity: next },
      });
    } else {
      await tx.po_delivery_point_lines.create({
        data: { deliveryPointId: first.id, poItemId: item.id, quantity: next },
      });
    }
  }
  // Drop emptied points (pre-send: no receipt names them), renumber, collapse a one-place split
  const points = await tx.po_delivery_points.findMany({
    where: { poId },
    orderBy: { sequence: 'asc' },
    select: { id: true, warehouseId: true, _count: { select: { lines: true } } },
  });
  const empty = points.filter((p) => p._count.lines === 0).map((p) => p.id);
  if (empty.length > 0) await tx.po_delivery_points.deleteMany({ where: { id: { in: empty } } });
  const left = points.filter((p) => p._count.lines > 0);
  if (left.length <= 1) {
    if (left.length === 1) await tx.po_delivery_points.delete({ where: { id: left[0].id } });
    const place = left[0]?.warehouseId ?? po.deliveryLocationId ?? null;
    await tx.purchase_orders.update({ where: { id: poId }, data: { deliveryLocationId: place } });
    return;
  }
  for (const [index, p] of left.entries()) {
    await tx.po_delivery_points.update({ where: { id: p.id }, data: { sequence: index + 1 } });
  }
  await tx.purchase_orders.update({ where: { id: poId }, data: { deliveryLocationId: left[0].warehouseId } });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Progress: planned / received / pending per place
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface DeliveryProgressLine {
  poItemId: string;
  label: string;
  planned: number;
  received: number;
  pending: number;
  complete: boolean;
}

export interface DeliveryProgressPoint {
  /** The po_delivery_points id — null for an unsplit PO's one place, and for unplanned places. */
  id: string | null;
  sequence: number | null;
  warehouseId: string;
  warehouseName: string;
  planned: boolean;
  lines: DeliveryProgressLine[];
  complete: boolean;
}

export interface DeliveryProgress {
  poId: string;
  mode: DeliveryPlanMode;
  points: DeliveryProgressPoint[];
  /** Receipts on this PO that name no place at all (booked without a warehouse). */
  unplaced: Array<{ poItemId: string; received: number }>;
}

/**
 * Planned / received / pending per place, received in ACTUAL units and a place complete by the PO line's
 * own rule (isReceiptComplete, the under-receipt tolerance). Places that received without being planned
 * (an unsplit PO delivered elsewhere) are listed with planned = 0.
 */
export async function loadDeliveryProgress(
  client: PlanReader & Pick<Prisma.TransactionClient, 'warehouses'>,
  poId: string,
  underTolerancePercent: number
): Promise<DeliveryProgress> {
  const po = await loadPlanPo(client, poId);
  const plan = currentPlan(po);
  const pointWarehouse = new Map(po.deliveryPoints.map((p) => [p.id, p.warehouseId]));
  const received = foldReceipts(po.goods_receiving_notes, pointWarehouse);
  const items = po.purchase_order_items;

  const lineRows = (warehouseId: string, plannedOf: (itemId: string) => number): DeliveryProgressLine[] =>
    items
      .map((item) => {
        const planned = plannedOf(item.id);
        const got = received.get(warehouseId)?.get(item.id) ?? 0;
        return {
          poItemId: item.id,
          label: itemLabel(item),
          planned,
          received: got,
          pending: qtyRemaining(planned, got),
          complete: planned > 0 ? isReceiptComplete(got, planned, underTolerancePercent) : true,
        };
      })
      .filter((l) => l.planned > 0 || l.received > 0);

  const points: DeliveryProgressPoint[] = [];
  if (plan.mode === 'SPLIT') {
    for (const p of po.deliveryPoints) {
      const lines = lineRows(p.warehouseId, (id) => Number(p.lines.find((l) => l.poItemId === id)?.quantity ?? 0));
      points.push({
        id: p.id,
        sequence: p.sequence,
        warehouseId: p.warehouseId,
        warehouseName: p.warehouse.warehouseName,
        planned: true,
        lines,
        complete: lines.every((l) => l.complete),
      });
    }
  } else if (plan.mode === 'ONE_PLACE') {
    const place = plan.points[0];
    const lines = lineRows(place.warehouseId, (id) => Number(items.find((i) => i.id === id)?.orderedQuantity ?? 0));
    points.push({
      id: null,
      sequence: null,
      warehouseId: place.warehouseId,
      warehouseName: place.warehouseName,
      planned: true,
      lines,
      complete: lines.every((l) => l.complete),
    });
  }
  const plannedPlaces = new Set(points.map((p) => p.warehouseId));
  const extra = [...received.keys()].filter((k) => k !== '__none__' && !plannedPlaces.has(k));
  if (extra.length > 0) {
    const names = await client.warehouses.findMany({
      where: { id: { in: extra } },
      select: { id: true, warehouseName: true },
    });
    for (const id of extra) {
      const lines = lineRows(id, () => 0);
      points.push({
        id: null,
        sequence: null,
        warehouseId: id,
        warehouseName: names.find((n) => n.id === id)?.warehouseName ?? 'Unknown place',
        planned: false,
        lines,
        complete: true,
      });
    }
  }
  const unplaced = [...(received.get('__none__')?.entries() ?? [])].map(([poItemId, qty]) => ({
    poItemId,
    received: qty,
  }));
  return { poId, mode: plan.mode, points, unplaced };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A receipt against the plan (GRN create)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface ReceiptPointResolution {
  poDeliveryPointId: string | null;
  warehouseId: string | null;
  /** Soft: over the place's plan, or booked somewhere other than planned. Never blocks. */
  warnings: string[];
}

/**
 * Which point a new receipt delivers against, and where it is booked. On a split PO the point is
 * required (inferred when the chosen warehouse is exactly one point's place) and the warehouse defaults
 * to the point's. The line's own hard cap (ordered + over-receipt tolerance) stays in createGRN.
 */
export async function resolveReceiptDeliveryPoint(
  client: PlanReader,
  poId: string,
  receipt: {
    poDeliveryPointId?: string | null;
    warehouseId?: string | null;
    items: Array<{ poItemId: string; receivedQuantity: number; foldLengthCm?: number | null }>;
  }
): Promise<ReceiptPointResolution> {
  const po = await loadPlanPo(client, poId);
  const warehouseId = receipt.warehouseId || null;
  if (po.deliveryPoints.length === 0) {
    if (receipt.poDeliveryPointId) {
      throw new BusinessError(`${po.poNumber} is not split — receive it without a delivery point.`, {
        code: 'DELIVERY_POINT_NOT_ON_PO',
      });
    }
    return { poDeliveryPointId: null, warehouseId, warnings: [] };
  }

  let point = receipt.poDeliveryPointId ? po.deliveryPoints.find((p) => p.id === receipt.poDeliveryPointId) : undefined;
  if (receipt.poDeliveryPointId && !point) {
    throw new BusinessError(`That delivery point is not on ${po.poNumber} — pick one of its places.`, {
      code: 'DELIVERY_POINT_NOT_ON_PO',
    });
  }
  if (!point && warehouseId) point = po.deliveryPoints.find((p) => p.warehouseId === warehouseId);
  if (!point) {
    throw new BusinessError(
      `${po.poNumber} is split across ${po.deliveryPoints.map((p) => p.warehouse.warehouseName).join(', ')} — say which delivery this is.`,
      { code: 'DELIVERY_POINT_REQUIRED' }
    );
  }

  const warnings: string[] = [];
  const bookedAt = warehouseId ?? point.warehouseId;
  if (bookedAt !== point.warehouseId) {
    warnings.push(
      `Planned for ${point.warehouse.warehouseName} but booked at another place — check it is where the goods arrived.`
    );
  }
  const pointWarehouse = new Map(po.deliveryPoints.map((p) => [p.id, p.warehouseId]));
  const received = foldReceipts(po.goods_receiving_notes, pointWarehouse).get(point.warehouseId);
  for (const line of receipt.items) {
    const planned = Number(point.lines.find((l) => l.poItemId === line.poItemId)?.quantity ?? 0);
    const already = received?.get(line.poItemId) ?? 0;
    const incoming = foldActual(line.receivedQuantity, line.foldLengthCm ?? null).toNumber();
    if (qtyExceeds(already + incoming, planned)) {
      const item = po.purchase_order_items.find((i) => i.id === line.poItemId);
      warnings.push(
        `${item ? itemLabel(item) : 'A line'}: ${point.warehouse.warehouseName} was planned for ${planned}; with this receipt it has ${round3(already + incoming)}.`
      );
    }
  }
  return { poDeliveryPointId: point.id, warehouseId: bookedAt, warnings };
}

/** Amendments so far — changes made after the PO left DRAFT. The printout's "Amendment N". */
export async function countAmendments(
  client: Pick<Prisma.TransactionClient, 'po_delivery_plan_revisions'>,
  poId: string
) {
  return client.po_delivery_plan_revisions.count({
    where: { poId, poStatus: { notIn: [...PRE_SEND_STATUSES] } },
  });
}
