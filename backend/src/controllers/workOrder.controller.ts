// Work Order Controller - RESTful API endpoints for work order management
import { Request, Response } from 'express';
import workOrderService, { CreateWorkOrderDTO, UpdateWorkOrderDTO, ProductionTrackingDTO } from '../services/workOrder.service';
import { OrderStatus, Priority, ProductionStage } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

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
  } catch (error: any) {
    logError('Get all work orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch work orders',
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
  } catch (error: any) {
    logError('Get work order by ID error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch work order',
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
  } catch (error: any) {
    logError('Get work orders by order ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch work orders',
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
    const userId = (req as any).user?.userId || (req as any).user?.id;

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
  } catch (error: any) {
    logError('Create work order error:', error);
    const statusCode = error.message.includes('already exists') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create work order',
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
  } catch (error: any) {
    logError('Update work order error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update work order',
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
  } catch (error: any) {
    logError('Delete work order error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete work order',
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
    const userId = (req as any).user?.userId || (req as any).user?.id;

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

    const tracking = await workOrderService.addProductionTracking(trackingData);

    res.status(201).json({
      success: true,
      data: tracking,
      message: 'Production tracking updated successfully',
    });
  } catch (error: any) {
    logError('Add production tracking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add production tracking',
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
  } catch (error: any) {
    logError('Get production dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch production dashboard',
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
    const userId = (req as any).user?.id;

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
  } catch (error: any) {
    logError('Approve work order error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to approve work order',
    });
  }
};
