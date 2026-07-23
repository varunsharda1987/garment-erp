// Processing Delivery Service - Handle partial deliveries and quality checks
import logger from '../utils/logger';
import { Prisma, ProductionStage } from '@prisma/client';
import prisma from '../config/database';
import { randomUUID } from 'crypto';

export interface CreateProcessingDeliveryDTO {
  batchId: string;
  stageId: string;
  quantityDelivered: number;
  deliveryDate: Date;
  receivedAtWarehouse?: string;
  nextStageId?: string;
  challanNumber?: string;
  invoiceNumber?: string;
  documents?: any;
  receivedById: string;
}

export interface UpdateProcessingDeliveryDTO {
  quantityAccepted?: number;
  quantityRejected?: number;
  qualityStatus?: string;
  qualityNotes?: string;
  rejectionReason?: string;
  qcDate?: Date;
  acceptanceDate?: Date;
}

export interface ProcessingDeliveryFilters {
  batchId?: string;
  stageId?: string;
  qualityStatus?: string;
  startDate?: string;
  endDate?: string;
}

class ProcessingDeliveryService {
  /**
   * Generate unique delivery number
   */
  async generateDeliveryNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Get the latest delivery for this month
    const latestDelivery = await prisma.processing_delivery.findFirst({
      where: {
        deliveryNumber: {
          startsWith: `DEL${year}${month}`,
        },
      },
      orderBy: {
        deliveryNumber: 'desc',
      },
    });

