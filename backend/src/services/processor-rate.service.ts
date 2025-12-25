/**
 * Processor Rate Service
 *
 * Handles processor rate card lookups with quantity slab pricing
 * Finds the best rate for given processing requirements
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProcessorRateQuery {
  processorId?: string;
  processingType: string; // DYEING, PRINTING, WASHING, FINISHING, EMBROIDERY
  fabricCategory: string; // COTTON, POLYESTER, SILK, BLEND, etc.
  quantityMeters: number;
  genericFabricName?: string;
}

export interface ProcessorRateResult {
  id: string;
  processorId: string;
  processorName: string;
  processingType: string;
  fabricCategory: string;
  genericFabricName: string | null;
  minQuantityMeters: number;
  maxQuantityMeters: number;
  ratePerMeter: number;
  setupCharge: number | null;
  minimumCharge: number | null;
  turnaroundDays: number | null;
  conditions: string | null;
  priority: number;
  totalCost: number; // Calculated: (quantityMeters * ratePerMeter) + setupCharge
  effectiveCostPerMeter: number; // Calculated: totalCost / quantityMeters
}

/**
 * Get processor rate for specific query
 * Returns the best matching rate based on quantity and priority
 */
export async function getProcessorRate(
  query: ProcessorRateQuery
): Promise<ProcessorRateResult | null> {
  const { processorId, processingType, fabricCategory, quantityMeters, genericFabricName } = query;

  // Build where clause
  const whereClause: Prisma.processor_rate_cardWhereInput = {
    processingType,
    fabricCategory,
    isActive: true,
    effectiveFrom: { lte: new Date() },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    minQuantityMeters: { lte: quantityMeters },
    maxQuantityMeters: { gte: quantityMeters },
  };

  if (processorId) {
    whereClause.processorId = processorId;
  }

  // Try to match with genericFabricName first (more specific)
  if (genericFabricName) {
    const specificMatch = await prisma.processor_rate_card.findFirst({
      where: {
        ...whereClause,
        genericFabricName: { equals: genericFabricName, mode: 'insensitive' },
      },
      orderBy: [{ priority: 'desc' }, { ratePerMeter: 'asc' }],
      include: {
        processor: {
          select: { id: true, name: true },
        },
      },
    });

    if (specificMatch) {
      return formatRateResult(specificMatch, quantityMeters);
    }
  }

  // Fallback to fabric category only
  const genericMatch = await prisma.processor_rate_card.findFirst({
    where: {
      ...whereClause,
      genericFabricName: null, // Generic rates (not fabric-specific)
    },
    orderBy: [{ priority: 'desc' }, { ratePerMeter: 'asc' }],
    include: {
      processor: {
        select: { id: true, name: true },
      },
    },
  });

  if (genericMatch) {
    return formatRateResult(genericMatch, quantityMeters);
  }

  return null;
}

/**
 * Search rate cards with filters
 */
