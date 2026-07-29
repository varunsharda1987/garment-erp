// Processing Stage Service - Manage individual processing stages within batches
import logger from '../utils/logger';
import { Prisma, ProductionStage } from '@prisma/client';
import prisma from '../config/database';
import { randomUUID } from 'crypto';

export interface CreateProcessingStageDTO {
  batchId: string;
  stageNumber: number;
  processorId: string;
  processorFacility?: string;
  processingType: string;
  quantitySent: number;
  quantityInProcess: number;
  processSpecifications?: string;
  expectedOutputSpecs?: any;
  processingCost: number;
  sentDate?: Date;
  expectedCompletionDate?: Date;
}

export interface UpdateProcessingStageDTO {
  quantityReceived?: number;
  quantityInProcess?: number;
  actualOutputSpecs?: any;
  status?: string;
  actualCompletionDate?: Date;
  processingCost?: number;
  qualityNotes?: string;
  reworkReason?: string;
}

export interface ProcessingStageFilters {
  batchId?: string;
  processorId?: string;
  status?: string;
  processingType?: string;
}

class ProcessingStageService {
  /**
   * Create a new processing stage
   */
  async createStage(data: CreateProcessingStageDTO) {
    // Validate batch exists
    const batch = await prisma.processing_batch.findUnique({
      where: { id: data.batchId },
    });
    if (!batch) {
      throw new Error('Processing batch not found');
    }

    // Validate processor exists
    const processor = await prisma.suppliers.findUnique({
      where: { id: data.processorId },
    });
    if (!processor) {
      throw new Error('Processor not found');
    }

    const stage = await prisma.processing_stage.create({
      data: {
        batchId: data.batchId,
        stageNumber: data.stageNumber,
        processorId: data.processorId,
        processorFacility: data.processorFacility,
        processingType: data.processingType,
        quantitySent: data.quantitySent,
        quantityInProcess: data.quantityInProcess,
        processSpecifications: data.processSpecifications,
        expectedOutputSpecs: data.expectedOutputSpecs,
        processingCost: data.processingCost,
        sentDate: data.sentDate,
        expectedCompletionDate: data.expectedCompletionDate,
      },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
            workOrderId: true,
            createdById: true,
          },
        },
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    // Auto-update production_tracking if batch is linked to a work order
    if (batch.workOrderId) {
      const processingTypeUpper = data.processingType.toUpperCase();
      const productionStage: ProductionStage | null =
        processingTypeUpper === 'DYEING' ? 'IN_DYING' : processingTypeUpper === 'PRINTING' ? 'IN_PRINTING' : null;

      if (productionStage) {
        try {
          await prisma.production_tracking.create({
            data: {
              id: randomUUID(),
              workOrderId: batch.workOrderId,
              productionStage,
              quantityCompleted: Math.round(data.quantitySent),
              updatedById: batch.createdById,
              updateDate: new Date(),
            },
          });
        } catch (err) {
          // allow-swallow — pure timeline production_tracking entry; must not fail the created processing stage
          logger.error('Failed to create production_tracking for processing stage:', err);
        }
      }
    }

    return stage;
  }

  /**
   * Get stage by ID with full details
   */
  async getStageById(id: string) {
    const stage = await prisma.processing_stage.findUnique({
      where: { id },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
            greigeId: true,
            fabricId: true,
          },
        },
        movements: {
          include: {
            performedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            dispatchDate: 'desc',
          },
        },
        deliveries: {
          include: {
            receivedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            deliveryDate: 'desc',
          },
        },
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    if (!stage) {
      throw new Error('Processing stage not found');
    }

    return stage;
  }

  /**
   * Get all stages with filters
   */
  async getAllStages(filters?: ProcessingStageFilters) {
    const where: Prisma.processing_stageWhereInput = {};

    if (filters?.batchId) {
      where.batchId = filters.batchId;
    }

    if (filters?.processorId) {
      where.processorId = filters.processorId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.processingType) {
      where.processingType = filters.processingType;
    }

    const stages = await prisma.processing_stage.findMany({
      where,
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
      orderBy: [
        {
          batchId: 'desc',
        },
        {
          stageNumber: 'asc',
        },
      ],
    });

    return stages;
  }

  /**
   * Get stages by batch ID
   */
  async getStagesByBatch(batchId: string) {
    const stages = await prisma.processing_stage.findMany({
      where: { batchId },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
      orderBy: {
        stageNumber: 'asc',
      },
    });

    return stages;
  }

