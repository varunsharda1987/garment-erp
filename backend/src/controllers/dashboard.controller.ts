// Dashboard controller with real data aggregation
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ProductionStage } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

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
