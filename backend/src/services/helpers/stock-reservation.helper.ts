/**
 * Requirement stock reservations — the ONE place that reserves, releases and consumes lot quantity held
 * for a material requirement (2026-09-26).
 *
 * Before: allocateStock bumped lots' quantityReserved and wrote ONE stock_reservations row with no lot.
 * Nothing released it when the requirement was cancelled (a new order BOM version, a requirement cancel,
 * an order cancel, an MRP recalculation), so the cloth stayed "reserved" for a requirement that no longer
 * existed and every later netting saw less free stock than was on the shelf. The job-work issue released
 * the lots the cloth was TAKEN from, not the lots that were RESERVED — stripping another order's hold and
 * leaking the real one — and marked every reservation consumed even on a part issue.
 *
 * Now every reservation row names its lot (greigeStockId / fabricStockId / laceStockId), and:
 *   reserveOnLots          one row per lot, and that lot's quantityReserved goes up by the same amount
 *   releaseReservations    cancel / shrink: newest first, each row gives back to ITS OWN lot
 *   consumeReservations    an issue: up to the quantity issued, issued lots first, each row's own lot
 *   unconsumeReservations  goods given back (job-work cancel, challan receive-back): the hold comes back
 *
 * TWO KINDS OF HOLD (2026-09-29, PO allocation D2). A row with `poLinkId` is a RECEIPT hold: goods that arrived
 * on a PO line linked to the requirement, held for it by helpers/receipt-allocation.helper.ts, which rebuilds
 * them from scratch on every receipt event (releaseLinkHolds, then reserveOnLots with the link). A row without
 * one is a USE STOCK hold (allocateStock). Receipt holds never change a requirement's allocatedFromStock, so
 * anything that squares holds against allocatedFromStock (reconcile) reads kind 'stock' only.
 * Trims have no lot table: their holds of either kind are rows with no lot.
 *
 * Convention (project_stock_reserved_semantics): a lot's quantityReserved is the claimed subset of what is
 * still physically there; quantityAvailable only falls when cloth actually leaves.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { isQtyZero, qtyAtLeast, qtyExceeds } from '../../utils/quantity';
import { logWarn } from '../../utils/logger';
import { STORE_POOL, receiptPoolOf } from './receipt-split.helper';

type Tx = Prisma.TransactionClient;
type Db = Prisma.TransactionClient | typeof prisma;

export type LotTable = 'greige' | 'fabric' | 'lace';

/** Which holds a call acts on: Use Stock ('stock', no poLinkId), receipt ('receipt', poLinkId set), or both. */
export type HoldKind = 'stock' | 'receipt' | 'all';

export interface LotReservation {
  table: LotTable;
  lotId: string;
  /** The lot's warehouse — the reservation row requires one */
  warehouseId: string | null;
  quantity: number;
}

const REFERENCE_TYPE = 'MATERIAL_REQUIREMENT';

/** Material types whose holds sit on a lot table; any other type's rows carry no lot by design. */
const LOT_TRACKED_TYPES = new Set(['GREIGE', 'FABRIC', 'LACE']);

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Move a lot's quantityReserved by `delta` in ONE statement. It used to read then write, so two holds placed
 * on one lot at once could each read the same figure and one of them was lost. Never below zero: another
 * writer (the other quantityReserved convention) may already have taken it. The lot column is 2 dp; the
 * database rounds what it stores.
 */
async function adjustLotReserved(tx: Tx, table: LotTable, lotId: string, delta: number): Promise<void> {
  if (isQtyZero(delta)) return;
  const d = new Prisma.Decimal(round3(delta));
  // A lot deleted since updates nothing — there is nothing left to give back
  if (table === 'greige') {
    await tx.$executeRaw`UPDATE greige_stock SET "quantityReserved" = GREATEST(0, "quantityReserved" + ${d}), "updatedAt" = NOW() WHERE id = ${lotId}`;
  } else if (table === 'fabric') {
    await tx.$executeRaw`UPDATE fabric_stock SET "quantityReserved" = GREATEST(0, "quantityReserved" + ${d}), "updatedAt" = NOW() WHERE id = ${lotId}`;
  } else {
    await tx.$executeRaw`UPDATE lace_stock SET "quantityReserved" = GREATEST(0, "quantityReserved" + ${d}), "updatedAt" = NOW() WHERE id = ${lotId}`;
  }
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

function kindWhere(kind: HoldKind): Prisma.stock_reservationsWhereInput {
  if (kind === 'stock') return { poLinkId: null };
  if (kind === 'receipt') return { poLinkId: { not: null } };
  return {};
}

/**
 * Reserve quantity on specific lots for a requirement: one stock_reservations row per lot, and each lot's
 * quantityReserved goes up by exactly what its row records. The caller chooses the lots (allocateStock
 * applies the lot-location rule and FIFO) and must not ask for more than a lot has free.
 * A trim allocation (no lot table) passes a single entry with no lot via `untrackedQuantity`.
 * `poLinkId` makes every row written a RECEIPT hold for that PO link (receipt-allocation.helper).
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
    /** Set = these rows are receipt holds for this PO link; unset = Use Stock holds */
    poLinkId?: string | null;
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
    poLinkId: args.poLinkId ?? null,
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
        reservedAt: new Date(startedAt + order++),
        reservedQuantity: new Prisma.Decimal(round3(args.untrackedQuantity)),
      },
    });
  }
}

