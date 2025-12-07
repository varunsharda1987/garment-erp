// Processing Batch Service - Manage job work processing batches
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateProcessingBatchDTO {
  materialType: 'GREIGE' | 'FABRIC';
  greigeId?: string;
  fabricId?: string;
  totalQuantitySent: number;
  quantityInProcess: number;
  createdById: string;
}

export interface UpdateProcessingBatchDTO {
  totalQuantityReceived?: number;
  quantityInProcess?: number;
  quantityInTransit?: number;
  quantityRejected?: number;
  overallStatus?: string;
  totalCostIncurred?: number;
}

export interface ProcessingBatchFilters {
  overallStatus?: string;
  materialType?: 'GREIGE' | 'FABRIC';
  greigeId?: string;
  fabricId?: string;
  search?: string; // Search by batch number
}

class ProcessingBatchService {
  /**
   * Generate unique batch number
   */
  async generateBatchNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Get the latest batch for this month
    const latestBatch = await prisma.processing_batch.findFirst({
      where: {
        batchNumber: {
          startsWith: `PB${year}${month}`,
        },
      },
      orderBy: {
        batchNumber: 'desc',
      },
    });

    let sequence = 1;
    if (latestBatch) {
      const lastSequence = parseInt(latestBatch.batchNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `PB${year}${month}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new processing batch
   */
  async createBatch(data: CreateProcessingBatchDTO) {
    // Validate material exists
    if (data.materialType === 'GREIGE' && data.greigeId) {
      const greige = await prisma.greige_master.findUnique({
        where: { id: data.greigeId },
      });
      if (!greige) {
        throw new Error('Greige not found');
      }
    } else if (data.materialType === 'FABRIC' && data.fabricId) {
      const fabric = await prisma.fabric_master.findUnique({
        where: { id: data.fabricId },
      });
      if (!fabric) {
        throw new Error('Fabric not found');
      }
    }

    const batchNumber = await this.generateBatchNumber();

    const batch = await prisma.processing_batch.create({
      data: {
        batchNumber,
        materialType: data.materialType,
        greigeId: data.greigeId,
        fabricId: data.fabricId,
        totalQuantitySent: data.totalQuantitySent,
        quantityInProcess: data.quantityInProcess,
        createdById: data.createdById,
      },
      include: {
        greigeMaster: {
          select: {
            id: true,
            greigeCode: true,
            greigeName: true,
          },
        },
        fabricMaster: {
          select: {
            id: true,
            fabricCode: true,
            fabricName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            stages: true,
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    return batch;
  }

  /**
   * Get batch by ID with full details
   */
  async getBatchById(id: string) {
    const batch = await prisma.processing_batch.findUnique({
      where: { id },
      include: {
        greigeMaster: {
          select: {
            id: true,
            greigeCode: true,
            greigeName: true,
          },
        },
        fabricMaster: {
          select: {
            id: true,
            fabricCode: true,
            fabricName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        stages: {
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
        },
        movements: {
          include: {
            stage: {
              select: {
                id: true,
                stageNumber: true,
                processingType: true,
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
        },
        deliveries: {
          include: {
            stage: {
              select: {
                id: true,
                stageNumber: true,
                processingType: true,
              },
            },
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
            stages: true,
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Processing batch not found');
    }

    return batch;
  }

  /**
   * Get all batches with filters
   */
  async getAllBatches(filters?: ProcessingBatchFilters) {
    const where: Prisma.processing_batchWhereInput = {};

    if (filters?.overallStatus) {
      where.overallStatus = filters.overallStatus;
    }

    if (filters?.materialType) {
      where.materialType = filters.materialType;
    }

    if (filters?.greigeId) {
      where.greigeId = filters.greigeId;
    }

    if (filters?.fabricId) {
      where.fabricId = filters.fabricId;
    }

    if (filters?.search) {
      where.batchNumber = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    const batches = await prisma.processing_batch.findMany({
      where,
      include: {
        greigeMaster: {
          select: {
            id: true,
            greigeCode: true,
            greigeName: true,
          },
        },
        fabricMaster: {
          select: {
            id: true,
            fabricCode: true,
            fabricName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            stages: true,
            movements: true,
            deliveries: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return batches;
  }

  /**
   * Update batch
   */
  async updateBatch(id: string, data: UpdateProcessingBatchDTO) {
    const batch = await prisma.processing_batch.update({
      where: { id },
      data,
      include: {
        greigeMaster: {
          select: {
            id: true,
            greigeCode: true,
            greigeName: true,
          },
        },
        fabricMaster: {
          select: {
            id: true,
            fabricCode: true,
            fabricName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            stages: true,
            movements: true,
            deliveries: true,
          },
        },
      },
    });

    return batch;
  }

  /**
   * Get batches by processor
   */
  async getBatchesByProcessor(processorId: string) {
    const batches = await prisma.processing_batch.findMany({
      where: {
        stages: {
          some: {
            processorId,
            status: {
              in: ['AT_PROCESSOR', 'IN_PROCESS', 'IN_TRANSIT_TO_PROCESSOR'],
            },
          },
        },
      },
      include: {
        greigeMaster: {
          select: {
            id: true,
            greigeCode: true,
            greigeName: true,
          },
        },
        stages: {
          where: {
            processorId,
          },
          include: {
            processor: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            stages: true,
            movements: true,
            deliveries: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return batches;
  }

  /**
   * Get job work summary (total inventory at processors)
   */
  async getJobWorkSummary() {
    const activeBatches = await prisma.processing_batch.findMany({
      where: {
        overallStatus: 'ACTIVE',
      },
      select: {
        quantityInProcess: true,
        quantityInTransit: true,
        totalCostIncurred: true,
      },
    });

    const summary = activeBatches.reduce(
      (acc, batch) => {
        acc.totalQuantityInProcess += Number(batch.quantityInProcess);
        acc.totalQuantityInTransit += Number(batch.quantityInTransit);
        acc.totalCost += Number(batch.totalCostIncurred);
        return acc;
      },
      {
        totalBatches: activeBatches.length,
        totalQuantityInProcess: 0,
        totalQuantityInTransit: 0,
        totalCost: 0,
      }
    );

    return summary;
  }

  /**
   * Cancel batch
   */
  async cancelBatch(id: string) {
    const batch = await prisma.processing_batch.update({
      where: { id },
      data: {
        overallStatus: 'CANCELLED',
      },
    });

    return batch;
  }

  /**
   * Complete batch
   */
  async completeBatch(id: string) {
    const batch = await prisma.processing_batch.update({
      where: { id },
      data: {
        overallStatus: 'COMPLETED',
      },
    });

    return batch;
  }
}

export const processingBatchService = new ProcessingBatchService();
export default processingBatchService;
