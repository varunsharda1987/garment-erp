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

import { PrismaClient, Prisma, PrintingType } from '@prisma/client';
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

const prisma = new PrismaClient();

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
          genericFabricName: true,
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
      // Shrinkage fallback: Use rate card shrinkage if set, otherwise fall back to greige master average
      const shrinkagePercent = rc.shrinkagePercent
        ? Number(rc.shrinkagePercent)
        : (rc.greige.averageShrinkagePercent ? Number(rc.greige.averageShrinkagePercent) : null);

      greigeMap.set(greigeId, {
        id: rc.greige.id,
        greigeCode: rc.greige.greigeCode,
        greigeName: rc.greige.greigeName,
        genericFabricName: rc.greige.genericFabricName || '',
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
      slabLabel: s.slabLabel || `${Number(s.minQuantity)}-${Number(s.maxQuantity)}m`,
      isActive: s.isActive,
    })),
    greiges: Array.from(greigeMap.values()).sort((a, b) => {
      // Sort by genericFabricName then by greigeName
      const cmp = a.genericFabricName.localeCompare(b.genericFabricName);
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
      genericFabricName: true,
      composition: true,
      greigeWidth: true,
      averageShrinkagePercent: true,
    },
    orderBy: [{ genericFabricName: 'asc' }, { greigeName: 'asc' }],
  });

  return greiges.map((g) => ({
    id: g.id,
    greigeCode: g.greigeCode,
    greigeName: g.greigeName,
    genericFabricName: g.genericFabricName || '',
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
      // Upsert rate - handle PRINTING (with printingType) vs DYEING (null printingType) differently
      // Prisma's compound unique constraint doesn't allow null values in the unique lookup
      if (processingType === 'PRINTING' && printingType) {
        // For PRINTING, use the compound unique constraint
        await prisma.processor_rate_card.upsert({
          where: {
            unique_rate_card_v2: {
              processorId,
              processingType,
              printingType: printingType as PrintingType,
              greigeId: rate.greigeId,
              slabId: actualSlabId,
            },
          },
          update: {
            ratePerMeter: rate.ratePerMeter,
          },
          create: {
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
        // For DYEING (printingType is null), use findFirst + create/update pattern
        const existing = await prisma.processor_rate_card.findFirst({
          where: {
            processorId,
            processingType,
            printingType: null,
            greigeId: rate.greigeId,
            slabId: actualSlabId,
          },
        });

        if (existing) {
          await prisma.processor_rate_card.update({
            where: { id: existing.id },
            data: { ratePerMeter: rate.ratePerMeter },
          });
        } else {
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
  }

  // Save shrinkage entries (shrinkage is stored per greige, shared across slabs)
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

      // Check if any rate cards exist for this greige
      const existingRates = await prisma.processor_rate_card.findMany({
        where: shrinkageFilter,
      });

      if (existingRates.length > 0) {
        // Update existing rate cards
        await prisma.processor_rate_card.updateMany({
          where: shrinkageFilter,
          data: { shrinkagePercent: shrinkage.shrinkagePercent },
        });
      } else {
        // No rate cards exist yet - create placeholder rate cards for each slab with null rates
        // This ensures shrinkage is saved even without rate values
        for (const slab of slabs) {
          const createData: any = {
            processor: { connect: { id: processorId } },
            processingType,
            greige: { connect: { id: shrinkage.greigeId } },
            slab: { connect: { id: slab.id } },
            ratePerMeter: 0, // Placeholder rate - required field
            shrinkagePercent: shrinkage.shrinkagePercent,
            createdBy: { connect: { id: userId } },
          };

          if (processingType === 'PRINTING' && printingType) {
            createData.printingType = printingType as PrintingType;
          } else {
            createData.printingType = null;
          }

          // Check if this specific rate card already exists before creating
          const whereClause: any = {
            processorId,
            processingType,
            greigeId: shrinkage.greigeId,
            slabId: slab.id,
          };
          if (processingType === 'PRINTING' && printingType) {
            whereClause.printingType = printingType;
          } else {
            whereClause.printingType = null;
          }

          const existingCard = await prisma.processor_rate_card.findFirst({
            where: whereClause,
          });

          if (!existingCard) {
            await prisma.processor_rate_card.create({ data: createData });
          }
        }
      }
    }
  }
}

/**
 * Copy rate structure from source processor to target processor
 * For PRINTING, printingType determines which printing sub-type's rates to copy
 */
export async function copyProcessorRates(
  input: CopyRatesInput,
  userId: string
): Promise<void> {
  const { sourceProcessorId, targetProcessorId, processingType, printingType, copySlabs, copyRates: copyRatesFlag } = input;

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
      // For PRINTING, use the compound unique constraint
      await prisma.processor_rate_card.upsert({
        where: {
          unique_rate_card_v2: {
            processorId,
            processingType,
            printingType: printingType as PrintingType,
            greigeId,
            slabId: slab.id,
          },
        },
        update: {},
        create: {
          processorId,
          processingType,
          printingType: printingType as PrintingType,
          greigeId,
          slabId: slab.id,
          ratePerMeter: 0, // Placeholder rate
          createdById: userId,
        },
      });
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
  const matchingSlab = await prisma.processor_quantity_slabs.findFirst({
    where: {
      processorId,
      processingType,
      isActive: true,
      minQuantity: { lte: quantityMeters },
      maxQuantity: { gte: quantityMeters },
    },
  });

  if (!matchingSlab) {
    return null;
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
  const totalCost = quantityMeters * ratePerMeter;

  // Shrinkage Priority Logic (as per user requirements):
  // 1. If processor rate card has shrinkagePercent → use it (processor-specific shrinkage)
  // 2. Otherwise, fall back to greige_master.averageShrinkagePercent (default greige shrinkage)
  // 3. If neither exists → return null
  const shrinkagePercent = rateCard.shrinkagePercent
    ? Number(rateCard.shrinkagePercent)
    : (rateCard.greige.averageShrinkagePercent ? Number(rateCard.greige.averageShrinkagePercent) : null);

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
  const [
    processors,
    slabCounts,
    rateStats,
    greigeCounts,
    slabDetails,
    lastUpdated,
    totalGreigeCount,
  ] = await Promise.all([
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
  function determineStatus(dyeing: ProcessorTypeStats, printing: ProcessorTypeStats): 'NOT_CONFIGURED' | 'PARTIAL' | 'COMPLETE' {
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

    const averageCoverage = processorsConfigured > 0
      ? Math.round(coverageSum / processorsConfigured)
      : 0;

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
};
