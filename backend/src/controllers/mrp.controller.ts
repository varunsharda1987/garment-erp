/**
 * MRP (Material Requirement Planning) Controller
 * Handles HTTP requests for material requirements management
 */

import { Request, Response } from 'express';
import mrpService from '../services/mrp.service';
import { MaterialRequirementStatus } from '@prisma/client';
import {
  CalculateRequirementsRequest,
  CreateManualRequirementRequest,
  GeneratePOFromRequirementsRequest,
  AllocateStockRequest,
  LinkRequirementToPORequest,
  RequirementFilters,
} from '../types/mrp.types';

/**
 * Calculate material requirements from an order's BOM
 * POST /api/mrp/calculate
 */
export const calculateRequirements = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const data: CalculateRequirementsRequest = req.body;

    if (!data.orderId) {
      res.status(400).json({ success: false, error: 'orderId is required' });
      return;
    }

    if (!data.requiredDate) {
      res.status(400).json({ success: false, error: 'requiredDate is required' });
      return;
    }

    const result = await mrpService.calculateRequirementsFromOrder(
      {
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        requiredDate: new Date(data.requiredDate),
        checkStock: data.checkStock ?? true,
      },
      userId
    );

    res.json({
      success: true,
      data: result,
      message: `Created ${result.created} new requirements, updated ${result.updated} existing`,
    });
  } catch (error: any) {
    console.error('Error calculating requirements:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate requirements',
    });
  }
};

/**
 * Create a manual material requirement
 * POST /api/mrp/requirements
 */
export const createManualRequirement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const data: CreateManualRequirementRequest = req.body;

    if (!data.materialId || !data.quantity || !data.unit || !data.requiredDate) {
      res.status(400).json({
        success: false,
        error: 'materialId, quantity, unit, and requiredDate are required',
      });
      return;
    }

    const requirement = await mrpService.createManualRequirement(data, userId);

    res.status(201).json({
      success: true,
      data: requirement,
      message: `Requirement ${requirement.requirementNumber} created`,
    });
  } catch (error: any) {
    console.error('Error creating manual requirement:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create requirement',
    });
  }
};

/**
 * Get all requirements with filters
 * GET /api/mrp/requirements
 */
export const getRequirements = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters: RequirementFilters = {
      orderId: req.query.orderId as string,
      orderItemId: req.query.orderItemId as string,
      materialId: req.query.materialId as string,
      supplierId: req.query.supplierId as string,
      status: req.query.status as MaterialRequirementStatus | undefined,
      source: req.query.source as any,
      requiredDateFrom: req.query.requiredDateFrom as string,
      requiredDateTo: req.query.requiredDateTo as string,
      hasShortfall: req.query.hasShortfall === 'true' ? true : req.query.hasShortfall === 'false' ? false : undefined,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: (req.query.sortBy as string) || 'createdAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    // Handle multiple status values
    if (req.query.status && typeof req.query.status === 'string' && req.query.status.includes(',')) {
      filters.status = req.query.status.split(',') as MaterialRequirementStatus[];
    }

    const { data, total } = await mrpService.getRequirements(filters);

    res.json({
      success: true,
      data,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
    });
  } catch (error: any) {
    console.error('Error getting requirements:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch requirements',
    });
  }
};

/**
 * Get a single requirement by ID
 * GET /api/mrp/requirements/:id
 */
export const getRequirementById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const requirement = await mrpService.getRequirementById(id);

    if (!requirement) {
      res.status(404).json({ success: false, error: 'Requirement not found' });
      return;
    }

    res.json({ success: true, data: requirement });
  } catch (error: any) {
    console.error('Error getting requirement:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch requirement',
    });
  }
};

/**
 * Get requirements summary for an order
 * GET /api/mrp/orders/:orderId/summary
 */
export const getOrderRequirementsSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const summary = await mrpService.getOrderRequirementsSummary(orderId);

    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Error getting order requirements summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch summary',
    });
  }
};

/**
 * Get MRP dashboard statistics
 * GET /api/mrp/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await mrpService.getDashboardStats();

    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard stats',
    });
  }
};

/**
 * Allocate stock to a requirement
 * POST /api/mrp/requirements/:id/allocate-stock
 */
export const allocateStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { quantity, warehouseId } = req.body;

    if (!quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'Valid quantity is required' });
      return;
    }

    const data: AllocateStockRequest = {
      requirementId: id,
      quantity,
      warehouseId,
    };

    const requirement = await mrpService.allocateStock(data, userId);

    res.json({
      success: true,
      data: requirement,
      message: `Allocated ${quantity} units from stock`,
    });
  } catch (error: any) {
    console.error('Error allocating stock:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to allocate stock',
    });
  }
};

/**
 * Generate Purchase Order from requirements
 * POST /api/mrp/generate-po
 */
export const generatePO = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const data: GeneratePOFromRequirementsRequest = req.body;

    if (!data.requirementIds || data.requirementIds.length === 0) {
      res.status(400).json({ success: false, error: 'At least one requirement ID is required' });
      return;
    }

    if (!data.supplierId) {
      res.status(400).json({ success: false, error: 'Supplier ID is required' });
      return;
    }

    if (!data.expectedDeliveryDate) {
      res.status(400).json({ success: false, error: 'Expected delivery date is required' });
      return;
    }

    const result = await mrpService.generatePOFromRequirements(data, userId);

    res.status(201).json({
      success: true,
      data: result,
      message: `Purchase Order ${result.purchaseOrder.poNumber} created with ${result.totalItems} items`,
    });
  } catch (error: any) {
    console.error('Error generating PO:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate purchase order',
    });
  }
};

/**
 * Link a requirement to an existing PO item
 * POST /api/mrp/requirements/:id/link-po
 */
export const linkToPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { purchaseOrderId, purchaseOrderItemId, allocatedQuantity } = req.body;

    if (!purchaseOrderId || !purchaseOrderItemId || !allocatedQuantity) {
      res.status(400).json({
        success: false,
        error: 'purchaseOrderId, purchaseOrderItemId, and allocatedQuantity are required',
      });
      return;
    }

    const data: LinkRequirementToPORequest = {
      requirementId: id,
      purchaseOrderId,
      purchaseOrderItemId,
      allocatedQuantity,
    };

    const requirement = await mrpService.linkRequirementToPO(data, userId);

    res.json({
      success: true,
      data: requirement,
      message: 'Requirement linked to PO item',
    });
  } catch (error: any) {
    console.error('Error linking to PO:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to link requirement to PO',
    });
  }
};

/**
 * Update requirement status
 * PATCH /api/mrp/requirements/:id/status
 */
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required' });
      return;
    }

    // Validate status value
    const validStatuses = Object.values(MaterialRequirementStatus);
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const requirement = await mrpService.updateRequirementStatus(id, status, userId);

    res.json({
      success: true,
      data: requirement,
      message: `Requirement status updated to ${status}`,
    });
  } catch (error: any) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update requirement status',
    });
  }
};

/**
 * Cancel a requirement
 * DELETE /api/mrp/requirements/:id
 */
export const cancelRequirement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const requirement = await mrpService.cancelRequirement(id, userId);

    res.json({
      success: true,
      data: requirement,
      message: 'Requirement cancelled',
    });
  } catch (error: any) {
    console.error('Error cancelling requirement:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel requirement',
    });
  }
};

export default {
  calculateRequirements,
  createManualRequirement,
  getRequirements,
  getRequirementById,
  getOrderRequirementsSummary,
  getDashboardStats,
  allocateStock,
  generatePO,
  linkToPO,
  updateStatus,
  cancelRequirement,
};
