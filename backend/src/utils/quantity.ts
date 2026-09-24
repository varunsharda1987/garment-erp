/**
 * Quantities — the project's ONE rule for "is this quantity done / zero / over the limit".
 *
 * Why it exists (2026-09-24): quantities are stored at mixed scales — 3 decimals on MRP
 * requirements, requirement links, challans, PO and GRN lines; 2 decimals on the stock lots, job
 * work orders and send-outs — and screens pre-filled at 2. Moving a value across those scales
 * leaves up to 0.005 behind, and ~95 server checks plus ~45 screen checks compared exactly. So a
 * requirement short by 2 mm read "Partially from Stock" and sat in the "needs PO" lists, and a
 * dialog refused its own pre-filled 2786.60 against a 2786.598 shortfall.
 *
 * The rule: a quantity within QTY_EPSILON (0.005 — half the coarsest storage step) of a limit IS
 * that limit. Percentage tolerances (under/over-receipt, processing loss) are business rules and
 * stay where they are; money has its own tolerance.
 *
 * Rules:
 *  - Decide status with `isQtyZero` / `qtyAtLeast` / `qtyExceeds`, never `=== 0`, `<= 0`, `>=`.
 *  - Before writing a user-entered quantity against a limit, `snapToLimit` it, so a full quantity
 *    typed at 2 decimals is stored as exactly the limit.
 *  - Pre-fill inputs with `prefillQty` — the exact value, never rounded up.
 *
 * This file is identical to `frontend/src/lib/quantity.ts` (asserted by
 * `backend/src/__tests__/unit/quantity.test.ts`). It has no imports so both copies stay identical.
 */

/** Half of the coarsest storage step (2 decimals). Anything closer than this is rounding dust. */
export const QTY_EPSILON = 0.005;

type QtyInput = number | string | { toString(): string } | null | undefined;

/** Read any stored quantity (number, numeric string, Prisma Decimal) as a number; null/'' → 0. */
export function toQty(value: QtyInput): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Remove binary float noise (0.1 + 0.2 → 0.3) without changing any real 3-decimal value. */
function clean(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** True when the quantity is zero for every practical purpose (|x| < 0.005). */
export function isQtyZero(value: QtyInput): boolean {
  return Math.abs(clean(toQty(value))) < QTY_EPSILON;
}

/** a ≥ b, allowing rounding dust: "has at least b been done?" */
export function qtyAtLeast(a: QtyInput, b: QtyInput): boolean {
  return clean(toQty(a) - toQty(b)) > -QTY_EPSILON;
}

/** a > b by more than rounding dust: "is this really over the limit?" */
export function qtyExceeds(a: QtyInput, b: QtyInput): boolean {
  return clean(toQty(a) - toQty(b)) >= QTY_EPSILON;
}

/** What is left of `total` after `done`: snapped to 0 within dust, never negative. */
export function qtyRemaining(total: QtyInput, done: QtyInput): number {
  const left = clean(toQty(total) - toQty(done));
  return left < QTY_EPSILON ? 0 : left;
}

/**
 * A user-entered quantity checked against a limit: when it is within dust of the limit, the
 * limit itself (typed 2786.60 against 2786.598 → 2786.598). Otherwise the quantity unchanged.
 */
export function snapToLimit(qty: QtyInput, limit: QtyInput): number {
  const q = clean(toQty(qty));
  const l = clean(toQty(limit));
  return Math.abs(q - l) < QTY_EPSILON ? l : q;
}

/**
 * The value to pre-fill a quantity input with: the exact amount (up to 3 decimals, trailing zeros
 * dropped), never rounded up past the limit. 2786.598 → "2786.598"; 1340.72 → "1340.72".
 */
export function prefillQty(value: QtyInput): string {
  const n = Math.max(0, clean(toQty(value)));
  const floored = Math.floor(n * 1000 + 1e-6) / 1000;
  return String(floored);
}

/** The smaller of several quantities, for "pre-fill the most you can do" (stock vs shortfall). */
export function minQty(...values: QtyInput[]): number {
  return Math.min(...values.map((v) => clean(toQty(v))));
}
