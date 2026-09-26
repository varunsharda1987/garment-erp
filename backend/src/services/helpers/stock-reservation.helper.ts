/**
 * Requirement stock reservations — the ONE place that reserves, releases and consumes lot quantity held
 * for a material requirement (2026-09-26).
 *
 * Before: allocateStock bumped lots' quantityReserved and wrote ONE stock_reservations row with no lot.
 * Nothing released it when the requirement was cancelled (a new order BOM version, a requirement cancel,
 * an order cancel, an MRP recalculation), so the cloth stayed "reserved" for a requirement that no longer
 * existed and every later netting saw less free stock than was on the shelf. The job-work issue released
 * the lots the cloth was TAKEN from, not the lots that were RESERVED — stripping another order's hold and
 * leaking the real one — and marked every reservation consumed even on a partial issue.
 *
 * Now every reservation row names its lot (greigeStockId / fabricStockId / laceStockId), and:
 *   reserveOnLots          one row per lot, and that lot's quantityReserved goes up by the same amount
 *   releaseReservations    cancel / shrink: newest first, each row gives back to ITS OWN lot
 *   consumeReservations    job-work issue: up to the quantity issued, issued lots first, each row's own lot
 *
 * Convention (project_stock_reserved_semantics): a lot's quantityReserved is the claimed subset of what is
 * still physically there; quantityAvailable only falls when cloth actually leaves.
 */

import { Prisma } from '@prisma/client';
import { isQtyZero, qtyAtLeast } from '../../utils/quantity';
import { logWarn } from '../../utils/logger';

type Tx = Prisma.TransactionClient;

export type LotTable = 'greige' | 'fabric' | 'lace';

export interface LotReservation {
  table: LotTable;
  lotId: string;
  /** The lot's warehouse — the reservation row requires one */
  warehouseId: string | null;
  quantity: number;
}

const REFERENCE_TYPE = 'MATERIAL_REQUIREMENT';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

async function adjustLotReserved(tx: Tx, table: LotTable, lotId: string, delta: number): Promise<void> {
  if (isQtyZero(delta)) return;
  const read =
    table === 'greige'
      ? tx.greige_stock.findUnique({ where: { id: lotId }, select: { quantityReserved: true } })
      : table === 'fabric'
        ? tx.fabric_stock.findUnique({ where: { id: lotId }, select: { quantityReserved: true } })
        : tx.lace_stock.findUnique({ where: { id: lotId }, select: { quantityReserved: true } });
  const lot = await read;
  if (!lot) return; // lot deleted since — nothing left to give back
  // Never below zero: another writer (the other quantityReserved convention) may already have taken it
  const next = Math.max(0, round3(Number(lot.quantityReserved ?? 0) + delta));
  const data = { quantityReserved: new Prisma.Decimal(next) };
  if (table === 'greige') await tx.greige_stock.update({ where: { id: lotId }, data });
  else if (table === 'fabric') await tx.fabric_stock.update({ where: { id: lotId }, data });
  else await tx.lace_stock.update({ where: { id: lotId }, data });
}

function lotOf(row: {
  greigeStockId: string | null;
  fabricStockId: string | null;
  laceStockId: string | null;
}): { table: LotTable; lotId: string } | null {
  if (row.greigeStockId) return { table: 'greige', lotId: row.greigeStockId };
  if (row.fabricStockId) return { table: 'fabric', lotId: row.fabricStockId };
  if (row.laceStockId) return { table: 'lace', lotId: row.laceStockId };
  return null;
}

/**
 * Reserve quantity on specific lots for a requirement: one stock_reservations row per lot, and each lot's
 * quantityReserved goes up by exactly what its row records. The caller chooses the lots (allocateStock
 * applies the lot-location rule and FIFO) and must not ask for more than a lot has free.
 * A trim allocation (no lot table) passes a single entry with no lot via `untrackedWarehouseId`.
 */
export async function reserveOnLots(
  tx: Tx,
  args: {
    requirement: { id: string; requirementNumber: string; materialId: string; unit: string };
    lots: LotReservation[];
    userId: string;
    /** Fallback warehouse for a lot with none, and the warehouse of an untracked (trim) reservation */
    fallbackWarehouseId: string | null;
    /** Trims: record the allocation without a lot (no lot quantity is bumped) */
    untrackedQuantity?: number;
  }
): Promise<void> {
  const { requirement, userId, fallbackWarehouseId } = args;
  const base = {
    materialId: requirement.materialId,
    reservationType: 'ORDER' as const,
    referenceType: REFERENCE_TYPE,
    referenceId: requirement.id,
    referenceNumber: requirement.requirementNumber,
    unit: requirement.unit as never,
    status: 'ACTIVE' as const,
    reservedById: userId,
  };

  // Rows of one allocation share a transaction timestamp; stamp them a millisecond apart in allocation
  // order so "newest first" (releases) is well defined — the last lot reserved is given back first.
  const startedAt = Date.now();
  let order = 0;
  for (const lot of args.lots) {
    if (isQtyZero(lot.quantity)) continue;
    const warehouseId = lot.warehouseId ?? fallbackWarehouseId;
    if (!warehouseId) {
      throw new Error(`Cannot reserve on ${lot.table} lot ${lot.lotId}: no warehouse to record it against`);
    }
    await adjustLotReserved(tx, lot.table, lot.lotId, lot.quantity);
    await tx.stock_reservations.create({
      data: {
        ...base,
        warehouseId,
        reservedAt: new Date(startedAt + order++),
        reservedQuantity: new Prisma.Decimal(round3(lot.quantity)),
        greigeStockId: lot.table === 'greige' ? lot.lotId : null,
        fabricStockId: lot.table === 'fabric' ? lot.lotId : null,
        laceStockId: lot.table === 'lace' ? lot.lotId : null,
      },
    });
  }

  if (args.untrackedQuantity && !isQtyZero(args.untrackedQuantity) && fallbackWarehouseId) {
    await tx.stock_reservations.create({
      data: {
        ...base,
        warehouseId: fallbackWarehouseId,
        reservedQuantity: new Prisma.Decimal(round3(args.untrackedQuantity)),
      },
    });
  }
}

