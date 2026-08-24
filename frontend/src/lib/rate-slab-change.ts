/**
 * Qty-rate audit 2026-08-24: the backend refuses BOM creation/copy and production-order
 * confirmation with RATE_SLAB_CHANGED when the order's quantity lands in a different
 * processor rate slab than the style was costed at. The refusal's message already carries
 * the full human-readable diff (item, old rate @ old slab → new rate @ new slab, %).
 *
 * Callers show a confirm dialog with that message and retry the SAME call with
 * `acceptRateChanges: true` (BOM endpoints) / `acceptRates: true` (order confirmation).
 * Accepted rates are order-scoped — the style-level costing is never modified.
 */
export function extractRateSlabChange(err: unknown): string | null {
  const e = err as {
    response?: { data?: { message?: string; details?: { code?: string } } };
  };
  if (e?.response?.data?.details?.code === 'RATE_SLAB_CHANGED') {
    return e.response.data.message ?? 'Processor rates differ at this order quantity.';
  }
  return null;
}
