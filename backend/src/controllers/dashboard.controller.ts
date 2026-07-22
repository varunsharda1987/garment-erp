// Dashboard controller with real data aggregation
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ValidationError } from '../errors';
import { countDerivedBelowThreshold } from '../services/helpers/derived-stock.helper';

/**
 * Get dashboard summary with real production counts
 * Queries actual operational tables instead of the placeholder style_production_tracking table.
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  const activeOrderFilter = {
    status: { notIn: ['COMPLETED' as const, 'CANCELLED' as const, 'DISPATCHED' as const] },
  };

  const [
    // Pre-production
    pendingOrders,
    pendingCostingItems,
    pendingGreigeReqs,
    pendingTrimsReqs,
    // Processing — single groupBy for all 4 service types
    processingServices,
    // Production — styles counts (distinct work orders)
    cuttingWOs,
    stitchingWOs,
    finishingWOs,
    // Production — pieces counts
    cuttingPieces,
    stitchingPieces,
    finishingPieces,
    // Ready to ship
    readyToShipStock,
  ] = await Promise.all([
    // ── Pre-Production ──────────────────────────────────────

    // 1. Orders Received: PENDING orders
    prisma.orders.aggregate({
      where: { status: 'PENDING' },
      _count: { id: true },
      _sum: { totalQuantity: true },
    }),

    // 2. Pending Costing: active order items whose style has no approved cost sheet
    prisma.order_items.findMany({
      where: {
        orders: activeOrderFilter,
        styles: { style_costing: { none: { isApproved: true } } },
      },
      select: { styleId: true, totalQuantity: true },
    }),

    // 3. Pending Greige: material requirements for greige/fabric that still need POs
    prisma.material_requirements.findMany({
      where: {
        requirementType: 'MATERIAL',
        status: { in: ['PENDING', 'PO_REQUIRED'] },
        materials: { materialType: { in: ['GREIGE', 'FABRIC'] } },
        orders: activeOrderFilter,
      },
      select: { orderId: true, totalRequired: true },
    }),

    // 4. Trims Not Ordered: material requirements for trims that still need POs
    prisma.material_requirements.findMany({
      where: {
        requirementType: 'MATERIAL',
        status: { in: ['PENDING', 'PO_REQUIRED'] },
        materials: { materialType: { notIn: ['GREIGE', 'FABRIC', 'SERVICE'] } },
        orders: activeOrderFilter,
      },
      select: { orderId: true, totalRequired: true },
    }),

    // ── Processing Stages ───────────────────────────────────

    // 5. All processing service requirements in one query
    prisma.work_order_service_requirements.groupBy({
      by: ['serviceType'],
      where: {
        serviceType: { in: ['PRINTING', 'DYEING', 'EMBROIDERY', 'HANDWORK'] },
        status: 'IN_PROGRESS',
      },
      _count: { id: true },
      _sum: { quantityRequired: true },
    }),

    // ── Production Stages (styles = distinct work orders) ──

    // 6. Cutting — distinct work orders
    prisma.cutting_batches.findMany({
      where: { status: 'IN_PROGRESS' },
      select: { workOrderId: true },
      distinct: ['workOrderId'],
    }),

    // 7. Stitching — distinct work orders
    prisma.stitching_issues.findMany({
      where: { status: 'IN_PROGRESS' },
      select: { workOrderId: true },
      distinct: ['workOrderId'],
    }),

    // 8. Finishing — distinct work orders
    prisma.finishing_issues.findMany({
      where: { status: { in: ['IN_PROGRESS', 'PACKING'] } },
      select: { workOrderId: true },
      distinct: ['workOrderId'],
    }),

    // ── Production Stages (pieces) ─────────────────────────

    // 9. Cutting pieces
    prisma.cutting_batch_skus.aggregate({
      where: { cuttingBatch: { status: 'IN_PROGRESS' } },
      _sum: { toCut: true },
    }),

    // 10. Stitching pieces
    prisma.stitching_issue_skus.aggregate({
      where: { stitchingIssue: { status: 'IN_PROGRESS' } },
      _sum: { issuedQty: true },
    }),

    // 11. Finishing pieces
    prisma.finishing_issue_skus.aggregate({
      where: { finishingIssue: { status: { in: ['IN_PROGRESS', 'PACKING'] } } },
      _sum: { issuedQty: true },
    }),

    // 12. Ready to ship — finished goods with stock
    prisma.finished_goods_stock.groupBy({
      by: ['styleId'],
      where: { quantity: { gt: 0 } },
      _sum: { quantity: true },
    }),
  ]);

  // ── Build response ──────────────────────────────────────

  // Pre-production: compute distinct counts from raw rows
  const distinctStyles = (items: { styleId: string; totalQuantity: number }[]) => {
    const seen = new Set<string>();
    let pieces = 0;
    for (const item of items) {
      seen.add(item.styleId);
      pieces += item.totalQuantity;
    }
    return { styleCount: seen.size, pieces };
  };

  const distinctOrders = (reqs: { orderId: string | null; totalRequired: Decimal | null }[]) => {
    const seen = new Set<string>();
    let pieces = 0;
    for (const req of reqs) {
      if (req.orderId) seen.add(req.orderId);
      pieces += req.totalRequired ? Number(req.totalRequired) : 0;
    }
    return { styleCount: seen.size, pieces: Math.round(pieces) };
  };

  // Processing: build lookup from groupBy result
  const procMap = new Map<string, { styleCount: number; pieces: number }>();
  for (const row of processingServices) {
    procMap.set(row.serviceType, {
      styleCount: row._count.id,
      pieces: Math.round(Number(row._sum.quantityRequired || 0)),
    });
  }
  const getProc = (type: string) => procMap.get(type) || { styleCount: 0, pieces: 0 };

  // Ready to ship totals
  const readyToShipPieces = readyToShipStock.reduce((acc, row) => acc + (row._sum.quantity || 0), 0);

  const summary = {
    preProduction: {
      ordersReceived: {
        styleCount: pendingOrders._count.id,
        pieces: pendingOrders._sum.totalQuantity || 0,
      },
      pendingCosting: distinctStyles(pendingCostingItems),
      pendingGreige: distinctOrders(pendingGreigeReqs),
      trimsNotOrdered: distinctOrders(pendingTrimsReqs),
    },
    processing: {
      inPrinting: getProc('PRINTING'),
      inDying: getProc('DYEING'),
      inEmbroidery: getProc('EMBROIDERY'),
      inHandwork: getProc('HANDWORK'),
    },
    production: {
      inCutting: {
        styleCount: cuttingWOs.length,
        pieces: cuttingPieces._sum.toCut || 0,
      },
      inStitching: {
        styleCount: stitchingWOs.length,
        pieces: stitchingPieces._sum.issuedQty || 0,
      },
      inFinishing: {
        styleCount: finishingWOs.length,
        pieces: finishingPieces._sum.issuedQty || 0,
      },
      readyToShip: {
        styleCount: readyToShipStock.length,
        pieces: readyToShipPieces,
      },
    },
  };

  res.status(200).json({ data: summary });
};

/**
 * Get styles in a specific production stage (for drill-down)
 * Queries real operational tables based on the stage parameter.
 * GET /api/dashboard/stage/:stage
 */
