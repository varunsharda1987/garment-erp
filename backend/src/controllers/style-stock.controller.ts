// Style Stock Controller
// Handles HTTP requests for style-fabric stock management

import { Request, Response } from 'express';
import FabricStockService, { CreateStyleStockDTO } from '../services/fabric-stock.service';
import GreigeStockService from '../services/greige-stock.service';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

// ============================================
// Types for Style Stock Controller
// ============================================

interface StockEntryInput {
  fabricId: string;
  quantity: number;
  finishedWidth: number;
  cutableWidth: number;
  rollNumbers?: string;
  warehouseLocation?: string;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  purchaseCost?: number;
  receivedDate?: Date;
  patternPartId?: string;
  fabricFinishType?: 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
}

class StyleStockController {
  /**
   * Create stock entry for a style (bulk)
   * POST /api/styles/:styleId/stock-entry
   */
  async createStyleStock(req: Request, res: Response) {
    try {
      const { styleId } = req.params;
      const { entries } = req.body;
      const userId = req.user?.userId || 'system';

      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Entries array is required',
        });
      }

      // Add styleId to each entry
      const stockEntries: CreateStyleStockDTO[] = entries.map((entry: StockEntryInput) => ({
        ...entry,
        styleId,
      }));

      // Bulk create stock
      const result = await FabricStockService.bulkCreateStyleStock(stockEntries, userId);

      // If ALL entries failed, return error status
      if (result.success === 0 && result.failed > 0) {
        const errorDetails = result.errors.map((e) => e.error).join('; ');
        return res.status(400).json({
          success: false,
          message: `All ${result.failed} stock entries failed: ${errorDetails}`,
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Successfully created ${result.success} stock entries.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`,
        data: result,
      });
    } catch (error: unknown) {
      logError('Create style stock error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create style stock',
      });
    }
  }

  /**
   * Get stock for a style
   * GET /api/styles/:styleId/stock
   */
  async getStyleStock(req: Request, res: Response) {
    try {
      const { styleId } = req.params;

      const stockData = await FabricStockService.getAvailableStockForStyle(styleId);

      return res.status(200).json({
        success: true,
        data: stockData,
      });
    } catch (error: unknown) {
      logError('Get style stock error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get style stock',
      });
    }
  }

  /**
   * Get fabrics used in a style
   * GET /api/styles/:styleId/fabrics
   */
  async getStyleFabrics(req: Request, res: Response) {
    try {
      const { styleId } = req.params;

      const fabrics = await FabricStockService.getFabricsByStyle(styleId);

      return res.status(200).json({
        success: true,
        data: fabrics,
      });
    } catch (error: unknown) {
      logError('Get style fabrics error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get style fabrics',
      });
    }
  }

  /**
   * Get styles that use a specific fabric
   * GET /api/fabrics/:fabricId/styles
   */
  async getFabricStyles(req: Request, res: Response) {
    try {
      const { fabricId } = req.params;

      const styles = await FabricStockService.getStylesByFabric(fabricId);

      return res.status(200).json({
        success: true,
        data: styles,
      });
    } catch (error: unknown) {
      logError('Get fabric styles error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get fabric styles',
      });
    }
  }

  /**
   * Get stock origin history for a fabric
   * GET /api/fabrics/:fabricId/stock-history
   */
  async getFabricStockHistory(req: Request, res: Response) {
    try {
      const { fabricId } = req.params;

      const history = await FabricStockService.getStockOriginHistory(fabricId);

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error: unknown) {
      logError('Get fabric stock history error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get stock history',
      });
    }
  }

  /**
   * Create generic greige stock entry
   * POST /api/greige/stock-entry
   * Now uses dedicated greige_stock table (no more proxy fabric_master records)
   */
  async createGreigeStock(req: Request, res: Response) {
    try {
      const userId = req.user?.userId || 'system';
      const stockData = req.body;

      // Use new GreigeStockService with dedicated greige_stock table
      const result = await GreigeStockService.createGreigeStock(stockData, userId);

      return res.status(201).json({
        success: true,
        message: 'Greige stock created successfully',
        data: result,
      });
    } catch (error: unknown) {
      logError('Create greige stock error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create greige stock',
      });
    }
  }

  /**
   * Get generic greige stock (not tied to any style)
   * GET /api/greige/generic-stock
   * Now queries dedicated greige_stock table
   */
  async getGenericGreigeStock(req: Request, res: Response) {
    try {
      // Use new GreigeStockService with dedicated greige_stock table
      const stock = await GreigeStockService.getGreigeStock();

      return res.status(200).json({
        success: true,
        data: stock,
      });
    } catch (error: unknown) {
      logError('Get generic greige stock error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get greige stock',
      });
    }
  }

  /**
   * Get greige stock summary for unified dashboard
   * GET /api/greige/summary
   * Now queries dedicated greige_stock table
   */
  async getGreigeStockSummary(req: Request, res: Response) {
    try {
      // Use new GreigeStockService with dedicated greige_stock table
      const summary = await GreigeStockService.getGreigeStockSummary();

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error: unknown) {
      logError('Get greige stock summary error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get greige stock summary',
      });
    }
  }

  /**
   * Get stock for multiple styles (for reports)
   * POST /api/styles/bulk-stock
   */
  async getBulkStyleStock(req: Request, res: Response) {
    try {
      const { styleIds } = req.body;

      if (!styleIds || !Array.isArray(styleIds)) {
        return res.status(400).json({
          success: false,
          message: 'styleIds array is required',
        });
      }

      const results = await Promise.all(
        styleIds.map(async (styleId: string) => {
          try {
            const stockData = await FabricStockService.getAvailableStockForStyle(styleId);
            return {
              styleId,
              success: true,
              data: stockData,
            };
          } catch (error: unknown) {
            return {
              styleId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      return res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error: unknown) {
      logError('Get bulk style stock error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get bulk style stock',
      });
    }
  }
}

export default new StyleStockController();
