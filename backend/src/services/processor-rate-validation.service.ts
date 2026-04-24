/**
 * Processor Rate Validation Service
 * Validates cost sheet rates against current processor rates
 * BLOCKS order creation when rates have changed significantly (>=5%)
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

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
  const rate = await prisma.processor_rate_card.findFirst({
    where: {
      processorId,
      processingType,
      greigeId: greigeId || undefined,
      laceId: laceId || undefined,
      slabId: slabId || undefined,
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
  const rate = await prisma.processor_rate_card.findFirst({
    where: {
      processorId,
      processingType,
      greigeId: greigeId || undefined,
      laceId: laceId || undefined,
      slabId: slabId || undefined,
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

    const currentRate = await getCurrentProcessorRate(
      item.processorId,
      item.greigeId,
      null,
      'DYEING',
      item.rateCard?.slabId
    );

    if (!currentRate) continue; // No current rate found, skip

    // Track oldest rate date
    if (item.rateCard?.effectiveFrom) {
      if (!oldestRateDate || item.rateCard.effectiveFrom < oldestRateDate) {
        oldestRateDate = item.rateCard.effectiveFrom;
      }
    }

    // Compare rates
    if (Math.abs(currentRate.ratePerMeter - costSheetRate) > 0.001) {
      const difference = currentRate.ratePerMeter - costSheetRate;
      const percentageChange = costSheetRate > 0 ? (difference / costSheetRate) * 100 : 100;

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

    const currentRate = await getCurrentProcessorRate(
      item.processorId,
      null,
      item.greigeLaceId,
      'DYEING',
      item.rateCard?.slabId
    );

    if (!currentRate) continue;

    // Track oldest rate date
    if (item.rateCard?.effectiveFrom) {
      if (!oldestRateDate || item.rateCard.effectiveFrom < oldestRateDate) {
        oldestRateDate = item.rateCard.effectiveFrom;
      }
    }

    // Compare rates
    if (Math.abs(currentRate.ratePerMeter - costSheetRate) > 0.001) {
      const difference = currentRate.ratePerMeter - costSheetRate;
      const percentageChange = costSheetRate > 0 ? (difference / costSheetRate) * 100 : 100;

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
  hasOutdatedRates,
  getCurrentProcessorRate,
  getRateAtDate,
  getRateChangeHistory,
  BLOCKING_THRESHOLD_PERCENT,
  WARNING_THRESHOLD_PERCENT,
};

export default processorRateValidationService;
