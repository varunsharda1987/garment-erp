/**
 * Dispatch against a sale order — the ONE writer of `sale_order_items.dispatchedQty`.
 *
 * Until 2026-09-25 the only code that raised `dispatchedQty` was POST /dispatch/sale-order-dispatch,
 * which no screen and no B2B client ever called; the Delivery Note page posted to
 * POST /dispatch/delivery-notes, which linked the production order only. So no sale order could
 * reach PARTIALLY_DISPATCHED / DISPATCHED, the B2B "Dispatched" column stayed 0, and an invoice
 * raised from such a note priced every line at 0 (no saleOrderItemId to read the price from).
 * Both routes now go through this file.
 *
 * `dispatchedQty` moves when a note is CREATED, not when it leaves: deleting a PENDING note and a
 * REJECTED proof of delivery hand exactly the note's quantities back (dispatch.controller.ts).
 */
import { Prisma } from '@prisma/client';
import { ValidationError } from '../../errors';

type Tx = Prisma.TransactionClient;

/** Sale order statuses a delivery note may be raised against. */
export const DISPATCHABLE_SALE_ORDER_STATUSES = [
  'CONFIRMED',
  'PARTIALLY_ALLOCATED',
  'FULLY_ALLOCATED',
  'PARTIALLY_DISPATCHED',
] as const;

export interface SaleOrderLineRef {
  id: string;
  styleId: string;
  colorId: string | null;
  sizeId: string | null;
}

/**
 * The most a sale order line may ship in total: what was ordered plus the buyer's over-shipment
 * allowance (customers.overShipAllowancePercent — Easybuy takes up to +5 % per size, cut via the
 * Cutting Chart's Extra %). Whole pieces, rounded down, so the allowance is never exceeded.
 * Worked in hundredths of a percent so the integer division is exact.
 */
export function shipCap(ordered: number, allowancePercent: number): number {
  const hundredths = Number.isFinite(allowancePercent) && allowancePercent > 0 ? Math.round(allowancePercent * 100) : 0;
  return Math.floor((ordered * (10000 + hundredths)) / 10000);
}

/** The buyer's over-shipment allowance, in percent (0 when none is set). */
export async function overShipAllowanceOf(tx: Tx, customerId: string): Promise<number> {
  const customer = await tx.customers.findUnique({
    where: { id: customerId },
    select: { overShipAllowancePercent: true },
  });
  return Number(customer?.overShipAllowancePercent ?? 0);
}

/**
 * Which sale order line a dispatched SKU belongs to: the line of that exact colour, else a line of
 * the same style and size that has NO colour — the buyer ordered the size, and allocation already
 * accepts any colour of the style for such a line (saleOrder.service.ts allocateStock). A line with
 * no size never matches: the buyer's size split has to be known before it can be shipped.
 */
export function matchSaleOrderLine<T extends SaleOrderLineRef>(
  lines: T[],
  sku: { styleId: string; colorId: string; sizeId: string }
): T | undefined {
  const sameSize = lines.filter((l) => l.styleId === sku.styleId && l.sizeId === sku.sizeId);
  return sameSize.find((l) => l.colorId === sku.colorId) ?? sameSize.find((l) => !l.colorId);
}

/**
 * The colour a sale order line ships in: the one asked for, else the line's own, else the style's
 * only colour. A several-colour style with a colourless line must be told which — the same rule the
 * size breakdown applies (order.controller.ts applyOrderItemSizeBreakup).
 */
export async function shippingColourFor(
  tx: Tx,
  line: SaleOrderLineRef & { styleCode?: string },
  requestedColorId?: string | null
): Promise<string> {
  if (requestedColorId) {
    if (line.colorId && line.colorId !== requestedColorId) {
      throw new ValidationError(`${line.styleCode ?? 'This line'} was ordered in a different colour.`);
    }
    return requestedColorId;
  }
  if (line.colorId) return line.colorId;
  const colours = await tx.color_options.findMany({ where: { styleId: line.styleId }, select: { id: true } });
  if (colours.length === 1) return colours[0].id;
  throw new ValidationError(
    colours.length === 0
      ? `${line.styleCode ?? 'This style'} has no colour yet — set the style's Primary Color before dispatching it.`
      : `${line.styleCode ?? 'This style'} comes in ${colours.length} colours and the sale order line has none — choose the colour being shipped.`
  );
}

