/**
 * Receipt allocation — what arrives on a PO line goes to the orders linked to it, earliest delivery first,
 * and is held for them (owner decisions D1 / D2, 2026-09-29; docs/plans/po-allocation-design.md §4-§6.3, §6.7).
 *
 * D1 — FILL. A line's credits are never adjusted by a delta. On every event (a GRN approved or reversed, an
 * order cancelled, a link made) `applyLineReceipts` reads the line's approved GRN totals per location pool and
 * recomputes every link's `receivedQuantity` with the pure greedy fill (`fillLineReceipts`, receipt-split.helper)
 * over the links in their frozen `fillOrder`. The result depends only on (totals, links in order, eligibility),
 * so approving and reversing in any order are exact inverses. What a link already issued is a floor — a
 * reversal that would take issued goods back is refused (GRN_REVERSAL_ISSUED).
 *
 * D2 — HOLD. The same recompute releases every receipt hold of the line's links and places them again:
 * credit − issued per link and pool, on the lots the line's own GRNs booked (greige / lace, FIFO, where the
 * lot-location rule lets that order use them), or as a lot-less row for a trim — never more than the trim has on
 * the shelf beyond everyone else's holds. Stock readers net the holds. Holding never throws on approve or link:
 * what the lots or the shelf cannot cover is logged and returned.
 *
 * A greige line "received as ready fabric" is credited like any receipt — the orders got their goods, as another
 * type (source-mismatch.helper cancels their dyeing) — but it booked a fabric lot, not greige: credit only, no hold.
 *
 * PROCESSING lines stay pro-rata (their links carry job work, not goods for an order) and are skipped here.
 * This file must not import the mrp, grn, purchaseOrder or order services — they call it.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';
import { logWarn } from '../../utils/logger';
import { isQtyZero, qtyExceeds, QTY_EPSILON } from '../../utils/quantity';
import { unitShort } from '../../utils/units';
import { systemSettingsService } from '../system-settings.service';
import { grnLineStockQty } from './grn-line-value.helper';
import { toStockQty } from './purchase-unit.helper';
import {
  greigeCountsForPlanning,
  laceCountsForPlanning,
  PLANNING_LACE_LOT_SELECT,
  PLANNING_LOT_SELECT,
} from './lot-location.helper';
import {
  fillLineReceipts,
  isReceiptComplete,
  receiptPoolOf,
  sortByFillOrder,
  STORE_POOL,
  type FillLink,
  type FillResult,
} from './receipt-split.helper';
import {
  consumedByLinkPool,
  releaseLinkHolds,
  reserveOnLots,
  untrackedHeldByMaterial,
  type LotReservation,
} from './stock-reservation.helper';
import { getDerivedOnHandMap } from './derived-stock.helper';

type Tx = Prisma.TransactionClient;
type Db = Prisma.TransactionClient | typeof prisma;

export type ReceiptEvent = 'approve' | 'reverse' | 'order-cancel' | 'link';

/**
 * How a line's goods are held:
 *  lot-greige  greige_stock lots, per location pool      lot-lace  lace_stock lots (LACE, GREIGE_LACE)
 *  untracked   one lot-less row per link (trims)          none      credits only (FABRIC, THREAD, services…)
 *  pro-rata    PROCESSING: not this engine's line at all
 */
export type LineKind = 'lot-greige' | 'lot-lace' | 'untracked' | 'none' | 'pro-rata';

