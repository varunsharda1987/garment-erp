// Dashboard controller with real data aggregation
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';

/**
 * Get dashboard summary with real production counts
 * GET /api/dashboard/summary
 */
export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    // Count styles and pieces by production stage
    const stageCounts = await Promise.all([
      // Pre-Production
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.ORDER_RECEIVED },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.PENDING_COSTING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.PENDING_GREIGE_ORDER },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.TRIMS_NOT_ORDERED },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),

      // Processing
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_PRINTING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_DYING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_EMBROIDERY },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_HANDWORK },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),

      // Production
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_CUTTING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_STITCHING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.IN_FINISHING },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
      prisma.styleProductionTracking.aggregate({
        where: { currentStage: ProductionStage.READY_TO_SHIP },
        _sum: { piecesInStage: true },
        _count: { id: true },
      }),
    ]);

    const summary = {
      preProduction: {
        ordersReceived: {
          styles: stageCounts[0]._count.id,
          pieces: stageCounts[0]._sum.piecesInStage || 0
        },
        pendingCosting: {
          styles: stageCounts[1]._count.id,
          pieces: stageCounts[1]._sum.piecesInStage || 0
        },
        pendingGreige: {
          styles: stageCounts[2]._count.id,
          pieces: stageCounts[2]._sum.piecesInStage || 0
        },
        trimsNotOrdered: {
          styles: stageCounts[3]._count.id,
          pieces: stageCounts[3]._sum.piecesInStage || 0
        },
      },
      processing: {
        inPrinting: {
          styles: stageCounts[4]._count.id,
          pieces: stageCounts[4]._sum.piecesInStage || 0
        },
        inDying: {
          styles: stageCounts[5]._count.id,
          pieces: stageCounts[5]._sum.piecesInStage || 0
        },
        inEmbroidery: {
          styles: stageCounts[6]._count.id,
          pieces: stageCounts[6]._sum.piecesInStage || 0
        },
        inHandwork: {
          styles: stageCounts[7]._count.id,
          pieces: stageCounts[7]._sum.piecesInStage || 0
        },
      },
      production: {
        inCutting: {
          styles: stageCounts[8]._count.id,
          pieces: stageCounts[8]._sum.piecesInStage || 0
        },
        inStitching: {
          styles: stageCounts[9]._count.id,
          pieces: stageCounts[9]._sum.piecesInStage || 0
        },
        inFinishing: {
          styles: stageCounts[10]._count.id,
          pieces: stageCounts[10]._sum.piecesInStage || 0
        },
        readyToShip: {
          styles: stageCounts[11]._count.id,
          pieces: stageCounts[11]._sum.piecesInStage || 0
        },
      },
    };

    res.status(200).json({ data: summary });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
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

    const trackingRecords = await prisma.styleProductionTracking.findMany({
      where: {
        currentStage: stage as ProductionStage,
        piecesInStage: { gt: 0 },
      },
      include: {
        style: {
          include: {
            components: true,
            processes: true,
            costing: true,
          },
        },
      },
    });

    const styles = trackingRecords.map(record => ({
      ...record.style,
      productionInfo: {
        piecesInStage: record.piecesInStage,
        sizeName: record.sizeName,
        lastUpdated: record.lastUpdatedDate,
      },
    }));

    res.status(200).json({ data: styles });
  } catch (error) {
    console.error('Get styles by stage error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch styles',
    });
  }
};
