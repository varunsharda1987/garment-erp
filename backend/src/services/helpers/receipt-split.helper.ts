/**
 * Receipt splitting — how one physical receipt is divided across the allocation links it satisfies.
 *
 * TWO RULES LIVE HERE (2026-09-29):
 *  - PO links (requirement_po_links) FILL IN ORDER — `fillLineReceipts`: the earliest-delivery order is
 *    filled first (owner decision D1), recomputed from the line's approved total on every event, so a
 *    reversal is exact whatever order the receipts came and went in. The engine that drives it is
 *    helpers/receipt-allocation.helper.ts.
 *  - Job-work and service links, and PROCESSING PO lines, stay PRO-RATA — `splitReceiptAcrossLinks`,
 *    documented below and unchanged.
 *
 * A job work order or PO line can serve several material requirements at once, so the receipt
 * tracking tables (requirement_po_links, requirement_jwo_links, service_requirement_jwo_links) hold
 * one row per (requirement, document) pair, each carrying the slice of the document that requirement
 * booked (`allocatedQuantity`). When goods arrive, the receipt is a single number against the
 * DOCUMENT — it has to be apportioned back out to those rows before any requirement can judge
 * whether it is satisfied.
 *
 * Crediting the full receipt to every link (the defect this replaces) declares every requirement
 * received as soon as the largest one is: JWO DJ-EBEW-003-001 allocated 1099.920 + 6988.800; a
 * 4,000 m partial receipt credited 4,000 to BOTH links, so the 1,099.92 requirement flipped to
 * RECEIVED, dropped out of the MRP shortfall, and no replenishment was ever raised for material
 * that had not arrived.
 *
 * WHY PRO-RATA WITH A DETERMINISTIC LAST-LINK REMAINDER
 * Rounding each share independently loses or invents fractions (three links of a 100 split give
 * 33.333 × 3 = 99.999). Instead the earlier shares round to 3 dp and the LAST link absorbs
 * whatever is left, so the shares sum EXACTLY to the receipt — the invariant the per-requirement
 * status aggregate depends on. "Last" is only well defined if the caller iterates in a fixed order,
 * which is why every call site orders by `id` — Postgres guarantees no ordering otherwise, and an
 * unstable order would put the remainder on a different link each time.
 *
 * WHY IT MUST BE ITS OWN INVERSE
 * GRN reversal re-enters this path with the receipt negated (`-totalAccepted`). decimal.js
 * ROUND_HALF_UP rounds away from zero, so round(-x) === -round(x) and every share negates exactly:
 * split(-q) is the element-wise negation of split(q). A reversal therefore returns each link to the
 * value it held before the receipt — no drift, no residue on the remainder link.
 *
 * WHY THERE IS DELIBERATELY NO CAP AT REMAINING ALLOCATION
 * Capping a share at "allocation minus already received" and spilling the excess elsewhere would
 * break both properties above: the cap is not symmetric under negation (the reversal would cap
 * against different balances and leave residue), and once every link on the document is full there
 * is no valid spill target — the surplus would have to be silently dropped. Over-receipt is real
 * (suppliers over-ship), and a link holding more than its allocation is a truthful record of what
 * physically arrived against it, not corruption. Nothing downstream misreads it: the per-requirement
 * aggregate in each caller sums allLinks and declares RECEIVED once totalReceived >= totalAllocated,
 * which an over-credited link satisfies for the right reason.
 *
 * INPUT CONTRACT: `receivedQuantity` carries at most RECEIPT_SPLIT_DP decimals — it originates from
 * Decimal(12,3) quantity columns. The remainder share is then inherently within the column's scale,
 * so nothing is silently re-rounded on write.
 */
import { Decimal, toCurrency } from '../../utils/currency';
import { QTY_EPSILON, qtyExceeds } from '../../utils/quantity';

/** Every link table stores allocatedQuantity/receivedQuantity as Decimal(12,3). */
export const RECEIPT_SPLIT_DP = 3;

