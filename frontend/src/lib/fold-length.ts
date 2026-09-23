/**
 * Fold length ("L") — the ONE rule for turning a counted length into actual metres.
 *
 * Mills and processors measure greige and fabric in folds of L cm but count every fold as a metre, so
 * a than tagged "103 m" at L=98 is 100.94 real metres. Stock, value and over-receipt run on ACTUAL;
 * screens show both figures.
 *
 * Rule: actual = counted × L / 100 when 0 < L < 100, rounded to 2 dp. Any other L leaves the quantity
 * untouched. Same rule as backend/src/utils/fold-length.ts.
 */
import { formatQuantity } from './formatters';

type Qty = number | string | null | undefined;

function toNum(v: Qty): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return n === null || n === undefined || Number.isNaN(n) ? 0 : n;
}

function foldFactorPercent(foldLengthCm: Qty): number | null {
  if (foldLengthCm === null || foldLengthCm === undefined || foldLengthCm === '') return null;
  const l = toNum(foldLengthCm);
  return l > 0 && l < 100 ? l : null;
}

// toFixed(6) strips binary noise (e.g. 97.3 × 98) before the half-up rounding to 2 dp.
function round2(v: number): number {
  return Math.round(Number(v.toFixed(6)) * 100) / 100;
}

export function hasFold(foldLengthCm: Qty): boolean {
  return foldFactorPercent(foldLengthCm) !== null;
}

/** Counted length at fold L → actual metres. */
export function foldActual(counted: Qty, foldLengthCm: Qty): number {
  const l = foldFactorPercent(foldLengthCm);
  const qty = toNum(counted);
  return l === null ? qty : round2((qty * l) / 100);
}

/** Actual metres → the counted figure at fold L. */
export function foldCounted(actual: Qty, foldLengthCm: Qty): number {
  const l = foldFactorPercent(foldLengthCm);
  const qty = toNum(actual);
  return l === null ? qty : round2((qty * 100) / l);
}

/** "10,011 m counted @ L=98 → 9,810.78 m", or null when there is no fold. */
export function foldLabel(counted: Qty, foldLengthCm: Qty, unit?: string | null): string | null {
  if (!hasFold(foldLengthCm)) return null;
  const l = toNum(foldLengthCm);
  return `${formatQuantity(toNum(counted), unit)} counted @ L=${l} → ${formatQuantity(foldActual(counted, foldLengthCm), unit)}`;
}
