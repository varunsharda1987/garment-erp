/**
 * Fabric Stock Controller
 *
 * Manages fabric inventory, stock movements, transfers, and adjustments
 *
 * Features:
 * - Stock listing with filters (fabric, warehouse, quality grade, aging)
 * - Stock details with transaction history
 * - Stock dashboard (total value, aging alerts, low stock)
 * - Warehouse transfers
 * - Stock adjustments
 * - Aging stock reports
 * - Stock valuation reports
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import WeightedAverageCostService from '../services/WeightedAverageCostService';

const prisma = new PrismaClient();

// ==================== VALIDATION SCHEMAS ====================

const StockListQuerySchema = z.object({
  fabricId: z.string().uuid().optional(),
  warehouseLocation: z.string().optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'CONSUMED', 'TRANSFERRED']).optional(),
  qualityGrade: z.enum(['A', 'B', 'DEFECT']).optional(),
  stockType: z.enum(['PLANNED_STOCK', 'EXCESS_MOQ', 'CROSS_STYLE_REUSE']).optional(),
  agingDaysMin: z.number().int().nonnegative().optional(),
  originStyleId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1).optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});

const StockTransferSchema = z.object({
  stockId: z.string().uuid(),
  toWarehouse: z.string().min(1),
  toRackNumber: z.string().optional(),
  quantityToTransfer: z.number().positive(),
  notes: z.string().optional(),
});

const StockAdjustmentSchema = z.object({
  stockId: z.string().uuid(),
  adjustmentType: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.number().positive(),
  reason: z.string().min(1),
  notes: z.string().optional(),
});

// ==================== CONTROLLERS ====================

/**
 * GET /api/stock
 * List fabric stock with filters and pagination
 */
