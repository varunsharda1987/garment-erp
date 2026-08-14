/**
 * Processor Rate Service V2
 *
 * Matrix-based rate card system for DYEING and PRINTING processors
 * Features:
 * - One table per processor with greige rows and slab columns
 * - Direct link to greige_master for row data
 * - Custom quantity slabs per processor
 * - Copy functionality between processors
 */

import { Prisma, PrintingType } from '@prisma/client';
import prisma from '../config/database';
import {
  ProcessingTypeV2,
  PrintingTypeV2,
  PRINTING_TYPES,
  ProcessorInfo,
  SlabDefinition,
  SlabInput,
  GreigeForRateCard,
  RateEntry,
  GreigeRow,
  GreigeRateEntry,
  ProcessorRateMatrix,
  CopyRatesInput,
  RateLookupQuery,
  RateLookupResult,
  SaveMatrixRequest,
  ShrinkageEntry,
  ProcessorTypeStats,
  ProcessorSummary,
  ProcessorRateCardSummary,
} from '../types/processor-rate-v2.types';
import { Decimal } from '@prisma/client/runtime/library';
// BUG-PRC7 fix: use decimal.js utilities for precise rate calculations
import { toCurrency, multiplyCurrency } from '../utils/currency';

// ============================================
// Rate History Helper Functions
// ============================================

interface RateUpdateParams {
  processorId: string;
  processingType: string;
  printingType?: PrintingType | null;
  greigeId: string;
  laceId?: string | null;
  slabId: string;
  newRatePerMeter: number;
  userId: string;
  changeReasonCode?: string;
  changeNotes?: string;
}

/**
 * Helper to convert Decimal to number
 * BUG-PRC7 fix: wrapper for decimal.js conversion
 */
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
function calculatePercentageChange(oldRate: number, newRate: number): number {
  if (oldRate === 0) return 100;
  const oldDec = toCurrency(oldRate);
  const newDec = toCurrency(newRate);
  const changeAmount = newDec.minus(oldDec);
  const percent = changeAmount.dividedBy(oldDec).times(100);
  // Round to 2 decimal places for percentage
  return percent.toDecimalPlaces(2).toNumber();
}

/**
 * Update a processor rate with history preservation
 * Instead of overwriting, this closes the old rate and creates a new one
 */
async function updateRateWithHistory(
  existingRateId: string,
  newRatePerMeter: number,
  userId: string,
  changeReasonCode?: string,
  changeNotes?: string
): Promise<string> {
  // Get the existing rate details
  const existingRate = await prisma.processor_rate_card.findUnique({
    where: { id: existingRateId },
    include: {
      processor: { select: { name: true } },
      greige: { select: { greigeName: true } },
      lace: { select: { laceName: true } },
      slab: { select: { slabLabel: true } },
    },
  });

  if (!existingRate) {
    throw new Error(`Rate card not found: ${existingRateId}`);
  }

  const oldRate = toNumber(existingRate.ratePerMeter);

  // BUG-PRC7 fix: If rate hasn't changed, just return the existing ID
  if (ratesAreEqual(oldRate, newRatePerMeter)) {
    return existingRateId;
  }

  // BUG-PRC7 fix: Calculate change metrics with decimal.js precision
  const changeAmount = toCurrency(newRatePerMeter).minus(toCurrency(oldRate)).toNumber();
  const changePercent = calculatePercentageChange(oldRate, newRatePerMeter);

  // Transaction: close old rate, create new rate, log change
  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Close old rate
    await tx.processor_rate_card.update({
      where: { id: existingRateId },
      data: {
        effectiveTo: now,
        isActive: false,
      },
    });

    // 2. Create new rate
    const newRate = await tx.processor_rate_card.create({
      data: {
        processorId: existingRate.processorId,
        processingType: existingRate.processingType,
        printingType: existingRate.printingType,
        greigeId: existingRate.greigeId,
        laceId: existingRate.laceId,
        slabId: existingRate.slabId,
        ratePerMeter: newRatePerMeter,
        shrinkagePercent: existingRate.shrinkagePercent,
        screenCostPerScreen: existingRate.screenCostPerScreen,
        screenType: existingRate.screenType,
        effectiveFrom: now,
        effectiveTo: null,
        previousRateValue: oldRate,
        changeReasonCode: changeReasonCode || null,
        changeNotes: changeNotes || null,
        isActive: true,
        createdById: userId,
      },
    });

    // 3. Update old rate to point to new rate
    await tx.processor_rate_card.update({
      where: { id: existingRateId },
      data: { supersededById: newRate.id },
    });

    // 4. Log the change
    await tx.processor_rate_change_log.create({
      data: {
        oldRateCardId: existingRateId,
        newRateCardId: newRate.id,
        processorId: existingRate.processorId,
        processorName: existingRate.processor?.name || 'Unknown',
        processingType: existingRate.processingType,
        printingType: existingRate.printingType || null,
        greigeId: existingRate.greigeId,
        greigeName: existingRate.greige?.greigeName || null,
        laceId: existingRate.laceId,
        laceName: existingRate.lace?.laceName || null,
        slabId: existingRate.slabId,
        slabLabel: existingRate.slab?.slabLabel || null,
        previousRate: oldRate,
        newRate: newRatePerMeter,
        changeAmount,
        changePercent,
        changeReasonCode: changeReasonCode || null,
        changeNotes: changeNotes || null,
        changedById: userId,
      },
    });

    return newRate;
  });

  return result.id;
}

/**
 * Get all processors that handle DYEING or PRINTING
 * These are suppliers with DYEING_PRINTING in their supplierCategories enum array
 * Also includes SYSTEM_DEFAULT processor (even if inactive) for default rates
 */
export async function getAllDyeingPrintingProcessors(): Promise<ProcessorInfo[]> {
  const suppliers = await prisma.suppliers.findMany({
    where: {
      OR: [
        // Active suppliers with DYEING_PRINTING category
        {
          isActive: true,
          OR: [
            { supplierCategories: { has: 'DYEING_PRINTING' } },
            { processorRateCards: { some: { processingType: 'DYEING' } } },
            { processorRateCards: { some: { processingType: 'PRINTING' } } },
            { processorQuantitySlabs: { some: {} } },
          ],
        },
        // Always include SYSTEM_DEFAULT processor for default rates (even if inactive)
        { code: 'SYSTEM_DEFAULT' },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      rating: true,
      supplierCategories: true,
    },
    orderBy: { name: 'asc' },
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    rating: s.rating ?? undefined,
  }));
}

/**
 * Get complete rate matrix for a processor
 * Returns slabs (columns) and greiges with their rates
 * For PRINTING, printingType is required to filter rates by printing sub-type
 */
