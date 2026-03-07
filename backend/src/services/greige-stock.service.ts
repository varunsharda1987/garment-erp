// Greige Stock Service - Manage raw greige inventory directly
// This service uses the dedicated greige_stock table (not proxy fabric_master records)
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';

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

      // Get a default supplier if none provided
      let supplierId = data.supplierId;
      if (!supplierId) {
        const stockEntrySupplier = await prisma.suppliers.findFirst({
          where: {
            OR: [
              { code: 'STOCK-ENTRY' },
              { name: { contains: 'Stock Entry', mode: 'insensitive' } }
            ]
          }
        });

        if (stockEntrySupplier) {
          supplierId = stockEntrySupplier.id;
        } else {
          const anySupplier = await prisma.suppliers.findFirst({
            where: { isActive: true }
          });

          if (!anySupplier) {
            throw new Error('No suppliers found in the system. Please create a supplier first.');
          }

          supplierId = anySupplier.id;
        }
      }

      // Create procurement record for traceability
      const procurement = await prisma.fabric_procurement.create({
        data: {
          id: `PROC-GRG-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          procurementType: 'GREIGE',
          supplierId: supplierId,
          greigeId: data.greigeId,
          quantityPurchased: new Prisma.Decimal(data.quantity),
          unit: 'meters',
          width: new Prisma.Decimal(data.width),
          ratePerUnit: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : new Prisma.Decimal(0),
          totalCost: data.purchaseCost
            ? new Prisma.Decimal(data.quantity * data.purchaseCost)
            : new Prisma.Decimal(0),
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
          cutableWidth: data.cutableWidth
            ? new Prisma.Decimal(data.cutableWidth)
            : new Prisma.Decimal(data.width - 2), // Default cutable = width - 2
          purchaseCost: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : null,
          weightedAvgCost: data.purchaseCost
            ? new Prisma.Decimal(data.purchaseCost)
            : null,
          procurementId: procurement.id,
          supplierId: supplierId,
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
    status?: string;
    minQuantity?: number;
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
      throw new Error(`Failed to get greige stock summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
}

export default new GreigeStockService();