export const listStock = async (req: Request, res: Response) => {
  try {
    const query = StockListQuerySchema.parse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      agingDaysMin: req.query.agingDaysMin ? parseInt(req.query.agingDaysMin as string) : undefined,
    });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.fabricId) where.fabricId = query.fabricId;
    if (query.warehouseLocation) where.warehouseLocation = query.warehouseLocation;
    if (query.status) where.status = query.status;
    if (query.qualityGrade) where.qualityGrade = query.qualityGrade;
    if (query.stockType) where.stockType = query.stockType;
    if (query.originStyleId) where.originStyleId = query.originStyleId;
    if (query.agingDaysMin !== undefined) {
      where.agingDays = { gte: query.agingDaysMin };
    }

    // Get stocks
    const [stocks, total] = await Promise.all([
      prisma.fabric_stock.findMany({
        where,
        skip,
        take: limit,
        include: {
          fabricMaster: {
            select: {
              fabricCode: true,
              fabricName: true,
              colorName: true,
              actualWidth: true,
            },
          },
          procurement: {
            select: {
              purchaseOrderNumber: true,
              supplier: {
                select: { name: true },
              },
            },
          },
          originStyle: {
            select: {
              styleCode: true,
              styleName: true,
            },
          },
          originOrder: {
            select: {
              orderNumber: true,
            },
          },
        },
        orderBy: { receivedDate: 'desc' },
      }),
      prisma.fabric_stock.count({ where }),
    ]);

    res.json({
      success: true,
      data: stocks.map(s => ({
        id: s.id,
        fabricCode: s.fabricMaster.fabricCode,
        fabricName: s.fabricMaster.fabricName,
        colorName: s.fabricMaster.colorName,
        width: Number(s.width),
        quantityAvailable: Number(s.quantityAvailable),
        quantityReserved: Number(s.quantityReserved),
        quantityConsumed: Number(s.quantityConsumed),
        weightedAvgCost: Number(s.weightedAvgCost),
        purchaseCost: Number(s.purchaseCost),
        qualityGrade: s.qualityGrade,
        status: s.status,
        stockType: s.stockType,
        warehouseLocation: s.warehouseLocation,
        rackNumber: s.rackNumber,
        rollNumbers: s.rollNumbers,
        receivedDate: s.receivedDate,
        agingDays: s.agingDays,
        defectValue: s.defectValue ? Number(s.defectValue) : null,
        procurement: s.procurement ? {
          purchaseOrderNumber: s.procurement.purchaseOrderNumber,
          supplier: s.procurement.supplier?.name,
        } : null,
        originStyle: s.originStyle ? {
          styleCode: s.originStyle.styleCode,
          styleName: s.originStyle.styleName,
        } : null,
        originOrder: s.originOrder ? {
          orderNumber: s.originOrder.orderNumber,
        } : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error listing stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list stock',
    });
  }
};

/**
 * GET /api/stock/:id
 * Get detailed stock information including transaction history
 */
export const getStockById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stock = await prisma.fabric_stock.findUnique({
      where: { id },
      include: {
        fabricMaster: {
          include: {
            greige: true,
          },
        },
        procurement: {
          include: {
            supplier: true,
          },
        },
        originStyle: true,
        originOrder: true,
        stockTransactions: {
          orderBy: { transactionDate: 'desc' },
          include: {
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        stockAllocations: {
          include: {
            order: {
              select: {
                orderNumber: true,
              },
            },
            style: {
              select: {
                styleCode: true,
                styleName: true,
              },
            },
          },
        },
      },
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found',
      });
    }

    const stockData = stock as any;

    res.json({
      success: true,
      data: {
        ...stock,
        fabricMaster: stockData.fabricMaster,
        procurement: stockData.procurement,
        originStyle: stockData.originStyle,
        originOrder: stockData.originOrder,
        stockTransactions: stockData.stockTransactions?.map((t: any) => ({
          ...t,
          quantity: Number(t.quantity),
          costPerUnit: Number(t.costPerUnit),
          weightedAvgCost: Number(t.weightedAvgCost),
          totalValue: Number(t.totalValue),
          balanceAfter: Number(t.balanceAfter),
          valueAfter: Number(t.valueAfter),
        })) || [],
        stockAllocations: stockData.stockAllocations?.map((a: any) => ({
          ...a,
          quantityAllocated: Number(a.quantityAllocated),
          quantityConsumed: Number(a.quantityConsumed),
        })) || [],
      },
    });
  } catch (error) {
    console.error('Error getting stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stock details',
    });
  }
};

/**
 * GET /api/stock/dashboard
 * Get stock dashboard summary
 */
export const getStockDashboard = async (req: Request, res: Response) => {
  try {
    // Total stock value
    const stockAgg = await prisma.fabric_stock.aggregate({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      _sum: {
        quantityAvailable: true,
      },
    });

    // Get all active stock for value calculation
    const activeStocks = await prisma.fabric_stock.findMany({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      select: {
        quantityAvailable: true,
        weightedAvgCost: true,
      },
    });

    const totalStockValue = activeStocks.reduce((sum, s) => {
      return sum + (Number(s.quantityAvailable) * Number(s.weightedAvgCost));
    }, 0);

    // Aging stock (>180 days)
    const agingStockCount = await prisma.fabric_stock.count({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
        agingDays: { gte: 180 },
      },
    });

    // Stock by quality grade
    const stockByGrade = await prisma.fabric_stock.groupBy({
      by: ['qualityGrade'],
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      _sum: {
        quantityAvailable: true,
      },
    });

    // Stock by warehouse
    const stockByWarehouse = await prisma.fabric_stock.groupBy({
      by: ['warehouseLocation'],
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
        warehouseLocation: { not: null },
      },
      _sum: {
        quantityAvailable: true,
      },
    });

    // Top 10 fabrics by value
    const fabricStocks = await prisma.fabric_stock.findMany({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
      },
      include: {
        fabricMaster: {
          select: {
            fabricCode: true,
            fabricName: true,
            colorName: true,
          },
        },
      },
    });

    const fabricValueMap = new Map<string, { fabric: any; totalQty: number; totalValue: number }>();

    for (const stock of fabricStocks) {
      const key = stock.fabricId;
      const qty = Number(stock.quantityAvailable);
      const value = qty * Number(stock.weightedAvgCost);

      if (!fabricValueMap.has(key)) {
        fabricValueMap.set(key, {
          fabric: stock.fabricMaster,
          totalQty: 0,
          totalValue: 0,
        });
      }

      const entry = fabricValueMap.get(key)!;
      entry.totalQty += qty;
      entry.totalValue += value;
    }

    const topFabrics = Array.from(fabricValueMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map(f => ({
        fabricCode: f.fabric.fabricCode,
        fabricName: f.fabric.fabricName,
        colorName: f.fabric.colorName,
        quantity: Math.round(f.totalQty * 100) / 100,
        value: Math.round(f.totalValue * 100) / 100,
      }));

    res.json({
      success: true,
      data: {
        summary: {
          totalQuantity: Number(stockAgg._sum.quantityAvailable) || 0,
          totalValue: Math.round(totalStockValue * 100) / 100,
          agingStockCount,
        },
        stockByGrade: stockByGrade.map(g => ({
          grade: g.qualityGrade,
          quantity: Number(g._sum.quantityAvailable) || 0,
        })),
        stockByWarehouse: stockByWarehouse.map(w => ({
          warehouse: w.warehouseLocation,
          quantity: Number(w._sum.quantityAvailable) || 0,
        })),
        topFabrics,
      },
    });
  } catch (error) {
    console.error('Error getting stock dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stock dashboard',
    });
  }
};