export async function searchRateCards(filters: {
  processorId?: string;
  processingType?: string;
  fabricCategory?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  data: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { processorId, processingType, fabricCategory, isActive = true, page = 1, limit = 50 } = filters;

  const whereClause: Prisma.processor_rate_cardWhereInput = { isActive };

  if (processorId) whereClause.processorId = processorId;
  if (processingType) whereClause.processingType = processingType;
  if (fabricCategory) whereClause.fabricCategory = fabricCategory;

  const [total, rateCards] = await Promise.all([
    prisma.processor_rate_card.count({ where: whereClause }),
    prisma.processor_rate_card.findMany({
      where: whereClause,
      include: {
        processor: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [
        { processingType: 'asc' },
        { fabricCategory: 'asc' },
        { minQuantityMeters: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: rateCards,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Create a new rate card
 */
export async function createRateCard(
  data: {
    processorId: string;
    processingType: string;
    fabricCategory: string;
    genericFabricName?: string;
    minQuantityMeters: number;
    maxQuantityMeters: number;
    ratePerMeter: number;
    setupCharge?: number;
    minimumCharge?: number;
    turnaroundDays?: number;
    conditions?: string;
    priority?: number;
    effectiveFrom?: Date;
    effectiveTo?: Date;
  },
  createdById: string
) {
  return await prisma.processor_rate_card.create({
    data: {
      ...data,
      priority: data.priority || 0,
      isActive: true,
      createdById,
    },
    include: {
      processor: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

/**
 * Update rate card (creates new version with effectiveFrom)
 */
export async function updateRateCard(
  id: string,
  data: Partial<{
    ratePerMeter: number;
    setupCharge: number;
    minimumCharge: number;
    turnaroundDays: number;
    conditions: string;
    priority: number;
    effectiveTo: Date;
    isActive: boolean;
  }>
) {
  return await prisma.processor_rate_card.update({
    where: { id },
    data,
    include: {
      processor: {
        select: { id: true, name: true, code: true },
      },
    },
  });
}

/**
 * Get all available processors for a processing type
 */
export async function getProcessorsForType(processingType: string) {
  // Get processors that have rate cards for this processing type
  const rateCards = await prisma.processor_rate_card.findMany({
    where: {
      processingType,
      isActive: true,
    },
    distinct: ['processorId'],
    include: {
      processor: {
        select: {
          id: true,
          name: true,
          code: true,
          rating: true,
        },
      },
    },
  });

  return rateCards.map((rc) => rc.processor);
}

/**
 * Get rate preview for a processor (all quantity slabs)
 */
export async function getRatePreview(
  processorId: string,
  processingType: string,
  fabricCategory: string
): Promise<ProcessorRateResult[]> {
  const rateCards = await prisma.processor_rate_card.findMany({
    where: {
      processorId,
      processingType,
      fabricCategory,
      isActive: true,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: {
      processor: {
        select: { id: true, name: true },
      },
    },
    orderBy: { minQuantityMeters: 'asc' },
  });

  // Use midpoint of each slab for cost calculation
  return rateCards.map((rc) => {
    const midpoint = Number((rc.minQuantityMeters + rc.maxQuantityMeters) / BigInt(2));
    return formatRateResult(rc, midpoint);
  });
}

/**
 * Format rate card result with calculated costs
 */
function formatRateResult(
  rateCard: any,
  quantityMeters: number
): ProcessorRateResult {
  const ratePerMeter = Number(rateCard.ratePerMeter);
  const setupCharge = rateCard.setupCharge ? Number(rateCard.setupCharge) : 0;
  const minimumCharge = rateCard.minimumCharge ? Number(rateCard.minimumCharge) : 0;

  const baseCost = quantityMeters * ratePerMeter + setupCharge;
  const totalCost = Math.max(baseCost, minimumCharge);
  const effectiveCostPerMeter = totalCost / quantityMeters;

  return {
    id: rateCard.id,
    processorId: rateCard.processorId,
    processorName: rateCard.processor.name,
    processingType: rateCard.processingType,
    fabricCategory: rateCard.fabricCategory,
    genericFabricName: rateCard.genericFabricName,
    minQuantityMeters: Number(rateCard.minQuantityMeters),
    maxQuantityMeters: Number(rateCard.maxQuantityMeters),
    ratePerMeter,
    setupCharge: rateCard.setupCharge ? Number(rateCard.setupCharge) : null,
    minimumCharge: rateCard.minimumCharge ? Number(rateCard.minimumCharge) : null,
    turnaroundDays: rateCard.turnaroundDays,
    conditions: rateCard.conditions,
    priority: rateCard.priority,
    totalCost,
    effectiveCostPerMeter,
  };
}

export default {
  getProcessorRate,
  searchRateCards,
  createRateCard,
  updateRateCard,
  getProcessorsForType,
  getRatePreview,
};
