// Processing Movement Service - Track material movements and transit
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateProcessingMovementDTO {
  batchId: string;
  stageId?: string;
  movementType: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  vehicleNumber?: string;
  driverName?: string;
  lrNumber?: string;
  dispatchDate: Date;
  expectedDeliveryDate?: Date;
  challanNumber?: string;
  documents?: any;
  performedById: string;
}

export interface UpdateProcessingMovementDTO {
  status?: string;
  actualDeliveryDate?: Date;
  vehicleNumber?: string;
  driverName?: string;
  lrNumber?: string;
  challanNumber?: string;
  documents?: any;
}

export interface ProcessingMovementFilters {
  batchId?: string;
  stageId?: string;
  status?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
}

class ProcessingMovementService {
  /**
   * Create a new processing movement
   */
  async createMovement(data: CreateProcessingMovementDTO) {
    // Validate batch exists
    const batch = await prisma.processing_batch.findUnique({
      where: { id: data.batchId },
    });
    if (!batch) {
      throw new Error('Processing batch not found');
    }

    // Validate stage if provided
    if (data.stageId) {
      const stage = await prisma.processing_stage.findUnique({
        where: { id: data.stageId },
      });
      if (!stage) {
        throw new Error('Processing stage not found');
      }
    }

    const movement = await prisma.processing_movement.create({
      data: {
        batchId: data.batchId,
        stageId: data.stageId,
        movementType: data.movementType,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        quantity: data.quantity,
        vehicleNumber: data.vehicleNumber,
        driverName: data.driverName,
        lrNumber: data.lrNumber,
        dispatchDate: data.dispatchDate,
        expectedDeliveryDate: data.expectedDeliveryDate,
        challanNumber: data.challanNumber,
        documents: data.documents,
        performedById: data.performedById,
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return movement;
  }

  /**
   * Get movement by ID
   */
  async getMovementById(id: string) {
    const movement = await prisma.processing_movement.findUnique({
      where: { id },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
            greigeId: true,
            fabricId: true,
          },
        },
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                phone: true,
              },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!movement) {
      throw new Error('Processing movement not found');
    }

    return movement;
  }

  /**
   * Get all movements with filters
   */
  async getAllMovements(filters?: ProcessingMovementFilters) {
    const where: Prisma.processing_movementWhereInput = {};

    if (filters?.batchId) {
      where.batchId = filters.batchId;
    }

    if (filters?.stageId) {
      where.stageId = filters.stageId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.movementType) {
      where.movementType = filters.movementType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.dispatchDate = {};
      if (filters.startDate) {
        where.dispatchDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.dispatchDate.lte = new Date(filters.endDate);
      }
    }

    const movements = await prisma.processing_movement.findMany({
      where,
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
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
    });

    return movements;
  }

  /**
   * Get movements by batch
   */
  async getMovementsByBatch(batchId: string) {
    const movements = await prisma.processing_movement.findMany({
      where: { batchId },
      include: {
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
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
    });

    return movements;
  }

  /**
   * Get movements by stage
   */
  async getMovementsByStage(stageId: string) {
    const movements = await prisma.processing_movement.findMany({
      where: { stageId },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
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
    });

    return movements;
  }

  /**
   * Get in-transit movements
   */
  async getInTransitMovements() {
    const movements = await prisma.processing_movement.findMany({
      where: {
        status: 'IN_TRANSIT',
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        dispatchDate: 'asc',
      },
    });

    return movements;
  }

  /**
   * Update movement
   */
  async updateMovement(id: string, data: UpdateProcessingMovementDTO) {
    const movement = await prisma.processing_movement.update({
      where: { id },
      data,
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
          },
        },
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return movement;
  }

  /**
   * Mark movement as delivered
   */
  async markAsDelivered(id: string) {
    const movement = await prisma.processing_movement.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        actualDeliveryDate: new Date(),
      },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
          },
        },
        stage: {
          select: {
            id: true,
            stageNumber: true,
            processingType: true,
          },
        },
      },
    });

    return movement;
  }

  /**
   * Get transit summary
   */
  async getTransitSummary() {
    const inTransit = await prisma.processing_movement.findMany({
      where: {
        status: 'IN_TRANSIT',
      },
      select: {
        quantity: true,
        dispatchDate: true,
        expectedDeliveryDate: true,
        movementType: true,
      },
    });

    const summary = inTransit.reduce(
      (acc, movement) => {
        acc.totalQuantity += Number(movement.quantity);

        // Count by movement type
        if (!acc.byType[movement.movementType]) {
          acc.byType[movement.movementType] = {
            quantity: 0,
            count: 0,
          };
        }
        acc.byType[movement.movementType].quantity += Number(movement.quantity);
        acc.byType[movement.movementType].count += 1;

        // Calculate days in transit
        const now = new Date();
        const daysInTransit = Math.floor(
          (now.getTime() - new Date(movement.dispatchDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        // Check if delayed
        if (
          movement.expectedDeliveryDate &&
          now > new Date(movement.expectedDeliveryDate)
        ) {
          acc.delayedCount += 1;
        }

        // Track max days in transit
        if (daysInTransit > acc.maxDaysInTransit) {
          acc.maxDaysInTransit = daysInTransit;
        }

        return acc;
      },
      {
        totalMovements: inTransit.length,
        totalQuantity: 0,
        delayedCount: 0,
        maxDaysInTransit: 0,
        byType: {} as Record<string, { quantity: number; count: number }>,
      }
    );

    return summary;
  }

  /**
   * Delete movement
   */
  async deleteMovement(id: string) {
    const movement = await prisma.processing_movement.findUnique({
      where: { id },
      select: {
        status: true,
      },
    });

    if (!movement) {
      throw new Error('Processing movement not found');
    }

    if (movement.status === 'DELIVERED') {
      throw new Error('Cannot delete delivered movement');
    }

    await prisma.processing_movement.delete({
      where: { id },
    });

    return { success: true, message: 'Movement deleted successfully' };
  }
}

export const processingMovementService = new ProcessingMovementService();
export default processingMovementService;
