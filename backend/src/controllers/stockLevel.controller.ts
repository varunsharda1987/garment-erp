// Stock Level Controller - RESTful API endpoints for stock inquiry and management
import { Request, Response } from 'express';
import stockLevelService from '../services/stockLevel.service';
import { Decimal } from '@prisma/client/runtime/library';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * @route GET /api/stock-levels
 * @desc Get all stock levels with optional filters
 * @access Private
 */
export const getAllStockLevels = async (req: Request, res: Response) => {
  try {
    const { warehouseId, materialId, belowReorderLevel, search } = req.query;

    const filters = {
      warehouseId: warehouseId as string | undefined,
      materialId: materialId as string | undefined,
      belowReorderLevel: belowReorderLevel === 'true',
      search: search as string | undefined,
    };

    const stockLevels = await stockLevelService.getAllStockLevels(filters);

    res.json({
      success: true,
      data: stockLevels,
      count: stockLevels.length,
    });
  } catch (error: any) {
    logError('Get all stock levels error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock levels',
    });
  }
};

/**
 * @route GET /api/stock-levels/:id
 * @desc Get stock level by ID
 * @access Private
 */
export const getStockLevelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stockLevel = await stockLevelService.getStockLevelById(id);

    res.json({
      success: true,
      data: stockLevel,
    });
  } catch (error: any) {
    logError('Get stock level by ID error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch stock level',
    });
  }
};

/**
 * @route GET /api/stock-levels/material/:materialId
 * @desc Get stock levels for a material across all warehouses
 * @access Private
 */
export const getStockLevelsByMaterial = async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;

    const result = await stockLevelService.getStockLevelsByMaterial(materialId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logError('Get stock levels by material error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock levels',
    });
  }
};

/**
 * @route GET /api/stock-levels/warehouse/:warehouseId
 * @desc Get all stock levels in a warehouse
 * @access Private
 */
export const getStockLevelsByWarehouse = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;

    const result = await stockLevelService.getStockLevelsByWarehouse(warehouseId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logError('Get stock levels by warehouse error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock levels',
    });
  }
};

/**
 * @route PUT /api/stock-levels/:id
 * @desc Update stock level (for manual adjustments)
 * @access Private (Inventory Manager only)
 */
export const updateStockLevel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, reorderLevel, maxLevel, minLevel, valuationRate } = req.body;

    const updateData: any = {};
    if (quantity !== undefined) updateData.quantity = new Decimal(quantity);
    if (reorderLevel !== undefined) updateData.reorderLevel = new Decimal(reorderLevel);
    if (maxLevel !== undefined) updateData.maxLevel = new Decimal(maxLevel);
    if (minLevel !== undefined) updateData.minLevel = new Decimal(minLevel);
    if (valuationRate !== undefined) updateData.valuationRate = new Decimal(valuationRate);

    const stockLevel = await stockLevelService.updateStockLevel(id, updateData);

    res.json({
      success: true,
      message: 'Stock level updated successfully',
      data: stockLevel,
    });
  } catch (error: any) {
    logError('Update stock level error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update stock level',
    });
  }
};

/**
 * @route GET /api/stock-levels/below-reorder
 * @desc Get materials below reorder level
 * @access Private
 */
export const getMaterialsBelowReorderLevel = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    const materials = await stockLevelService.getMaterialsBelowReorderLevel(
      warehouseId as string | undefined
    );

    res.json({
      success: true,
      data: materials,
      count: materials.length,
    });
  } catch (error: any) {
    logError('Get materials below reorder level error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch low stock materials',
    });
  }
};

/**
 * @route GET /api/stock-levels/aging/:warehouseId
 * @desc Get stock aging report for a warehouse
 * @access Private
 */
export const getStockAgingReport = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;

    const aging = await stockLevelService.getStockAgingReport(warehouseId);

    res.json({
      success: true,
      data: aging,
      count: aging.length,
    });
  } catch (error: any) {
    logError('Get stock aging report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock aging report',
    });
  }
};

/**
 * @route GET /api/stock-levels/valuation
 * @desc Get stock valuation report
 * @access Private
 */
export const getStockValuationReport = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    const report = await stockLevelService.getStockValuationReport(
      warehouseId as string | undefined
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logError('Get stock valuation report error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch valuation report',
    });
  }
};