export async function getProcessorRateMatrix(
  processorId: string,
  processingType: ProcessingTypeV2,
  printingType?: PrintingTypeV2
): Promise<ProcessorRateMatrix> {
  // Validate printingType requirement
  if (processingType === 'PRINTING' && !printingType) {
    // Default to PIGMENT if not specified for backward compatibility
    printingType = 'PIGMENT';
  }

  // Get processor info
  const processor = await prisma.suppliers.findUnique({
    where: { id: processorId },
    select: { id: true, name: true, code: true },
  });

  if (!processor) {
    throw new Error('Processor not found');
  }

  // Get slabs for this processor and processing type (slabs are shared across printing types)
  const slabs = await prisma.processor_quantity_slabs.findMany({
    where: {
      processorId,
      processingType,
      isActive: true,
    },
    orderBy: { slabOrder: 'asc' },
  });

  // Build rate card filter - include printingType for PRINTING
  const rateCardFilter: any = {
    processorId,
    processingType,
    isActive: true,
    greigeId: { not: null },
    slabId: { not: null },
  };

  // For PRINTING, filter by printingType
  if (processingType === 'PRINTING') {
    rateCardFilter.printingType = printingType;
  } else {
    // For DYEING, printingType should be null
    rateCardFilter.printingType = null;
  }

  // Get all rate cards for this processor/processingType with greige details
  // Only include records that have greigeId and slabId (V2 format)
  const rateCards = await prisma.processor_rate_card.findMany({
    where: rateCardFilter,
    include: {
      greige: {
        select: {
          id: true,
          greigeCode: true,
          greigeName: true,
          genericGreigeName: true,
          averageShrinkagePercent: true,
        },
      },
      slab: {
        select: { id: true },
      },
    },
  });

  // Group rate cards by greige
  // Use array format for rates to avoid UUID key corruption by serializer
  const greigeMap = new Map<string, GreigeRow & { ratesMap: Map<string, number> }>();
  for (const rc of rateCards) {
    // Skip records without greige or slab (legacy data)
    if (!rc.greigeId || !rc.slabId || !rc.greige || !rc.slab) continue;

    const greigeId = rc.greigeId;
    if (!greigeMap.has(greigeId)) {
      // Shrinkage: ONLY from processor rate card (no fallback to greige master)
      const shrinkagePercent = rc.shrinkagePercent ? Number(rc.shrinkagePercent) : null;

      greigeMap.set(greigeId, {
        id: rc.greige.id,
        greigeCode: rc.greige.greigeCode,
        greigeName: rc.greige.greigeName,
        genericGreigeName: rc.greige.genericGreigeName || '',
        rates: [],
        ratesMap: new Map<string, number>(),
        shrinkagePercent,
      });
    } else {
      // Update shrinkage if we find a non-null value (take first non-null shrinkage found)
      const greige = greigeMap.get(greigeId)!;
      if (greige.shrinkagePercent === null && rc.shrinkagePercent) {
        greige.shrinkagePercent = Number(rc.shrinkagePercent);
      }
    }
    const greige = greigeMap.get(greigeId)!;
    greige.ratesMap.set(rc.slabId, Number(rc.ratePerMeter));
  }

  // Convert ratesMap to rates array for each greige
  for (const greige of greigeMap.values()) {
    greige.rates = Array.from(greige.ratesMap.entries()).map(([slabId, rate]) => ({
      slabId,
      ratePerMeter: rate,
    }));
    delete (greige as any).ratesMap;
  }

  return {
    processor: {
      id: processor.id,
      name: processor.name,
      code: processor.code,
    },
    processingType,
    printingType: processingType === 'PRINTING' ? printingType : undefined,
    slabs: slabs.map((s) => ({
      id: s.id,
      slabOrder: s.slabOrder,
      minQuantity: Number(s.minQuantity),
      maxQuantity: Number(s.maxQuantity),
      slabLabel:
        s.slabLabel ||
        (s.maxQuantity != null ? `${Number(s.minQuantity)}-${Number(s.maxQuantity)}m` : `${Number(s.minQuantity)}m+`),
      isActive: s.isActive,
    })),
    greiges: Array.from(greigeMap.values()).sort((a, b) => {
      // Sort by genericGreigeName then by greigeName
      const cmp = a.genericGreigeName.localeCompare(b.genericGreigeName);
      return cmp !== 0 ? cmp : a.greigeName.localeCompare(b.greigeName);
    }),
  };
}

/**
 * Get all active greige fabrics for row population
 */
export async function getGreigeFabricsForRateCard(): Promise<GreigeForRateCard[]> {
  const greiges = await prisma.greige_master.findMany({
    where: { isActive: true },
    select: {
      id: true,
      greigeCode: true,
      greigeName: true,
      genericGreigeName: true,
      composition: true,
      greigeWidth: true,
      averageShrinkagePercent: true,
    },
    orderBy: [{ genericGreigeName: 'asc' }, { greigeName: 'asc' }],
  });

  return greiges.map((g) => ({
    id: g.id,
    greigeCode: g.greigeCode,
    greigeName: g.greigeName,
    genericGreigeName: g.genericGreigeName || '',
    composition: g.composition,
    greigeWidth: Number(g.greigeWidth),
    averageShrinkagePercent: g.averageShrinkagePercent ? Number(g.averageShrinkagePercent) : null,
  }));
}

/**
 * Update or create slab definitions for a processor
 */
export async function updateProcessorSlabs(
  processorId: string,
  processingType: ProcessingTypeV2,
  slabs: SlabInput[],
  userId: string
): Promise<SlabDefinition[]> {
  // Validate slab ranges don't overlap
  const sortedSlabs = [...slabs].sort((a, b) => a.minQuantity - b.minQuantity);
  for (let i = 1; i < sortedSlabs.length; i++) {
    if (sortedSlabs[i].minQuantity < sortedSlabs[i - 1].maxQuantity) {
      throw new Error(`Slab ranges overlap: ${sortedSlabs[i - 1].maxQuantity} and ${sortedSlabs[i].minQuantity}`);
    }
  }

  // Get existing slabs
  const existingSlabs = await prisma.processor_quantity_slabs.findMany({
    where: { processorId, processingType },
  });
  const existingSlabIds = new Set(existingSlabs.map((s) => s.id));

  // Find slabs to delete (not in new list)
  const newSlabIds = new Set(slabs.filter((s) => s.id).map((s) => s.id));
  const slabsToDelete = existingSlabs.filter((s) => !newSlabIds.has(s.id));

  // Delete removed slabs (cascade will delete rate cards)
  if (slabsToDelete.length > 0) {
    await prisma.processor_quantity_slabs.deleteMany({
      where: { id: { in: slabsToDelete.map((s) => s.id) } },
    });
  }

  // Upsert slabs
  const upsertedSlabs: SlabDefinition[] = [];
  for (const slab of slabs) {
    const slabLabel = slab.slabLabel || `${slab.minQuantity}-${slab.maxQuantity}m`;

    if (slab.id && existingSlabIds.has(slab.id)) {
      // Update existing
      const updated = await prisma.processor_quantity_slabs.update({
        where: { id: slab.id },
        data: {
          slabOrder: slab.slabOrder,
          minQuantity: slab.minQuantity,
          maxQuantity: slab.maxQuantity,
          slabLabel,
        },
      });
      upsertedSlabs.push({
        id: updated.id,
        slabOrder: updated.slabOrder,
        minQuantity: Number(updated.minQuantity),
        maxQuantity: Number(updated.maxQuantity),
        slabLabel: updated.slabLabel || slabLabel,
        isActive: updated.isActive,
      });
    } else {
      // Create new
      const created = await prisma.processor_quantity_slabs.create({
        data: {
          processorId,
          processingType,
          slabOrder: slab.slabOrder,
          minQuantity: slab.minQuantity,
          maxQuantity: slab.maxQuantity,
          slabLabel,
          createdById: userId,
        },
      });
      upsertedSlabs.push({
        id: created.id,
        slabOrder: created.slabOrder,
        minQuantity: Number(created.minQuantity),
        maxQuantity: Number(created.maxQuantity),
        slabLabel: created.slabLabel || slabLabel,
        isActive: created.isActive,
      });
    }
  }

  return upsertedSlabs.sort((a, b) => a.slabOrder - b.slabOrder);
}