export const getStylesByStage = async (req: Request, res: Response): Promise<void> => {
  const { stage } = req.params;

  // Validate stage
  if (!Object.values(ProductionStage).includes(stage as ProductionStage)) {
    throw new ValidationError('Invalid production stage');
  }

  const styleInclude = {
    style_components: true,
    style_processes: true,
    style_costing: true,
  } as const;

  const activeOrderFilter = {
    status: { notIn: ['COMPLETED' as const, 'CANCELLED' as const, 'DISPATCHED' as const] },
  };

  let styles: unknown[] = [];

  switch (stage as ProductionStage) {
    case ProductionStage.ORDER_RECEIVED: {
      const items = await prisma.order_items.findMany({
        where: { orders: { status: 'PENDING' } },
        include: {
          styles: { include: styleInclude },
          orders: { select: { orderNumber: true, totalQuantity: true } },
        },
      });
      styles = items.map((item) => ({
        ...item.styles,
        productionInfo: { piecesInStage: item.totalQuantity, orderNumber: item.orders.orderNumber },
      }));
      break;
    }

    case ProductionStage.PENDING_COSTING: {
      const items = await prisma.order_items.findMany({
        where: {
          orders: activeOrderFilter,
          styles: { style_costing: { none: { isApproved: true } } },
        },
        include: { styles: { include: styleInclude } },
      });
      styles = items.map((item) => ({
        ...item.styles,
        productionInfo: { piecesInStage: item.totalQuantity },
      }));
      break;
    }

    case ProductionStage.PENDING_GREIGE_ORDER: {
      const reqs = await prisma.material_requirements.findMany({
        where: {
          requirementType: 'MATERIAL',
          status: { in: ['PENDING', 'PO_REQUIRED'] },
          materials: { materialType: { in: ['GREIGE', 'FABRIC'] } },
          orders: activeOrderFilter,
        },
        include: { orders: { include: { order_items: { include: { styles: { include: styleInclude } } } } } },
      });
      styles = reqs
        .filter((r) => r.orders?.order_items?.[0]?.styles)
        .map((r) => ({
          ...r.orders!.order_items[0].styles,
          productionInfo: { piecesInStage: Number(r.totalRequired) },
        }));
      break;
    }

    case ProductionStage.TRIMS_NOT_ORDERED: {
      const reqs = await prisma.material_requirements.findMany({
        where: {
          requirementType: 'MATERIAL',
          status: { in: ['PENDING', 'PO_REQUIRED'] },
          materials: { materialType: { notIn: ['GREIGE', 'FABRIC', 'SERVICE'] } },
          orders: activeOrderFilter,
        },
        include: { orders: { include: { order_items: { include: { styles: { include: styleInclude } } } } } },
      });
      styles = reqs
        .filter((r) => r.orders?.order_items?.[0]?.styles)
        .map((r) => ({
          ...r.orders!.order_items[0].styles,
          productionInfo: { piecesInStage: Number(r.totalRequired) },
        }));
      break;
    }

    case ProductionStage.IN_PRINTING:
    case ProductionStage.IN_DYING:
    case ProductionStage.IN_EMBROIDERY:
    case ProductionStage.IN_HANDWORK: {
      const serviceTypeMap: Record<string, string> = {
        IN_PRINTING: 'PRINTING',
        IN_DYING: 'DYEING',
        IN_EMBROIDERY: 'EMBROIDERY',
        IN_HANDWORK: 'HANDWORK',
      };
      const serviceType = serviceTypeMap[stage];
      const reqs = await prisma.work_order_service_requirements.findMany({
        where: { serviceType: serviceType as never, status: 'IN_PROGRESS' },
        include: { workOrder: { include: { styles: { include: styleInclude } } } },
      });
      styles = reqs.map((r) => ({
        ...r.workOrder.styles,
        productionInfo: { piecesInStage: Number(r.quantityRequired) },
      }));
      break;
    }

    case ProductionStage.IN_CUTTING: {
      const batches = await prisma.cutting_batches.findMany({
        where: { status: 'IN_PROGRESS' },
        include: {
          workOrder: { include: { styles: { include: styleInclude } } },
          skuOutputs: { select: { toCut: true } },
        },
      });
      styles = batches.map((b) => ({
        ...b.workOrder.styles,
        productionInfo: { piecesInStage: b.skuOutputs.reduce((sum, s) => sum + s.toCut, 0) },
      }));
      break;
    }

    case ProductionStage.IN_STITCHING: {
      const issues = await prisma.stitching_issues.findMany({
        where: { status: 'IN_PROGRESS' },
        include: {
          workOrder: { include: { styles: { include: styleInclude } } },
          skuBreakdown: { select: { issuedQty: true } },
        },
      });
      styles = issues.map((i) => ({
        ...i.workOrder.styles,
        productionInfo: { piecesInStage: i.skuBreakdown.reduce((sum, s) => sum + s.issuedQty, 0) },
      }));
      break;
    }

    case ProductionStage.IN_FINISHING: {
      const issues = await prisma.finishing_issues.findMany({
        where: { status: { in: ['IN_PROGRESS', 'PACKING'] } },
        include: {
          workOrder: { include: { styles: { include: styleInclude } } },
          skuBreakdown: { select: { issuedQty: true } },
        },
      });
      styles = issues.map((i) => ({
        ...i.workOrder.styles,
        productionInfo: { piecesInStage: i.skuBreakdown.reduce((sum, s) => sum + s.issuedQty, 0) },
      }));
      break;
    }

    case ProductionStage.READY_TO_SHIP: {
      const stock = await prisma.finished_goods_stock.findMany({
        where: { quantity: { gt: 0 } },
        include: { styles: { include: styleInclude } },
      });
      styles = stock.map((s) => ({
        ...s.styles,
        productionInfo: { piecesInStage: s.quantity },
      }));
      break;
    }

    default:
      styles = [];
  }

  res.status(200).json({ data: styles });
};

