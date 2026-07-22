/**
 * Fabric Processing Controller
 *
 * Manages the fabric processing workflow (dyeing, printing, etc.)
 * from sending greige to mills through receiving finished fabric.
 *
 * Key Schema Fields (VERIFIED from schema.prisma lines 2256-2330):
 * - processingStatus (NOT status)
 * - actualQuantityReceived (NOT fabricQuantityReceived)
 * - actualShrinkagePercent (NOT shrinkagePercent)
 * - processingLossMeters (NOT wastagePercent)
 * - finishedFabricId (NOT targetFabricId)
 * - greigeId (links to greige_master)
 * - processorId (links to suppliers)
 *
 * Relations:
 * - greigeMaster (NOT greige)
 * - processor (relation to suppliers)
 * - finishedFabric (relation to fabric_master)
 * - procurement (relation to fabric_procurement)
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import { NotFoundError, UnauthorizedError } from '../errors';
// Body schemas live in ../schemas/fabric-processing.schema and are applied by the
// route via validateBody() — do not re-add controller-local body schemas here.
import type { SendForProcessingInput, ReceiveFinishedFabricInput } from '../schemas/fabric-processing.schema';

/**
 * Validation Schemas
 */

// Schema for listing with filters
const listProcessingSchema = z.object({
  processingStatus: z.enum(['SENT', 'IN_PROCESS', 'COMPLETED', 'REJECTED', 'PARTIAL_COMPLETED']).optional(),
  processorId: z.string().uuid().optional(),
  greigeId: z.string().uuid().optional(),
  procurementId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

/**
 * GET /api/processing
 * List all processing batches with optional filters
 */
export const listProcessingBatches = async (req: Request, res: Response): Promise<void> => {
  const query = listProcessingSchema.parse({
    processingStatus: req.query.processingStatus,
    processorId: req.query.processorId,
    greigeId: req.query.greigeId,
    procurementId: req.query.procurementId,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  });

  const skip = (query.page - 1) * query.limit;

  // Build where clause
  const where: Prisma.fabric_processingWhereInput = {};
  if (query.processingStatus) {
    where.processingStatus = query.processingStatus;
  }
  if (query.processorId) {
    where.processorId = query.processorId;
  }
  if (query.greigeId) {
    where.greigeId = query.greigeId;
  }
  if (query.procurementId) {
    where.procurementId = query.procurementId;
  }

  const [batches, total] = await Promise.all([
    prisma.fabric_processing.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { sentDate: 'desc' },
      include: {
        greigeMaster: true,
        processor: true,
        finishedFabric: true,
        procurement: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.fabric_processing.count({ where }),
  ]);

  res.json({
    success: true,
    data: batches,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
};

/**
 * GET /api/processing/:id
 * Get details of a specific processing batch
 */
export const getProcessingDetails = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const batch = await prisma.fabric_processing.findUnique({
    where: { id },
    include: {
      greigeMaster: true,
      processor: true,
      finishedFabric: true,
      procurement: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!batch) {
    throw new NotFoundError('Processing batch', id);
  }

  res.json({
    success: true,
    data: batch,
  });
};

/**
 * POST /api/processing
 * Send greige fabric for processing
 *
 * Business Rules:
 * - Calculate total finished cost = greige cost + processing cost
 * - Calculate cost per meter based on expected output
 * - Set initial processingStatus to "SENT"
 */
export const sendForProcessing = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new UnauthorizedError();
  }
  const data = req.body as SendForProcessingInput;
  const userId = req.user.id;

  // Calculate total finished cost
  const totalFinishedCost = data.greigeCost + data.processingCost;

  // Calculate expected output quantity (after shrinkage)
  const expectedQuantityAfterShrinkage = data.greigeQuantitySent * (1 - data.expectedShrinkagePercent / 100);

  // Calculate cost per meter
  const costPerMeter = expectedQuantityAfterShrinkage > 0 ? totalFinishedCost / expectedQuantityAfterShrinkage : 0;

  // Create processing batch
  const batch = await prisma.fabric_processing.create({
    data: {
      procurementId: data.procurementId,
      greigeId: data.greigeId,
      processorId: data.processorId,
      processingType: data.processingType,
      greigeQuantitySent: data.greigeQuantitySent,
      greigeWidth: data.greigeWidth,
      expectedFinishedWidthMin: data.expectedFinishedWidthMin,
      expectedFinishedWidthMax: data.expectedFinishedWidthMax,
      expectedShrinkagePercent: data.expectedShrinkagePercent,
      greigeCost: data.greigeCost,
      processingCost: data.processingCost,
      totalFinishedCost,
      costPerMeter,
      sentDate: data.sentDate,
      expectedReturnDate: data.expectedReturnDate ?? null,
      batchNumber: data.batchNumber || null,
      processSpecifications: data.processSpecifications || null,
      processingStatus: 'SENT',
      createdById: userId,
    },
    include: {
      greigeMaster: true,
      processor: true,
      procurement: true,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Greige sent for processing successfully',
    data: batch,
  });
};

/**
 * PUT /api/processing/:id/receive
 * Receive finished fabric from processing mill
 *
 * Business Rules:
 * - Calculate variance metrics (width, shrinkage)
 * - Update processingStatus to COMPLETED
 * - Create fabric stock entry for finished fabric
 * - Calculate mill performance (compare actual vs mill historical avg)
 */
export const receiveFinishedFabric = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const data = req.body as ReceiveFinishedFabricInput;

  // Get the existing batch
  const existingBatch = await prisma.fabric_processing.findUnique({
    where: { id },
    include: { greigeMaster: true },
  });

  if (!existingBatch) {
    throw new NotFoundError('Processing batch', id);
  }

  // Calculate variance metrics
  const expectedAvgWidth =
    (Number(existingBatch.expectedFinishedWidthMin) + Number(existingBatch.expectedFinishedWidthMax)) / 2;
  const widthVarianceInches = data.actualFinishedWidth - expectedAvgWidth;

  const shrinkageVariancePercent = data.actualShrinkagePercent - Number(existingBatch.expectedShrinkagePercent);

  // Calculate mill performance (get historical average)
  const millHistoricalAvg = await prisma.fabric_processing.aggregate({
    where: {
      processorId: existingBatch.processorId,
      greigeId: existingBatch.greigeId,
      processingStatus: 'COMPLETED',
      actualShrinkagePercent: { not: null },
    },
    _avg: {
      actualShrinkagePercent: true,
    },
  });

  const millAvgShrinkage = millHistoricalAvg._avg.actualShrinkagePercent
    ? Number(millHistoricalAvg._avg.actualShrinkagePercent)
    : null;

  const varianceFromMillAvg = millAvgShrinkage !== null ? data.actualShrinkagePercent - millAvgShrinkage : null;

  // Recalculate cost per meter based on actual quantity
  const updatedCostPerMeter =
    data.actualQuantityReceived > 0
      ? Number(existingBatch.totalFinishedCost) / data.actualQuantityReceived
      : Number(existingBatch.costPerMeter);

  // Update processing batch
  const updatedBatch = await prisma.fabric_processing.update({
    where: { id },
    data: {
      actualFinishedWidth: data.actualFinishedWidth,
      actualQuantityReceived: data.actualQuantityReceived,
      actualShrinkagePercent: data.actualShrinkagePercent,
      processingLossMeters: data.processingLossMeters,
      widthVarianceInches,
      shrinkageVariancePercent,
      millAvgShrinkage,
      varianceFromMillAvg,
      costPerMeter: updatedCostPerMeter,
      finishedFabricId: data.finishedFabricId,
      actualReturnDate: data.actualReturnDate,
      qualityNotes: data.qualityNotes || null,
      processingStatus: 'COMPLETED',
    },
    include: {
      greigeMaster: true,
      processor: true,
      finishedFabric: true,
      procurement: true,
    },
  });

  res.json({
    success: true,
    message: 'Finished fabric received successfully',
    data: updatedBatch,
    metrics: {
      widthVarianceInches,
      shrinkageVariancePercent,
      millAvgShrinkage,
      varianceFromMillAvg,
      costPerMeter: updatedCostPerMeter,
    },
  });
};

/**
 * GET /api/processing/mill-performance
 * Get mill performance analytics
 *
 * Aggregates data by processing mill to analyze:
 * - Average shrinkage percentage
 * - Average processing loss
 * - Average delivery time
 * - Total batches processed
 */
export const getMillPerformance = async (req: Request, res: Response): Promise<void> => {
  // Get all completed processing batches grouped by mill
  const batches = await prisma.fabric_processing.findMany({
    where: {
      processingStatus: 'COMPLETED',
      actualShrinkagePercent: { not: null },
    },
    include: {
      processor: true,
    },
  });

  // Group by mill and calculate metrics
  const millPerformanceMap = new Map<string, any>();

  for (const batch of batches) {
    const millId = batch.processorId;

    if (!millPerformanceMap.has(millId)) {
      millPerformanceMap.set(millId, {
        mill: batch.processor,
        totalBatches: 0,
        totalShrinkage: 0,
        totalLoss: 0,
        totalDeliveryTime: 0,
        batchesWithDeliveryTime: 0,
      });
    }

    const millData = millPerformanceMap.get(millId);
    millData.totalBatches += 1;
    millData.totalShrinkage += Number(batch.actualShrinkagePercent || 0);
    millData.totalLoss += Number(batch.processingLossMeters || 0);

    // Calculate delivery time if both dates exist
    if (batch.sentDate && batch.actualReturnDate) {
      const deliveryTime =
        (new Date(batch.actualReturnDate).getTime() - new Date(batch.sentDate).getTime()) / (1000 * 60 * 60 * 24); // Convert to days
      millData.totalDeliveryTime += deliveryTime;
      millData.batchesWithDeliveryTime += 1;
    }
  }

  // Calculate averages
  const millPerformance = Array.from(millPerformanceMap.values()).map((data) => ({
    mill: {
      id: data.mill.id,
      name: data.mill.name,
      code: data.mill.code,
    },
    totalBatches: data.totalBatches,
    averageShrinkagePercent: data.totalBatches > 0 ? (data.totalShrinkage / data.totalBatches).toFixed(2) : '0.00',
    averageLossMeters: data.totalBatches > 0 ? (data.totalLoss / data.totalBatches).toFixed(2) : '0.00',
    averageDeliveryDays:
      data.batchesWithDeliveryTime > 0 ? (data.totalDeliveryTime / data.batchesWithDeliveryTime).toFixed(1) : null,
  }));

  // Sort by total batches (most active mills first)
  millPerformance.sort((a, b) => b.totalBatches - a.totalBatches);

  res.json({
    success: true,
    data: millPerformance,
    summary: {
      totalMills: millPerformance.length,
      totalBatchesAnalyzed: batches.length,
    },
  });
};