/**
 * Bulk save rate matrix (all greige x slab rates)
 * For PRINTING, printingType is required to save rates under a specific printing sub-type
 */
export async function saveProcessorRateMatrix(
  processorId: string,
  processingType: ProcessingTypeV2,
  printingType: PrintingTypeV2 | undefined,
  request: SaveMatrixRequest,
  userId: string
): Promise<void> {
  // Validate printingType for PRINTING
  if (processingType === 'PRINTING' && !printingType) {
    throw new Error('printingType is required when processingType is PRINTING');
  }

  // First update slabs and get mapping from temp/old IDs to new IDs
  const slabs = await updateProcessorSlabs(processorId, processingType, request.slabs, userId);

  // Create a mapping from frontend slabId (existing UUID or temp-{slabOrder}) to actual database ID
  const slabIdMap = new Map<string, string>();
  for (const slab of slabs) {
    // Map by slabOrder for temp IDs (temp-1, temp-2, etc.)
    slabIdMap.set(`temp-${slab.slabOrder}`, slab.id);
    // Also map by actual ID for existing slabs
    slabIdMap.set(slab.id, slab.id);
  }

  // Also map original slab IDs from request to new IDs (in case of re-ordering)
  for (const reqSlab of request.slabs) {
    if (reqSlab.id) {
      // Find the matching slab by slabOrder
      const matchingSlab = slabs.find((s) => s.slabOrder === reqSlab.slabOrder);
      if (matchingSlab) {
        slabIdMap.set(reqSlab.id, matchingSlab.id);
      }
    }
  }

  // Build delete filter including printingType
  const deleteFilter: any = {
    processorId,
    processingType,
    greigeId: { in: request.deletedGreigeIds },
  };
  if (processingType === 'PRINTING') {
    deleteFilter.printingType = printingType;
  }

  // Delete removed greige rows
  if (request.deletedGreigeIds && request.deletedGreigeIds.length > 0) {
    await prisma.processor_rate_card.deleteMany({
      where: deleteFilter,
    });
  }

  // Batch-load all currently-active greige rate rows for this matrix up front — one query instead
  // of a findFirst per cell (bug-hunt BH-0312). History-preserving updates below still run per
  // changed cell, so the supersede chain and audit log are unchanged.
  const activeRows = await prisma.processor_rate_card.findMany({
    where: {
      processorId,
      processingType,
      printingType: processingType === 'PRINTING' ? (printingType as PrintingType) : null,
      laceId: null,
      greigeId: { not: null },
      effectiveTo: null,
    },
  });
  const activeByCell = new Map<string, (typeof activeRows)[number]>();
  for (const row of activeRows) {
    activeByCell.set(`${row.greigeId}|${row.slabId}`, row);
  }

  // Upsert rate entries
  for (const rate of request.rates) {
    // Resolve the actual slabId from the map
    const actualSlabId = slabIdMap.get(rate.slabId);
    if (!actualSlabId) {
      console.warn(`Could not resolve slabId: ${rate.slabId}, skipping rate entry`);
      continue;
    }

    // Build where clause with printingType
    const rateDeleteFilter: any = {
      processorId,
      processingType,
      greigeId: rate.greigeId,
      slabId: actualSlabId,
    };
    if (processingType === 'PRINTING') {
      rateDeleteFilter.printingType = printingType;
    }

    if (rate.ratePerMeter === null || rate.ratePerMeter === undefined) {
      // Delete if rate is null
      await prisma.processor_rate_card.deleteMany({
        where: rateDeleteFilter,
      });
    } else {
      // Look up the active row from the batch-loaded map (no per-cell query)
      const existing = activeByCell.get(`${rate.greigeId}|${actualSlabId}`);

      if (existing) {
        // Skip unchanged cells entirely — avoids a findUnique + no-op transaction per cell
        // when the whole matrix is resubmitted for a small edit (bug-hunt BH-0312).
        // BUG-PRC7 fix: use decimal.js for precise rate comparison
        if (ratesAreEqual(toNumber(existing.ratePerMeter), rate.ratePerMeter)) {
          continue;
        }
        // Use history-preserving update instead of direct overwrite (supersede + audit log)
        await updateRateWithHistory(
          existing.id,
          rate.ratePerMeter,
          userId,
          'RATE_MATRIX_UPDATE',
          'Updated via rate matrix save'
        );
      } else if (processingType === 'PRINTING' && printingType) {
        await prisma.processor_rate_card.create({
          data: {
            processorId,
            processingType,
            printingType: printingType as PrintingType,
            greigeId: rate.greigeId,
            slabId: actualSlabId,
            ratePerMeter: rate.ratePerMeter,
            createdById: userId,
          },
        });
      } else {
        // DYEING (printingType is null)
        await prisma.processor_rate_card.create({
          data: {
            processor: { connect: { id: processorId } },
            processingType,
            printingType: null,
            greige: { connect: { id: rate.greigeId } },
            slab: { connect: { id: actualSlabId } },
            ratePerMeter: rate.ratePerMeter,
            createdBy: { connect: { id: userId } },
          },
        });
      }
    }
  }

  // Save shrinkage entries (shrinkage is stored per greige, shared across slabs)
  // IMPORTANT: Only update shrinkage on EXISTING rate cards - do NOT create placeholder
  // records with 0-rate as this creates garbage data that pollutes the rate matrix.
  // Shrinkage can only be saved alongside actual rate values.
  if (request.shrinkages && request.shrinkages.length > 0) {
    for (const shrinkage of request.shrinkages) {
      // Update shrinkagePercent on all rate cards for this greige
      // Build the where clause with printingType
      const shrinkageFilter: any = {
        processorId,
        processingType,
        greigeId: shrinkage.greigeId,
      };
      if (processingType === 'PRINTING') {
        shrinkageFilter.printingType = printingType;
      } else {
        shrinkageFilter.printingType = null;
      }

      // Only update existing rate cards - don't create placeholders with 0-rate
      // (BUG-PRC5: placeholder creation was causing garbage 0-rate records)
      await prisma.processor_rate_card.updateMany({
        where: shrinkageFilter,
        data: { shrinkagePercent: shrinkage.shrinkagePercent },
      });
    }
  }
}

