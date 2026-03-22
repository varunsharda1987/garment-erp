/**
 * Lace Stock Controller
 *
 * API endpoints for lace stock management:
 * - Stock queries and listing
 * - Stock allocation to orders
 * - Stock transfers between styles
 * - Stock consumption and returns
 * - Reports (aging, utilization)
 */

import { Request, Response } from 'express';
import {
  createLaceStock,
  getLaceStockById,
  getAllLaceStock,
  getAvailableStockForLace,
  allocateStock,
  transferStock,
  consumeStock,
  returnStock,
  getStockAgingReport,
  getStockUtilizationReport,
  getStockTransactionHistory,
} from '../services/laceStock.service';
import { serialize } from '../utils/serializer';
import { NotFoundError, ValidationError } from '../errors';

/**
 * POST /api/lace-stock
 * Create a new lace stock entry
 */
export async function createStock(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const {
    laceId,
    lotNumber,
    dyeLotNumber,
    shadeNote,
    originStyleId,
    originOrderId,
    originStyleCode,
    procurementId,
    processingBatchId,
    warehouseLocation,
    rackNumber,
    quantityAvailable,
    weightedAvgCost,
    purchaseCost,
    qualityGrade,
    stockType,
  } = req.body;

  if (!laceId || quantityAvailable === undefined || weightedAvgCost === undefined) {
    throw new ValidationError('Missing required fields: laceId, quantityAvailable, weightedAvgCost');
  }

  const stock = await createLaceStock({
    laceId,
    lotNumber,
    dyeLotNumber,
    shadeNote,
    originStyleId,
    originOrderId,
    originStyleCode,
    procurementId,
    processingBatchId,
    warehouseLocation,
    rackNumber,
    quantityAvailable: parseFloat(quantityAvailable),
    weightedAvgCost: parseFloat(weightedAvgCost),
    purchaseCost: purchaseCost ? parseFloat(purchaseCost) : parseFloat(weightedAvgCost),
    qualityGrade,
    stockType,
    createdById: userId,
  });

  res.status(201).json(
    serialize({
      success: true,
      data: stock,
      message: 'Lace stock created successfully',
    })
  );
}

/**
 * GET /api/lace-stock
 * Get all lace stock with filters and pagination
 */
