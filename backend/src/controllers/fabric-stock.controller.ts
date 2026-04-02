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
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../config/database';
import WeightedAverageCostService from '../services/WeightedAverageCostService';
import { logInfo, logWarn, logDebug } from '../utils/logger';
import { NotFoundError, ValidationError } from '../errors';

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

const CreateStockSchema = z.object({
  fabricId: z.string().uuid(),
  width: z.number().positive(),
  quantityAvailable: z.number().positive(),
  rollNumbers: z.string().optional(),
  warehouseLocation: z.string().optional(),
  rackNumber: z.string().optional(),
  purchaseCost: z.number().nonnegative().optional(),
  qualityGrade: z.enum(['A', 'B', 'DEFECT']).default('A'),
  stockType: z.enum(['GENERIC', 'EXCESS', 'PLANNED_STOCK', 'RETURNED', 'VARIANCE_UNUSED']).default('GENERIC'),
  receivedDate: z.string().or(z.date()).optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'CONSUMED', 'TRANSFERRED']).default('AVAILABLE'),
  procurementId: z.string().uuid().optional(),
  originStyleId: z.string().uuid().optional(),
  originOrderId: z.string().uuid().optional(),
});

const UpdateStockSchema = z
  .object({
    purchaseCost: z.number().nonnegative().optional(),
    weightedAvgCost: z.number().nonnegative().optional(),
    qualityGrade: z.enum(['A', 'B', 'DEFECT']).optional(),
    warehouseLocation: z.string().optional(),
    rackNumber: z.string().optional(),
    rollNumbers: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ==================== CONTROLLERS ====================

/**
 * POST /api/stock
 * Create new fabric stock entry
 */
export const createStock = async (req: Request, res: Response) => {
  logInfo('Creating fabric stock with data:', req.body);
  const data = CreateStockSchema.parse(req.body);
  const userId = req.user?.userId;
  logInfo('Parsed data:', data);
  logInfo('User ID:', userId);

  // Validate fabric exists
  const fabric = await prisma.fabric_master.findUnique({
    where: { id: data.fabricId },
  });

  if (!fabric) {
    throw new NotFoundError('Fabric', data.fabricId);
  }
  logInfo('Fabric found:', fabric.fabricCode);

  // Auto-resolve originStyleId from fabric's style_fabrics link if not provided
  let resolvedOriginStyleId = data.originStyleId || null;
  if (!resolvedOriginStyleId) {
    const styleFabricLink = await prisma.style_fabrics.findFirst({
      where: { fabricId: data.fabricId },
      select: {
        style_components: {
          select: { styleId: true },
        },
      },
    });
    if (styleFabricLink?.style_components?.styleId) {
      resolvedOriginStyleId = styleFabricLink.style_components.styleId;
      logInfo(`Auto-resolved originStyleId=${resolvedOriginStyleId} from fabric ${fabric.fabricCode}`);
    }
  }

  // Parse receivedDate
  const receivedDate = data.receivedDate
    ? typeof data.receivedDate === 'string'
      ? new Date(data.receivedDate)
      : data.receivedDate
    : new Date();

  // Calculate aging days
  const agingDays = Math.floor((Date.now() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));

  // Create fabric stock record
  const fabricStock = await prisma.fabric_stock.create({
    data: {
      fabricMaster: {
        connect: { id: data.fabricId },
      },
      ...(data.procurementId && {
        procurement: {
          connect: { id: data.procurementId },
        },
      }),
      ...(resolvedOriginStyleId && {
        originStyle: {
          connect: { id: resolvedOriginStyleId },
        },
      }),
      ...(data.originOrderId && {
        originOrder: {
          connect: { id: data.originOrderId },
        },
      }),
      createdBy: {
        connect: { id: userId },
      },
      finishedWidth: new Prisma.Decimal(data.width),
      cutableWidth: new Prisma.Decimal(data.width - 2), // Default cutable = finished - 2
      quantityAvailable: new Prisma.Decimal(data.quantityAvailable),
      quantityReserved: new Prisma.Decimal(0),
      quantityConsumed: new Prisma.Decimal(0),
      unit: 'meters',
      status: data.status,
      stockType: data.stockType,
      weightedAvgCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
      purchaseCost: data.purchaseCost ? new Prisma.Decimal(data.purchaseCost) : new Prisma.Decimal(0),
      qualityGrade: data.qualityGrade,
      warehouseLocation: data.warehouseLocation || null,
      rackNumber: data.rackNumber || null,
      rollNumbers: data.rollNumbers || null,
      receivedDate: receivedDate,
      agingDays: agingDays,
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

  // Create initial stock transaction
  await prisma.fabric_stock_transaction.create({
    data: {
      fabricStock: {
        connect: { id: fabricStock.id },
      },
      transactionType: 'STOCK_IN',
      quantity: data.quantityAvailable,
      referenceType: 'MANUAL',
      costPerUnit: data.purchaseCost || 0,
      weightedAvgCost: data.purchaseCost || 0,
      totalValue: data.quantityAvailable * (data.purchaseCost || 0),
      balanceAfter: data.quantityAvailable,
      valueAfter: data.quantityAvailable * (data.purchaseCost || 0),
      notes: 'Initial stock entry',
      ...(userId && {
        createdBy: {
          connect: { id: userId },
        },
      }),
    },
  });

  logInfo('Fabric stock created successfully:', fabricStock.id);
  res.status(201).json({
    success: true,
    message: 'Fabric stock created successfully',
    data: fabricStock,
  });
};

/**
 * GET /api/stock
 * List fabric stock with filters and pagination
 */
export const listStock = async (req: Request, res: Response) => {
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
  const where: Prisma.fabric_stockWhereInput = {};

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
            finishedConstruction: true,
            valueAddition: true,
            styleReference: true,
            actualWidth: true,
            cutableWidth: true,
            greige: {
              select: {
                greigeCode: true,
                greigeName: true,
                composition: true,
              },
            },
            // Include style_fabrics to get componentType and pattern parts from the linked style
            styleFabrics: {
              take: 1,
              select: {
                style_components: {
                  select: {
                    componentName: true,
                    componentType: true,
                    styles: {
                      select: {
                        styleCode: true,
                      },
                    },
                  },
                },
                // Include pattern parts for repeat orders and CAD linking
                stylePatternParts: {
                  select: {
                    quantity: true,
                    goesToEmbroidery: true,
                    patternPart: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
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
    data: stocks.map((s) => {
      // Get style reference and component type from style_fabrics relation
      const styleFabric = s.fabricMaster.styleFabrics?.[0];
      const styleRefFromLink = styleFabric?.style_components?.styles?.styleCode;
      const componentType = styleFabric?.style_components?.componentType;
      const componentName = styleFabric?.style_components?.componentName;

      // Extract pattern parts for repeat orders and CAD linking
      const patternParts =
        styleFabric?.stylePatternParts?.map((spp) => ({
          id: spp.patternPart.id,
          code: spp.patternPart.code,
          name: spp.patternPart.name,
          quantity: spp.quantity,
          goesToEmbroidery: spp.goesToEmbroidery,
        })) || [];

      // Use styleReference from fabric_master, or fall back to style_fabrics link
      const effectiveStyleRef = s.fabricMaster.styleReference || styleRefFromLink;

      return {
        id: s.id,
        fabricId: s.fabricId,
        fabric: {
          fabricCode: s.fabricMaster.fabricCode,
          fabricName: s.fabricMaster.fabricName,
          colorName: s.fabricMaster.colorName,
          finishedConstruction: s.fabricMaster.finishedConstruction,
          valueAddition: s.fabricMaster.valueAddition,
          styleReference: effectiveStyleRef,
          componentType: componentType,
          componentName: componentName,
          patternParts: patternParts,
          actualWidth: s.fabricMaster.actualWidth,
          cutableWidth: s.fabricMaster.cutableWidth,
          greige: s.fabricMaster.greige,
        },
        width: Number(s.finishedWidth),
        unit: s.unit,
        finishedWidth: Number(s.finishedWidth),
        cutableWidth: Number(s.cutableWidth),
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
        procurement: s.procurement
          ? {
              purchaseOrderNumber: s.procurement.purchaseOrderNumber,
              supplier: s.procurement.supplier?.name,
            }
          : null,
        originStyle: s.originStyle
          ? {
              styleCode: s.originStyle.styleCode,
              styleName: s.originStyle.styleName,
            }
          : null,
        originOrder: s.originOrder
          ? {
              orderNumber: s.originOrder.orderNumber,
            }
          : null,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

/**
 * GET /api/styles/:styleId/fabric-stock
 * Get available fabric stock for a specific style (for CAD planning)
 * Returns stock entries where originStyleId matches or procurement was ordered for this style
 */
export const getStockForStyle = async (req: Request, res: Response) => {
  const styleId = req.params.styleId || req.params.id;
  const { fabricId, status, qualityGrade, embroideryId } = req.query;

  logInfo(`Getting fabric stock for style ${styleId}, embroideryId filter: ${embroideryId}`);

  // Get fabricIds linked to this style via style_fabrics
  const styleFabrics = await prisma.style_fabrics.findMany({
    where: {
      style_components: { styleId: styleId },
      fabricId: { not: null },
    },
    select: { fabricId: true },
  });
  const styleFabricIds = styleFabrics.map((sf) => sf.fabricId).filter((id): id is string => id !== null);

  // Build the where clause - match by originStyleId, procurement, OR fabricId
  const orConditions: any[] = [{ originStyleId: styleId }, { procurement: { orderedForStyleId: styleId } }];
  if (styleFabricIds.length > 0) {
    orConditions.push({ fabricId: { in: styleFabricIds } });
  }

  const where: any = {
    OR: orConditions,
  };

  // Add optional filters
  if (fabricId && typeof fabricId === 'string') {
    where.fabricId = fabricId;
  }
  if (status && typeof status === 'string') {
    where.status = status;
  } else {
    // Default to AVAILABLE status if not specified
    where.status = 'AVAILABLE';
  }
  if (qualityGrade && typeof qualityGrade === 'string') {
    where.qualityGrade = qualityGrade;
  }

  // Add embroideryId filter for CAD planning
  // - embroideryId=null or embroideryId='' → filter for plain (non-embroidered) stock only
  // - embroideryId=<uuid> → filter for specific embroidery design
  // - embroideryId not provided → return all stock (no filter)
  if (embroideryId !== undefined) {
    if (embroideryId === 'null' || embroideryId === '') {
      // Filter for plain (non-embroidered) stock
      where.embroideryId = null;
    } else if (typeof embroideryId === 'string' && embroideryId.length > 0) {
      // Filter for specific embroidery design
      where.embroideryId = embroideryId;
    }
  }

  const stockEntries = await prisma.fabric_stock.findMany({
    where,
    include: {
      fabricMaster: {
        include: {
          greige: true,
        },
      },
      procurement: true,
      embroidery: true, // Include embroidery relation for display
    },
    orderBy: {
      receivedDate: 'asc', // FIFO - oldest first
    },
  });

  // Transform to match FabricStockForCAD interface
  const transformedStock = stockEntries.map((stock) => ({
    id: stock.id,
    fabricId: stock.fabricId,
    fabricName: stock.fabricMaster?.fabricName || '',
    fabricCode: stock.fabricMaster?.fabricCode || '',
    colorName: stock.fabricMaster?.colorName || undefined,
    greigeId: stock.fabricMaster?.greigeId || '',
    greigeName: stock.fabricMaster?.greige?.greigeName || '',
    finishedWidth: stock.finishedWidth ? Number(stock.finishedWidth) : 0,
    cutableWidth: stock.cutableWidth
      ? Number(stock.cutableWidth)
      : stock.finishedWidth
        ? Number(stock.finishedWidth) - 2
        : 0, // Use cutableWidth if available, else estimate
    quantityAvailable: Number(stock.quantityAvailable),
    qualityGrade: stock.qualityGrade as 'A' | 'B' | 'DEFECT',
    rollNumbers: stock.rollNumbers || undefined,
    receivedDate: stock.receivedDate?.toISOString() || new Date().toISOString(),
    procurementId: stock.procurementId || undefined,
    originStyleId: stock.originStyleId || undefined,
    originOrderId: stock.originOrderId || undefined,
    status: stock.status,
    // Embroidery fields for CAD planning stock filtering
    embroideryId: stock.embroideryId || null,
    embroideryCode: (stock as any).embroidery?.embroideryCode || null,
    embroideryName: (stock as any).embroidery?.designName || null,
  }));

  logInfo(`Found ${transformedStock.length} stock entries for style ${styleId}`);

  res.json({
    success: true,
    data: transformedStock,
    count: transformedStock.length,
  });
};

/**
 * GET /api/stock/:id
 * Get detailed stock information including transaction history
 */
export const getStockById = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Stock', id);
  }

  res.json({
    success: true,
    data: {
      ...stock,
      stockTransactions:
        stock.stockTransactions?.map((t) => ({
          ...t,
          quantity: Number(t.quantity),
          costPerUnit: Number(t.costPerUnit),
          weightedAvgCost: Number(t.weightedAvgCost),
          totalValue: Number(t.totalValue),
          balanceAfter: Number(t.balanceAfter),
          valueAfter: Number(t.valueAfter),
        })) || [],
      stockAllocations:
        stock.stockAllocations?.map((a) => ({
          ...a,
          quantityAllocated: Number(a.quantityAllocated),
          quantityConsumed: Number(a.quantityConsumed),
        })) || [],
    },
  });
};

/**
 * GET /api/stock/dashboard
 * Get stock dashboard summary
 */
export const getStockDashboard = async (req: Request, res: Response) => {
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
    return sum + Number(s.quantityAvailable) * Number(s.weightedAvgCost);
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

  const fabricValueMap = new Map<
    string,
    {
      fabric: { fabricCode: string; fabricName: string; colorName: string | null };
      totalQty: number;
      totalValue: number;
    }
  >();

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
    .map((f) => ({
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
      stockByGrade: stockByGrade.map((g) => ({
        grade: g.qualityGrade,
        quantity: Number(g._sum.quantityAvailable) || 0,
      })),
      stockByWarehouse: stockByWarehouse.map((w) => ({
        warehouse: w.warehouseLocation,
        quantity: Number(w._sum.quantityAvailable) || 0,
      })),
      topFabrics,
    },
  });
};

/**
 * GET /api/stock/aging
 * Get aging stock report
 */
export const getAgingStock = async (req: Request, res: Response) => {
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

  const report = agingStocks.map((s) => ({
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
    recommendation:
      s.agingDays > 365
        ? 'URGENT - Consider liquidation'
        : s.agingDays > 270
          ? 'HIGH - Push for cross-style usage'
          : 'MEDIUM - Monitor and allocate',
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
};

/**
 * GET /api/stock/summary
 * Get fabric stock summary for unified dashboard
 */
export const getFabricStockSummary = async (req: Request, res: Response) => {
  // Get total metrics
  const stockAgg = await prisma.fabric_stock.aggregate({
    where: {
      status: { in: ['AVAILABLE', 'RESERVED'] },
    },
    _sum: {
      quantityAvailable: true,
    },
    _count: {
      id: true,
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
      qualityGrade: true,
      warehouseLocation: true,
      agingDays: true,
    },
  });

  const totalStockValue = activeStocks.reduce((sum, s) => {
    return sum + Number(s.quantityAvailable) * Number(s.weightedAvgCost);
  }, 0);

  // Aging stock count (>180 days)
  const agingStockCount = activeStocks.filter((s) => s.agingDays >= 180).length;

  // Stock by quality grade
  const byQualityGrade: Record<string, number> = {
    A: 0,
    B: 0,
    DEFECT: 0,
  };

  activeStocks.forEach((s) => {
    if (s.qualityGrade && byQualityGrade[s.qualityGrade] !== undefined) {
      byQualityGrade[s.qualityGrade] += Number(s.quantityAvailable);
    }
  });

  // Stock by warehouse
  const warehouseMap = new Map<string, number>();
  activeStocks.forEach((s) => {
    if (s.warehouseLocation) {
      const current = warehouseMap.get(s.warehouseLocation) || 0;
      warehouseMap.set(s.warehouseLocation, current + Number(s.quantityAvailable));
    }
  });

  const byWarehouse = Array.from(warehouseMap.entries()).map(([name, meters]) => ({
    warehouseName: name,
    meters: Math.round(meters * 100) / 100,
  }));

  res.json({
    success: true,
    data: {
      totalMeters: Math.round((Number(stockAgg._sum.quantityAvailable) || 0) * 100) / 100,
      totalValue: Math.round(totalStockValue * 100) / 100,
      agingStockCount,
      totalItems: stockAgg._count.id,
      byQualityGrade: {
        A: Math.round(byQualityGrade.A * 100) / 100,
        B: Math.round(byQualityGrade.B * 100) / 100,
        DEFECT: Math.round(byQualityGrade.DEFECT * 100) / 100,
      },
      byWarehouse,
    },
  });
};

/**
 * GET /api/stock/valuation
 * Get stock valuation by fabric
 */
export const getStockValuation = async (req: Request, res: Response) => {
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

  const valuations = await Promise.all(fabrics.map((f) => WeightedAverageCostService.getStockValuation(f.id)));

  const totalValuation = valuations.reduce((sum, v) => sum + v.totalValue, 0);

  res.json({
    success: true,
    data: {
      totalValue: Math.round(totalValuation * 100) / 100,
      fabricCount: fabrics.length,
      valuations: valuations.filter((v) => v.totalQuantity > 0),
    },
  });
};

/**
 * POST /api/stock/transfer
 * Transfer stock between warehouses
 */
export const transferStock = async (req: Request, res: Response) => {
  const data = StockTransferSchema.parse(req.body);
  const userId = req.user?.userId;

  // Get stock record
  const stock = await prisma.fabric_stock.findUnique({
    where: { id: data.stockId },
  });

  if (!stock) {
    throw new NotFoundError('Stock', data.stockId);
  }

  const available = Number(stock.quantityAvailable);

  if (available < data.quantityToTransfer) {
    throw new ValidationError(`Insufficient stock. Available: ${available}, Requested: ${data.quantityToTransfer}`);
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
};

/**
 * POST /api/stock/adjust
 * Adjust stock quantities (increase/decrease for corrections)
 */
export const adjustStock = async (req: Request, res: Response) => {
  const data = StockAdjustmentSchema.parse(req.body);
  const userId = req.user?.userId;

  const stock = await prisma.fabric_stock.findUnique({
    where: { id: data.stockId },
  });

  if (!stock) {
    throw new NotFoundError('Stock', data.stockId);
  }

  const currentQty = Number(stock.quantityAvailable);
  let newQty: number;

  if (data.adjustmentType === 'INCREASE') {
    newQty = currentQty + data.quantity;
  } else {
    if (currentQty < data.quantity) {
      throw new ValidationError(`Cannot decrease by ${data.quantity}. Only ${currentQty} available`);
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
};

/**
 * PATCH /api/stock/:id
 * Update fabric stock record (prices, quality grade, warehouse location)
 */
export const updateStock = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  logInfo(`Updating stock: ${id}`, { data: req.body });

  // Validate input
  const data = UpdateStockSchema.parse(req.body);

  // Get existing stock record
  const existingStock = await prisma.fabric_stock.findUnique({
    where: { id },
    include: {
      fabricMaster: {
        select: {
          fabricCode: true,
          fabricName: true,
          colorName: true,
        },
      },
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existingStock) {
    throw new NotFoundError('Stock', id);
  }

  // Only allow editing AVAILABLE or RESERVED stock
  if (existingStock.status !== 'AVAILABLE' && existingStock.status !== 'RESERVED') {
    throw new ValidationError(
      `Cannot edit stock with status ${existingStock.status}. Only AVAILABLE or RESERVED stock can be edited.`
    );
  }

  // Build update data
  const updateData: Prisma.fabric_stockUpdateInput = {};
  const changes: string[] = [];

  // Track price changes for audit trail
  let priceChanged = false;
  const oldPurchaseCost = Number(existingStock.purchaseCost);
  const oldWeightedAvgCost = Number(existingStock.weightedAvgCost);

  if (data.purchaseCost !== undefined) {
    updateData.purchaseCost = new Prisma.Decimal(data.purchaseCost);
    if (data.purchaseCost !== oldPurchaseCost) {
      priceChanged = true;
      changes.push(`purchaseCost ₹${oldPurchaseCost.toFixed(2)} → ₹${data.purchaseCost.toFixed(2)}`);
    }
  }

  if (data.weightedAvgCost !== undefined) {
    updateData.weightedAvgCost = new Prisma.Decimal(data.weightedAvgCost);
    if (data.weightedAvgCost !== oldWeightedAvgCost) {
      priceChanged = true;
      changes.push(`weightedAvgCost ₹${oldWeightedAvgCost.toFixed(2)} → ₹${data.weightedAvgCost.toFixed(2)}`);
    }
  }

  if (data.qualityGrade) {
    updateData.qualityGrade = data.qualityGrade;
    if (data.qualityGrade !== existingStock.qualityGrade) {
      changes.push(`qualityGrade ${existingStock.qualityGrade} → ${data.qualityGrade}`);
    }
  }

  if (data.warehouseLocation !== undefined) {
    updateData.warehouseLocation = data.warehouseLocation || null;
    if (data.warehouseLocation !== existingStock.warehouseLocation) {
      changes.push(
        `warehouseLocation ${existingStock.warehouseLocation || 'N/A'} → ${data.warehouseLocation || 'N/A'}`
      );
    }
  }

  if (data.rackNumber !== undefined) {
    updateData.rackNumber = data.rackNumber || null;
    if (data.rackNumber !== existingStock.rackNumber) {
      changes.push(`rackNumber ${existingStock.rackNumber || 'N/A'} → ${data.rackNumber || 'N/A'}`);
    }
  }

  if (data.rollNumbers !== undefined) {
    updateData.rollNumbers = data.rollNumbers || null;
    if (data.rollNumbers !== existingStock.rollNumbers) {
      changes.push(`rollNumbers updated`);
    }
  }

  // Update the stock record
  const updatedStock = await prisma.fabric_stock.update({
    where: { id },
    data: updateData,
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

  // Create audit transaction if price changed
  if (priceChanged) {
    const userName = existingStock.createdBy
      ? `${existingStock.createdBy.firstName} ${existingStock.createdBy.lastName}`
      : 'Unknown User';

    const transactionNotes = `Price updated: ${changes.filter((c) => c.includes('Cost')).join(', ')} by ${userName}`;

    await prisma.fabric_stock_transaction.create({
      data: {
        stockId: id,
        transactionType: 'PRICE_CORRECTION',
        referenceType: 'MANUAL_ADJUSTMENT',
        quantity: Number(existingStock.quantityAvailable),
        unit: existingStock.unit,
        costPerUnit: data.purchaseCost !== undefined ? data.purchaseCost : Number(existingStock.purchaseCost),
        weightedAvgCost:
          data.weightedAvgCost !== undefined ? data.weightedAvgCost : Number(existingStock.weightedAvgCost),
        totalValue:
          Number(existingStock.quantityAvailable) *
          (data.weightedAvgCost !== undefined ? data.weightedAvgCost : Number(existingStock.weightedAvgCost)),
        balanceAfter: Number(existingStock.quantityAvailable),
        valueAfter:
          Number(existingStock.quantityAvailable) *
          (data.weightedAvgCost !== undefined ? data.weightedAvgCost : Number(existingStock.weightedAvgCost)),
        notes: transactionNotes,
        ...(userId && {
          createdById: userId,
        }),
      },
    });
  }

  logInfo(`Stock updated successfully: ${id}`, { changes: changes.join('; ') });

  res.json({
    success: true,
    message: 'Stock updated successfully',
    data: {
      ...updatedStock,
      quantityAvailable: Number(updatedStock.quantityAvailable),
      quantityReserved: Number(updatedStock.quantityReserved),
      quantityConsumed: Number(updatedStock.quantityConsumed),
      finishedWidth: Number(updatedStock.finishedWidth),
      cutableWidth: Number(updatedStock.cutableWidth),
      purchaseCost: Number(updatedStock.purchaseCost),
      weightedAvgCost: Number(updatedStock.weightedAvgCost),
    },
    changes,
  });
};

/**
 * DELETE /api/stock/:id
 * Delete fabric stock record (HARD DELETE with dependency validation)
 *
 * Business Rules:
 * - ONLY delete if stock is completely unused (no dependencies)
 * - Check ALL dependency types
 * - Return detailed error if blocked
 * - Permanent deletion (cannot be undone)
 */
export const deleteStock = async (req: Request, res: Response) => {
  const { id } = req.params;

  // 1. Check if stock exists
  const existingStock = await prisma.fabric_stock.findUnique({
    where: { id },
    include: {
      fabricMaster: {
        select: {
          fabricCode: true,
          fabricName: true,
          colorName: true,
        },
      },
      _count: {
        select: {
          stockTransactions: true,
        },
      },
    },
  });

  if (!existingStock) {
    throw new NotFoundError('Stock', id);
  }

  // 2. Check for BLOCKING dependencies using _count
  const dependencies = await prisma.fabric_stock.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          stockAllocations: true,
          cutting_batches: true,
          job_work_orders: true,
          embroiderySourceFor: true,
          qualityInspections: true,
          fabric_physical_tests: true,
          fabricCostingItemsAsStockLot: true,
          cadProductionRecords: true,
        },
      },
      embroideryResultOf: {
        select: { id: true },
      },
    },
  });

  // 3. Build blocking dependency list
  const blockingDeps: string[] = [];

  if (dependencies?._count.stockAllocations) {
    blockingDeps.push(`${dependencies._count.stockAllocations} stock allocation(s)`);
  }
  if (dependencies?._count.cutting_batches) {
    blockingDeps.push(`${dependencies._count.cutting_batches} cutting batch(es)`);
  }
  if (dependencies?._count.job_work_orders) {
    blockingDeps.push(`${dependencies._count.job_work_orders} job work order(s)`);
  }
  if (dependencies?._count.embroiderySourceFor) {
    blockingDeps.push(`${dependencies._count.embroiderySourceFor} embroidery send-out(s)`);
  }
  if (dependencies?.embroideryResultOf) {
    blockingDeps.push(`1 embroidery result record`);
  }
  if (dependencies?._count.qualityInspections) {
    blockingDeps.push(`${dependencies._count.qualityInspections} quality inspection(s)`);
  }
  if (dependencies?._count.fabric_physical_tests) {
    blockingDeps.push(`${dependencies._count.fabric_physical_tests} physical test(s)`);
  }
  if (dependencies?._count.fabricCostingItemsAsStockLot) {
    blockingDeps.push(`${dependencies._count.fabricCostingItemsAsStockLot} costing item(s)`);
  }
  if (dependencies?._count.cadProductionRecords) {
    blockingDeps.push(`${dependencies._count.cadProductionRecords} CAD production record(s)`);
  }

  // 4. Block deletion if dependencies exist
  if (blockingDeps.length > 0) {
    throw new ValidationError(
      `Cannot delete stock with existing dependencies. This stock record has: ${blockingDeps.join(', ')}`
    );
  }

  // 5. Additional safety check: Warn if stock has been consumed or reserved
  if (Number(existingStock.quantityConsumed) > 0 || Number(existingStock.quantityReserved) > 0) {
    throw new ValidationError(
      `Cannot delete stock that has been consumed or reserved. This stock has ${existingStock.quantityConsumed}m consumed and ${existingStock.quantityReserved}m reserved`
    );
  }

  // 6. Save transaction count before deletion
  const transactionCount = existingStock._count.stockTransactions;

  // 7. Manually delete stock transactions first (Prisma schema doesn't have onDelete: Cascade)
  if (transactionCount > 0) {
    await prisma.fabric_stock_transaction.deleteMany({
      where: { stockId: id },
    });
    logInfo(`Deleted ${transactionCount} stock transaction(s) for stock ${id}`);
  }

  // 8. Perform hard delete of stock
  await prisma.fabric_stock.delete({
    where: { id },
  });

  logInfo(`Stock deleted: ${id} (${existingStock.fabricMaster?.fabricCode || 'Unknown'})`);

  // 9. Return success response
  res.json({
    success: true,
    message: 'Stock record deleted successfully',
    deletedStock: {
      id: existingStock.id,
      fabricCode: existingStock.fabricMaster?.fabricCode || 'Unknown',
      fabricName: existingStock.fabricMaster?.fabricName || 'Unknown',
      quantity: Number(existingStock.quantityAvailable),
    },
    cascadeDeleted: {
      transactions: transactionCount,
    },
  });
};

export default {
  createStock,
  listStock,
  getStockById,
  getStockDashboard,
  getFabricStockSummary,
  getAgingStock,
  getStockValuation,
  transferStock,
  adjustStock,
  updateStock,
  deleteStock,
};
