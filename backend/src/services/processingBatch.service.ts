// Processing Batch Service - Manage job work processing batches
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { divideCurrency, roundToCent, toNumber } from '../utils/currency';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

export interface CreateProcessingBatchDTO {
  materialType: 'GREIGE' | 'FABRIC' | 'LACE';
  greigeId?: string;
  fabricId?: string;
  laceId?: string; // For lace processing
  totalQuantitySent: number;
  quantityInProcess: number;
  createdById: string;
  // Lace-specific fields
  colorToApply?: string;
  expectedShrinkagePercent?: number;
}

export interface UpdateProcessingBatchDTO {
  totalQuantityReceived?: number;
  quantityInProcess?: number;
  quantityInTransit?: number;
  quantityRejected?: number;
  overallStatus?: string;
  totalCostIncurred?: number;
  // Lace-specific fields
  dyeLotNumber?: string;
  shadeNote?: string;
  finishedLaceId?: string;
}

export interface ProcessingBatchFilters {
  overallStatus?: string;
  materialType?: 'GREIGE' | 'FABRIC' | 'LACE';
  greigeId?: string;
  fabricId?: string;
  laceId?: string; // For filtering lace processing batches
  search?: string; // Search by batch number
}

class ProcessingBatchService {
  /**
   * Generate unique batch number (PB2607-0001) — atomic monthly series.
   */
  async generateBatchNumber(): Promise<string> {
    return generateAtomicDocNumber('PB');
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
    } else if (data.materialType === 'LACE' && data.laceId) {
      const lace = await prisma.lace_master.findUnique({
        where: { id: data.laceId },
      });
      if (!lace) {
        throw new Error('Lace not found');
      }
      // Validate it's a greige lace (only greige lace needs processing)
      if (!lace.isGreige) {
        throw new Error('Only greige lace can be sent for processing');
      }
    }

    const batchNumber = await this.generateBatchNumber();