/**
 * Slack when deciding a requirement is fully received.
 *
 * Each receipt is split independently, so successive partial receipts each leave up to half a
 * millimetre of rounding on a non-remainder link: three 1,000 m receipts against three 1,000 m
 * allocations credit 333.333 + 333.333 + 333.334 every time, ending at 999.999 / 999.999 / 1000.002.
 * Compared exactly, two requirements that received everything they asked for would sit at
 * PARTIALLY_RECEIVED for ever and keep a 1 mm shortfall alive in MRP — the mirror image of the bug
 * this module exists to fix. One millimetre is below the resolution of the stored column, so
 * treating it as complete is honest, not lenient.
 *
 * Since 2026-09-24 this is the project's one quantity tolerance (QTY_EPSILON, utils/quantity): the
 * receipt arrives from 2-decimal job/lot quantities while the allocation is stored at 3, so the
 * slack has to cover half the coarsest step, not just the split's own rounding.
 */
export const RECEIPT_COMPLETE_TOLERANCE = QTY_EPSILON;

/**
 * Is a receipt complete? Yes once the ACTUAL quantity received is within `underTolerancePercent` of
 * what was ordered/allocated (the GRN_UNDER_RECEIPT_TOLERANCE_PERCENT setting). Owner, 2026-09-24: a
 * PO a few centimetres short — 10,105.65 m actual against 10,105.7 ordered — is received, not a
 * short-close. The same rule closes the PO and its MRP requirement, so neither is left open on its own.
 */
export function isReceiptComplete(
  received: Decimal | string | number,
  expected: Decimal | string | number,
  underTolerancePercent: number
): boolean {
  const floor = toCurrency(expected).times(toCurrency(100).minus(underTolerancePercent)).div(100);
  return toCurrency(received).gte(floor.minus(RECEIPT_COMPLETE_TOLERANCE));
}

export interface AllocationLink {
  id: string;
  allocatedQuantity: Decimal | string | number;
}

export interface ReceiptShare {
  id: string;
  qty: number;
}

/**
 * Apportion a receipt across allocation links in proportion to their allocated quantities.
 *
 * @param links - allocation rows in a STABLE order (order by id at the call site); the last one
 *                absorbs the rounding remainder
 * @param receivedQuantity - signed receipt: positive for a receipt, negative for a reversal
 * @returns one share per link, in the input order, summing exactly to receivedQuantity
 */
