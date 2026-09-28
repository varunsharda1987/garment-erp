/**
 * Which quantity band prices a processor rate-card row — THE rule, for fabric and lace alike.
 *
 * A processor's bands are shared by every greige it rates, but a greige is often filled for only
 * the first few (Aryan Dyeing has 7 bands to 3500 m; nine greiges were filled only to 1500 m).
 * Until 2026-09-28 a quantity in an empty band above them found no rate at all, so a 2000 m job
 * could not be costed. Now the row's LAST filled band carries up to every larger quantity.
 *
 *   1. The band the quantity falls in (chosen by the caller, `findMatchingSlab`) — if it is filled.
 *   2. Otherwise, when NO filled band of this row ends above the quantity, the filled band that
 *      ends highest: the quantity is past the row's last rate, which carries up.
 *   3. Otherwise nothing — the quantity sits below the row's first filled band (or in a hole
 *      between filled bands). Carrying DOWN was not asked for; that empty band is a data gap the
 *      Processor Rate Cards page must fill.
 *
 * "Filled" is decided by the caller's query: an active card with ratePerMeter > 0 (the ₹0 cards
 * addGreigeToProcessor seeds are empty placeholders, not a free rate). Bands are half-open
 * [min, max), so a band ending at 1500 lies wholly below a 1500 m quantity.
 */

export interface RateBand {
  id: string;
  maxQuantity: number;
}

export interface RatedSlabPick {
  slabId: string;
  /** true when the rate comes from a band BELOW the quantity's own (the last filled band) */
  carriedUp: boolean;
}

export function pickRatedSlab(band: RateBand, filled: RateBand[], quantityMeters: number): RatedSlabPick | null {
  if (filled.some((f) => f.id === band.id)) return { slabId: band.id, carriedUp: false };
  if (filled.length === 0) return null;
  // A filled band still ahead of this quantity means the gap is inside the row, not past its end
  if (filled.some((f) => f.maxQuantity > quantityMeters)) return null;
  const last = filled.reduce((top, f) => (f.maxQuantity > top.maxQuantity ? f : top)); // allow-decimal-compare: RateBand holds numbers
  return { slabId: last.id, carriedUp: true };
}

/** How a carried rate's band reads everywhere a band label is shown (display only — never stored). */
export function carriedBandLabel(bandLabel: string): string {
  return `${bandLabel} — last rated band`;
}
