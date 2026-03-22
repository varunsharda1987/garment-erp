/**
 * Order Production Status Controller
 * Handles API endpoints for order-centric production status
 */

import { Request, Response } from 'express';
import { orderProductionStatusService } from '../services/orderProductionStatus.service';
import { orderCostingService } from '../services/orderCosting.service';
import { ValidationError } from '../errors';
import { logInfo, logDebug } from '../utils/logger';

/**
 * Get all order-level production status items with pagination and filters
 * GET /api/production-status/by-order
 */
export const getOrderStatusList = async (req: Request, res: Response): Promise<void> => {
  const options = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    search: req.query.search as string,
    brand: req.query.brand as string,
    customer: req.query.customer as string,
    status: req.query.status as 'all' | 'running' | 'completed' | 'delayed' | 'attention',
    stage: req.query.stage as any,
    cadStatus: req.query.cadStatus as any,
    orderDateFrom: req.query.orderDateFrom as string,
    orderDateTo: req.query.orderDateTo as string,
    deliveryDateFrom: req.query.deliveryDateFrom as string,
    deliveryDateTo: req.query.deliveryDateTo as string,
    sortBy: req.query.sortBy as 'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue',
    sortOrder: req.query.sortOrder as 'asc' | 'desc',
    styleId: req.query.styleId as string,
    orderId: req.query.orderId as string,
  };

  logDebug('Getting order production status list', options);

  const result = await orderProductionStatusService.getAll(options);

  res.json({
    success: true,
    ...result,
  });
};

/**
 * Get order production status summary
 * GET /api/production-status/by-order/summary
 */
export const getOrderStatusSummary = async (req: Request, res: Response): Promise<void> => {
  const summary = await orderProductionStatusService.getSummary();

  res.json({
    success: true,
    data: summary,
  });
};

/**
 * Select CAD width for an order item
 * PATCH /api/order-items/:id/select-cad
 */
export const selectCadForOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { cadId, recalculateCosting } = req.body;

  if (!cadId) {
    throw new ValidationError('cadId is required');
  }

  logInfo('Selecting CAD for order', { orderItemId: id, cadId, recalculateCosting });

  let result;
  if (recalculateCosting) {
    // Select CAD and recalculate costing in one operation
    result = await orderCostingService.selectCadAndRecalculate(id, cadId);
    res.json({
      success: true,
      message: 'CAD selected and costing recalculated',
      data: result,
    });
  } else {
    // Just select the CAD without recalculating
    result = await orderProductionStatusService.selectCad(id, cadId);
    res.json({
      success: true,
      message: 'CAD selected',
      data: result,
    });
  }
};

/**
 * Update inheritance settings for an order item
 * PATCH /api/order-items/:id/inheritance
 */
export const updateInheritanceSettings = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { inheritStyleSamples, inheritInspections } = req.body;

  if (inheritStyleSamples === undefined && inheritInspections === undefined) {
    throw new ValidationError('At least one inheritance setting is required');
  }

  logInfo('Updating inheritance settings', { orderItemId: id, inheritStyleSamples, inheritInspections });

  const result = await orderProductionStatusService.updateInheritance(id, {
    inheritStyleSamples,
    inheritInspections,
  });

  res.json({
    success: true,
    message: 'Inheritance settings updated',
    data: result,
  });
};

/**
 * Recalculate costing for an order item
 * POST /api/order-items/:id/recalculate-costing
 */
export const recalculateOrderCosting = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { selectedCadId } = req.body;

  logInfo('Recalculating order costing', { orderItemId: id, selectedCadId });

  const result = await orderCostingService.recalculate({
    orderItemId: id,
    selectedCadId,
  });

  res.json({
    success: true,
    message: 'Costing recalculated',
    data: result,
  });
};

/**
 * Get order item costing
 * GET /api/order-items/:id/costing
 */
export const getOrderItemCosting = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const costing = await orderCostingService.getByOrderItemId(id);

  res.json({
    success: true,
    data: costing,
  });
};

/**
 * Get costing comparison (base vs order-specific)
 * GET /api/order-items/:id/costing-comparison
 */
export const getCostingComparison = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const comparison = await orderCostingService.getCostingComparison(id);

  res.json({
    success: true,
    data: comparison,
  });
};

/**
 * Delete order item costing (reset to use style costing)
 * DELETE /api/order-items/:id/costing
 */
export const deleteOrderItemCosting = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await orderCostingService.delete(id);

  res.json({
    success: true,
    message: 'Order costing deleted, reverting to style costing',
  });
};