/** GRN statuses whose lines are in stock. Approval only ever sets ACCEPTED today. */
export const APPROVED_GRN_STATUSES = ['ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;
/** Requirement statuses a PO link drives. A requirement outside them is never moved by a receipt. */
export const PO_LINK_REQUIREMENT_STATUSES = ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'] as const;
/** A finished order keeps what it was credited but holds nothing (owner decision D11). */
export const HOLDLESS_ORDER_STATUSES = ['COMPLETED', 'DISPATCHED'] as const;

const TRIM_CATEGORIES = new Set([
  'TRIMS',
  'ACCESSORIES',
  'GENERAL',
  'BUTTON',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'OTHER_MATERIAL',
]);

/** A line's kind, by its PO's category — the same key GRN approval uses to pick the lot table. */
export function lineKindOf(poCategory: string | null | undefined): LineKind {
  if (poCategory === 'PROCESSING') return 'pro-rata';
  if (poCategory === 'GREIGE') return 'lot-greige';
  if (poCategory === 'LACE' || poCategory === 'GREIGE_LACE') return 'lot-lace';
  if (poCategory == null || TRIM_CATEGORIES.has(poCategory)) return 'untracked';
  return 'none';
}

/** Greige and lace fill by where the goods are; every other line has one STORE pool. */
export function isLocatedKind(kind: LineKind): boolean {
  return kind === 'lot-greige' || kind === 'lot-lace';
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const sumOf = (rec: Record<string, number>) => round3(Object.values(rec).reduce((s, v) => s + v, 0));

export const isHoldlessOrder = (orderStatus: string | null | undefined): boolean =>
  (HOLDLESS_ORDER_STATUSES as readonly string[]).includes(orderStatus ?? '');

/**
 * How much of the line a link takes in the fill. A finished order (D11) takes no more than it already has —
 * what it was credited, or what it issued if that is more — so goods arriving after it finished pass to the
 * running orders behind it instead of sitting credited to an order that will never use them. Its link's size
 * is left as it is, so reopening the order gives it its place back.
 */
export function fillAllocation(
  allocated: number,
  received: number,
  issued: number,
  orderStatus: string | null | undefined
): number {
  if (!isHoldlessOrder(orderStatus)) return allocated;
  return Math.min(allocated, Math.max(0, received, issued));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Dyers
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The processor each greige / lace requirement will be processed at — the pool its link draws on first. The
 * MATERIAL row does not store it: it lives on its PROCESSING child. In order: the processor of a live job
 * already drawing for that child (the two can differ), the child's processorId, the row's own processorId
 * (convert-to-greige rows), else null (bought ready, or not decided). Read live, so a dyer changed after the
 * cloth arrived moves the credit at the next recompute (C10). Mirrors mrp.service greigeRequirementProcessors,
 * plus the third fallback.
 */
export async function requirementDyers(client: Db, requirementIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const ids = [...new Set(requirementIds)];
  if (ids.length === 0) return out;
  const rows = await client.material_requirements.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      processorId: true,
      childRequirements: {
        where: { requirementType: 'PROCESSING' },
        orderBy: { createdAt: 'asc' },
        select: {
          processorId: true,
          requirement_jwo_links: { select: { job_work_orders: { select: { processorId: true, jwoStatus: true } } } },
        },
      },
    },
  });
  for (const r of rows) {
    const jobProcessor = r.childRequirements
      .flatMap((c) => c.requirement_jwo_links.map((l) => l.job_work_orders))
      .find((j) => j.jwoStatus !== 'CANCELLED')?.processorId;
    const childProcessor = r.childRequirements.find((c) => c.processorId)?.processorId;
    out.set(r.id, jobProcessor ?? childProcessor ?? r.processorId ?? null);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Loading a line
// ─────────────────────────────────────────────────────────────────────────────────────────────

interface GrnLineState {
  grnItemId: string;
  grnId: string;
  grnNumber: string;
  pool: string;
  stockQty: number;
  warehouseId: string | null;
  receivedAt: Date;
}

interface LinkState {
  id: string;
  requirementId: string;
  requirementNumber: string | null;
  requirementStatus: string | null;
  unit: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  /** The room the fill gives it: its link's size — for a finished order, no more than it has (fillAllocation) */
  allocated: number;
  /** The stored credit, before this computation */
  received: number;
  fillOrder: number | null;
  dyer: string | null;
  eligible: boolean;
  /** May it hold goods? Eligible, and its order not finished (D11) */
  holdable: boolean;
  floors: Record<string, number>;
  hypothetical: boolean;
}

interface LoadedLine {
  poItemId: string;
  purchaseOrderId: string;
  poNumber: string;
  poStatus: string;
  poCategory: string | null;
  materialId: string | null;
  kind: LineKind;
  orderedStock: number;
  grnLines: GrnLineState[];
  poolTotals: Record<string, number>;
  /**
   * Per pool, what arrived with no greige lot to hold it on: a greige line received as ready fabric (it booked a
   * fabric lot). It fills links like any receipt, but a hold short by this much is by design, not a shortfall.
   */
  unholdable: Record<string, number>;
  links: LinkState[];
}

export interface HypotheticalLink {
  id: string;
  requirementId?: string;
  allocated: number;
  fillOrder?: number | null;
  dyer?: string | null;
  eligible?: boolean;
}

export interface LineCreditsOptions {
  /** Count these GRNs as approved whatever their status (the cost of a receipt just approved) */
  includeGrnIds?: string[];
  /** Leave these GRNs out (the same line without that receipt) */
  excludeGrnIds?: string[];
  /** Links not written yet (the link-time dry run); no floors, eligible unless said otherwise */
  withLinks?: HypotheticalLink[];
}

async function loadLine(client: Db, poItemId: string, opts: LineCreditsOptions = {}): Promise<LoadedLine | null> {
  const include = opts.includeGrnIds ?? [];
  const exclude = opts.excludeGrnIds ?? [];
  const grnWhere: Prisma.goods_receiving_notesWhereInput = {
    OR: [{ status: { in: [...APPROVED_GRN_STATUSES] } }, ...(include.length > 0 ? [{ id: { in: include } }] : [])],
    ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
  };
  const item = await client.purchase_order_items.findUnique({
    where: { id: poItemId },
    select: {
      id: true,
      materialId: true,
      orderedQuantity: true,
      stockUnitsPerUnit: true,
      purchase_orders: { select: { id: true, poNumber: true, status: true, poCategory: true } },
      grn_items: {
        // Received as ready fabric included: the goods came, as another type — they fill the line's links (credit
        // only, see `unholdable`), as source-mismatch.helper treats them ("we got the goods")
        where: { goods_receiving_notes: grnWhere },
        select: {
          id: true,
          acceptedQuantity: true,
          foldLengthCm: true,
          stockQuantity: true,
          receivedAsReadyFabric: true,
          goods_receiving_notes: {
            select: {
              id: true,
              grnNumber: true,
              warehouseId: true,
              receivingDate: true,
              warehouses: { select: { warehouseType: true, supplierId: true } },
            },
          },
        },
      },
      requirement_po_links: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          requirementId: true,
          allocatedQuantity: true,
          receivedQuantity: true,
          fillOrder: true,
          material_requirements: {
            select: {
              requirementNumber: true,
              status: true,
              unit: true,
              orderId: true,
              orders: { select: { orderNumber: true, status: true } },
            },
          },
        },
      },
    },
  });
  if (!item) return null;

  const po = item.purchase_orders;
  const kind = item.materialId ? lineKindOf(po.poCategory) : 'none';
  const located = isLocatedKind(kind);
  const spu = item.stockUnitsPerUnit != null ? Number(item.stockUnitsPerUnit) : null;

  const grnLines: GrnLineState[] = item.grn_items.map((gi) => ({
    grnItemId: gi.id,
    grnId: gi.goods_receiving_notes.id,
    grnNumber: gi.goods_receiving_notes.grnNumber,
    pool: located ? receiptPoolOf(gi.goods_receiving_notes.warehouses) : STORE_POOL,
    stockQty: grnLineStockQty({ ...gi, purchase_order_items: { stockUnitsPerUnit: spu } }),
    warehouseId: gi.goods_receiving_notes.warehouseId,
    receivedAt: gi.goods_receiving_notes.receivingDate,
  }));
  const poolTotals: Record<string, number> = {};
  for (const g of grnLines) poolTotals[g.pool] = round3((poolTotals[g.pool] ?? 0) + g.stockQty);

  // A greige line received as ready fabric booked a fabric lot (or, when the override was refused at approval,
  // a greige lot like any receipt — that one is held as usual)
  const unholdable: Record<string, number> = {};
  const readyIds = new Set(item.grn_items.filter((gi) => gi.receivedAsReadyFabric).map((gi) => gi.id));
  if (kind === 'lot-greige' && readyIds.size > 0) {
    const asGreige = new Set(
      (
        await client.greige_stock.findMany({
          where: { grnItemId: { in: [...readyIds] } },
          select: { grnItemId: true },
        })
      ).map((l) => l.grnItemId)
    );
    for (const g of grnLines) {
      if (!readyIds.has(g.grnItemId) || asGreige.has(g.grnItemId)) continue;
      unholdable[g.pool] = round3((unholdable[g.pool] ?? 0) + g.stockQty);
    }
  }

  // One query at a time: inside an interactive transaction they share one connection anyway
  const reqIds = item.requirement_po_links.map((l) => l.requirementId);
  const dyers = located ? await requirementDyers(client, reqIds) : new Map<string, string | null>();
  const floors = await consumedByLinkPool(
    client,
    item.requirement_po_links.map((l) => l.id)
  );

  const links: LinkState[] = item.requirement_po_links.map((l) => {
    const req = l.material_requirements;
    const orderStatus = req.orders?.status ?? null;
    const eligible = req.status !== 'CANCELLED' && orderStatus !== 'CANCELLED';
    const received = Number(l.receivedQuantity);
    const linkFloors = floors.get(l.id) ?? {};
    return {
      id: l.id,
      requirementId: l.requirementId,
      requirementNumber: req.requirementNumber,
      requirementStatus: req.status,
      unit: req.unit,
      orderId: req.orderId,
      orderNumber: req.orders?.orderNumber ?? null,
      orderStatus,
      allocated: fillAllocation(Number(l.allocatedQuantity), received, sumOf(linkFloors), orderStatus),
      received,
      fillOrder: l.fillOrder,
      dyer: located ? (dyers.get(l.requirementId) ?? null) : null,
      eligible,
      holdable: eligible && !isHoldlessOrder(orderStatus),
      floors: linkFloors,
      hypothetical: false,
    };
  });
  for (const h of opts.withLinks ?? []) {
    links.push({
      id: h.id,
      requirementId: h.requirementId ?? '',
      requirementNumber: null,
      requirementStatus: null,
      unit: null,
      orderId: null,
      orderNumber: null,
      orderStatus: null,
      allocated: h.allocated,
      received: 0,
      fillOrder: h.fillOrder ?? null,
      dyer: located ? (h.dyer ?? null) : null,
      eligible: h.eligible ?? true,
      holdable: h.eligible ?? true,
      floors: {},
      hypothetical: true,
    });
  }

  return {
    poItemId: item.id,
    purchaseOrderId: po.id,
    poNumber: po.poNumber,
    poStatus: po.status,
    poCategory: po.poCategory,
    materialId: item.materialId,
    kind,
    orderedStock: toStockQty(Number(item.orderedQuantity), spu),
    grnLines,
    poolTotals,
    unholdable,
    links,
  };
}