/**
 * Copy rate structure from source processor to target processor
 * For PRINTING, printingType determines which printing sub-type's rates to copy
 */
export async function copyProcessorRates(input: CopyRatesInput, userId: string): Promise<void> {
  const {
    sourceProcessorId,
    targetProcessorId,
    processingType,
    printingType,
    copySlabs,
    copyRates: copyRatesFlag,
  } = input;

  // Validate printingType for PRINTING
  if (processingType === 'PRINTING' && !printingType) {
    throw new Error('printingType is required when processingType is PRINTING');
  }

  if (!copySlabs) {
    throw new Error('copySlabs must be true to copy rate structure');
  }

  // Get source slabs (slabs are shared across printing types, so no printingType filter)
  const sourceSlabs = await prisma.processor_quantity_slabs.findMany({
    where: { processorId: sourceProcessorId, processingType, isActive: true },
    orderBy: { slabOrder: 'asc' },
  });

  if (sourceSlabs.length === 0) {
    throw new Error('Source processor has no slabs defined');
  }

  // Delete existing slabs and rates for target (cascade)
  await prisma.processor_quantity_slabs.deleteMany({
    where: { processorId: targetProcessorId, processingType },
  });

  // Map old slab IDs to new slab IDs
  const slabIdMap = new Map<string, string>();

  // Create slabs for target
  for (const sourceSlab of sourceSlabs) {
    const newSlab = await prisma.processor_quantity_slabs.create({
      data: {
        processorId: targetProcessorId,
        processingType,
        slabOrder: sourceSlab.slabOrder,
        minQuantity: sourceSlab.minQuantity,
        maxQuantity: sourceSlab.maxQuantity,
        slabLabel: sourceSlab.slabLabel,
        createdById: userId,
      },
    });
    slabIdMap.set(sourceSlab.id, newSlab.id);
  }

  // Copy rates if requested
  if (copyRatesFlag) {
    // Build source filter with printingType for PRINTING
    const sourceFilter: any = {
      processorId: sourceProcessorId,
      processingType,
      isActive: true,
      greigeId: { not: null },
      slabId: { not: null },
    };
    if (processingType === 'PRINTING') {
      sourceFilter.printingType = printingType;
    }

    // Only copy V2 format rates (with greigeId and slabId)
    const sourceRates = await prisma.processor_rate_card.findMany({
      where: sourceFilter,
    });

    for (const sourceRate of sourceRates) {
      // Skip if greigeId or slabId is null (legacy data)
      if (!sourceRate.greigeId || !sourceRate.slabId) continue;

      const newSlabId = slabIdMap.get(sourceRate.slabId);
      if (newSlabId) {
        await prisma.processor_rate_card.create({
          data: {
            processor: { connect: { id: targetProcessorId } },
            processingType,
            printingType: processingType === 'PRINTING' ? printingType : null,
            greige: { connect: { id: sourceRate.greigeId } },
            slab: { connect: { id: newSlabId } },
            ratePerMeter: sourceRate.ratePerMeter,
            shrinkagePercent: sourceRate.shrinkagePercent, // Copy shrinkage percentage
            createdBy: { connect: { id: userId } },
          },
        });
      }
    }
  }
}

/**
 * Add a greige row to processor's matrix (with empty rates)
 * For PRINTING, printingType determines which printing sub-type to add the greige to
 *
 * NOTE (BUG-PRC5): This function creates placeholder entries with ratePerMeter=0 so the UI
 * can display the row. If the user never fills in actual rates, these remain as 0-rate entries.
 * A cleaner approach would be to show greiges in the UI based on selection (not rate entries)
 * and only create rate entries when the user saves non-zero values. However, this requires
 * UI changes. For now, these placeholders are intentional but should be cleaned up in a
 * future refactor.
 */
export async function addGreigeToProcessor(
  processorId: string,
  processingType: ProcessingTypeV2,
  printingType: PrintingTypeV2 | undefined,
  greigeId: string,
  userId: string
): Promise<void> {
  // Validate printingType for PRINTING
  if (processingType === 'PRINTING' && !printingType) {
    throw new Error('printingType is required when processingType is PRINTING');
  }

  // Get slabs for this processor (slabs are shared across printing types)
  const slabs = await prisma.processor_quantity_slabs.findMany({
    where: { processorId, processingType, isActive: true },
  });

  // Create empty rate entries for each slab
  for (const slab of slabs) {
    if (processingType === 'PRINTING' && printingType) {
      // For PRINTING, use findFirst + create pattern (compound unique has nullable fields)
      const existing = await prisma.processor_rate_card.findFirst({
        where: {
          processorId,
          processingType,
          printingType: printingType as PrintingType,
          greigeId,
          laceId: null, // Greige fabric rate, not lace
          slabId: slab.id,
        },
      });

      if (!existing) {
        await prisma.processor_rate_card.create({
          data: {
            processorId,
            processingType,
            printingType: printingType as PrintingType,
            greigeId,
            slabId: slab.id,
            ratePerMeter: 0, // Placeholder rate
            createdById: userId,
          },
        });
      }
    } else {
      // For DYEING (printingType is null), use findFirst + create pattern
      const existing = await prisma.processor_rate_card.findFirst({
        where: {
          processorId,
          processingType,
          printingType: null,
          greigeId,
          slabId: slab.id,
        },
      });

      if (!existing) {
        await prisma.processor_rate_card.create({
          data: {
            processor: { connect: { id: processorId } },
            processingType,
            printingType: null,
            greige: { connect: { id: greigeId } },
            slab: { connect: { id: slab.id } },
            ratePerMeter: 0, // Placeholder rate
            createdBy: { connect: { id: userId } },
          },
        });
      }
    }
  }
}

/**
 * Remove a greige row from processor's matrix
 * For PRINTING, printingType determines which printing sub-type to remove the greige from
 */
export async function removeGreigeFromProcessor(
  processorId: string,
  processingType: ProcessingTypeV2,
  printingType: PrintingTypeV2 | undefined,
  greigeId: string
): Promise<void> {
  // Build delete filter
  const deleteFilter: any = { processorId, processingType, greigeId };
  if (processingType === 'PRINTING') {
    deleteFilter.printingType = printingType;
  }
  await prisma.processor_rate_card.deleteMany({
    where: deleteFilter,
  });
}

/**
 * Lookup rate for fabric costing (find best matching slab for quantity)
 * For PRINTING, printingType is required to lookup the rate for a specific printing sub-type
 */
