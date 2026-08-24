/**
 * Processor Rate Validation Service
 * Validates cost sheet rates against current processor rates
 * BLOCKS order creation when rates have changed significantly (>=5%)
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
// BUG-PRC7 fix: use decimal.js utilities for precise rate calculations
import { toCurrency } from '../utils/currency';
// Qty-rate audit 2026-08-24: the slab-aware resolver — the ONLY function allowed to answer
// "which slab does quantity X land in" (single rate authority; do not re-implement slab matching)
import { lookupRate } from './processor-rate-v2.service';
import type { ProcessingTypeV2, PrintingTypeV2 } from '../types/processor-rate-v2.types';

// ============================================
// Types
// ============================================

export type RateChangeSeverity = 'INFO' | 'WARNING' | 'BLOCKING';
export type RateValidationStatus = 'CURRENT' | 'OUTDATED' | 'RATE_CHANGED';
export type SuggestedAction = 'PROCEED' | 'REFRESH_RATES' | 'CREATE_NEW_VERSION';

export interface ProcessorRateChangeWarning {
  itemType: 'FABRIC' | 'LACE';
  itemId: string;
  itemName: string;
  processorId: string;
  processorName: string;
  greigeId?: string;
  greigeName?: string;
  laceId?: string;
  laceName?: string;
  costSheetRate: number;
  currentRate: number;
  difference: number;
  percentageChange: number;
  severity: RateChangeSeverity;
  rateCardIdOld?: string;
  rateCardIdNew?: string;
  effectiveFromOld?: Date;
  effectiveFromNew?: Date;
}

export interface RateValidationResult {
  isValid: boolean;
  status: RateValidationStatus;
  fabricWarnings: ProcessorRateChangeWarning[];
  laceWarnings: ProcessorRateChangeWarning[];
  blockingItems: ProcessorRateChangeWarning[];
  warningItems: ProcessorRateChangeWarning[];
  requiresNewCostSheet: boolean;
  oldestRateDate: Date | null;
  suggestedAction: SuggestedAction;
  summary: {
    totalItems: number;
    currentItems: number;
    warningItems: number;
    blockingItems: number;
  };
}

// ============================================
// Constants
// ============================================

const BLOCKING_THRESHOLD_PERCENT = 5; // 5% change triggers blocking
const WARNING_THRESHOLD_PERCENT = 0.01; // Any change triggers warning

// ============================================
// Helper Functions
// ============================================

function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

/**
 * BUG-PRC7 fix: Compare two rate values with decimal.js precision
 * Returns true if rates are effectively equal (within 0.001)
 */
function ratesAreEqual(rate1: number, rate2: number): boolean {
  const diff = toCurrency(rate1).minus(toCurrency(rate2));
  return diff.abs().lessThan(0.001);
}

/**
 * BUG-PRC7 fix: Calculate percentage change with decimal.js precision
 */
function calculatePercentageChange(costSheetRate: number, currentRate: number): number {
  if (costSheetRate === 0) return 100;
  const costDec = toCurrency(costSheetRate);
  const currDec = toCurrency(currentRate);
  const changeAmount = currDec.minus(costDec);
  const percent = changeAmount.dividedBy(costDec).times(100);
  // Round to 2 decimal places for percentage
  return percent.toDecimalPlaces(2).toNumber();
}

function determineSeverity(percentageChange: number): RateChangeSeverity {
  const absChange = Math.abs(percentageChange);
  if (absChange >= BLOCKING_THRESHOLD_PERCENT) return 'BLOCKING';
  if (absChange >= WARNING_THRESHOLD_PERCENT) return 'WARNING';
  return 'INFO';
}

// ============================================
// Core Validation Functions
// ============================================

/**
 * Get the currently active processor rate for a given combination
 * Looks for rate where effectiveTo IS NULL (currently active)
 */
export async function getCurrentProcessorRate(
  processorId: string,
  greigeId: string | null,
  laceId: string | null,
  processingType: string = 'DYEING',
  slabId?: string | null
): Promise<{
  id: string;
  ratePerMeter: number;
  effectiveFrom: Date;
  shrinkagePercent: number | null;
} | null> {
  // A rate is only comparable within ONE quantity slab. A null slabId used to drop the filter
  // entirely, so findFirst matched an ARBITRARY slab of this greige and the caller compared the
  // cost sheet against a rate the processor quoted for a different quantity tier. Unknown slab
  // means the comparison is unresolvable — return null and let the caller skip.
  if (!slabId) return null;

  const rate = await prisma.processor_rate_card.findFirst({
    where: {
      processorId,
      processingType,
      greigeId: greigeId || undefined,
      laceId: laceId || undefined,
      slabId,
      effectiveTo: null, // Currently active
      isActive: true,
    },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      ratePerMeter: true,
      effectiveFrom: true,
      shrinkagePercent: true,
    },
  });

  if (!rate) return null;

  return {
    id: rate.id,
    ratePerMeter: toNumber(rate.ratePerMeter),
    effectiveFrom: rate.effectiveFrom,
    shrinkagePercent: rate.shrinkagePercent ? toNumber(rate.shrinkagePercent) : null,
  };
}