export function splitReceiptAcrossLinks(links: AllocationLink[], receivedQuantity: number): ReceiptShare[] {
  if (links.length === 0) {
    return [];
  }

  // The overwhelmingly common case: one requirement on the document. Hand back the caller's own
  // number untouched so a single-link receipt is byte-identical to the pre-split behaviour.
  if (links.length === 1) {
    return [{ id: links[0].id, qty: receivedQuantity }];
  }

  const total = links.reduce((sum, link) => sum.plus(toCurrency(link.allocatedQuantity)), new Decimal(0));
  const received = toCurrency(receivedQuantity);
  // Links allocated nothing (or cancelling to nothing) have no proportion to divide by — spread the
  // receipt evenly rather than divide by zero and lose it.
  const equalShare = total.isZero();
  const count = new Decimal(links.length);

  const shares: ReceiptShare[] = [];
  let creditedSoFar = new Decimal(0);

  for (let i = 0; i < links.length - 1; i++) {
    const raw = equalShare
      ? received.dividedBy(count)
      : received.times(toCurrency(links[i].allocatedQuantity)).dividedBy(total);
    const rounded = raw.toDecimalPlaces(RECEIPT_SPLIT_DP, Decimal.ROUND_HALF_UP);
    creditedSoFar = creditedSoFar.plus(rounded);
    shares.push({ id: links[i].id, qty: rounded.toNumber() });
  }

  // The remainder, not a fresh division — this is what makes the shares sum exactly to the receipt.
  const last = links[links.length - 1];
  shares.push({ id: last.id, qty: received.minus(creditedSoFar).toNumber() });

  return shares;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PO links fill in order (D1, 2026-09-29) — pure, no DB. The engine that loads and writes is
// helpers/receipt-allocation.helper.ts.
//
// A PO line's receipts are ONE number per location pool (what its approved GRN lines booked there).
// Each link's credit is a greedy fill of those totals over the links in their frozen `fillOrder`,
// recomputed from the totals on every approve / reverse / order cancel / link. So the state is a pure
// function of (totals, links in order, eligibility): approving and reversing in any order lands on the
// same credits, and a reversal takes back exactly what its approval gave — no record of which receipt
// filled which link is needed.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Goods in our own stores: every link may draw on them. The only pool a trim line has. */
export const STORE_POOL = 'STORE';
/** Goods booked into a processor's unit that is linked to no processor: nobody can be placed there. */
export const UNPLACED_POOL = 'UNPLACED';

/**
 * The pool a receipt fills, by the warehouse its GRN booked it into: a processor's unit → that processor's id;
 * a unit linked to no processor → UNPLACED; anything else → STORE. For a warehouse it is the same answer as
 * `greigeHolderId` (lot-location.helper), plus UNPLACED where that one says "cannot be placed"
 * (`greigeCountsForPlanning` never counts such a lot). Asserted equal in receipt-fill.test.ts.
 */
export function receiptPoolOf(
  warehouse: { warehouseType: string; supplierId: string | null } | null | undefined
): string {
  if (!warehouse || warehouse.warehouseType !== 'JOB_WORK') return STORE_POOL;
  return warehouse.supplierId ?? UNPLACED_POOL;
}

/** A pool that belongs to a processor (not STORE / UNPLACED). */
export function isProcessorPool(pool: string): boolean {
  return pool !== STORE_POOL && pool !== UNPLACED_POOL;
}

export interface FillLink {
  id: string;
  /** What the link was allocated on the line, in the stock unit */
  allocated: number;
  /** Earliest-delivery rank on the line; null sorts last */
  fillOrder: number | null;
  /** The processor the link's requirement is processed at (greige / lace lines); null = none decided, or a trim */
  dyer: string | null;
  /** false = its requirement or order is cancelled: it keeps what it issued, the rest passes on */
  eligible: boolean;
  /** What the link already issued, per pool — a floor its credit never goes below */
  floors: Record<string, number>;
}

export interface FillResult {
  /** Each link's total credit (its floors included), 3 dp */
  credit: Map<string, number>;
  /** Each link's credit per pool (floors included), 3 dp */
  creditByPool: Map<string, Record<string, number>>;
  /** What each pool has left after the fill — plain stock, nobody's */
  plainStock: Record<string, number>;
  /** Pools whose floors are more than the pool now holds, and by how much. Empty = none */
  deficits: Record<string, number>;
}

/** Fill order: `fillOrder` ascending with nulls last, then id — a stable total order. */
export function sortByFillOrder<T extends { id: string; fillOrder: number | null }>(links: readonly T[]): T[] {
  return [...links].sort((a, b) => {
    if (a.fillOrder !== b.fillOrder) {
      if (a.fillOrder == null) return 1;
      if (b.fillOrder == null) return -1;
      return a.fillOrder - b.fillOrder;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

const dec = (n: number | undefined) => toCurrency(n ?? 0);

/**
 * Greedy fill of a line's pool totals over its links (design §4):
 *  1. each pool starts at its total less every link's floor there (below −ε is a deficit);
 *  2. every link starts at its floors;
 *  A. each processor's pool fills its own eligible links, in fill order, up to their allocation;
 *  B. what the processor pools have left, pool id by pool id, fills links with no processor decided;
 *  C. STORE fills every eligible link, in fill order.
 * What is left in each pool is plain stock. Each take is rounded DOWN to 3 dp so no pool goes negative.
 * UNPLACED fills nobody. A trim line has only STORE, so for it this is simply pass C.
 */
export function fillLineReceipts(links: readonly FillLink[], poolTotals: Readonly<Record<string, number>>): FillResult {
  const ordered = sortByFillOrder(links);
  const pools = new Set<string>(Object.keys(poolTotals));
  for (const link of links) for (const pool of Object.keys(link.floors)) pools.add(pool);

  const left = new Map<string, Decimal>();
  const deficits: Record<string, number> = {};
  for (const pool of pools) {
    const floorSum = links.reduce((sum, l) => sum.plus(dec(l.floors[pool])), new Decimal(0));
    const net = dec(poolTotals[pool]).minus(floorSum);
    if (net.lt(-QTY_EPSILON)) deficits[pool] = net.neg().toDecimalPlaces(RECEIPT_SPLIT_DP).toNumber();
    left.set(pool, Decimal.max(net, 0));
  }

  const byPool = new Map<string, Map<string, Decimal>>();
  const total = new Map<string, Decimal>();
  for (const link of links) {
    const own = new Map<string, Decimal>();
    let sum = new Decimal(0);
    for (const [pool, floor] of Object.entries(link.floors)) {
      if (!qtyExceeds(floor, 0)) continue;
      own.set(pool, dec(floor));
      sum = sum.plus(dec(floor));
    }
    byPool.set(link.id, own);
    total.set(link.id, sum);
  }

  const take = (link: FillLink, pool: string) => {
    const room = dec(link.allocated).minus(total.get(link.id)!);
    const inPool = left.get(pool);
    if (!inPool || room.lte(0) || inPool.lte(0)) return;
    const qty = Decimal.min(room, inPool).toDecimalPlaces(RECEIPT_SPLIT_DP, Decimal.ROUND_DOWN);
    if (qty.lte(0)) return;
    left.set(pool, inPool.minus(qty));
    total.set(link.id, total.get(link.id)!.plus(qty));
    const own = byPool.get(link.id)!;
    own.set(pool, (own.get(pool) ?? new Decimal(0)).plus(qty));
  };

  const eligible = ordered.filter((l) => l.eligible);
  // A — a processor's cloth goes first to the orders processed there
  for (const link of eligible) if (link.dyer && isProcessorPool(link.dyer)) take(link, link.dyer);
  // B — cloth at a processor may serve an order whose processor is not decided yet (planning's rule)
  const processorPools = [...pools].filter(isProcessorPool).sort();
  for (const pool of processorPools) for (const link of eligible) if (link.dyer == null) take(link, pool);
  // C — our store serves anyone
  for (const link of eligible) take(link, STORE_POOL);

  const credit = new Map<string, number>();
  const creditByPool = new Map<string, Record<string, number>>();
  for (const link of links) {
    credit.set(link.id, total.get(link.id)!.toDecimalPlaces(RECEIPT_SPLIT_DP).toNumber());
    const rec: Record<string, number> = {};
    for (const [pool, qty] of byPool.get(link.id)!) rec[pool] = qty.toDecimalPlaces(RECEIPT_SPLIT_DP).toNumber();
    creditByPool.set(link.id, rec);
  }
  const plainStock: Record<string, number> = {};
  for (const [pool, qty] of left) plainStock[pool] = qty.toDecimalPlaces(RECEIPT_SPLIT_DP).toNumber();
  return { credit, creditByPool, plainStock, deficits };
}

/**
 * New fill ranks after the links on a line changed (design §4, change C4). The links up to the LAST one
 * with credit keep their ranks (zero-credit links among them too); every link after it — new links
 * included — is sorted by `compare` and numbered on from there.
 *
 * Why no credit moves: every link after the last credited one has credit 0, so at its position each pool
 * it may draw on is already empty in every pass; re-ordering those links among themselves leaves each of
 * them looking at the same empty pools. Why the rest keep their places: an earlier-dated link to another
 * processor that sits before a credited link must not be demoted behind later orders.
 *
 * @param credit each link's current credit (`receivedQuantity`; what it issued is inside it)
 * @returns a rank for EVERY link; write only the ones that changed
 */
export function rankTail<T extends { id: string; fillOrder: number | null }>(
  links: readonly T[],
  credit: ReadonlyMap<string, number>,
  compare: (a: T, b: T) => number
): Map<string, number> {
  const ordered = sortByFillOrder(links);
  let lastCredited = -1;
  ordered.forEach((link, i) => {
    if (qtyExceeds(credit.get(link.id) ?? 0, 0)) lastCredited = i;
  });

  const ranks = new Map<string, number>();
  let rank = 0;
  for (const link of ordered.slice(0, lastCredited + 1)) {
    // Keep the stored rank while it still reads in order; a missing or repeated one takes the next number
    rank = link.fillOrder != null && link.fillOrder > rank ? link.fillOrder : rank + 1;
    ranks.set(link.id, rank);
  }
  const tail = ordered
    .slice(lastCredited + 1)
    .sort((a, b) => compare(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const link of tail) ranks.set(link.id, ++rank);
  return ranks;
}