export async function getStocks(req: Request, res: Response) {
  const {
    laceId,
    originStyleId,
    originOrderId,
    status,
    stockType,
    qualityGrade,
    warehouseLocation,
    minQuantity,
    search,
    page,
    limit,
  } = req.query;

  const result = await getAllLaceStock({
    laceId: laceId as string,
    originStyleId: originStyleId as string,
    originOrderId: originOrderId as string,
    status: status as string,
    stockType: stockType as string,
    qualityGrade: qualityGrade as string,
    warehouseLocation: warehouseLocation as string,
    minQuantity: minQuantity ? parseFloat(minQuantity as string) : undefined,
    search: search as string,
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  res.json(
    serialize({
      success: true,
      ...result,
    })
  );
}

/**
 * GET /api/lace-stock/:id
 * Get stock by ID with full details
 */
export async function getStock(req: Request, res: Response) {
  const { id } = req.params;

  const stock = await getLaceStockById(id);

  if (!stock) {
    throw new NotFoundError('Stock', id);
  }

  res.json(
    serialize({
      success: true,
      data: stock,
    })
  );
}

/**
 * GET /api/lace-stock/available/:laceId
 * Get available stock for a specific lace item
 */
export async function getAvailableStock(req: Request, res: Response) {
  const { laceId } = req.params;
  const { minQuantity } = req.query;

  const result = await getAvailableStockForLace(laceId, minQuantity ? parseFloat(minQuantity as string) : 0);

  res.json(
    serialize({
      success: true,
      ...result,
    })
  );
}

/**
 * POST /api/lace-stock/:id/allocate
 * Allocate stock to an order/style
 */
export async function allocateStockController(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { orderId, styleId, styleCode, quantityToAllocate, allocationType, notes } = req.body;

  if (!orderId || !styleId || quantityToAllocate === undefined) {
    throw new ValidationError('Missing required fields: orderId, styleId, quantityToAllocate');
  }

  const allocation = await allocateStock({
    stockId: id,
    orderId,
    styleId,
    styleCode,
    quantityToAllocate: parseFloat(quantityToAllocate),
    allocationType,
    notes,
    createdById: userId,
  });

  res.status(201).json(
    serialize({
      success: true,
      data: allocation,
      message: 'Stock allocated successfully',
    })
  );
}

/**
 * POST /api/lace-stock/:id/transfer
 * Transfer stock to another style
 */
export async function transferStockController(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { id } = req.params;
  const { toOrderId, toStyleId, toStyleCode, quantityToTransfer, transferNotes } = req.body;

  if (!toOrderId || !toStyleId || quantityToTransfer === undefined) {
    throw new ValidationError('Missing required fields: toOrderId, toStyleId, quantityToTransfer');
  }

  const allocation = await transferStock({
    stockId: id,
    toOrderId,
    toStyleId,
    toStyleCode,
    quantityToTransfer: parseFloat(quantityToTransfer),
    transferNotes,
    performedById: userId,
  });

  res.status(201).json(
    serialize({
      success: true,
      data: allocation,
      message: 'Stock transferred successfully',
    })
  );
}

/**
 * POST /api/lace-stock/allocations/:allocationId/consume
 * Consume allocated stock (issue to production)
 */
export async function consumeStockController(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { allocationId } = req.params;
  const { quantityConsumed, notes } = req.body;

  if (quantityConsumed === undefined) {
    throw new ValidationError('Missing required field: quantityConsumed');
  }

  const allocation = await consumeStock({
    allocationId,
    quantityConsumed: parseFloat(quantityConsumed),
    notes,
    performedById: userId,
  });

  res.json(
    serialize({
      success: true,
      data: allocation,
      message: 'Stock consumed successfully',
    })
  );
}

/**
 * POST /api/lace-stock/allocations/:allocationId/return
 * Return unused stock from production
 */
export async function returnStockController(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { allocationId } = req.params;
  const { quantityToReturn, notes } = req.body;

  if (quantityToReturn === undefined) {
    throw new ValidationError('Missing required field: quantityToReturn');
  }

  const allocation = await returnStock({
    allocationId,
    quantityToReturn: parseFloat(quantityToReturn),
    notes,
    performedById: userId,
  });

  res.json(
    serialize({
      success: true,
      data: allocation,
      message: 'Stock returned successfully',
    })
  );
}

/**
 * GET /api/lace-stock/:id/transactions
 * Get transaction history for a stock lot
 */
export async function getTransactions(req: Request, res: Response) {
  const { id } = req.params;

  const transactions = await getStockTransactionHistory(id);

  res.json(
    serialize({
      success: true,
      data: transactions,
    })
  );
}

/**
 * GET /api/lace-stock/reports/aging
 * Get stock aging report
 */
export async function getAgingReport(req: Request, res: Response) {
  const { minAgeDays } = req.query;

  const report = await getStockAgingReport(minAgeDays ? parseInt(minAgeDays as string) : 90);

  res.json(
    serialize({
      success: true,
      data: report,
    })
  );
}

/**
 * GET /api/lace-stock/reports/utilization
 * Get stock utilization report
 */
export async function getUtilizationReport(req: Request, res: Response) {
  const report = await getStockUtilizationReport();

  res.json(
    serialize({
      success: true,
      data: report,
    })
  );
}

export default {
  createStock,
  getStocks,
  getStock,
  getAvailableStock,
  allocateStockController,
  transferStockController,
  consumeStockController,
  returnStockController,
  getTransactions,
  getAgingReport,
  getUtilizationReport,
};
