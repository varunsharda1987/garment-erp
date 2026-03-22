// Work Order Controller - RESTful API endpoints for work order management
import { Request, Response } from 'express';
import workOrderService, { CreateWorkOrderDTO, UpdateWorkOrderDTO, ProductionTrackingDTO, SplitWorkOrderDTO } from '../services/workOrder.service';
import { OrderStatus, Priority, ProductionStage } from '@prisma/client';
import { logInfo, logWarn, logDebug } from '../utils/logger';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';
import { updateCostSheetActuals } from '../services/costSheet.service';
import { NotFoundError, ValidationError, ConflictError, BusinessError } from '../errors';

/**
 * @route GET /api/work-orders
 * @desc Get all work orders with optional filters
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const getAllWorkOrders = async (req: Request, res: Response) => {
  const { status, priority, warehouseId, styleId, orderId, search, startDate, endDate } = req.query;

  const filters = {
    status: status as OrderStatus | undefined,
    priority: priority as Priority | undefined,
    warehouseId: warehouseId as string | undefined,
    styleId: styleId as string | undefined,
    orderId: orderId as string | undefined,
    search: search as string | undefined,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
  };

  const workOrders = await workOrderService.getAllWorkOrders(filters);

  res.json({
    success: true,
    data: workOrders,
    count: workOrders.length,
  });
};

/**
 * @route GET /api/work-orders/:id
 * @desc Get work order by ID
 * @access Private
 */
export const getWorkOrderById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const workOrder = await workOrderService.getWorkOrderById(id);

  res.json({
    success: true,
    data: workOrder,
  });
};

/**
 * @route GET /api/work-orders/order/:orderId
 * @desc Get work orders by order ID
 * @access Private
 */
export const getWorkOrdersByOrderId = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const workOrders = await workOrderService.getWorkOrdersByOrderId(orderId);

  res.json({
    success: true,
    data: workOrders,
    count: workOrders.length,
  });
};

/**
 * @route POST /api/work-orders
 * @desc Create a new work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const createWorkOrder = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const workOrderData: CreateWorkOrderDTO = {
    ...req.body,
    plannedStartDate: new Date(req.body.plannedStartDate),
    plannedEndDate: new Date(req.body.plannedEndDate),
    createdById: userId,
  };

  const workOrder = await workOrderService.createWorkOrder(workOrderData);

  res.status(201).json({
    success: true,
    data: workOrder,
    message: 'Work order created successfully',
  });
};

/**
 * @route PUT /api/work-orders/:id
 * @desc Update a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const updateWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;

  const updateData: UpdateWorkOrderDTO = {
    ...req.body,
  };

  // Convert date strings to Date objects if present
  if (req.body.plannedStartDate) {
    updateData.plannedStartDate = new Date(req.body.plannedStartDate);
  }
  if (req.body.plannedEndDate) {
    updateData.plannedEndDate = new Date(req.body.plannedEndDate);
  }
  if (req.body.actualStartDate) {
    updateData.actualStartDate = new Date(req.body.actualStartDate);
  }
  if (req.body.actualEndDate) {
    updateData.actualEndDate = new Date(req.body.actualEndDate);
  }

  const workOrder = await workOrderService.updateWorkOrder(id, updateData);

  // ==========================================
  // PHASE 2C: Auto-update CMT actuals when work order is completed
  // ==========================================
  if (updateData.status === OrderStatus.COMPLETED && workOrder.styleId) {
    try {
      // For now, use a placeholder CMT cost calculation
      // In production, this could be based on:
      // - Actual labor hours * rate
      // - Actual contractor payment
      // - Transfer slip costs
      // Since we don't have these fields yet, we log for future implementation
      logInfo('Work order completed - CMT actual update pending', {
        workOrderId: id,
        styleId: workOrder.styleId,
        totalQuantity: workOrder.totalQuantity,
        completedQuantity: workOrder.completedQuantity,
      });

      // TODO: Implement actual CMT cost calculation
      // Example:
      // const cmtCost = calculateCMTCost(workOrder);
      // await updateCostSheetActuals({
      //   styleId: workOrder.styleId,
      //   category: 'CMT',
      //   actualCost: cmtCost,
      //   source: 'WORK_ORDER',
      // });
    } catch (error) {
      logWarn('Failed to auto-update CMT actuals from work order', error);
    }
  }
  // ==========================================

  res.json({
    success: true,
    data: workOrder,
    message: 'Work order updated successfully',
  });
};

/**
 * @route DELETE /api/work-orders/:id
 * @desc Delete a work order
 * @access Private (ADMIN)
 */
