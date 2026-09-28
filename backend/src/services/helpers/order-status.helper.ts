/**
 * Production-order status helper — the ONE authority for `orders.status` (2026-09-28).
 *
 * Until now nothing moved an order's status: the only writers were cancel and a hand-set
 * PATCH /orders/:id/status that no screen called. All 10 orders read PENDING while ORD2026080025 and
 * ORD2026080026 were being cut — so the list, the order page, the pipeline and every "open orders"
 * query told the factory nothing had started.
 *
 * The status is now DERIVED from facts, never set by hand (except the explicit Cancel event):
 *   DISPATCHED     every shipment group of the order has shipped (delivery notes, net of returns)
 *   COMPLETED      every live production run is COMPLETED/DISPATCHED and the runs plan the whole order
 *   IN_PRODUCTION  any run has started (in production / done, or a SPLIT parent that had started)
 *   PENDING        otherwise
 * CANCELLED and SPLIT are pinned: event states the derivation never touches.
 *
 * It is a pure function of CURRENT facts, so it moves back as readily as forward (a cancelled note
 * takes DISPATCHED back to COMPLETED; a new run takes COMPLETED back to IN_PRODUCTION) — and a sweep
 * (findOrderStatusDrift, integrity check D26) and a backfill (scripts/repair-order-status.ts) can
 * both be computed from it.
 *
 * Call syncOrderStatus inside every transaction that changes a run's status / quantity / existence or
 * a delivery note's quantities, and lock the order FIRST in that transaction (lockOrder) — two runs
 * completing together must not each read the other as still running, and the order lock taken first
 * everywhere keeps it clear of deadlocks with the sale-order line locks.
 */

import { OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { logInfo, logWarn } from '../../utils/logger';
import { qtyAtLeast } from '../../utils/quantity';
import { matchSaleOrderLine } from './sale-order-dispatch.helper';
import { releaseCompletedOrderHolds } from './po-allocation.helper';

type DbClient = Prisma.TransactionClient | PrismaClient;

/** Event states the derivation never overwrites. */
export const ORDER_PINNED_STATUSES: OrderStatus[] = ['CANCELLED', 'SPLIT'];

/** Run statuses that mean the run's production is finished. */
const DONE: OrderStatus[] = ['COMPLETED', 'DISPATCHED'];

export interface OrderStatusFacts {
  /** The order's production runs, CANCELLED ones excluded */
  runs: Array<{
    number: string;
    status: OrderStatus;
    totalQuantity: number;
    orderItemId: string | null;
    /** actualStartDate is set — decides whether a SPLIT parent had started */
    started: boolean;
  }>;
  /** The order's lines and the quantity each must produce */
  items: Array<{ id: string; quantity: number }>;
  /** What has to ship, one group per SKU / sale-order line, and what has shipped (net of returns) */
  shipments: Array<{ label: string; ordered: number; shipped: number }>;
}

export interface DerivedOrderStatus {
  status: OrderStatus;
  reason: string;
}

/** Pure derivation, first match wins. */
export function deriveOrderStatus(facts: OrderStatusFacts): DerivedOrderStatus {
  const { runs, items, shipments } = facts;

  // 1. Shipment facts outrank production facts (same rule as the sale-order status helper).
  if (shipments.length > 0 && shipments.every((s) => qtyAtLeast(s.shipped, s.ordered))) {
    return { status: 'DISPATCHED', reason: `all ${shipments.length} shipment group(s) shipped` };
  }

  // 2. Every live run done, and the runs plan the whole order. SPLIT parents are replaced by their
  // children; counting both would plan the quantity twice.
  const live = runs.filter((r) => r.status !== 'SPLIT');
  if (live.length > 0 && live.every((r) => DONE.includes(r.status))) {
    let deficit = 0;
    for (const item of items) {
      const planned = live.filter((r) => r.orderItemId === item.id).reduce((sum, r) => sum + r.totalQuantity, 0);
      deficit += Math.max(0, item.quantity - planned);
    }
    // Legacy runs with no order-line link are pooled against whatever is left unplanned
    const pool = live.filter((r) => !r.orderItemId).reduce((sum, r) => sum + r.totalQuantity, 0);
    if (qtyAtLeast(pool, deficit)) {
      return { status: 'COMPLETED', reason: `all ${live.length} production run(s) completed` };
    }
  }

  // 3. Anything started
  const started = runs.find(
    (r) => r.status === 'IN_PRODUCTION' || DONE.includes(r.status) || (r.status === 'SPLIT' && r.started)
  );
  if (started) {
    return { status: 'IN_PRODUCTION', reason: `${started.number} ${started.status.toLowerCase().replace('_', ' ')}` };
  }

  return {
    status: 'PENDING',
    reason: runs.length === 0 ? 'no production run yet' : 'no production run has started',
  };
}

/** Row-lock the order for the rest of the caller's transaction. Call it FIRST in that transaction. */
export async function lockOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
}