/**
 * General dashboard stats — replaces hardcoded placeholder values
 * GET /api/dashboard/general-stats
 */
export const getGeneralDashboardStats = async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [lowStockItems, pendingQuotations, outstandingInvoices, monthlyRevenue, overdueOrders] = await Promise.all([
    // Low stock: materials with DERIVED on-hand < 10 (configurable threshold).
    // Reads derived_stock_view (T2-1) instead of the hand-maintained stock_levels.quantity, so
    // phantom/zero-qty ledger rows no longer inflate the count. Can't be a Prisma column filter on a
    // view, so it's a COUNT(*) query in the helper.
    countDerivedBelowThreshold(10),

    // Draft/pending quotations
    prisma.quotations.count({
      where: { status: 'DRAFT' },
    }),

    // Outstanding invoices (pending or overdue) — sum of balance
    prisma.invoices.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
      _sum: { balanceAmount: true },
    }),

    // Monthly revenue — paid invoices this month
    prisma.invoices.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),

    // Overdue orders — past delivery date and not completed/cancelled/dispatched
    prisma.orders.count({
      where: {
        expectedDeliveryDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED', 'DISPATCHED'] },
      },
    }),
  ]);

  res.json({
    data: {
      lowStockItems,
      pendingQuotations,
      outstandingInvoices: Number(outstandingInvoices._sum?.balanceAmount || 0),
      monthlyRevenue: Number(monthlyRevenue._sum?.totalAmount || 0),
      overdueOrders,
    },
  });
};

