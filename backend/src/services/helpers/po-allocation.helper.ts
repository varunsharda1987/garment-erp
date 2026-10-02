/**
 * Allocating a sent PO to running orders — the ONLY place that creates or removes links on a PO that has
 * already gone to the supplier (owner decisions 2026-09-28; docs/plans/po-allocation-design.md §6.4, §6.8, §8).
 *
 * A PO bought by hand for "these styles and some future ones" (PO2609-0231: LBL-0004 in six sizes) covered
 * running orders that Material Requirements still showed as "needs to be ordered". Linking it:
 *   - every running order gets its full need, earliest delivery first; the user can untick or edit (suggest);
 *   - a requirement goes on ONE line; a part cover is a split child (the MRP-12 shape), never a second link;
 *   - what nobody links stays free on the line, then becomes plain stock — no placeholder requirements;
 *   - a link can be undone until goods arrive for it;
 *   - a line whose goods partly arrived can still be linked: new links take the free arrived goods first and
 *     hold them at once, so those links cannot be undone (D12). The arrived goods must still be physically
 *     free — used or held elsewhere, they are refused ("Use Stock for them").
 * Greige, lace and greige lace fill by where the cloth is (receipt-allocation.helper): a link is checked
 * against where its line delivers, and colour is not compared on greige.
 *
 * Also here, because they change links or holds the same way:
 *   - `takeHeldGoods` (D10): an issue takes goods held for another order after the user confirmed it. What
 *     is taken counts as issued from the loser's hold (so the line never credits it twice), and the loser's
 *     need reopens as a PO_REQUIRED balance row. Audit-logged.
 *   - `releaseCompletedOrderHolds` (D11): a COMPLETED / DISPATCHED order lets go of its receipt holds.
 *   - `releaseCancelledOrderLinks`, `freezeClosedPoLinks`, `returnDemandAfterUnlink`, `mintBalanceChild`:
 *     what order cancel, PO cancel / short-close and Undo share.
 *
 * Receipts, credits and holds themselves are receipt-allocation.helper.ts. This file must not import the mrp,
 * grn, purchaseOrder or order services — they call it.
 */

import { randomUUID } from 'crypto';
import { Prisma, type material_requirements, type MaterialRequirementStatus } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError, ConflictError, NotFoundError } from '../../errors';
import { logWarn } from '../../utils/logger';
import { isQtyZero, qtyExceeds, snapToLimit, QTY_EPSILON } from '../../utils/quantity';
import { normalizeUnit, unitShort } from '../../utils/units';
import { toDateInputValue } from '../../utils/date';
import { generateAtomicDocNumber } from '../../utils/atomicCodeGenerator';
import { createAuditLog, type AuditLogOptions } from '../audit.service';
import { LABEL_LINE_MATERIAL_SELECT, PO_LINE_ORDER, toLabelLine } from './label-line.helper';
import { fitsPoCategory, loadPoLineMaterials } from './po-line-category.helper';
import { lockPurchaseOrder } from './po-delivery-plan.helper';
import { toStockQty } from './purchase-unit.helper';
import {
  isProcessorPool,
  rankTail,
  receiptPoolOf,
  splitReceiptAcrossLinks,
  STORE_POOL,
  UNPLACED_POOL,
} from './receipt-split.helper';
import {
  applyLineReceipts,
  computeLineCredits,
  fillAllocation,
  HOLDLESS_ORDER_STATUSES,
  isLocatedKind,
  lineKindOf,
  PO_LINK_REQUIREMENT_STATUSES,
  physicallyFreeForLine,
  requirementDyers,
  APPROVED_GRN_STATUSES,
  type LineCredits,
  type LineKind,
  type LineReceiptOutcome,
} from './receipt-allocation.helper';
import { consumedByLinkPool, releaseLinkHolds, releaseReservations } from './stock-reservation.helper';

type Tx = Prisma.TransactionClient;
type Db = Prisma.TransactionClient | typeof prisma;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Rules
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Only a PO that has gone to the supplier (owner decision 1). A draft is still being written. */
export const LINKABLE_PO_STATUSES = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] as const;
/** Trims, accessories, general — and lace, greige, greige lace (D3). Fabric, thread, processing stay out. */
export const LINKABLE_PO_CATEGORIES = [
  'TRIMS',
  'ACCESSORIES',
  'GENERAL',
  'BUTTON',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'OTHER_MATERIAL',
  'GREIGE',
  'LACE',
  'GREIGE_LACE',
] as const;
/**
 * Never linked: thread requirements count garments while thread is stocked in cones or tubes; fabric issue
 * never consumes holds; services and machine parts are not garment material.
 */
export const NON_LINKABLE_MATERIAL_TYPES = ['THREAD', 'FABRIC', 'SERVICE', 'MACHINE_PART'] as const;
/** Lines that fill by where the goods are (a dyer's unit or our store) */
export const LOCATED_CATEGORIES = ['GREIGE', 'GREIGE_LACE', 'LACE'] as const;
/** Colour is the dye's, not the greige's: never compared on these */
const COLOURLESS_CATEGORIES = new Set(['GREIGE', 'GREIGE_LACE']);
/** What still needs buying */
export const LINKABLE_REQUIREMENT_STATUSES = ['PO_REQUIRED', 'PARTIAL_STOCK'] as const;
/** Orders that may take a link. A requirement with no order (entered by hand) may too. */
export const RUNNING_ORDER_STATUSES = ['PENDING', 'IN_PRODUCTION'] as const;
/** A requirement Undo may return to demand: still on the PO, nothing received for it */
const UNDOABLE_REQUIREMENT_STATUSES = ['PO_GENERATED', 'PO_SENT'] as const;
/** Statuses `returnDemandAfterUnlink` moves out of */
const RETURNABLE_STATUSES = ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] as const;

const TX_OPTIONS = { timeout: 30000, maxWait: 10000 };

const includes = (list: readonly string[], value: string | null | undefined) => value != null && list.includes(value);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Down to 3 dp — a suggestion never rounds up past what is free */
const floor3 = (n: number) => Math.floor(n * 1000 + 1e-6) / 1000;
const num = (v: Prisma.Decimal | number | string | null | undefined) => (v == null ? 0 : Number(v));
const sumOf = (xs: Iterable<number>) => {
  let s = 0;
  for (const x of xs) s += x;
  return round3(s);
};
const uniq = <T>(xs: Iterable<T>) => [...new Set(xs)];
const statusWord = (s: string | null | undefined) => (s ?? 'unknown').toLowerCase().replace(/_/g, ' ');
const colourKey = (c: string | null | undefined) => (c ?? '').toLowerCase().replace(/\s+/g, '');
const qty3 = (n: number) => new Prisma.Decimal(round3(n).toFixed(3));

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Pure: priority, figures, suggestions, sizes
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** What decides who is filled first on a line */
export interface FillPriorityKey {
  /** orders.expectedDeliveryDate — null for a requirement with no order */
  orderDeliveryDate: Date | null;
  requiredDate: Date | null;
  orderNumber: string | null;
  requirementNumber: string | null;
}

