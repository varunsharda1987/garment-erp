// Greige Stock Service - Manage raw greige inventory directly
// This service uses the dedicated greige_stock table (not proxy fabric_master records)
import { Prisma, StockStatus, SpecializedStockTransactionType, TransactionReferenceType } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

export interface CreateGreigeStockDTO {
  greigeId: string;
  quantity: number;
  width: number;
  cutableWidth?: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  qualityGrade?: string;
  purchaseCost?: number;
  receivedDate?: Date;
  supplierId?: string;
}

export interface GreigeStockItem {
  id: string;
  greigeId: string;
  greige: {
    id: string;
    greigeCode: string;
    greigeName: string;
    composition: string;
    yarnCount?: string | null;
    construction?: string | null;
    weaveType?: string | null;
  };
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  greigeWidth: number;
  cutableWidth?: number | null;
  purchaseCost?: number | null;
  weightedAvgCost?: number | null;
  warehouseLocation?: string | null;
  rollNumbers?: string | null;
  qualityGrade: string;
  receivedDate: Date;
  agingDays: number;
  status: string;
  stockType: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string; code: string } | null;
}

export interface UpdateGreigeStockDTO {
  purchaseCost?: number;
  weightedAvgCost?: number;
  qualityGrade?: string;
  warehouseLocation?: string;
  rollNumbers?: string;
}

export interface GreigeStockSummary {
  totalMeters: number;
  totalValue: number;
  agingStockCount: number;
  totalItems: number;
  byQualityGrade: Record<string, number>;
}

