// Stock Count Controller - RESTful API endpoints for physical inventory counts
import { Request, Response } from 'express';
import stockCountService, {
  CreateStockCountDTO,
  UpdateCountItemDTO
} from '../services/stockCount.service';
import { CountType, CountStatus, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * @route GET /api/stock-counts
 * @desc Get all stock counts with filters
 * @access Private
 */
export const getAllStockCounts = async (req: Request, res: Response) => {
  try {
    const { warehouseId, status, countType, startDate, endDate } = req.query;

    const filters: any = {};
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
  } catch (error: any) {
    logError('Get all stock counts error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch stock counts',
    });
  }
};

/**
 * @route GET /api/stock-counts/:id
 * @desc Get stock count by ID with items
 * @access Private
 */
export const getStockCountById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stockCount = await stockCountService.getStockCountById(id);

    res.json({
      success: true,
      data: stockCount,
    });
  } catch (error: any) {
    logError('Get stock count by ID error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch stock count',
    });
  }
};

/**
 * @route POST /api/stock-counts
 * @desc Create new stock count
 * @access Private (Inventory Manager)
 */
export const createStockCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { warehouseId, countType, countDate, remarks, materialIds } = req.body;

    // Validation
    if (!warehouseId || !countType) {
      return res.status(400).json({
        success: false,
        message: 'Warehouse and count type are required',
      });
    }

    if ((countType === 'PARTIAL' || countType === 'SPOT_CHECK') && (!materialIds || materialIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Material IDs are required for PARTIAL or SPOT_CHECK counts',
      });
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
  } catch (error: any) {
    logError('Create stock count error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create stock count',
    });
  }
};

/**
 * @route POST /api/stock-counts/:id/start
 * @desc Start counting process
 * @access Private
 */
export const startCounting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stockCount = await stockCountService.startCounting(id);

    res.json({
      success: true,
      message: 'Stock count started successfully',
      data: stockCount,
    });
  } catch (error: any) {
    logError('Start counting error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to start counting',
    });
  }
};

/**
 * @route PUT /api/stock-counts/:countId/items/:itemId
 * @desc Update count item with physical quantity
 * @access Private
 */
export const updateCountItem = async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    logError('Update count item error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('Cannot update') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update count item',
    });
  }
};

/**
 * @route POST /api/stock-counts/:id/verify
 * @desc Verify stock count
 * @access Private (Supervisor)
 */
export const verifyStockCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const stockCount = await stockCountService.verifyStockCount(id, userId);

    res.json({
      success: true,
      message: 'Stock count verified successfully',
      data: stockCount,
    });
  } catch (error: any) {
    logError('Verify stock count error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to verify stock count',
    });
  }
};

/**
 * @route POST /api/stock-counts/:id/approve
 * @desc Approve stock count and apply adjustments
 * @access Private (Manager only)
 */
export const approveStockCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const result = await stockCountService.approveStockCount(id, userId);

    res.json({
      success: true,
      message: `Stock count approved successfully. ${result.adjustmentCount} adjustments created.`,
      data: result,
    });
  } catch (error: any) {
    logError('Approve stock count error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to approve stock count',
    });
  }
};

/**
 * @route POST /api/stock-counts/:id/cancel
 * @desc Cancel stock count
 * @access Private
 */
export const cancelStockCount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stockCount = await stockCountService.cancelStockCount(id);

    res.json({
      success: true,
      message: 'Stock count cancelled successfully',
      data: stockCount,
    });
  } catch (error: any) {
    logError('Cancel stock count error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('Cannot cancel') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to cancel stock count',
    });
  }
};

/**
 * @route GET /api/stock-counts/:id/variance
 * @desc Get variance report for a stock count
 * @access Private
 */
export const getVarianceReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const report = await stockCountService.getVarianceReport(id);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logError('Get variance report error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch variance report',
    });
  }
};

/**
 * @route GET /api/stock-counts/summary/:warehouseId
 * @desc Get count summary for a warehouse
 * @access Private
 */
export const getCountSummary = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
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
  } catch (error: any) {
    logError('Get count summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch count summary',
    });
  }
};
