// Work Order Controller - RESTful API endpoints for work order management
import { Request, Response } from 'express';
import workOrderService, { CreateWorkOrderDTO, UpdateWorkOrderDTO, ProductionTrackingDTO, SplitWorkOrderDTO } from '../services/workOrder.service';
import { OrderStatus, Priority, ProductionStage } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';

/**
 * @route GET /api/work-orders
 * @desc Get all work orders with optional filters
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const getAllWorkOrders = async (req: Request, res: Response) => {
  try {
    const { status, priority, locationId, styleId, orderId, search, startDate, endDate } = req.query;

    const filters = {
      status: status as OrderStatus | undefined,
      priority: priority as Priority | undefined,
      locationId: locationId as string | undefined,
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
  } catch (error: unknown) {
    logError('Get all work orders error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch work orders',
    });
  }
};

/**
 * @route GET /api/work-orders/:id
 * @desc Get work order by ID
 * @access Private
 */
export const getWorkOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workOrder = await workOrderService.getWorkOrderById(id);

    res.json({
      success: true,
      data: workOrder,
    });
  } catch (error: unknown) {
    logError('Get work order by ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch work order';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route GET /api/work-orders/order/:orderId
 * @desc Get work orders by order ID
 * @access Private
 */
export const getWorkOrdersByOrderId = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const workOrders = await workOrderService.getWorkOrdersByOrderId(orderId);

    res.json({
      success: true,
      data: workOrders,
      count: workOrders.length,
    });
  } catch (error: unknown) {
    logError('Get work orders by order ID error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch work orders',
    });
  }
};

/**
 * @route POST /api/work-orders
 * @desc Create a new work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const createWorkOrder = async (req: Request, res: Response) => {
  try {
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
  } catch (error: unknown) {
    logError('Create work order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create work order';
    const statusCode = errorMessage.includes('already exists') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PUT /api/work-orders/:id
 * @desc Update a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const updateWorkOrder = async (req: Request, res: Response) => {
  try {
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

    res.json({
      success: true,
      data: workOrder,
      message: 'Work order updated successfully',
    });
  } catch (error: unknown) {
    logError('Update work order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update work order';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route DELETE /api/work-orders/:id
 * @desc Delete a work order
 * @access Private (ADMIN)
 */
export const deleteWorkOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await workOrderService.deleteWorkOrder(id);

    res.json(result);
  } catch (error: unknown) {
    logError('Delete work order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete work order';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/work-orders/:id/tracking
 * @desc Add production tracking update
 * @access Private (PRODUCTION_MANAGER, FACTORY_SUPERVISOR)
 */
export const addProductionTracking = async (req: Request, res: Response) => {
  try {
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
  } catch (error: unknown) {
    logError('Add production tracking error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add production tracking',
    });
  }
};

/**
 * @route GET /api/work-orders/dashboard/summary
 * @desc Get production dashboard data
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const getProductionDashboard = async (req: Request, res: Response) => {
  try {
    const dashboard = await workOrderService.getProductionDashboard();

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: unknown) {
    logError('Get production dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch production dashboard',
    });
  }
};

/**
 * @route PATCH /api/work-orders/:id/approve
 * @desc Approve a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const approveWorkOrder = async (req: Request, res: Response) => {
  try {
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
  } catch (error: unknown) {
    logError('Approve work order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to approve work order';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/work-orders/:id/split
 * @desc Split a work order for partial dispatch
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const splitWorkOrder = async (req: Request, res: Response) => {
  try {
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
  } catch (error: unknown) {
    logError('Split work order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to split work order';
    const statusCode = errorMessage.includes('not found') ? 404 :
                       errorMessage.includes('Can only split') ? 400 :
                       errorMessage.includes('exceeds') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route GET /api/work-orders/:id/material-readiness
 * @desc Check material readiness status for a work order
 * @access Private
 */
export const checkMaterialReadiness = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const readiness = await productionBlockingValidationService.checkMaterialReadiness(id);

    res.json({
      success: true,
      data: readiness,
    });
  } catch (error: unknown) {
    logError('Check material readiness error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check material readiness',
    });
  }
};

/**
 * @route POST /api/work-orders/:id/push-to-cutting
 * @desc Push work order to cutting stage (validates materials first)
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
export const pushToCutting = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

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
      false // Not admin override
    );

    if (validation.isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'Cannot push to cutting - blocking issues found',
        blockers: validation.blockers,
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
      remarks: 'Pushed to cutting - materials verified',
      updatedById: userId,
    });

    logInfo('Work order pushed to cutting', { workOrderId: id, userId });

    res.json({
      success: true,
      data: updatedWorkOrder,
      message: 'Work order successfully pushed to cutting',
    });
  } catch (error: unknown) {
    logError('Push to cutting error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to push to cutting';
    const statusCode = errorMessage.includes('not found') ? 404 :
                       errorMessage.includes('blocked') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};