class GreigeStockService {
  /**
   * Create greige stock entry directly in greige_stock table
   * No more proxy fabric_master records!
   */
  async createGreigeStock(data: CreateGreigeStockDTO, userId: string) {
    try {
      // Validate greige exists
      const greige = await prisma.greige_master.findUnique({
        where: { id: data.greigeId },
      });
      if (!greige) {
        throw new Error(`Greige with ID ${data.greigeId} not found`);
      }

      // Resolve supplier for procurement record (required field) vs stock record (optional)
      const userSupplierId = data.supplierId || null;

      // fabric_procurement requires a supplierId - use provided or find a system default
      let procurementSupplierId = userSupplierId;
      if (!procurementSupplierId) {
        const fallback = await prisma.suppliers.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (!fallback) {
          throw new Error('No suppliers found in the system. Please create a supplier first.');
        }
        procurementSupplierId = fallback.id;
      }

      // Create procurement record for traceability
      const procurement = await prisma.fabric_procurement.create({
        data: {
          id: `PROC-GRG-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          procurementType: 'GREIGE',
          supplierId: procurementSupplierId,
          greigeId: data.greigeId,
          quantityPurchased: new Prisma.Decimal(data.quantity),
          unit: 'meters',
          width: new Prisma.Decimal(data.width),
          ratePerUnit: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
          totalCost: data.purchaseCost ? new Prisma.Decimal(data.quantity * data.purchaseCost) : new Prisma.Decimal(0),
          orderedForStyleId: null, // Generic, not style-specific
          isStockPurchase: true,
          processingRequired: false,
          status: 'RECEIVED',
          purchaseDate: data.receivedDate || new Date(),
          receivedDate: data.receivedDate || new Date(),
          createdById: userId,
        },
      });

      // Create greige stock record directly (no more proxy fabric_master!)
      const greigeStock = await prisma.greige_stock.create({
        data: {
          greigeId: data.greigeId,
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: 'meters',
          greigeWidth: new Prisma.Decimal(data.width),
          cutableWidth: data.cutableWidth ? new Prisma.Decimal(data.cutableWidth) : new Prisma.Decimal(data.width - 2), // Default cutable = width - 2
          purchaseCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : null,
          weightedAvgCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : null,
          procurementId: procurement.id,
          supplierId: userSupplierId,
          warehouseLocation: data.warehouseLocation || null,
          rollNumbers: data.rollNumbers || null,
          qualityGrade: data.qualityGrade || 'A',
          receivedDate: data.receivedDate || new Date(),
          agingDays: 0,
          status: 'AVAILABLE',
          stockType: 'GENERIC',
          createdById: userId,
        },
        include: {
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
            },
          },
        },
      });

      // Ensure materials record exists + sync stock_levels
      await ensureMaterialRecord(data.greigeId, 'GREIGE');
      await syncStockLevelQuantity(data.greigeId, data.quantity);

      logInfo(`Created greige stock for ${greige.greigeCode}: ${data.quantity} meters`);

      return greigeStock;
    } catch (error: unknown) {
      logError('Error creating greige stock:', error);
      throw new Error(`Failed to create greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available greige stock
   */
  async getGreigeStock(filters?: {
    greigeId?: string;
    status?: StockStatus;
    minQuantity?: number;
    supplierId?: string;
    sourceType?: string;
  }): Promise<GreigeStockItem[]> {
    try {
      const where: Prisma.greige_stockWhereInput = {
        status: filters?.status || 'AVAILABLE',
      };

      if (filters?.greigeId) {
        where.greigeId = filters.greigeId;
      }

      if (filters?.minQuantity !== undefined) {
        where.quantityAvailable = { gte: filters.minQuantity };
      }

      if (filters?.supplierId) {
        where.supplierId = filters.supplierId;
      }

      if (filters?.sourceType) {
        where.sourceType = filters.sourceType;
      }

      const stocks = await prisma.greige_stock.findMany({
        where,
        include: {
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
              yarnCount: true,
              construction: true,
              weaveType: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return stocks.map((stock) => {
        const agingDays = stock.receivedDate
          ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
          : stock.agingDays;

        return {
          id: stock.id,
          greigeId: stock.greigeId,
          greige: stock.greige,
          quantityAvailable: Number(stock.quantityAvailable),
          quantityReserved: Number(stock.quantityReserved),
          quantityConsumed: Number(stock.quantityConsumed),
          greigeWidth: Number(stock.greigeWidth),
          cutableWidth: stock.cutableWidth ? Number(stock.cutableWidth) : null,
          purchaseCost: stock.purchaseCost ? Number(stock.purchaseCost) : null,
          weightedAvgCost: stock.weightedAvgCost ? Number(stock.weightedAvgCost) : null,
          warehouseLocation: stock.warehouseLocation,
          rollNumbers: stock.rollNumbers,
          qualityGrade: stock.qualityGrade,
          receivedDate: new Date(stock.receivedDate),
          agingDays,
          status: stock.status,
          stockType: stock.stockType,
          supplierId: stock.supplierId,
          supplier: stock.supplier,
        };
      });
    } catch (error: unknown) {
      logError('Error getting greige stock:', error);
      throw new Error(`Failed to get greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get greige stock summary for dashboard
   */
  async getGreigeStockSummary(): Promise<GreigeStockSummary> {
    try {
      const stocks = await prisma.greige_stock.findMany({
        where: {
          status: 'AVAILABLE',
          quantityAvailable: { gt: 0 },
        },
        select: {
          quantityAvailable: true,
          purchaseCost: true,
          weightedAvgCost: true,
          receivedDate: true,
          qualityGrade: true,
        },
      });

      let totalMeters = 0;
      let totalValue = 0;
      let agingStockCount = 0;
      const byQualityGrade: Record<string, number> = {};

      stocks.forEach((stock) => {
        const quantity = Number(stock.quantityAvailable);
        const cost = Number(stock.weightedAvgCost || stock.purchaseCost || 0);

        totalMeters += quantity;
        totalValue += quantity * cost;

        // Track by quality grade
        const grade = stock.qualityGrade || 'A';
        byQualityGrade[grade] = (byQualityGrade[grade] || 0) + quantity;

        // Check aging (>180 days)
        const agingDays = stock.receivedDate
          ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        if (agingDays >= 180) {
          agingStockCount++;
        }
      });

      return {
        totalMeters: Math.round(totalMeters * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100,
        agingStockCount,
        totalItems: stocks.length,
        byQualityGrade,
      };
    } catch (error: unknown) {
      logError('Error getting greige stock summary:', error);
      throw new Error(
        `Failed to get greige stock summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Reserve greige stock for processing
   */
  async reserveGreigeStock(stockId: string, quantity: number, userId: string) {
    try {
      const stock = await prisma.greige_stock.findUnique({
        where: { id: stockId },
      });

      if (!stock) {
        throw new Error(`Greige stock with ID ${stockId} not found`);
      }

      const available = Number(stock.quantityAvailable);
      if (quantity > available) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
      }

      const updatedStock = await prisma.greige_stock.update({
        where: { id: stockId },
        data: {
          quantityAvailable: new Prisma.Decimal(available - quantity),
          quantityReserved: new Prisma.Decimal(Number(stock.quantityReserved) + quantity),
        },
        include: {
          greige: {
            select: {
              greigeCode: true,
              greigeName: true,
            },
          },
        },
      });

      logInfo(`Reserved ${quantity} meters of greige stock ${stockId}`);

      return updatedStock;
    } catch (error: unknown) {
      logError('Error reserving greige stock:', error);
      throw new Error(`Failed to reserve greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Consume greige stock (after processing)
   */
  async consumeGreigeStock(stockId: string, quantity: number, userId: string) {
    try {
      const stock = await prisma.greige_stock.findUnique({
        where: { id: stockId },
      });

      if (!stock) {
        throw new Error(`Greige stock with ID ${stockId} not found`);
      }

      const reserved = Number(stock.quantityReserved);
      const available = Number(stock.quantityAvailable);

      // Prefer consuming from reserved, fallback to available
      let newReserved = reserved;
      let newAvailable = available;

      if (quantity <= reserved) {
        newReserved = reserved - quantity;
      } else {
        // Consume all reserved and some available
        const fromAvailable = quantity - reserved;
        if (fromAvailable > available) {
          throw new Error(`Insufficient stock. Total available: ${reserved + available}, Requested: ${quantity}`);
        }
        newReserved = 0;
        newAvailable = available - fromAvailable;
      }

      const updatedStock = await prisma.greige_stock.update({
        where: { id: stockId },
        data: {
          quantityReserved: new Prisma.Decimal(newReserved),
          quantityAvailable: new Prisma.Decimal(newAvailable),
          quantityConsumed: new Prisma.Decimal(Number(stock.quantityConsumed) + quantity),
          lastConsumedDate: new Date(),
          status: newReserved + newAvailable <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
        },
      });

      // Create audit trail for consumption
      const costPerUnit = stock.purchaseCost
        ? Number(stock.purchaseCost)
        : stock.weightedAvgCost
          ? Number(stock.weightedAvgCost)
          : null;
      await prisma.greige_stock_transaction.create({
        data: {
          stockId,
          transactionType: 'CONSUMPTION',
          quantity: new Prisma.Decimal(-quantity),
          balanceAfter: new Prisma.Decimal(newAvailable),
          costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
          totalValue: costPerUnit !== null ? new Prisma.Decimal(quantity * costPerUnit) : null,
          referenceType: 'CHALLAN',
          notes: `Consumed via challan issuance`,
          performedById: userId,
        },
      });

      // Sync stock_levels
      await syncStockLevelQuantity(stock.greigeId, -quantity);

      logInfo(`Consumed ${quantity} meters of greige stock ${stockId}`);

      return updatedStock;
    } catch (error: unknown) {
      logError('Error consuming greige stock:', error);
      throw new Error(`Failed to consume greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get greige stock by ID
   */
  async getGreigeStockById(stockId: string): Promise<GreigeStockItem | null> {
    try {
      const stock = await prisma.greige_stock.findUnique({
        where: { id: stockId },
        include: {
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
              composition: true,
              yarnCount: true,
              construction: true,
              weaveType: true,
            },
          },
        },
      });

      if (!stock) {
        return null;
      }

      const agingDays = stock.receivedDate
        ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
        : stock.agingDays;

      return {
        id: stock.id,
        greigeId: stock.greigeId,
        greige: stock.greige,
        quantityAvailable: Number(stock.quantityAvailable),
        quantityReserved: Number(stock.quantityReserved),
        quantityConsumed: Number(stock.quantityConsumed),
        greigeWidth: Number(stock.greigeWidth),
        cutableWidth: stock.cutableWidth ? Number(stock.cutableWidth) : null,
        purchaseCost: stock.purchaseCost ? Number(stock.purchaseCost) : null,
        weightedAvgCost: stock.weightedAvgCost ? Number(stock.weightedAvgCost) : null,
        warehouseLocation: stock.warehouseLocation,
        rollNumbers: stock.rollNumbers,
        qualityGrade: stock.qualityGrade,
        receivedDate: new Date(stock.receivedDate),
        agingDays,
        status: stock.status,
        stockType: stock.stockType,
      };
    } catch (error: unknown) {
      logError('Error getting greige stock by ID:', error);
      throw new Error(`Failed to get greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update aging days for all stock (called by scheduled job)
   */
  async updateAgingDays() {
    try {
      const stocks = await prisma.greige_stock.findMany({
        where: { status: 'AVAILABLE' },
        select: { id: true, receivedDate: true },
      });

      for (const stock of stocks) {
        const agingDays = stock.receivedDate
          ? Math.floor((Date.now() - new Date(stock.receivedDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        await prisma.greige_stock.update({
          where: { id: stock.id },
          data: { agingDays },
        });
      }

      logDebug(`Updated aging days for ${stocks.length} greige stock records`);
    } catch (error: unknown) {
      logError('Error updating aging days:', error);
    }
  }

  /**
   * Update a greige stock entry
   */
  async updateGreigeStock(stockId: string, data: UpdateGreigeStockDTO) {
    const existing = await prisma.greige_stock.findUnique({ where: { id: stockId } });
    if (!existing) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    const updateData: Prisma.greige_stockUpdateInput = {};
    if (data.purchaseCost !== undefined) updateData.purchaseCost = new Prisma.Decimal(data.purchaseCost);
    if (data.weightedAvgCost !== undefined) updateData.weightedAvgCost = new Prisma.Decimal(data.weightedAvgCost);
    if (data.qualityGrade !== undefined) updateData.qualityGrade = data.qualityGrade;
    if (data.warehouseLocation !== undefined) updateData.warehouseLocation = data.warehouseLocation;
    if (data.rollNumbers !== undefined) updateData.rollNumbers = data.rollNumbers;

    const updated = await prisma.greige_stock.update({
      where: { id: stockId },
      data: updateData,
      include: {
        greige: {
          select: { id: true, greigeCode: true, greigeName: true, composition: true },
        },
        supplier: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    logInfo(`Updated greige stock ${stockId}`);
    return updated;
  }

  /**
   * Delete a greige stock entry (checks dependencies first)
   */
  async deleteGreigeStock(stockId: string) {
    const existing = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: {
        _count: {
          select: {
            challanItems: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    if (existing._count.challanItems > 0) {
      throw new Error(`Cannot delete: ${existing._count.challanItems} challan item(s) reference this stock entry`);
    }

    await prisma.greige_stock.delete({ where: { id: stockId } });
    logInfo(`Deleted greige stock ${stockId}`);
  }

  /**
   * Adjust greige stock quantity (increase/decrease with reason for audit trail)
   */
  async adjustGreigeStock(
    stockId: string,
    data: { adjustmentType: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; remarks?: string },
    userId: string
  ) {
    const existing = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: { greige: { select: { greigeCode: true, greigeName: true } } },
    });

    if (!existing) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    const currentQty = Number(existing.quantityAvailable);

    if (data.adjustmentType === 'DECREASE') {
      if (data.quantity > currentQty) {
        throw new Error(`Cannot decrease by ${data.quantity}. Only ${currentQty} meters available.`);
      }
    }

    const newQty = data.adjustmentType === 'INCREASE' ? currentQty + data.quantity : currentQty - data.quantity;

    const updated = await prisma.greige_stock.update({
      where: { id: stockId },
      data: {
        quantityAvailable: new Prisma.Decimal(newQty),
        status: newQty <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
      },
    });

    // Create audit trail in greige_stock_transaction table
    const costPerUnit = existing.purchaseCost
      ? Number(existing.purchaseCost)
      : existing.weightedAvgCost
        ? Number(existing.weightedAvgCost)
        : null;
    await prisma.greige_stock_transaction.create({
      data: {
        stockId,
        transactionType: data.adjustmentType === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantity: new Prisma.Decimal(data.adjustmentType === 'INCREASE' ? data.quantity : -data.quantity),
        balanceAfter: new Prisma.Decimal(newQty),
        costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
        totalValue: costPerUnit !== null ? new Prisma.Decimal(data.quantity * costPerUnit) : null,
        referenceType: 'MANUAL',
        notes: `${data.reason}${data.remarks ? ' - ' + data.remarks : ''}`,
        performedById: userId,
      },
    });

    // Sync stock_levels
    const adjustChange = data.adjustmentType === 'INCREASE' ? data.quantity : -data.quantity;
    await syncStockLevelQuantity(existing.greigeId, adjustChange);

    logInfo(
      `Stock adjustment: ${data.adjustmentType} ${data.quantity}m on ${existing.greige.greigeCode} (${stockId}). ` +
        `Reason: ${data.reason}. ${data.remarks || ''}. New qty: ${newQty}. By user: ${userId}`
    );

    return {
      stockId,
      adjustmentType: data.adjustmentType,
      quantity: data.quantity,
      reason: data.reason,
      remarks: data.remarks,
      previousQuantity: currentQty,
      newQuantity: newQty,
    };
  }

  /**
   * Get processors (suppliers) that have available greige stock from transfers
   * Used for processor return flow in Stock In
   */
  async getProcessorsWithGreigeStock(): Promise<
    Array<{
      processorId: string;
      processorName: string;
      processorCode: string;
      warehouseName: string | null;
      totalQuantity: number;
      stockEntries: number;
    }>
  > {
    try {
      // Find all greige stock at processor warehouses (sourceType = TRANSFER)
      const processorStock = await prisma.greige_stock.groupBy({
        by: ['supplierId', 'warehouseLocation'],
        where: {
          supplierId: { not: null },
          sourceType: 'TRANSFER',
          status: 'AVAILABLE',
          quantityAvailable: { gt: 0 },
        },
        _sum: { quantityAvailable: true },
        _count: { id: true },
      });

      // Get supplier details
      const supplierIds = processorStock.map((s) => s.supplierId).filter((id): id is string => id !== null);

      const suppliers = await prisma.suppliers.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, name: true, code: true },
      });

      const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

      return processorStock
        .filter((s) => s.supplierId && supplierMap.has(s.supplierId))
        .map((s) => {
          const supplier = supplierMap.get(s.supplierId!)!;
          return {
            processorId: s.supplierId!,
            processorName: supplier.name,
            processorCode: supplier.code,
            warehouseName: s.warehouseLocation,
            totalQuantity: Number(s._sum.quantityAvailable) || 0,
            stockEntries: s._count.id,
          };
        });
    } catch (error: unknown) {
      logError('Error getting processors with greige stock:', error);
      throw new Error(
        `Failed to get processors with greige stock: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get greige stock at a specific processor (for processor return)
   */
  async getProcessorGreigeStock(processorId: string): Promise<GreigeStockItem[]> {
    return this.getGreigeStock({
      supplierId: processorId,
      sourceType: 'TRANSFER',
      status: 'AVAILABLE',
      minQuantity: 0.01,
    });
  }

  /**
   * Consume greige from processor's stock when receiving processed goods
   * Creates audit trail with shrinkage tracking
   */
  async consumeFromProcessor(
    stockId: string,
    sentQuantity: number,
    receivedQuantity: number,
    userId: string,
    options?: {
      notes?: string;
      referenceType?: TransactionReferenceType;
      referenceId?: string;
    }
  ): Promise<{
    sentQuantity: number;
    receivedQuantity: number;
    shrinkageQuantity: number;
    shrinkagePercent: number;
  }> {
    const stock = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: { greige: { select: { greigeCode: true, greigeName: true } } },
    });

    if (!stock) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    const available = Number(stock.quantityAvailable);
    if (sentQuantity > available) {
      throw new Error(`Cannot consume ${sentQuantity}. Only ${available} meters available at processor.`);
    }

    // Calculate shrinkage
    const shrinkageQuantity = sentQuantity - receivedQuantity;
    const shrinkagePercent = sentQuantity > 0 ? (shrinkageQuantity / sentQuantity) * 100 : 0;

    // Consume the sent quantity from processor's stock
    const newAvailable = available - sentQuantity;
    await prisma.greige_stock.update({
      where: { id: stockId },
      data: {
        quantityAvailable: new Prisma.Decimal(newAvailable),
        quantityConsumed: new Prisma.Decimal(Number(stock.quantityConsumed) + sentQuantity),
        lastConsumedDate: new Date(),
        status: newAvailable <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
      },
    });

    // Create audit trail
    const costPerUnit = stock.purchaseCost
      ? Number(stock.purchaseCost)
      : stock.weightedAvgCost
        ? Number(stock.weightedAvgCost)
        : null;

    await prisma.greige_stock_transaction.create({
      data: {
        stockId,
        transactionType: 'RECEIPT', // Receiving greige back from processor
        quantity: new Prisma.Decimal(-sentQuantity),
        balanceAfter: new Prisma.Decimal(newAvailable),
        costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
        totalValue: costPerUnit !== null ? new Prisma.Decimal(sentQuantity * costPerUnit) : null,
        referenceType: options?.referenceType || 'PROCESSING_DELIVERY',
        referenceId: options?.referenceId,
        notes:
          `Processor return: Sent ${sentQuantity}m, Received ${receivedQuantity}m. ` +
          `Shrinkage: ${shrinkageQuantity.toFixed(2)}m (${shrinkagePercent.toFixed(2)}%). ` +
          (options?.notes || ''),
        performedById: userId,
      },
    });

    logInfo(
      `Processor return: ${stock.greige.greigeCode} - Sent ${sentQuantity}m, Received ${receivedQuantity}m, ` +
        `Shrinkage: ${shrinkagePercent.toFixed(2)}%`
    );

    return {
      sentQuantity,
      receivedQuantity,
      shrinkageQuantity,
      shrinkagePercent,
    };
  }

  /**
   * Receive partial quantity from processor's stock
   * Used for partial returns - NO shrinkage calculation (shrinkage is a reconciliation exercise)
   *
   * @param stockId - The processor's greige stock entry ID
   * @param receivedQuantity - Quantity being received now (partial)
   * @param userId - User performing the action
   * @param options - Additional options (notes, reference)
   */
  async receiveFromProcessor(
    stockId: string,
    receivedQuantity: number,
    userId: string,
    options?: {
      notes?: string;
      referenceType?: TransactionReferenceType;
      referenceId?: string;
    }
  ): Promise<{
    receivedQuantity: number;
    remainingAtProcessor: number;
  }> {
    const stock = await prisma.greige_stock.findUnique({
      where: { id: stockId },
      include: { greige: { select: { greigeCode: true, greigeName: true } } },
    });

    if (!stock) {
      throw new Error(`Greige stock with ID ${stockId} not found`);
    }

    const available = Number(stock.quantityAvailable);
    if (receivedQuantity > available) {
      throw new Error(`Cannot receive ${receivedQuantity}. Only ${available} meters available at processor.`);
    }

    // Consume the received quantity from processor's stock
    const remainingAtProcessor = available - receivedQuantity;
    await prisma.greige_stock.update({
      where: { id: stockId },
      data: {
        quantityAvailable: new Prisma.Decimal(remainingAtProcessor),
        quantityConsumed: new Prisma.Decimal(Number(stock.quantityConsumed) + receivedQuantity),
        lastConsumedDate: new Date(),
        status: remainingAtProcessor <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
      },
    });

    // Create audit trail
    const costPerUnit = stock.purchaseCost
      ? Number(stock.purchaseCost)
      : stock.weightedAvgCost
        ? Number(stock.weightedAvgCost)
        : null;

    await prisma.greige_stock_transaction.create({
      data: {
        stockId,
        transactionType: 'RECEIPT', // Receiving greige back from processor
        quantity: new Prisma.Decimal(-receivedQuantity),
        balanceAfter: new Prisma.Decimal(remainingAtProcessor),
        costPerUnit: costPerUnit !== null ? new Prisma.Decimal(costPerUnit) : null,
        totalValue: costPerUnit !== null ? new Prisma.Decimal(receivedQuantity * costPerUnit) : null,
        referenceType: options?.referenceType || 'PROCESSING_DELIVERY',
        referenceId: options?.referenceId,
        notes:
          `Partial receipt from processor: ${receivedQuantity}m received. ` +
          `Remaining at processor: ${remainingAtProcessor.toFixed(2)}m. ` +
          (options?.notes || ''),
        performedById: userId,
      },
    });

    logInfo(
      `Processor receipt: ${stock.greige.greigeCode} - Received ${receivedQuantity}m, ` +
        `Remaining at processor: ${remainingAtProcessor.toFixed(2)}m`
    );

    return {
      receivedQuantity,
      remainingAtProcessor,
    };
  }
}

export default new GreigeStockService();
