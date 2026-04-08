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
import { Prisma } from '@prisma/client';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

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
  warehouseLocation?: string;
  rackNumber?: string;
  quantityAvailable: number;
  weightedAvgCost: number;
  purchaseCost: number;
  qualityGrade?: string;
  stockType?: string;
  createdById: string;
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
  status?: string;
  stockType?: string;
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
  // Validate lace exists
  const lace = await prisma.lace_master.findUnique({
    where: { id: input.laceId },
    select: { id: true, laceCode: true, laceName: true, isGreige: true },
  });

  if (!lace) {
    throw new Error('Lace not found');
  }

  const stock = await prisma.lace_stock.create({
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
  await prisma.lace_stock_transaction.create({
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
  await ensureMaterialRecord(input.laceId, 'LACE');
  await syncStockLevelQuantity(input.laceId, Number(input.quantityAvailable));

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

  return stock;
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
    where.OR = [
      { lotNumber: { contains: filterValues.search, mode: 'insensitive' } },
      { dyeLotNumber: { contains: filterValues.search, mode: 'insensitive' } },
      { originStyleCode: { contains: filterValues.search, mode: 'insensitive' } },
      { laceMaster: { laceName: { contains: filterValues.search, mode: 'insensitive' } } },
      { laceMaster: { laceCode: { contains: filterValues.search, mode: 'insensitive' } } },
    ];
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

  return {
    data: stocks,
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
        },
      },
    },
    orderBy: [
      { receivedDate: 'asc' }, // FIFO
    ],
  });

  // Calculate totals
  const totalAvailable = stocks.reduce((sum, s) => sum + Number(s.quantityAvailable), 0);
  const weightedAvgCost =
    totalAvailable > 0
      ? stocks.reduce((sum, s) => sum + Number(s.quantityAvailable) * Number(s.weightedAvgCost), 0) / totalAvailable
      : 0;

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
    const value = Number(stock.quantityAvailable) * Number(stock.weightedAvgCost);
    return {
      ...stock,
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

  const summary = {
    totalItems: agingStock.length,
    totalQuantity: stockWithAging.reduce((sum, s) => sum + Number(s.quantityAvailable), 0),
    totalValue: stockWithAging.reduce((sum, s) => sum + s.value, 0),
    brackets: Object.entries(brackets).map(([label, items]) => ({
      label,
      count: items.length,
      quantity: items.reduce((sum, s) => sum + Number(s.quantityAvailable), 0),
      value: items.reduce((sum, s) => sum + s.value, 0),
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

export default {
  createLaceStock,
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