/**
 * Production dashboard stats — replaces Math.random() placeholders
 * GET /api/dashboard/production-stats
 */
export const getProductionDashboardStats = async (req: Request, res: Response): Promise<void> => {
  const [cuttingQueue, stitchingActive, finishingActive] = await Promise.all([
    // Cutting queue: pending work orders without active cutting batches
    prisma.work_orders.count({
      where: {
        status: { in: ['PENDING', 'IN_PRODUCTION'] },
        cutting_batches: { none: {} },
      },
    }),

    // Active stitching issues
    prisma.stitching_issues.count({
      where: { status: 'IN_PROGRESS' },
    }),

    // Active finishing issues
    prisma.finishing_issues.count({
      where: { status: 'IN_PROGRESS' },
    }),
  ]);

  res.json({
    data: {
      cuttingQueue,
      stitchingActive,
      finishingActive,
    },
  });
};

/**
 * Accounts dashboard stats — replaces hardcoded financial values
 * GET /api/dashboard/accounts-stats
 */
export const getAccountsDashboardStats = async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthlyCollections, totalReceivables, totalPayables] = await Promise.all([
    // Monthly collections (payments received this month)
    prisma.payments.aggregate({
      where: {
        paymentDate: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),

    // Total receivables (outstanding invoice balances)
    prisma.invoices.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
      _sum: { balanceAmount: true },
    }),

    // Total payables (active POs not fully received — approximate)
    prisma.purchase_orders.aggregate({
      where: { status: { in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] } },
      _sum: { totalAmount: true },
    }),
  ]);

  res.json({
    data: {
      monthlyCollections: Number(monthlyCollections._sum?.amount || 0),
      totalReceivables: Number(totalReceivables._sum?.balanceAmount || 0),
      totalPayables: Number(totalPayables._sum?.totalAmount || 0),
    },
  });
};

/**
 * Sales dashboard stats — replaces hardcoded style counts
 * GET /api/dashboard/sales-stats
 */
export const getSalesDashboardStats = async (req: Request, res: Response): Promise<void> => {
  const [stylesPendingCosting, activeOrders, totalCustomers] = await Promise.all([
    // Styles without approved cost sheets
    prisma.styles.count({
      where: {
        status: 'ACTIVE',
        style_costing: { none: { isApproved: true } },
      },
    }),

    // Active orders (not completed/cancelled)
    prisma.orders.count({
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    }),

    // Active customers
    prisma.customers.count({
      where: { isActive: true },
    }),
  ]);

  res.json({
    data: {
      stylesPendingCosting,
      activeOrders,
      totalCustomers,
    },
  });
};