/**
 * GET /api/stock/aging
 * Get aging stock report
 */
export const getAgingStock = async (req: Request, res: Response) => {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 180;

    const agingStocks = await prisma.fabric_stock.findMany({
      where: {
        status: { in: ['AVAILABLE', 'RESERVED'] },
        agingDays: { gte: threshold },
      },
      include: {
        fabricMaster: {
          select: {
            fabricCode: true,
            fabricName: true,
            colorName: true,
          },
        },
      },
      orderBy: { agingDays: 'desc' },
    });

    const report = agingStocks.map(s => ({
      id: s.id,
      fabricCode: s.fabricMaster.fabricCode,
      fabricName: s.fabricMaster.fabricName,
      colorName: s.fabricMaster.colorName,
      quantityAvailable: Number(s.quantityAvailable),
      weightedAvgCost: Number(s.weightedAvgCost),
      stockValue: Number(s.quantityAvailable) * Number(s.weightedAvgCost),
      agingDays: s.agingDays,
      receivedDate: s.receivedDate,
      warehouseLocation: s.warehouseLocation,
      qualityGrade: s.qualityGrade,
      recommendation: s.agingDays > 365 ? 'URGENT - Consider liquidation' :
                      s.agingDays > 270 ? 'HIGH - Push for cross-style usage' :
                      'MEDIUM - Monitor and allocate',
    }));

    res.json({
      success: true,
      data: {
        threshold,
        totalAgingStock: report.length,
        totalAgingValue: report.reduce((sum, s) => sum + s.stockValue, 0),
        stocks: report,
      },
    });
  } catch (error) {
    console.error('Error getting aging stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get aging stock report',
    });
  }
};

/**
 * GET /api/stock/valuation
 * Get stock valuation by fabric
 */
export const getStockValuation = async (req: Request, res: Response) => {
  try {
    const fabricId = req.query.fabricId as string | undefined;

    if (fabricId) {
      // Get valuation for specific fabric
      const valuation = await WeightedAverageCostService.getStockValuation(fabricId);
      return res.json({
        success: true,
        data: valuation,
      });
    }

    // Get valuation for all fabrics
    const fabrics = await prisma.fabric_master.findMany({
      select: { id: true, fabricCode: true, fabricName: true },
    });

    const valuations = await Promise.all(
      fabrics.map(f => WeightedAverageCostService.getStockValuation(f.id))
    );

    const totalValuation = valuations.reduce((sum, v) => sum + v.totalValue, 0);

    res.json({
      success: true,
      data: {
        totalValue: Math.round(totalValuation * 100) / 100,
        fabricCount: fabrics.length,
        valuations: valuations.filter(v => v.totalQuantity > 0),
      },
    });
  } catch (error) {
    console.error('Error getting stock valuation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stock valuation',
    });
  }
};