export async function lookupRate(query: RateLookupQuery): Promise<RateLookupResult | null> {
  let { processorId, processingType, printingType, greigeId, quantityMeters } = query;

  // Validate printingType for PRINTING
  if (processingType === 'PRINTING' && !printingType) {
    throw new Error('printingType is required when processingType is PRINTING');
  }

  // If no processorId provided, use SYSTEM_DEFAULT for default rates
  if (!processorId) {
    const systemDefault = await prisma.suppliers.findFirst({
      where: { code: 'SYSTEM_DEFAULT' },
      select: { id: true },
    });
    if (!systemDefault) {
      return null; // No default rates configured
    }
    processorId = systemDefault.id;
  }

  // Find the slab that matches the quantity (slabs are shared across printing types)
  // First try exact slab match
  let matchingSlab = await prisma.processor_quantity_slabs.findFirst({
    where: {
      processorId,
      processingType,
      isActive: true,
      minQuantity: { lte: quantityMeters },
      // Half-open range [min, max): max is EXCLUSIVE, so a boundary quantity (e.g. 500m when the
      // slabs are 0-500 and 500-1000) matches exactly ONE slab instead of coin-flipping between two
      // (bug-hunt BH-0329). This matches updateProcessorSlabs' own overlap rule; the `desc` fallback
      // below still catches quantities at or above the top slab.
      maxQuantity: { gt: quantityMeters },
    },
  });

  // If no exact match, use highest slab (for quantities exceeding max slab range)
  if (!matchingSlab) {
    matchingSlab = await prisma.processor_quantity_slabs.findFirst({
      where: {
        processorId,
        processingType,
        isActive: true,
      },
      orderBy: { maxQuantity: 'desc' },
    });
  }

  if (!matchingSlab) {
    return null; // No slabs defined at all for this processor/processingType
  }

  // Build rate card filter with printingType for PRINTING
  const rateCardFilter: any = {
    processorId,
    processingType,
    greigeId,
    slabId: matchingSlab.id,
    isActive: true,
  };
  if (processingType === 'PRINTING') {
    rateCardFilter.printingType = printingType;
  }

  // Find the rate card for this greige and slab
  const rateCard = await prisma.processor_rate_card.findFirst({
    where: rateCardFilter,
    include: {
      processor: { select: { id: true, name: true } },
      greige: { select: { id: true, greigeName: true, averageShrinkagePercent: true } },
      slab: { select: { id: true, slabLabel: true, minQuantity: true, maxQuantity: true } },
    },
  });

  // Check if we have a valid rate card with greige and slab data
  if (!rateCard || !rateCard.greige || !rateCard.slab || !rateCard.greigeId || !rateCard.slabId) {
    return null;
  }

  const ratePerMeter = Number(rateCard.ratePerMeter);
  // BUG-PRC7 fix: use decimal.js for precise multiplication
  const totalCost = multiplyCurrency(quantityMeters, ratePerMeter).toDecimalPlaces(2).toNumber();

  // Shrinkage: ONLY from processor rate card (no fallback to greige master)
  const shrinkagePercent = rateCard.shrinkagePercent ? Number(rateCard.shrinkagePercent) : null;

  return {
    id: rateCard.id,
    processorId: rateCard.processorId,
    processorName: rateCard.processor.name,
    processingType: rateCard.processingType as ProcessingTypeV2,
    printingType: rateCard.printingType as PrintingTypeV2 | undefined,
    greigeId: rateCard.greigeId,
    greigeName: rateCard.greige.greigeName,
    slabId: rateCard.slabId,
    slabLabel: rateCard.slab.slabLabel || '',
    minQuantity: Number(rateCard.slab.minQuantity),
    maxQuantity: Number(rateCard.slab.maxQuantity),
    ratePerMeter,
    totalCost,
    shrinkagePercent,
    screenCostPerScreen: rateCard.screenCostPerScreen ? Number(rateCard.screenCostPerScreen) : null,
  };
}

/**
 * Get summary of all processor rate card configurations
 * Uses efficient aggregate queries with groupBy
 */