function fillOf(line: LoadedLine): FillResult {
  const fillLinks: FillLink[] = line.links.map((l) => ({
    id: l.id,
    allocated: l.allocated,
    fillOrder: l.fillOrder,
    dyer: l.dyer,
    eligible: l.eligible,
    floors: l.floors,
  }));
  return fillLineReceipts(fillLinks, line.poolTotals);
}

/** A PROCESSING line keeps its pro-rata credits: report them as they stand. */
function storedFill(line: LoadedLine): FillResult {
  return {
    credit: new Map(line.links.map((l) => [l.id, l.received])),
    creditByPool: new Map(line.links.map((l) => [l.id, { [STORE_POOL]: l.received }])),
    plainStock: {},
    deficits: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Read-only: a line's credits (also the link-time dry run and the cost split)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface LineCreditLink {
  id: string;
  requirementId: string;
  requirementNumber: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  /** What it takes of the line: its link's size, or for a finished order what it already has (fillAllocation) */
  allocated: number;
  /** The credit stored on the link now */
  received: number;
  fillOrder: number | null;
  dyer: string | null;
  eligible: boolean;
  /** What it issued, per pool (its floors) */
  floors: Record<string, number>;
  issued: number;
  /** What the fill gives it */
  credit: number;
  creditByPool: Record<string, number>;
  /** ACTIVE receipt holds, net of what was issued */
  held: number;
  hypothetical: boolean;
}

export interface LineCredits {
  poItemId: string;
  purchaseOrderId: string;
  poNumber: string;
  poStatus: string;
  poCategory: string | null;
  materialId: string | null;
  kind: LineKind;
  /** What the line orders, in the stock unit */
  orderedStock: number;
  /** Approved receipts per pool, in the stock unit */
  poolTotals: Record<string, number>;
  /** Links in fill order */
  links: LineCreditLink[];
  plainStock: Record<string, number>;
  deficits: Record<string, number>;
  /** The line total received (approved GRN lines) */
  arrived: number;
  /** Σ credit over the links */
  credited: number;
  /** Σ allocated over eligible links */
  allocated: number;
  /** Σ plain stock over the pools */
  plain: number;
  /** Still to come on the line: max(0, ordered − arrived) */
  toCome: number;
  /** Σ (allocated − credit) over eligible links */
  uncredited: number;
  /** Σ ACTIVE receipt holds of the line's links */
  held: number;
}

async function receiptHeldByLink(client: Db, linkIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (linkIds.length === 0) return out;
  const rows = await client.stock_reservations.findMany({
    where: { poLinkId: { in: linkIds }, status: 'ACTIVE' },
    select: { poLinkId: true, reservedQuantity: true, consumedQuantity: true },
  });
  for (const r of rows) {
    const hold = round3(Number(r.reservedQuantity) - Number(r.consumedQuantity));
    if (qtyExceeds(hold, 0)) out.set(r.poLinkId!, round3((out.get(r.poLinkId!) ?? 0) + hold));
  }
  return out;
}

function creditsOf(line: LoadedLine, fill: FillResult, held: Map<string, number>): LineCredits {
  const links: LineCreditLink[] = sortByFillOrder(line.links).map((l) => ({
    id: l.id,
    requirementId: l.requirementId,
    requirementNumber: l.requirementNumber,
    orderId: l.orderId,
    orderNumber: l.orderNumber,
    orderStatus: l.orderStatus,
    allocated: l.allocated,
    received: l.received,
    fillOrder: l.fillOrder,
    dyer: l.dyer,
    eligible: l.eligible,
    floors: l.floors,
    issued: sumOf(l.floors),
    credit: fill.credit.get(l.id) ?? 0,
    creditByPool: fill.creditByPool.get(l.id) ?? {},
    held: held.get(l.id) ?? 0,
    hypothetical: l.hypothetical,
  }));
  const arrived = sumOf(line.poolTotals);
  const eligible = links.filter((l) => l.eligible);
  return {
    poItemId: line.poItemId,
    purchaseOrderId: line.purchaseOrderId,
    poNumber: line.poNumber,
    poStatus: line.poStatus,
    poCategory: line.poCategory,
    materialId: line.materialId,
    kind: line.kind,
    orderedStock: line.orderedStock,
    poolTotals: line.poolTotals,
    links,
    plainStock: fill.plainStock,
    deficits: fill.deficits,
    arrived,
    credited: round3(links.reduce((s, l) => s + l.credit, 0)),
    allocated: round3(eligible.reduce((s, l) => s + l.allocated, 0)),
    plain: sumOf(fill.plainStock),
    toCome: Math.max(0, round3(line.orderedStock - arrived)),
    uncredited: round3(eligible.reduce((s, l) => s + Math.max(0, l.allocated - l.credit), 0)),
    held: round3(links.reduce((s, l) => s + l.held, 0)),
  };
}

/**
 * A line's credits as the fill computes them now, without writing anything. The link-time dry run (C5) passes
 * `withLinks` for links not written yet; the cost split passes `includeGrnIds` / `excludeGrnIds`. Returns null
 * for a line that does not exist.
 */
export async function computeLineCredits(
  client: Db,
  poItemId: string,
  opts: LineCreditsOptions = {}
): Promise<LineCredits | null> {
  const line = await loadLine(client, poItemId, opts);
  if (!line) return null;
  const fill = line.kind === 'pro-rata' ? storedFill(line) : fillOf(line);
  const held = await receiptHeldByLink(
    client,
    line.links.filter((l) => !l.hypothetical).map((l) => l.id)
  );
  return creditsOf(line, fill, held);
}

/**
 * What ONE GRN changed on each PO link it fills — credit with the receipt less credit without it — so its
 * cost is charged to the styles it served (actualCost × delta / stockQuantity). Plain stock is charged to no
 * style. PROCESSING lines are left to their pro-rata split.
 */
export async function lineCreditDeltasForGrn(client: Db, grnId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const items = await client.grn_items.findMany({
    where: { grnId, poItemId: { not: null } },
    select: { poItemId: true },
  });
  const poItemIds = [...new Set(items.map((i) => i.poItemId!))].sort();
  for (const poItemId of poItemIds) {
    const withIt = await computeLineCredits(client, poItemId, { includeGrnIds: [grnId] });
    if (!withIt || withIt.kind === 'pro-rata') continue;
    const without = await computeLineCredits(client, poItemId, { excludeGrnIds: [grnId] });
    const before = new Map((without?.links ?? []).map((l) => [l.id, l.credit]));
    for (const link of withIt.links) {
      const delta = round3(link.credit - (before.get(link.id) ?? 0));
      if (!isQtyZero(delta)) out.set(link.id, round3((out.get(link.id) ?? 0) + delta));
    }
  }
  return out;
}

/** A trim material on hand less every lot-less hold on it (Use Stock and receipt holds, every order's) */
async function physicallyFreeUntracked(client: Db, materialId: string): Promise<number> {
  const onHand = (await getDerivedOnHandMap([materialId], client)).get(materialId) ?? 0;
  const heldMap = await untrackedHeldByMaterial(client, [materialId]);
  return Math.max(0, round3(onHand - (heldMap.get(materialId) ?? 0)));
}

/**
 * What of a line's arrived goods in `pool` is still physically free — the link-time dry run (C5) refuses new
 * links whose credit would come to more than this. Lots: Σ (available − reserved) over the lots this line's
 * approved GRNs booked in that pool. Trims: on hand − every lot-less hold on the material. Lines with no holds
 * (fabric, thread, services, processing) have nothing to offer.
 */
export async function physicallyFreeForLine(client: Db, poItemId: string, pool: string): Promise<number> {
  const line = await loadLine(client, poItemId);
  if (!line) return 0;
  if (line.kind === 'untracked') {
    if (pool !== STORE_POOL || !line.materialId) return 0;
    return physicallyFreeUntracked(client, line.materialId);
  }
  if (!isLocatedKind(line.kind)) return 0;
  const itemIds = line.grnLines.filter((g) => g.pool === pool).map((g) => g.grnItemId);
  if (itemIds.length === 0) return 0;
  const where = { grnItemId: { in: itemIds }, status: 'AVAILABLE' as const };
  const select = { quantityAvailable: true, quantityReserved: true } as const;
  const lots =
    line.kind === 'lot-greige'
      ? await client.greige_stock.findMany({ where, select })
      : await client.lace_stock.findMany({ where, select });
  return round2(lots.reduce((s, l) => s + Math.max(0, Number(l.quantityAvailable) - Number(l.quantityReserved)), 0));
}

/**
 * After a trim receipt is reversed: refuse when what is held for orders (Use Stock and receipt holds, no lot)
 * is now more than the material has on hand — the reversal would leave orders holding goods that are gone.
 * Reads inside the transaction, so it sees the reversal's own stock movement.
 */
export async function assertTrimHoldsCovered(tx: Tx, materialIds: string[]): Promise<void> {
  const ids = [...new Set(materialIds.filter(Boolean))];
  if (ids.length === 0) return;
  const onHand = await getDerivedOnHandMap(ids, tx);
  const heldMap = await untrackedHeldByMaterial(tx, ids);
  for (const materialId of ids) {
    const have = onHand.get(materialId) ?? 0;
    const holds = heldMap.get(materialId) ?? 0;
    if (!qtyExceeds(holds, have)) continue;
    const material = await tx.materials.findUnique({ where: { id: materialId }, select: { code: true, unit: true } });
    const rows = await tx.stock_reservations.findMany({
      where: {
        materialId,
        status: 'ACTIVE',
        referenceType: 'MATERIAL_REQUIREMENT',
        greigeStockId: null,
        fabricStockId: null,
        laceStockId: null,
      },
      select: { referenceNumber: true, reservedQuantity: true, consumedQuantity: true },
    });
    const unit = unitShort(material?.unit);
    const heldFor = rows
      .map((r) => ({
        requirementNumber: r.referenceNumber,
        qty: round3(Number(r.reservedQuantity) - Number(r.consumedQuantity)),
      }))
      .filter((r) => qtyExceeds(r.qty, 0));
    throw new BusinessError(
      `This reversal would leave ${holds} ${unit} of ${material?.code ?? 'this material'} held for orders ` +
        `(${heldFor.map((h) => h.requirementNumber).join(', ')}) with only ${have} ${unit} on hand. ` +
        `Release or issue those holds first.`,
      { code: 'GRN_REVERSAL_HELD_STOCK', materialId, onHand: have, held: holds, heldFor }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The engine
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface LinkReceiptOutcome {
  linkId: string;
  requirementId: string;
  requirementNumber: string | null;
  orderNumber: string | null;
  before: number;
  after: number;
  held: number;
}

export interface HoldShortfall {
  linkId: string;
  requirementNumber: string | null;
  pool: string;
  wanted: number;
  held: number;
}

export interface LineReceiptOutcome {
  poItemId: string;
  purchaseOrderId: string;
  kind: LineKind;
  /** Set when the line was left alone: a PROCESSING line (pro-rata), or one with no links */
  skipped?: 'PRO_RATA' | 'NO_LINKS';
  arrived: number;
  links: LinkReceiptOutcome[];
  plainStock: Record<string, number>;
  /** Holds the lots could not cover (logged; never thrown) */
  holdShortfalls: HoldShortfall[];
}

/**
 * Recompute the credits, requirement statuses and receipt holds of these PO lines inside the caller's
 * transaction. Call it AFTER the event's rows are written — the GRN's status and lots (approve), the GRN's
 * status before its lots are reversed (reverse), the order's status (order-cancel), the links (link) — so the
 * totals read are the totals after the event.
 *
 * Locks the lines' POs, then each line's link rows, in id order. On `reverse`, refuses (GRN_REVERSAL_ISSUED)
 * when the line no longer holds what its links already issued. Never throws for holds.
 */
export async function applyLineReceipts(
  tx: Tx,
  poItemIds: string[],
  ctx: { event: ReceiptEvent; userId: string }
): Promise<LineReceiptOutcome[]> {
  const wanted = [...new Set(poItemIds.filter(Boolean))];
  if (wanted.length === 0) return [];
  const items = await tx.purchase_order_items.findMany({
    where: { id: { in: wanted } },
    select: { id: true, poId: true },
    orderBy: { id: 'asc' },
  });
  if (items.length === 0) return [];
  const poIds = [...new Set(items.map((i) => i.poId))].sort();
  await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id IN (${Prisma.join(poIds)}) ORDER BY id FOR UPDATE`;

  const underTolerance = await systemSettingsService.getNumberDefault('GRN_UNDER_RECEIPT_TOLERANCE_PERCENT');
  const outcomes: LineReceiptOutcome[] = [];
  const lineGap = new Map<string, { complete: boolean; gap: number }>();
  const reqInfo = new Map<string, { status: string | null; orderStatus: string | null }>();

  for (const { id } of items) {
    await tx.$queryRaw`SELECT id FROM requirement_po_links WHERE "purchaseOrderItemId" = ${id} ORDER BY id FOR UPDATE`;
    const line = await loadLine(tx, id);
    if (!line) continue;
    const arrived = sumOf(line.poolTotals);
    const base = { poItemId: line.poItemId, purchaseOrderId: line.purchaseOrderId, kind: line.kind, arrived };
    if (line.kind === 'pro-rata') {
      outcomes.push({ ...base, skipped: 'PRO_RATA', links: [], plainStock: {}, holdShortfalls: [] });
      continue;
    }
    if (line.links.length === 0) {
      outcomes.push({
        ...base,
        skipped: 'NO_LINKS',
        links: [],
        plainStock: { ...line.poolTotals },
        holdShortfalls: [],
      });
      continue;
    }

    const fill = fillOf(line);
    const deficitPools = Object.keys(fill.deficits);
    if (deficitPools.length > 0) {
      const issuers = line.links.filter((l) => deficitPools.some((p) => qtyExceeds(l.floors[p] ?? 0, 0)));
      if (ctx.event === 'reverse') {
        const unit = unitShort(issuers[0]?.unit);
        throw new BusinessError(
          `This receipt cannot be reversed: ${issuers
            .map(
              (l) => `${l.orderNumber ?? 'no order'} (${l.requirementNumber}) already issued ${sumOf(l.floors)} ${unit}`
            )
            .join('; ')} of what arrived on ${line.poNumber}. Return those goods first.`,
          {
            code: 'GRN_REVERSAL_ISSUED',
            poItemId: line.poItemId,
            deficits: fill.deficits,
            issuedBy: issuers.map((l) => ({
              requirementNumber: l.requirementNumber,
              orderNumber: l.orderNumber,
              issued: sumOf(l.floors),
            })),
          }
        );
      }
      logWarn(`[receipt-allocation] ${line.poNumber} line ${line.poItemId}: issued more than arrived`, {
        event: ctx.event,
        deficits: fill.deficits,
      });
    }

    // Credits — written only where they moved
    for (const link of line.links) {
      const after = fill.credit.get(link.id) ?? 0;
      if (Math.abs(after - link.received) >= 0.0005) {
        await tx.requirement_po_links.update({
          where: { id: link.id },
          data: { receivedQuantity: new Prisma.Decimal(after.toFixed(3)) },
        });
      }
      reqInfo.set(link.requirementId, { status: link.requirementStatus, orderStatus: link.orderStatus });
    }
    lineGap.set(line.poItemId, {
      complete: isReceiptComplete(arrived, line.orderedStock, underTolerance),
      gap: Math.max(0, round3(line.orderedStock - arrived)),
    });

    // Holds — every receipt hold of the line released, then placed again from the fill
    await releaseLinkHolds(
      tx,
      line.links.map((l) => l.id)
    );
    const { held, shortfalls } = await placeHolds(tx, line, fill, ctx.userId);

    outcomes.push({
      ...base,
      links: sortByFillOrder(line.links).map((l) => ({
        linkId: l.id,
        requirementId: l.requirementId,
        requirementNumber: l.requirementNumber,
        orderNumber: l.orderNumber,
        before: l.received,
        after: fill.credit.get(l.id) ?? 0,
        held: held.get(l.id) ?? 0,
      })),
      plainStock: fill.plainStock,
      holdShortfalls: shortfalls,
    });
  }

  await writeRequirementStatuses(tx, reqInfo, lineGap, underTolerance);
  return outcomes;
}

/**
 * What a requirement with nothing received reads: PO_GENERATED while every PO it is on is still a draft (a
 * draft line is recomputed when another order on it is cancelled), and a row still PO_GENERATED stays so —
 * sending a PO does not move its rows either. Otherwise PO_SENT.
 */
export function unreceivedStatus(
  current: string | null,
  linkPoStatuses: readonly string[]
): 'PO_GENERATED' | 'PO_SENT' {
  if (current === 'PO_GENERATED') return 'PO_GENERATED';
  return linkPoStatuses.length > 0 && linkPoStatuses.every((s) => s === 'DRAFT') ? 'PO_GENERATED' : 'PO_SENT';
}

/**
 * RECEIVED / PARTIALLY_RECEIVED / PO_SENT (PO_GENERATED on a draft) for each requirement, over ALL its links
 * (older rows may have several). A link is complete within the under-receipt tolerance, or when its line is
 * complete and the link is short by no more than the line is (the line's shortfall lands on its last link).
 * Guarded: only a requirement still in a PO status moves, and never one of a cancelled order.
 */
async function writeRequirementStatuses(
  tx: Tx,
  reqInfo: Map<string, { status: string | null; orderStatus: string | null }>,
  lineGap: Map<string, { complete: boolean; gap: number }>,
  underTolerance: number
): Promise<void> {
  const reqIds = [...reqInfo.keys()].filter((id) => reqInfo.get(id)!.orderStatus !== 'CANCELLED');
  if (reqIds.length === 0) return;
  const links = await tx.requirement_po_links.findMany({
    where: { requirementId: { in: reqIds } },
    select: {
      requirementId: true,
      purchaseOrderItemId: true,
      allocatedQuantity: true,
      receivedQuantity: true,
      purchase_orders: { select: { status: true } },
    },
  });
  const byTarget = new Map<string, string[]>();
  for (const reqId of reqIds) {
    const own = links.filter((l) => l.requirementId === reqId);
    const received = own.reduce((s, l) => s + Number(l.receivedQuantity), 0);
    const current = reqInfo.get(reqId)!.status;
    const complete = own.every((l) => {
      const alloc = Number(l.allocatedQuantity);
      const recv = Number(l.receivedQuantity);
      if (isReceiptComplete(recv, alloc, underTolerance)) return true;
      const line = lineGap.get(l.purchaseOrderItemId);
      return !!line?.complete && alloc - recv <= line.gap + QTY_EPSILON;
    });
    const target = complete
      ? 'RECEIVED'
      : qtyExceeds(received, 0)
        ? 'PARTIALLY_RECEIVED'
        : unreceivedStatus(
            current,
            own.map((l) => l.purchase_orders.status)
          );
    if (current === target || !(PO_LINK_REQUIREMENT_STATUSES as readonly string[]).includes(current ?? '')) continue;
    byTarget.set(target, [...(byTarget.get(target) ?? []), reqId]);
  }
  for (const [target, ids] of byTarget) {
    const res = await tx.material_requirements.updateMany({
      where: { id: { in: ids }, status: { in: [...PO_LINK_REQUIREMENT_STATUSES] } },
      data: { status: target as 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'PO_SENT' | 'PO_GENERATED' },
    });
    if (res.count !== ids.length) {
      logWarn(`[receipt-allocation] ${ids.length - res.count} requirement(s) left their PO status meanwhile`, {
        target,
        ids,
      });
    }
  }
}

/**
 * Place each holdable link's receipt holds: credit − issued per pool. Lots: the lots this line's GRNs booked in
 * that pool, still AVAILABLE, where the lot-location rule lets the link's order use them, oldest first, at 2 dp
 * (the lot columns' scale), links in fill order. Trims: one lot-less row at 3 dp, in the warehouse of the line's
 * latest receipt, up to what is physically free.
 */
async function placeHolds(
  tx: Tx,
  line: LoadedLine,
  fill: FillResult,
  userId: string
): Promise<{ held: Map<string, number>; shortfalls: HoldShortfall[] }> {
  const held = new Map<string, number>();
  const shortfalls: HoldShortfall[] = [];
  if (line.kind === 'none' || line.kind === 'pro-rata' || !line.materialId) return { held, shortfalls };

  const wants = (link: LinkState) =>
    Object.entries(fill.creditByPool.get(link.id) ?? {})
      .map(([pool, credit]) => ({ pool, want: round3(credit - (link.floors[pool] ?? 0)) }))
      .filter((w) => qtyExceeds(w.want, 0))
      .sort((a, b) => (a.pool < b.pool ? -1 : a.pool > b.pool ? 1 : 0));
  const requirementOf = (link: LinkState) => ({
    id: link.requirementId,
    requirementNumber: link.requirementNumber ?? '',
    // The goods held are the LINE's material — the one stock is counted on
    materialId: line.materialId!,
    unit: link.unit ?? '',
  });
  const holders = sortByFillOrder(line.links).filter((l) => l.holdable && !l.hypothetical);
  // Credit that came as ready fabric has no greige lot to be held on — short by that much is by design
  const asFabric = { ...line.unholdable };
  const note = (link: LinkState, pool: string, want: number, got: number) => {
    if (!qtyExceeds(want, got)) return;
    const byDesign = Math.min(round3(want - got), asFabric[pool] ?? 0);
    asFabric[pool] = round3((asFabric[pool] ?? 0) - byDesign);
    const wanted = round3(want - byDesign);
    if (!qtyExceeds(wanted, got)) return;
    shortfalls.push({ linkId: link.id, requirementNumber: link.requirementNumber, pool, wanted, held: got });
  };

  if (line.kind === 'untracked') {
    const latest = [...line.grnLines]
      .filter((g) => g.warehouseId)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];
    // A trim hold has no lot to be capped by, so cap it by what is on the shelf and not held by anyone else —
    // read after this line's own holds were released. Goods issued without consuming a hold (an issue path not
    // yet hold-aware, or taken before this line was linked) are gone from the shelf and must not be held again:
    // a hold on nothing would block every other order's issue.
    let free = await physicallyFreeUntracked(tx, line.materialId);
    for (const link of holders) {
      for (const { pool, want } of wants(link)) {
        const got = latest?.warehouseId ? round3(Math.max(0, Math.min(want, free))) : 0;
        if (qtyExceeds(got, 0)) {
          await reserveOnLots(tx, {
            requirement: requirementOf(link),
            lots: [],
            userId,
            fallbackWarehouseId: latest!.warehouseId,
            untrackedQuantity: got,
            poLinkId: link.id,
          });
          held.set(link.id, round3((held.get(link.id) ?? 0) + got));
          free = round3(free - got);
        }
        note(link, pool, want, got);
      }
    }
  } else {
    const table = line.kind === 'lot-greige' ? ('greige' as const) : ('lace' as const);
    const grnOf = new Map(line.grnLines.map((g) => [g.grnItemId, g]));
    const itemIds = line.grnLines.map((g) => g.grnItemId);
    const orderBy = [{ receivedDate: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }];
    const lots =
      itemIds.length === 0
        ? []
        : table === 'greige'
          ? (
              await tx.greige_stock.findMany({
                where: { grnItemId: { in: itemIds }, status: 'AVAILABLE' },
                select: { ...PLANNING_LOT_SELECT, grnItemId: true, warehouseId: true },
                orderBy,
              })
            ).map((lot) => ({ ...lot, counts: (dyer: string | null) => greigeCountsForPlanning(lot, dyer) }))
          : (
              await tx.lace_stock.findMany({
                where: { grnItemId: { in: itemIds }, status: 'AVAILABLE' },
                select: { ...PLANNING_LACE_LOT_SELECT, grnItemId: true, warehouseId: true },
                orderBy,
              })
            ).map((lot) => ({ ...lot, counts: (dyer: string | null) => laceCountsForPlanning(lot, dyer) }));
    // Free is read after the release, so a link may take back the very lot it held before
    const free = new Map(
      lots.map((lot) => [lot.id, round2(Math.max(0, Number(lot.quantityAvailable) - Number(lot.quantityReserved)))])
    );

    for (const link of holders) {
      for (const { pool, want } of wants(link)) {
        const picks: LotReservation[] = [];
        let need = want;
        let fallbackWarehouseId: string | null = null;
        for (const lot of lots) {
          if (!qtyExceeds(need, 0)) break;
          const receipt = grnOf.get(lot.grnItemId ?? '');
          if (!receipt || receipt.pool !== pool || !lot.counts(link.dyer)) continue;
          const room = free.get(lot.id) ?? 0;
          const qty = Math.min(round2(need), room);
          if (!qtyExceeds(qty, 0)) continue;
          picks.push({ table, lotId: lot.id, warehouseId: lot.warehouseId ?? receipt.warehouseId, quantity: qty });
          fallbackWarehouseId = fallbackWarehouseId ?? receipt.warehouseId;
          free.set(lot.id, round2(room - qty));
          need = round3(need - qty);
        }
        if (picks.length > 0) {
          await reserveOnLots(tx, {
            requirement: requirementOf(link),
            lots: picks,
            userId,
            fallbackWarehouseId,
            poLinkId: link.id,
          });
        }
        const got = round3(picks.reduce((s, p) => s + p.quantity, 0));
        held.set(link.id, round3((held.get(link.id) ?? 0) + got));
        note(link, pool, want, got);
      }
    }
  }

  if (shortfalls.length > 0) {
    logWarn(`[receipt-allocation] ${line.poNumber}: the lots could not cover every hold`, { shortfalls });
  }
  return { held, shortfalls };
}
