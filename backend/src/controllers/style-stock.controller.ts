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
      const rawStock = await GreigeStockService.getGreigeStock();

      // Aggregate by greigeId with enriched data
      const aggregated = new Map<
        string,
        {
          greigeId: string;
          greigeCode: string;
          greigeName: string;
          composition: string;
          totalStock: number;
          unit: string;
          totalValue: number;
          maxAgingDays: number;
          greigeWidth: number | null;
          cutableWidth: number | null;
          qualityGrades: Set<string>;
          warehouses: Set<string>;
          suppliers: Map<string, { id: string; name: string; code: string }>;
          statuses: Set<string>;
          entryCount: number;
        }
      >();

      for (const item of rawStock) {
        const existing = aggregated.get(item.greigeId);
        const itemValue = item.quantityAvailable * (item.weightedAvgCost || item.purchaseCost || 0);

        if (existing) {
          existing.totalStock += item.quantityAvailable;
          existing.totalValue += itemValue;
          existing.maxAgingDays = Math.max(existing.maxAgingDays, item.agingDays);
          existing.qualityGrades.add(item.qualityGrade);
          if (item.warehouseLocation) existing.warehouses.add(item.warehouseLocation);
          if (item.supplier) existing.suppliers.set(item.supplier.id, item.supplier);
          existing.statuses.add(item.status);
          existing.entryCount++;
        } else {
          const supplierMap = new Map<string, { id: string; name: string; code: string }>();
          if (item.supplier) supplierMap.set(item.supplier.id, item.supplier);

          aggregated.set(item.greigeId, {
            greigeId: item.greigeId,
            greigeCode: (item.greige as any)?.greigeCode || '',
            greigeName: (item.greige as any)?.greigeName || '',
            composition: (item.greige as any)?.composition || '',
            totalStock: item.quantityAvailable,
            unit: 'meters',
            totalValue: itemValue,
            maxAgingDays: item.agingDays,
            greigeWidth: item.greigeWidth,
            cutableWidth: item.cutableWidth ?? null,
            qualityGrades: new Set([item.qualityGrade]),
            warehouses: item.warehouseLocation ? new Set([item.warehouseLocation]) : new Set(),
            suppliers: supplierMap,
            statuses: new Set([item.status]),
            entryCount: 1,
          });
        }
      }

      // Convert Sets/Maps to arrays for JSON response
      const data = Array.from(aggregated.values()).map((item) => ({
        greigeId: item.greigeId,
        greigeCode: item.greigeCode,
        greigeName: item.greigeName,
        composition: item.composition,
        totalStock: Math.round(item.totalStock * 100) / 100,
        unit: item.unit,
        totalValue: Math.round(item.totalValue * 100) / 100,
        maxAgingDays: item.maxAgingDays,
        greigeWidth: item.greigeWidth,
        cutableWidth: item.cutableWidth,
        qualityGrades: Array.from(item.qualityGrades),
        warehouses: Array.from(item.warehouses),
        suppliers: Array.from(item.suppliers.values()),
        statuses: Array.from(item.statuses),
        entryCount: item.entryCount,
      }));

      return res.status(200).json({
        success: true,
        data,
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
   * Get individual stock entries for a specific greige type (for expandable rows)
   * GET /api/greige/stock-entries/:greigeId
   */
  async getGreigeStockByGreigeId(req: Request, res: Response) {
    try {
      const { greigeId } = req.params;
      const stocks = await GreigeStockService.getGreigeStock({ greigeId, minQuantity: 0 });
      return res.status(200).json({ success: true, data: stocks });
    } catch (error: unknown) {
      logError('Get greige stock by greigeId error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get greige stock entries',
      });
    }
  }

  /**
   * Update a greige stock entry
   * PATCH /api/greige/stock/:stockId
   */
  async updateGreigeStockEntry(req: Request, res: Response) {
    try {
      const { stockId } = req.params;
      const updated = await GreigeStockService.updateGreigeStock(stockId, req.body);
      return res.status(200).json({ success: true, data: updated, message: 'Greige stock updated' });
    } catch (error: unknown) {
      logError('Update greige stock error:', error);
      const message = error instanceof Error ? error.message : 'Failed to update greige stock';
      const status = message.includes('not found') ? 404 : 500;
      return res.status(status).json({ success: false, message });
    }
  }

  /**
   * Delete a greige stock entry
   * DELETE /api/greige/stock/:stockId
   */
  async deleteGreigeStockEntry(req: Request, res: Response) {
    try {
      const { stockId } = req.params;
      await GreigeStockService.deleteGreigeStock(stockId);
      return res.status(200).json({ success: true, message: 'Greige stock entry deleted' });
    } catch (error: unknown) {
      logError('Delete greige stock error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete greige stock';
      const status = message.includes('not found') ? 404 : message.includes('Cannot delete') ? 409 : 500;
      return res.status(status).json({ success: false, message });
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
   * Get individual greige stock entries (available, with IDs for challan issuance)
   * GET /api/greige/stock
   */
  async getAvailableGreigeStock(req: Request, res: Response) {
    try {
      const stocks = await GreigeStockService.getGreigeStock({
        status: 'AVAILABLE',
        minQuantity: 0.01,
      });

      return res.status(200).json({
        success: true,
        data: stocks,
      });
    } catch (error: unknown) {
      logError('Get available greige stock error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get available greige stock',
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
