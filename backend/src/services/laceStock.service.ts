/**
 * Lace Stock Service
 *
 * Manages lace stock inventory with full traceability:
 * - Stock entry creation (from GRN, processing receipt)
 * - Allocation to orders/styles
 * - Transfer between styles
 * - Consumption tracking
 * - Returns handling
 */

import prisma from '../config/database';
import { Prisma, StockEntryType, StockStatus } from '@prisma/client';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
import { toCurrency, multiplyCurrency, toNumber, roundToCent, Decimal } from '../utils/currency'; // BUG-LAC8 fix
import { applySearch } from '../utils/search-filter';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CreateLaceStockInput {
  laceId: string;
  lotNumber?: string;
  dyeLotNumber?: string;
  shadeNote?: string;
  originStyleId?: string;
  originOrderId?: string;
  originStyleCode?: string;
  procurementId?: string;
  processingBatchId?: string;
  warehouseId?: string; // Preferred: proper FK to warehouses
  warehouseLocation?: string; // Legacy: text location
  rackNumber?: string;
  quantityAvailable: number;
  weightedAvgCost: number;
  purchaseCost: number;
  qualityGrade?: string;
  stockType?: StockEntryType;
  createdById: string;
  skipMaterialSync?: boolean; // Skip ensureMaterialRecord/syncStockLevelQuantity when called from stock routing
  tx?: any; // Transaction client - use this instead of global prisma when provided
}

export interface AllocateStockInput {
  stockId: string;
  orderId: string;
  styleId: string;
  styleCode?: string;
  quantityToAllocate: number;
  allocationType?: string;
  notes?: string;
  createdById: string;
}

export interface TransferStockInput {
  stockId: string;
  toOrderId: string;
  toStyleId: string;
  toStyleCode?: string;
  quantityToTransfer: number;
  transferNotes?: string;
  performedById: string;
}

export interface ConsumeStockInput {
  allocationId: string;
  quantityConsumed: number;
  notes?: string;
  performedById: string;
}

export interface ReturnStockInput {
  allocationId: string;
  quantityToReturn: number;
  notes?: string;
  performedById: string;
}

export interface LaceStockFilters {
  laceId?: string;
  originStyleId?: string;
  originOrderId?: string;
  status?: StockStatus;
  stockType?: StockEntryType;
  qualityGrade?: string;
  warehouseLocation?: string;
  minQuantity?: number;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// STOCK MANAGEMENT
// ============================================================================

/**
 * Create a new lace stock entry
 */
export async function createLaceStock(input: CreateLaceStockInput) {
  // Use transaction client if provided, otherwise use global prisma
  const client = input.tx || prisma;

  // Validate lace exists
  const lace = await client.lace_master.findUnique({
    where: { id: input.laceId },
    select: { id: true, laceCode: true, laceName: true, isGreige: true },
  });

  if (!lace) {
    throw new Error('Lace not found');
  }

  const stock = await client.lace_stock.create({
    data: {
      laceId: input.laceId,
      lotNumber: input.lotNumber,
      dyeLotNumber: input.dyeLotNumber,
      shadeNote: input.shadeNote,
      originStyleId: input.originStyleId,
      originOrderId: input.originOrderId,
      originStyleCode: input.originStyleCode,
      procurementId: input.procurementId,
      processingBatchId: input.processingBatchId,
      warehouseId: input.warehouseId,
      warehouseLocation: input.warehouseLocation,
      rackNumber: input.rackNumber,
      quantityAvailable: input.quantityAvailable,
      weightedAvgCost: input.weightedAvgCost,
      purchaseCost: input.purchaseCost,
      qualityGrade: input.qualityGrade || 'A',
      status: 'AVAILABLE',
      stockType: input.stockType || 'PLANNED_STOCK',
      receivedDate: new Date(),
      createdById: input.createdById,
    },
    include: {
      laceMaster: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
          width: true,
        },
      },
    },
  });

  // Create initial stock transaction
  await client.lace_stock_transaction.create({
    data: {
      stockId: stock.id,
      transactionType: 'STOCK_IN',
      quantity: input.quantityAvailable,
      balanceAfter: input.quantityAvailable,
      referenceType: input.procurementId ? 'GRN' : input.processingBatchId ? 'PROCESSING_BATCH' : 'MANUAL',
      referenceId: input.procurementId || input.processingBatchId || null,
      notes: 'Initial stock entry',
      performedById: input.createdById,
    },
  });

  // Ensure materials record exists + sync stock_levels
  // Skip when called from stock routing (parent already handles this)
  if (!input.skipMaterialSync) {
    await ensureMaterialRecord(input.laceId, 'LACE');
    await syncStockLevelQuantity(input.laceId, Number(input.quantityAvailable), input.warehouseId);
  }

  return stock;
}