export async function getProcessorRateCardSummary(): Promise<ProcessorRateCardSummary> {
  // Run all queries in parallel for efficiency
  const [processors, slabCounts, rateStats, greigeCounts, slabDetails, lastUpdated, totalGreigeCount] =
    await Promise.all([
      // 1. Get all DYEING/PRINTING processors
      getAllDyeingPrintingProcessors(),

      // 2. Count slabs per processor/processingType
      prisma.processor_quantity_slabs.groupBy({
        by: ['processorId', 'processingType'],
        where: { isActive: true },
        _count: { id: true },
      }),

      // 3. Get rate statistics per processor/processingType
      prisma.processor_rate_card.groupBy({
        by: ['processorId', 'processingType'],
        where: {
          isActive: true,
          greigeId: { not: null },
          slabId: { not: null },
        },
        _count: { id: true },
        _min: { ratePerMeter: true },
        _max: { ratePerMeter: true },
      }),

      // 4. Count unique greiges with rates per processor/processingType
      prisma.processor_rate_card.groupBy({
        by: ['processorId', 'processingType', 'greigeId'],
        where: {
          isActive: true,
          greigeId: { not: null },
          slabId: { not: null },
        },
      }),

      // 5. Get slab labels for each processor/processingType
      prisma.processor_quantity_slabs.findMany({
        where: { isActive: true },
        select: {
          processorId: true,
          processingType: true,
          slabLabel: true,
          minQuantity: true,
          maxQuantity: true,
        },
        orderBy: { slabOrder: 'asc' },
      }),

      // 6. Get last updated timestamp per processor
      prisma.processor_rate_card.groupBy({
        by: ['processorId'],
        _max: { updatedAt: true },
      }),

      // 7. Total active greige count
      prisma.greige_master.count({ where: { isActive: true } }),
    ]);

  // Build lookup maps for efficient access
  const slabCountMap = new Map<string, number>();
  for (const sc of slabCounts) {
    const key = `${sc.processorId}:${sc.processingType}`;
    slabCountMap.set(key, sc._count.id);
  }

  const rateStatsMap = new Map<string, { count: number; min: number | null; max: number | null }>();
  for (const rs of rateStats) {
    const key = `${rs.processorId}:${rs.processingType}`;
    rateStatsMap.set(key, {
      count: rs._count.id,
      min: rs._min.ratePerMeter ? Number(rs._min.ratePerMeter) : null,
      max: rs._max.ratePerMeter ? Number(rs._max.ratePerMeter) : null,
    });
  }

  // Count unique greiges per processor/processingType
  const greigeCountMap = new Map<string, number>();
  for (const gc of greigeCounts) {
    const key = `${gc.processorId}:${gc.processingType}`;
    greigeCountMap.set(key, (greigeCountMap.get(key) || 0) + 1);
  }

  // Slab ranges per processor/processingType
  const slabRangesMap = new Map<string, string[]>();
  for (const sd of slabDetails) {
    const key = `${sd.processorId}:${sd.processingType}`;
    const label = sd.slabLabel || `${Number(sd.minQuantity)}-${Number(sd.maxQuantity)}m`;
    if (!slabRangesMap.has(key)) {
      slabRangesMap.set(key, []);
    }
    slabRangesMap.get(key)!.push(label);
  }

  // Last updated per processor
  const lastUpdatedMap = new Map<string, Date>();
  for (const lu of lastUpdated) {
    if (lu._max.updatedAt) {
      lastUpdatedMap.set(lu.processorId, lu._max.updatedAt);
    }
  }

  // Helper to build stats for a processing type
  function buildTypeStats(processorId: string, processingType: ProcessingTypeV2): ProcessorTypeStats {
    const key = `${processorId}:${processingType}`;
    const slabCount = slabCountMap.get(key) || 0;
    const greigeCount = greigeCountMap.get(key) || 0;
    const stats = rateStatsMap.get(key);
    const totalRateCount = stats?.count || 0;
    const slabRanges = slabRangesMap.get(key) || [];

    // Coverage: percentage of possible cells filled
    // If no slabs, coverage is 0
    // Otherwise, coverage = (rateCount / (slabCount * greigeCount)) * 100
    let coverage = 0;
    if (slabCount > 0 && greigeCount > 0) {
      coverage = Math.round((totalRateCount / (slabCount * greigeCount)) * 100);
    }

    return {
      slabCount,
      greigeCount,
      totalRateCount,
      coverage,
      minRate: stats?.min ?? undefined,
      maxRate: stats?.max ?? undefined,
      slabRanges: slabRanges.length > 0 ? slabRanges : undefined,
    };
  }

  // Determine status based on user's requirements:
  // - NOT_CONFIGURED: No slabs for either DYEING or PRINTING
  // - COMPLETE: Has slabs + any rates defined (for either type)
  // - PARTIAL: Has slabs but no rates
  function determineStatus(
    dyeing: ProcessorTypeStats,
    printing: ProcessorTypeStats
  ): 'NOT_CONFIGURED' | 'PARTIAL' | 'COMPLETE' {
    const dyeingConfigured = dyeing.slabCount > 0;
    const printingConfigured = printing.slabCount > 0;

    if (!dyeingConfigured && !printingConfigured) {
      return 'NOT_CONFIGURED';
    }

    // Complete if has slabs + any rates for either type
    const dyeingComplete = dyeingConfigured && dyeing.totalRateCount > 0;
    const printingComplete = printingConfigured && printing.totalRateCount > 0;

    if (dyeingComplete || printingComplete) {
      return 'COMPLETE';
    }

    return 'PARTIAL';
  }

  // Build processor summaries
  const processorSummaries: ProcessorSummary[] = processors.map((p) => {
    const dyeing = buildTypeStats(p.id, 'DYEING');
    const printing = buildTypeStats(p.id, 'PRINTING');
    const status = determineStatus(dyeing, printing);
    const lastUpdate = lastUpdatedMap.get(p.id);

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      dyeing,
      printing,
      status,
      lastUpdatedAt: lastUpdate?.toISOString(),
    };
  });

  // Calculate totals
  let configuredCount = 0;
  let completeCount = 0;
  for (const ps of processorSummaries) {
    if (ps.status !== 'NOT_CONFIGURED') {
      configuredCount++;
    }
    if (ps.status === 'COMPLETE') {
      completeCount++;
    }
  }

  // Calculate processing type summaries
  function calculateTypeSummary(processingType: ProcessingTypeV2) {
    let totalSlabs = 0;
    let totalRates = 0;
    let processorsConfigured = 0;
    let coverageSum = 0;

    for (const ps of processorSummaries) {
      const stats = processingType === 'DYEING' ? ps.dyeing : ps.printing;
      totalSlabs += stats.slabCount;
      totalRates += stats.totalRateCount;
      if (stats.slabCount > 0) {
        processorsConfigured++;
        coverageSum += stats.coverage;
      }
    }

    const averageCoverage = processorsConfigured > 0 ? Math.round(coverageSum / processorsConfigured) : 0;

    return { totalSlabs, totalRates, processorsConfigured, averageCoverage };
  }

  return {
    processors: processorSummaries,
    totals: {
      totalProcessors: processors.length,
      configuredProcessors: configuredCount,
      completeProcessors: completeCount,
      totalGreigeCount: totalGreigeCount,
    },
    processingTypeSummary: {
      DYEING: calculateTypeSummary('DYEING'),
      PRINTING: calculateTypeSummary('PRINTING'),
    },
  };
}

// ==========================================
// LACE RATE CARD FUNCTIONS
// ==========================================

/**
 * Lace rate entry type for rate card matrix
 */
export interface LaceRateEntry {
  laceId: string;
  slabId: string;
  ratePerMeter: number;
}

/**
 * Lace row in the rate matrix
 *
 * BUG-PRC9 documentation: This interface uses Record<string, number | null> format for rates,
 * while GreigeRow uses GreigeRateEntry[] (array format). This inconsistency exists because:
 *
 * 1. GreigeRow was changed to array format to avoid UUID key corruption by the serializer
 *    (the serializer was treating UUID keys as potential snake_case fields)
 *
 * 2. LaceRow was kept as Record format during the BUG-PRC1 fix (rate history records)
 *    because lace rate cards are less commonly used and the frontend conversion
 *    (`convertLaceFromAPI`) handles both formats transparently
 *
 * To fully align, LaceRow.rates should be changed to array format and the frontend
 * conversion function updated. This is tracked as low-priority technical debt.
 */
export interface LaceRow {
  laceId: string;
  laceName: string;
  laceCode: string;
  width: number | null;
  composition: string | null;
  expectedShrinkagePercent: number | null;
  costPerMeterGreige: number | null;
  rates: Record<string, number | null>; // slabId -> rate (see note above re: format inconsistency)
}

/**
 * Lace rate matrix response
 */
/**
 * Simplified slab info for lace rate matrix display
 */
export interface LaceSlabInfo {
  id: string;
  slabLabel: string;
  minQuantity: number;
  maxQuantity: number;
  slabOrder: number;
}

export interface LaceRateMatrix {
  processor: { id: string; name: string; code: string };
  processingType: 'DYEING';
  slabs: LaceSlabInfo[];
  laces: LaceRow[];
}

/**
 * Get greige lace items for rate card matrix
 * Returns all greige lace items that can be added to a processor's rate card
 */
export async function getGreigeLaceForRateCard(): Promise<any[]> {
  const greigeLaces = await prisma.lace_master.findMany({
    where: {
      isActive: true,
      isGreige: true,
    },
    select: {
      id: true,
      laceCode: true,
      laceName: true,
      width: true,
      composition: true,
      laceType: true,
      expectedShrinkagePercent: true,
      costPerMeterGreige: true,
    },
    orderBy: { laceName: 'asc' },
  });

  return greigeLaces.map((lace) => ({
    id: lace.id,
    code: lace.laceCode,
    name: lace.laceName,
    width: lace.width ? Number(lace.width) : null,
    composition: lace.composition,
    laceType: lace.laceType,
    expectedShrinkagePercent: lace.expectedShrinkagePercent ? Number(lace.expectedShrinkagePercent) : null,
    costPerMeterGreige: lace.costPerMeterGreige ? Number(lace.costPerMeterGreige) : null,
  }));
}

/**
 * Get lace rate matrix for a processor
 * Returns slabs (columns) and greige laces with their dyeing rates
 */
