// Stock Movement Controller - RESTful API endpoints for stock transactions
import { Request, Response } from 'express';
import stockMovementService, {
  CreateStockMovementDTO,
  StockTransferDTO,
  StockAdjustmentDTO,
  BulkStockInDTO,
  BulkStockInItemDTO,
} from '../services/stockMovement.service';
import { MovementType, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundError, ValidationError } from '../errors';
import prisma from '../config/database';
import greigeStockService from '../services/greige-stock.service';

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
  MACHINE_PART: 'machinePartId',
  OTHER_MATERIAL: 'otherMaterialId',
};

/**
 * @route GET /api/stock-movements
 * @desc Get all stock movements with filters
 * @access Private
 */
export const getAllMovements = async (req: Request, res: Response) => {
  const { warehouseId, materialId, movementType, startDate, endDate, referenceType, referenceId } = req.query;

  const validMovementTypes = [
    'STOCK_IN',
    'STOCK_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
  ];

  const filters: any = {};
  if (warehouseId) filters.warehouseId = warehouseId as string;
  if (materialId) filters.materialId = materialId as string;
  if (movementType && validMovementTypes.includes(movementType as string)) {
    filters.movementType = movementType as MovementType;
  }
  if (referenceType) filters.referenceType = referenceType as string;
  if (referenceId) filters.referenceId = referenceId as string;
  if (startDate) {
    const parsedStart = new Date(startDate as string);
    if (!isNaN(parsedStart.getTime())) filters.startDate = parsedStart;
  }
  if (endDate) {
    const parsedEnd = new Date(endDate as string);
    if (!isNaN(parsedEnd.getTime())) filters.endDate = parsedEnd;
  }

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
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    materialId,
    itemType,
    itemId,
    warehouseId,
    supplierId,
    quantity,
    unit,
    rate,
    referenceType,
    referenceId,
    referenceNumber,
    remarks,
    foldLengthCm,
    thanCount,
    invoiceNumber,
    invoiceDate,
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
    supplierId,
    quantity: new Decimal(quantity),
    unit: unit as Unit,
    rate: rate ? new Decimal(rate) : undefined,
    referenceType,
    referenceId,
    referenceNumber,
    remarks,
    performedById: userId,
    foldLengthCm: foldLengthCm ? new Decimal(foldLengthCm) : undefined,
    thanCount: thanCount != null ? parseInt(thanCount) : undefined,
    invoiceNumber,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
  };

  const movement = await stockMovementService.createStockIn(movementData);

  res.status(201).json({
    success: true,
    message: 'Stock in movement created successfully',
    data: movement,
  });
};

/**
 * @route POST /api/stock-movements/bulk-stock-in
 * @desc Create multiple stock in movements in a single transaction
 * @access Private
 */
export const createBulkStockIn = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { warehouseId, supplierId, referenceType, referenceNumber, remarks, items, invoiceNumber, invoiceDate } =
    req.body;

  // Validate basic fields
  if (!warehouseId || !items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('warehouseId and at least one item are required');
  }

  if (items.length > 50) {
    throw new ValidationError('Maximum 50 items allowed per bulk operation');
  }

  // Resolve materialIds and validate items
  const resolvedItems: BulkStockInItemDTO[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Validate item fields
    if (!item.quantity || !item.unit) {
      throw new ValidationError(`Item ${i + 1}: quantity and unit are required`);
    }

    // Resolve materialId from polymorphic itemType/itemId if needed
    let resolvedMaterialId = item.materialId;
    if (!resolvedMaterialId && item.itemType && item.itemId) {
      const fkField = ITEM_TYPE_TO_FK[item.itemType];
      if (fkField) {
        const material = await prisma.materials.findFirst({
          where: { [fkField]: item.itemId },
          select: { id: true },
        });
        if (material) {
          resolvedMaterialId = material.id;
        }
      }
    }

    if (!resolvedMaterialId) {
      throw new ValidationError(`Item ${i + 1}: materialId or valid itemType+itemId is required`);
    }

    resolvedItems.push({
      materialId: resolvedMaterialId,
      quantity: new Decimal(item.quantity),
      unit: item.unit as Unit,
      rate: item.rate ? new Decimal(item.rate) : undefined,
      foldLengthCm: item.foldLengthCm ? new Decimal(item.foldLengthCm) : undefined,
      thanCount: item.thanCount != null ? parseInt(item.thanCount) : undefined,
      remarks: item.remarks,
    });
  }

  const bulkData: BulkStockInDTO = {
    warehouseId,
    supplierId,
    referenceType,
    referenceNumber,
    remarks,
    performedById: userId,
    items: resolvedItems,
    invoiceNumber,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
  };

  const result = await stockMovementService.createBulkStockIn(bulkData);

  res.status(201).json({
    success: true,
    message: `${result.itemCount} item(s) received successfully`,
    data: result,
  });
};

