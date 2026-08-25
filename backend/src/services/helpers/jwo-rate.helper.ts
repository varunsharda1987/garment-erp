/**
 * JWO rate resolution — the single rule for "what should this job work order pay per meter".
 *
 * Qty-rate audit 2026-08-24: the JWO is the document the processor is PAID against, yet its
 * agreedRatePerMeter was either a costing-time snapshot frozen at a DIFFERENT quantity (the
 * manually-typed costing pcs), or an operator-typed number with no card behind it. Slabs are
 * quoted on METERS, so a 700m job priced off a 2500m slab understates the invoice every time.
 *
 * This helper is the one place that asks the rate card "what do you quote at THIS job's
 * meters", mirroring resolveJwoExpectedShrinkage's shape. It NEVER blocks: negotiated manual
 * rates are legitimate — callers surface the difference (dialog / preview / stored variance)
 * and persist the provenance columns so every JWO's rate is auditable after the fact.
 */
import { lookupRate } from '../processor-rate-v2.service';
import type { ProcessingTypeV2, PrintingTypeV2 } from '../../types/processor-rate-v2.types';
import { toCurrency } from '../../utils/currency';

export type JwoRateSource = 'RATE_CARD' | 'ORDER_BOM' | 'MANUAL' | 'TBD';

export interface JwoRateResolution {
  /** ₹/m the processor's rate card quotes at basisQuantityMeters (null = no card resolvable) */
  cardRatePerMeter: number | null;
  rateCardId: string | null;
  slabId: string | null;
  slabLabel: string | null;
  basisQuantityMeters: number;
  /** The upstream (BOM/costing snapshot) rate the caller knew, if any */
  upstreamRatePerMeter: number | null;
  /** Card rate exists and differs from the upstream rate at paise level */
  differsFromUpstream: boolean;
  varianceReason: string | null;
}

/**
 * Resolve the slab-correct rate for a job's actual meters. Returns nulls (never throws) when
 * the card cannot be resolved — the caller falls back to its existing number and records
 * rateSource accordingly.
 */
export async function resolveJwoRate(params: {
  processorId: string;
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2 | null;
  greigeId: string;
  basisQuantityMeters: number;
  upstreamRatePerMeter?: number | null;
}): Promise<JwoRateResolution> {
  const upstream = params.upstreamRatePerMeter != null ? Number(params.upstreamRatePerMeter) : null;
  const empty: JwoRateResolution = {
    cardRatePerMeter: null,
    rateCardId: null,
    slabId: null,
    slabLabel: null,
    basisQuantityMeters: params.basisQuantityMeters,
    upstreamRatePerMeter: upstream,
    differsFromUpstream: false,
    varianceReason: null,
  };

  if (!params.processorId || !params.greigeId || params.basisQuantityMeters <= 0) return empty;
  if (params.processingType === 'PRINTING' && !params.printingType) return empty;

  let fresh: Awaited<ReturnType<typeof lookupRate>> = null;
  try {
    fresh = await lookupRate({
      processorId: params.processorId,
      processingType: params.processingType,
      printingType: params.printingType ?? undefined,
      greigeId: params.greigeId,
      quantityMeters: params.basisQuantityMeters,
    });
  } catch {
    // Misconfigured card / missing printing type — unresolvable, not an error for the caller
  }
  if (!fresh || fresh.ratePerMeter <= 0) return empty;

  const differs =
    upstream != null && toCurrency(fresh.ratePerMeter).minus(toCurrency(upstream)).abs().greaterThanOrEqualTo(0.005);

  return {
    cardRatePerMeter: fresh.ratePerMeter,
    rateCardId: fresh.id,
    slabId: fresh.slabId,
    slabLabel: fresh.slabLabel,
    basisQuantityMeters: params.basisQuantityMeters,
    upstreamRatePerMeter: upstream,
    differsFromUpstream: differs,
    varianceReason: differs
      ? `Slab rate at ${params.basisQuantityMeters}m (${fresh.slabLabel}) is ₹${fresh.ratePerMeter}/m vs upstream ₹${upstream}/m`
      : null,
  };
}

/**
 * The provenance columns to persist on job_work_orders for a given resolution + the rate the
 * document actually carries. Keeps the write shape identical across all creation sites.
 */
export function jwoRateProvenance(
  resolution: JwoRateResolution | null,
  agreedRatePerMeter: number,
  options?: { isRateTbd?: boolean }
): {
  rateCardId: string | null;
  slabId: string | null;
  rateSource: JwoRateSource;
  rateBasisQuantity: number | null;
  costedRatePerMeter: number | null;
  rateVarianceReason: string | null;
} {
  if (options?.isRateTbd) {
    return {
      rateCardId: null,
      slabId: null,
      rateSource: 'TBD',
      rateBasisQuantity: resolution?.basisQuantityMeters ?? null,
      costedRatePerMeter: resolution?.upstreamRatePerMeter ?? null,
      rateVarianceReason: null,
    };
  }

  const cardRate = resolution?.cardRatePerMeter ?? null;
  const agreedMatchesCard =
    cardRate != null && toCurrency(agreedRatePerMeter).minus(toCurrency(cardRate)).abs().lessThan(0.005);

  return {
    rateCardId: resolution?.rateCardId ?? null,
    slabId: resolution?.slabId ?? null,
    // The document carries the card's own quote → RATE_CARD; anything else the operator/upstream
    // decided → MANUAL/ORDER_BOM (caller distinguishes via upstream when it matters)
    rateSource: agreedMatchesCard ? 'RATE_CARD' : resolution?.upstreamRatePerMeter != null ? 'ORDER_BOM' : 'MANUAL',
    rateBasisQuantity: resolution?.basisQuantityMeters ?? null,
    // The rate this document DIDN'T take, kept for the variance audit: the card quote when the
    // agreed rate deviates from it, else the upstream snapshot it superseded
    costedRatePerMeter: !agreedMatchesCard ? cardRate : (resolution?.upstreamRatePerMeter ?? null),
    rateVarianceReason:
      !agreedMatchesCard && cardRate != null
        ? `Agreed ₹${agreedRatePerMeter}/m vs card ₹${cardRate}/m @ ${resolution?.slabLabel ?? '?'} (${resolution?.basisQuantityMeters ?? '?'}m)`
        : (resolution?.varianceReason ?? null),
  };
}
