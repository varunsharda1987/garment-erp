// Stock Movement Controller - RESTful API endpoints for stock transactions
import { Request, Response } from 'express';
import stockMovementService, {
  CreateStockMovementDTO,
  StockTransferDTO,
  StockAdjustmentDTO,
} from '../services/stockMovement.service';
import { MovementType, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundError, ValidationError } from '../errors';
import prisma from '../config/database';

// Map polymorphic item types to their FK field in the materials table
const ITEM_TYPE_TO_FK: Record<string, string> = {
  GREIGE: 'greigeId',
  FABRIC: 'fabricId',
  LACE: 'laceId',
  BUTTON: 'buttonId',
  THREAD: 'threadId',
  ZIPPER: 'zipperId',
  ELASTIC: 'elasticId',
  LABEL: 'labelId',
  PACKAGING: 'packagingId',
};

/**
 * @route GET /api/stock-movements
 * @desc Get all stock movements with filters
 * @access Private
 */
export const getAllMovements = async (req: Request, res: Response) => {
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
};

/**
 * @route GET /api/stock-movements/:id
 * @desc Get movement by ID
 * @access Private
 */
export const getMovementById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const movement = await stockMovementService.getMovementById(id);

  res.json({
    success: true,
    data: movement,
  });
};

/**
 * @route POST /api/stock-movements/stock-in
 * @desc Create stock in movement (receipt)
 * @access Private
 */
export const createStockIn = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    materialId,
    itemType,
    itemId,
    warehouseId,
    quantity,
    unit,
    rate,
    referenceType,
    referenceId,
    referenceNumber,
    remarks,
  } = req.body;

  // Resolve materialId from polymorphic itemType/itemId if not provided directly
  let resolvedMaterialId = materialId;
  if (!resolvedMaterialId && itemType && itemId) {
    const fkField = ITEM_TYPE_TO_FK[itemType];
    if (fkField) {
      const material = await prisma.materials.findFirst({
        where: { [fkField]: itemId },
        select: { id: true },
      });
      if (material) {
        resolvedMaterialId = material.id;
      }
    }
  }

  // Validation
  if (!resolvedMaterialId || !warehouseId || !quantity || !unit) {
    throw new ValidationError('Material, warehouse, quantity, and unit are required');
  }

  const movementData: CreateStockMovementDTO = {
    movementType: 'STOCK_IN',
    materialId: resolvedMaterialId,
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
};

/**
 * @route POST /api/stock-movements/stock-out
 * @desc Create stock out movement (issue)
 * @access Private
 */
export const createStockOut = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    materialId,
    itemType,
    itemId,
    warehouseId,
    quantity,
    unit,
    referenceType,
    referenceId,
    referenceNumber,
    remarks,
  } = req.body;

  // Resolve materialId from polymorphic itemType/itemId if not provided directly
  let resolvedMaterialId = materialId;
  if (!resolvedMaterialId && itemType && itemId) {
    const fkField = ITEM_TYPE_TO_FK[itemType];
    if (fkField) {
      const material = await prisma.materials.findFirst({
        where: { [fkField]: itemId },
        select: { id: true },
      });
      if (material) {
        resolvedMaterialId = material.id;
      }
    }
  }

  // Validation
  if (!resolvedMaterialId || !warehouseId || !quantity || !unit) {
    throw new ValidationError('Material, warehouse, quantity, and unit are required');
  }

  const movementData: CreateStockMovementDTO = {
    movementType: 'STOCK_OUT',
    materialId: resolvedMaterialId,
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
};

/**
 * @route POST /api/stock-movements/transfer
 * @desc Create stock transfer between warehouses
 * @access Private
 */
export const createStockTransfer = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { materialId, fromWarehouseId, toWarehouseId, quantity, unit, remarks } = req.body;

  // Validation
  if (!materialId || !fromWarehouseId || !toWarehouseId || !quantity || !unit) {
    throw new ValidationError('Material, source warehouse, destination warehouse, quantity, and unit are required');
  }

  if (fromWarehouseId === toWarehouseId) {
    throw new ValidationError('Source and destination warehouses must be different');
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
};

/**
 * @route POST /api/stock-movements/adjustment
 * @desc Create stock adjustment
 * @access Private (Inventory Manager only)
 */
export const createStockAdjustment = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { materialId, warehouseId, adjustmentQuantity, unit, reason } = req.body;

  // Validation
  if (!materialId || !warehouseId || adjustmentQuantity === undefined || !unit || !reason) {
    throw new ValidationError('Material, warehouse, adjustment quantity, unit, and reason are required');
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
};

/**
 * @route GET /api/stock-movements/material/:materialId/history
 * @desc Get material movement history
 * @access Private
 */
export const getMaterialMovementHistory = async (req: Request, res: Response) => {
  const { materialId } = req.params;
  const { warehouseId } = req.query;

  const history = await stockMovementService.getMaterialMovementHistory(materialId, warehouseId as string | undefined);

  res.json({
    success: true,
    data: history,
    count: history.length,
  });
};

/**
 * @route GET /api/stock-movements/summary/:warehouseId
 * @desc Get movement summary for a warehouse
 * @access Private
 */
export const getMovementSummary = async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError('Start date and end date are required');
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
};

/**
 * @route GET /api/stock-movements/ledger/:materialId/:warehouseId
 * @desc Get stock ledger for a material in a warehouse
 * @access Private
 */
export const getStockLedger = async (req: Request, res: Response) => {
  const { materialId, warehouseId } = req.params;

  const ledger = await stockMovementService.getStockLedger(materialId, warehouseId);

  res.json({
    success: true,
    data: ledger,
    count: ledger.length,
  });
};