/** The one active production order of a sale order (partial unique index orders_saleOrderId_active_key). */
export async function linkedOrderIdOf(
  client: DbClient,
  saleOrderId: string | null | undefined
): Promise<string | null> {
  if (!saleOrderId) return null;
  const order = await client.orders.findFirst({
    where: { saleOrderId, isActive: true },
    select: { id: true },
  });
  return order?.id ?? null;
}

/** The facts the derivation reads, matched by ID only. */
export async function loadOrderStatusFacts(client: DbClient, orderId: string): Promise<OrderStatusFacts | null> {
  const order = await client.orders.findUnique({
    where: { id: orderId },
    select: {
      saleOrderId: true,
      order_items: {
        select: {
          id: true,
          styleId: true,
          totalQuantity: true,
          order_item_breakup: { select: { colorId: true, sizeId: true, quantity: true } },
        },
      },
      work_orders: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          workOrderNumber: true,
          status: true,
          totalQuantity: true,
          orderItemId: true,
          actualStartDate: true,
        },
      },
    },
  });
  if (!order) return null;

  const runs = order.work_orders.map((r) => ({
    number: r.workOrderNumber,
    status: r.status,
    totalQuantity: r.totalQuantity,
    orderItemId: r.orderItemId,
    started: r.actualStartDate !== null,
  }));
  const items = order.order_items.map((i) => ({ id: i.id, quantity: i.totalQuantity }));

  // Notes raised against the ORDER (order mode). On a linked order, those that also carry the sale
  // order are already in the lines' dispatchedQty — only notes raised before the link add to it.
  const orderNoteLines = await client.delivery_note_items.findMany({
    where: {
      delivery_notes: {
        orderId,
        status: { not: 'CANCELLED' },
        ...(order.saleOrderId ? { saleOrderId: null } : {}),
      },
    },
    select: { styleId: true, colorId: true, sizeId: true, quantity: true, receivedQty: true },
  });
  // Once a proof of delivery is in, what the buyer kept
  const kept = (line: { quantity: number; receivedQty: number | null }) => line.receivedQty ?? line.quantity;

  const shipments: OrderStatusFacts['shipments'] = [];

  if (order.saleOrderId) {
    // Linked: the sale-order lines this order's SKUs belong to, each against its OWN ordered quantity.
    // Stock-covered and produced pieces ship interchangeably, so this can lag but never claims early.
    const lines = await client.sale_order_items.findMany({
      where: { saleOrderId: order.saleOrderId },
      select: { id: true, styleId: true, colorId: true, sizeId: true, quantity: true, dispatchedQty: true },
    });
    const shipped = new Map(lines.map((l) => [l.id, l.dispatchedQty]));
    for (const note of orderNoteLines) {
      const line = matchSaleOrderLine(lines, note);
      if (line) shipped.set(line.id, (shipped.get(line.id) ?? 0) + kept(note));
    }

    const relevant = new Set<string>();
    for (const item of order.order_items) {
      if (item.order_item_breakup.length === 0) {
        // Sizes not given yet: every line of the style is this item's
        for (const l of lines) if (l.styleId === item.styleId) relevant.add(l.id);
        continue;
      }
      for (const b of item.order_item_breakup) {
        const line = matchSaleOrderLine(lines, { styleId: item.styleId, colorId: b.colorId ?? '', sizeId: b.sizeId });
        if (line) relevant.add(line.id);
        else
          shipments.push({
            label: `${item.styleId}/${b.sizeId} (no sale-order line)`,
            ordered: b.quantity,
            shipped: 0,
          });
      }
    }
    for (const l of lines) {
      if (relevant.has(l.id))
        shipments.push({ label: `line ${l.id}`, ordered: l.quantity, shipped: shipped.get(l.id) ?? 0 });
    }
  } else {
    // Unlinked: per breakup SKU, the key the delivery-note cap already uses (dispatch.controller.ts)
    const key = (styleId: string, colorId: string | null, sizeId: string) => `${styleId}|${colorId ?? ''}|${sizeId}`;
    const shippedBySku = new Map<string, number>();
    let shippedTotal = 0;
    for (const note of orderNoteLines) {
      const k = key(note.styleId, note.colorId, note.sizeId);
      shippedBySku.set(k, (shippedBySku.get(k) ?? 0) + kept(note));
      shippedTotal += kept(note);
    }
    const everyItemHasSizes =
      order.order_items.length > 0 && order.order_items.every((i) => i.order_item_breakup.length > 0);
    if (everyItemHasSizes) {
      for (const item of order.order_items) {
        for (const b of item.order_item_breakup) {
          const k = key(item.styleId, b.colorId, b.sizeId);
          shipments.push({ label: k, ordered: b.quantity, shipped: shippedBySku.get(k) ?? 0 });
        }
      }
    } else if (order.order_items.length > 0) {
      // Sizes-later order: one order-level group, the same backstop the delivery-note cap applies
      const ordered = order.order_items.reduce((sum, i) => sum + i.totalQuantity, 0);
      shipments.push({ label: 'order total', ordered, shipped: shippedTotal });
    }
  }

  return { runs, items, shipments };
}

