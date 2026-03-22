// Dashboard controller with real data aggregation
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';
import { logError } from '../utils/logger';

/**
 * Get dashboard summary with real production counts
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Single query to get counts for all stages using groupBy
    const stageCounts = await prisma.style_production_tracking.groupBy({
      by: ['currentStage'],
      _sum: { piecesInStage: true },
      _count: { id: true },
    });

    // Create a map for easy lookup
    const stageMap = new Map<string, { styles: number; pieces: number }>();
    for (const stage of stageCounts) {
      stageMap.set(stage.currentStage, {
        styles: stage._count.id,
        pieces: stage._sum.piecesInStage || 0,
      });
    }

    // Helper to get stage data with defaults
    const getStageData = (stage: ProductionStage) => stageMap.get(stage) || { styles: 0, pieces: 0 };

    const summary = {
      preProduction: {
        ordersReceived: getStageData(ProductionStage.ORDER_RECEIVED),
        pendingCosting: getStageData(ProductionStage.PENDING_COSTING),
        pendingGreige: getStageData(ProductionStage.PENDING_GREIGE_ORDER),
        trimsNotOrdered: getStageData(ProductionStage.TRIMS_NOT_ORDERED),
      },
      processing: {
        inPrinting: getStageData(ProductionStage.IN_PRINTING),
        inDying: getStageData(ProductionStage.IN_DYING),
        inEmbroidery: getStageData(ProductionStage.IN_EMBROIDERY),
        inHandwork: getStageData(ProductionStage.IN_HANDWORK),
      },
      production: {
        inCutting: getStageData(ProductionStage.IN_CUTTING),
        inStitching: getStageData(ProductionStage.IN_STITCHING),
        inFinishing: getStageData(ProductionStage.IN_FINISHING),
        readyToShip: getStageData(ProductionStage.READY_TO_SHIP),
      },
    };

    res.status(200).json({ data: summary });
  } catch (error) {
    logError('Get dashboard summary error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard summary',
    });
  }
};

/**
 * Get styles in a specific production stage (for drill-down)
 * GET /api/dashboard/stage/:stage
 */
export const getStylesByStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stage } = req.params;

    // Validate stage
    if (!Object.values(ProductionStage).includes(stage as ProductionStage)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid production stage',
      });
      return;
    }

    const trackingRecords = await prisma.style_production_tracking.findMany({
      where: {
        currentStage: stage as ProductionStage,
        piecesInStage: { gt: 0 },
      },
      include: {
        styles: {
          include: {
            style_components: true,
            style_processes: true,
            style_costing: true,
          },
        },
      },
    });

    const styles = trackingRecords.map((record) => ({
      ...record.styles,
      productionInfo: {
        piecesInStage: record.piecesInStage,
        sizeName: record.sizeName,
        lastUpdated: record.lastUpdatedDate,
      },
    }));

    res.status(200).json({ data: styles });
  } catch (error) {
    logError('Get styles by stage error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch styles',
    });
  }
};

/**
 * General dashboard stats — replaces hardcoded placeholder values
 * GET /api/dashboard/general-stats
 */
export const getGeneralDashboardStats = async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [lowStockItems, pendingQuotations, outstandingInvoices, monthlyRevenue, overdueOrders] = await Promise.all([
    // Low stock: materials with quantity < 10 (configurable threshold)
    prisma.stock_levels.count({
      where: { quantity: { lt: 10 } },
    }),

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
