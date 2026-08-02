/**
 * Thread Stock Service - Manage thread inventory directly
 * Uses the dedicated thread_stock table
 */
import { Prisma, StockStatus, SpecializedStockTransactionType, TransactionReferenceType } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
import { multiplyCurrency, divideCurrency, toNumber } from '../utils/currency'; // BUG-THR6 fix

export interface CreateThreadStockDTO {
  threadId: string;
  quantity: number;
  unit?: 'SPOOL' | 'CONE' | 'CONE_5K' | 'CONE_10K';
  metersPerUnit?: number;
  unitsPerBox?: number;
  purchaseCost?: number; // Optional, defaults to 0 for imports
  supplierLotNumber?: string;
  warehouseId?: string; // Preferred: proper FK to warehouses
  warehouseLocation?: string; // Legacy: text location
  rackNumber?: string;
  qualityGrade?: string;
  receivedDate?: Date;
  sourceType?: 'GRN' | 'MANUAL' | 'ADJUSTMENT' | 'IMPORT';
  skipMaterialSync?: boolean; // Skip ensureMaterialRecord/syncStockLevelQuantity when called from stock routing
  tx?: any; // Transaction client - use this instead of global prisma when provided
}

export interface ThreadStockItem {
  id: string;
  threadId: string;
  thread: {
    id: string;
    threadCode: string;
    threadName: string;
    color: string | null;
    ply: string | null;
    packagingType: string | null;
    metersPerUnit: number | null;
  };
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  unit: string;
  metersAvailable: number | null;
  boxesAvailable: number | null;
  purchaseCost: number;
  weightedAvgCost: number;
  warehouseLocation: string | null;
  rackNumber: string | null;
  qualityGrade: string;
  receivedDate: Date;
  status: string;
  stockType: string;
}

