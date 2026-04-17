// Stock Level Controller - RESTful API endpoints for stock inquiry and management
import { Request, Response } from 'express';
import stockLevelService from '../services/stockLevel.service';
import { Decimal } from '@prisma/client/runtime/library';
import { MaterialType } from '@prisma/client';

// ============================================
// Types for Stock Level Controller
// ============================================

interface StockLevelUpdateData {
  quantity?: Decimal;
  reorderLevel?: Decimal;
  maxLevel?: Decimal;
  minLevel?: Decimal;
  valuationRate?: Decimal;
}

/**
 * @route GET /api/stock-levels
 * @desc Get all stock levels with optional filters
 * @access Private
 */
export const getAllStockLevels = async (req: Request, res: Response) => {
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
};

/**
 * @route GET /api/stock-levels/:id
 * @desc Get stock level by ID
 * @access Private
 */
export const getStockLevelById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const stockLevel = await stockLevelService.getStockLevelById(id);

  res.json({
    success: true,
    data: stockLevel,
  });
};

/**
 * @route GET /api/stock-levels/material/:materialId
 * @desc Get stock levels for a material across all warehouses
 * @access Private
 */
export const getStockLevelsByMaterial = async (req: Request, res: Response) => {
  const { materialId } = req.params;

  const result = await stockLevelService.getStockLevelsByMaterial(materialId);

  res.json({
    success: true,
    data: result,
  });
};

/**
 * @route GET /api/stock-levels/warehouse/:warehouseId
 * @desc Get all stock levels in a warehouse
 * @access Private
 */
export const getStockLevelsByWarehouse = async (req: Request, res: Response) => {
  const { warehouseId } = req.params;

  const result = await stockLevelService.getStockLevelsByWarehouse(warehouseId);

  res.json({
    success: true,
    data: result,
  });
};

/**
 * @route PUT /api/stock-levels/:id
 * @desc Update stock level (for manual adjustments)
 * @access Private (Inventory Manager only)
 */
export const updateStockLevel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, reorderLevel, maxLevel, minLevel, valuationRate } = req.body;

  const updateData: StockLevelUpdateData = {};
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
};

/**
 * @route GET /api/stock-levels/below-reorder
 * @desc Get materials below reorder level
 * @access Private
 */
export const getMaterialsBelowReorderLevel = async (req: Request, res: Response) => {
  const { warehouseId } = req.query;

  const materials = await stockLevelService.getMaterialsBelowReorderLevel(warehouseId as string | undefined);

  res.json({
    success: true,
    data: materials,
    count: materials.length,
  });
};

/**
 * @route GET /api/stock-levels/aging/:warehouseId
 * @desc Get stock aging report for a warehouse
 * @access Private
 */
export const getStockAgingReport = async (req: Request, res: Response) => {
  const { warehouseId } = req.params;

  const aging = await stockLevelService.getStockAgingReport(warehouseId);

  res.json({
    success: true,
    data: aging,
    count: aging.length,
  });
};

/**
 * @route GET /api/stock-levels/valuation
 * @desc Get stock valuation report
 * @access Private
 */
export const getStockValuationReport = async (req: Request, res: Response) => {
  const { warehouseId } = req.query;

  const report = await stockLevelService.getStockValuationReport(warehouseId as string | undefined);

  res.json({
    success: true,
    data: report,
  });
};

/**
 * @route GET /api/stock-levels/by-type/:materialType
 * @desc Get stock levels filtered by material type
 * @access Private
 */
export const getStockLevelsByMaterialType = async (req: Request, res: Response) => {
  const { materialType } = req.params;

  const stockLevels = await stockLevelService.getStockLevelsByMaterialType(materialType as MaterialType);

  res.json({
    success: true,
    data: stockLevels,
    count: stockLevels.length,
  });
};
