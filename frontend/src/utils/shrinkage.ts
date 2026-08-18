/**
 * Shrinkage conversions for job-work billing (frontend mirror of
 * backend/src/utils/currency.ts applyShrinkageLoss / divideByShrinkage).
 *
 * Billing basis: a processor bills for the FINISHED fabric he returns, while the
 * greige physically issued to him is inflated by the expected shrinkage. These two
 * helpers convert between the bases, guarding the s >= 100 divide-by-zero end —
 * an invalid shrinkage degrades to a no-op instead of Infinity.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Greige meters to issue for a given billable fabric-out qty: billable ÷ (1 − s/100). */
export function greigeFromBillable(billableQty: number, shrinkagePercent?: number | null): number {
  const s = shrinkagePercent ?? 0;
  if (!Number.isFinite(s) || s <= 0 || s >= 100) return billableQty;
  const retainedFraction = (100 - s) / 100; // 1 − s/100, guarded to (0, 1) above
  return round2(billableQty / retainedFraction);
}

/** Billable fabric-out qty for a given greige qty: greige × (1 − s/100). */
export function billableFromGreige(greigeQty: number, shrinkagePercent?: number | null): number {
  const s = shrinkagePercent ?? 0;
  if (!Number.isFinite(s) || s <= 0 || s >= 100) return greigeQty;
  return round2((greigeQty * (100 - s)) / 100);
}

/**
 * Loss tolerance a JWO is actually held to — mirrors the backend chain in
 * jobWorkOrderService.applyLossSplit: JWO override → process-type default → 0 (STRICT).
 * Never invent 3%: a missing tolerance means all shortfall beyond expected is abnormal.
 */
export function effectiveTolerancePercent(jwo: {
  tolerancePercent?: number | null;
  processTypeMaster?: { tolerancePercent?: number | null } | null;
}): number {
  return jwo.tolerancePercent ?? jwo.processTypeMaster?.tolerancePercent ?? 0;
}