  /**
   * Get stages by processor
   */
  async getStagesByProcessor(processorId: string) {
    const stages = await prisma.processing_stage.findMany({
      where: {
        processorId,
        status: {
          in: ['AT_PROCESSOR', 'IN_PROCESS', 'IN_TRANSIT_TO_PROCESSOR'],
        },
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
      orderBy: {
        sentDate: 'desc',
      },
    });

    return stages;
  }

  /**
   * Update stage
   */
  async updateStage(id: string, data: UpdateProcessingStageDTO) {
    const stage = await prisma.processing_stage.update({
      where: { id },
      data,
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    return stage;
  }

  /**
   * Update stage status
   */
  async updateStageStatus(id: string, status: string) {
    const validStatuses = [
      'PENDING',
      'IN_TRANSIT_TO_PROCESSOR',
      'AT_PROCESSOR',
      'IN_PROCESS',
      'IN_TRANSIT_TO_COMPANY',
      'COMPLETED',
      'REWORK_REQUIRED',
    ];

    if (!validStatuses.includes(status)) {
      throw new Error('Invalid stage status');
    }

    const stage = await prisma.processing_stage.update({
      where: { id },
      data: { status },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
          },
        },
      },
    });

    return stage;
  }

  /**
   * Mark stage as completed
   */
  async completeStage(id: string) {
    const stage = await prisma.processing_stage.findUnique({
      where: { id },
      select: {
        quantitySent: true,
        quantityReceived: true,
      },
    });

    if (!stage) {
      throw new Error('Processing stage not found');
    }

    // Check if all quantity has been received
    if (stage.quantityReceived < stage.quantitySent) {
      throw new Error('Cannot complete stage: Not all quantity has been received');
    }

    const updatedStage = await prisma.processing_stage.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualCompletionDate: new Date(),
      },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
          },
        },
      },
    });

    return updatedStage;
  }

  /**
   * Mark stage for rework
   */
  async markForRework(id: string, reason: string, reworkQuantity?: number) {
    const stage = await prisma.processing_stage.update({
      where: { id },
      data: {
        status: 'REWORK_REQUIRED',
        reworkReason: reason,
        // How much is going back for rework — previously not captured at all.
        ...(reworkQuantity !== undefined && reworkQuantity !== null ? { reworkQuantity } : {}),
      },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
          },
        },
      },
    });

    return stage;
  }

  /**
   * Get stage summary by processor
   */
  async getProcessorSummary(processorId: string) {
    const activeStages = await prisma.processing_stage.findMany({
      where: {
        processorId,
        status: {
          in: ['AT_PROCESSOR', 'IN_PROCESS', 'IN_TRANSIT_TO_PROCESSOR'],
        },
      },
      select: {
        quantityInProcess: true,
        processingCost: true,
        processingType: true,
      },
    });

    const summary = activeStages.reduce(
      (acc, stage) => {
        acc.totalQuantity += Number(stage.quantityInProcess);
        acc.totalCost += Number(stage.processingCost);

        // Count by processing type
        if (!acc.byType[stage.processingType]) {
          acc.byType[stage.processingType] = {
            quantity: 0,
            cost: 0,
            count: 0,
          };
        }
        acc.byType[stage.processingType].quantity += Number(stage.quantityInProcess);
        acc.byType[stage.processingType].cost += Number(stage.processingCost);
        acc.byType[stage.processingType].count += 1;

        return acc;
      },
      {
        totalStages: activeStages.length,
        totalQuantity: 0,
        totalCost: 0,
        byType: {} as Record<string, { quantity: number; cost: number; count: number }>,
      }
    );

    return summary;
  }

  /**
   * Delete stage (only if no movements or deliveries)
   */
  async deleteStage(id: string) {
    const stage = await prisma.processing_stage.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    if (!stage) {
      throw new Error('Processing stage not found');
    }

    if (stage._count.movements > 0 || stage._count.deliveries > 0) {
      throw new Error('Cannot delete stage: Has associated movements or deliveries');
    }

    await prisma.processing_stage.delete({
      where: { id },
    });

    return { success: true, message: 'Stage deleted successfully' };
  }
}

export const processingStageService = new ProcessingStageService();
export default processingStageService;