const byDate = (a: Date | null, b: Date | null) => {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  return a.getTime() - b.getTime();
};
const byText = (a: string | null, b: string | null) => {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * Earliest need first: the order's delivery date, then the requirement's required date (nulls last on both),
 * then order number, then requirement number. The rank a link gets on its line (`fillOrder`), and the order
 * the Allocate dialog lists and suggests in.
 */
export function compareFillPriority(a: FillPriorityKey, b: FillPriorityKey): number {
  return (
    byDate(a.orderDeliveryDate, b.orderDeliveryDate) ||
    byDate(a.requiredDate, b.requiredDate) ||
    byText(a.orderNumber, b.orderNumber) ||
    byText(a.requirementNumber, b.requirementNumber)
  );
}

/** What `lineFigures` reads from a line's credits */
export type LineFigureSource = Pick<
  LineCredits,
  'kind' | 'orderedStock' | 'arrived' | 'credited' | 'allocated' | 'plainStock' | 'toCome' | 'uncredited' | 'held'
>;

export interface LineFigures {
  orderedStock: number;
  arrived: number;
  /** Σ credit over the links */
  credited: number;
  /** Σ allocated over eligible links */
  allocated: number;
  /** Arrived and nobody's */
  plain: number;
  toCome: number;
  /** Σ (allocated − credit) over eligible links: what future arrivals already belong to */
  uncredited: number;
  held: number;
  /** Arrived and nobody's, in the pools a link at this processor may use */
  plainReachable: number;
  /** What one more link at this processor may take: plain it can reach + still to come − what is already promised */
  freeToLink: number;
}

/**
 * A line's figures for a link at `dyer` (design §4, C6): freeToLink = plainReachable + toCome − uncredited,
 * never below 0 and never past the line (Σ allocated ≤ what it orders — goods beyond that are plain stock,
 * taken with Use Stock). For a trim line this is simply ordered − allocated. A processor's link reaches its own
 * pool and our store; a link with no processor yet reaches every processor pool and our store; UNPLACED no one.
 */
export function lineFigures(credits: LineFigureSource, dyer: string | null = null): LineFigures {
  const plain = sumOf(Object.values(credits.plainStock));
  let plainReachable: number;
  if (!isLocatedKind(credits.kind)) {
    plainReachable = plain;
  } else {
    plainReachable = sumOf(
      Object.entries(credits.plainStock)
        .filter(([pool]) => pool === STORE_POOL || (dyer ? pool === dyer : isProcessorPool(pool)))
        .map(([, q]) => q)
    );
  }
  const formula = round3(plainReachable + credits.toCome - credits.uncredited);
  const lineRoom = round3(credits.orderedStock - credits.allocated);
  return {
    orderedStock: credits.orderedStock,
    arrived: credits.arrived,
    credited: credits.credited,
    allocated: credits.allocated,
    plain,
    toCome: credits.toCome,
    uncredited: credits.uncredited,
    held: credits.held,
    plainReachable,
    freeToLink: Math.max(0, Math.min(formula, lineRoom)),
  };
}

export interface SuggestCandidate extends FillPriorityKey {
  requirementId: string;
  /** What it still needs bought (its shortfall) */
  need: number;
  linkable: boolean;
  /** Located lines: its processor */
  dyer?: string | null;
  /** Its colour — null when it has none, or on a line where colour is not compared (greige) */
  colorName?: string | null;
}

export interface SuggestLine {
  itemId: string;
  /** What a link with no processor may take (every pool) */
  freeToLink: number;
  /** Located lines: what a link at this processor may take. Omitted = freeToLink for all */
  freeFor?: (dyer: string | null) => number;
  /** The line's colour — null when it has none, or where colour is not compared (greige) */
  colorName?: string | null;
  candidates: readonly SuggestCandidate[];
}

/**
 * The default split (owner decision 2): every linkable requirement its full need, earliest need first, while
 * the PO has room — the last ones it reaches may get part. A requirement is suggested on one line only. Which
 * line, when several could take it:
 *   1. one of its own colour (no colour with no colour) that has room for its whole need;
 *   2. else any line it may go on that has room for its whole need;
 *   3. else a part cover — its own colour first, then the line with the most room (the smallest balance row).
 * Ties go to PO line order. So an order is part-covered only when no line can take all of it, and the split
 * does not depend on which line happens to sort first. Quantities are floored to 3 dp, so a suggestion is
 * never refused as over.
 */
export function suggestAllocations(lines: readonly SuggestLine[]): Map<string, { itemId: string; qty: number }> {
  const out = new Map<string, { itemId: string; qty: number }>();
  const used = new Map<string, number>();
  const roomOn = (line: SuggestLine, c: SuggestCandidate) =>
    round3(
      Math.min(line.freeToLink, line.freeFor ? line.freeFor(c.dyer ?? null) : line.freeToLink) -
        (used.get(line.itemId) ?? 0)
    );

  // Each linkable requirement once, with the lines it may go on (in PO line order)
  const byReq = new Map<string, { cand: SuggestCandidate; on: SuggestLine[] }>();
  for (const line of lines) {
    for (const c of line.candidates) {
      if (!c.linkable) continue;
      const entry = byReq.get(c.requirementId) ?? { cand: c, on: [] };
      entry.on.push(line);
      byReq.set(c.requirementId, entry);
    }
  }
  const ordered = [...byReq.values()].sort(
    (a, b) => compareFillPriority(a.cand, b.cand) || byText(a.cand.requirementId, b.cand.requirementId)
  );

  for (const { cand, on } of ordered) {
    const ownColour = (line: SuggestLine) => colourKey(line.colorName) === colourKey(cand.colorName);
    const takesAll = (line: SuggestLine) => qtyExceeds(cand.need, 0) && !qtyExceeds(cand.need, roomOn(line, cand));
    const partCovers = on
      .filter((line) => qtyExceeds(floor3(Math.min(cand.need, roomOn(line, cand))), 0))
      // Array sort is stable: equal lines keep PO line order
      .sort((a, b) => Number(ownColour(b)) - Number(ownColour(a)) || roomOn(b, cand) - roomOn(a, cand));
    const pick = on.find((line) => ownColour(line) && takesAll(line)) ?? on.find(takesAll) ?? partCovers[0] ?? null;
    if (!pick) continue;
    const qty = floor3(Math.min(cand.need, roomOn(pick, cand)));
    if (!qtyExceeds(qty, 0)) continue;
    out.set(cand.requirementId, { itemId: pick.itemId, qty });
    used.set(pick.itemId, round3((used.get(pick.itemId) ?? 0) + qty));
  }
  return out;
}

/**
 * How much each requirement's link takes when ONE PO line is written for several (MRP generate, Unified PO):
 * its need when the line covers every need (the rest is free on the line), else pro-rata — never more than the
 * need, and together exactly the line. The uncovered part is the caller's split child (MRP-12).
 */
export function sizeLinksForLine(
  lineStockQty: number,
  requirements: ReadonlyArray<{ id: string; need: number }>
): Map<string, number> {
  const out = new Map<string, number>();
  if (requirements.length === 0) return out;
  const totalNeed = sumOf(requirements.map((r) => Math.max(0, r.need)));
  if (!qtyExceeds(totalNeed, lineStockQty)) {
    for (const r of requirements) out.set(r.id, round3(Math.max(0, r.need)));
    return out;
  }
  const shares = splitReceiptAcrossLinks(
    requirements.map((r) => ({ id: r.id, allocatedQuantity: Math.max(0, r.need) })),
    Math.max(0, lineStockQty)
  );
  for (const s of shares) out.set(s.id, round3(s.qty));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Pure: why something cannot be linked or undone
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface PoLinkFacts {
  poNumber: string;
  status: string;
  poCategory: string | null;
  isActive: boolean;
}

/** Why no line of this PO can take a link — null when it can. */
export function poLinkBlock(po: PoLinkFacts): string | null {
  if (!po.isActive) return `${po.poNumber} has been deleted`;
  if (!includes(LINKABLE_PO_STATUSES, po.status)) {
    return `${po.poNumber} is ${statusWord(po.status)} — only a sent PO (sent, acknowledged or part received) can be allocated to orders`;
  }
  if (!includes(LINKABLE_PO_CATEGORIES, po.poCategory)) {
    return `${po.poNumber} is a ${statusWord(po.poCategory ?? 'uncategorised')} PO — its lines are not allocated to orders`;
  }
  return null;
}

export interface LineBlockFacts {
  materialId: string | null;
  materialType: string | null;
  /** The material belongs on this PO's category (po-line-category.helper) */
  fitsCategory: boolean;
  /** A GRN on this line still waiting for QC */
  pendingQcGrnNumber: string | null;
}

/** Why this PO line cannot take a link — null when it can. */
export function lineLinkBlock(po: PoLinkFacts, line: LineBlockFacts): string | null {
  const poBlock = poLinkBlock(po);
  if (poBlock) return poBlock;
  if (!line.materialId) return 'a service line — there are no goods to allocate';
  if (includes(NON_LINKABLE_MATERIAL_TYPES, line.materialType)) {
    return `${statusWord(line.materialType)} lines are not allocated to orders`;
  }
  if (!line.fitsCategory) return `this material does not belong on a ${statusWord(po.poCategory)} PO`;
  if (line.pendingQcGrnNumber) {
    return `GRN ${line.pendingQcGrnNumber} on this line is awaiting QC — finish QC first so what arrived is final`;
  }
  return null;
}

export interface RequirementLinkFacts {
  requirementNumber: string;
  status: string;
  requirementType: string | null;
  materialId: string;
  colorName: string | null;
  unit: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  /** PO / job-work numbers it is already on */
  linkedTo: readonly string[];
}

export interface LineLinkFacts {
  materialId: string | null;
  /** The line's stock unit — its material's unit */
  stockUnit: string | null;
  colorName: string | null;
  poCategory: string | null;
  /** Located lines: the pools the line delivers to (lineDeliveryHolders); null = to be advised */
  holders?: readonly string[] | null;
}

/** Does goods delivered to `holders` reach a link at `dyer`? Our store reaches anyone; to be advised is not judged. */
export function isDyerServed(holders: readonly string[] | null | undefined, dyer: string | null): boolean {
  if (holders == null) return true;
  if (holders.includes(STORE_POOL)) return true;
  if (dyer == null) return holders.some(isProcessorPool);
  return holders.includes(dyer);
}

/** Why this requirement cannot be linked to this line — null when it can. `names` names the pools in the message. */
export function requirementLinkBlock(
  req: RequirementLinkFacts,
  line: LineLinkFacts,
  dyer: string | null = null,
  names: ReadonlyMap<string, string> = new Map()
): string | null {
  if (!includes(LINKABLE_REQUIREMENT_STATUSES, req.status)) {
    if (req.status === 'SIZE_PENDING') {
      return "is awaiting the order's size breakdown — enter the sizes on the order before linking this label";
    }
    if (req.status === 'DECISION_PENDING') return 'needs a decision first — choose Order the extra, then link it';
    if (includes(PO_LINK_REQUIREMENT_STATUSES, req.status)) {
      return `is already on ${req.linkedTo.length > 0 ? req.linkedTo.join(', ') : 'a PO'}`;
    }
    return `is ${statusWord(req.status)} — only a requirement that still needs buying can be linked`;
  }
  if ((req.requirementType ?? 'MATERIAL') !== 'MATERIAL') {
    return 'is a processing requirement — it goes on a job work, not a PO line';
  }
  if (req.materialId !== line.materialId) return 'is for a different material than this line';
  if (
    !COLOURLESS_CATEGORIES.has(line.poCategory ?? '') &&
    colourKey(req.colorName) &&
    colourKey(line.colorName) &&
    colourKey(req.colorName) !== colourKey(line.colorName)
  ) {
    return `is for ${req.colorName}, this line is ${line.colorName}`;
  }
  const reqUnit = normalizeUnit(req.unit);
  const lineUnit = normalizeUnit(line.stockUnit);
  if (!reqUnit || reqUnit !== lineUnit) {
    return `is counted in ${unitShort(req.unit)}, this line's material in ${unitShort(line.stockUnit)}`;
  }
  if (req.linkedTo.length > 0) return `is already on ${req.linkedTo.join(', ')}`;
  if (req.orderId && !includes(RUNNING_ORDER_STATUSES, req.orderStatus)) {
    return `its order ${req.orderNumber ? `${req.orderNumber} ` : ''}is ${statusWord(req.orderStatus)}`;
  }
  if (line.holders !== undefined && !isDyerServed(line.holders, dyer)) {
    const at = (line.holders ?? []).map((p) => names.get(p) ?? p).join(', ');
    return dyer
      ? `is dyed at ${names.get(dyer) ?? dyer}, but this line delivers to ${at}`
      : `this line delivers only to ${at}, which cannot be placed`;
  }
  return null;
}

export interface DeliveryPlaceFacts {
  warehouseType: string;
  supplierId: string | null;
}

export interface DeliveryPlanFacts {
  deliveryWarehouse: DeliveryPlaceFacts | null;
  deliveryPoints: ReadonlyArray<{ warehouse: DeliveryPlaceFacts; lines: ReadonlyArray<{ poItemId: string }> }>;
}

/**
 * The pools a PO line delivers to — each place's `receiptPoolOf` (a processor's unit → that processor, our
 * store → STORE). A split PO: the points carrying this line; one place: that place; to be advised: null.
 * Read at link time only; at receipt the GRN's own warehouse decides (a plan amended later shows a warning).
 */
export function lineDeliveryHolders(plan: DeliveryPlanFacts, poItemId: string): string[] | null {
  if (plan.deliveryPoints.length > 0) {
    const pools = plan.deliveryPoints
      .filter((p) => p.lines.some((l) => l.poItemId === poItemId))
      .map((p) => receiptPoolOf(p.warehouse));
    return pools.length > 0 ? uniq(pools).sort() : null;
  }
  if (plan.deliveryWarehouse) return [receiptPoolOf(plan.deliveryWarehouse)];
  return null;
}

export interface UndoFacts {
  poNumber: string;
  poStatus: string;
  pendingQcGrnNumber: string | null;
  requirementStatus: string;
  /** What the link has been credited (stored or as the fill computes it now — the larger) */
  credit: number;
  issued: number;
  held: number;
  unit: string | null;
  /** Other PO / job-work numbers the requirement is on */
  otherLinks: readonly string[];
}

/** Why a link cannot be undone — null when it can (owner decision 4: until goods arrive for it). */
export function linkUndoBlock(f: UndoFacts): string | null {
  const unit = unitShort(f.unit);
  if (!includes(LINKABLE_PO_STATUSES, f.poStatus)) {
    return `${f.poNumber} is ${statusWord(f.poStatus)} — its links are settled by the PO, not undone`;
  }
  if (qtyExceeds(f.issued, 0)) return `${round3(f.issued)} ${unit} of it was already issued — it can't be undone`;
  if (qtyExceeds(f.credit, 0)) return `${round3(f.credit)} ${unit} already arrived for this order — it can't be undone`;
  if (qtyExceeds(f.held, 0)) return `${round3(f.held)} ${unit} is held for this order — it can't be undone`;
  if (f.pendingQcGrnNumber) return `GRN ${f.pendingQcGrnNumber} on this line is awaiting QC — finish QC first`;
  if (!includes(UNDOABLE_REQUIREMENT_STATUSES, f.requirementStatus)) {
    return `the requirement is ${statusWord(f.requirementStatus)}`;
  }
  if (f.otherLinks.length > 0) {
    return `it is also covered by ${f.otherLinks.join(', ')} — cancel or short-close instead`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────────────────────────

const PLACE_SELECT = { warehouseType: true, supplierId: true } as const;

const PO_SELECT = {
  id: true,
  poNumber: true,
  status: true,
  poCategory: true,
  isActive: true,
  expectedDeliveryDate: true,
  suppliers: { select: { name: true } },
  deliveryWarehouse: { select: PLACE_SELECT },
  deliveryPoints: {
    orderBy: { sequence: 'asc' },
    select: { warehouse: { select: PLACE_SELECT }, lines: { select: { poItemId: true } } },
  },
} as const satisfies Prisma.purchase_ordersSelect;

type PoRow = Prisma.purchase_ordersGetPayload<{ select: typeof PO_SELECT }>;

const LINE_SELECT = {
  id: true,
  poId: true,
  materialId: true,
  orderedQuantity: true,
  unit: true,
  stockUnitsPerUnit: true,
  colorName: true,
  materials: {
    select: { id: true, code: true, name: true, materialType: true, unit: true, ...LABEL_LINE_MATERIAL_SELECT },
  },
} as const satisfies Prisma.purchase_order_itemsSelect;

type LineRow = Prisma.purchase_order_itemsGetPayload<{ select: typeof LINE_SELECT }>;

const REQ_RELATIONS = {
  orders: {
    select: { orderNumber: true, status: true, expectedDeliveryDate: true, customers: { select: { name: true } } },
  },
  order_items: { select: { styles: { select: { styleCode: true, buyerStyleRef: true } } } },
  requirement_po_links: { select: { id: true, purchase_orders: { select: { poNumber: true } } } },
  requirement_jwo_links: { select: { job_work_orders: { select: { jobWorkNumber: true, jwoStatus: true } } } },
} as const satisfies Prisma.material_requirementsInclude;

type ReqRow = Prisma.material_requirementsGetPayload<{ include: typeof REQ_RELATIONS }>;

/** A requirement's live links, as numbers: every PO link (a kept link on a closed PO still covers it) and live jobs */
function linkedToOf(r: ReqRow, exceptLinkId?: string): string[] {
  return [
    ...r.requirement_po_links.filter((l) => l.id !== exceptLinkId).map((l) => l.purchase_orders.poNumber),
    ...r.requirement_jwo_links
      .filter((l) => l.job_work_orders.jwoStatus !== 'CANCELLED')
      .map((l) => l.job_work_orders.jobWorkNumber),
  ];
}

const priorityOf = (r: ReqRow): FillPriorityKey => ({
  orderDeliveryDate: r.orders?.expectedDeliveryDate ?? null,
  requiredDate: r.requiredDate ?? null,
  orderNumber: r.orders?.orderNumber ?? null,
  requirementNumber: r.requirementNumber,
});

const reqFacts = (r: ReqRow, exceptLinkId?: string): RequirementLinkFacts => ({
  requirementNumber: r.requirementNumber,
  status: r.status,
  requirementType: r.requirementType,
  materialId: r.materialId,
  colorName: r.colorName,
  unit: r.unit,
  orderId: r.orderId,
  orderNumber: r.orders?.orderNumber ?? null,
  orderStatus: r.orders?.status ?? null,
  linkedTo: linkedToOf(r, exceptLinkId),
});

const lineFacts = (item: LineRow, po: PoRow, holders?: readonly string[] | null): LineLinkFacts => ({
  materialId: item.materialId,
  stockUnit: item.materials?.unit ?? null,
  colorName: item.colorName,
  poCategory: po.poCategory,
  ...(holders !== undefined ? { holders } : {}),
});

const isLocatedCategory = (category: string | null | undefined) => includes(LOCATED_CATEGORIES, category);

/** Would goods arriving on the PO's expected date come after this requirement is needed? */
function arrivesLate(poDate: Date, requiredDate: Date | null, orderDate: Date | null): boolean {
  const need = [requiredDate, orderDate]
    .filter((d): d is Date => !!d)
    .map((d) => toDateInputValue(d))
    .filter(Boolean)
    .sort()[0];
  return !!need && toDateInputValue(poDate) > need;
}

/** Candidates for a line: MATERIAL rows of these materials that still need buying, unlinked, of running (or no) orders */
const candidateWhere = (materialIds: string[]): Prisma.material_requirementsWhereInput => ({
  materialId: { in: materialIds },
  requirementType: 'MATERIAL',
  status: { in: [...LINKABLE_REQUIREMENT_STATUSES] },
  requirement_po_links: { none: {} },
  requirement_jwo_links: { none: { job_work_orders: { jwoStatus: { not: 'CANCELLED' } } } },
  OR: [{ orderId: null }, { orders: { status: { in: [...RUNNING_ORDER_STATUSES] } } }],
});

async function pendingQcByLine(client: Db, itemIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (itemIds.length === 0) return out;
  const rows = await client.grn_items.findMany({
    where: { poItemId: { in: itemIds }, goods_receiving_notes: { status: 'PENDING_QC' } },
    select: { poItemId: true, goods_receiving_notes: { select: { grnNumber: true } } },
  });
  for (const r of rows) if (r.poItemId && !out.has(r.poItemId)) out.set(r.poItemId, r.goods_receiving_notes.grnNumber);
  return out;
}

export interface PoAllocationPlace {
  /** STORE, UNPLACED, or the processor's supplier id */
  pool: string;
  name: string;
}

async function placeNames(client: Db, pools: Iterable<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>([
    [STORE_POOL, 'Our store'],
    [UNPLACED_POOL, 'A processor unit linked to no processor'],
  ]);
  const ids = uniq(pools).filter(isProcessorPool);
  if (ids.length > 0) {
    const rows = await client.suppliers.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    for (const s of rows) out.set(s.id, s.name);
  }
  return out;
}

const placeOf = (pool: string, names: ReadonlyMap<string, string>): PoAllocationPlace => ({
  pool,
  name: names.get(pool) ?? pool,
});

/** Does each line's material belong on its PO's category (po-line-category.helper) */
async function categoryFit<T extends LineRow>(
  client: Db,
  items: readonly T[],
  categoryOf: (item: T) => string | null
): Promise<Map<string, boolean>> {
  const facts = await loadPoLineMaterials(
    items.map((i) => i.materialId).filter((id): id is string => !!id),
    client as Tx
  );
  const out = new Map<string, boolean>();
  for (const item of items) {
    const fact = item.materialId ? facts.get(item.materialId) : undefined;
    out.set(item.id, !!fact && fitsPoCategory(categoryOf(item), fact));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// GET — the PO's allocation (design §6.5; the API and the PO page code against these types)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface PoAllocationDyer {
  id: string;
  name: string;
}

export interface PoAllocationLinkView {
  linkId: string;
  requirementId: string;
  requirementNumber: string;
  requirementStatus: string;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  customerName: string | null;
  styleCode: string | null;
  /** The buyer's own style code (styles.buyerStyleRef) — screens name the style by it first */
  buyerStyleRef: string | null;
  /** orders.expectedDeliveryDate */
  deliveryDate: Date | null;
  requiredDate: Date | null;
  /** The requirement's (stock) unit */
  unit: string;
  /** Rank on the line: a receipt fills links in this order */
  fillOrder: number | null;
  allocatedQty: number;
  /** Credited from what arrived (as stored) */
  receivedQty: number;
  issuedQty: number;
  /** Goods held for it now */
  heldQty: number;
  /** Located lines: where its order is dyed */
  dyer: PoAllocationDyer | null;
  /** Located: short while cloth sits unclaimed at another processor it cannot use (dyer changed — C10) */
  dyerMoved: boolean;
  /** Located: the line no longer delivers where this order is dyed (the plan changed after linking) */
  deliveryMismatch: boolean;
  /** The current BOM needs this much less than the link covers */
  surplusQty: number | null;
  canUndo: boolean;
  undoBlockedReason: string | null;
}

export interface PoAllocationCandidateView {
  requirementId: string;
  requirementNumber: string;
  requirementStatus: string;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  customerName: string | null;
  styleCode: string | null;
  /** The buyer's own style code (styles.buyerStyleRef) — screens name the style by it first */
  buyerStyleRef: string | null;
  deliveryDate: Date | null;
  requiredDate: Date | null;
  unit: string;
  colorName: string | null;
  /** What it still needs bought (its shortfall) */
  needQty: number;
  allocatedFromStock: number;
  dyer: PoAllocationDyer | null;
  /** The default split (0 = not ticked) */
  suggestedQty: number;
  /** Of the suggestion, what would come from goods already here — held at once, and then it can't be undone */
  alreadyHereQty: number;
  /** The PO is expected after this order needs the goods */
  arrivesLate: boolean;
  linkable: boolean;
  blockedReason: string | null;
}

export interface PoAllocationLineView {
  itemId: string;
  material: {
    id: string;
    code: string;
    name: string;
    materialType: string;
    unit: string;
    label: ReturnType<typeof toLabelLine>['label'];
    size: string | null;
  } | null;
  colorName: string | null;
  /** The PO line's unit (a purchase unit such as GROSS, or the stock unit) */
  unit: string;
  stockUnitsPerUnit: number | null;
  /** The unit links, credits and holds are counted in — the material's */
  stockUnit: string | null;
  kind: LineKind;
  located: boolean;
  /** In the line's own unit */
  orderedQty: number;
  orderedStockQty: number;
  arrivedQty: number;
  /** Σ allocated over live links */
  linkedQty: number;
  receivedForOrdersQty: number;
  heldQty: number;
  /** Arrived and nobody's */
  plainQty: number;
  toComeQty: number;
  /** What more can be linked (a link with no processor) */
  freeToLink: number;
  /** Arrived and nobody's, still physically there — a new link takes it first and holds it at once */
  arrivedFree: number;
  plainByPlace: Array<PoAllocationPlace & { qty: number }>;
  /** Located lines: where it delivers; null = to be advised (or not a located line) */
  deliversTo: PoAllocationPlace[] | null;
  pendingQcGrnNumber: string | null;
  linkable: boolean;
  blockedReason: string | null;
  /** In fill order */
  links: PoAllocationLinkView[];
  /** Earliest need first — the order the dialog lists and suggests in */
  candidates: PoAllocationCandidateView[];
}

export interface PoAllocationView {
  po: {
    id: string;
    poNumber: string;
    status: string;
    poCategory: string | null;
    supplierName: string | null;
    expectedDeliveryDate: Date;
    linkable: boolean;
    blockedReason: string | null;
  };
  lines: PoAllocationLineView[];
  /** Running orders that need these lines' materials and are not linked (the page banner) */
  unlinkedOrderCount: number;
}

const materialView = (item: LineRow): PoAllocationLineView['material'] => {
  const m = item.materials;
  if (!m) return null;
  const { label, size } = toLabelLine(m);
  return { id: m.id, code: m.code, name: m.name, materialType: m.materialType, unit: m.unit, label, size };
};

const dyerView = (dyer: string | null, names: ReadonlyMap<string, string>): PoAllocationDyer | null =>
  dyer ? { id: dyer, name: names.get(dyer) ?? dyer } : null;

/**
 * Everything the PO page's allocation card and the Allocate dialog show: each line's figures, its links in
 * fill order (with Undo and why not), and its candidates earliest-first with the default split. Candidates
 * are listed only while the PO can take links. `itemIds` narrows to some lines (the Requirements page's Link).
 */
export async function getPoAllocation(
  poId: string,
  opts: { itemIds?: string[] } = {},
  client: Db = prisma
): Promise<PoAllocationView> {
  const po = await client.purchase_orders.findUnique({ where: { id: poId }, select: PO_SELECT });
  if (!po) throw new NotFoundError('Purchase order', poId);
  const poBlock = poLinkBlock(po);
  const located = isLocatedCategory(po.poCategory);

  const items = await client.purchase_order_items.findMany({
    where: { poId, ...(opts.itemIds && opts.itemIds.length > 0 ? { id: { in: opts.itemIds } } : {}) },
    select: LINE_SELECT,
    orderBy: PO_LINE_ORDER,
  });
  const fits = await categoryFit(client, items, () => po.poCategory);
  const pendingQc = await pendingQcByLine(
    client,
    items.map((i) => i.id)
  );

  const credits = new Map<string, LineCredits>();
  for (const item of items) {
    const c = await computeLineCredits(client, item.id);
    if (c) credits.set(item.id, c);
  }

  const materialIds = uniq(items.map((i) => i.materialId).filter((id): id is string => !!id));
  const candidateRows =
    !poBlock && materialIds.length > 0
      ? await client.material_requirements.findMany({
          where: candidateWhere(materialIds),
          include: REQ_RELATIONS,
          orderBy: { requirementNumber: 'asc' },
        })
      : [];
  const linkedIds = uniq([...credits.values()].flatMap((c) => c.links.map((l) => l.requirementId)));
  const linkedRows =
    linkedIds.length > 0
      ? await client.material_requirements.findMany({ where: { id: { in: linkedIds } }, include: REQ_RELATIONS })
      : [];
  const reqById = new Map<string, ReqRow>([...linkedRows, ...candidateRows].map((r) => [r.id, r]));
  const candidateDyers = located
    ? await requirementDyers(
        client,
        candidateRows.map((r) => r.id)
      )
    : new Map<string, string | null>();

  const holdersOf = new Map(items.map((i) => [i.id, located ? lineDeliveryHolders(po, i.id) : null]));
  const pools = new Set<string>();
  for (const h of holdersOf.values()) for (const p of h ?? []) pools.add(p);
  for (const c of credits.values()) {
    for (const p of Object.keys(c.plainStock)) pools.add(p);
    for (const l of c.links) if (l.dyer) pools.add(l.dyer);
  }
  for (const d of candidateDyers.values()) if (d) pools.add(d);
  const names = await placeNames(client, pools);

  // Lines and their candidates, before the default split
  const suggestLines: SuggestLine[] = [];
  const views: PoAllocationLineView[] = [];
  const candidateBlocks = new Map<string, string | null>(); // `${itemId}:${reqId}` → reason
  for (const item of items) {
    const c = credits.get(item.id);
    if (!c) continue;
    const pendingQcGrnNumber = pendingQc.get(item.id) ?? null;
    const blockedReason = lineLinkBlock(po, {
      materialId: item.materialId,
      materialType: item.materials?.materialType ?? null,
      fitsCategory: fits.get(item.id) ?? false,
      pendingQcGrnNumber,
    });
    const holders = holdersOf.get(item.id) ?? null;
    const fig = lineFigures(c);
    const arrivedFree =
      qtyExceeds(fig.plainReachable, 0) && !blockedReason
        ? Math.min(
            fig.plainReachable,
            await physicallyFreeAcross(
              client,
              item.id,
              Object.keys(c.plainStock).filter((p) => p !== UNPLACED_POOL)
            )
          )
        : 0;

    const links: PoAllocationLinkView[] = c.links.map((l) => {
      const r = reqById.get(l.requirementId);
      const credit = Math.max(l.credit, l.received);
      const undoBlockedReason = linkUndoBlock({
        poNumber: po.poNumber,
        poStatus: po.status,
        pendingQcGrnNumber,
        requirementStatus: r?.status ?? 'UNKNOWN',
        credit,
        issued: l.issued,
        held: l.held,
        unit: r?.unit ?? null,
        otherLinks: r ? linkedToOf(r, l.id) : [],
      });
      const waitingElsewhere = Object.entries(c.plainStock).some(
        ([pool, q]) => isProcessorPool(pool) && pool !== l.dyer && qtyExceeds(q, 0)
      );
      return {
        linkId: l.id,
        requirementId: l.requirementId,
        requirementNumber: l.requirementNumber ?? r?.requirementNumber ?? '',
        requirementStatus: r?.status ?? 'UNKNOWN',
        orderId: l.orderId,
        orderNumber: l.orderNumber,
        orderStatus: l.orderStatus,
        customerName: r?.orders?.customers?.name ?? null,
        styleCode: r?.order_items?.styles?.styleCode ?? null,
        buyerStyleRef: r?.order_items?.styles?.buyerStyleRef ?? null,
        deliveryDate: r?.orders?.expectedDeliveryDate ?? null,
        requiredDate: r?.requiredDate ?? null,
        unit: r?.unit ?? item.materials?.unit ?? '',
        fillOrder: l.fillOrder,
        allocatedQty: l.allocated,
        receivedQty: l.received,
        issuedQty: l.issued,
        heldQty: l.held,
        dyer: located ? dyerView(l.dyer, names) : null,
        dyerMoved:
          located &&
          l.eligible &&
          !!l.dyer &&
          (Math.abs(l.credit - l.received) >= QTY_EPSILON || (qtyExceeds(l.allocated, l.credit) && waitingElsewhere)),
        deliveryMismatch: located && l.eligible && !isDyerServed(holders, l.dyer),
        surplusQty: r?.surplusQty != null ? num(r.surplusQty) : null,
        canUndo: !undoBlockedReason,
        undoBlockedReason,
      };
    });

    const lineCandidates = candidateRows
      .filter((r) => r.materialId === item.materialId)
      .sort((a, b) => compareFillPriority(priorityOf(a), priorityOf(b)));
    for (const r of lineCandidates) {
      const dyer = located ? (candidateDyers.get(r.id) ?? null) : null;
      const block =
        blockedReason ??
        requirementLinkBlock(reqFacts(r), lineFacts(item, po, located ? holders : undefined), dyer, names);
      candidateBlocks.set(`${item.id}:${r.id}`, block);
    }
    if (!blockedReason) {
      const colourCompared = !COLOURLESS_CATEGORIES.has(po.poCategory ?? '');
      suggestLines.push({
        itemId: item.id,
        freeToLink: fig.freeToLink,
        ...(located ? { freeFor: (d: string | null) => lineFigures(c, d).freeToLink } : {}),
        colorName: colourCompared ? item.colorName : null,
        candidates: lineCandidates.map((r) => ({
          ...priorityOf(r),
          requirementId: r.id,
          need: num(r.shortfall),
          linkable: !candidateBlocks.get(`${item.id}:${r.id}`),
          dyer: located ? (candidateDyers.get(r.id) ?? null) : null,
          colorName: colourCompared ? r.colorName : null,
        })),
      });
    }

    views.push({
      itemId: item.id,
      material: materialView(item),
      colorName: item.colorName,
      unit: item.unit,
      stockUnitsPerUnit: item.stockUnitsPerUnit != null ? num(item.stockUnitsPerUnit) : null,
      stockUnit: item.materials?.unit ?? null,
      kind: c.kind,
      located,
      orderedQty: num(item.orderedQuantity),
      orderedStockQty: fig.orderedStock,
      arrivedQty: fig.arrived,
      linkedQty: fig.allocated,
      receivedForOrdersQty: fig.credited,
      heldQty: fig.held,
      plainQty: fig.plain,
      toComeQty: fig.toCome,
      freeToLink: fig.freeToLink,
      arrivedFree: round3(arrivedFree),
      plainByPlace: Object.entries(c.plainStock)
        .filter(([, q]) => qtyExceeds(q, 0))
        .map(([pool, q]) => ({ ...placeOf(pool, names), qty: q })),
      deliversTo: holders ? holders.map((p) => placeOf(p, names)) : null,
      pendingQcGrnNumber,
      linkable: !blockedReason,
      blockedReason,
      links,
      candidates: lineCandidates.map((r) => {
        const block = candidateBlocks.get(`${item.id}:${r.id}`) ?? null;
        const dyer = located ? (candidateDyers.get(r.id) ?? null) : null;
        return {
          requirementId: r.id,
          requirementNumber: r.requirementNumber,
          requirementStatus: r.status,
          orderId: r.orderId,
          orderNumber: r.orders?.orderNumber ?? null,
          orderStatus: r.orders?.status ?? null,
          customerName: r.orders?.customers?.name ?? null,
          styleCode: r.order_items?.styles?.styleCode ?? null,
          buyerStyleRef: r.order_items?.styles?.buyerStyleRef ?? null,
          deliveryDate: r.orders?.expectedDeliveryDate ?? null,
          requiredDate: r.requiredDate ?? null,
          unit: r.unit,
          colorName: r.colorName,
          needQty: num(r.shortfall),
          allocatedFromStock: num(r.allocatedFromStock),
          dyer: dyerView(dyer, names),
          suggestedQty: 0,
          alreadyHereQty: 0,
          arrivesLate: arrivesLate(po.expectedDeliveryDate, r.requiredDate, r.orders?.expectedDeliveryDate ?? null),
          linkable: !block,
          blockedReason: block,
        };
      }),
    });
  }

  // The default split, then what of it would be taken from goods already here
  const suggestions = suggestAllocations(suggestLines);
  for (const view of views) {
    let rank = Math.max(0, ...view.links.map((l) => l.fillOrder ?? 0));
    const withLinks: Array<{
      id: string;
      requirementId: string;
      allocated: number;
      fillOrder: number;
      dyer: string | null;
    }> = [];
    for (const cand of view.candidates) {
      const s = suggestions.get(cand.requirementId);
      if (!s || s.itemId !== view.itemId) continue;
      cand.suggestedQty = s.qty;
      withLinks.push({
        id: `new:${cand.requirementId}`,
        requirementId: cand.requirementId,
        allocated: s.qty,
        fillOrder: ++rank,
        dyer: cand.dyer?.id ?? null,
      });
    }
    if (withLinks.length === 0 || !qtyExceeds(view.arrivedFree, 0)) continue;
    const dry = await computeLineCredits(client, view.itemId, { withLinks });
    for (const cand of view.candidates) {
      const credit = dry?.links.find((l) => l.id === `new:${cand.requirementId}`)?.credit ?? 0;
      cand.alreadyHereQty = round3(Math.min(credit, view.arrivedFree));
    }
  }

  const unlinkedOrders = new Set<string>();
  for (const v of views)
    for (const cand of v.candidates) if (cand.linkable && cand.orderId) unlinkedOrders.add(cand.orderId);

  return {
    po: {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      poCategory: po.poCategory,
      supplierName: po.suppliers?.name ?? null,
      expectedDeliveryDate: po.expectedDeliveryDate,
      linkable: !poBlock,
      blockedReason: poBlock,
    },
    lines: views,
    unlinkedOrderCount: unlinkedOrders.size,
  };
}

/** Arrived goods of a line still physically free, over these pools */
async function physicallyFreeAcross(client: Db, poItemId: string, pools: string[]): Promise<number> {
  let free = 0;
  for (const pool of pools) free += await physicallyFreeForLine(client, poItemId, pool);
  return round3(free);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Fill order
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Rank the links of these PO lines after their links changed (design §4, change C4): links up to the last one
 * credited keep their rank; every link after it — new ones included — is ordered earliest need first. Credit is
 * the stored credit, or what the link issued when that is more (the engine keeps the stored credit current).
 * The caller holds the PO lock.
 */
export async function assignLineFillOrder(tx: Tx, poItemIds: string[]): Promise<void> {
  for (const itemId of uniq(poItemIds.filter(Boolean)).sort()) {
    const links = await tx.requirement_po_links.findMany({
      where: { purchaseOrderItemId: itemId },
      select: {
        id: true,
        fillOrder: true,
        receivedQuantity: true,
        material_requirements: {
          select: {
            requirementNumber: true,
            requiredDate: true,
            orders: { select: { orderNumber: true, expectedDeliveryDate: true } },
          },
        },
      },
    });
    if (links.length === 0) continue;
    const floors = await consumedByLinkPool(
      tx,
      links.map((l) => l.id)
    );
    const keyed = links.map((l) => ({
      id: l.id,
      fillOrder: l.fillOrder,
      orderDeliveryDate: l.material_requirements.orders?.expectedDeliveryDate ?? null,
      requiredDate: l.material_requirements.requiredDate ?? null,
      orderNumber: l.material_requirements.orders?.orderNumber ?? null,
      requirementNumber: l.material_requirements.requirementNumber,
    }));
    const credit = new Map(
      links.map((l) => [l.id, Math.max(num(l.receivedQuantity), sumOf(Object.values(floors.get(l.id) ?? {})))])
    );
    const ranks = rankTail(keyed, credit, compareFillPriority);
    for (const link of keyed) {
      const rank = ranks.get(link.id);
      if (rank != null && rank !== link.fillOrder) {
        await tx.requirement_po_links.update({ where: { id: link.id }, data: { fillOrder: rank } });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Balance rows and returning demand
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The part of a requirement a PO does not give it, carried as its own orderable requirement (the MRP-12 split
 * shape): PO_REQUIRED, nothing from stock, `splitFromId` = the parent. One copy of the fields for every path
 * (link part cover, PO cancel / short-close, goods taken for another order) — the MRP and PO copies differed
 * (fabricWidth / cadId). Numbered with generateAtomicDocNumber('MR') inside the caller's transaction.
 */
export async function mintBalanceChild(
  tx: Tx,
  requirement: material_requirements,
  balance: number,
  createdById?: string | null
): Promise<{ id: string; requirementNumber: string }> {
  const requirementNumber = await generateAtomicDocNumber('MR', tx);
  return tx.material_requirements.create({
    data: {
      requirementNumber,
      source: requirement.source,
      orderId: requirement.orderId,
      orderItemId: requirement.orderItemId,
      materialId: requirement.materialId,
      orderBomId: requirement.orderBomId,
      orderBomItemId: requirement.orderBomItemId,
      orderQuantity: requirement.orderQuantity,
      quantityPerUnit: requirement.quantityPerUnit,
      wastagePercent: requirement.wastagePercent,
      totalRequired: qty3(balance),
      unit: requirement.unit,
      availableStock: 0,
      allocatedFromStock: 0,
      shortfall: qty3(balance),
      preferredSupplierId: requirement.preferredSupplierId,
      status: 'PO_REQUIRED',
      fabricWidth: requirement.fabricWidth,
      cadId: requirement.cadId,
      requirementType: requirement.requirementType,
      processorId: requirement.processorId,
      processingCost: requirement.processingCost,
      processingType: requirement.processingType,
      printingType: requirement.printingType,
      linkedRequirementId: requirement.linkedRequirementId,
      // Shrinkage provenance must survive the split or the child silently re-derives 0%
      shrinkagePercentUsed: requirement.shrinkagePercentUsed,
      shrinkageSource: requirement.shrinkageSource,
      colorName: requirement.colorName,
      componentName: requirement.componentName,
      requiredDate: requirement.requiredDate,
      createdById: createdById ?? requirement.createdById,
      unitPrice: requirement.unitPrice,
      rateSource: requirement.rateSource,
      splitFromId: requirement.id,
    },
    select: { id: true, requirementNumber: true },
  });
}

export interface ReturnDemandRow {
  id: string;
  /** Shortfall folded back into it (its untouched split children) */
  addShortfall?: number;
}

export interface ReturnDemandOutcome {
  requirementId: string;
  requirementNumber: string;
  /** Its status after (unchanged when it still has a live link or was not on a PO) */
  status: string;
  changed: boolean;
}

/**
 * A requirement that lost its last link goes back to demand (Undo, PO cancel / short-close with nothing
 * received, order cancel). Only a row with no live link left, still in PO_GENERATED / PO_SENT /
 * PARTIALLY_RECEIVED — or RECEIVED when its order is cancelled (guarded write). A `surplusQty` the BOM left on
 * it is applied first — the row shrinks by it, never below 0, and the flag clears (M3). Then:
 *   order cancelled → CANCELLED (its holds released);   nothing left → FULFILLED_STOCK if part came from stock, else CANCELLED;
 *   part from stock → PARTIAL_STOCK;                    otherwise → PO_REQUIRED.
 */
export async function returnDemandAfterUnlink(
  tx: Tx,
  rows: readonly ReturnDemandRow[],
  ctx: { userId?: string; label?: string } = {}
): Promise<ReturnDemandOutcome[]> {
  const out: ReturnDemandOutcome[] = [];
  for (const row of rows) {
    const r = await tx.material_requirements.findUnique({
      where: { id: row.id },
      include: {
        orders: { select: { status: true } },
        requirement_po_links: { select: { id: true } },
        requirement_jwo_links: { select: { job_work_orders: { select: { jwoStatus: true } } } },
      },
    });
    if (!r) continue;
    const liveLink =
      r.requirement_po_links.length > 0 ||
      r.requirement_jwo_links.some((l) => l.job_work_orders.jwoStatus !== 'CANCELLED');
    // A cancelled order's row may already read RECEIVED (credited in full, then passed on when the order was
    // cancelled): with its link gone it must leave the PO statuses too (invariant 1)
    const orderCancelled = r.orders?.status === 'CANCELLED';
    const returnable: MaterialRequirementStatus[] = orderCancelled
      ? [...RETURNABLE_STATUSES, 'RECEIVED']
      : [...RETURNABLE_STATUSES];
    if (liveLink || !includes(returnable, r.status)) {
      out.push({ requirementId: r.id, requirementNumber: r.requirementNumber, status: r.status, changed: false });
      continue;
    }

    let total = num(r.totalRequired);
    let need = round3(num(r.shortfall) + (row.addShortfall ?? 0));
    const surplus = num(r.surplusQty);
    const applySurplus = qtyExceeds(surplus, 0);
    if (applySurplus) {
      total = Math.max(0, round3(total - surplus));
      need = Math.max(0, round3(need - surplus));
    }
    const fromStock = num(r.allocatedFromStock);
    let status: MaterialRequirementStatus;
    if (orderCancelled) status = 'CANCELLED';
    else if (isQtyZero(need)) status = qtyExceeds(fromStock, 0) ? 'FULFILLED_STOCK' : 'CANCELLED';
    else status = qtyExceeds(fromStock, 0) ? 'PARTIAL_STOCK' : 'PO_REQUIRED';

    const res = await tx.material_requirements.updateMany({
      where: { id: r.id, status: { in: returnable } },
      data: {
        status,
        shortfall: qty3(need),
        ...(applySurplus ? { totalRequired: qty3(total), surplusQty: null } : {}),
      },
    });
    if (res.count === 0) {
      logWarn(`[po-allocation] ${ctx.label ?? 'unlink'}: ${r.requirementNumber} left its PO status meanwhile`, {
        requirementId: r.id,
      });
      out.push({ requirementId: r.id, requirementNumber: r.requirementNumber, status: r.status, changed: false });
      continue;
    }
    if (status === 'CANCELLED') await releaseReservations(tx, [r.id]);
    out.push({ requirementId: r.id, requirementNumber: r.requirementNumber, status, changed: true });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// POST — link
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface AllocationInput {
  purchaseOrderItemId: string;
  requirementId: string;
  /** In the requirement's (stock) unit */
  quantity: number;
}

export interface AllocationRefusal {
  purchaseOrderItemId: string | null;
  requirementId: string | null;
  requirementNumber: string | null;
  reason: string;
}

export interface AllocatedLink {
  linkId: string;
  purchaseOrderItemId: string;
  requirementId: string;
  requirementNumber: string;
  orderNumber: string | null;
  quantity: number;
  /** Credited at once from goods already here and held for it — this link can no longer be undone (D12) */
  heldAtOnce: number;
}

export interface AllocationSplit {
  requirementNumber: string;
  childNumber: string;
  balance: number;
}

export interface AllocatePoLinesResult {
  poId: string;
  poNumber: string;
  linked: AllocatedLink[];
  splits: AllocationSplit[];
  /** Receipt holds placed at once (D12), by line */
  holds: LineReceiptOutcome[];
  /** Write with createAuditLog AFTER the transaction commits */
  audit: AuditLogOptions;
}

function refused(poNumber: string, rows: AllocationRefusal[]): BusinessError {
  const first = rows[0];
  const who = first.requirementNumber ? `${first.requirementNumber} ` : '';
  const more = rows.length > 1 ? ` (and ${rows.length - 1} more)` : '';
  return new BusinessError(`Cannot allocate ${poNumber}: ${who}${first.reason}${more}.`, {
    code: 'PO_ALLOCATION_REFUSED',
    rows,
  });
}

/**
 * Link requirements to lines of a sent PO, inside the caller's transaction (the dialog's POST, and MRP's
 * link-po once its own pre-checks pass). In order:
 *  1. lock the PO row, re-check it can take links;
 *  2. check every line and requirement — every reason is collected into ONE PO_ALLOCATION_REFUSED (422);
 *  3. per line, Σ requested ≤ free to link (per processor on greige / lace) — else PO_LINE_OVER_ALLOCATED (409);
 *  4. guarded flip to PO_SENT (a count that differs → PO_ALLOCATION_CHANGED, 409), links at 3 dp;
 *  5. a part cover leaves a PO_REQUIRED balance child and the parent's shortfall becomes what was linked;
 *  6. rank the lines' links; 7. a line whose goods already arrived: the new links' credit from them must be
 *     physically free (PO_ARRIVED_NOT_FREE), and is then held at once (applyLineReceipts 'link');
 *  8. Σ allocated on each line ≤ what it orders.
 * The caller writes `audit` with createAuditLog after commit. Run with {timeout: 30000, maxWait: 10000}.
 */
export async function allocatePoLinesInTx(
  tx: Tx,
  poId: string,
  allocations: readonly AllocationInput[],
  userId: string
): Promise<AllocatePoLinesResult> {
  await lockPurchaseOrder(tx, poId);
  const po = await tx.purchase_orders.findUnique({ where: { id: poId }, select: PO_SELECT });
  if (!po) throw new NotFoundError('Purchase order', poId);
  if (allocations.length === 0) {
    throw refused(po.poNumber, [
      { purchaseOrderItemId: null, requirementId: null, requirementNumber: null, reason: 'nothing to link' },
    ]);
  }
  const poBlock = poLinkBlock(po);
  if (poBlock) {
    throw refused(po.poNumber, [
      { purchaseOrderItemId: null, requirementId: null, requirementNumber: null, reason: poBlock },
    ]);
  }
  const located = isLocatedCategory(po.poCategory);

  // ── Lines: only this PO's ──
  const itemIds = uniq(allocations.map((a) => a.purchaseOrderItemId));
  const items = await tx.purchase_order_items.findMany({ where: { poId, id: { in: itemIds } }, select: LINE_SELECT });
  const itemById = new Map(items.map((i) => [i.id, i]));
  const fits = await categoryFit(tx, items, () => po.poCategory);
  const pendingQc = await pendingQcByLine(
    tx,
    items.map((i) => i.id)
  );
  const lineBlock = new Map<string, string | null>();
  for (const id of itemIds) {
    const item = itemById.get(id);
    lineBlock.set(
      id,
      item
        ? lineLinkBlock(po, {
            materialId: item.materialId,
            materialType: item.materials?.materialType ?? null,
            fitsCategory: fits.get(id) ?? false,
            pendingQcGrnNumber: pendingQc.get(id) ?? null,
          })
        : `this line is not on ${po.poNumber}`
    );
  }

  // ── Requirements ──
  // Locked before they are read: a Use Stock committing in between would otherwise leave this link sized on the
  // old shortfall (the guarded flip below matches PARTIAL_STOCK too), covering the same pieces twice. Id order,
  // so two allocations over the same rows queue instead of deadlocking.
  const reqIds = uniq(allocations.map((a) => a.requirementId)).sort();
  await tx.$queryRaw`SELECT id FROM material_requirements WHERE id IN (${Prisma.join(reqIds)}) ORDER BY id FOR UPDATE`;
  const reqs = await tx.material_requirements.findMany({ where: { id: { in: reqIds } }, include: REQ_RELATIONS });
  const reqById = new Map(reqs.map((r) => [r.id, r]));
  const dyers = located ? await requirementDyers(tx, reqIds) : new Map<string, string | null>();
  const pools = new Set<string>();
  if (located) {
    for (const i of items) for (const p of lineDeliveryHolders(po, i.id) ?? []) pools.add(p);
    for (const d of dyers.values()) if (d) pools.add(d);
  }
  const names = located ? await placeNames(tx, pools) : new Map<string, string>();

  const refusals: AllocationRefusal[] = [];
  const accepted: Array<{ item: LineRow; req: ReqRow; qty: number; dyer: string | null }> = [];
  const seen = new Set<string>();
  for (const a of allocations) {
    const req = reqById.get(a.requirementId);
    const refuse = (reason: string) =>
      refusals.push({
        purchaseOrderItemId: a.purchaseOrderItemId,
        requirementId: a.requirementId,
        requirementNumber: req?.requirementNumber ?? null,
        reason,
      });
    if (!req) {
      refuse('requirement not found');
      continue;
    }
    if (seen.has(req.id)) {
      refuse('is asked for twice — a requirement goes on one PO line');
      continue;
    }
    seen.add(req.id);
    const block = lineBlock.get(a.purchaseOrderItemId);
    if (block) {
      refuse(block);
      continue;
    }
    const item = itemById.get(a.purchaseOrderItemId)!;
    const dyer = located ? (dyers.get(req.id) ?? null) : null;
    const reqBlock = requirementLinkBlock(
      reqFacts(req),
      lineFacts(item, po, located ? lineDeliveryHolders(po, item.id) : undefined),
      dyer,
      names
    );
    if (reqBlock) {
      refuse(reqBlock);
      continue;
    }
    const need = num(req.shortfall);
    if (!qtyExceeds(a.quantity, 0)) {
      refuse('the quantity must be more than 0');
      continue;
    }
    if (qtyExceeds(a.quantity, need)) {
      refuse(`${a.quantity} ${unitShort(req.unit)} is more than it needs (${need} ${unitShort(req.unit)})`);
      continue;
    }
    accepted.push({ item, req, qty: round3(snapToLimit(a.quantity, need)), dyer });
  }
  if (refusals.length > 0) throw refused(po.poNumber, refusals);

  // ── Room on each line ──
  const byLine = new Map<string, typeof accepted>();
  for (const x of accepted) byLine.set(x.item.id, [...(byLine.get(x.item.id) ?? []), x]);
  for (const [itemId, rows] of byLine) {
    const credits = await computeLineCredits(tx, itemId);
    if (!credits) continue;
    const overBy = (requested: number, free: number, dyer: string | null) =>
      new ConflictError(
        `${itemById.get(itemId)?.materials?.code ?? 'This line'} on ${po.poNumber}: ${requested} asked for, ` +
          `only ${free} ${unitShort(rows[0].req.unit)} is still free to link${dyer ? ` for orders dyed at ${names.get(dyer) ?? dyer}` : ''}. ` +
          `Reload and try again.`,
        { code: 'PO_LINE_OVER_ALLOCATED', purchaseOrderItemId: itemId, free, requested }
      );
    const requested = sumOf(rows.map((r) => r.qty));
    const free = lineFigures(credits).freeToLink;
    if (qtyExceeds(requested, free)) throw overBy(requested, free, null);
    if (located) {
      for (const dyer of uniq(rows.map((r) => r.dyer)).filter((d): d is string => !!d)) {
        const mine = sumOf(rows.filter((r) => r.dyer === dyer).map((r) => r.qty));
        const freeHere = lineFigures(credits, dyer).freeToLink;
        if (qtyExceeds(mine, freeHere)) throw overBy(mine, freeHere, dyer);
      }
    }
  }

  // ── Write: status, links, balance rows, ranks ──
  const flip = await tx.material_requirements.updateMany({
    where: { id: { in: accepted.map((x) => x.req.id) }, status: { in: [...LINKABLE_REQUIREMENT_STATUSES] } },
    data: { status: 'PO_SENT' },
  });
  if (flip.count !== accepted.length) {
    throw new ConflictError(
      `Some of these requirements changed while they were being linked (another PO or Use Stock took them). Reload and try again.`,
      { code: 'PO_ALLOCATION_CHANGED' }
    );
  }
  const created = accepted.map((x) => ({ ...x, linkId: randomUUID() }));
  try {
    await tx.requirement_po_links.createMany({
      data: created.map((x) => ({
        id: x.linkId,
        requirementId: x.req.id,
        purchaseOrderId: poId,
        purchaseOrderItemId: x.item.id,
        allocatedQuantity: qty3(x.qty),
      })),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A requirement is already linked to this line. Reload and try again.', {
        code: 'PO_ALLOCATION_CHANGED',
      });
    }
    throw err;
  }

  const splits: AllocationSplit[] = [];
  for (const x of created) {
    const rest = round3(num(x.req.shortfall) - x.qty);
    // Below a paise of dust there is nothing worth ordering (the MRP-12 threshold)
    if (rest <= 0.01) continue;
    const child = await mintBalanceChild(tx, x.req, rest, userId);
    await tx.material_requirements.update({ where: { id: x.req.id }, data: { shortfall: qty3(x.qty) } });
    splits.push({ requirementNumber: x.req.requirementNumber, childNumber: child.requirementNumber, balance: rest });
  }

  await assignLineFillOrder(tx, [...byLine.keys()]);

  // ── Goods already here (C5 / D12) ──
  const newIds = new Set<string>(created.map((x) => x.linkId));
  const toHold: string[] = [];
  for (const itemId of [...byLine.keys()].sort()) {
    const credits = await computeLineCredits(tx, itemId);
    if (!credits || !qtyExceeds(credits.arrived, 0)) continue;
    const wantByPool: Record<string, number> = {};
    for (const l of credits.links) {
      if (!newIds.has(l.id)) continue;
      for (const [pool, q] of Object.entries(l.creditByPool)) wantByPool[pool] = round3((wantByPool[pool] ?? 0) + q);
    }
    let takesArrived = false;
    for (const [pool, want] of Object.entries(wantByPool)) {
      if (!qtyExceeds(want, 0)) continue;
      takesArrived = true;
      const free = await physicallyFreeForLine(tx, itemId, pool);
      if (qtyExceeds(want, free)) {
        const unit = unitShort(byLine.get(itemId)![0].req.unit);
        const at = located ? ` at ${names.get(pool) ?? (pool === STORE_POOL ? 'our store' : pool)}` : '';
        throw new BusinessError(
          `${itemById.get(itemId)?.materials?.code ?? 'This line'} on ${po.poNumber}: only ${free} of the ${want} ${unit} ` +
            `that arrived${at} are still free — the rest was used or held elsewhere. Link less, or Use Stock for them.`,
          { code: 'PO_ARRIVED_NOT_FREE', purchaseOrderItemId: itemId, pool, free, wanted: want }
        );
      }
    }
    if (takesArrived) toHold.push(itemId);
  }
  const holds = toHold.length > 0 ? await applyLineReceipts(tx, toHold, { event: 'link', userId }) : [];
  const heldOf = new Map(holds.flatMap((h) => h.links.map((l) => [l.linkId, l.held] as const)));

  // ── Never more than the line orders ──
  for (const [itemId] of byLine) {
    const credits = await computeLineCredits(tx, itemId);
    if (credits && qtyExceeds(credits.allocated, credits.orderedStock)) {
      throw new ConflictError(
        `${po.poNumber}: the links on a line would come to ${credits.allocated}, more than its ${credits.orderedStock}. Reload and try again.`,
        {
          code: 'PO_LINE_OVER_ALLOCATED',
          purchaseOrderItemId: itemId,
          free: 0,
          requested: credits.allocated,
        }
      );
    }
  }

  const linked: AllocatedLink[] = created.map((x) => ({
    linkId: x.linkId,
    purchaseOrderItemId: x.item.id,
    requirementId: x.req.id,
    requirementNumber: x.req.requirementNumber,
    orderNumber: x.req.orders?.orderNumber ?? null,
    quantity: x.qty,
    heldAtOnce: heldOf.get(x.linkId) ?? 0,
  }));
  return {
    poId,
    poNumber: po.poNumber,
    linked,
    splits,
    holds,
    audit: {
      userId,
      action: 'UPDATE',
      entityType: 'purchase_order',
      entityId: poId,
      newValues: {
        event: 'ALLOCATE_TO_ORDERS',
        poNumber: po.poNumber,
        allocations: linked.map((l) => ({
          requirementNumber: l.requirementNumber,
          orderNumber: l.orderNumber,
          purchaseOrderItemId: l.purchaseOrderItemId,
          qty: l.quantity,
          heldAtOnce: l.heldAtOnce,
        })),
        splits,
      },
    },
  };
}

export type AllocatePoLinesResponse = Omit<AllocatePoLinesResult, 'audit' | 'holds'> & {
  allocation: PoAllocationView;
};

/** POST /api/po-allocations/:poId — link in one transaction, audit, and hand back the refreshed allocation. */
export async function allocatePoLines(
  poId: string,
  allocations: readonly AllocationInput[],
  userId: string
): Promise<AllocatePoLinesResponse> {
  const result = await prisma.$transaction((tx) => allocatePoLinesInTx(tx, poId, allocations, userId), TX_OPTIONS);
  await createAuditLog(result.audit);
  return {
    poId: result.poId,
    poNumber: result.poNumber,
    linked: result.linked,
    splits: result.splits,
    allocation: await getPoAllocation(poId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// DELETE — Undo
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface UndoPoAllocationResponse {
  requirementNumber: string;
  /** The requirement's status after (PO_REQUIRED, PARTIAL_STOCK, FULFILLED_STOCK or CANCELLED) */
  newStatus: string;
  /** Balance children folded back into it */
  foldedBack: string[];
  allocation: PoAllocationView;
}

/**
 * Undo one link (owner decision 4) while nothing arrived for it: nothing credited, issued or held, no GRN on
 * the line awaiting QC, the requirement still PO_GENERATED / PO_SENT and on no other PO or job. Its untouched
 * balance children (PO_REQUIRED, nothing from stock, no links, challans or children) are cancelled — plain
 * CANCELLED, never "not ordered" — and their shortfall goes back to it; then it returns to demand and the
 * line is re-ranked. Refusals are PO_UNDO_REFUSED (422).
 */
export async function undoPoAllocation(
  poId: string,
  linkId: string,
  userId: string
): Promise<UndoPoAllocationResponse> {
  const out = await prisma.$transaction(async (tx) => {
    await lockPurchaseOrder(tx, poId);
    const po = await tx.purchase_orders.findUnique({ where: { id: poId }, select: { poNumber: true, status: true } });
    if (!po) throw new NotFoundError('Purchase order', poId);
    const link = await tx.requirement_po_links.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        purchaseOrderId: true,
        purchaseOrderItemId: true,
        allocatedQuantity: true,
        receivedQuantity: true,
        material_requirements: { include: REQ_RELATIONS },
      },
    });
    if (!link || link.purchaseOrderId !== poId) throw new NotFoundError('Allocation', linkId);
    const req = link.material_requirements;
    const credits = await computeLineCredits(tx, link.purchaseOrderItemId);
    const mine = credits?.links.find((l) => l.id === linkId);
    const pendingQcGrnNumber =
      (await pendingQcByLine(tx, [link.purchaseOrderItemId])).get(link.purchaseOrderItemId) ?? null;
    const block = linkUndoBlock({
      poNumber: po.poNumber,
      poStatus: po.status,
      pendingQcGrnNumber,
      requirementStatus: req.status,
      credit: Math.max(num(link.receivedQuantity), mine?.credit ?? 0),
      issued: mine?.issued ?? 0,
      held: mine?.held ?? 0,
      unit: req.unit,
      otherLinks: linkedToOf(req, linkId),
    });
    if (block) {
      throw new BusinessError(`Cannot undo ${req.requirementNumber} on ${po.poNumber}: ${block}.`, {
        code: 'PO_UNDO_REFUSED',
        linkId,
        reason: block,
      });
    }

    // A link's holds are released before the link goes (the SET NULL only keeps history on closed rows)
    await releaseLinkHolds(tx, [linkId]);
    await tx.requirement_po_links.delete({ where: { id: linkId } });

    const children = await tx.material_requirements.findMany({
      where: {
        splitFromId: req.id,
        status: 'PO_REQUIRED',
        requirement_po_links: { none: {} },
        requirement_jwo_links: { none: {} },
        challanItems: { none: {} },
        splitChildren: { none: {} },
      },
      select: { id: true, requirementNumber: true, shortfall: true, allocatedFromStock: true },
    });
    const fold = children.filter((c) => isQtyZero(c.allocatedFromStock));
    let added = 0;
    if (fold.length > 0) {
      const res = await tx.material_requirements.updateMany({
        where: { id: { in: fold.map((c) => c.id) }, status: 'PO_REQUIRED' },
        data: { status: 'CANCELLED' },
      });
      if (res.count !== fold.length) {
        throw new ConflictError(`${req.requirementNumber}'s balance rows changed meanwhile. Reload and try again.`, {
          code: 'PO_ALLOCATION_CHANGED',
        });
      }
      await releaseReservations(
        tx,
        fold.map((c) => c.id)
      );
      added = sumOf(fold.map((c) => num(c.shortfall)));
    }
    const [back] = await returnDemandAfterUnlink(tx, [{ id: req.id, addShortfall: added }], { userId, label: 'undo' });
    await assignLineFillOrder(tx, [link.purchaseOrderItemId]);
    return {
      poNumber: po.poNumber,
      requirementNumber: req.requirementNumber,
      orderNumber: req.orders?.orderNumber ?? null,
      quantity: num(link.allocatedQuantity),
      newStatus: back?.status ?? req.status,
      foldedBack: fold.map((c) => c.requirementNumber),
    };
  }, TX_OPTIONS);

  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'purchase_order',
    entityId: poId,
    newValues: {
      event: 'UNDO_ALLOCATION',
      poNumber: out.poNumber,
      requirementNumber: out.requirementNumber,
      orderNumber: out.orderNumber,
      qty: out.quantity,
      newStatus: out.newStatus,
      foldedBack: out.foldedBack,
    },
  });
  return {
    requirementNumber: out.requirementNumber,
    newStatus: out.newStatus,
    foldedBack: out.foldedBack,
    allocation: await getPoAllocation(poId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Order and PO lifecycle
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Close a PO's kept links (cancel / short-close, change C3): every link left on it gets allocated := received,
 * so a later order cancel can pass its credit on only as plain stock — never above the shortfall the close
 * wrote. Run after the undelivered links are freed. Returns how many links changed.
 */
export async function freezeClosedPoLinks(tx: Tx, poId: string): Promise<number> {
  return tx.$executeRaw`
    UPDATE requirement_po_links
       SET "allocatedQuantity" = GREATEST(0, "receivedQuantity")
     WHERE "purchaseOrderId" = ${poId}
       AND "allocatedQuantity" <> GREATEST(0, "receivedQuantity")`;
}

export interface ReleaseCancelledOrderResult {
  /** The recompute of every line the order was linked on */
  lines: LineReceiptOutcome[];
  /** Links removed (nothing credited, nothing issued) and what their requirements became */
  unlinked: ReturnDemandOutcome[];
}

/**
 * An order was cancelled (call AFTER its status is written): recompute its lines — its links keep only what they
 * issued, the rest passes to the next order in line (plain stock on a closed PO) and its holds go; then its links
 * that are left with nothing are removed and their requirements CANCELLED; then the lines are re-ranked.
 * PROCESSING lines stay pro-rata and are not touched.
 */
export async function releaseCancelledOrderLinks(
  tx: Tx,
  orderId: string,
  userId: string
): Promise<ReleaseCancelledOrderResult> {
  const links = await tx.requirement_po_links.findMany({
    where: {
      material_requirements: { orderId },
      purchase_orders: { OR: [{ poCategory: null }, { poCategory: { not: 'PROCESSING' } }] },
    },
    select: { id: true, purchaseOrderItemId: true },
  });
  if (links.length === 0) return { lines: [], unlinked: [] };
  const itemIds = uniq(links.map((l) => l.purchaseOrderItemId)).sort();
  const lines = await applyLineReceipts(tx, itemIds, { event: 'order-cancel', userId });

  const linkIds = links.map((l) => l.id);
  const after = await tx.requirement_po_links.findMany({
    where: { id: { in: linkIds } },
    select: { id: true, requirementId: true, receivedQuantity: true },
  });
  const floors = await consumedByLinkPool(tx, linkIds);
  const empty = after.filter(
    (l) => isQtyZero(l.receivedQuantity) && isQtyZero(sumOf(Object.values(floors.get(l.id) ?? {})))
  );
  let unlinked: ReturnDemandOutcome[] = [];
  if (empty.length > 0) {
    await releaseLinkHolds(
      tx,
      empty.map((l) => l.id)
    );
    await tx.requirement_po_links.deleteMany({ where: { id: { in: empty.map((l) => l.id) } } });
    unlinked = await returnDemandAfterUnlink(
      tx,
      uniq(empty.map((l) => l.requirementId)).map((id) => ({ id })),
      { userId, label: 'order cancel' }
    );
  }
  await assignLineFillOrder(tx, itemIds);
  return { lines, unlinked };
}

/**
 * An order is COMPLETED or DISPATCHED (owner decision D11; call AFTER its status is written): its receipt holds
 * are released — it keeps what it was credited, and the recompute never holds for a finished order again. This
 * also frees size-label holds, which work orders issue as the base label today. Returns what was released.
 */
export async function releaseCompletedOrderHolds(tx: Tx, orderId: string): Promise<number> {
  const order = await tx.orders.findUnique({ where: { id: orderId }, select: { orderNumber: true, status: true } });
  if (!order) return 0;
  if (!includes(HOLDLESS_ORDER_STATUSES, order.status)) {
    logWarn(`[po-allocation] ${order.orderNumber} is ${order.status} — its receipt holds are kept`, { orderId });
    return 0;
  }
  const links = await tx.requirement_po_links.findMany({
    where: { material_requirements: { orderId } },
    select: { id: true },
  });
  return releaseLinkHolds(
    tx,
    links.map((l) => l.id)
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Goods held for another order (D10)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface HeldForOther {
  reservationId: string;
  requirementId: string;
  requirementNumber: string;
  orderId: string | null;
  orderNumber: string | null;
  styleCode: string | null;
  /** The buyer's own style code (styles.buyerStyleRef) — screens name the style by it first */
  buyerStyleRef?: string | null;
  /** 'receipt' = arrived on a linked PO line; 'stock' = Use Stock */
  kind: 'receipt' | 'stock';
  poLinkId: string | null;
  lotId: string | null;
  qty: number;
  /** The hold's unit (the requirement's) */
  unit: string;
}

const HOLD_ROW_SELECT = {
  id: true,
  referenceId: true,
  reservedQuantity: true,
  consumedQuantity: true,
  poLinkId: true,
  greigeStockId: true,
  laceStockId: true,
  fabricStockId: true,
  materialId: true,
  warehouseId: true,
  unit: true,
  referenceNumber: true,
  reservedAt: true,
} as const satisfies Prisma.stock_reservationsSelect;

type HoldRow = Prisma.stock_reservationsGetPayload<{ select: typeof HOLD_ROW_SELECT }>;

async function loadOthersHolds(
  client: Db,
  args: { materialId: string; lotIds?: string[]; excludeOrderId?: string | null }
): Promise<Array<{ row: HoldRow; req: ReqRow; qty: number }>> {
  const lotIds = (args.lotIds ?? []).filter(Boolean);
  const rows = await client.stock_reservations.findMany({
    where: {
      referenceType: 'MATERIAL_REQUIREMENT',
      status: 'ACTIVE',
      ...(lotIds.length > 0
        ? {
            OR: [{ greigeStockId: { in: lotIds } }, { laceStockId: { in: lotIds } }, { fabricStockId: { in: lotIds } }],
          }
        : { materialId: args.materialId, greigeStockId: null, laceStockId: null, fabricStockId: null }),
    },
    orderBy: [{ reservedAt: 'desc' }, { id: 'desc' }],
    select: HOLD_ROW_SELECT,
  });
  if (rows.length === 0) return [];
  const reqs = await client.material_requirements.findMany({
    where: { id: { in: uniq(rows.map((r) => r.referenceId)) } },
    include: REQ_RELATIONS,
  });
  const reqById = new Map(reqs.map((r) => [r.id, r]));
  const out: Array<{ row: HoldRow; req: ReqRow; qty: number }> = [];
  for (const row of rows) {
    const req = reqById.get(row.referenceId);
    if (!req) continue;
    if (args.excludeOrderId && req.orderId === args.excludeOrderId) continue;
    const qty = round3(num(row.reservedQuantity) - num(row.consumedQuantity));
    if (!qtyExceeds(qty, 0)) continue;
    out.push({ row, req, qty });
  }
  // The order that needs the goods LAST loses them first; within one requirement, Use Stock holds before
  // receipt holds (they reopen in place; a receipt hold needs a balance row), newest first
  out.sort(
    (a, b) =>
      compareFillPriority(priorityOf(b.req), priorityOf(a.req)) ||
      byText(b.req.id, a.req.id) ||
      (a.row.poLinkId ? 1 : 0) - (b.row.poLinkId ? 1 : 0)
  );
  return out;
}

/**
 * Goods held for OTHER orders on this material (trims: lot-less holds) or on these lots (greige / lace), in the
 * order `takeHeldGoods` would take them. An issue gate refuses with `heldStockConflict(message, these)`.
 */
export async function heldForOtherOrders(
  client: Db,
  args: { materialId: string; lotIds?: string[]; excludeOrderId?: string | null }
): Promise<HeldForOther[]> {
  const holds = await loadOthersHolds(client, args);
  return holds.map(({ row, req, qty }) => ({
    reservationId: row.id,
    requirementId: req.id,
    requirementNumber: req.requirementNumber,
    orderId: req.orderId,
    orderNumber: req.orders?.orderNumber ?? null,
    styleCode: req.order_items?.styles?.styleCode ?? null,
    buyerStyleRef: req.order_items?.styles?.buyerStyleRef ?? null,
    kind: row.poLinkId ? 'receipt' : 'stock',
    poLinkId: row.poLinkId,
    lotId: row.greigeStockId ?? row.laceStockId ?? row.fabricStockId,
    qty,
    unit: row.unit,
  }));
}

/** The error code an issue gate refuses held goods with; the screen answers it with "take them anyway" */
export const STOCK_HELD_FOR_ORDER = 'STOCK_HELD_FOR_ORDER';

/** One entry of the refusal's `heldFor` list — what frontend lib/held-stock-confirm.ts reads */
export interface HeldForEntry {
  requirementNumber: string;
  orderNumber: string | null;
  styleCode: string | null;
  /** The buyer's own style code — the take-held dialog names the style by it first */
  buyerStyleRef?: string | null;
  qty: number;
  unit: string;
}

/** Who holds the goods, one entry per holding requirement (Use Stock and receipt holds added together) */
export function heldForEntries(held: readonly HeldForOther[]): HeldForEntry[] {
  const byReq = new Map<string, HeldForEntry>();
  for (const h of held) {
    const entry = byReq.get(h.requirementId);
    if (entry) entry.qty = round3(entry.qty + h.qty);
    else {
      byReq.set(h.requirementId, {
        requirementNumber: h.requirementNumber,
        orderNumber: h.orderNumber,
        styleCode: h.styleCode,
        buyerStyleRef: h.buyerStyleRef,
        qty: round3(h.qty),
        unit: h.unit,
      });
    }
  }
  return [...byReq.values()];
}

/**
 * The refusal every issue gate (challan, job-work issue, work-order issue) throws when the goods it would take
 * are held for other orders (D10): a 409 with details `{ code: STOCK_HELD_FOR_ORDER, heldFor }`. One builder,
 * so every screen's "take them anyway" dialog can name who loses them.
 */
export function heldStockConflict(message: string, held: readonly HeldForOther[]): ConflictError {
  return new ConflictError(message, { code: STOCK_HELD_FOR_ORDER, heldFor: heldForEntries(held) });
}

export interface TakeHeldGoodsInput {
  /** The material issued. With no lotIds, its lot-less holds (trims) are taken */
  materialId: string;
  /** Lots issued (greige / lace): only holds on these lots are taken */
  lotIds?: string[];
  /** How much of other orders' holds the issue needs */
  quantity: number;
  /** The order the goods are issued to — its own holds are never taken */
  takerOrderId?: string | null;
  userId: string;
  /** Where the goods went, for the record: "Challan CH2609-0012" */
  reference: string;
}

export interface TakenHold {
  requirementId: string;
  requirementNumber: string;
  orderNumber: string | null;
  kind: 'receipt' | 'stock';
  quantity: number;
  /** The PO_REQUIRED row its reopened need went to (null when it reopened in place) */
  balanceRequirementNumber: string | null;
  /** Its status after, when it reopened in place */
  status: string | null;
}

export interface TakeHeldGoodsResult {
  taken: number;
  /** Asked for but not found in anyone's holds (the lot's reserved figure has another claim) */
  short: number;
  from: TakenHold[];
}

/** Move a lot's quantityReserved by `delta` in one statement, never below 0 (stock-reservation.helper's rule) */
async function moveLotReserved(tx: Tx, row: HoldRow, delta: number): Promise<void> {
  const d = new Prisma.Decimal(round3(delta));
  if (row.greigeStockId) {
    await tx.$executeRaw`UPDATE greige_stock SET "quantityReserved" = GREATEST(0, "quantityReserved" + ${d}), "updatedAt" = NOW() WHERE id = ${row.greigeStockId}`;
  } else if (row.laceStockId) {
    await tx.$executeRaw`UPDATE lace_stock SET "quantityReserved" = GREATEST(0, "quantityReserved" + ${d}), "updatedAt" = NOW() WHERE id = ${row.laceStockId}`;
  } else if (row.fabricStockId) {
    await tx.$executeRaw`UPDATE fabric_stock SET "quantityReserved" = GREATEST(0, "quantityReserved" + ${d}), "updatedAt" = NOW() WHERE id = ${row.fabricStockId}`;
  }
}

/** Shrink one hold row by `qty` (its lot too), closing it when nothing of it is left held */
async function shrinkHold(tx: Tx, row: HoldRow, qty: number, now: Date): Promise<void> {
  await moveLotReserved(tx, row, -qty);
  const left = round3(num(row.reservedQuantity) - num(row.consumedQuantity) - qty);
  if (isQtyZero(left) || left < 0) {
    await tx.stock_reservations.update({
      where: { id: row.id },
      data: {
        status: num(row.consumedQuantity) > 0 ? 'CONSUMED' : 'CANCELLED',
        completedAt: now,
        reservedQuantity: row.consumedQuantity,
      },
    });
  } else {
    await tx.stock_reservations.update({
      where: { id: row.id },
      data: { reservedQuantity: { decrement: qty3(qty) } },
    });
  }
}

/**
 * An issue takes goods held for other orders, after the user confirmed "take them anyway" (owner decision D10).
 * Call inside the issue's transaction, BEFORE the issue consumes its own holds, with the quantity its gate found
 * short. The order that needs the goods last loses them first. For each hold taken:
 *   - receipt hold (arrived on a linked PO line): the hold shrinks and the quantity is recorded as ISSUED from
 *     that link (a CONSUMED row on the same link and lot) — so the line never credits the goods to anyone again —
 *     and the loser's need reopens as a PO_REQUIRED balance row (MRP-12 shape). The link keeps its size: the PO
 *     still bought that much for it; what it lost is the new row;
 *   - Use Stock hold: released; the loser's allocatedFromStock drops by it. Unlinked, its shortfall grows and it
 *     becomes PARTIAL_STOCK / PO_REQUIRED; on a PO, the need goes to a balance row.
 * One audit row per loser requirement. Returns what was taken and what could not be found.
 */
export async function takeHeldGoods(tx: Tx, input: TakeHeldGoodsInput): Promise<TakeHeldGoodsResult> {
  const result: TakeHeldGoodsResult = { taken: 0, short: 0, from: [] };
  if (!qtyExceeds(input.quantity, 0)) return result;
  const holds = await loadOthersHolds(tx, {
    materialId: input.materialId,
    lotIds: input.lotIds,
    excludeOrderId: input.takerOrderId,
  });
  const taker = input.takerOrderId
    ? await tx.orders.findUnique({ where: { id: input.takerOrderId }, select: { orderNumber: true } })
    : null;
  const now = new Date();

  let left = round3(input.quantity);
  const perReq = new Map<string, { req: ReqRow; receipt: number; stock: number }>();
  for (const { row, req, qty } of holds) {
    if (!qtyExceeds(left, 0)) break;
    const take = round3(Math.min(qty, left));
    if (!qtyExceeds(take, 0)) continue;
    await shrinkHold(tx, row, take, now);
    if (row.poLinkId) {
      // Issued from this link: its floor, in the same pool as the lot it came off
      await tx.stock_reservations.create({
        data: {
          materialId: row.materialId,
          warehouseId: row.warehouseId,
          reservationType: 'ORDER',
          referenceType: 'MATERIAL_REQUIREMENT',
          referenceId: req.id,
          referenceNumber: row.referenceNumber,
          reservedQuantity: qty3(take),
          consumedQuantity: qty3(take),
          unit: row.unit,
          status: 'CONSUMED',
          reservedById: input.userId,
          completedAt: now,
          remarks: `Taken for ${taker?.orderNumber ?? 'another issue'} — ${input.reference}`,
          greigeStockId: row.greigeStockId,
          laceStockId: row.laceStockId,
          fabricStockId: row.fabricStockId,
          poLinkId: row.poLinkId,
        },
      });
    }
    const agg = perReq.get(req.id) ?? { req, receipt: 0, stock: 0 };
    if (row.poLinkId) agg.receipt = round3(agg.receipt + take);
    else agg.stock = round3(agg.stock + take);
    perReq.set(req.id, agg);
    left = round3(left - take);
    result.taken = round3(result.taken + take);
  }
  result.short = Math.max(0, left);

  for (const { req, receipt, stock } of perReq.values()) {
    const full = await tx.material_requirements.findUniqueOrThrow({ where: { id: req.id } });
    const onPo = includes(PO_LINK_REQUIREMENT_STATUSES, full.status);
    const base = {
      requirementId: full.id,
      requirementNumber: full.requirementNumber,
      orderNumber: req.orders?.orderNumber ?? null,
    };
    // What goes to a balance row: every receipt hold taken, and a Use Stock hold of a row that is on a PO
    let toChild = receipt;
    let stockReopenedAs: string | null = null;
    if (qtyExceeds(stock, 0)) {
      const fromStock = Math.max(0, round3(num(full.allocatedFromStock) - stock));
      if (!onPo && includes(['FULFILLED_STOCK', 'PARTIAL_STOCK'], full.status)) {
        // Not on a PO: it reopens in place — less from stock, more to buy
        const need = round3(num(full.shortfall) + stock);
        const status: MaterialRequirementStatus = qtyExceeds(fromStock, 0) ? 'PARTIAL_STOCK' : 'PO_REQUIRED';
        const res = await tx.material_requirements.updateMany({
          where: { id: full.id, status: full.status },
          data: { allocatedFromStock: qty3(fromStock), shortfall: qty3(need), status },
        });
        if (res.count === 0) {
          throw new ConflictError(`${full.requirementNumber} changed while its goods were being taken. Try again.`, {
            code: 'STOCK_HELD_CHANGED',
          });
        }
        stockReopenedAs = status;
        result.from.push({ ...base, kind: 'stock', quantity: stock, balanceRequirementNumber: null, status });
      } else {
        await tx.material_requirements.update({
          where: { id: full.id },
          data: { allocatedFromStock: qty3(fromStock) },
        });
        if (onPo) toChild = round3(toChild + stock);
        else {
          logWarn(`[po-allocation] ${full.requirementNumber} (${full.status}) lost ${stock} held from stock`, {
            reference: input.reference,
          });
        }
      }
    }
    let childNumber: string | null = null;
    if (qtyExceeds(toChild, 0)) {
      childNumber = (await mintBalanceChild(tx, full, toChild, input.userId)).requirementNumber;
      if (qtyExceeds(receipt, 0)) {
        result.from.push({
          ...base,
          kind: 'receipt',
          quantity: receipt,
          balanceRequirementNumber: childNumber,
          status: null,
        });
      }
      if (qtyExceeds(stock, 0) && onPo) {
        result.from.push({
          ...base,
          kind: 'stock',
          quantity: stock,
          balanceRequirementNumber: childNumber,
          status: null,
        });
      }
    }
    await tx.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: input.userId === 'SYSTEM' ? null : input.userId,
        action: 'UPDATE',
        entityType: 'material_requirement',
        entityId: full.id,
        newValues: {
          event: 'HELD_GOODS_TAKEN',
          requirementNumber: full.requirementNumber,
          orderNumber: req.orders?.orderNumber ?? null,
          takenFor: taker?.orderNumber ?? null,
          reference: input.reference,
          materialId: input.materialId,
          lotIds: input.lotIds ?? [],
          fromReceiptHold: receipt,
          fromUseStock: stock,
          reopenedAs: childNumber ?? stockReopenedAs,
        },
      },
    });
  }
  if (qtyExceeds(result.short, 0)) {
    logWarn(`[po-allocation] take held goods: ${result.short} not found in any order's holds`, {
      materialId: input.materialId,
      lotIds: input.lotIds,
      reference: input.reference,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Requirements page — "an open PO covers this, not linked"
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface OpenPOSupplyLine {
  purchaseOrderId: string;
  poNumber: string;
  poStatus: string;
  poCategory: string | null;
  supplierName: string | null;
  expectedDeliveryDate: Date;
  purchaseOrderItemId: string;
  /** The PO line's unit (GROSS…) — figures below are in the stock unit */
  lineUnit: string;
  stockUnitsPerUnit: number | null;
  orderedStockQty: number;
  arrivedQty: number;
  allocatedQty: number;
  /** What this requirement could still be linked for */
  freeToLink: number;
  /** Arrived, nobody's, still physically free ("559 here") */
  arrivedFree: number;
  toCome: number;
  /** Σ shortfall of every unlinked requirement that could take this material */
  unlinkedDemandQty: number;
  deliversTo: PoAllocationPlace[] | null;
  linkable: boolean;
  blockedReason: string | null;
  arrivesLate: boolean;
}

const SUPPLY_LINE_SELECT = {
  ...LINE_SELECT,
  purchase_orders: { select: PO_SELECT },
  requirement_po_links: {
    select: {
      allocatedQuantity: true,
      receivedQuantity: true,
      material_requirements: { select: { status: true, orders: { select: { status: true } } } },
    },
  },
  grn_items: {
    where: { goods_receiving_notes: { status: { in: [...APPROVED_GRN_STATUSES, 'PENDING_QC' as const] } } },
    select: { goods_receiving_notes: { select: { status: true, grnNumber: true } } },
  },
} as const satisfies Prisma.purchase_order_itemsSelect;

/**
 * For the Requirements page: the open PO lines that could cover each of these requirements but are not linked
 * to it — shown as "PO2609-0231 · 1,589 free · not linked" with a Link button. Only MATERIAL rows that still need
 * buying (and DECISION_PENDING, shown without Link) and have no PO or live job link get entries; lines with
 * nothing free are left out. Batched: the requirements, the open lines with their links, the unlinked demand,
 * and the engine only for lines that already received goods.
 */
export async function batchGetOpenPOSupply(
  requirementIds: readonly string[],
  client: Db = prisma
): Promise<Map<string, OpenPOSupplyLine[]>> {
  const out = new Map<string, OpenPOSupplyLine[]>();
  const ids = uniq(requirementIds.filter(Boolean));
  if (ids.length === 0) return out;
  const reqs = (
    await client.material_requirements.findMany({
      where: {
        id: { in: ids },
        requirementType: 'MATERIAL',
        status: { in: [...LINKABLE_REQUIREMENT_STATUSES, 'DECISION_PENDING'] },
      },
      include: REQ_RELATIONS,
    })
  ).filter((r) => linkedToOf(r).length === 0);
  if (reqs.length === 0) return out;

  const materialIds = uniq(reqs.map((r) => r.materialId));
  const lines = await client.purchase_order_items.findMany({
    where: {
      materialId: { in: materialIds },
      purchase_orders: {
        status: { in: [...LINKABLE_PO_STATUSES] },
        poCategory: { in: [...LINKABLE_PO_CATEGORIES] },
        isActive: true,
      },
    },
    select: SUPPLY_LINE_SELECT,
    orderBy: PO_LINE_ORDER,
  });
  if (lines.length === 0) return out;

  const demandRows = await client.material_requirements.findMany({
    where: candidateWhere(materialIds),
    select: { materialId: true, shortfall: true },
  });
  const demand = new Map<string, number>();
  for (const d of demandRows) demand.set(d.materialId, round3((demand.get(d.materialId) ?? 0) + num(d.shortfall)));

  const locatedReqs = reqs.filter((r) =>
    lines.some((l) => l.materialId === r.materialId && isLocatedCategory(l.purchase_orders.poCategory))
  );
  const dyers =
    locatedReqs.length > 0
      ? await requirementDyers(
          client,
          locatedReqs.map((r) => r.id)
        )
      : new Map<string, string | null>();

  // Figures per line: the engine where goods arrived, else straight from the links
  const figSource = new Map<string, LineFigureSource>();
  for (const line of lines) {
    const arrived = line.grn_items.some((g) => includes(APPROVED_GRN_STATUSES, g.goods_receiving_notes.status));
    if (arrived) {
      const c = await computeLineCredits(client, line.id);
      if (c) figSource.set(line.id, c);
      continue;
    }
    // Nothing arrived, so nothing was issued from it: a finished order's link takes no more than it has (0)
    const eligible = line.requirement_po_links
      .filter(
        (l) => l.material_requirements.status !== 'CANCELLED' && l.material_requirements.orders?.status !== 'CANCELLED'
      )
      .map((l) => ({
        allocated: fillAllocation(
          num(l.allocatedQuantity),
          num(l.receivedQuantity),
          0,
          l.material_requirements.orders?.status
        ),
        received: num(l.receivedQuantity),
      }));
    const orderedStock = toStockQty(
      num(line.orderedQuantity),
      line.stockUnitsPerUnit != null ? num(line.stockUnitsPerUnit) : null
    );
    figSource.set(line.id, {
      kind: line.materialId ? lineKindOf(line.purchase_orders.poCategory) : 'none',
      orderedStock,
      arrived: 0,
      credited: sumOf(line.requirement_po_links.map((l) => num(l.receivedQuantity))),
      allocated: sumOf(eligible.map((l) => l.allocated)),
      plainStock: {},
      toCome: orderedStock,
      uncredited: sumOf(eligible.map((l) => Math.max(0, l.allocated - l.received))),
      held: 0,
    });
  }

  const fits = await categoryFit(client, lines, (line) => line.purchase_orders.poCategory);
  const pools = new Set<string>();
  for (const line of lines) for (const p of lineDeliveryHolders(line.purchase_orders, line.id) ?? []) pools.add(p);
  for (const d of dyers.values()) if (d) pools.add(d);
  const names = await placeNames(client, pools);
  const physical = new Map<string, number>();

  for (const r of reqs) {
    const entries: OpenPOSupplyLine[] = [];
    for (const line of lines) {
      if (line.materialId !== r.materialId) continue;
      const source = figSource.get(line.id);
      if (!source) continue;
      const po = line.purchase_orders;
      const located = isLocatedCategory(po.poCategory);
      const dyer = located ? (dyers.get(r.id) ?? null) : null;
      const fig = lineFigures(source, dyer);
      let arrivedFree = fig.plainReachable;
      let freeToLink = fig.freeToLink;
      let physicalReason: string | null = null;
      if (qtyExceeds(arrivedFree, 0)) {
        if (!physical.has(line.id)) {
          physical.set(
            line.id,
            await physicallyFreeAcross(
              client,
              line.id,
              Object.keys(source.plainStock).filter((p) => p !== UNPLACED_POOL)
            )
          );
        }
        const stillThere = Math.min(arrivedFree, physical.get(line.id) ?? 0);
        const toComeFree = Math.max(0, round3(fig.toCome - fig.uncredited));
        freeToLink = Math.max(0, Math.min(freeToLink, round3(toComeFree + stillThere)));
        if (!qtyExceeds(stillThere, 0) && !qtyExceeds(toComeFree, 0)) {
          physicalReason = `${arrivedFree} ${unitShort(r.unit)} arrived as stock — Use Stock`;
        }
        arrivedFree = round3(stillThere);
      }
      if (!qtyExceeds(freeToLink, 0) && !qtyExceeds(fig.plainReachable, 0)) continue;

      const pendingQc = line.grn_items.find((g) => g.goods_receiving_notes.status === 'PENDING_QC');
      const holders = located ? lineDeliveryHolders(po, line.id) : null;
      const blockedReason =
        lineLinkBlock(po, {
          materialId: line.materialId,
          materialType: line.materials?.materialType ?? null,
          fitsCategory: fits.get(line.id) ?? false,
          pendingQcGrnNumber: pendingQc?.goods_receiving_notes.grnNumber ?? null,
        }) ??
        requirementLinkBlock(reqFacts(r), lineFacts(line, po, located ? holders : undefined), dyer, names) ??
        physicalReason ??
        (qtyExceeds(freeToLink, 0) ? null : 'nothing left free to link');

      entries.push({
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        poStatus: po.status,
        poCategory: po.poCategory,
        supplierName: po.suppliers?.name ?? null,
        expectedDeliveryDate: po.expectedDeliveryDate,
        purchaseOrderItemId: line.id,
        lineUnit: line.unit,
        stockUnitsPerUnit: line.stockUnitsPerUnit != null ? num(line.stockUnitsPerUnit) : null,
        orderedStockQty: fig.orderedStock,
        arrivedQty: fig.arrived,
        allocatedQty: fig.allocated,
        freeToLink,
        arrivedFree,
        toCome: fig.toCome,
        unlinkedDemandQty: demand.get(r.materialId) ?? 0,
        deliversTo: holders ? holders.map((p) => placeOf(p, names)) : null,
        linkable: !blockedReason,
        blockedReason,
        arrivesLate: arrivesLate(po.expectedDeliveryDate, r.requiredDate, r.orders?.expectedDeliveryDate ?? null),
      });
    }
    if (entries.length > 0) {
      entries.sort(
        (a, b) => a.expectedDeliveryDate.getTime() - b.expectedDeliveryDate.getTime() || byText(a.poNumber, b.poNumber)
      );
      out.set(r.id, entries);
    }
  }
  return out;
}