const ROW_SELECT = {
  id: true,
  reservedQuantity: true,
  consumedQuantity: true,
  greigeStockId: true,
  fabricStockId: true,
  laceStockId: true,
  referenceId: true,
  poLinkId: true,
  materials: { select: { materialType: true } },
} as const;

type ActiveRow = Prisma.stock_reservationsGetPayload<{ select: typeof ROW_SELECT }>;

async function activeRows(tx: Db, requirementIds: string[], kind: HoldKind = 'all'): Promise<ActiveRow[]> {
  if (requirementIds.length === 0) return [];
  return tx.stock_reservations.findMany({
    where: { referenceType: REFERENCE_TYPE, referenceId: { in: requirementIds }, status: 'ACTIVE', ...kindWhere(kind) },
    orderBy: { reservedAt: 'desc' }, // newest first
    select: ROW_SELECT,
  });
}

const held = (row: { reservedQuantity: Prisma.Decimal; consumedQuantity: Prisma.Decimal }) =>
  round3(Number(row.reservedQuantity) - Number(row.consumedQuantity));

/** Close a row whose hold is gone: CONSUMED if any of it was used, CANCELLED if none was. */
function closedStatus(row: ActiveRow, extraConsumed = 0): 'CONSUMED' | 'CANCELLED' {
  return Number(row.consumedQuantity) + extraConsumed > 0 ? 'CONSUMED' : 'CANCELLED';
}

