/**
 * Thread Stock Service - Manage thread inventory directly
 * Uses the dedicated thread_stock table
 */
import { Prisma, StockStatus, SpecializedStockTransactionType, TransactionReferenceType } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { syncStockLevelQuantity, threadLotMaterialId } from './helpers/material-sync.helper';
import { threadPackUnit } from './helpers/thread-pack.helper';
import type { ThreadPackagingType, ThreadPly } from '../schemas/generated/prisma-enums';
import { multiplyCurrency, divideCurrency, toNumber } from '../utils/currency'; // BUG-THR6 fix

export interface CreateThreadStockDTO {
  threadId: string;
  /**
   * The PACK this lot is (owner, 2026-09-26: cones and tubes are separate stock items). Given = used as-is
   * (a GRN line's packing + ply, the Stock In row's pack; `packagingType: null` = an unpacked lot). Absent =
   * the thread master's own packing (legacy callers). The lot's materials row follows from it.
   */
  pack?: { packagingType: ThreadPackagingType | null; ply: ThreadPly | null };
  /** Quantity in the pack's unit — cones or tubes */
  quantity: number;
  /** The GRN line and PO this lot was received on — one lot per GRN line (reversal finds it by grnItemId) */
  grnItemId?: string;
  grnId?: string;
  procurementId?: string;
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

      // The pack decides the lot's row: a packed lot sits on its pack row, an unpacked one on the base row
      const packagingType = data.pack ? data.pack.packagingType : thread.packagingType;
      const ply = packagingType ? (data.pack ? data.pack.ply : thread.ply) : null;
      // Box size and metres per unit come from the ONE packaging table; the master's own figures are a fallback
      const spec =
        packagingType && ply
          ? await tx.thread_packaging_specs.findUnique({
              where: { ply_packagingType: { ply, packagingType } },
              select: { unitsPerBox: true, metersPerUnit: true },
            })
          : null;
      const unit = packagingType ? threadPackUnit(packagingType) : (data.unit ?? 'SPOOL');
      const metersPerUnit =
        data.metersPerUnit ?? (spec ? Number(spec.metersPerUnit) : Number(thread.metersPerUnit) || 5000);
      const unitsPerBox = data.unitsPerBox ?? (spec ? spec.unitsPerBox : Number(thread.unitsPerBox) || 12);

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
          ply,
          packagingType,
          procurementId: data.procurementId ?? null,
          grnItemId: data.grnItemId ?? null,
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
          referenceId: data.sourceType === 'GRN' ? (data.grnId ?? null) : null,
          notes: data.sourceType === 'MANUAL' ? 'Manual stock entry' : 'Stock receipt',
          performedById: userId,
        },
      });

      // Ensure the lot's materials row exists + sync stock_levels — on the PACK row, in cones / tubes (it used to
      // add METRES to the base row, so one thread's stock read 50,000 "cones" for 10 cones)
      // Skip when called from stock routing (parent already handles this)
      if (!data.skipMaterialSync) {
        const materialId = await threadLotMaterialId({ threadId: data.threadId, packagingType, ply }, tx);
        await syncStockLevelQuantity(materialId, data.quantity, data.warehouseId, unit, tx);
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
   * Get stock summary by thread AND pack — a thread held as cones and as tubes gives two rows, never one total
   */
  async getStockSummary() {
    const summary = await prisma.$queryRaw<
      Array<{
        threadId: string;
        threadCode: string;
        threadName: string;
        packagingType: string | null;
        ply: string | null;
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
        ts."packagingType"::text as "packagingType",
        ts.ply::text as "ply",
        SUM(ts."quantityAvailable") as "totalQuantity",
        SUM(ts."metersAvailable") as "totalMeters",
        SUM(ts."quantityAvailable" * ts."weightedAvgCost") as "totalValue",
        COUNT(*) as "entryCount"
      FROM thread_stock ts
      JOIN thread_master tm ON ts."threadId" = tm.id
      WHERE ts.status = 'AVAILABLE'
      GROUP BY ts."threadId", tm."threadCode", tm."threadName", ts."packagingType", ts.ply
      ORDER BY "totalValue" DESC
    `;

    return summary.map((s) => ({
      threadId: s.threadId,
      threadCode: s.threadCode,
      threadName: s.threadName,
      packagingType: s.packagingType,
      ply: s.ply,
      totalQuantity: Number(s.totalQuantity),
      totalMeters: Number(s.totalMeters),
      totalValue: Number(s.totalValue),
      entryCount: Number(s.entryCount),
    }));
  }
}

export const threadStockService = new ThreadStockService();
export default threadStockService;
