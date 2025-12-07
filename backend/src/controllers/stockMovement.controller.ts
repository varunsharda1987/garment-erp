// Stock Movement Controller - RESTful API endpoints for stock transactions
import { Request, Response } from 'express';
import stockMovementService, {
  CreateStockMovementDTO,
  StockTransferDTO,
  StockAdjustmentDTO
} from '../services/stockMovement.service';
import { MovementType, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * @route GET /api/stock-movements
 * @desc Get all stock movements with filters
 * @access Private
 */
export const getAllMovements = async (req: Request, res: Response) => {
  try {
    const { warehouseId, materialId, movementType, startDate, endDate, referenceType, referenceId } = req.query;

    const filters: any = {};
    if (warehouseId) filters.warehouseId = warehouseId as string;
    if (materialId) filters.materialId = materialId as string;
    if (movementType) filters.movementType = movementType as MovementType;
    if (referenceType) filters.referenceType = referenceType as string;
    if (referenceId) filters.referenceId = referenceId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const movements = await stockMovementService.getAllMovements(filters);

    res.json({
      success: true,
      data: movements,
      count: movements.length,
    });
  } catch (error: any) {
    logError('Get all movements error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock movements',
    });
  }
};

/**
 * @route GET /api/stock-movements/:id
 * @desc Get movement by ID
 * @access Private
 */
export const getMovementById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const movement = await stockMovementService.getMovementById(id);

    res.json({
      success: true,
      data: movement,
    });
  } catch (error: any) {
    logError('Get movement by ID error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch movement',
    });
  }
};

/**
 * @route POST /api/stock-movements/stock-in
 * @desc Create stock in movement (receipt)
 * @access Private
 */
export const createStockIn = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { materialId, warehouseId, quantity, unit, rate, referenceType, referenceId, referenceNumber, remarks } = req.body;

    // Validation
    if (!materialId || !warehouseId || !quantity || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Material, warehouse, quantity, and unit are required',
      });
    }

    const movementData: CreateStockMovementDTO = {
      movementType: 'STOCK_IN',
      materialId,
      warehouseId,
      quantity: new Decimal(quantity),
      unit: unit as Unit,
      rate: rate ? new Decimal(rate) : undefined,
      referenceType,
      referenceId,
      referenceNumber,
      remarks,
      performedById: userId,
    };

    const movement = await stockMovementService.createStockIn(movementData);

    res.status(201).json({
      success: true,
      message: 'Stock in movement created successfully',
      data: movement,
    });
  } catch (error: any) {
    logError('Create stock in error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create stock in movement',
    });
  }
};

/**
 * @route POST /api/stock-movements/stock-out
 * @desc Create stock out movement (issue)
 * @access Private
 */
export const createStockOut = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { materialId, warehouseId, quantity, unit, referenceType, referenceId, referenceNumber, remarks } = req.body;

    // Validation
    if (!materialId || !warehouseId || !quantity || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Material, warehouse, quantity, and unit are required',
      });
    }

    const movementData: CreateStockMovementDTO = {
      movementType: 'STOCK_OUT',
      materialId,
      warehouseId,
      quantity: new Decimal(quantity),
      unit: unit as Unit,
      referenceType,
      referenceId,
      referenceNumber,
      remarks,
      performedById: userId,
    };

    const movement = await stockMovementService.createStockOut(movementData);

    res.status(201).json({
      success: true,
      message: 'Stock out movement created successfully',
      data: movement,
    });
  } catch (error: any) {
    logError('Create stock out error:', error);
    const statusCode = error.message.includes('Insufficient stock') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create stock out movement',
    });
  }
};

/**
 * @route POST /api/stock-movements/transfer
 * @desc Create stock transfer between warehouses
 * @access Private
 */
export const createStockTransfer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { materialId, fromWarehouseId, toWarehouseId, quantity, unit, remarks } = req.body;

    // Validation
    if (!materialId || !fromWarehouseId || !toWarehouseId || !quantity || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Material, source warehouse, destination warehouse, quantity, and unit are required',
      });
    }

    if (fromWarehouseId === toWarehouseId) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination warehouses must be different',
      });
    }

    const transferData: StockTransferDTO = {
      materialId,
      fromWarehouseId,
      toWarehouseId,
      quantity: new Decimal(quantity),
      unit: unit as Unit,
      remarks,
      performedById: userId,
    };

    const result = await stockMovementService.createStockTransfer(transferData);

    res.status(201).json({
      success: true,
      message: 'Stock transfer created successfully',
      data: result,
    });
  } catch (error: any) {
    logError('Create stock transfer error:', error);
    const statusCode = error.message.includes('Insufficient stock') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create stock transfer',
    });
  }
};

/**
 * @route POST /api/stock-movements/adjustment
 * @desc Create stock adjustment
 * @access Private (Inventory Manager only)
 */
export const createStockAdjustment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { materialId, warehouseId, adjustmentQuantity, unit, reason } = req.body;

    // Validation
    if (!materialId || !warehouseId || adjustmentQuantity === undefined || !unit || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Material, warehouse, adjustment quantity, unit, and reason are required',
      });
    }

    const adjustmentData: StockAdjustmentDTO = {
      materialId,
      warehouseId,
      adjustmentQuantity: new Decimal(adjustmentQuantity),
      unit: unit as Unit,
      reason,
      performedById: userId,
    };

    const movement = await stockMovementService.createStockAdjustment(adjustmentData);

    res.status(201).json({
      success: true,
      message: 'Stock adjustment created successfully',
      data: movement,
    });
  } catch (error: any) {
    logError('Create stock adjustment error:', error);
    const statusCode = error.message.includes('Insufficient stock') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create stock adjustment',
    });
  }
};

/**
 * @route GET /api/stock-movements/material/:materialId/history
 * @desc Get material movement history
 * @access Private
 */
export const getMaterialMovementHistory = async (req: Request, res: Response) => {
  try {
    const { materialId } = req.params;
    const { warehouseId } = req.query;

    const history = await stockMovementService.getMaterialMovementHistory(
      materialId,
      warehouseId as string | undefined
    );

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    logError('Get material movement history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch movement history',
    });
  }
};

/**
 * @route GET /api/stock-movements/summary/:warehouseId
 * @desc Get movement summary for a warehouse
 * @access Private
 */
export const getMovementSummary = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
    }

    const summary = await stockMovementService.getMovementSummary(
      warehouseId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logError('Get movement summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch movement summary',
    });
  }
};

/**
 * @route GET /api/stock-movements/ledger/:materialId/:warehouseId
 * @desc Get stock ledger for a material in a warehouse
 * @access Private
 */
export const getStockLedger = async (req: Request, res: Response) => {
  try {
    const { materialId, warehouseId } = req.params;

    const ledger = await stockMovementService.getStockLedger(materialId, warehouseId);

    res.json({
      success: true,
      data: ledger,
      count: ledger.length,
    });
  } catch (error: any) {
    logError('Get stock ledger error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock ledger',
    });
  }
};