/**
 * Get lace stock by ID with full details
 */
export async function getLaceStockById(id: string) {
  const stock = await prisma.lace_stock.findUnique({
    where: { id },
    include: {
      laceMaster: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
          width: true,
          composition: true,
          laceType: true,
          isGreige: true,
        },
      },
      originStyle: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
        },
      },
      originOrder: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
      processingBatch: {
        select: {
          id: true,
          batchNumber: true,
          dyeLotNumber: true,
          colorToApply: true,
        },
      },
      allocations: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          style: {
            select: {
              id: true,
              styleCode: true,
              buyerStyleRef: true,
              styleName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!stock) {
    return stock;
  }

  // Derive FIFO aging days from receivedDate so the detail page badge/bucket render
  // real values (previously undefined -> "undefined days old" / wrong bucket color).
  const agingDays = Math.floor((Date.now() - stock.receivedDate.getTime()) / (1000 * 60 * 60 * 24));
  return { ...stock, originBuyerStyleRef: stock.originStyle?.buyerStyleRef ?? null, agingDays };
}

/**
 * Get all lace stock with filters and pagination
 */
export async function getAllLaceStock(filters: LaceStockFilters = {}) {
  const { page = 1, limit = 20, ...filterValues } = filters;
  const offset = (page - 1) * limit;

  const where: Prisma.lace_stockWhereInput = {};

  if (filterValues.laceId) {
    where.laceId = filterValues.laceId;
  }

  if (filterValues.originStyleId) {
    where.originStyleId = filterValues.originStyleId;
  }

  if (filterValues.originOrderId) {
    where.originOrderId = filterValues.originOrderId;
  }

  if (filterValues.status) {
    where.status = filterValues.status;
  }

  if (filterValues.stockType) {
    where.stockType = filterValues.stockType;
  }

  if (filterValues.qualityGrade) {
    where.qualityGrade = filterValues.qualityGrade;
  }

  if (filterValues.warehouseLocation) {
    where.warehouseLocation = filterValues.warehouseLocation;
  }

  if (filterValues.minQuantity !== undefined) {
    where.quantityAvailable = {
      gte: filterValues.minQuantity,
    };
  }

  if (filterValues.search) {
    applySearch(where, filterValues.search, [
      'lotNumber',
      'dyeLotNumber',
      'originStyleCode',
      'laceMaster.laceName',
      'laceMaster.laceCode',
    ]);
  }

  const [total, stocks] = await Promise.all([
    prisma.lace_stock.count({ where }),
    prisma.lace_stock.findMany({
      where,
      include: {
        laceMaster: {
          select: {
            id: true,
            laceCode: true,
            laceName: true,
            color: true,
            width: true,
            isGreige: true,
          },
        },
        originStyle: {
          select: {
            id: true,
            styleCode: true,
            buyerStyleRef: true,
            styleName: true,
          },
        },
      },
      orderBy: [
        { receivedDate: 'asc' }, // FIFO - oldest first
      ],
      skip: offset,
      take: limit,
    }),
  ]);

  // Derive FIFO aging days per lot from receivedDate so the list badge (`${agingDays}d`)
  // and the >60d "Aging Alert" summary count work (agingDays was otherwise undefined).
  const now = Date.now();
  const stocksWithAging = stocks.map((stock) => ({
    ...stock,
    originBuyerStyleRef: stock.originStyle?.buyerStyleRef ?? null,
    agingDays: Math.floor((now - stock.receivedDate.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return {
    data: stocksWithAging,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get available stock for a lace item (for allocation)
 */
export async function getAvailableStockForLace(laceId: string, minQuantity: number = 0) {
  const stocks = await prisma.lace_stock.findMany({
    where: {
      laceId,
      status: 'AVAILABLE',
      quantityAvailable: { gt: minQuantity },
    },
    include: {
      laceMaster: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
        },
      },
      originStyle: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
        },
      },
    },
    orderBy: [
      { receivedDate: 'asc' }, // FIFO
    ],
  });

  // Calculate totals using decimal.js for precision (BUG-LAC8 fix)
  const totalAvailableDecimal = stocks.reduce(
    (sum, s) => sum.plus(toCurrency(Number(s.quantityAvailable))),
    new Decimal(0)
  );
  const totalAvailable = toNumber(totalAvailableDecimal);

  // WAC = sum(qty * cost) / sum(qty) using decimal.js (BUG-LAC8 fix)
  const weightedAvgCostDecimal = totalAvailableDecimal.isZero()
    ? new Decimal(0)
    : stocks
        .reduce(
          (sum, s) => sum.plus(multiplyCurrency(Number(s.quantityAvailable), Number(s.weightedAvgCost))),
          new Decimal(0)
        )
        .dividedBy(totalAvailableDecimal);
  const weightedAvgCost = toNumber(roundToCent(weightedAvgCostDecimal));

  return {
    stocks,
    summary: {
      totalLots: stocks.length,
      totalAvailable,
      weightedAvgCost,
    },
  };
}

// ============================================================================
// ALLOCATION MANAGEMENT
// ============================================================================

/**
 * Allocate stock to an order/style
 */
export async function allocateStock(input: AllocateStockInput) {
  const stock = await prisma.lace_stock.findUnique({
    where: { id: input.stockId },
    select: {
      id: true,
      quantityAvailable: true,
      status: true,
      originStyleId: true,
      originStyleCode: true,
      originOrderId: true,
    },
  });

  if (!stock) {
    throw new Error('Stock not found');
  }

  if (stock.status !== 'AVAILABLE') {
    throw new Error('Stock is not available for allocation');
  }

  const available = Number(stock.quantityAvailable);
  if (input.quantityToAllocate > available) {
    throw new Error(`Insufficient stock. Available: ${available}, Requested: ${input.quantityToAllocate}`);
  }

  // Determine allocation type
  let allocationType = input.allocationType || 'SAME_STYLE';
  if (stock.originStyleId && stock.originStyleId !== input.styleId) {
    allocationType = 'CROSS_STYLE_REUSE';
  } else if (!stock.originStyleId) {
    allocationType = 'GENERIC_STOCK';
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create allocation
    const allocation = await tx.lace_stock_allocation.create({
      data: {
        stockId: input.stockId,
        orderId: input.orderId,
        styleId: input.styleId,
        styleCode: input.styleCode,
        originalStyleId: stock.originStyleId,
        originalStyleCode: stock.originStyleCode,
        originalOrderId: stock.originOrderId,
        allocationType,
        quantityAllocated: input.quantityToAllocate,
        allocationStatus: 'RESERVED',
        createdById: input.createdById,
      },
      include: {
        stock: {
          include: {
            laceMaster: {
              select: {
                id: true,
                laceCode: true,
                laceName: true,
              },
            },
          },
        },
        style: {
          select: {
            id: true,
            styleCode: true,
            buyerStyleRef: true,
            styleName: true,
          },
        },
      },
    });

    // Update stock
    const newAvailable = available - input.quantityToAllocate;
    await tx.lace_stock.update({
      where: { id: input.stockId },
      data: {
        quantityAvailable: newAvailable,
        quantityReserved: { increment: input.quantityToAllocate },
        status: newAvailable === 0 ? 'RESERVED' : 'AVAILABLE',
      },
    });

    // Create transaction
    await tx.lace_stock_transaction.create({
      data: {
        stockId: input.stockId,
        transactionType: 'ALLOCATION',
        quantity: -input.quantityToAllocate,
        balanceAfter: newAvailable,
        toStyleId: input.styleId,
        toStyleCode: input.styleCode,
        referenceType: 'ORDER',
        referenceId: input.orderId,
        notes: input.notes || `Allocated to ${input.styleCode || input.styleId}`,
        performedById: input.createdById,
      },
    });

    return allocation;
  });

  return result;
}

/**
 * Transfer stock from one style to another
 */
export async function transferStock(input: TransferStockInput) {
  const stock = await prisma.lace_stock.findUnique({
    where: { id: input.stockId },
    include: {
      allocations: {
        where: { allocationStatus: 'RESERVED' },
      },
    },
  });

  if (!stock) {
    throw new Error('Stock not found');
  }

  const available = Number(stock.quantityAvailable);
  if (input.quantityToTransfer > available) {
    throw new Error(`Insufficient available stock. Available: ${available}, Requested: ${input.quantityToTransfer}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create new allocation for target style
    const allocation = await tx.lace_stock_allocation.create({
      data: {
        stockId: input.stockId,
        orderId: input.toOrderId,
        styleId: input.toStyleId,
        styleCode: input.toStyleCode,
        originalStyleId: stock.originStyleId,
        originalStyleCode: stock.originStyleCode,
        originalOrderId: stock.originOrderId,
        allocationType: 'CROSS_STYLE_REUSE',
        transferredFromStyleId: stock.originStyleId,
        transferDate: new Date(),
        transferNotes: input.transferNotes,
        quantityAllocated: input.quantityToTransfer,
        allocationStatus: 'RESERVED',
        createdById: input.performedById,
      },
    });

    // Update stock
    const newAvailable = available - input.quantityToTransfer;
    await tx.lace_stock.update({
      where: { id: input.stockId },
      data: {
        quantityAvailable: newAvailable,
        quantityReserved: { increment: input.quantityToTransfer },
        status: newAvailable === 0 ? 'RESERVED' : 'AVAILABLE',
      },
    });

    // Create transfer transaction
    await tx.lace_stock_transaction.create({
      data: {
        stockId: input.stockId,
        transactionType: 'TRANSFER_OUT',
        quantity: -input.quantityToTransfer,
        balanceAfter: newAvailable,
        fromStyleId: stock.originStyleId,
        fromStyleCode: stock.originStyleCode,
        toStyleId: input.toStyleId,
        toStyleCode: input.toStyleCode,
        referenceType: 'ALLOCATION',
        referenceId: allocation.id,
        notes: input.transferNotes,
        performedById: input.performedById,
      },
    });

    return allocation;
  });

  return result;
}

/**
 * Consume allocated stock (issue to production)
 */
export async function consumeStock(input: ConsumeStockInput) {
  const allocation = await prisma.lace_stock_allocation.findUnique({
    where: { id: input.allocationId },
    include: {
      stock: true,
    },
  });

  if (!allocation) {
    throw new Error('Allocation not found');
  }

  const allocated = Number(allocation.quantityAllocated);
  const consumed = Number(allocation.quantityConsumed);
  const remaining = allocated - consumed;

  if (input.quantityConsumed > remaining) {
    throw new Error(
      `Cannot consume more than allocated. Remaining: ${remaining}, Requested: ${input.quantityConsumed}`
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update allocation
    const newConsumed = consumed + input.quantityConsumed;
    const updatedAllocation = await tx.lace_stock_allocation.update({
      where: { id: input.allocationId },
      data: {
        quantityConsumed: newConsumed,
        allocationStatus: newConsumed >= allocated ? 'CONSUMED' : 'IN_USE',
      },
    });

    // Update stock
    await tx.lace_stock.update({
      where: { id: allocation.stockId },
      data: {
        quantityConsumed: { increment: input.quantityConsumed },
        quantityReserved: { decrement: input.quantityConsumed },
        lastConsumedDate: new Date(),
      },
    });

    // BUG-INV3 fix: find materials.id instead of using laceId directly
    if (allocation.stock.laceId) {
      const material = await tx.materials.findFirst({
        where: { laceId: allocation.stock.laceId },
        select: { id: true },
      });
      if (material) {
        await syncStockLevelQuantity(
          material.id,
          -input.quantityConsumed,
          allocation.stock.warehouseId ?? undefined,
          'METER',
          tx
        );
      }
    }

    // Create transaction
    await tx.lace_stock_transaction.create({
      data: {
        stockId: allocation.stockId,
        transactionType: 'CONSUMPTION',
        quantity: -input.quantityConsumed,
        balanceAfter: Number(allocation.stock.quantityAvailable), // Available doesn't change
        referenceType: 'ALLOCATION',
        referenceId: input.allocationId,
        notes: input.notes || 'Issued to production',
        performedById: input.performedById,
      },
    });

    return updatedAllocation;
  });

  return result;
}

/**
 * Return unused stock from production
 */
export async function returnStock(input: ReturnStockInput) {
  const allocation = await prisma.lace_stock_allocation.findUnique({
    where: { id: input.allocationId },
    include: {
      stock: true,
    },
  });

  if (!allocation) {
    throw new Error('Allocation not found');
  }

  const allocated = Number(allocation.quantityAllocated);
  const consumed = Number(allocation.quantityConsumed);
  const returned = Number(allocation.quantityReturned);
  const maxReturnable = allocated - consumed - returned;

  if (input.quantityToReturn > maxReturnable) {
    throw new Error(`Cannot return more than available. Max returnable: ${maxReturnable}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update allocation
    const newReturned = returned + input.quantityToReturn;
    const updatedAllocation = await tx.lace_stock_allocation.update({
      where: { id: input.allocationId },
      data: {
        quantityReturned: newReturned,
        allocationStatus: 'RETURNED',
      },
    });

    // Update stock - add back to available
    await tx.lace_stock.update({
      where: { id: allocation.stockId },
      data: {
        quantityAvailable: { increment: input.quantityToReturn },
        quantityReserved: { decrement: input.quantityToReturn },
        status: 'AVAILABLE',
        stockType: 'RETURNED',
      },
    });

    // Create transaction
    await tx.lace_stock_transaction.create({
      data: {
        stockId: allocation.stockId,
        transactionType: 'RETURN',
        quantity: input.quantityToReturn,
        balanceAfter: Number(allocation.stock.quantityAvailable) + input.quantityToReturn,
        referenceType: 'ALLOCATION',
        referenceId: input.allocationId,
        notes: input.notes || 'Returned from production',
        performedById: input.performedById,
      },
    });

    return updatedAllocation;
  });

  return result;
}

// ============================================================================
// REPORTS & ANALYTICS
// ============================================================================

/**
 * Get stock aging report
 */
export async function getStockAgingReport(minAgeDays: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minAgeDays);

  const agingStock = await prisma.lace_stock.findMany({
    where: {
      receivedDate: { lt: cutoffDate },
      quantityAvailable: { gt: 0 },
      status: 'AVAILABLE',
    },
    include: {
      laceMaster: {
        select: {
          id: true,
          laceCode: true,
          laceName: true,
          color: true,
        },
      },
      originStyle: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
        },
      },
    },
    orderBy: {
      receivedDate: 'asc',
    },
  });

  // Calculate aging days for each stock
  const now = new Date();
  const stockWithAging = agingStock.map((stock) => {
    const agingDays = Math.floor((now.getTime() - stock.receivedDate.getTime()) / (1000 * 60 * 60 * 24));
    // BUG-LAC8 fix: use decimal.js for precise valuation
    const value = toNumber(
      roundToCent(multiplyCurrency(Number(stock.quantityAvailable), Number(stock.weightedAvgCost)))
    );
    return {
      ...stock,
      originBuyerStyleRef: stock.originStyle?.buyerStyleRef ?? null,
      agingDays,
      value,
    };
  });

  // Group by aging brackets
  const brackets = {
    '90-180 days': stockWithAging.filter((s) => s.agingDays >= 90 && s.agingDays < 180),
    '180-365 days': stockWithAging.filter((s) => s.agingDays >= 180 && s.agingDays < 365),
    'Over 1 year': stockWithAging.filter((s) => s.agingDays >= 365),
  };

  // BUG-LAC8 fix: use decimal.js for precise aggregations
  const summary = {
    totalItems: agingStock.length,
    totalQuantity: toNumber(
      stockWithAging.reduce((sum, s) => sum.plus(toCurrency(Number(s.quantityAvailable))), new Decimal(0))
    ),
    totalValue: toNumber(roundToCent(stockWithAging.reduce((sum, s) => sum.plus(toCurrency(s.value)), new Decimal(0)))),
    brackets: Object.entries(brackets).map(([label, items]) => ({
      label,
      count: items.length,
      quantity: toNumber(items.reduce((sum, s) => sum.plus(toCurrency(Number(s.quantityAvailable))), new Decimal(0))),
      value: toNumber(roundToCent(items.reduce((sum, s) => sum.plus(toCurrency(s.value)), new Decimal(0)))),
    })),
  };

  return {
    stocks: stockWithAging,
    summary,
  };
}