class ThreadStockService {
  /**
   * Create thread stock entry directly
   */
  async createThreadStock(data: CreateThreadStockDTO, userId: string) {
    // The stock row + its ledger transaction + stock_levels sync must be atomic. Join a caller's tx when
    // supplied; otherwise open our own so a partial failure can't leave stock with no ledger/stock_levels
    // entry (bug-hunt T1/F4).
    const run = async (tx: any) => {
      // Validate thread exists
      const thread = await tx.thread_master.findUnique({
        where: { id: data.threadId },
        include: { colorMaster: { select: { colorName: true } } },
      });
      if (!thread) {
        throw new Error(`Thread with ID ${data.threadId} not found`);
      }

      const unit = data.unit ?? thread.packagingType ?? 'SPOOL';
      const metersPerUnit = data.metersPerUnit ?? Number(thread.metersPerUnit) ?? 5000;
      const unitsPerBox = data.unitsPerBox ?? Number(thread.unitsPerBox) ?? 12;

      // Calculate derived quantities - BUG-THR6 fix: use decimal.js to prevent floating-point errors
      const metersAvailable = toNumber(multiplyCurrency(data.quantity, metersPerUnit));
      const boxesAvailable = toNumber(divideCurrency(data.quantity, unitsPerBox)); // divideCurrency returns 0 if divisor is 0

      // Create thread stock record
      const cost = data.purchaseCost ?? 0;
      const threadStock = await tx.thread_stock.create({
        data: {
          threadId: data.threadId,
          quantityAvailable: new Prisma.Decimal(data.quantity),
          quantityReserved: new Prisma.Decimal(0),
          quantityConsumed: new Prisma.Decimal(0),
          unit: unit,
          metersAvailable: new Prisma.Decimal(metersAvailable),
          boxesAvailable: new Prisma.Decimal(boxesAvailable),
          purchaseCost: new Prisma.Decimal(cost),
          weightedAvgCost: new Prisma.Decimal(cost),
          ply: thread.ply,
          packagingType: thread.packagingType,
          materialComposition: thread.materialComposition,
          colorName: thread.colorMaster?.colorName || thread.color || null,
          supplierLotNumber: data.supplierLotNumber || null,
          warehouseId: data.warehouseId || null,
          warehouseLocation: data.warehouseLocation || null,
          rackNumber: data.rackNumber || null,
          qualityGrade: data.qualityGrade || 'A',
          status: 'AVAILABLE',
          stockType: data.sourceType === 'GRN' ? 'PLANNED_STOCK' : 'GENERIC',
          receivedDate: data.receivedDate || new Date(),
          agingDays: 0,
          createdById: userId,
        },
        include: {
          threadMaster: {
            select: {
              id: true,
              threadCode: true,
              threadName: true,
              color: true,
              ply: true,
              packagingType: true,
              metersPerUnit: true,
            },
          },
        },
      });

      // Create transaction record
      await tx.thread_stock_transaction.create({
        data: {
          stockId: threadStock.id,
          transactionType: 'RECEIPT',
          quantity: new Prisma.Decimal(data.quantity),
          balanceAfter: new Prisma.Decimal(data.quantity),
          referenceType: data.sourceType === 'GRN' ? 'GRN' : 'MANUAL',
          notes: data.sourceType === 'MANUAL' ? 'Manual stock entry' : 'Stock receipt',
          performedById: userId,
        },
      });

      // Ensure materials record exists + sync stock_levels
      // Skip when called from stock routing (parent already handles this)
      if (!data.skipMaterialSync) {
        const materialId = await ensureMaterialRecord(data.threadId, 'THREAD', tx);
        await syncStockLevelQuantity(materialId, metersAvailable, data.warehouseId, 'METER', tx);
      }

      logInfo(`Created thread stock for ${thread.threadCode}: ${data.quantity} ${unit} (${metersAvailable}m)`);

      return threadStock;
    };

    try {
      return data.tx ? await run(data.tx) : await prisma.$transaction(run);
    } catch (error: unknown) {
      logError('Error creating thread stock:', error);
      throw new Error(`Failed to create thread stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available thread stock
   */
  async getThreadStock(filters?: {
    threadId?: string;
    status?: StockStatus;
    minQuantity?: number;
    warehouseLocation?: string;
    packagingType?: string;
  }): Promise<ThreadStockItem[]> {
    try {
      const where: Prisma.thread_stockWhereInput = {
        status: filters?.status || 'AVAILABLE',
      };

      if (filters?.threadId) {
        where.threadId = filters.threadId;
      }
      if (filters?.minQuantity !== undefined) {
        where.quantityAvailable = { gte: filters.minQuantity };
      }
      if (filters?.warehouseLocation) {
        where.warehouseLocation = filters.warehouseLocation;
      }
      if (filters?.packagingType) {
        where.packagingType = filters.packagingType as any;
      }

      const stocks = await prisma.thread_stock.findMany({
        where,
        include: {
          threadMaster: {
            select: {
              id: true,
              threadCode: true,
              threadName: true,
              color: true,
              ply: true,
              packagingType: true,
              metersPerUnit: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      });

      return stocks.map((s) => ({
        id: s.id,
        threadId: s.threadId,
        thread: {
          id: s.threadMaster.id,
          threadCode: s.threadMaster.threadCode,
          threadName: s.threadMaster.threadName,
          color: s.threadMaster.color,
          ply: s.threadMaster.ply,
          packagingType: s.threadMaster.packagingType,
          metersPerUnit: s.threadMaster.metersPerUnit ? Number(s.threadMaster.metersPerUnit) : null,
        },
        quantityAvailable: Number(s.quantityAvailable),
        quantityReserved: Number(s.quantityReserved),
        quantityConsumed: Number(s.quantityConsumed),
        unit: s.unit,
        metersAvailable: s.metersAvailable ? Number(s.metersAvailable) : null,
        boxesAvailable: s.boxesAvailable ? Number(s.boxesAvailable) : null,
        purchaseCost: Number(s.purchaseCost),
        weightedAvgCost: Number(s.weightedAvgCost),
        warehouseLocation: s.warehouseLocation,
        rackNumber: s.rackNumber,
        qualityGrade: s.qualityGrade,
        receivedDate: s.receivedDate,
        status: s.status,
        stockType: s.stockType,
      }));
    } catch (error) {
      logError('Error fetching thread stock:', error);
      throw error;
    }
  }

  /**
   * Get thread stock by ID
   */
  async getById(id: string): Promise<ThreadStockItem | null> {
    const stock = await prisma.thread_stock.findUnique({
      where: { id },
      include: {
        threadMaster: {
          select: {
            id: true,
            threadCode: true,
            threadName: true,
            color: true,
            ply: true,
            packagingType: true,
            metersPerUnit: true,
          },
        },
      },
    });

    if (!stock) return null;

    return {
      id: stock.id,
      threadId: stock.threadId,
      thread: {
        id: stock.threadMaster.id,
        threadCode: stock.threadMaster.threadCode,
        threadName: stock.threadMaster.threadName,
        color: stock.threadMaster.color,
        ply: stock.threadMaster.ply,
        packagingType: stock.threadMaster.packagingType,
        metersPerUnit: stock.threadMaster.metersPerUnit ? Number(stock.threadMaster.metersPerUnit) : null,
      },
      quantityAvailable: Number(stock.quantityAvailable),
      quantityReserved: Number(stock.quantityReserved),
      quantityConsumed: Number(stock.quantityConsumed),
      unit: stock.unit,
      metersAvailable: stock.metersAvailable ? Number(stock.metersAvailable) : null,
      boxesAvailable: stock.boxesAvailable ? Number(stock.boxesAvailable) : null,
      purchaseCost: Number(stock.purchaseCost),
      weightedAvgCost: Number(stock.weightedAvgCost),
      warehouseLocation: stock.warehouseLocation,
      rackNumber: stock.rackNumber,
      qualityGrade: stock.qualityGrade,
      receivedDate: stock.receivedDate,
      status: stock.status,
      stockType: stock.stockType,
    };
  }

  /**
   * Get stock summary by thread
   */
  async getStockSummary() {
    const summary = await prisma.$queryRaw<
      Array<{
        threadId: string;
        threadCode: string;
        threadName: string;
        totalQuantity: Prisma.Decimal;
        totalMeters: Prisma.Decimal;
        totalValue: Prisma.Decimal;
        entryCount: bigint;
      }>
    >`
      SELECT
        ts."threadId",
        tm."threadCode",
        tm."threadName",
        SUM(ts."quantityAvailable") as "totalQuantity",
        SUM(ts."metersAvailable") as "totalMeters",
        SUM(ts."quantityAvailable" * ts."weightedAvgCost") as "totalValue",
        COUNT(*) as "entryCount"
      FROM thread_stock ts
      JOIN thread_master tm ON ts."threadId" = tm.id
      WHERE ts.status = 'AVAILABLE'
      GROUP BY ts."threadId", tm."threadCode", tm."threadName"
      ORDER BY "totalValue" DESC
    `;

    return summary.map((s) => ({
      threadId: s.threadId,
      threadCode: s.threadCode,
      threadName: s.threadName,
      totalQuantity: Number(s.totalQuantity),
      totalMeters: Number(s.totalMeters),
      totalValue: Number(s.totalValue),
      entryCount: Number(s.entryCount),
    }));
  }
}

export const threadStockService = new ThreadStockService();
export default threadStockService;