    const batch = await prisma.processing_batch.create({
      data: {
        batchNumber,
        materialType: data.materialType,
        greigeId: data.greigeId,
        fabricId: data.fabricId,
        laceId: data.laceId,
        totalQuantitySent: data.totalQuantitySent,
        quantityInProcess: data.quantityInProcess,
        createdById: data.createdById,
        // Lace-specific fields
        colorToApply: data.colorToApply,
        expectedShrinkagePercent: data.expectedShrinkagePercent,
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
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            width: true,
            composition: true,
            isGreige: true,
            expectedShrinkagePercent: true,
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
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            width: true,
            composition: true,
            isGreige: true,
            expectedShrinkagePercent: true,
            costPerMeterGreige: true,
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

    if (filters?.laceId) {
      where.laceId = filters.laceId;
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
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            width: true,
            isGreige: true,
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
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            width: true,
            isGreige: true,
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

  /**
   * Receive processed lace and create finished stock entry
   * This is called when lace returns from dyeing processor
   */
  async receiveProcessedLace(
    batchId: string,
    data: {
      actualQuantityReceived: number;
      dyeLotNumber: string;
      shadeNote?: string;
      qualityGrade?: string;
      warehouseLocation?: string;
      /** Warehouse the dyed lot lands in — also what stock_levels is synced against. */
      warehouseId?: string;
      rackNumber?: string;
      /**
       * The finished (dyed) lace master the output is booked against.
       *
       * Resolved automatically from the batch's greige + colour when omitted, and validated to
       * belong to this greige. It must NOT silently fall back to the greige master: lace_stock
       * is keyed by laceId with no colour column, so booking dyed meters under the greige id
       * merges them with undyed greige stock and every consumer (STOCK_REUSE, MRP netting, lot
       * allocation) then treats them as the same fungible material.
       */
      finishedLaceId?: string;
      receivedById: string;
      originStyleId?: string;
      originOrderId?: string;
      originStyleCode?: string;
    }
  ) {
    // Get the batch with lace details
    const batch = await prisma.processing_batch.findUnique({
      where: { id: batchId },
      include: {
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            costPerMeterGreige: true,
            expectedShrinkagePercent: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Processing batch not found');
    }

    if (batch.materialType !== 'LACE') {
      throw new Error('This batch is not a lace processing batch');
    }

    if (!batch.laceMaster) {
      throw new Error('Lace master not found for this batch');
    }

    // Guards (bug-hunt production-20): receivedQty <= 0 previously divided to Infinity and was
    // persisted into lace_stock cost; re-receiving a COMPLETED batch created a duplicate
    // full-quantity stock lot.
    if (batch.overallStatus === 'COMPLETED' || batch.overallStatus === 'CANCELLED') {
      throw new Error(`Cannot receive: processing batch is already ${batch.overallStatus.toLowerCase()}`);
    }
    if (!(data.actualQuantityReceived > 0)) {
      throw new Error('Received quantity must be greater than zero');
    }

    // ------------------------------------------------------------------
    // Resolve the dyed lace's identity BEFORE any stock is written.
    // ------------------------------------------------------------------
    let resolvedFinishedLaceId = data.finishedLaceId;

    if (resolvedFinishedLaceId) {
      const finished = await prisma.lace_master.findUnique({
        where: { id: resolvedFinishedLaceId },
        select: { id: true, isGreige: true, sourceGreigeLaceId: true, laceName: true },
      });
      if (!finished) {
        throw new Error(`Finished lace not found: ${resolvedFinishedLaceId}`);
      }
      if (finished.isGreige) {
        throw new Error(
          `"${finished.laceName}" is a greige lace. Dyed output must be received against a finished (dyed) lace.`
        );
      }
      if (finished.sourceGreigeLaceId && finished.sourceGreigeLaceId !== batch.laceId) {
        throw new Error(
          `"${finished.laceName}" is not a dyed variant of this batch's greige lace — receiving against it would ` +
            `book this dye lot under the wrong material.`
        );
      }
    } else {
      // Derive it from the batch's greige + the colour actually applied, so a missed field
      // cannot quietly dump dyed meters into the greige pool.
      const colorToApply = batch.colorToApply?.trim();
      if (!colorToApply) {
        throw new Error(
          'Cannot determine which dyed lace to receive against: the batch has no colour recorded. ' +
            'Pass finishedLaceId explicitly.'
        );
      }
      const variant = await prisma.lace_master.findFirst({
        where: {
          sourceGreigeLaceId: batch.laceId!,
          isGreige: false,
          color: { equals: colorToApply, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!variant) {
        throw new Error(
          `No dyed lace exists for this greige in "${colorToApply}". Create the dyed variant first, ` +
            `then receive against it.`
        );
      }
      resolvedFinishedLaceId = variant.id;
    }

    // Calculate actual shrinkage
    const sentQty = Number(batch.totalQuantitySent);
    const receivedQty = data.actualQuantityReceived;
    if (!(sentQty > 0)) {
      throw new Error('Processing batch has no sent quantity — cannot compute shrinkage/cost');
    }
    const actualShrinkagePercent = ((sentQty - receivedQty) / sentQty) * 100;

    // Calculate cost per meter for finished lace via guarded decimal math (bug-hunt production-20)
    // greigeCost + processingCost, adjusted for shrinkage
    const greigeCostPerMeter = Number(batch.laceMaster.costPerMeterGreige) || 0;
    const totalCost = Number(batch.totalCostIncurred) || 0;
    const processingCostPerMeterD = divideCurrency(totalCost, sentQty);
    // Cost per finished meter (accounts for shrinkage - we lose material)
    const finishedCostPerMeter = toNumber(
      roundToCent(processingCostPerMeterD.plus(greigeCostPerMeter).times(sentQty).dividedBy(receivedQty))
    );

    // Create stock entry and update batch in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create lace stock entry
      const laceStock = await tx.lace_stock.create({
        data: {
          laceId: resolvedFinishedLaceId!, // Always the DYED master — never the greige (see above)
          lotNumber: `LOT-${batchId.slice(0, 8)}`,
          dyeLotNumber: data.dyeLotNumber,
          shadeNote: data.shadeNote,
          processingBatchId: batchId,
          originStyleId: data.originStyleId,
          originOrderId: data.originOrderId,
          originStyleCode: data.originStyleCode,
          warehouseLocation: data.warehouseLocation,
          warehouseId: data.warehouseId,
          rackNumber: data.rackNumber,
          quantityAvailable: data.actualQuantityReceived,
          weightedAvgCost: finishedCostPerMeter,
          purchaseCost: finishedCostPerMeter,
          qualityGrade: data.qualityGrade || 'A',
          status: 'AVAILABLE',
          stockType: 'PLANNED_STOCK',
          receivedDate: new Date(),
          createdById: data.receivedById,
        },
      });

      // Create stock transaction record
      await tx.lace_stock_transaction.create({
        data: {
          stockId: laceStock.id,
          transactionType: 'STOCK_IN',
          quantity: data.actualQuantityReceived,
          balanceAfter: data.actualQuantityReceived,
          referenceType: 'PROCESSING_BATCH',
          referenceId: batchId,
          notes: `Received from processing batch. Dye lot: ${data.dyeLotNumber}. Shrinkage: ${actualShrinkagePercent.toFixed(2)}%`,
          performedById: data.receivedById,
        },
      });

      // Update batch
      const updatedBatch = await tx.processing_batch.update({
        where: { id: batchId },
        data: {
          totalQuantityReceived: data.actualQuantityReceived,
          quantityInProcess: 0,
          dyeLotNumber: data.dyeLotNumber,
          shadeNote: data.shadeNote,
          finishedLaceId: resolvedFinishedLaceId,
          overallStatus: 'COMPLETED',
        },
        include: {
          laceMaster: {
            select: {
              id: true,
              laceCode: true,
              laceName: true,
            },
          },
        },
      });

      // MANDATORY stock pattern: guarantee the materials row exists and keep stock_levels in
      // step with the specialised table. Without this the dyed lot exists in lace_stock but is
      // invisible on the Stock Levels page. (This file is not named *stock*.service.ts, so the
      // pre-commit hook does not enforce the import here — it has to be done deliberately.)
      await ensureMaterialRecord(resolvedFinishedLaceId!, 'LACE', tx);
      await syncStockLevelQuantity(
        resolvedFinishedLaceId!,
        Number(data.actualQuantityReceived),
        data.warehouseId,
        'METER',
        tx
      );

      return {
        batch: updatedBatch,
        stock: laceStock,
        actualShrinkagePercent,
        expectedShrinkagePercent: batch.laceMaster?.expectedShrinkagePercent
          ? Number(batch.laceMaster.expectedShrinkagePercent)
          : null,
        shrinkageVariance: batch.laceMaster?.expectedShrinkagePercent
          ? actualShrinkagePercent - Number(batch.laceMaster.expectedShrinkagePercent)
          : null, // null = expected shrinkage not configured, variance cannot be calculated
        finishedCostPerMeter,
      };
    });

    return result;
  }

  /**
   * Get lace processing batches summary
   */
  async getLaceProcessingSummary() {
    const activeLaceBatches = await prisma.processing_batch.findMany({
      where: {
        materialType: 'LACE',
        overallStatus: { in: ['ACTIVE', 'IN_PROGRESS'] },
      },
      include: {
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
          },
        },
        stages: {
          include: {
            processor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const summary = {
      totalBatches: activeLaceBatches.length,
      totalQuantityInProcess: activeLaceBatches.reduce((sum, b) => sum + Number(b.quantityInProcess), 0),
      totalQuantityInTransit: activeLaceBatches.reduce((sum, b) => sum + Number(b.quantityInTransit), 0),
      batches: activeLaceBatches,
    };

    return summary;
  }
}

export const processingBatchService = new ProcessingBatchService();
export default processingBatchService;