/**
 * Re-derive and persist the order's status inside the caller's transaction. Returns the status it
 * holds afterwards, or null when there is nothing to do (no order id, order gone, inactive).
 * Never throws on odd data: a writer's own work (e.g. finishing completion) must not be lost to a
 * status recompute — a failure is logged and the sweep (D26) catches the drift.
 */
export async function syncOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: string | null | undefined
): Promise<OrderStatus | null> {
  if (!orderId) return null;
  try {
    await lockOrder(tx, orderId);
    const order = await tx.orders.findUnique({ where: { id: orderId }, select: { status: true, isActive: true } });
    if (!order || !order.isActive) return null;
    if (ORDER_PINNED_STATUSES.includes(order.status)) return order.status;

    const facts = await loadOrderStatusFacts(tx, orderId);
    if (!facts) return null;
    const { status, reason } = deriveOrderStatus(facts);
    if (status !== order.status) {
      // Guarded write: a concurrent cancel wins — the pin is re-checked in the WHERE.
      await tx.orders.updateMany({
        where: { id: orderId, status: { notIn: ORDER_PINNED_STATUSES } },
        data: { status }, // allow-order-status: the derivation authority itself
      });
      logInfo(`[OrderStatus] ${orderId} ${order.status} -> ${status} (${reason})`);
      // A finished order's leftover receipt holds go back to free stock (owner 2026-09-28, po-allocation D11)
      if (DONE.includes(status)) await releaseCompletedOrderHolds(tx, orderId);
    }
    return status;
  } catch (err) {
    // A failed SQL statement has already aborted the transaction — rethrow so the caller sees it.
    if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientUnknownRequestError) {
      throw err;
    }
    logWarn('[OrderStatus] could not derive the order status', { orderId, error: String(err) });
    return null;
  }
}

/** Orders whose stored status is not what their runs and delivery notes say. */
export async function findOrderStatusDrift(
  client: DbClient
): Promise<Array<{ orderId: string; orderNumber: string; stored: OrderStatus; derived: OrderStatus; reason: string }>> {
  const orders = await client.orders.findMany({
    where: { isActive: true, status: { notIn: ORDER_PINNED_STATUSES } },
    select: { id: true, orderNumber: true, status: true },
    orderBy: { orderNumber: 'asc' },
  });
  const drift = [];
  for (const o of orders) {
    const facts = await loadOrderStatusFacts(client, o.id);
    if (!facts) continue;
    const { status, reason } = deriveOrderStatus(facts);
    if (status !== o.status)
      drift.push({ orderId: o.id, orderNumber: o.orderNumber, stored: o.status, derived: status, reason });
  }
  return drift;
}
