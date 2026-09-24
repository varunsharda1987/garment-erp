/**
 * Split a whole-piece total across lines by percentage or ratio.
 *
 * Largest-remainder method: every line gets the floor of its exact share, then the pieces left
 * over go one each to the lines with the biggest fractional remainders — so the result always
 * adds up to the total exactly, which rounding each line on its own does not.
 *
 * Shared by the order form's size grid and the sale order's Amend Quantities dialog.
 */
export type ShareMode = 'percentage' | 'ratio';

export function distributeByShares(
  total: number,
  shares: Array<{ key: string; share: number }>,
  mode: ShareMode
): Map<string, number> | null {
  if (!Number.isFinite(total) || total <= 0 || shares.length === 0) return null;
  const denominator = mode === 'percentage' ? 100 : shares.reduce((sum, s) => sum + (s.share || 0), 0);
  if (denominator <= 0) return null;

  const rows = shares.map((s) => {
    const exact = ((s.share || 0) / denominator) * total;
    const floor = Math.floor(exact);
    return { key: s.key, floor, remainder: exact - floor };
  });

  const result = new Map(rows.map((r) => [r.key, r.floor]));
  const remaining = total - rows.reduce((sum, r) => sum + r.floor, 0);
  const byRemainder = [...rows].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining && i < byRemainder.length; i++) {
    const key = byRemainder[i].key;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

/** Sum of percentages, rounded to 2 decimals so 33.33 + 33.33 + 33.34 reads as exactly 100. */
export function percentageSum(values: number[]): number {
  return Math.round(values.reduce((sum, v) => sum + (v || 0), 0) * 100) / 100;
}
