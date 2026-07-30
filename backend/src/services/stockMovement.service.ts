// Stock Movement Service - Handle all stock movements and integrate with stock levels
import { MovementType, StockTransactionType, Unit, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { routeToSpecializedStock } from './helpers/stock-routing.helper';

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
  // Invoice tracking
  invoiceNumber?: string;
  invoiceDate?: Date;
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
  // Invoice tracking
  invoiceNumber?: string;
  invoiceDate?: Date;
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

      const updated = await tx.stock_levels.update({
        where: { id: existing.id },
        data: {
          quantity: newQuantity,
          valuationRate: newValuationRate,
          stockValue: newStockValue,
          lastUpdated: new Date(),
        },
      });

      // T2-1 dual-write: mirror the recomputed WAC rate into stock_settings in the same tx.
      if (rate) {
        await tx.stock_settings.upsert({
          where: { materialId_warehouseId: { materialId, warehouseId } },
          update: { valuationRate: newValuationRate },
          create: { materialId, warehouseId, valuationRate: newValuationRate },
        });
      }

      return updated;
    } else {
      const stockValue = rate ? new Decimal(quantity.toString()).mul(rate.toString()) : null;
      const created = await tx.stock_levels.create({
        data: {
          materialId,
          warehouseId,
          quantity,
          unit,
          valuationRate: rate,
          stockValue,
        },
      });

      // T2-1 dual-write: seed stock_settings with the WAC rate for this new (material,warehouse) in the same tx.
      if (rate) {
        await tx.stock_settings.upsert({
          where: { materialId_warehouseId: { materialId, warehouseId } },
          update: { valuationRate: rate },
          create: { materialId, warehouseId, valuationRate: rate },
        });
      }

      return created;
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
   * @param outerTx optional parent transaction — pass it when calling from inside another $transaction
   * (e.g. receiveChallan) so this write joins that tx instead of opening a second connection on the
   * global client and escaping the parent's rollback (bug-hunt procurement-3; same pattern as createStockOut).
   */
  async createStockIn(data: CreateStockMovementDTO, outerTx?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      // Calculate actual quantity from fold length
      // If foldLengthCm is provided and < 100, actual = nominal × (L/100)
      const nominalQty = data.quantity;
      const foldL = data.foldLengthCm ? Number(data.foldLengthCm) : null;
      const actualQty =
        foldL && foldL > 0 && foldL < 100 ? new Decimal(nominalQty.toString()).mul(foldL).div(100) : nominalQty;

      // Create stock movement record with ACTUAL quantity
      const movement = await tx.stock_movements.create({
        data: {
          movementType: 'STOCK_IN',
          materialId: data.materialId,
          warehouseId: data.warehouseId,
          supplierId: data.supplierId,
          quantity: actualQty, // ACTUAL (adjusted for fold length)
          unit: data.unit,
          rate: data.rate,
          value: data.rate ? new Decimal(actualQty.toString()).mul(data.rate.toString()) : null, // ACTUAL × rate
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          referenceNumber: data.referenceNumber,
          remarks: foldL && foldL < 100 ? `Nominal: ${nominalQty} | ${data.remarks || ''}` : data.remarks,
          performedById: data.performedById,
          foldLengthCm: data.foldLengthCm,
          thanCount: data.thanCount,
          invoiceNumber: data.invoiceNumber,
          invoiceDate: data.invoiceDate,
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

      // Create stock transaction for valuation (using ACTUAL quantity)
      if (data.rate) {
        await tx.stock_transactions.create({
          data: {
            materialId: data.materialId,
            warehouseId: data.warehouseId,
            transactionType: 'IN',
            quantity: actualQty,
            unit: data.unit,
            rate: data.rate,
            value: new Decimal(actualQty.toString()).mul(data.rate.toString()),
            balanceQuantity: actualQty,
            balanceValue: new Decimal(actualQty.toString()).mul(data.rate.toString()),
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            referenceNumber: data.referenceNumber,
          },
        });
      }

      // Update stock level inside transaction for atomicity (using ACTUAL quantity)
      await this.increaseStockInTx(tx, data.materialId, data.warehouseId, actualQty, data.unit, data.rate);

      // Route to specialized stock table based on material type
      await routeToSpecializedStock(
        {
          materialId: data.materialId,
          quantity: Number(actualQty),
          rate: data.rate ? Number(data.rate) : undefined,
          warehouseId: data.warehouseId,
          foldLengthCm: data.foldLengthCm ? Number(data.foldLengthCm) : undefined,
          thanCount: data.thanCount,
          invoiceNumber: data.invoiceNumber,
          performedById: data.performedById,
        },
        tx
      );

      return movement;
    };

    return outerTx ? run(outerTx) : prisma.$transaction(run);
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
        // Calculate actual quantity from fold length
        const nominalQty = item.quantity;
        const foldL = item.foldLengthCm ? Number(item.foldLengthCm) : null;
        const actualQty =
          foldL && foldL > 0 && foldL < 100 ? new Decimal(nominalQty.toString()).mul(foldL).div(100) : nominalQty;

        // Create stock movement record with ACTUAL quantity
        const movement = await tx.stock_movements.create({
          data: {
            movementType: 'STOCK_IN',
            materialId: item.materialId,
            warehouseId: data.warehouseId,
            supplierId: data.supplierId,
            quantity: actualQty, // ACTUAL (adjusted for fold length)
            unit: item.unit,
            rate: item.rate,
            value: item.rate ? new Decimal(actualQty.toString()).mul(item.rate.toString()) : null, // ACTUAL × rate
            referenceType: data.referenceType || 'BULK_STOCK_IN',
            referenceId: batchId,
            referenceNumber: data.referenceNumber,
            remarks:
              foldL && foldL < 100
                ? `Nominal: ${nominalQty} | ${item.remarks || data.remarks || ''}`
                : item.remarks || data.remarks,
            performedById: data.performedById,
            foldLengthCm: item.foldLengthCm,
            thanCount: item.thanCount,
            invoiceNumber: data.invoiceNumber,
            invoiceDate: data.invoiceDate,
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

        // Create stock transaction for valuation (using ACTUAL quantity)
        if (item.rate) {
          await tx.stock_transactions.create({
            data: {
              materialId: item.materialId,
              warehouseId: data.warehouseId,
              transactionType: 'IN',
              quantity: actualQty,
              unit: item.unit,
              rate: item.rate,
              value: new Decimal(actualQty.toString()).mul(item.rate.toString()),
              balanceQuantity: actualQty,
              balanceValue: new Decimal(actualQty.toString()).mul(item.rate.toString()),
              referenceType: data.referenceType || 'BULK_STOCK_IN',
              referenceId: batchId,
              referenceNumber: data.referenceNumber,
            },
          });
        }

        // Update stock level inside transaction for atomicity (using ACTUAL quantity)
        await this.increaseStockInTx(tx, item.materialId, data.warehouseId, actualQty, item.unit, item.rate);

        // Route to specialized stock table based on material type
        await routeToSpecializedStock(
          {
            materialId: item.materialId,
            quantity: Number(actualQty),
            rate: item.rate ? Number(item.rate) : undefined,
            warehouseId: data.warehouseId,
            foldLengthCm: item.foldLengthCm ? Number(item.foldLengthCm) : undefined,
            thanCount: item.thanCount,
            invoiceNumber: data.invoiceNumber,
            performedById: data.performedById,
          },
          tx
        );

        movements.push(movement);
      }

      // Calculate total ACTUAL quantity for summary
      const totalActualQty = movements.reduce((sum, m) => sum.add(new Decimal(m.quantity.toString())), new Decimal(0));

      return {
        batchId,
        movements,
        itemCount: movements.length,
        totalQuantity: totalActualQty.toString(), // ACTUAL total
      };
    });
  }

  /**
   * Create stock out movement (Material Requisition, Sale, etc.)
   */
  async createStockOut(data: CreateStockMovementDTO, outerTx?: any) {
    // When a caller's transaction is supplied, run on it so the stock-out commits/rolls back with the
    // caller (e.g. challan issuance) instead of in its own independent transaction (bug-hunt T1/F4).
    const run = async (tx: any) => {
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
    };
    return outerTx ? run(outerTx) : prisma.$transaction(run);
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

  /**
   * Unified Movement - direction type for frontend display
   */
  private mapToDirection(movementType: string): 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT' {
    if (movementType.includes('IN') || movementType === 'RECEIPT' || movementType === 'RECEIVED') {
      return 'INWARD';
    }
    if (movementType.includes('OUT') || movementType === 'CONSUME' || movementType === 'CONSUMED') {
      return 'OUTWARD';
    }
    if (movementType.includes('TRANSFER')) {
      return 'TRANSFER';
    }
    return 'ADJUSTMENT';
  }

  /**
   * Get unified material movements from all sources
   * Aggregates: stock_movements, greige_stock_transaction, fabric_stock_transaction,
   * goods_receiving_notes, fabric_procurement, challans
   */
  async getUnifiedMovements(filters: {
    supplierId?: string;
    invoiceNumber?: string;
    direction?: 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT';
    materialType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters.dateFrom) dateFilter.gte = filters.dateFrom;
    if (filters.dateTo) dateFilter.lte = filters.dateTo;

    interface UnifiedMovement {
      id: string;
      date: Date;
      direction: 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT';
      supplierName: string | null;
      supplierCode: string | null;
      materialName: string;
      materialCode: string;
      quantity: number;
      unit: string;
      invoiceNumber: string | null;
      rate: number | null;
      totalValue: number | null;
      sourceType: 'STOCK_MOVEMENT' | 'GREIGE_STOCK' | 'FABRIC_STOCK' | 'GRN' | 'PROCUREMENT' | 'CHALLAN';
      sourceId: string;
      sourceNumber: string;
    }

    const results: UnifiedMovement[] = [];

    // 1. Stock Movements (general)
    const stockMovements = await prisma.stock_movements.findMany({
      where: {
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(Object.keys(dateFilter).length > 0 && { movementDate: dateFilter }),
      },
      include: {
        materials: { select: { code: true, name: true } },
        suppliers: { select: { code: true, name: true } },
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
    });

    for (const mov of stockMovements) {
      const direction = this.mapToDirection(mov.movementType);
      if (filters.direction && direction !== filters.direction) continue;

      results.push({
        id: mov.id,
        date: mov.movementDate,
        direction,
        supplierName: mov.suppliers?.name || null,
        supplierCode: mov.suppliers?.code || null,
        materialName: mov.materials?.name || 'Unknown',
        materialCode: mov.materials?.code || '-',
        quantity: Number(mov.quantity),
        unit: mov.unit,
        invoiceNumber: mov.invoiceNumber || null,
        rate: mov.rate ? Number(mov.rate) : null,
        totalValue: mov.value ? Number(mov.value) : null,
        sourceType: 'STOCK_MOVEMENT',
        sourceId: mov.id,
        sourceNumber: mov.referenceNumber || mov.id.slice(0, 8),
      });
    }

    // 2. Greige Stock with transactions
    // Exclude sourceType='MANUAL' - those are already shown via stock_movements (Stock IN form routing)
    const greigeStocks = await prisma.greige_stock.findMany({
      where: {
        sourceType: { not: 'MANUAL' }, // Skip entries created via Stock IN routing - they're in stock_movements
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.invoiceNumber && {
          invoiceNumber: { contains: filters.invoiceNumber, mode: 'insensitive' as const },
        }),
        ...(Object.keys(dateFilter).length > 0 && { receivedDate: dateFilter }),
      },
      include: {
        greige: { select: { greigeCode: true, greigeName: true } },
        supplier: { select: { code: true, name: true } },
        processor: { select: { code: true, name: true } },
      },
      orderBy: { receivedDate: 'desc' },
      take: 500,
    });

    for (const gs of greigeStocks) {
      // Initial receipt
      const totalQty = Number(gs.quantityAvailable) + Number(gs.quantityConsumed) + Number(gs.quantityReserved);
      if (filters.direction && filters.direction !== 'INWARD') continue;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = gs.greige?.greigeName?.toLowerCase().includes(searchLower);
        const codeMatch = gs.greige?.greigeCode?.toLowerCase().includes(searchLower);
        const supplierMatch = gs.supplier?.name?.toLowerCase().includes(searchLower);
        if (!nameMatch && !codeMatch && !supplierMatch) continue;
      }

      results.push({
        id: gs.id,
        date: gs.receivedDate,
        direction: 'INWARD',
        supplierName: gs.supplier?.name || gs.processor?.name || null,
        supplierCode: gs.supplier?.code || gs.processor?.code || null,
        materialName: gs.greige?.greigeName || 'Greige',
        materialCode: gs.greige?.greigeCode || '-',
        quantity: totalQty,
        unit: gs.unit,
        invoiceNumber: gs.invoiceNumber,
        rate: gs.purchaseCost ? Number(gs.purchaseCost) : null,
        totalValue: gs.purchaseCost ? totalQty * Number(gs.purchaseCost) : null,
        sourceType: 'GREIGE_STOCK',
        sourceId: gs.id,
        sourceNumber: gs.procurementId?.slice(0, 8) || gs.id.slice(0, 8),
      });
    }

    // 3. Fabric Procurement (purchases)
    // Exclude procurements linked to MANUAL greige_stock - those are already shown via stock_movements
    const manualGreigeStockProcIds = await prisma.greige_stock.findMany({
      where: { sourceType: 'MANUAL', procurementId: { not: null } },
      select: { procurementId: true },
    });
    const excludeProcIds = new Set(manualGreigeStockProcIds.map((g) => g.procurementId));

    const procurements = await prisma.fabric_procurement.findMany({
      where: {
        id: { notIn: [...excludeProcIds].filter(Boolean) as string[] }, // Exclude MANUAL-linked
        isStockPurchase: { not: true }, // Exclude internal stock records - shown via stock_movements
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.invoiceNumber && {
          invoiceNumber: { contains: filters.invoiceNumber, mode: 'insensitive' as const },
        }),
        ...(Object.keys(dateFilter).length > 0 && { purchaseDate: dateFilter }),
      },
      include: {
        supplier: { select: { code: true, name: true } },
        greigeMaster: { select: { greigeCode: true, greigeName: true } },
        fabricMaster: { select: { fabricCode: true, fabricName: true } },
      },
      orderBy: { purchaseDate: 'desc' },
      take: 500,
    });

    for (const proc of procurements) {
      if (filters.direction && filters.direction !== 'INWARD') continue;

      const materialName = proc.fabricMaster?.fabricName || proc.greigeMaster?.greigeName || 'Material';
      const materialCode = proc.fabricMaster?.fabricCode || proc.greigeMaster?.greigeCode || '-';

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !materialName.toLowerCase().includes(searchLower) &&
          !materialCode.toLowerCase().includes(searchLower) &&
          !proc.supplier?.name?.toLowerCase().includes(searchLower)
        ) {
          continue;
        }
      }

      results.push({
        id: proc.id,
        date: proc.purchaseDate,
        direction: 'INWARD',
        supplierName: proc.supplier?.name || null,
        supplierCode: proc.supplier?.code || null,
        materialName,
        materialCode,
        quantity: Number(proc.quantityPurchased),
        unit: proc.unit,
        invoiceNumber: proc.invoiceNumber,
        rate: Number(proc.ratePerUnit),
        totalValue: Number(proc.totalCost),
        sourceType: 'PROCUREMENT',
        sourceId: proc.id,
        sourceNumber: proc.purchaseOrderNumber || proc.id.slice(0, 8),
      });
    }

    // 4. GRN items (goods receiving)
    const grns = await prisma.goods_receiving_notes.findMany({
      where: {
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.invoiceNumber && {
          invoiceNumber: { contains: filters.invoiceNumber, mode: 'insensitive' as const },
        }),
        ...(Object.keys(dateFilter).length > 0 && { receivingDate: dateFilter }),
      },
      include: {
        suppliers: { select: { code: true, name: true } },
        grn_items: {
          include: {
            materials: { select: { code: true, name: true } },
            purchase_order_items: { select: { unitPrice: true } },
          },
        },
      },
      orderBy: { receivingDate: 'desc' },
      take: 200,
    });

    for (const grn of grns) {
      if (filters.direction && filters.direction !== 'INWARD') continue;

      for (const item of grn.grn_items) {
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (
            !item.materials?.name?.toLowerCase().includes(searchLower) &&
            !item.materials?.code?.toLowerCase().includes(searchLower) &&
            !grn.suppliers?.name?.toLowerCase().includes(searchLower)
          ) {
            continue;
          }
        }

        results.push({
          id: item.id,
          date: grn.receivingDate,
          direction: 'INWARD',
          supplierName: grn.suppliers?.name || null,
          supplierCode: grn.suppliers?.code || null,
          materialName: item.materials?.name || 'Material',
          materialCode: item.materials?.code || '-',
          quantity: Number(item.receivedQuantity),
          unit: item.unit || 'PCS',
          invoiceNumber: grn.invoiceNumber,
          rate: item.purchase_order_items?.unitPrice ? Number(item.purchase_order_items.unitPrice) : null,
          totalValue: item.purchase_order_items?.unitPrice
            ? Number(item.purchase_order_items.unitPrice) * Number(item.receivedQuantity)
            : null,
          sourceType: 'GRN',
          sourceId: grn.id,
          sourceNumber: grn.grnNumber,
        });
      }
    }

    // 5. Challans (transfers)
    if (!filters.direction || filters.direction === 'TRANSFER' || filters.direction === 'OUTWARD') {
      const challans = await prisma.challans.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0 && { challanDate: dateFilter }),
          status: { not: 'DRAFT' },
        },
        include: {
          items: true,
        },
        orderBy: { challanDate: 'desc' },
        take: 200,
      });

      for (const challan of challans) {
        const direction =
          challan.challanType === 'OUTWARD' ? 'OUTWARD' : challan.challanType === 'INWARD' ? 'INWARD' : 'TRANSFER';
        if (filters.direction && direction !== filters.direction) continue;

        for (const item of challan.items) {
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            if (!item.description?.toLowerCase().includes(searchLower)) {
              continue;
            }
          }

          const itemRate = item.rate ? Number(item.rate) : null;
          const itemQty = Number(item.quantity);
          results.push({
            id: item.id,
            date: challan.challanDate,
            direction,
            supplierName: challan.fromName || challan.toName || null,
            supplierCode: null,
            materialName: item.description || item.itemType || 'Item',
            materialCode: item.itemType || '-',
            quantity: itemQty,
            unit: item.unit || 'PCS',
            invoiceNumber: null,
            rate: itemRate,
            totalValue: itemRate ? itemRate * itemQty : null,
            sourceType: 'CHALLAN',
            sourceId: challan.id,
            sourceNumber: challan.challanNumber,
          });
        }
      }
    }

    // Sort all results by date descending
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(skip, skip + limit);

    return {
      data: paginatedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pending inward items across all external sources
   * Used by unified stock movement dashboard
   */
  async getPendingInward(filters: {
    sourceType?: string;
    processorId?: string;
    overdueOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, sourceType, processorId, overdueOnly } = filters;

    interface PendingItem {
      id: string;
      documentNumber: string;
      sourceType: string;
      sourceId: string;
      partyId: string;
      partyCode: string;
      partyName: string;
      partyType: 'SUPPLIER' | 'PROCESSOR';
      materialDescription: string;
      qtyOrdered: number;
      qtyCompleted: number;
      qtyPending: number;
      unit: string;
      documentDate: Date;
      expectedDate: Date | null;
      daysOut: number | null;
      isOverdue: boolean;
      actionRoute: string;
      actionLabel: string;
    }

    const results: PendingItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Purchase POs (sent or partially received)
    if (!sourceType || sourceType === 'PURCHASE') {
      const pendingPOs = await prisma.purchase_orders.findMany({
        where: {
          status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
          ...(processorId && { supplierId: processorId }),
        },
        include: {
          suppliers: { select: { id: true, code: true, name: true } },
          purchase_order_items: {
            include: {
              materials: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { expectedDeliveryDate: 'asc' },
        take: 200,
      });

      for (const po of pendingPOs) {
        const items = po.purchase_order_items;
        const totalOrdered = items.reduce((sum: number, i) => sum + Number(i.orderedQuantity), 0);
        const totalReceived = items.reduce((sum: number, i) => sum + Number(i.receivedQuantity || 0), 0);
        const pending = totalOrdered - totalReceived;

        if (pending <= 0) continue;

        const expected = po.expectedDeliveryDate;
        const isOverdue = expected ? expected < today : false;

        if (overdueOnly && !isOverdue) continue;

        const materialDesc =
          items.length === 1
            ? items[0].materials?.name || po.poCategory || 'Material'
            : `${items.length} items (${po.poCategory || 'General'})`;

        results.push({
          id: po.id,
          documentNumber: po.poNumber,
          sourceType: 'PURCHASE',
          sourceId: po.id,
          partyId: po.suppliers?.id || '',
          partyCode: po.suppliers?.code || '',
          partyName: po.suppliers?.name || 'Unknown',
          partyType: 'SUPPLIER',
          materialDescription: materialDesc,
          qtyOrdered: totalOrdered,
          qtyCompleted: totalReceived,
          qtyPending: pending,
          unit: items[0]?.unit || 'PCS',
          documentDate: po.poDate,
          expectedDate: expected,
          daysOut: expected ? Math.floor((today.getTime() - expected.getTime()) / 86400000) : null,
          isOverdue,
          actionRoute: `/procurement/grn/new?poId=${po.id}`,
          actionLabel: 'Create GRN',
        });
      }
    }

    // 2. Dyeing Process POs (at mill)
    if (!sourceType || sourceType === 'DYEING') {
      const dyeingPOs = await prisma.job_work_orders.findMany({
        where: {
          status: 'AT_MILL',
          processType: 'DYEING',
          ...(processorId && { processorId }),
        },
        include: {
          processor: { select: { id: true, code: true, name: true } },
          fabric: {
            select: {
              fabricName: true,
              greige: { select: { greigeName: true } },
            },
          },
        },
        orderBy: { sentDate: 'asc' },
        take: 200,
      });

      for (const job of dyeingPOs) {
        const sentDate = job.sentDate || job.createdAt;
        const daysOut = Math.floor((today.getTime() - sentDate.getTime()) / 86400000);
        const isOverdue = daysOut > 14;

        if (overdueOnly && !isOverdue) continue;

        const greigeName = job.fabric?.greige?.greigeName || job.fabric?.fabricName || 'Greige';

        results.push({
          id: job.id,
          documentNumber: job.jobWorkNumber || job.id.slice(0, 8),
          sourceType: 'DYEING',
          sourceId: job.id,
          partyId: job.processor?.id || '',
          partyCode: job.processor?.code || '',
          partyName: job.processor?.name || 'Unknown Mill',
          partyType: 'PROCESSOR',
          materialDescription: `${greigeName} → Dyed Fabric`,
          qtyOrdered: Number(job.qtySentMeters),
          qtyCompleted: Number(job.qtyReceivedMeters || 0),
          qtyPending: Number(job.qtySentMeters) - Number(job.qtyReceivedMeters || 0),
          unit: 'MTR',
          documentDate: sentDate,
          expectedDate: job.expectedReturnDate,
          daysOut,
          isOverdue,
          actionRoute: `/manufacturing/processing?tab=process-pos&id=${job.id}`,
          actionLabel: 'Receive',
        });
      }
    }

    // 3. Printing Process POs (at mill)
    if (!sourceType || sourceType === 'PRINTING') {
      const printingPOs = await prisma.job_work_orders.findMany({
        where: {
          status: 'AT_MILL',
          processType: 'PRINTING',
          ...(processorId && { processorId }),
        },
        include: {
          processor: { select: { id: true, code: true, name: true } },
          fabric: {
            select: {
              fabricName: true,
              greige: { select: { greigeName: true } },
            },
          },
        },
        orderBy: { sentDate: 'asc' },
        take: 200,
      });

      for (const job of printingPOs) {
        const sentDate = job.sentDate || job.createdAt;
        const daysOut = Math.floor((today.getTime() - sentDate.getTime()) / 86400000);
        const isOverdue = daysOut > 14;

        if (overdueOnly && !isOverdue) continue;

        const fabricName = job.fabric?.fabricName || job.fabric?.greige?.greigeName || 'Fabric';

        results.push({
          id: job.id,
          documentNumber: job.jobWorkNumber || job.id.slice(0, 8),
          sourceType: 'PRINTING',
          sourceId: job.id,
          partyId: job.processor?.id || '',
          partyCode: job.processor?.code || '',
          partyName: job.processor?.name || 'Unknown Mill',
          partyType: 'PROCESSOR',
          materialDescription: `${fabricName} → Printed`,
          qtyOrdered: Number(job.qtySentMeters),
          qtyCompleted: Number(job.qtyReceivedMeters || 0),
          qtyPending: Number(job.qtySentMeters) - Number(job.qtyReceivedMeters || 0),
          unit: 'MTR',
          documentDate: sentDate,
          expectedDate: job.expectedReturnDate,
          daysOut,
          isOverdue,
          actionRoute: `/manufacturing/processing?tab=process-pos&id=${job.id}`,
          actionLabel: 'Receive',
        });
      }
    }

    // 4. Lace Processing (active batches) - no processor filter, batch-level tracking
    if (!sourceType || sourceType === 'LACE_PROCESSING') {
      const laceBatches = await prisma.processing_batch.findMany({
        where: {
          materialType: 'LACE',
          overallStatus: { in: ['ACTIVE', 'IN_PROGRESS'] },
        },
        include: {
          laceMaster: { select: { laceName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      for (const batch of laceBatches) {
        const sentDate = batch.createdAt;
        const daysOut = Math.floor((today.getTime() - sentDate.getTime()) / 86400000);
        const isOverdue = daysOut > 14;

        if (overdueOnly && !isOverdue) continue;

        results.push({
          id: batch.id,
          documentNumber: batch.batchNumber || batch.id.slice(0, 8),
          sourceType: 'LACE_PROCESSING',
          sourceId: batch.id,
          partyId: '',
          partyCode: '',
          partyName: 'Lace Processor',
          partyType: 'PROCESSOR',
          materialDescription: batch.laceMaster?.laceName || 'Lace Processing',
          qtyOrdered: Number(batch.totalQuantitySent),
          qtyCompleted: Number(batch.totalQuantityReceived || 0),
          qtyPending: Number(batch.totalQuantitySent) - Number(batch.totalQuantityReceived || 0),
          unit: 'MTR',
          documentDate: sentDate,
          expectedDate: null,
          daysOut,
          isOverdue,
          actionRoute: `/manufacturing/processing-batches/${batch.id}`,
          actionLabel: 'Complete',
        });
      }
    }

    // 5. Embroidery (fabric roll) send-outs
    if (!sourceType || sourceType === 'EMBROIDERY_FABRIC') {
      const embroideryFabric = await prisma.embroidery_send_out.findMany({
        where: {
          status: 'SENT',
          ...(processorId && { supplierId: processorId }),
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          sourceFabricStock: {
            include: {
              fabricMaster: { select: { fabricName: true } },
            },
          },
        },
        orderBy: { sendDate: 'asc' },
        take: 200,
      });

      for (const sendOut of embroideryFabric) {
        const sentDate = sendOut.sendDate || sendOut.createdAt;
        const daysOut = Math.floor((today.getTime() - sentDate.getTime()) / 86400000);
        const isOverdue = daysOut > 7;

        if (overdueOnly && !isOverdue) continue;

        results.push({
          id: sendOut.id,
          documentNumber: sendOut.id.slice(0, 8),
          sourceType: 'EMBROIDERY_FABRIC',
          sourceId: sendOut.id,
          partyId: sendOut.supplier?.id || '',
          partyCode: sendOut.supplier?.code || '',
          partyName: sendOut.supplier?.name || 'Unknown Vendor',
          partyType: 'PROCESSOR',
          materialDescription: sendOut.sourceFabricStock?.fabricMaster?.fabricName || 'Fabric Embroidery',
          qtyOrdered: Number(sendOut.quantitySent),
          qtyCompleted: Number(sendOut.quantityReceived || 0),
          qtyPending: Number(sendOut.quantitySent) - Number(sendOut.quantityReceived || 0),
          unit: sendOut.unit || 'MTR',
          documentDate: sentDate,
          expectedDate: sendOut.expectedReturnDate,
          daysOut,
          isOverdue,
          actionRoute: `/embroidery-stock/receive/${sendOut.id}`,
          actionLabel: 'Receive',
        });
      }
    }

    // 6. External Process Send-outs (Embroidery Piece, Smocking, Handwork)
    const externalProcessTypes = ['EMBROIDERY_PIECE', 'SMOCKING', 'HANDWORK'];
    for (const processType of externalProcessTypes) {
      if (sourceType && sourceType !== processType) continue;

      const sendOuts = await prisma.external_process_send_outs.findMany({
        where: {
          status: 'SENT',
          processType: processType as any,
          ...(processorId && { supplierId: processorId }),
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          style: { select: { styleCode: true, styleName: true } },
        },
        orderBy: { sendDate: 'asc' },
        take: 100,
      });

      for (const sendOut of sendOuts) {
        const sentDate = sendOut.sendDate || sendOut.createdAt;
        const daysOut = Math.floor((today.getTime() - sentDate.getTime()) / 86400000);
        const isOverdue = daysOut > 7;

        if (overdueOnly && !isOverdue) continue;

        const routePrefix =
          processType === 'EMBROIDERY_PIECE'
            ? '/embroidery-stock/piece-receive'
            : processType === 'SMOCKING'
              ? '/manufacturing/smocking/receive'
              : '/manufacturing/handwork/receive';

        results.push({
          id: sendOut.id,
          documentNumber: sendOut.batchNumber || sendOut.id.slice(0, 8),
          sourceType: processType,
          sourceId: sendOut.id,
          partyId: sendOut.supplier?.id || '',
          partyCode: sendOut.supplier?.code || '',
          partyName: sendOut.supplier?.name || 'Unknown Vendor',
          partyType: 'PROCESSOR',
          materialDescription: `${sendOut.style?.styleCode || 'Style'} - ${processType.replace('_', ' ')}`,
          qtyOrdered: Number(sendOut.quantitySent),
          qtyCompleted: Number(sendOut.quantityReceived || 0),
          qtyPending: Number(sendOut.quantitySent) - Number(sendOut.quantityReceived || 0),
          unit: sendOut.unit || 'PCS',
          documentDate: sentDate,
          expectedDate: sendOut.expectedReturnDate,
          daysOut,
          isOverdue,
          actionRoute: `${routePrefix}/${sendOut.id}`,
          actionLabel: 'Receive',
        });
      }
    }

    // Sort by overdue first, then by days out
    results.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return (b.daysOut || 0) - (a.daysOut || 0);
    });

    const total = results.length;
    const skip = (page - 1) * limit;
    const paginatedResults = results.slice(skip, skip + limit);

    return {
      data: paginatedResults,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get pending outward items (drafts awaiting send)
   * Used by unified stock movement dashboard
   */
  async getPendingOutward(filters: { sourceType?: string; processorId?: string; page?: number; limit?: number }) {
    const { page = 1, limit = 50, sourceType, processorId } = filters;

    interface PendingOutwardItem {
      id: string;
      documentNumber: string;
      sourceType: string;
      sourceId: string;
      partyId: string;
      partyCode: string;
      partyName: string;
      materialDescription: string;
      quantity: number;
      unit: string;
      createdDate: Date;
      actionRoute: string;
      actionLabel: string;
    }

    const results: PendingOutwardItem[] = [];

    // 1. Dyeing Process PO Drafts (READY_TO_SEND status)
    if (!sourceType || sourceType === 'DYEING') {
      const dyeingDrafts = await prisma.job_work_orders.findMany({
        where: {
          status: 'READY_TO_SEND',
          processType: 'DYEING',
          ...(processorId && { processorId }),
        },
        include: {
          processor: { select: { id: true, code: true, name: true } },
          fabric: {
            select: {
              fabricName: true,
              greige: { select: { greigeName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const job of dyeingDrafts) {
        const greigeName = job.fabric?.greige?.greigeName || job.fabric?.fabricName || 'Greige';
        results.push({
          id: job.id,
          documentNumber: job.jobWorkNumber || job.id.slice(0, 8),
          sourceType: 'DYEING',
          sourceId: job.id,
          partyId: job.processor?.id || '',
          partyCode: job.processor?.code || '',
          partyName: job.processor?.name || 'Select Mill',
          materialDescription: greigeName,
          quantity: Number(job.qtySentMeters || 0),
          unit: 'MTR',
          createdDate: job.createdAt,
          actionRoute: `/manufacturing/processing?tab=process-pos&id=${job.id}`,
          actionLabel: 'Send to Mill',
        });
      }
    }

    // 2. Printing Process PO Drafts (READY_TO_SEND status)
    if (!sourceType || sourceType === 'PRINTING') {
      const printingDrafts = await prisma.job_work_orders.findMany({
        where: {
          status: 'READY_TO_SEND',
          processType: 'PRINTING',
          ...(processorId && { processorId }),
        },
        include: {
          processor: { select: { id: true, code: true, name: true } },
          fabric: {
            select: {
              fabricName: true,
              greige: { select: { greigeName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const job of printingDrafts) {
        const fabricName = job.fabric?.fabricName || job.fabric?.greige?.greigeName || 'Fabric';
        results.push({
          id: job.id,
          documentNumber: job.jobWorkNumber || job.id.slice(0, 8),
          sourceType: 'PRINTING',
          sourceId: job.id,
          partyId: job.processor?.id || '',
          partyCode: job.processor?.code || '',
          partyName: job.processor?.name || 'Select Mill',
          materialDescription: fabricName,
          quantity: Number(job.qtySentMeters || 0),
          unit: 'MTR',
          createdDate: job.createdAt,
          actionRoute: `/manufacturing/processing?tab=process-pos&id=${job.id}`,
          actionLabel: 'Send to Mill',
        });
      }
    }

    // 3. Lace Processing Drafts (pending batches) - no processor on batch
    if (!sourceType || sourceType === 'LACE_PROCESSING') {
      const laceDrafts = await prisma.processing_batch.findMany({
        where: {
          materialType: 'LACE',
          overallStatus: 'PENDING',
        },
        include: {
          laceMaster: { select: { laceName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const batch of laceDrafts) {
        results.push({
          id: batch.id,
          documentNumber: batch.batchNumber || batch.id.slice(0, 8),
          sourceType: 'LACE_PROCESSING',
          sourceId: batch.id,
          partyId: '',
          partyCode: '',
          partyName: 'Select Processor',
          materialDescription: batch.laceMaster?.laceName || 'Lace for Processing',
          quantity: Number(batch.totalQuantitySent || 0),
          unit: 'MTR',
          createdDate: batch.createdAt,
          actionRoute: `/manufacturing/processing-batches/${batch.id}`,
          actionLabel: 'Send',
        });
      }
    }

    // 4. Embroidery (fabric) Drafts
    if (!sourceType || sourceType === 'EMBROIDERY_FABRIC') {
      const embroideryDrafts = await prisma.embroidery_send_out.findMany({
        where: {
          status: 'DRAFT',
          ...(processorId && { supplierId: processorId }),
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          sourceFabricStock: {
            include: {
              fabricMaster: { select: { fabricName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      for (const sendOut of embroideryDrafts) {
        results.push({
          id: sendOut.id,
          documentNumber: sendOut.id.slice(0, 8),
          sourceType: 'EMBROIDERY_FABRIC',
          sourceId: sendOut.id,
          partyId: sendOut.supplier?.id || '',
          partyCode: sendOut.supplier?.code || '',
          partyName: sendOut.supplier?.name || 'Select Vendor',
          materialDescription: sendOut.sourceFabricStock?.fabricMaster?.fabricName || 'Fabric for Embroidery',
          quantity: Number(sendOut.quantitySent || 0),
          unit: sendOut.unit || 'MTR',
          createdDate: sendOut.createdAt,
          actionRoute: `/embroidery-stock/send-out`,
          actionLabel: 'Send',
        });
      }
    }

    // 5. External Process Drafts (Embroidery Piece, Smocking, Handwork)
    const externalProcessTypes = ['EMBROIDERY_PIECE', 'SMOCKING', 'HANDWORK'];
    for (const processType of externalProcessTypes) {
      if (sourceType && sourceType !== processType) continue;

      const drafts = await prisma.external_process_send_outs.findMany({
        where: {
          status: 'DRAFT',
          processType: processType as any,
          ...(processorId && { supplierId: processorId }),
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          style: { select: { styleCode: true, styleName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const routePrefix =
        processType === 'EMBROIDERY_PIECE'
          ? '/embroidery-stock/piece-send-out'
          : processType === 'SMOCKING'
            ? '/manufacturing/smocking/send-out'
            : '/manufacturing/handwork/send-out';

      for (const sendOut of drafts) {
        results.push({
          id: sendOut.id,
          documentNumber: sendOut.batchNumber || sendOut.id.slice(0, 8),
          sourceType: processType,
          sourceId: sendOut.id,
          partyId: sendOut.supplier?.id || '',
          partyCode: sendOut.supplier?.code || '',
          partyName: sendOut.supplier?.name || 'Select Vendor',
          materialDescription: `${sendOut.style?.styleCode || 'Style'} - ${processType.replace('_', ' ')}`,
          quantity: Number(sendOut.quantitySent || 0),
          unit: sendOut.unit || 'PCS',
          createdDate: sendOut.createdAt,
          actionRoute: routePrefix,
          actionLabel: 'Send',
        });
      }
    }

    // Sort by creation date desc
    results.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());

    const total = results.length;
    const skip = (page - 1) * limit;
    const paginatedResults = results.slice(skip, skip + limit);

    return {
      data: paginatedResults,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get today's stock movement summary for dashboard
   */
  async getDashboardTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's inward movements (GRN + Process PO receives)
    const [grnCount, dyeingReceived, printingReceived, externalReceived] = await Promise.all([
      prisma.goods_receiving_notes.count({
        where: { receivingDate: { gte: today, lt: tomorrow } },
      }),
      prisma.job_work_orders.count({
        where: {
          receivedDate: { gte: today, lt: tomorrow },
          processType: 'DYEING',
        },
      }),
      prisma.job_work_orders.count({
        where: {
          receivedDate: { gte: today, lt: tomorrow },
          processType: 'PRINTING',
        },
      }),
      prisma.external_process_send_outs.count({
        where: {
          actualReturnDate: { gte: today, lt: tomorrow },
        },
      }),
    ]);

    // Today's outward movements (challans + Process PO sends)
    const [challanCount, dyeingSent, printingSent, externalSent] = await Promise.all([
      prisma.challans.count({
        where: {
          challanDate: { gte: today, lt: tomorrow },
          challanType: 'OUTWARD',
          status: 'ISSUED',
        },
      }),
      prisma.job_work_orders.count({
        where: {
          sentDate: { gte: today, lt: tomorrow },
          processType: 'DYEING',
          status: { in: ['AT_MILL', 'RECEIVED'] },
        },
      }),
      prisma.job_work_orders.count({
        where: {
          sentDate: { gte: today, lt: tomorrow },
          processType: 'PRINTING',
          status: { in: ['AT_MILL', 'RECEIVED'] },
        },
      }),
      prisma.external_process_send_outs.count({
        where: {
          sendDate: { gte: today, lt: tomorrow },
          status: { in: ['SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
        },
      }),
    ]);

    // Overdue items
    const overdueInward = await this.getPendingInward({ overdueOnly: true, limit: 1000 });

    return {
      date: today.toISOString().split('T')[0],
      received: {
        total: grnCount + dyeingReceived + printingReceived + externalReceived,
        grn: grnCount,
        dyeing: dyeingReceived,
        printing: printingReceived,
        external: externalReceived,
      },
      sent: {
        total: challanCount + dyeingSent + printingSent + externalSent,
        challans: challanCount,
        dyeing: dyeingSent,
        printing: printingSent,
        external: externalSent,
      },
      overdue: {
        total: overdueInward.pagination.total,
      },
    };
  }
}

export default new StockMovementService();
