// Stock Movement Service - Handle all stock movements and integrate with stock levels
import { MovementType, StockTransactionType, Unit, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import stockLevelService from './stockLevel.service';

export interface CreateStockMovementDTO {
  movementType: MovementType;
  materialId: string;
  warehouseId: string;
  supplierId?: string; // Direct supplier reference
  quantity: Decimal;
  unit: Unit;
  rate?: Decimal;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  fromLocation?: string;
  toLocation?: string;
  remarks?: string;
  performedById: string;
  foldLengthCm?: Decimal;
  thanCount?: number;
}

export interface StockTransferDTO {
  materialId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: Decimal;
  unit: Unit;
  remarks?: string;
  performedById: string;
}

export interface StockAdjustmentDTO {
  materialId: string;
  warehouseId: string;
  adjustmentQuantity: Decimal; // Positive for increase, negative for decrease
  unit: Unit;
  reason: string;
  performedById: string;
}

export interface MovementFilters {
  warehouseId?: string;
  materialId?: string;
  movementType?: MovementType;
  startDate?: Date;
  endDate?: Date;
  referenceType?: string;
  referenceId?: string;
}

// Bulk stock-in DTOs
export interface BulkStockInItemDTO {
  materialId: string;
  quantity: Decimal;
  unit: Unit;
  rate?: Decimal;
  foldLengthCm?: Decimal;
  thanCount?: number;
  remarks?: string;
}

export interface BulkStockInDTO {
  warehouseId: string;
  supplierId?: string; // Direct supplier reference
  referenceType?: string;
  referenceNumber?: string;
  remarks?: string;
  performedById: string;
  items: BulkStockInItemDTO[];
}

class StockMovementService {
  /**
   * Helper: Increase stock level inside a transaction
   * All stock level operations MUST use tx to ensure atomicity
   */
  private async increaseStockInTx(
    tx: Prisma.TransactionClient,
    materialId: string,
    warehouseId: string,
    quantity: Decimal,
    unit: Unit,
    rate?: Decimal
  ) {
    const existing = await tx.stock_levels.findFirst({
      where: { materialId, warehouseId },
    });

    if (existing) {
      const newQuantity = new Decimal(existing.quantity.toString()).add(quantity.toString());
      let newValuationRate = existing.valuationRate;
      let newStockValue = existing.stockValue;

      if (rate) {
        const oldValue = existing.stockValue ? new Decimal(existing.stockValue.toString()) : new Decimal(0);
        const newValue = new Decimal(quantity.toString()).mul(rate.toString());
        const totalValue = oldValue.add(newValue);
        newValuationRate = totalValue.div(newQuantity);
        newStockValue = totalValue;
      }

      return tx.stock_levels.update({
        where: { id: existing.id },
        data: {
          quantity: newQuantity,
          valuationRate: newValuationRate,
          stockValue: newStockValue,
          lastUpdated: new Date(),
        },
      });
    } else {
      const stockValue = rate ? new Decimal(quantity.toString()).mul(rate.toString()) : null;
      return tx.stock_levels.create({
        data: {
          materialId,
          warehouseId,
          quantity,
          unit,
          valuationRate: rate,
          stockValue,
        },
      });
    }
  }

  /**
   * Helper: Decrease stock level inside a transaction
   * All stock level operations MUST use tx to ensure atomicity
   */
  private async decreaseStockInTx(
    tx: Prisma.TransactionClient,
    materialId: string,
    warehouseId: string,
    quantity: Decimal
  ) {
    const existing = await tx.stock_levels.findFirst({
      where: { materialId, warehouseId },
    });

    if (!existing) {
      throw new Error('Stock level not found. Cannot decrease stock.');
    }

    const currentQty = new Decimal(existing.quantity.toString());
    const decreaseQty = new Decimal(quantity.toString());

    if (currentQty.lt(decreaseQty)) {
      throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${decreaseQty}`);
    }

    const newQuantity = currentQty.sub(decreaseQty);
    let newStockValue = existing.stockValue;
    if (existing.stockValue && existing.valuationRate) {
      newStockValue = new Decimal(newQuantity.toString()).mul(existing.valuationRate.toString());
    }

    return tx.stock_levels.update({
      where: { id: existing.id },
      data: {
        quantity: newQuantity,
        stockValue: newStockValue,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Create stock in movement (GRN, Purchase, etc.)
   */
  async createStockIn(data: CreateStockMovementDTO) {
    return await prisma.$transaction(async (tx) => {
      // Create stock movement record
      const movement = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_IN',
          materialId: data.materialId,
          warehouseId: data.warehouseId,
          supplierId: data.supplierId,
          quantity: data.quantity,
          unit: data.unit,
          rate: data.rate,
          value: data.rate ? new Decimal(data.quantity.toString()).mul(data.rate.toString()) : null,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          referenceNumber: data.referenceNumber,
          remarks: data.remarks,
          performedById: data.performedById,
          foldLengthCm: data.foldLengthCm,
          thanCount: data.thanCount,
        },
        include: {
          materials: {
            select: {
              code: true,
              name: true,
            },
          },
          warehouses: {
            select: {
              warehouseCode: true,
              warehouseName: true,
            },
          },
        },
      });

      // Create stock transaction for valuation
      if (data.rate) {
        await tx.stock_transactions.create({
          data: {
            materialId: data.materialId,
            warehouseId: data.warehouseId,
            transactionType: 'IN',
            quantity: data.quantity,
            unit: data.unit,
            rate: data.rate,
            value: new Decimal(data.quantity.toString()).mul(data.rate.toString()),
            balanceQuantity: data.quantity,
            balanceValue: new Decimal(data.quantity.toString()).mul(data.rate.toString()),
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            referenceNumber: data.referenceNumber,
          },
        });
      }

      // Update stock level inside transaction for atomicity
      await this.increaseStockInTx(tx, data.materialId, data.warehouseId, data.quantity, data.unit, data.rate);

      return movement;
    });
  }

  /**
   * Create multiple stock-in movements in a single transaction (bulk receipt)
   * All items share a batchId for traceability
   */
  async createBulkStockIn(data: BulkStockInDTO) {
    const batchId = randomUUID();

    return await prisma.$transaction(async (tx) => {
      const movements = [];

      for (const item of data.items) {
        // Create stock movement record
        const movement = await tx.stock_movements.create({
          data: {
            movementType: 'STOCK_IN',
            materialId: item.materialId,
            warehouseId: data.warehouseId,
            supplierId: data.supplierId,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            value: item.rate ? new Decimal(item.quantity.toString()).mul(item.rate.toString()) : null,
            referenceType: data.referenceType || 'BULK_STOCK_IN',
            referenceId: batchId,
            referenceNumber: data.referenceNumber,
            remarks: item.remarks || data.remarks,
            performedById: data.performedById,
            foldLengthCm: item.foldLengthCm,
            thanCount: item.thanCount,
          },
          include: {
            materials: {
              select: {
                code: true,
                name: true,
              },
            },
            warehouses: {
              select: {
                warehouseCode: true,
                warehouseName: true,
              },
            },
          },
        });

        // Create stock transaction for valuation
        if (item.rate) {
          await tx.stock_transactions.create({
            data: {
              materialId: item.materialId,
              warehouseId: data.warehouseId,
              transactionType: 'IN',
              quantity: item.quantity,
              unit: item.unit,
              rate: item.rate,
              value: new Decimal(item.quantity.toString()).mul(item.rate.toString()),
              balanceQuantity: item.quantity,
              balanceValue: new Decimal(item.quantity.toString()).mul(item.rate.toString()),
              referenceType: data.referenceType || 'BULK_STOCK_IN',
              referenceId: batchId,
              referenceNumber: data.referenceNumber,
            },
          });
        }

        // Update stock level inside transaction for atomicity
        await this.increaseStockInTx(tx, item.materialId, data.warehouseId, item.quantity, item.unit, item.rate);

        movements.push(movement);
      }

      return {
        batchId,
        movements,
        itemCount: movements.length,
        totalQuantity: data.items
          .reduce((sum, item) => sum.add(new Decimal(item.quantity.toString())), new Decimal(0))
          .toString(),
      };
    });
  }

  /**
   * Create stock out movement (Material Requisition, Sale, etc.)
   */
  async createStockOut(data: CreateStockMovementDTO) {
    return await prisma.$transaction(async (tx) => {
      // Check stock availability inside transaction for atomicity
      const stockLevel = await tx.stock_levels.findFirst({
        where: { materialId: data.materialId, warehouseId: data.warehouseId },
      });

      if (!stockLevel) {
        throw new Error('Material not available in this warehouse');
      }

      const availableQty = new Decimal(stockLevel.quantity.toString());
      const requiredQty = new Decimal(data.quantity.toString());

      if (availableQty.lt(requiredQty)) {
        throw new Error(`Insufficient stock. Available: ${availableQty}, Required: ${requiredQty}`);
      }

      // Create stock movement record
      const movement = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_OUT',
          materialId: data.materialId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: stockLevel.valuationRate || undefined,
          value: stockLevel.valuationRate
            ? new Decimal(data.quantity.toString()).mul(stockLevel.valuationRate.toString())
            : null,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          referenceNumber: data.referenceNumber,
          remarks: data.remarks,
          performedById: data.performedById,
        },
        include: {
          materials: {
            select: {
              code: true,
              name: true,
            },
          },
          warehouses: {
            select: {
              warehouseCode: true,
              warehouseName: true,
            },
          },
        },
      });

      // Create stock transaction for valuation
      if (stockLevel.valuationRate) {
        await tx.stock_transactions.create({
          data: {
            materialId: data.materialId,
            warehouseId: data.warehouseId,
            transactionType: 'OUT',
            quantity: data.quantity,
            unit: data.unit,
            rate: stockLevel.valuationRate,
            value: new Decimal(data.quantity.toString()).mul(stockLevel.valuationRate.toString()),
            balanceQuantity: availableQty.sub(requiredQty),
            balanceValue: stockLevel.stockValue
              ? new Decimal(stockLevel.stockValue.toString()).sub(
                  new Decimal(data.quantity.toString()).mul(stockLevel.valuationRate.toString())
                )
              : new Decimal(0),
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            referenceNumber: data.referenceNumber,
          },
        });
      }

      // Decrease stock inside transaction for atomicity
      await this.decreaseStockInTx(tx, data.materialId, data.warehouseId, data.quantity);

      return movement;
    });
  }

  /**
   * Create stock transfer between warehouses
   */
  async createStockTransfer(data: StockTransferDTO) {
    return await prisma.$transaction(async (tx) => {
      // Check source warehouse stock inside transaction for atomicity
      const sourceStock = await tx.stock_levels.findFirst({
        where: { materialId: data.materialId, warehouseId: data.fromWarehouseId },
      });

      if (!sourceStock) {
        throw new Error('Material not available in source warehouse');
      }

      const availableQty = new Decimal(sourceStock.quantity.toString());
      const transferQty = new Decimal(data.quantity.toString());

      if (availableQty.lt(transferQty)) {
        throw new Error(`Insufficient stock in source warehouse. Available: ${availableQty}, Required: ${transferQty}`);
      }

      const valuationRate = sourceStock.valuationRate;

      // Create transfer OUT movement
      const transferOut = await tx.stock_movements.create({
        data: {
          movementType: 'TRANSFER_OUT',
          materialId: data.materialId,
          warehouseId: data.fromWarehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: valuationRate || undefined,
          value: valuationRate ? new Decimal(data.quantity.toString()).mul(valuationRate.toString()) : null,
          toLocation: data.toWarehouseId,
          referenceType: 'TRANSFER',
          remarks: data.remarks,
          performedById: data.performedById,
        },
      });

      // Create transfer IN movement
      const transferIn = await tx.stock_movements.create({
        data: {
          movementType: 'TRANSFER_IN',
          materialId: data.materialId,
          warehouseId: data.toWarehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: valuationRate || undefined,
          value: valuationRate ? new Decimal(data.quantity.toString()).mul(valuationRate.toString()) : null,
          fromLocation: data.fromWarehouseId,
          referenceType: 'TRANSFER',
          referenceId: transferOut.id,
          remarks: data.remarks,
          performedById: data.performedById,
        },
      });

      // Decrease source warehouse stock inside transaction
      await this.decreaseStockInTx(tx, data.materialId, data.fromWarehouseId, data.quantity);

      // Increase destination warehouse stock inside transaction
      await this.increaseStockInTx(
        tx,
        data.materialId,
        data.toWarehouseId,
        data.quantity,
        data.unit,
        valuationRate || undefined
      );

      return {
        transferOut,
        transferIn,
      };
    });
  }

  /**
   * Create stock adjustment (increase or decrease with reason)
   */
  async createStockAdjustment(data: StockAdjustmentDTO) {
    return await prisma.$transaction(async (tx) => {
      const adjustmentQty = new Decimal(data.adjustmentQuantity.toString());
      const isIncrease = adjustmentQty.gt(0);
      const absoluteQty = adjustmentQty.abs();

      let movement;

      if (isIncrease) {
        // Adjustment IN
        movement = await tx.stock_movements.create({
          data: {
            movementType: 'ADJUSTMENT_IN',
            materialId: data.materialId,
            warehouseId: data.warehouseId,
            quantity: absoluteQty,
            unit: data.unit,
            referenceType: 'ADJUSTMENT',
            remarks: data.reason,
            performedById: data.performedById,
          },
          include: {
            materials: true,
            warehouses: true,
          },
        });

        // Increase stock inside transaction
        await this.increaseStockInTx(tx, data.materialId, data.warehouseId, absoluteQty, data.unit);
      } else {
        // Adjustment OUT
        movement = await tx.stock_movements.create({
          data: {
            movementType: 'ADJUSTMENT_OUT',
            materialId: data.materialId,
            warehouseId: data.warehouseId,
            quantity: absoluteQty,
            unit: data.unit,
            referenceType: 'ADJUSTMENT',
            remarks: data.reason,
            performedById: data.performedById,
          },
          include: {
            materials: true,
            warehouses: true,
          },
        });

        // Decrease stock inside transaction
        await this.decreaseStockInTx(tx, data.materialId, data.warehouseId, absoluteQty);
      }

      return movement;
    });
  }

  /**
   * Get all stock movements with filters
   */
  async getAllMovements(filters?: MovementFilters) {
    const where: Prisma.stock_movementsWhereInput = {};

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.materialId) {
      where.materialId = filters.materialId;
    }

    if (filters?.movementType) {
      where.movementType = filters.movementType;
    }

    if (filters?.referenceType) {
      where.referenceType = filters.referenceType;
    }

    if (filters?.referenceId) {
      where.referenceId = filters.referenceId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.movementDate = {};
      if (filters.startDate) {
        where.movementDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.movementDate.lte = filters.endDate;
      }
    }

    const movements = await prisma.stock_movements.findMany({
      where,
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
          },
        },
        suppliers: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { movementDate: 'desc' },
    });

    // Enrich with user info (performedById is not a FK, so manual lookup needed)
    const userIds = [...new Set(movements.map((m) => m.performedById).filter(Boolean))];
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Map supplier relation to match frontend expected format
    const enrichedMovements = movements.map((m) => ({
      ...m,
      performedBy: userMap.get(m.performedById) || null,
      supplier: m.suppliers, // Prisma relation already populated
    }));

    return enrichedMovements;
  }

  /**
   * Get movement by ID
   */
  async getMovementById(id: string) {
    const movement = await prisma.stock_movements.findUnique({
      where: { id },
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            unit: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
    });

    if (!movement) {
      throw new Error(`Stock movement not found with ID: ${id}`);
    }

    return movement;
  }

  /**
   * Get material movement history
   */
  async getMaterialMovementHistory(materialId: string, warehouseId?: string) {
    const where: Prisma.stock_movementsWhereInput = { materialId };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const movements = await prisma.stock_movements.findMany({
      where,
      include: {
        warehouses: {
          select: {
            warehouseCode: true,
            warehouseName: true,
          },
        },
      },
      orderBy: { movementDate: 'desc' },
      take: 100, // Limit to last 100 movements
    });

    return movements;
  }

  /**
   * Get stock movement summary for a date range
   */
  async getMovementSummary(warehouseId: string, startDate: Date, endDate: Date) {
    const movements = await prisma.stock_movements.findMany({
      where: {
        warehouseId,
        movementDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        materials: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    const summary = {
      totalMovements: movements.length,
      stockIn: movements.filter((m) => m.movementType === 'STOCK_IN').length,
      stockOut: movements.filter((m) => m.movementType === 'STOCK_OUT').length,
      transfers: movements.filter((m) => m.movementType === 'TRANSFER_IN' || m.movementType === 'TRANSFER_OUT').length,
      adjustments: movements.filter((m) => m.movementType === 'ADJUSTMENT_IN' || m.movementType === 'ADJUSTMENT_OUT')
        .length,
      totalValue: movements.reduce((sum, m) => {
        return sum + (m.value ? parseFloat(m.value.toString()) : 0);
      }, 0),
      movements,
    };

    return summary;
  }

  /**
   * Get stock ledger for a material in a warehouse
   */
  async getStockLedger(materialId: string, warehouseId: string) {
    const transactions = await prisma.stock_transactions.findMany({
      where: {
        materialId,
        warehouseId,
      },
      orderBy: { transactionDate: 'asc' },
    });

    return transactions;
  }

  /**
   * Job Work Integration - Send material to processor (stock out to JOB_WORK warehouse)
   */
  async sendToJobWork(data: {
    materialId: string;
    fromWarehouseId: string;
    jobWorkWarehouseId: string;
    quantity: Decimal;
    unit: Unit;
    batchId: string;
    stageId: string;
    performedById: string;
    remarks?: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      // Get valuation rate from source warehouse
      const stockLevel = await tx.stock_levels.findFirst({
        where: {
          materialId: data.materialId,
          warehouseId: data.fromWarehouseId,
        },
      });

      const valuationRate = stockLevel?.valuationRate;

      // Create STOCK_OUT movement from company warehouse
      const stockOut = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_OUT',
          materialId: data.materialId,
          warehouseId: data.fromWarehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: valuationRate || undefined,
          value: valuationRate ? new Decimal(data.quantity.toString()).mul(valuationRate.toString()) : null,
          toLocation: data.jobWorkWarehouseId,
          referenceType: 'PROCESSING_BATCH',
          referenceId: data.batchId,
          referenceNumber: data.stageId,
          remarks: data.remarks || 'Sent to processor for job work',
          performedById: data.performedById,
        },
      });

      // Create STOCK_IN movement to JOB_WORK warehouse
      const stockIn = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_IN',
          materialId: data.materialId,
          warehouseId: data.jobWorkWarehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: valuationRate || undefined,
          value: valuationRate ? new Decimal(data.quantity.toString()).mul(valuationRate.toString()) : null,
          fromLocation: data.fromWarehouseId,
          referenceType: 'PROCESSING_BATCH',
          referenceId: data.batchId,
          referenceNumber: data.stageId,
          remarks: data.remarks || 'Received at processor',
          performedById: data.performedById,
        },
      });

      // Update stock levels
      await stockLevelService.decreaseStock(data.materialId, data.fromWarehouseId, data.quantity);

      await stockLevelService.increaseStock(
        data.materialId,
        data.jobWorkWarehouseId,
        data.quantity,
        data.unit,
        valuationRate || undefined
      );

      return { stockOut, stockIn };
    });
  }

  /**
   * Job Work Integration - Receive material from processor (stock in from JOB_WORK warehouse)
   */
  async receiveFromJobWork(data: {
    materialId: string;
    jobWorkWarehouseId: string;
    toWarehouseId: string;
    quantity: Decimal;
    unit: Unit;
    batchId: string;
    deliveryId: string;
    performedById: string;
    remarks?: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      // Get valuation rate from job work warehouse
      const stockLevel = await tx.stock_levels.findFirst({
        where: {
          materialId: data.materialId,
          warehouseId: data.jobWorkWarehouseId,
        },
      });

      const valuationRate = stockLevel?.valuationRate;

      // Create STOCK_OUT movement from JOB_WORK warehouse
      const stockOut = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_OUT',
          materialId: data.materialId,
          warehouseId: data.jobWorkWarehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: valuationRate || undefined,
          value: valuationRate ? new Decimal(data.quantity.toString()).mul(valuationRate.toString()) : null,
          toLocation: data.toWarehouseId,
          referenceType: 'PROCESSING_DELIVERY',
          referenceId: data.deliveryId,
          referenceNumber: data.batchId,
          remarks: data.remarks || 'Received from processor',
          performedById: data.performedById,
        },
      });

      // Create STOCK_IN movement to destination warehouse
      const stockIn = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_IN',
          materialId: data.materialId,
          warehouseId: data.toWarehouseId,
          quantity: data.quantity,
          unit: data.unit,
          rate: valuationRate || undefined,
          value: valuationRate ? new Decimal(data.quantity.toString()).mul(valuationRate.toString()) : null,
          fromLocation: data.jobWorkWarehouseId,
          referenceType: 'PROCESSING_DELIVERY',
          referenceId: data.deliveryId,
          referenceNumber: data.batchId,
          remarks: data.remarks || 'Received from job work',
          performedById: data.performedById,
        },
      });

      // Update stock levels
      await stockLevelService.decreaseStock(data.materialId, data.jobWorkWarehouseId, data.quantity);

      await stockLevelService.increaseStock(
        data.materialId,
        data.toWarehouseId,
        data.quantity,
        data.unit,
        valuationRate || undefined
      );

      return { stockOut, stockIn };
    });
  }

  /**
   * Get job work movements by batch
   */
  async getJobWorkMovements(batchId: string) {
    const movements = await prisma.stock_movements.findMany({
      where: {
        OR: [
          { referenceType: 'PROCESSING_BATCH', referenceId: batchId },
          { referenceType: 'PROCESSING_DELIVERY', referenceNumber: batchId },
        ],
      },
      include: {
        materials: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
          },
        },
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
      },
      orderBy: { movementDate: 'desc' },
    });

    return movements;
  }
}

export default new StockMovementService();