    let sequence = 1;
    if (latestDelivery) {
      const lastSequence = parseInt(latestDelivery.deliveryNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `DEL${year}${month}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create a new processing delivery
   */
  async createDelivery(data: CreateProcessingDeliveryDTO) {
    // Validate batch exists
    const batch = await prisma.processing_batch.findUnique({
      where: { id: data.batchId },
      select: { id: true, workOrderId: true, totalQuantitySent: true, createdById: true },
    });
    if (!batch) {
      throw new Error('Processing batch not found');
    }

    // Validate stage exists
    const stage = await prisma.processing_stage.findUnique({
      where: { id: data.stageId },
    });
    if (!stage) {
      throw new Error('Processing stage not found');
    }

    // Check if delivered quantity doesn't exceed available quantity
    const totalDelivered = await prisma.processing_delivery.aggregate({
      where: {
        stageId: data.stageId,
      },
      _sum: {
        quantityDelivered: true,
      },
    });

    const alreadyDelivered = Number(totalDelivered._sum.quantityDelivered || 0);
    const availableForDelivery = Number(stage.quantitySent) - alreadyDelivered;

    if (data.quantityDelivered > availableForDelivery) {
      throw new Error(`Cannot deliver ${data.quantityDelivered}. Only ${availableForDelivery} available.`);
    }

    const deliveryNumber = await this.generateDeliveryNumber();

    // The delivery record and the stage quantity update MUST be atomic — otherwise a failure between them
    // leaves the delivery recorded while the stage still shows the material in-process (or vice versa),
    // corrupting the stage's received/in-process counts (bug-hunt T1/F4). NOTE: the availableForDelivery
    // pre-check above is not itself concurrency-safe against two simultaneous deliveries (that would need a
    // stage-row lock); this transaction guarantees the two writes commit together, not that check.
    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.processing_delivery.create({
        data: {
          deliveryNumber,
          batchId: data.batchId,
          stageId: data.stageId,
          quantityDelivered: data.quantityDelivered,
          quantityAccepted: data.quantityDelivered, // Initially assume all accepted
          deliveryDate: data.deliveryDate,
          receivedAtWarehouse: data.receivedAtWarehouse,
          nextStageId: data.nextStageId,
          challanNumber: data.challanNumber,
          invoiceNumber: data.invoiceNumber,
          documents: data.documents,
          receivedById: data.receivedById,
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
          receivedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Update stage quantities (atomic with the delivery.create above)
      await tx.processing_stage.update({
        where: { id: data.stageId },
        data: {
          quantityReceived: {
            increment: data.quantityDelivered,
          },
          quantityInProcess: {
            decrement: data.quantityDelivered,
          },
        },
      });

      return created;
    });

    // Auto-update production_tracking if batch is linked to a work order
    // After delivery, check if batch is fully delivered → advance stage to IN_CUTTING
    if (batch.workOrderId) {
      try {
        const totalBatchDelivered = await prisma.processing_delivery.aggregate({
          where: { batchId: data.batchId },
          _sum: { quantityDelivered: true },
        });
        const totalReceived = Number(totalBatchDelivered._sum.quantityDelivered || 0);
        const totalSent = Number(batch.totalQuantitySent);

        // If fully delivered, advance to IN_CUTTING
        if (totalReceived >= totalSent) {
          await prisma.production_tracking.create({
            data: {
              id: randomUUID(),
              workOrderId: batch.workOrderId,
              productionStage: 'IN_CUTTING' as ProductionStage,
              quantityCompleted: Math.round(totalReceived),
              updatedById: data.receivedById,
              updateDate: new Date(),
            },
          });
        }
      } catch (err) {
        // Non-critical: don't fail delivery if tracking fails
        logger.error('Failed to create production_tracking for delivery:', err);
      }
    }

    return delivery;
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(id: string) {
    const delivery = await prisma.processing_delivery.findUnique({
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
                email: true,
              },
            },
          },
        },
        receivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new Error('Processing delivery not found');
    }

    return delivery;
  }

  /**
   * Get all deliveries with filters
   */
  async getAllDeliveries(filters?: ProcessingDeliveryFilters) {
    const where: Prisma.processing_deliveryWhereInput = {};

    if (filters?.batchId) {
      where.batchId = filters.batchId;
    }

    if (filters?.stageId) {
      where.stageId = filters.stageId;
    }

    if (filters?.qualityStatus) {
      where.qualityStatus = filters.qualityStatus;
    }

    if (filters?.startDate || filters?.endDate) {
      where.deliveryDate = {};
      if (filters.startDate) {
        where.deliveryDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.deliveryDate.lte = new Date(filters.endDate);
      }
    }

    const deliveries = await prisma.processing_delivery.findMany({
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
    });

    return deliveries;
  }

  /**
   * Get deliveries by batch
   */
  async getDeliveriesByBatch(batchId: string) {
    const deliveries = await prisma.processing_delivery.findMany({
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
    });

    return deliveries;
  }

  /**
   * Get deliveries by stage
   */
  async getDeliveriesByStage(stageId: string) {
    const deliveries = await prisma.processing_delivery.findMany({
      where: { stageId },
      include: {
        batch: {
          select: {
            id: true,
            batchNumber: true,
            materialType: true,
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
    });

    return deliveries;
  }

  /**
   * Get pending QC deliveries
   */
  async getPendingQCDeliveries() {
    const deliveries = await prisma.processing_delivery.findMany({
      where: {
        qualityStatus: 'PENDING_QC',
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
        receivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        deliveryDate: 'asc',
      },
    });

    return deliveries;
  }

  /**
   * Update delivery
   */
  async updateDelivery(id: string, data: UpdateProcessingDeliveryDTO) {
    // QC quantities/status are frozen once the delivery is ACCEPTED/REJECTED — the generic update
    // has no compensating batch/stage rollup, so post-acceptance edits silently desynced batch
    // totals (bug-hunt production-25). Use the accept/reject flows for QC decisions.
    const existing = await prisma.processing_delivery.findUnique({
      where: { id },
      select: { qualityStatus: true },
    });
    if (!existing) {
      throw new Error('Delivery not found');
    }
    const touchesQcFields =
      data.quantityAccepted !== undefined || data.quantityRejected !== undefined || data.qualityStatus !== undefined;
    if (touchesQcFields && (existing.qualityStatus === 'ACCEPTED' || existing.qualityStatus === 'REJECTED')) {
      throw new Error(
        `Cannot edit QC quantities/status of a delivery that is already ${existing.qualityStatus} — batch totals have been rolled up`
      );
    }

    const delivery = await prisma.processing_delivery.update({
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
        receivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return delivery;
  }

  /**
   * Perform quality check
   */
  async performQC(
    id: string,
    data: {
      quantityAccepted: number;
      quantityRejected: number;
      qualityStatus: string;
      qualityNotes?: string;
      rejectionReason?: string;
    }
  ) {
    const delivery = await prisma.processing_delivery.findUnique({
      where: { id },
      select: {
        quantityDelivered: true,
      },
    });

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    // Validate quantities
    if (data.quantityAccepted + data.quantityRejected !== Number(delivery.quantityDelivered)) {
      throw new Error('Accepted + Rejected quantity must equal delivered quantity');
    }

    const updatedDelivery = await prisma.processing_delivery.update({
      where: { id },
      data: {
        quantityAccepted: data.quantityAccepted,
        quantityRejected: data.quantityRejected,
        qualityStatus: data.qualityStatus,
        qualityNotes: data.qualityNotes,
        rejectionReason: data.rejectionReason,
        qcDate: new Date(),
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

    return updatedDelivery;
  }

  /**
   * Accept delivery
   */
  async acceptDelivery(id: string) {
    // The acceptance flip and the batch rollup MUST be atomic, and a double-accept must not double-count
    // the batch totals (bug-hunt T1/F4).
    return await prisma.$transaction(async (tx) => {
      // Flip to ACCEPTED only if it isn't already — atomic guard against double-accept.
      const flipped = await tx.processing_delivery.updateMany({
        where: { id, qualityStatus: { not: 'ACCEPTED' } },
        data: { qualityStatus: 'ACCEPTED', acceptanceDate: new Date() },
      });
      if (flipped.count === 0) {
        throw new Error('Delivery not found or already accepted');
      }

      const delivery = await tx.processing_delivery.findUnique({
        where: { id },
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
      if (!delivery) {
        throw new Error('Delivery not found');
      }

      // Update batch totals — atomic with the acceptance flip above
      await tx.processing_batch.update({
        where: { id: delivery.batchId },
        data: {
          totalQuantityReceived: {
            increment: delivery.quantityAccepted,
          },
          quantityRejected: {
            increment: delivery.quantityRejected,
          },
          quantityInProcess: {
            decrement: Number(delivery.quantityDelivered),
          },
        },
      });

      return delivery;
    });
  }

  /**
   * Reject delivery
   */
  async rejectDelivery(id: string, reason: string) {
    // Mirror acceptDelivery: atomic guarded flip + batch rollup. The old version only flipped
    // qualityStatus, so the rejected quantity never reached batch.quantityRejected and
    // quantityInProcess kept counting the pieces (bug-hunt production-25).
    return await prisma.$transaction(async (tx) => {
      const flipped = await tx.processing_delivery.updateMany({
        where: { id, qualityStatus: { notIn: ['ACCEPTED', 'REJECTED'] } },
        data: {
          qualityStatus: 'REJECTED',
          rejectionReason: reason,
          acceptanceDate: new Date(),
        },
      });
      if (flipped.count === 0) {
        throw new Error('Delivery not found or already accepted/rejected');
      }

      const delivery = await tx.processing_delivery.findUnique({
        where: { id },
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
      if (!delivery) {
        throw new Error('Delivery not found');
      }

      // A full rejection: nothing accepted, entire delivered quantity rejected
      await tx.processing_delivery.update({
        where: { id },
        data: {
          quantityAccepted: 0,
          quantityRejected: Number(delivery.quantityDelivered),
        },
      });

      // Roll up into batch totals — atomic with the rejection flip above
      await tx.processing_batch.update({
        where: { id: delivery.batchId },
        data: {
          quantityRejected: {
            increment: Number(delivery.quantityDelivered),
          },
          quantityInProcess: {
            decrement: Number(delivery.quantityDelivered),
          },
        },
      });

      return delivery;
    });
  }

  /**
   * Get delivery summary
   */
  async getDeliverySummary(filters?: { startDate?: string; endDate?: string }) {
    const where: Prisma.processing_deliveryWhereInput = {};

    if (filters?.startDate || filters?.endDate) {
      where.deliveryDate = {};
      if (filters.startDate) {
        where.deliveryDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.deliveryDate.lte = new Date(filters.endDate);
      }
    }

    const deliveries = await prisma.processing_delivery.findMany({
      where,
      select: {
        quantityDelivered: true,
        quantityAccepted: true,
        quantityRejected: true,
        qualityStatus: true,
      },
    });

    const summary = deliveries.reduce(
      (acc, delivery) => {
        acc.totalDelivered += Number(delivery.quantityDelivered);
        acc.totalAccepted += Number(delivery.quantityAccepted);
        acc.totalRejected += Number(delivery.quantityRejected);

        // Count by status
        if (!acc.byStatus[delivery.qualityStatus]) {
          acc.byStatus[delivery.qualityStatus] = {
            count: 0,
            quantity: 0,
          };
        }
        acc.byStatus[delivery.qualityStatus].count += 1;
        acc.byStatus[delivery.qualityStatus].quantity += Number(delivery.quantityDelivered);

        return acc;
      },
      {
        totalDeliveries: deliveries.length,
        totalDelivered: 0,
        totalAccepted: 0,
        totalRejected: 0,
        rejectionRate: 0,
        byStatus: {} as Record<string, { count: number; quantity: number }>,
      }
    );

    // Calculate rejection rate
    if (summary.totalDelivered > 0) {
      summary.rejectionRate = (summary.totalRejected / summary.totalDelivered) * 100;
    }

    return summary;
  }

  /**
   * Delete delivery (only if not yet accepted)
   */
  async deleteDelivery(id: string) {
    const delivery = await prisma.processing_delivery.findUnique({
      where: { id },
      select: {
        qualityStatus: true,
        stageId: true,
        quantityDelivered: true,
      },
    });

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.qualityStatus === 'ACCEPTED') {
      throw new Error('Cannot delete accepted delivery');
    }

    // Restore stage quantities and delete the delivery ATOMICALLY — otherwise a delete failure after the
    // restore credits the quantity back to the stage while the delivery still exists (double-count; F4).
    await prisma.$transaction(async (tx) => {
      await tx.processing_stage.update({
        where: { id: delivery.stageId },
        data: {
          quantityReceived: {
            decrement: delivery.quantityDelivered,
          },
          quantityInProcess: {
            increment: delivery.quantityDelivered,
          },
        },
      });

      // Guard the delete on status too: if the delivery was accepted concurrently (between the pre-check
      // above and here), deleteMany matches 0 rows → we abort, rolling back the stage restore.
      const deleted = await tx.processing_delivery.deleteMany({
        where: { id, qualityStatus: { not: 'ACCEPTED' } },
      });
      if (deleted.count === 0) {
        throw new Error('Cannot delete accepted delivery');
      }
    });

    return { success: true, message: 'Delivery deleted successfully' };
  }
}

export const processingDeliveryService = new ProcessingDeliveryService();
export default processingDeliveryService;