export async function getLaceProcessorRateMatrix(processorId: string): Promise<LaceRateMatrix> {
  // Get processor info
  const processor = await prisma.suppliers.findUnique({
    where: { id: processorId },
    select: { id: true, name: true, code: true },
  });

  if (!processor) {
    throw new Error('Processor not found');
  }

  // Get slabs for this processor (DYEING type for lace)
  const slabs = await prisma.processor_quantity_slabs.findMany({
    where: {
      processorId,
      processingType: 'DYEING',
      isActive: true,
    },
    orderBy: { slabOrder: 'asc' },
  });

  // Get all lace rate cards for this processor
  const rateCards = await prisma.processor_rate_card.findMany({
    where: {
      processorId,
      processingType: 'DYEING',
      laceId: { not: null },
      isActive: true,
    },
    include: {
      lace: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          width: true,
          composition: true,
          expectedShrinkagePercent: true,
          costPerMeterGreige: true,
        },
      },
    },
  });

  // Build rates map: laceId -> slabId -> rate
  const ratesMap = new Map<string, Map<string, number>>();
  const lacesMap = new Map<string, any>();

  for (const card of rateCards) {
    if (!card.laceId || !card.slabId || !card.lace) continue;

    lacesMap.set(card.laceId, card.lace);

    if (!ratesMap.has(card.laceId)) {
      ratesMap.set(card.laceId, new Map());
    }
    ratesMap.get(card.laceId)!.set(card.slabId, Number(card.ratePerMeter));
  }

  // Build lace rows
  const laceRows: LaceRow[] = Array.from(lacesMap.entries()).map(([laceId, lace]) => {
    const rates: Record<string, number | null> = {};
    for (const slab of slabs) {
      const laceRates = ratesMap.get(laceId);
      rates[slab.id] = laceRates?.get(slab.id) ?? null;
    }

    return {
      laceId,
      laceName: lace.laceName,
      laceCode: lace.laceCode,
      width: lace.width ? Number(lace.width) : null,
      composition: lace.composition,
      expectedShrinkagePercent: lace.expectedShrinkagePercent ? Number(lace.expectedShrinkagePercent) : null,
      costPerMeterGreige: lace.costPerMeterGreige ? Number(lace.costPerMeterGreige) : null,
      rates,
    };
  });

  return {
    processor: { id: processor.id, name: processor.name, code: processor.code },
    processingType: 'DYEING',
    slabs: slabs.map((s) => ({
      id: s.id,
      slabLabel:
        s.slabLabel ||
        (s.maxQuantity != null ? `${Number(s.minQuantity)}-${Number(s.maxQuantity)}m` : `${Number(s.minQuantity)}m+`),
      minQuantity: Number(s.minQuantity),
      maxQuantity: Number(s.maxQuantity),
      slabOrder: s.slabOrder,
    })),
    laces: laceRows,
  };
}

/**
 * Save lace rate matrix for a processor
 * Updates/creates rate entries for each lace-slab combination
 */
export async function saveLaceRateMatrix(
  processorId: string,
  rates: LaceRateEntry[],
  userId: string,
  options: { deletedLaceIds?: string[] } = {}
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  // Delete removed lace rows (safe: only the specified lace rates for this processor)
  if (options.deletedLaceIds && options.deletedLaceIds.length > 0) {
    await prisma.processor_rate_card.deleteMany({
      where: {
        processorId,
        processingType: 'DYEING',
        greigeId: null,
        laceId: { in: options.deletedLaceIds },
      },
    });
  }

  // Resolve the frontend's `temp-N` slab placeholders (N is the slabOrder) against EXISTING DYEING
  // slabs. We deliberately do NOT create/prune slabs here: DYEING slabs are SHARED with the greige
  // matrix, and pruning them via updateProcessorSlabs would cascade-delete greige rate rows. New
  // slabs must be added through the greige matrix; a lace rate on a not-yet-created slab is skipped
  // rather than written with an invalid slabId (bug-hunt Part 4 / BH-0322).
  const existingSlabs = await prisma.processor_quantity_slabs.findMany({
    where: { processorId, processingType: 'DYEING', isActive: true },
    select: { id: true, slabOrder: true },
  });
  const slabIdByOrder = new Map(existingSlabs.map((s) => [s.slabOrder, s.id]));

  // Batch-load active lace rows once (one query instead of a findFirst per cell — BH-0312),
  // keyed by `${laceId}|${slabId}`. History-preserving updates still run per changed cell.
  const activeRows = await prisma.processor_rate_card.findMany({
    where: {
      processorId,
      processingType: 'DYEING',
      printingType: null,
      greigeId: null,
      laceId: { not: null },
      effectiveTo: null,
    },
  });
  const activeByCell = new Map<string, (typeof activeRows)[number]>();
  for (const row of activeRows) {
    activeByCell.set(`${row.laceId}|${row.slabId}`, row);
  }

  for (const rate of rates) {
    if (!rate.laceId || !rate.slabId) {
      skipped++;
      continue;
    }

    // Resolve a `temp-N` slabId to the real slab id; skip if that slab isn't persisted yet.
    let actualSlabId = rate.slabId;
    if (rate.slabId.startsWith('temp-')) {
      const order = Number.parseInt(rate.slabId.slice(5), 10);
      const resolved = slabIdByOrder.get(order);
      if (!resolved) {
        skipped++;
        continue;
      }
      actualSlabId = resolved;
    }

    const existing = activeByCell.get(`${rate.laceId}|${actualSlabId}`);
    if (existing) {
      // Skip unchanged cells (avoids a findUnique + no-op transaction per cell — BH-0312)
      // BUG-PRC7 fix: use decimal.js for precise rate comparison
      if (ratesAreEqual(toNumber(existing.ratePerMeter), rate.ratePerMeter)) {
        skipped++;
        continue;
      }
      await updateRateWithHistory(
        existing.id,
        rate.ratePerMeter,
        userId,
        'LACE_RATE_MATRIX_UPDATE',
        'Updated via lace rate matrix save'
      );
    } else {
      await prisma.processor_rate_card.create({
        data: {
          processorId,
          processingType: 'DYEING',
          printingType: null,
          greigeId: null,
          laceId: rate.laceId,
          slabId: actualSlabId,
          ratePerMeter: rate.ratePerMeter,
          createdById: userId,
        },
      });
    }
    saved++;
  }

  return { saved, skipped };
}

/**
 * Add a greige lace to processor's rate card
 * Creates empty rate entries for all slabs
 *
 * NOTE (BUG-PRC5): Same as addGreigeToProcessor - creates placeholder 0-rate entries for UI.
 * See addGreigeToProcessor comment for details on the tradeoff.
 */
export async function addLaceToProcessor(processorId: string, laceId: string, userId: string): Promise<void> {
  // Verify lace exists and is greige
  const lace = await prisma.lace_master.findFirst({
    where: { id: laceId, isGreige: true, isActive: true },
  });

  if (!lace) {
    throw new Error('Greige lace not found or not active');
  }

  // Get slabs for this processor (DYEING type)
  const slabs = await prisma.processor_quantity_slabs.findMany({
    where: { processorId, processingType: 'DYEING', isActive: true },
  });

  // Create rate entries for each slab
  for (const slab of slabs) {
    const existing = await prisma.processor_rate_card.findFirst({
      where: {
        processorId,
        processingType: 'DYEING',
        printingType: null,
        greigeId: null,
        laceId,
        slabId: slab.id,
      },
    });

    if (!existing) {
      await prisma.processor_rate_card.create({
        data: {
          processorId,
          processingType: 'DYEING',
          printingType: null,
          greigeId: null,
          laceId,
          slabId: slab.id,
          ratePerMeter: 0, // Placeholder rate
          createdById: userId,
        },
      });
    }
  }
}