/** Give `give` of a row's hold back to its lot, closing the row when nothing of it is left held. */
async function giveBack(tx: Tx, row: ActiveRow, give: number, now: Date): Promise<void> {
  const hold = held(row);
  const lot = lotOf(row);
  if (lot) await adjustLotReserved(tx, lot.table, lot.lotId, -give);
  else if (hold > 0 && !row.poLinkId && LOT_TRACKED_TYPES.has(row.materials.materialType)) {
    // A greige / fabric / lace row written before 2026-09-26 with no lot: nothing on a lot to give back (legacy
    // rows are mapped to lots by scripts/backfill-reservation-lots.ts). Trims and receipt holds never have one.
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
}

/**
 * Give reserved quantity back to its lots — a requirement cancelled, or shrunk by a new BOM version.
 * `quantity` omitted = everything the requirements still hold. Newest reservation first. Returns what
 * was released. `kind` limits it to Use Stock or receipt holds (default: both, as before 2026-09-29).
 */
export async function releaseReservations(
  tx: Tx,
  requirementIds: string[],
  quantity?: number,
  opts: { kind?: HoldKind } = {}
): Promise<number> {
  const rows = await activeRows(tx, requirementIds, opts.kind ?? 'all');
  let left = quantity ?? Number.POSITIVE_INFINITY;
  let released = 0;
  const now = new Date();

  for (const row of rows) {
    if (quantity !== undefined && (isQtyZero(left) || left < 0)) break;
    const hold = held(row);
    if (hold <= 0) continue;
    const give = quantity === undefined ? hold : Math.min(hold, left);
    await giveBack(tx, row, give, now);
    left -= give;
    released += give;
  }
  return round3(released);
}

/**
 * Release every ACTIVE receipt hold of these PO links, each back to its own lot. The receipt engine runs this
 * before it rebuilds a line's holds; a link's holds must also be released before the link is deleted.
 * Rows keep what they consumed (CONSUMED), so a link's issued floor survives the rebuild. Returns what was freed.
 */
export async function releaseLinkHolds(tx: Tx, linkIds: string[]): Promise<number> {
  if (linkIds.length === 0) return 0;
  const rows = await tx.stock_reservations.findMany({
    where: { poLinkId: { in: linkIds }, status: 'ACTIVE' },
    orderBy: { reservedAt: 'desc' },
    select: ROW_SELECT,
  });
  const now = new Date();
  let released = 0;
  for (const row of rows) {
    const hold = Math.max(0, held(row));
    await giveBack(tx, row, hold, now);
    released += hold;
  }
  return round3(released);
}

/**
 * An issue fulfilled (part of) what these requirements hold: consume up to `quantity` of their holds, each
 * giving back to ITS OWN lot (the issued lot's quantityAvailable is reduced by the issue itself). Whatever
 * was not issued stays held. Returns what was consumed.
 *
 * Order (C8): rows on the issued lots first; within that, the order's own Use Stock holds before its receipt
 * holds; newest first. Using its own stock first keeps what the PO link has issued (its floor) low, so fewer
 * GRN reversals are refused later.
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
  const rank = (row: ActiveRow) => {
    const lot = lotOf(row);
    return (lot && issued.has(lot.lotId) ? 0 : 2) + (row.poLinkId ? 1 : 0);
  };
  // Array sort is stable, so rows keep newest-first within each rank
  const rows = (await activeRows(tx, requirementIds)).sort((a, b) => rank(a) - rank(b));

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

/** A requirement in this state, or of an order in one of these, holds nothing — goods given back stay free */
const HOLDS_NOTHING_REQUIREMENT_STATUSES = ['CANCELLED'] as const;
const HOLDS_NOTHING_ORDER_STATUSES = ['CANCELLED', 'COMPLETED', 'DISPATCHED'] as const;

/**
 * Goods issued against these requirements came back (a job-work cancel, a challan receive-back): give the
 * requirements their hold back (C9). Works from the newest consumed rows, rows on the returned lots first:
 * each row's consumedQuantity goes down by what it gives back, a CONSUMED row is ACTIVE again, and its own
 * lot's quantityReserved goes back up. Before this, returned cloth came back free and another order could
 * take it. Returns what was restored.
 *
 * Only for a requirement that may still hold goods: a cancelled one, or one of a cancelled / completed /
 * dispatched order (D11), gets nothing back — what came back is free stock. A Use Stock hold (no PO link)
 * comes back only up to what the requirement took from stock (allocatedFromStock, less what it holds now): a
 * receipt hold whose link was deleted since (poLinkId SET NULL) must not come back as a Use Stock hold nobody
 * counts.
 */
export async function unconsumeReservations(
  tx: Tx,
  requirementIds: string[],
  quantity: number,
  returnedLotIds: string[] = []
): Promise<number> {
  if (requirementIds.length === 0 || isQtyZero(quantity) || quantity < 0) return 0;
  const reqs = await tx.material_requirements.findMany({
    where: { id: { in: [...new Set(requirementIds)] } },
    select: { id: true, status: true, allocatedFromStock: true, orders: { select: { status: true } } },
  });
  const holding = reqs.filter(
    (r) =>
      !(HOLDS_NOTHING_REQUIREMENT_STATUSES as readonly string[]).includes(r.status) &&
      !(HOLDS_NOTHING_ORDER_STATUSES as readonly string[]).includes(r.orders?.status ?? '')
  );
  if (holding.length === 0) return 0;
  const holdingIds = holding.map((r) => r.id);

  // What each requirement may still hold from stock: what it took from stock, less its ACTIVE Use Stock holds
  const stockRoom = new Map(holding.map((r) => [r.id, Number(r.allocatedFromStock)]));
  for (const row of await activeRows(tx, holdingIds, 'stock')) {
    stockRoom.set(row.referenceId, round3((stockRoom.get(row.referenceId) ?? 0) - Math.max(0, held(row))));
  }

  const returned = new Set(returnedLotIds);
  const rows = (
    await tx.stock_reservations.findMany({
      where: {
        referenceType: REFERENCE_TYPE,
        referenceId: { in: holdingIds },
        status: { in: ['ACTIVE', 'CONSUMED'] },
        consumedQuantity: { gt: 0 },
      },
      orderBy: [{ reservedAt: 'desc' }, { id: 'desc' }],
      select: ROW_SELECT,
    })
  ).sort((a, b) => {
    const la = lotOf(a);
    const lb = lotOf(b);
    return (la && returned.has(la.lotId) ? 0 : 1) - (lb && returned.has(lb.lotId) ? 0 : 1);
  });

  let left = quantity;
  let restored = 0;
  for (const row of rows) {
    if (isQtyZero(left) || left < 0) break;
    let back = Math.min(Number(row.consumedQuantity), left);
    if (!row.poLinkId) back = Math.min(back, Math.max(0, stockRoom.get(row.referenceId) ?? 0));
    if (isQtyZero(back)) continue;
    const lot = lotOf(row);
    if (lot) await adjustLotReserved(tx, lot.table, lot.lotId, back);
    await tx.stock_reservations.update({
      where: { id: row.id },
      data: {
        consumedQuantity: { decrement: new Prisma.Decimal(round3(back)) },
        status: 'ACTIVE',
        completedAt: null,
      },
    });
    if (!row.poLinkId) stockRoom.set(row.referenceId, round3((stockRoom.get(row.referenceId) ?? 0) - back));
    left -= back;
    restored += back;
  }
  return round3(restored);
}

/** What the requirement actually holds right now (ACTIVE rows, net of consumption). */
export async function heldForRequirement(tx: Db, requirementId: string, kind: HoldKind = 'all'): Promise<number> {
  const rows = await activeRows(tx, [requirementId], kind);
  return round3(rows.reduce((sum, r) => sum + Math.max(0, held(r)), 0));
}

/**
 * What each PO link has ISSUED from its receipt holds, per location pool — every status, so a hold that was
 * released and rebuilt still counts what it consumed. A lot's pool is the pool of the GRN whose line booked it
 * (receiptPoolOf); a lot with no receipt line is placed by its own warehouse; a row with no lot (trims) is STORE.
 * These are the floors of the fill: what a link issued is never taken back from it.
 */
export async function consumedByLinkPool(client: Db, linkIds: string[]): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>();
  if (linkIds.length === 0) return out;
  const place = { warehouseType: true, supplierId: true } as const;
  const lotPlace = {
    select: {
      warehouse: { select: place },
      grnItem: { select: { goods_receiving_notes: { select: { warehouses: { select: place } } } } },
    },
  } as const;
  const rows = await client.stock_reservations.findMany({
    where: { poLinkId: { in: linkIds }, consumedQuantity: { gt: 0 } },
    select: {
      poLinkId: true,
      consumedQuantity: true,
      greigeStock: lotPlace,
      laceStock: lotPlace,
      fabricStock: lotPlace,
    },
  });
  for (const row of rows) {
    const lot = row.greigeStock ?? row.laceStock ?? row.fabricStock;
    const pool = lot
      ? receiptPoolOf(lot.grnItem?.goods_receiving_notes.warehouses ?? lot.warehouse ?? null)
      : STORE_POOL;
    const rec = out.get(row.poLinkId!) ?? {};
    rec[pool] = round3((rec[pool] ?? 0) + Number(row.consumedQuantity));
    out.set(row.poLinkId!, rec);
  }
  return out;
}

