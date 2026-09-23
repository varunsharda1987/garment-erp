/**
 * Fold length ("L") — the ONE rule for turning a counted length into actual metres.
 *
 * Mills and processors measure greige and fabric in folds of L cm but count every fold as a metre, so
 * a than tagged "103 m" at L=98 is 100.94 real metres. The counted figure is what the supplier's paper
 * and the than tags carry; ACTUAL is what enters stock and what every counter, value, MRP link and
 * shrinkage figure runs on. Documents print both.
 *
 * Rule: actual = counted × L / 100 when 0 < L < 100, rounded to 2 dp (every stock column is
 * Decimal(10,2)). Any other L (null, 0, 100, above 100) leaves the quantity untouched.
 *
 * The same rule lives in frontend/src/lib/fold-length.ts. Inline copies are blocked by the
 * "fold length inline" smart-check.
 */
import { Decimal, toCurrency } from './currency';

type Qty = Parameters<typeof toCurrency>[0];

function foldFactor(foldLengthCm: Qty): Decimal | null {
  if (foldLengthCm === null || foldLengthCm === undefined || foldLengthCm === '') return null;
  const l = toCurrency(foldLengthCm);
  return l.gt(0) && l.lt(100) ? l.div(100) : null;
}

export function hasFold(foldLengthCm: Qty): boolean {
  return foldFactor(foldLengthCm) !== null;
}

/** Counted length at fold L → actual metres. */
export function foldActual(counted: Qty, foldLengthCm: Qty): Decimal {
  const factor = foldFactor(foldLengthCm);
  const qty = toCurrency(counted);
  return factor ? qty.times(factor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : qty;
}

/** Actual metres → the counted figure at fold L, for printing beside an actual lot quantity. */
export function foldCounted(actual: Qty, foldLengthCm: Qty): Decimal {
  const factor = foldFactor(foldLengthCm);
  const qty = toCurrency(actual);
  return factor ? qty.div(factor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : qty;
}