/**
 * Remove a greige lace from processor's rate card
 * Deletes all rate entries for this lace
 */
export async function removeLaceFromProcessor(processorId: string, laceId: string): Promise<void> {
  await prisma.processor_rate_card.deleteMany({
    where: {
      processorId,
      processingType: 'DYEING',
      laceId,
    },
  });
}

/**
 * Lookup dyeing rate for a specific greige lace
 * Finds the applicable slab based on quantity and returns the rate
 */
export interface LaceRateLookupQuery {
  processorId?: string;
  laceId: string;
  quantityMeters: number;
}

export interface LaceRateLookupResult {
  ratePerMeter: number;
  totalCost: number;
  shrinkagePercent: number | null;
  slab: {
    id: string;
    label: string;
    minQuantity: number;
    maxQuantity: number;
  };
  processor: {
    id: string;
    name: string;
  };
  lace: {
    id: string;
    name: string;
    costPerMeterGreige: number | null;
  };
}

export async function lookupLaceRate(query: LaceRateLookupQuery): Promise<LaceRateLookupResult | null> {
  let { processorId, laceId, quantityMeters } = query;

  // If no processorId provided, use SYSTEM_DEFAULT for default rates
  if (!processorId) {
    const systemDefault = await prisma.suppliers.findFirst({
      where: { code: 'SYSTEM_DEFAULT' },
      select: { id: true },
    });
    if (!systemDefault) {
      return null;
    }
    processorId = systemDefault.id;
  }

  // Find the slab that matches the quantity
  let matchingSlab = await prisma.processor_quantity_slabs.findFirst({
    where: {
      processorId,
      processingType: 'DYEING',
      isActive: true,
      minQuantity: { lte: quantityMeters },
      // Half-open range [min, max): max is EXCLUSIVE, so a boundary quantity (e.g. 500m when the
      // slabs are 0-500 and 500-1000) matches exactly ONE slab instead of coin-flipping between two
      // (bug-hunt BH-0329). This matches updateProcessorSlabs' own overlap rule; the `desc` fallback
      // below still catches quantities at or above the top slab.
      maxQuantity: { gt: quantityMeters },
    },
  });

  // If no exact match, use highest slab
  if (!matchingSlab) {
    matchingSlab = await prisma.processor_quantity_slabs.findFirst({
      where: {
        processorId,
        processingType: 'DYEING',
        isActive: true,
      },
      orderBy: { maxQuantity: 'desc' },
    });
  }

  if (!matchingSlab) {
    return null;
  }

  // Find the rate card for this lace and slab
  const rateCard = await prisma.processor_rate_card.findFirst({
    where: {
      processorId,
      processingType: 'DYEING',
      laceId,
      slabId: matchingSlab.id,
      isActive: true,
    },
    include: {
      processor: { select: { id: true, name: true } },
      lace: { select: { id: true, laceName: true, expectedShrinkagePercent: true, costPerMeterGreige: true } },
      slab: { select: { id: true, slabLabel: true, minQuantity: true, maxQuantity: true } },
    },
  });

  if (!rateCard || !rateCard.lace || !rateCard.slab) {
    return null;
  }

  const ratePerMeter = Number(rateCard.ratePerMeter);
  // BUG-PRC7 fix: use decimal.js for precise multiplication
  const totalCost = multiplyCurrency(quantityMeters, ratePerMeter).toDecimalPlaces(2).toNumber();
  // Shrinkage: ONLY from processor rate card (no fallback to lace master)
  const shrinkagePercent = rateCard.shrinkagePercent ? Number(rateCard.shrinkagePercent) : null;

  return {
    ratePerMeter,
    totalCost,
    shrinkagePercent,
    slab: {
      id: rateCard.slab.id,
      label: rateCard.slab.slabLabel || `${Number(rateCard.slab.minQuantity)}-${Number(rateCard.slab.maxQuantity)}m`,
      minQuantity: Number(rateCard.slab.minQuantity),
      maxQuantity: Number(rateCard.slab.maxQuantity),
    },
    processor: {
      id: rateCard.processor.id,
      name: rateCard.processor.name,
    },
    lace: {
      id: rateCard.lace.id,
      name: rateCard.lace.laceName,
      costPerMeterGreige: rateCard.lace.costPerMeterGreige ? Number(rateCard.lace.costPerMeterGreige) : null,
    },
  };
}

/**
 * MRP-48c: find the shrinkage rate card(s) a processor holds for one greige.
 *
 * Shared by MRP planning and cost-sheet creation so both agree on which card applies and neither
 * re-implements the rule. Callers that need a single number must use `unambiguous`: when a
 * processor holds several DIFFERENT shrinkage values for the same greige (dyeing vs the various
 * print types genuinely differ), there is no safe way to pick one from a BOM line — it has no
 * print-type column — so `unambiguous` is null and the caller must fall back and say so.
 */
export async function findRateCardsForShrinkage(
  processorId: string,
  greigeId: string
): Promise<{
  cards: Array<{ id: string; shrinkagePercent: number; processingType: string; printingType: string | null }>;
  distinctPercents: number[];
  unambiguous: { id: string; shrinkagePercent: number } | null;
}> {
  const found = await prisma.processor_rate_card.findMany({
    where: { processorId, greigeId, isActive: true, shrinkagePercent: { not: null } },
    select: { id: true, shrinkagePercent: true, processingType: true, printingType: true },
    orderBy: { effectiveFrom: 'desc' },
  });
  const cards = found.map((c) => ({
    id: c.id,
    shrinkagePercent: Number(c.shrinkagePercent),
    processingType: String(c.processingType),
    printingType: c.printingType ? String(c.printingType) : null,
  }));
  const distinctPercents = [...new Set(cards.map((c) => c.shrinkagePercent))];
  return {
    cards,
    distinctPercents,
    unambiguous: distinctPercents.length === 1 ? { id: cards[0].id, shrinkagePercent: distinctPercents[0] } : null,
  };
}

export default {
  getAllDyeingPrintingProcessors,
  getProcessorRateMatrix,
  getGreigeFabricsForRateCard,
  updateProcessorSlabs,
  saveProcessorRateMatrix,
  copyProcessorRates,
  addGreigeToProcessor,
  removeGreigeFromProcessor,
  lookupRate,
  getProcessorRateCardSummary,
  // Lace rate card functions
  getGreigeLaceForRateCard,
  getLaceProcessorRateMatrix,
  saveLaceRateMatrix,
  addLaceToProcessor,
  removeLaceFromProcessor,
  lookupLaceRate,
  findRateCardsForShrinkage,
};