/**
 * POST /api/stock/transfer
 * Transfer stock between warehouses
 */
export const transferStock = async (req: Request, res: Response) => {
  try {
    const data = StockTransferSchema.parse(req.body);
    const userId = (req as any).user.userId;

    // Get stock record
    const stock = await prisma.fabric_stock.findUnique({
      where: { id: data.stockId },
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found',
      });
    }

    const available = Number(stock.quantityAvailable);

    if (available < data.quantityToTransfer) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock. Available: ${available}, Requested: ${data.quantityToTransfer}`,
      });
    }

    // Update stock record
    const updatedStock = await prisma.fabric_stock.update({
      where: { id: data.stockId },
      data: {
        warehouseLocation: data.toWarehouse,
        rackNumber: data.toRackNumber || stock.rackNumber,
      },
    });

    // Create transaction
    await prisma.fabric_stock_transaction.create({
      data: {
        stockId: data.stockId,
        transactionType: 'TRANSFER',
        quantity: data.quantityToTransfer,
        referenceType: 'MANUAL',
        costPerUnit: Number(stock.weightedAvgCost),
        weightedAvgCost: Number(stock.weightedAvgCost),
        totalValue: data.quantityToTransfer * Number(stock.weightedAvgCost),
        balanceAfter: available,
        valueAfter: available * Number(stock.weightedAvgCost),
        notes: data.notes || `Transferred to ${data.toWarehouse}`,
        createdById: userId,
      },
    });

    res.json({
      success: true,
      message: 'Stock transferred successfully',
      data: updatedStock,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error transferring stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer stock',
    });
  }
};

/**
 * POST /api/stock/adjust
 * Adjust stock quantities (increase/decrease for corrections)
 */
export const adjustStock = async (req: Request, res: Response) => {
  try {
    const data = StockAdjustmentSchema.parse(req.body);
    const userId = (req as any).user.userId;

    const stock = await prisma.fabric_stock.findUnique({
      where: { id: data.stockId },
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found',
      });
    }

    const currentQty = Number(stock.quantityAvailable);
    let newQty: number;

    if (data.adjustmentType === 'INCREASE') {
      newQty = currentQty + data.quantity;
    } else {
      if (currentQty < data.quantity) {
        return res.status(400).json({
          success: false,
          error: `Cannot decrease by ${data.quantity}. Only ${currentQty} available`,
        });
      }
      newQty = currentQty - data.quantity;
    }

    // Update stock
    const updatedStock = await prisma.fabric_stock.update({
      where: { id: data.stockId },
      data: {
        quantityAvailable: newQty,
      },
    });

    // Create transaction
    await prisma.fabric_stock_transaction.create({
      data: {
        stockId: data.stockId,
        transactionType: data.adjustmentType === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantity: data.quantity,
        referenceType: 'MANUAL',
        costPerUnit: Number(stock.weightedAvgCost),
        weightedAvgCost: Number(stock.weightedAvgCost),
        totalValue: data.quantity * Number(stock.weightedAvgCost),
        balanceAfter: newQty,
        valueAfter: newQty * Number(stock.weightedAvgCost),
        notes: `${data.reason}${data.notes ? ` - ${data.notes}` : ''}`,
        createdById: userId,
      },
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        previousQuantity: currentQty,
        newQuantity: newQty,
        adjustment: data.quantity,
        type: data.adjustmentType,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
      });
    }

    console.error('Error adjusting stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to adjust stock',
    });
  }
};

export default {
  listStock,
  getStockById,
  getStockDashboard,
  getAgingStock,
  getStockValuation,
  transferStock,
  adjustStock,
};