/**
 * Get stock utilization report (cross-style reuse statistics)
 */
export async function getStockUtilizationReport() {
  const allocations = await prisma.lace_stock_allocation.groupBy({
    by: ['allocationType'],
    _count: { id: true },
    _sum: { quantityAllocated: true },
  });

  const transfers = await prisma.lace_stock_transaction.count({
    where: { transactionType: 'TRANSFER_OUT' },
  });

  return {
    allocationsByType: allocations.map((a) => ({
      type: a.allocationType,
      count: a._count.id,
      totalQuantity: Number(a._sum.quantityAllocated) || 0,
    })),
    totalTransfers: transfers,
  };
}

/**
 * Get transaction history for a stock lot
 */
export async function getStockTransactionHistory(stockId: string) {
  const transactions = await prisma.lace_stock_transaction.findMany({
    where: { stockId },
    include: {
      performedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      transactionDate: 'desc',
    },
  });

  return transactions;
}

// ============================================================================
// LOT-LEVEL MOVEMENT (job work issuance)
// ============================================================================

type LaceStockClient = Prisma.TransactionClient | typeof prisma;

interface LaceMovementOptions {
  referenceType?: 'CHALLAN' | 'JOB_WORK_ORDER' | 'PROCESSING_BATCH';
  referenceId?: string;
  notes?: string;
}

