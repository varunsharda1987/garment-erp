/**
 * Receipt splitting — how one physical receipt is divided across the allocation links it satisfies.
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
 */
export const RECEIPT_COMPLETE_TOLERANCE = 0.001;

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