/**
 * ACTIVE holds with no lot (trims — Use Stock and receipt holds alike), net of consumption, per material. What a
 * trim material has on hand minus this is what is free to issue or hold. `excludeOrderId` leaves out that order's
 * own holds (an order may always take what is held for itself).
 */
export async function untrackedHeldByMaterial(
  client: Db,
  materialIds: string[],
  opts: { excludeOrderId?: string } = {}
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (materialIds.length === 0) return out;
  const rows = await client.stock_reservations.findMany({
    where: {
      referenceType: REFERENCE_TYPE,
      materialId: { in: materialIds },
      status: 'ACTIVE',
      greigeStockId: null,
      fabricStockId: null,
      laceStockId: null,
    },
    select: { materialId: true, referenceId: true, reservedQuantity: true, consumedQuantity: true },
  });
  let skip = new Set<string>();
  if (opts.excludeOrderId && rows.length > 0) {
    const own = await client.material_requirements.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.referenceId))] }, orderId: opts.excludeOrderId },
      select: { id: true },
    });
    skip = new Set(own.map((r) => r.id));
  }
  for (const row of rows) {
    if (skip.has(row.referenceId)) continue;
    const hold = held(row);
    if (!qtyExceeds(hold, 0)) continue;
    out.set(row.materialId, round3((out.get(row.materialId) ?? 0) + hold));
  }
  return out;
}

/** ACTIVE receipt holds (goods that arrived on a linked PO line), net of consumption, per requirement. */
export async function receiptHeldByRequirement(client: Db, requirementIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (requirementIds.length === 0) return out;
  const rows = await client.stock_reservations.findMany({
    where: {
      referenceType: REFERENCE_TYPE,
      referenceId: { in: requirementIds },
      status: 'ACTIVE',
      poLinkId: { not: null },
    },
    select: { referenceId: true, reservedQuantity: true, consumedQuantity: true },
  });
  for (const row of rows) {
    const hold = held(row);
    if (!qtyExceeds(hold, 0)) continue;
    out.set(row.referenceId, round3((out.get(row.referenceId) ?? 0) + hold));
  }
  return out;
}