/**
 * Consume lace stock off ONE lot — the lace twin of consumeGreigeStock.
 *
 * This is the writer for sending lace out of the building (job work issuance). It differs from
 * `consumeStock` above, which draws down an ALLOCATION and leaves quantityAvailable alone: goods
 * physically leaving must come out of available, or the same metres remain issuable to a second job.
 *
 * SEMANTICS: consumes AVAILABLE only — quantityReserved is never touched, so a consume can never
 * silently spend another order's reservation. The availability check and the decrement are ONE
 * guarded statement, so two concurrent issues cannot both pass a stale check.
 */
export async function consumeLaceStock(
  stockId: string,
  quantity: number,
  userId: string,
  tx?: LaceStockClient,
  options?: LaceMovementOptions
) {
  const client = (tx || prisma) as typeof prisma;

  // Guarded atomic consume — the check IS the write.
  const consumed = await client.lace_stock.updateMany({
    where: { id: stockId, quantityAvailable: { gte: quantity } },
    data: {
      quantityAvailable: { decrement: quantity },
      quantityConsumed: { increment: quantity },
      lastConsumedDate: new Date(),
    },
  });
  if (consumed.count === 0) {
    const row = await client.lace_stock.findUnique({ where: { id: stockId } });
    if (!row) throw new Error(`Lace stock lot ${stockId} not found`);
    const available = Number(row.quantityAvailable);
    const reserved = Number(row.quantityReserved);
    throw new Error(
      `Insufficient lace stock. Available: ${available}, Requested: ${quantity}` +
        (reserved > 0 ? ` (${reserved} is reserved and cannot be consumed here)` : '')
    );
  }

  // Exhausted only when nothing remains in EITHER bucket. Reserved metres are physically present
  // (allocateStock moves them out of available into reserved), so a lot with a live reservation
  // must stay visible — releasing it later puts the metres back.
  await client.lace_stock.updateMany({
    where: { id: stockId, quantityAvailable: { lte: 0 }, quantityReserved: { lte: 0 } },
    data: { status: 'EXHAUSTED' },
  });

  const lot = await client.lace_stock.findUnique({ where: { id: stockId } });
  if (!lot) throw new Error(`Lace stock lot ${stockId} not found after consumption`);

  const costPerUnit = lot.purchaseCost ? Number(lot.purchaseCost) : Number(lot.weightedAvgCost);
  await client.lace_stock_transaction.create({
    data: {
      stockId,
      transactionType: 'CONSUMPTION',
      quantity: new Prisma.Decimal(-quantity),
      balanceAfter: lot.quantityAvailable,
      referenceType: options?.referenceType ?? 'JOB_WORK_ORDER',
      referenceId: options?.referenceId ?? null,
      notes: options?.notes ?? `Issued to job work (₹${costPerUnit}/m)`,
      performedById: userId,
    },
  });

  // materials.id === lace_master.id by the same-ID convention, but resolve it rather than assume:
  // a lace with no shim row must not silently skip the central ledger.
  const material = await client.materials.findFirst({ where: { laceId: lot.laceId }, select: { id: true } });
  if (material) {
    await syncStockLevelQuantity(material.id, -quantity, lot.warehouseId || undefined, 'METER', client);
  } else {
    await ensureMaterialRecord(lot.laceId, 'LACE');
    await syncStockLevelQuantity(lot.laceId, -quantity, lot.warehouseId || undefined, 'METER', client);
  }

  return lot;
}