/**
 * Refuse anything that would take a line past ordered + allowance. Reads the lines FOR UPDATE inside
 * the note's transaction, so two notes raised at once cannot both pass on the same stale figure.
 * `requests` may name one line more than once (two colours of a colourless line); they are summed.
 */
export async function assertWithinShipCaps(
  tx: Tx,
  requests: Array<{ saleOrderItemId: string; quantity: number; label: string }>,
  allowancePercent: number
): Promise<void> {
  const wanted = new Map<string, { quantity: number; label: string }>();
  for (const r of requests) {
    const entry = wanted.get(r.saleOrderItemId);
    if (entry) entry.quantity += r.quantity;
    else wanted.set(r.saleOrderItemId, { quantity: r.quantity, label: r.label });
  }
  const ids = [...wanted.keys()].sort(); // fixed lock order — two notes never wait on each other in a cycle
  const rows: Array<{ id: string; quantity: number; dispatchedQty: number }> = await tx.$queryRaw`
    SELECT id, quantity, "dispatchedQty" FROM sale_order_items
    WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  for (const row of rows) {
    const { quantity: asked, label } = wanted.get(row.id)!;
    const cap = shipCap(row.quantity, allowancePercent);
    if (row.dispatchedQty + asked > cap) {
      const allowance = cap > row.quantity ? ` (${row.quantity} ordered + ${cap - row.quantity} allowed over)` : '';
      throw new ValidationError(
        `${label}: at most ${cap} pcs may ship${allowance}; ${row.dispatchedQty} already dispatched, ` +
          `${asked} asked — ${Math.max(0, cap - row.dispatchedQty)} can still go.`
      );
    }
  }
}

export interface FinishedGoodsTaken {
  fgStockId: string;
  quantity: number;
}

/**
 * Take `quantity` pieces of one SKU out of finished-goods stock for a delivery note.
 *
 * With a sale order line: that line's own reservations of this SKU go first, and each is drawn down
 * — it becomes CONSUMED only once nothing is left on it (a part-used reservation flagged CONSUMED
 * hid its remainder from every `status: 'ALLOCATED'` query). Then FREE stock: what a row holds minus
 * what is reserved on it for OTHER sale order lines. A delivery note must never ship pieces another
 * buyer's order is holding (integrity check D7, "order-path DN ate reserved stock").
 *
 * Every take is a take-min under a row lock, so a concurrent note never drives a row negative and a
 * shortfall is reported, never hidden. Rows are visited in a fixed order (quantity desc, id asc).
 */
export async function drawFinishedGoods(
  tx: Tx,
  sku: { styleId: string; colorId: string; sizeId: string },
  quantity: number,
  saleOrderItemId: string | null
): Promise<{ taken: FinishedGoodsTaken[]; fromReservations: number; notFound: number }> {
  const taken: FinishedGoodsTaken[] = [];
  let need = quantity;
  let fromReservations = 0;

  if (saleOrderItemId) {
    const reservations = await tx.fg_stock_allocations.findMany({
      where: {
        saleOrderItemId,
        status: 'ALLOCATED',
        allocatedQty: { gt: 0 },
        fgStock: { styleId: sku.styleId, colorId: sku.colorId, sizeId: sku.sizeId },
      },
      orderBy: [{ allocatedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, fgStockId: true },
    });
    for (const reservation of reservations) {
      if (need < 1) break;
      const [held] = await tx.$queryRaw<Array<{ allocatedQty: number }>>`
        SELECT "allocatedQty" FROM fg_stock_allocations
        WHERE id = ${reservation.id} AND status = 'ALLOCATED' FOR UPDATE`;
      if (!held || held.allocatedQty < 1) continue;
      const took = await takeFromRow(tx, reservation.fgStockId, Math.min(need, held.allocatedQty), null);
      if (took < 1) continue;
      await tx.fg_stock_allocations.update({
        where: { id: reservation.id },
        data: {
          allocatedQty: { decrement: took },
          status: held.allocatedQty - took < 1 ? 'CONSUMED' : 'ALLOCATED',
        },
      });
      taken.push({ fgStockId: reservation.fgStockId, quantity: took });
      need -= took;
      fromReservations += took;
    }
  }

  if (need >= 1) {
    const rows = await tx.finished_goods_stock.findMany({
      where: { styleId: sku.styleId, colorId: sku.colorId, sizeId: sku.sizeId, quantity: { gt: 0 } },
      orderBy: [{ quantity: 'desc' }, { id: 'asc' }],
      select: { id: true },
    });
    for (const row of rows) {
      if (need < 1) break;
      const took = await takeFromRow(tx, row.id, need, saleOrderItemId ?? '');
      if (took < 1) continue;
      taken.push({ fgStockId: row.id, quantity: took });
      need -= took;
    }
  }

  return { taken, fromReservations, notFound: need };
}

/**
 * Atomic take-min from one finished-goods row under a row lock.
 * `keepReservedExcept` = null → the caller is spending a reservation on this row, take up to `upTo`.
 * Otherwise only FREE pieces are taken: the row's quantity minus every ALLOCATED reservation on it
 * except those of the line named (pass '' for "no line" — then every reservation is kept back).
 */
async function takeFromRow(
  tx: Tx,
  fgStockId: string,
  upTo: number,
  keepReservedExcept: string | null
): Promise<number> {
  const rows: Array<{ taken: number }> =
    keepReservedExcept === null
      ? await tx.$queryRaw`
          WITH before AS (
            SELECT quantity FROM finished_goods_stock WHERE id = ${fgStockId} FOR UPDATE
          )
          UPDATE finished_goods_stock f
          SET quantity = f.quantity - LEAST(before.quantity, CAST(${upTo} AS int)),
              "lastUpdated" = now()
          FROM before
          WHERE f.id = ${fgStockId} AND before.quantity > 0
          RETURNING LEAST(before.quantity, CAST(${upTo} AS int)) AS taken`
      : await tx.$queryRaw`
          WITH before AS (
            SELECT quantity FROM finished_goods_stock WHERE id = ${fgStockId} FOR UPDATE
          ), held AS (
            SELECT COALESCE(SUM("allocatedQty"), 0)::int AS qty FROM fg_stock_allocations
            WHERE "fgStockId" = ${fgStockId} AND status = 'ALLOCATED' AND "saleOrderItemId" <> ${keepReservedExcept}
          )
          UPDATE finished_goods_stock f
          SET quantity = f.quantity - LEAST(before.quantity - held.qty, CAST(${upTo} AS int)),
              "lastUpdated" = now()
          FROM before, held
          WHERE f.id = ${fgStockId} AND before.quantity - held.qty > 0
          RETURNING LEAST(before.quantity - held.qty, CAST(${upTo} AS int)) AS taken`;
  return rows.length > 0 ? Number(rows[0].taken) : 0;
}

/**
 * Book shipped pieces on the sale order line: `dispatchedQty` up by what the note carries, and
 * `allocatedQty` (= reserved AND not yet shipped) down by the reserved pieces the note just spent.
 * The caller then runs recomputeSaleOrderStatus once for the order.
 */
export async function recordSaleOrderDispatch(
  tx: Tx,
  saleOrderItemId: string,
  quantity: number,
  fromReservations: number
): Promise<void> {
  await tx.$executeRaw`
    UPDATE sale_order_items
    SET "dispatchedQty" = "dispatchedQty" + CAST(${quantity} AS int),
        "allocatedQty" = GREATEST("allocatedQty" - CAST(${fromReservations} AS int), 0)
    WHERE id = ${saleOrderItemId}`;
}
