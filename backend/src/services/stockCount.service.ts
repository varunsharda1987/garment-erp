// Stock Count Service - Physical inventory count management
import { CountType, CountStatus, Unit, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/database';
import stockMovementService from './stockMovement.service';
import stockLevelService from './stockLevel.service';
import { getDerivedStockDetailed, getDerivedValuation, DerivedStockDetailedRow } from './helpers/derived-stock.helper';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';

export interface CreateStockCountDTO {
  warehouseId: string;
  countType: CountType;
  countDate?: Date;
  remarks?: string;
  countedById: string;
  materialIds?: string[]; // For PARTIAL or SPOT_CHECK counts
}

export interface UpdateStockCountDTO {
  status?: CountStatus;
  remarks?: string;
  verifiedById?: string;
  approvedById?: string;
}

export interface CreateCountItemDTO {
  stockCountId: string;
  materialId: string;
  systemQuantity: Decimal;
  physicalQuantity?: Decimal;
  unit: Unit;
  remarks?: string;
}

export interface UpdateCountItemDTO {
  physicalQuantity?: Decimal;
  remarks?: string;
}

export interface StockCountFilters {
  warehouseId?: string;
  status?: CountStatus;
  countType?: CountType;
  startDate?: Date;
  endDate?: Date;
}

class StockCountService {
  /**
   * Create a new stock count
   */
  async createStockCount(data: CreateStockCountDTO) {
    // Get materials to count from the DERIVED per-lot source (derived_stock_view), not the
    // stock_levels shim. The derived helpers use the global prisma client (consistent snapshot),
    // so run the read BEFORE opening the transaction.
    let materialsToCount: DerivedStockDetailedRow[] = [];

    if (data.countType === 'FULL') {
      // All materials with per-lot stock rows in the warehouse (includes derived qty 0 rows)
      materialsToCount = await getDerivedStockDetailed({ warehouseId: data.warehouseId });
    } else if (data.countType === 'PARTIAL' || data.countType === 'SPOT_CHECK') {
      // Specific materials
      if (!data.materialIds || data.materialIds.length === 0) {
        throw new Error('Material IDs required for PARTIAL or SPOT_CHECK counts');
      }

      const requestedIds = new Set(data.materialIds);
      materialsToCount = (await getDerivedStockDetailed({ warehouseId: data.warehouseId })).filter((row) =>
        requestedIds.has(row.materialId)
      );
    } else if (data.countType === 'CYCLE') {
      // ABC analysis - high-value materials
      // Derived valuation rows are already quantity > 0, sorted by stockValue desc
      const { rows } = await getDerivedValuation({ warehouseId: data.warehouseId });
      materialsToCount = rows.slice(0, 50); // Top 50 high-value items
    }

    return await prisma.$transaction(async (tx) => {
      // Validate warehouse exists (the count number no longer embeds the warehouse code)
      const warehouse = await tx.warehouses.findUnique({
        where: { id: data.warehouseId },
        select: { id: true },
      });
      if (!warehouse) {
        throw new Error('Warehouse not found');
      }

      // Generate count number
      const countNumber = await this.generateCountNumber(tx);

      // Create stock count header
      const stockCount = await tx.stock_counts.create({
        data: {
          countNumber,
          warehouseId: data.warehouseId,
          countType: data.countType,
          countDate: data.countDate || new Date(),
          status: 'DRAFT',
          remarks: data.remarks,
          countedById: data.countedById,
        },
        include: {
          warehouses: {
            select: {
              warehouseCode: true,
              warehouseName: true,
            },
          },
        },
      });

      // Create count items (systemQuantity = derived per-lot truth)
      const countItems = await Promise.all(
        materialsToCount.map((row) =>
          tx.stock_count_items.create({
            data: {
              stockCountId: stockCount.id,
              materialId: row.materialId,
              systemQuantity: row.quantity,
              unit: row.unit as Unit,
            },
          })
        )
      );

      // Update count header with totals
      await tx.stock_counts.update({
        where: { id: stockCount.id },
        data: {
          totalItems: countItems.length,
        },
      });

      return stockCount;
    });
  }

  /**
   * Get all stock counts with filters
   */
  async getAllStockCounts(filters?: StockCountFilters) {
    const where: Prisma.stock_countsWhereInput = {};

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.countType) {
      where.countType = filters.countType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.countDate = {};
      if (filters.startDate) {
        where.countDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.countDate.lte = filters.endDate;
      }
    }

    const stockCounts = await prisma.stock_counts.findMany({
      where,
      include: {
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
          },
        },
      },
      orderBy: { countDate: 'desc' },
    });

    return stockCounts;
  }

  /**
   * Get stock count by ID
   */
  async getStockCountById(id: string) {
    const stockCount = await prisma.stock_counts.findUnique({
      where: { id },
      include: {
        warehouses: {
          select: {
            id: true,
            warehouseCode: true,
            warehouseName: true,
            warehouseType: true,
          },
        },
        stock_count_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!stockCount) {
      throw new Error(`Stock count not found with ID: ${id}`);
    }

    return stockCount;
  }

  /**
   * Update stock count item with physical count
   */
  async updateCountItem(itemId: string, data: UpdateCountItemDTO) {
    const item = await prisma.stock_count_items.findUnique({
      where: { id: itemId },
      include: {
        stock_counts: true,
      },
    });

    if (!item) {
      throw new Error(`Count item not found with ID: ${itemId}`);
    }

    if (item.stock_counts.status !== 'DRAFT' && item.stock_counts.status !== 'IN_PROGRESS') {
      throw new Error('Cannot update count item after count is completed');
    }

    // Calculate variance
    let variance: Decimal | null = null;
    if (data.physicalQuantity !== undefined) {
      variance = new Decimal(data.physicalQuantity.toString()).sub(item.systemQuantity.toString());
    }

    const updated = await prisma.stock_count_items.update({
      where: { id: itemId },
      data: {
        physicalQuantity: data.physicalQuantity,
        variance,
        remarks: data.remarks,
      },
      include: {
        materials: true,
      },
    });

    // Update parent count progress
    await this.updateCountProgress(item.stockCountId);

    return updated;
  }

  /**
   * Update count progress (counted items, variance items)
   */
  private async updateCountProgress(stockCountId: string) {
    const items = await prisma.stock_count_items.findMany({
      where: { stockCountId },
    });

    const countedItems = items.filter((i) => i.physicalQuantity !== null).length;
    const varianceItems = items.filter((i) => i.variance !== null && !new Decimal(i.variance.toString()).eq(0)).length;

    await prisma.stock_counts.update({
      where: { id: stockCountId },
      data: {
        countedItems,
        varianceItems,
        status: countedItems === items.length ? 'COUNTED' : 'IN_PROGRESS',
      },
    });
  }

  /**
   * Start counting process (change status to IN_PROGRESS)
   */
  async startCounting(id: string) {
    const stockCount = await prisma.stock_counts.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
      include: {
        warehouses: true,
      },
    });

    return stockCount;
  }

  /**
   * Verify stock count
   */
  async verifyStockCount(id: string, verifiedById: string) {
    const stockCount = await prisma.stock_counts.findUnique({
      where: { id },
    });

    if (!stockCount) {
      throw new Error(`Stock count not found with ID: ${id}`);
    }

    if (stockCount.status !== 'COUNTED') {
      throw new Error('Stock count must be fully counted before verification');
    }

    const updated = await prisma.stock_counts.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedById,
        verifiedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Approve stock count and apply adjustments
   */
  async approveStockCount(id: string, approvedById: string) {
    return await prisma.$transaction(async (tx) => {
      const stockCount = await tx.stock_counts.findUnique({
        where: { id },
        include: {
          stock_count_items: {
            include: {
              materials: true,
            },
          },
          warehouses: true,
        },
      });

      if (!stockCount) {
        throw new Error(`Stock count not found with ID: ${id}`);
      }

      if (stockCount.status !== 'VERIFIED') {
        throw new Error('Stock count must be verified before approval');
      }

      // Apply adjustments for all items with variance
      const adjustments = [];

      for (const item of stockCount.stock_count_items) {
        if (item.variance && !new Decimal(item.variance.toString()).eq(0)) {
          const varianceQty = new Decimal(item.variance.toString());

          // Create stock adjustment
          const adjustment = await stockMovementService.createStockAdjustment({
            materialId: item.materialId,
            warehouseId: stockCount.warehouseId,
            adjustmentQuantity: varianceQty,
            unit: item.unit,
            reason: `Physical count adjustment - Count #${stockCount.countNumber}`,
            performedById: approvedById,
          });

          adjustments.push(adjustment);
        }
      }

      // Update stock count status
      const approved = await tx.stock_counts.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById,
          approvedAt: new Date(),
        },
        include: {
          warehouses: true,
          stock_count_items: {
            include: {
              materials: true,
            },
          },
        },
      });

      return {
        stockCount: approved,
        adjustments,
        adjustmentCount: adjustments.length,
      };
    });
  }

  /**
   * Cancel stock count
   */
  async cancelStockCount(id: string) {
    const stockCount = await prisma.stock_counts.findUnique({
      where: { id },
    });

    if (!stockCount) {
      throw new Error(`Stock count not found with ID: ${id}`);
    }

    if (stockCount.status === 'APPROVED') {
      throw new Error('Cannot cancel approved stock count');
    }

    const cancelled = await prisma.stock_counts.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    return cancelled;
  }

  /**
   * Get variance report for a stock count
   */
  async getVarianceReport(id: string) {
    const stockCount = await prisma.stock_counts.findUnique({
      where: { id },
      include: {
        warehouses: true,
        stock_count_items: {
          where: {
            variance: { not: null },
          },
          include: {
            materials: {
              select: {
                code: true,
                name: true,
                unit: true,
              },
            },
          },
          orderBy: { variance: 'desc' },
        },
      },
    });

    if (!stockCount) {
      throw new Error(`Stock count not found with ID: ${id}`);
    }

    const varianceItems = stockCount.stock_count_items.filter(
      (item) => item.variance && !new Decimal(item.variance.toString()).eq(0)
    );

    const totalVariance = varianceItems.reduce((sum, item) => {
      return sum + Math.abs(parseFloat(item.variance?.toString() || '0'));
    }, 0);

    const positiveVariance = varianceItems.filter((item) => new Decimal(item.variance?.toString() || '0').gt(0));

    const negativeVariance = varianceItems.filter((item) => new Decimal(item.variance?.toString() || '0').lt(0));

    return {
      stockCount,
      varianceItems,
      totalVarianceItems: varianceItems.length,
      totalVariance,
      positiveVarianceCount: positiveVariance.length,
      negativeVarianceCount: negativeVariance.length,
    };
  }

  /**
   * Generate stock count number (SC2607-0001).
   * Atomic sequence — the old findFirst+parse+increment raced under concurrency.
   * Pass the caller's transaction client so the bump commits/rolls back with it.
   */
  private async generateCountNumber(tx?: Prisma.TransactionClient): Promise<string> {
    return generateAtomicDocNumber('SC', tx);
  }

  /**
   * Get count summary for a warehouse
   */
  async getCountSummary(warehouseId: string, startDate: Date, endDate: Date) {
    const counts = await prisma.stock_counts.findMany({
      where: {
        warehouseId,
        countDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        stock_count_items: true,
      },
    });

    const summary = {
      totalCounts: counts.length,
      fullCounts: counts.filter((c) => c.countType === 'FULL').length,
      cycleCounts: counts.filter((c) => c.countType === 'CYCLE').length,
      approved: counts.filter((c) => c.status === 'APPROVED').length,
      pending: counts.filter((c) => c.status === 'DRAFT' || c.status === 'IN_PROGRESS').length,
      totalVarianceItems: counts.reduce((sum, c) => sum + c.varianceItems, 0),
      counts,
    };

    return summary;
  }
}

export default new StockCountService();
