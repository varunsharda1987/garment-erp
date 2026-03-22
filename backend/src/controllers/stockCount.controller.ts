// Stock Count Controller - RESTful API endpoints for physical inventory counts
import { Request, Response } from 'express';
import stockCountService, {
  CreateStockCountDTO,
  UpdateCountItemDTO
} from '../services/stockCount.service';
import { CountType, CountStatus, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { NotFoundError, ValidationError } from '../errors';

// ============================================
// Types for Stock Count Controller
// ============================================

interface StockCountFilters {
  warehouseId?: string;
  status?: CountStatus;
  countType?: CountType;
  startDate?: Date;
  endDate?: Date;
}

/**
 * @route GET /api/stock-counts
 * @desc Get all stock counts with filters
 * @access Private
 */
export const getAllStockCounts = async (req: Request, res: Response) => {
  const { warehouseId, status, countType, startDate, endDate } = req.query;

  const filters: StockCountFilters = {};
  if (warehouseId) filters.warehouseId = warehouseId as string;
  if (status) filters.status = status as CountStatus;
  if (countType) filters.countType = countType as CountType;
  if (startDate) filters.startDate = new Date(startDate as string);
  if (endDate) filters.endDate = new Date(endDate as string);

  const stockCounts = await stockCountService.getAllStockCounts(filters);

  res.json({
    success: true,
    data: stockCounts,
    count: stockCounts.length,
  });
};

/**
 * @route GET /api/stock-counts/:id
 * @desc Get stock count by ID with items
 * @access Private
 */
export const getStockCountById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const stockCount = await stockCountService.getStockCountById(id);

  res.json({
    success: true,
    data: stockCount,
  });
};

/**
 * @route POST /api/stock-counts
 * @desc Create new stock count
 * @access Private (Inventory Manager)
 */
export const createStockCount = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { warehouseId, countType, countDate, remarks, materialIds } = req.body;

  // Validation
  if (!warehouseId || !countType) {
    throw new ValidationError('Warehouse and count type are required');
  }

  if ((countType === 'PARTIAL' || countType === 'SPOT_CHECK') && (!materialIds || materialIds.length === 0)) {
    throw new ValidationError('Material IDs are required for PARTIAL or SPOT_CHECK counts');
  }

  const countData: CreateStockCountDTO = {
    warehouseId,
    countType: countType as CountType,
    countDate: countDate ? new Date(countDate) : undefined,
    remarks,
    countedById: userId,
    materialIds,
  };

  const stockCount = await stockCountService.createStockCount(countData);

  res.status(201).json({
    success: true,
    message: 'Stock count created successfully',
    data: stockCount,
  });
};

/**
 * @route POST /api/stock-counts/:id/start
 * @desc Start counting process
 * @access Private
 */
export const startCounting = async (req: Request, res: Response) => {
  const { id } = req.params;

  const stockCount = await stockCountService.startCounting(id);

  res.json({
    success: true,
    message: 'Stock count started successfully',
    data: stockCount,
  });
};

/**
 * @route PUT /api/stock-counts/:countId/items/:itemId
 * @desc Update count item with physical quantity
 * @access Private
 */
export const updateCountItem = async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const { physicalQuantity, remarks } = req.body;

  const updateData: UpdateCountItemDTO = {
    physicalQuantity: physicalQuantity !== undefined ? new Decimal(physicalQuantity) : undefined,
    remarks,
  };

  const item = await stockCountService.updateCountItem(itemId, updateData);

  res.json({
    success: true,
    message: 'Count item updated successfully',
    data: item,
  });
};

/**
 * @route POST /api/stock-counts/:id/verify
 * @desc Verify stock count
 * @access Private (Supervisor)
 */
export const verifyStockCount = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { id } = req.params;

  const stockCount = await stockCountService.verifyStockCount(id, userId);

  res.json({
    success: true,
    message: 'Stock count verified successfully',
    data: stockCount,
  });
};

/**
 * @route POST /api/stock-counts/:id/approve
 * @desc Approve stock count and apply adjustments
 * @access Private (Manager only)
 */
export const approveStockCount = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const { id } = req.params;

  const result = await stockCountService.approveStockCount(id, userId);

  res.json({
    success: true,
    message: `Stock count approved successfully. ${result.adjustmentCount} adjustments created.`,
    data: result,
  });
};

/**
 * @route POST /api/stock-counts/:id/cancel
 * @desc Cancel stock count
 * @access Private
 */
export const cancelStockCount = async (req: Request, res: Response) => {
  const { id } = req.params;

  const stockCount = await stockCountService.cancelStockCount(id);

  res.json({
    success: true,
    message: 'Stock count cancelled successfully',
    data: stockCount,
  });
};

/**
 * @route GET /api/stock-counts/:id/variance
 * @desc Get variance report for a stock count
 * @access Private
 */
export const getVarianceReport = async (req: Request, res: Response) => {
  const { id } = req.params;

  const report = await stockCountService.getVarianceReport(id);

  res.json({
    success: true,
    data: report,
  });
};

/**
 * @route GET /api/stock-counts/summary/:warehouseId
 * @desc Get count summary for a warehouse
 * @access Private
 */
export const getCountSummary = async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ValidationError('Start date and end date are required');
  }

  const summary = await stockCountService.getCountSummary(
    warehouseId,
    new Date(startDate as string),
    new Date(endDate as string)
  );

  res.json({
    success: true,
    data: summary,
  });
};
