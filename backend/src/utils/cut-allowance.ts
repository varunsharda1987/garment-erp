/**
 * How far past the order a size may be cut.
 *
 * Owner rule (2026-09-24): the buyer takes up to 5 % extra, size by size, so the most that may be
 * cut of a size is its order + 5 % ROUNDED DOWN — "up to" never rounds up past the allowance (XS
 * 322 → 338; rounding up gave 339 = +5.3 %). Max Cuttable is then the LOWER of this and what the
 * fabric in hand can make.
 *
 * One place: the Cutting Chart (screen and print) and batch creation all read it from here.
 */
export const MAX_EXTRA_CUT_PERCENT = 5;

/** The most pieces of one size that may be cut against its order quantity. */
export function maxCutForSize(orderQty: number): number {
  if (!Number.isFinite(orderQty) || orderQty <= 0) return 0;
  // Integer arithmetic: orderQty × 105 is exact, so the floor never slips on a float like 483.00000000000006
  return Math.floor((Math.round(orderQty) * (100 + MAX_EXTRA_CUT_PERCENT)) / 100);
}

/**
 * Max Cuttable per size: the LOWER of the fabric and the allowance, size by size.
 *
 * When the fabric covers every size's allowance, each size gets its allowance. When it does not,
 * the pieces the fabric can make are shared across sizes in the order's own ratio (largest
 * remainder, so they add up exactly), and no size is given more than its allowance.
 */
export function maxCutBySize(orderQtys: number[], fabricMaxPcs: number | null): number[] {
  const caps = orderQtys.map(maxCutForSize);
  const capTotal = caps.reduce((s, c) => s + c, 0);
  if (fabricMaxPcs == null || !Number.isFinite(fabricMaxPcs) || fabricMaxPcs >= capTotal) return caps;
  const pool = Math.max(0, Math.floor(fabricMaxPcs));
  const orderTotal = orderQtys.reduce((s, q) => s + (q > 0 ? q : 0), 0);
  if (orderTotal === 0 || pool === 0) return caps.map(() => 0);

  const exact = orderQtys.map((q) => ((q > 0 ? q : 0) * pool) / orderTotal);
  const result = exact.map((e, i) => Math.min(Math.floor(e), caps[i]));
  let left = pool - result.reduce((s, v) => s + v, 0);
  const byRemainder = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r);
  // Hand out what is left one piece at a time, largest remainder first, never past a size's cap
  while (left > 0) {
    let gave = false;
    for (const { i } of byRemainder) {
      if (left === 0) break;
      if (result[i] < caps[i]) {
        result[i] += 1;
        left -= 1;
        gave = true;
      }
    }
    if (!gave) break;
  }
  return result;
}

/**
 * The default pieces to cut of one size for an Extra % typed on the chart: rounded up to whole
 * garments, but never past the size's allowance.
 */
export function plannedCutForSize(orderQty: number, extraPercent: number): number {
  if (!Number.isFinite(orderQty) || orderQty <= 0) return 0;
  const extra = Number.isFinite(extraPercent) && extraPercent > 0 ? extraPercent : 0;
  // Scaled to hundredths of a percent so 1 + 5/100 cannot land a hair above a whole number
  const raw = Math.ceil((Math.round(orderQty) * Math.round((100 + extra) * 100)) / 10000 - 1e-9);
  return Math.min(raw, maxCutForSize(orderQty));
}