export const deleteWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await workOrderService.deleteWorkOrder(id);

  res.json(result);
};

/**
 * @route POST /api/work-orders/:id/tracking
 * @desc Add production tracking update
 * @access Private (PRODUCTION_MANAGER, FACTORY_SUPERVISOR)
 */
export const addProductionTracking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const trackingData: ProductionTrackingDTO = {
    workOrderId: id,
    productionStage: req.body.productionStage as ProductionStage,
    quantityCompleted: parseInt(req.body.quantityCompleted),
    remarks: req.body.remarks,
    updatedById: userId,
  };

  // Extract admin override parameters
  const adminOverride = req.body.adminOverride === true;
  const overrideReason = req.body.overrideReason;

  const tracking = await workOrderService.addProductionTracking(
    trackingData,
    adminOverride,
    overrideReason
  );

  res.status(201).json({
    success: true,
    data: tracking,
    message: 'Production tracking updated successfully',
  });
};

/**
 * @route GET /api/work-orders/dashboard/summary
 * @desc Get production dashboard data
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const getProductionDashboard = async (req: Request, res: Response) => {
  const dashboard = await workOrderService.getProductionDashboard();

  res.json({
    success: true,
    data: dashboard,
  });
};

/**
 * @route PATCH /api/work-orders/:id/approve
 * @desc Approve a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const approveWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const workOrder = await workOrderService.updateWorkOrder(id, {
    approvedById: userId,
    status: OrderStatus.PENDING,
  });

  res.json({
    success: true,
    data: workOrder,
    message: 'Work order approved successfully',
  });
};

/**
 * @route POST /api/work-orders/:id/split
 * @desc Split a work order for partial dispatch
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const splitWorkOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  const splitData: SplitWorkOrderDTO = {
    plannedDispatchDate: new Date(req.body.plannedDispatchDate),
    breakupToSplit: req.body.breakupToSplit,
    remarks: req.body.remarks,
  };

  const newWorkOrder = await workOrderService.splitWorkOrder(id, splitData, userId);

  res.status(201).json({
    success: true,
    data: newWorkOrder,
    message: 'Work order split successfully',
  });
};

/**
 * @route GET /api/work-orders/:id/material-readiness
 * @desc Check material readiness status for a work order
 * @access Private
 */
export const checkMaterialReadiness = async (req: Request, res: Response) => {
  const { id } = req.params;

  const readiness = await productionBlockingValidationService.checkMaterialReadiness(id);

  res.json({
    success: true,
    data: readiness,
  });
};

/**
 * @route POST /api/work-orders/:id/push-to-cutting
 * @desc Push work order to cutting stage (validates materials first)
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const pushToCutting = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  const adminOverride = req.body.adminOverride === true;
  const overrideReason = req.body.overrideReason as string | undefined;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  // Validate material availability for cutting
  const validation = await productionBlockingValidationService.validateStageTransition(
    id,
    ProductionStage.IN_CUTTING,
    adminOverride
  );

  if (validation.isBlocked) {
    throw new ValidationError('Cannot push to cutting - blocking issues found', {
      blockers: validation.blockers as unknown as Record<string, unknown>,
    });
  }

  // Update work order status to IN_PRODUCTION and set actual start date
  const updatedWorkOrder = await workOrderService.updateWorkOrder(id, {
    status: OrderStatus.IN_PRODUCTION,
    actualStartDate: new Date(),
  });

  // Add tracking entry for cutting stage
  await workOrderService.addProductionTracking({
    workOrderId: id,
    productionStage: ProductionStage.IN_CUTTING,
    quantityCompleted: 0,
    remarks: adminOverride
      ? `Pushed to cutting - OVERRIDE: ${overrideReason}`
      : 'Pushed to cutting - materials verified',
    updatedById: userId,
  });

  // Log override to audit table if used
  if (adminOverride && overrideReason) {
    await productionBlockingValidationService.logOverride({
      blockType: 'STAGE_TRANSITION',
      workOrderId: id,
      toStage: ProductionStage.IN_CUTTING,
      overrideReason,
      overriddenById: userId,
    });
  }

  logInfo('Work order pushed to cutting', { workOrderId: id, userId, adminOverride });

  res.json({
    success: true,
    data: updatedWorkOrder,
    message: 'Work order successfully pushed to cutting',
  });
};