/**
 * @route POST /api/stock-movements/stock-out
 * @desc Create stock out movement (issue)
 * @access Private
 */
export const createStockOut = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

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
  const userId = req.user?.userId;

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
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { materialId, warehouseId, adjustmentQuantity, unit, reason, remarks } = req.body;

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
    remarks,
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

/**
 * @route GET /api/stock-movements/unified
 * @desc Get unified material movements from all sources (stock_movements, greige_stock, fabric_stock, GRN, procurement, challans)
 * @access Private
 */
export const getUnifiedMovements = async (req: Request, res: Response) => {
  const { supplierId, invoiceNumber, direction, materialType, dateFrom, dateTo, search, page, limit } = req.query;

  const filters = {
    supplierId: supplierId as string | undefined,
    invoiceNumber: invoiceNumber as string | undefined,
    direction: direction as 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT' | undefined,
    materialType: materialType as string | undefined,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined,
    search: search as string | undefined,
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 50,
  };

  const result = await stockMovementService.getUnifiedMovements(filters);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * @route POST /api/stock-movements/processor-return
 * @desc Receive partial goods from processor (consumes from processor's greige stock)
 * @access Private
 *
 * NOTE: This is a PARTIAL receipt - processor may return in multiple batches.
 * Shrinkage is NOT calculated here. It's a reconciliation exercise done separately
 * when all material is accounted for.
 */
export const createProcessorReturn = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { greigeStockId, receivedQuantity, warehouseId, remarks } = req.body;

  // Validation
  if (!greigeStockId || receivedQuantity === undefined || !warehouseId) {
    throw new ValidationError('greigeStockId, receivedQuantity, and warehouseId are required');
  }

  if (Number(receivedQuantity) <= 0) {
    throw new ValidationError('Received quantity must be greater than 0');
  }

  // Check available stock at processor
  const stock = await greigeStockService.getGreigeStockById(greigeStockId);
  if (!stock) {
    throw new ValidationError('Greige stock not found');
  }

  if (Number(receivedQuantity) > stock.quantityAvailable) {
    throw new ValidationError(
      `Received quantity (${receivedQuantity}) exceeds available at processor (${stock.quantityAvailable})`
    );
  }

  // Consume the received quantity from processor's stock (partial receipt)
  const result = await greigeStockService.receiveFromProcessor(greigeStockId, Number(receivedQuantity), userId, {
    notes: remarks,
    referenceType: 'PROCESSING_DELIVERY',
  });

  res.status(201).json({
    success: true,
    message: `Received ${result.receivedQuantity} MTR from processor. Remaining at processor: ${result.remainingAtProcessor} MTR`,
    data: {
      receivedQuantity: result.receivedQuantity,
      remainingAtProcessor: result.remainingAtProcessor,
    },
  });
};

/**
 * @route GET /api/stock-movements/pending-inward
 * @desc Get all pending inward items across external sources (POs, Process POs, Send-outs)
 * @access Private
 */
export const getPendingInward = async (req: Request, res: Response) => {
  const { sourceType, processorId, overdueOnly, page, limit } = req.query;

  const filters = {
    sourceType: sourceType as string | undefined,
    processorId: processorId as string | undefined,
    overdueOnly: overdueOnly === 'true',
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 50,
  };

  const result = await stockMovementService.getPendingInward(filters);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * @route GET /api/stock-movements/pending-outward
 * @desc Get all pending outward items (drafts awaiting send)
 * @access Private
 */
export const getPendingOutward = async (req: Request, res: Response) => {
  const { sourceType, processorId, page, limit } = req.query;

  const filters = {
    sourceType: sourceType as string | undefined,
    processorId: processorId as string | undefined,
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 50,
  };

  const result = await stockMovementService.getPendingOutward(filters);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * @route GET /api/stock-movements/dashboard-summary
 * @desc Get today's stock movement summary for dashboard
 * @access Private
 */
export const getDashboardSummary = async (_req: Request, res: Response) => {
  const summary = await stockMovementService.getDashboardTodaySummary();

  res.json({
    success: true,
    data: summary,
  });
};