/**
 * Put consumed lace back on its lot — the exact inverse of consumeLaceStock, for a cancelled
 * issuance or lace returned unprocessed.
 *
 * The guarded predicate (quantityConsumed >= quantity) refuses to over-credit, so a replayed
 * cancel cannot mint stock that was never issued.
 */
export async function restoreLaceStock(
  stockId: string,
  quantity: number,
  userId: string,
  tx?: LaceStockClient,
  options?: LaceMovementOptions
) {
  const client = (tx || prisma) as typeof prisma;

  const restored = await client.lace_stock.updateMany({
    where: { id: stockId, quantityConsumed: { gte: quantity } },
    data: {
      quantityAvailable: { increment: quantity },
      quantityConsumed: { decrement: quantity },
      // Metres are back on the shelf, so the lot is usable again whatever it was marked before.
      status: 'AVAILABLE',
    },
  });
  if (restored.count === 0) {
    const row = await client.lace_stock.findUnique({ where: { id: stockId } });
    if (!row) throw new Error(`Lace stock lot ${stockId} not found`);
    throw new Error(
      `Cannot return ${quantity}m: only ${Number(row.quantityConsumed)}m of this lot is recorded as consumed`
    );
  }

  const lot = await client.lace_stock.findUnique({ where: { id: stockId } });
  if (!lot) throw new Error(`Lace stock lot ${stockId} not found after return`);

  await client.lace_stock_transaction.create({
    data: {
      stockId,
      transactionType: 'RETURN',
      quantity: new Prisma.Decimal(quantity),
      balanceAfter: lot.quantityAvailable,
      referenceType: options?.referenceType ?? 'JOB_WORK_ORDER',
      referenceId: options?.referenceId ?? null,
      notes: options?.notes ?? 'Returned unissued',
      performedById: userId,
    },
  });

  const material = await client.materials.findFirst({ where: { laceId: lot.laceId }, select: { id: true } });
  if (material) {
    await syncStockLevelQuantity(material.id, quantity, lot.warehouseId || undefined, 'METER', client);
  } else {
    await ensureMaterialRecord(lot.laceId, 'LACE');
    await syncStockLevelQuantity(lot.laceId, quantity, lot.warehouseId || undefined, 'METER', client);
  }

  return lot;
}

export default {
  createLaceStock,
  consumeLaceStock,
  restoreLaceStock,
  getLaceStockById,
  getAllLaceStock,
  getAvailableStockForLace,
  allocateStock,
  transferStock,
  consumeStock,
  returnStock,
  getStockAgingReport,
  getStockUtilizationReport,
  getStockTransactionHistory,
};