type ActiveRow = {
  id: string;
  reservedQuantity: Prisma.Decimal;
  consumedQuantity: Prisma.Decimal;
  greigeStockId: string | null;
  fabricStockId: string | null;
  laceStockId: string | null;
  referenceId: string;
};

async function activeRows(tx: Tx, requirementIds: string[]): Promise<ActiveRow[]> {
  if (requirementIds.length === 0) return [];
  return tx.stock_reservations.findMany({
    where: { referenceType: REFERENCE_TYPE, referenceId: { in: requirementIds }, status: 'ACTIVE' },
    orderBy: { reservedAt: 'desc' }, // newest first
    select: {
      id: true,
      reservedQuantity: true,
      consumedQuantity: true,
      greigeStockId: true,
      fabricStockId: true,
      laceStockId: true,
      referenceId: true,
    },
  });
}

const held = (row: ActiveRow) => round3(Number(row.reservedQuantity) - Number(row.consumedQuantity));

/** Close a row whose hold is gone: CONSUMED if any of it was used, CANCELLED if none was. */
function closedStatus(row: ActiveRow, extraConsumed = 0): 'CONSUMED' | 'CANCELLED' {
  return Number(row.consumedQuantity) + extraConsumed > 0 ? 'CONSUMED' : 'CANCELLED';
}

/**
 * Give reserved quantity back to its lots — a requirement cancelled, or shrunk by a new BOM version.
 * `quantity` omitted = everything the requirements still hold. Newest reservation first. Returns what
 * was released.
 */
export async function releaseReservations(tx: Tx, requirementIds: string[], quantity?: number): Promise<number> {
  const rows = await activeRows(tx, requirementIds);
  let left = quantity ?? Number.POSITIVE_INFINITY;
  let released = 0;
  const now = new Date();

  for (const row of rows) {
    if (quantity !== undefined && (isQtyZero(left) || left < 0)) break;
    const hold = held(row);
    if (hold <= 0) continue;
    const give = quantity === undefined ? hold : Math.min(hold, left);

    const lot = lotOf(row);
    if (lot) await adjustLotReserved(tx, lot.table, lot.lotId, -give);
    else if (hold > 0) {
      // A row written before 2026-09-26 with no lot: nothing on a lot to give back (trims never bumped
      // one; legacy fabric/greige/lace rows are mapped to lots by scripts/backfill-reservation-lots.ts).
      logWarn(`[reservations] ${row.id} has no lot — closed without a lot adjustment`);
    }

    if (qtyAtLeast(give, hold)) {
      await tx.stock_reservations.update({
        where: { id: row.id },
        data: { status: closedStatus(row), completedAt: now, reservedQuantity: row.consumedQuantity },
      });
    } else {
      await tx.stock_reservations.update({
        where: { id: row.id },
        data: { reservedQuantity: { decrement: new Prisma.Decimal(round3(give)) } },
      });
    }
    left -= give;
    released += give;
  }
  return round3(released);
}

/**
 * A job-work issue fulfilled (part of) what these requirements reserved: consume up to `quantity` of their
 * holds — reservations on the issued lots first, then newest — each giving back to ITS OWN lot (the
 * issued lot's quantityAvailable is reduced by the issue itself). Whatever was not issued stays reserved.
 * Returns what was consumed.
 */
export async function consumeReservations(
  tx: Tx,
  requirementIds: string[],
  quantity: number,
  at: Date,
  issuedLotIds: string[] = []
): Promise<number> {
  if (isQtyZero(quantity) || quantity < 0) return 0;
  const issued = new Set(issuedLotIds);
  const rows = (await activeRows(tx, requirementIds)).sort((a, b) => {
    const la = lotOf(a);
    const lb = lotOf(b);
    return (la && issued.has(la.lotId) ? 0 : 1) - (lb && issued.has(lb.lotId) ? 0 : 1);
  });

  let left = quantity;
  let consumed = 0;
  for (const row of rows) {
    if (isQtyZero(left) || left < 0) break;
    const hold = held(row);
    if (hold <= 0) continue;
    const use = Math.min(hold, left);

    const lot = lotOf(row);
    if (lot) await adjustLotReserved(tx, lot.table, lot.lotId, -use);

    const newConsumed = round3(Number(row.consumedQuantity) + use);
    await tx.stock_reservations.update({
      where: { id: row.id },
      data: qtyAtLeast(use, hold)
        ? { consumedQuantity: new Prisma.Decimal(newConsumed), status: 'CONSUMED', completedAt: at }
        : { consumedQuantity: new Prisma.Decimal(newConsumed) },
    });
    left -= use;
    consumed += use;
  }
  return round3(consumed);
}

/** What the requirement actually holds on lots right now (ACTIVE rows, net of consumption). */
export async function heldForRequirement(tx: Tx, requirementId: string): Promise<number> {
  const rows = await activeRows(tx, [requirementId]);
  return round3(rows.reduce((sum, r) => sum + Math.max(0, held(r)), 0));
}