/**
 * Get rate that was active at a specific point in time
 */
export async function getRateAtDate(
  processorId: string,
  greigeId: string | null,
  laceId: string | null,
  asOfDate: Date,
  processingType: string = 'DYEING',
  slabId?: string | null
): Promise<{
  id: string;
  ratePerMeter: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
} | null> {
  // Same slab rule as getCurrentProcessorRate: an unknown slab is unresolvable, not a wildcard.
  if (!slabId) return null;

  const rate = await prisma.processor_rate_card.findFirst({
    where: {
      processorId,
      processingType,
      greigeId: greigeId || undefined,
      laceId: laceId || undefined,
      slabId,
      effectiveFrom: { lte: asOfDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOfDate } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      ratePerMeter: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });

  if (!rate) return null;

  return {
    id: rate.id,
    ratePerMeter: toNumber(rate.ratePerMeter),
    effectiveFrom: rate.effectiveFrom,
    effectiveTo: rate.effectiveTo,
  };
}

/**
 * Validate all processor rates in a cost sheet
 * Returns validation result with blocking/warning items
 */
export async function validateCostSheetRates(costSheetId: string): Promise<RateValidationResult> {
  const fabricWarnings: ProcessorRateChangeWarning[] = [];
  const laceWarnings: ProcessorRateChangeWarning[] = [];

  // Fetch cost sheet with fabric and lace items
  const costSheet = await prisma.style_costing.findUnique({
    where: { id: costSheetId },
    include: {
      fabricItems: {
        where: {
          sourcingStrategy: 'GREIGE_PROCESSED',
          processorId: { not: null },
        },
        include: {
          processor: { select: { id: true, name: true } },
          greige: { select: { id: true, greigeName: true } },
          rateCard: {
            select: {
              id: true,
              effectiveFrom: true,
              slabId: true,
              processingType: true, // costing-14: needed to validate against the correct process
            },
          },
        },
      },
      laceItems: {
        where: {
          sourcingStrategy: 'GREIGE_PROCESSED',
          processorId: { not: null },
        },
        include: {
          processor: { select: { id: true, name: true } },
          lace: { select: { id: true, laceName: true } },
          greigeLace: { select: { id: true, laceName: true } },
          rateCard: {
            select: {
              id: true,
              effectiveFrom: true,
              slabId: true,
              processingType: true, // costing-14: needed to validate against the correct process
            },
          },
        },
      },
    },
  });

  if (!costSheet) {
    return {
      isValid: false,
      status: 'OUTDATED',
      fabricWarnings: [],
      laceWarnings: [],
      blockingItems: [],
      warningItems: [],
      requiresNewCostSheet: true,
      oldestRateDate: null,
      suggestedAction: 'CREATE_NEW_VERSION',
      summary: { totalItems: 0, currentItems: 0, warningItems: 0, blockingItems: 0 },
    };
  }

  let oldestRateDate: Date | null = null;

  // Validate fabric items
  for (const item of costSheet.fabricItems) {
    if (!item.processorId || !item.greigeId) continue;

    const costSheetRate = toNumber(item.processingCost);
    if (costSheetRate === 0) continue; // Skip items without processing cost

    // costing-14: validate against the processing type the cost-sheet rate was built with
    // (DYEING or PRINTING) — a hardcoded 'DYEING' silently skipped validation for printed items
    const currentRate = await getCurrentProcessorRate(
      item.processorId,
      item.greigeId,
      null,
      item.rateCard?.processingType || 'DYEING',
      item.rateCard?.slabId
    );

    if (!currentRate) continue; // No current rate found, skip

    // Track oldest rate date
    if (item.rateCard?.effectiveFrom) {
      if (!oldestRateDate || item.rateCard.effectiveFrom < oldestRateDate) {
        oldestRateDate = item.rateCard.effectiveFrom;
      }
    }

    // BUG-PRC7 fix: Compare rates using decimal.js for precision
    if (!ratesAreEqual(currentRate.ratePerMeter, costSheetRate)) {
      // BUG-PRC7 fix: Calculate difference and percentage with decimal.js
      const difference = toCurrency(currentRate.ratePerMeter).minus(toCurrency(costSheetRate)).toNumber();
      const percentageChange = calculatePercentageChange(costSheetRate, currentRate.ratePerMeter);

      fabricWarnings.push({
        itemType: 'FABRIC',
        itemId: item.id,
        itemName: item.fabricName,
        processorId: item.processorId,
        processorName: item.processor?.name || 'Unknown',
        greigeId: item.greigeId,
        greigeName: item.greige?.greigeName || 'Unknown',
        costSheetRate,
        currentRate: currentRate.ratePerMeter,
        difference,
        percentageChange,
        severity: determineSeverity(percentageChange),
        rateCardIdOld: item.rateCard?.id,
        rateCardIdNew: currentRate.id,
        effectiveFromOld: item.rateCard?.effectiveFrom,
        effectiveFromNew: currentRate.effectiveFrom,
      });
    }
  }

  // Validate lace items
  for (const item of costSheet.laceItems) {
    if (!item.processorId || !item.greigeLaceId) continue;

    const costSheetRate = toNumber(item.processingCost);
    if (costSheetRate === 0) continue;

    // costing-14: use the item's actual processing type instead of hardcoded 'DYEING'
    const currentRate = await getCurrentProcessorRate(
      item.processorId,
      null,
      item.greigeLaceId,
      item.rateCard?.processingType || 'DYEING',
      item.rateCard?.slabId
    );

    if (!currentRate) continue;

    // Track oldest rate date
    if (item.rateCard?.effectiveFrom) {
      if (!oldestRateDate || item.rateCard.effectiveFrom < oldestRateDate) {
        oldestRateDate = item.rateCard.effectiveFrom;
      }
    }

    // BUG-PRC7 fix: Compare rates using decimal.js for precision
    if (!ratesAreEqual(currentRate.ratePerMeter, costSheetRate)) {
      // BUG-PRC7 fix: Calculate difference and percentage with decimal.js
      const difference = toCurrency(currentRate.ratePerMeter).minus(toCurrency(costSheetRate)).toNumber();
      const percentageChange = calculatePercentageChange(costSheetRate, currentRate.ratePerMeter);

      laceWarnings.push({
        itemType: 'LACE',
        itemId: item.id,
        itemName: item.lace?.laceName || 'Unknown Lace',
        processorId: item.processorId,
        processorName: item.processor?.name || 'Unknown',
        laceId: item.laceId || undefined,
        laceName: item.lace?.laceName,
        greigeId: item.greigeLaceId || undefined,
        greigeName: item.greigeLace?.laceName,
        costSheetRate,
        currentRate: currentRate.ratePerMeter,
        difference,
        percentageChange,
        severity: determineSeverity(percentageChange),
        rateCardIdOld: item.rateCard?.id,
        rateCardIdNew: currentRate.id,
        effectiveFromOld: item.rateCard?.effectiveFrom,
        effectiveFromNew: currentRate.effectiveFrom,
      });
    }
  }

  // Categorize warnings
  const allWarnings = [...fabricWarnings, ...laceWarnings];
  const blockingItems = allWarnings.filter((w) => w.severity === 'BLOCKING');
  const warningItems = allWarnings.filter((w) => w.severity === 'WARNING');
  const currentItems = costSheet.fabricItems.length + costSheet.laceItems.length - allWarnings.length;

  // Determine overall status
  let status: RateValidationStatus = 'CURRENT';
  let suggestedAction: SuggestedAction = 'PROCEED';

  if (blockingItems.length > 0) {
    status = 'OUTDATED';
    suggestedAction = 'CREATE_NEW_VERSION';
  } else if (warningItems.length > 0) {
    status = 'RATE_CHANGED';
    suggestedAction = 'REFRESH_RATES';
  }

  return {
    isValid: blockingItems.length === 0,
    status,
    fabricWarnings,
    laceWarnings,
    blockingItems,
    warningItems,
    requiresNewCostSheet: blockingItems.length > 0,
    oldestRateDate,
    suggestedAction,
    summary: {
      totalItems: costSheet.fabricItems.length + costSheet.laceItems.length,
      currentItems,
      warningItems: warningItems.length,
      blockingItems: blockingItems.length,
    },
  };
}

// ============================================
// Quantity-slab drift validation (qty-rate audit 2026-08-24)
// ============================================
//
// validateCostSheetRates above answers "has the price of the ORIGINALLY COSTED slab changed
// over time?" — it pins the cost sheet's own slabId, so it is structurally blind to the other
// failure mode: the ORDER's actual quantity landing in a DIFFERENT slab than the one the style
// was costed at (costed 2500m in the 2000-5000 slab, ordering 1500m in the 1000-2000 slab).
// This validator answers that second question by re-running the slab-aware lookup at the
// order's real fabric meters and comparing card-to-card.

export interface QuantitySlabDriftItem {
  itemType: 'FABRIC';
  /** style_costing_fabric_items.id — key for applying an order-scoped rate override */
  itemId: string;
  itemName: string;
  processorId: string;
  processorName: string;
  greigeId: string;
  greigeName?: string;
  /** The meters the slab lookup ran on at costing time (null = legacy row, basis unknown) */
  costedAtQuantityMeters: number | null;
  /** The meters this order actually needs (batch-group total when the costing was batched) */
  orderQuantityMeters: number;
  costedRateIsBatch: boolean;
  slabIdOld: string | null;
  slabLabelOld: string | null;
  slabIdNew: string;
  slabLabelNew: string;
  /** ₹/m the cost sheet froze */
  costSheetRate: number;
  /** ₹/m the rate card quotes at THIS order's meters */
  orderRate: number;
  difference: number;
  percentageChange: number;
  rateCardIdOld: string | null;
  rateCardIdNew: string;
}

export interface QuantitySlabValidationResult {
  driftItems: QuantitySlabDriftItem[];
  /** Items where a fresh lookup succeeded (drifted or not) */
  checkedItems: number;
  /** Items skipped: no processor/greige/rate, unresolvable printing type, or no card at the new quantity */
  skippedItems: number;
}

/**
 * Re-run the processor rate-slab lookup at the ORDER's actual quantity and report every
 * GREIGE_PROCESSED fabric item whose slab or rate differs from what the cost sheet froze.
 *
 * Batch-group rows are re-checked on the COMBINED meters of their group (mirroring how
 * FabricCostingPage priced them) — an individual-quantity re-check on a batched row would
 * report a phantom rate rise and destroy the negotiated consolidation.
 *
 * The result is DATA, not a verdict: callers decide warn/block/override per their hook
 * (order creation warns, BOM creation blocks until accepted, acceptance writes the fresh
 * rate to order_bom_items — never to the style-level costing row).
 */
export async function validateQuantitySlabs(
  costSheetId: string,
  orderQuantity: number
): Promise<QuantitySlabValidationResult> {
  const driftItems: QuantitySlabDriftItem[] = [];
  let checkedItems = 0;
  let skippedItems = 0;

  if (!orderQuantity || orderQuantity <= 0) {
    return { driftItems, checkedItems, skippedItems };
  }

  const costSheet = await prisma.style_costing.findUnique({
    where: { id: costSheetId },
    include: {
      fabricItems: {
        where: { sourcingStrategy: 'GREIGE_PROCESSED', processorId: { not: null } },
        include: {
          processor: { select: { id: true, name: true } },
          greige: { select: { id: true, greigeName: true } },
          rateCard: {
            select: {
              id: true,
              slabId: true,
              processingType: true,
              printingType: true,
              slab: { select: { slabLabel: true } },
            },
          },
          fabricCAD: {
            select: {
              processingBatchGroupColorId: true,
              costedAtQuantityMeters: true,
              costedRateIsBatch: true,
            },
          },
        },
      },
    },
  });

  if (!costSheet) {
    return { driftItems, checkedItems, skippedItems };
  }

  type FabricItem = (typeof costSheet.fabricItems)[number];
  const batchKey = (item: FabricItem): string | null => {
    const batchColor = item.fabricCAD?.processingBatchGroupColorId;
    return batchColor ? `${item.processorId}|${item.greigeId}|${batchColor}` : null;
  };

  // Combined meters per batch group at THIS order's quantity
  const basisByGroup = new Map<string, number>();
  for (const item of costSheet.fabricItems) {
    const key = batchKey(item);
    if (!key) continue;
    const meters = toNumber(item.effectiveCad) * orderQuantity;
    basisByGroup.set(key, (basisByGroup.get(key) ?? 0) + meters);
  }

  for (const item of costSheet.fabricItems) {
    const costSheetRate = toNumber(item.processingCost);
    if (!item.processorId || !item.greigeId || costSheetRate === 0) {
      skippedItems++;
      continue;
    }

    const key = batchKey(item);
    const ownMeters = toNumber(item.effectiveCad) * orderQuantity;
    const orderQuantityMeters = key ? (basisByGroup.get(key) ?? ownMeters) : ownMeters;
    if (orderQuantityMeters <= 0) {
      skippedItems++;
      continue;
    }

    const processingType: ProcessingTypeV2 = item.rateCard?.processingType === 'PRINTING' ? 'PRINTING' : 'DYEING';
    const printingType = (item.rateCard?.printingType ?? undefined) as PrintingTypeV2 | undefined;
    if (processingType === 'PRINTING' && !printingType) {
      // Cannot resolve a printing rate without the sub-type; skipping beats a false alarm
      skippedItems++;
      continue;
    }

    let fresh: Awaited<ReturnType<typeof lookupRate>> = null;
    try {
      fresh = await lookupRate({
        processorId: item.processorId,
        processingType,
        printingType,
        greigeId: item.greigeId,
        quantityMeters: orderQuantityMeters,
      });
    } catch {
      // Lookup threw (e.g. misconfigured card) — unresolvable, not a drift
    }
    if (!fresh) {
      skippedItems++;
      continue;
    }
    checkedItems++;

    const storedSlabId = item.rateCard?.slabId ?? null;
    const slabChanged = storedSlabId != null && fresh.slabId !== storedSlabId;
    const rateChanged = !ratesAreEqual(fresh.ratePerMeter, costSheetRate);

    // Same slab + same rate = nothing to report. Same slab + different rate = TIME drift,
    // which validateCostSheetRates already owns — reporting it here too would double-flag.
    if (storedSlabId != null && !slabChanged) continue;
    // Unknown original slab (legacy row without rateCardId): only a rate difference is evidence
    if (storedSlabId == null && !rateChanged) continue;

    driftItems.push({
      itemType: 'FABRIC',
      itemId: item.id,
      itemName: item.fabricName,
      processorId: item.processorId,
      processorName: item.processor?.name || 'Unknown',
      greigeId: item.greigeId,
      greigeName: item.greige?.greigeName,
      costedAtQuantityMeters:
        item.fabricCAD?.costedAtQuantityMeters != null ? toNumber(item.fabricCAD.costedAtQuantityMeters) : null,
      orderQuantityMeters,
      costedRateIsBatch: item.fabricCAD?.costedRateIsBatch ?? false,
      slabIdOld: storedSlabId,
      slabLabelOld: item.rateCard?.slab?.slabLabel ?? null,
      slabIdNew: fresh.slabId,
      slabLabelNew: fresh.slabLabel,
      costSheetRate,
      orderRate: fresh.ratePerMeter,
      difference: toCurrency(fresh.ratePerMeter).minus(toCurrency(costSheetRate)).toNumber(),
      percentageChange: calculatePercentageChange(costSheetRate, fresh.ratePerMeter),
      rateCardIdOld: item.rateCard?.id ?? null,
      rateCardIdNew: fresh.id,
    });
  }

  return { driftItems, checkedItems, skippedItems };
}

/**
 * Quick check if cost sheet has any outdated rates (blocking level)
 * Use this for fast validation before expensive operations
 */
export async function hasOutdatedRates(costSheetId: string): Promise<boolean> {
  const result = await validateCostSheetRates(costSheetId);
  return result.requiresNewCostSheet;
}

/**
 * Get rate change history for a processor-greige combination
 */
export async function getRateChangeHistory(
  processorId: string,
  greigeId?: string,
  laceId?: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    previousRate: number;
    newRate: number;
    changePercent: number;
    changeReasonCode: string | null;
    changedAt: Date;
    changedByName: string;
  }>
> {
  const logs = await prisma.processor_rate_change_log.findMany({
    where: {
      processorId,
      ...(greigeId && { greigeId }),
      ...(laceId && { laceId }),
    },
    orderBy: { changedAt: 'desc' },
    take: limit,
    include: {
      changedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    previousRate: toNumber(log.previousRate),
    newRate: toNumber(log.newRate),
    changePercent: toNumber(log.changePercent),
    changeReasonCode: log.changeReasonCode,
    changedAt: log.changedAt,
    changedByName: `${log.changedBy.firstName} ${log.changedBy.lastName}`,
  }));
}

// Export service object
export const processorRateValidationService = {
  validateCostSheetRates,
  validateQuantitySlabs,
  hasOutdatedRates,
  getCurrentProcessorRate,
  getRateAtDate,
  getRateChangeHistory,
  BLOCKING_THRESHOLD_PERCENT,
  WARNING_THRESHOLD_PERCENT,
};

export default processorRateValidationService;
