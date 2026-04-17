/**
 * MRP (Material Requirement Planning) Controller
 * Handles HTTP requests for material requirements management
 */

import { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../errors';
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
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const data: CalculateRequirementsRequest = req.body;

  if (!data.orderId) {
    throw new ValidationError('orderId is required');
  }

  if (!data.requiredDate) {
    throw new ValidationError('requiredDate is required');
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

  const skipped = result.skipped || [];
  const totalCalc = result.created + result.updated;
  const messageParts = [`Created ${result.created} new requirements, updated ${result.updated} existing`];
  if (skipped.length > 0) {
    messageParts.push(`${skipped.length} BOM item(s) skipped — missing material linkages`);
  }

  res.json({
    success: true,
    data: result,
    message: messageParts.join('. '),
    ...(totalCalc === 0 && skipped.length > 0
      ? {
          warning: `All BOM items were skipped. Check material linkages.`,
        }
      : {}),
  });
};

/**
 * Create a manual material requirement
 * POST /api/mrp/requirements
 */
export const createManualRequirement = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const data: CreateManualRequirementRequest = req.body;

  if (!data.materialId || !data.quantity || !data.unit || !data.requiredDate) {
    throw new ValidationError('materialId, quantity, unit, and requiredDate are required');
  }

  const requirement = await mrpService.createManualRequirement(data, userId);

  res.status(201).json({
    success: true,
    data: requirement,
    message: `Requirement ${requirement.requirementNumber} created`,
  });
};

/**
 * Get all requirements with filters
 * GET /api/mrp/requirements
 */
export const getRequirements = async (req: Request, res: Response): Promise<void> => {
  const filters: RequirementFilters = {
    orderId: req.query.orderId as string,
    orderItemId: req.query.orderItemId as string,
    materialId: req.query.materialId as string,
    supplierId: req.query.supplierId as string,
    styleId: req.query.styleId as string,
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
    requirementType: req.query.requirementType as 'MATERIAL' | 'PROCESSING' | undefined,
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
};

/**
 * Get a single requirement by ID
 * GET /api/mrp/requirements/:id
 */
export const getRequirementById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const requirement = await mrpService.getRequirementById(id);

  if (!requirement) {
    throw new NotFoundError('Requirement', id);
  }

  res.json({ success: true, data: requirement });
};

/**
 * Get requirements summary for an order
 * GET /api/mrp/orders/:orderId/summary
 */
export const getOrderRequirementsSummary = async (req: Request, res: Response): Promise<void> => {
  const { orderId } = req.params;

  const summary = await mrpService.getOrderRequirementsSummary(orderId);

  res.json({ success: true, data: summary });
};

/**
 * Get MRP dashboard statistics
 * GET /api/mrp/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  const stats = await mrpService.getDashboardStats();

  res.json({ success: true, data: stats });
};

/**
 * Allocate stock to a requirement
 * POST /api/mrp/requirements/:id/allocate-stock
 */
export const allocateStock = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;
  const { quantity, warehouseId } = req.body;

  if (!quantity || quantity <= 0) {
    throw new ValidationError('Valid quantity is required');
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
};

/**
 * Generate Purchase Order from requirements
 * POST /api/mrp/generate-po
 */
export const generatePO = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const data: GeneratePOFromRequirementsRequest = req.body;

  if (!data.requirementIds || data.requirementIds.length === 0) {
    throw new ValidationError('At least one requirement ID is required');
  }

  if (!data.supplierId) {
    throw new ValidationError('Supplier ID is required');
  }

  if (!data.expectedDeliveryDate) {
    throw new ValidationError('Expected delivery date is required');
  }

  const result = await mrpService.generatePOFromRequirements(data, userId);

  res.status(201).json({
    success: true,
    data: result,
    message: `Purchase Order ${result.purchaseOrder.poNumber} created with ${result.totalItems} items`,
  });
};

/**
 * Link a requirement to an existing PO item
 * POST /api/mrp/requirements/:id/link-po
 */
export const linkToPO = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;
  const { purchaseOrderId, purchaseOrderItemId, allocatedQuantity } = req.body;

  if (!purchaseOrderId || !purchaseOrderItemId || !allocatedQuantity) {
    throw new ValidationError('purchaseOrderId, purchaseOrderItemId, and allocatedQuantity are required');
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
};

/**
 * Update requirement status
 * PATCH /api/mrp/requirements/:id/status
 */
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  // Validate status value
  const validStatuses = Object.values(MaterialRequirementStatus);
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const requirement = await mrpService.updateRequirementStatus(id, status, userId);

  res.json({
    success: true,
    data: requirement,
    message: `Requirement status updated to ${status}`,
  });
};

/**
 * Cancel a requirement
 * DELETE /api/mrp/requirements/:id
 */
export const cancelRequirement = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;

  const requirement = await mrpService.cancelRequirement(id, userId);

  res.json({
    success: true,
    data: requirement,
    message: 'Requirement cancelled',
  });
};

/**
 * Group requirements by supplier for bulk PO generation
 * POST /api/mrp/group-by-supplier
 */
export const groupBySupplier = async (req: Request, res: Response): Promise<void> => {
  const { requirementIds } = req.body;

  if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
    throw new ValidationError('requirementIds must be a non-empty array');
  }

  const result = await mrpService.groupRequirementsBySupplier(requirementIds);

  // Convert Map to object for JSON serialization
  const groupsObject: Record<string, any[]> = {};
  result.groups.forEach((requirements, supplierId) => {
    groupsObject[supplierId] = requirements;
  });

  res.json({
    success: true,
    data: {
      groups: groupsObject,
      unassigned: result.unassigned,
      summary: result.summary,
    },
  });
};

/**
 * Generate multiple POs from grouped requirements (bulk operation)
 * POST /api/mrp/generate-pos-bulk
 */
export const bulkGeneratePO = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const { groups } = req.body;

  if (!Array.isArray(groups) || groups.length === 0) {
    throw new ValidationError('groups must be a non-empty array');
  }

  const result = await mrpService.generatePOsBySupplier(groups, userId);

  res.json({
    success: true,
    data: result,
    message: `${result.totalPOs} Purchase Order(s) generated for ${result.totalRequirements} requirement(s)${
      result.errors.length > 0 ? ` (${result.errors.length} error(s))` : ''
    }`,
  });
};

/**
 * Validate requirements for bulk PO generation
 * POST /api/mrp/validate-bulk-po
 */
export const validateBulkPO = async (req: Request, res: Response): Promise<void> => {
  const { requirementIds } = req.body;

  if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
    throw new ValidationError('requirementIds must be a non-empty array');
  }

  const result = await mrpService.validateBulkPOGeneration(requirementIds);

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Get distinct styles that have material requirements (for filter dropdown)
 */
export const getDistinctRequirementStyles = async (req: Request, res: Response): Promise<void> => {
  const requirementType = req.query.requirementType as string | undefined;
  const styles = await mrpService.getDistinctRequirementStyles(requirementType);
  res.json({ success: true, data: styles });
};

/**
 * Convert a MATERIAL requirement to GREIGE + PROCESSING requirements
 * POST /api/mrp/requirements/:id/convert-to-greige
 */
export const convertToGreigeProcessing = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('Authentication required');
  }

  const { id } = req.params;
  const { processorId, greigeId, processingCost, greigeCost } = req.body;

  if (!processorId || !greigeId) {
    throw new ValidationError('processorId and greigeId are required');
  }

  const result = await mrpService.convertToGreigeProcessing(
    id,
    { processorId, greigeId, processingCost, greigeCost },
    userId
  );

  res.json({
    success: true,
    data: result,
    message: 'Requirement converted to GREIGE + PROCESSING workflow',
  });
};

/**
 * Preview POs with prices and GST before generation
 * POST /api/mrp/preview-pos
 */
export const previewPOs = async (req: Request, res: Response): Promise<void> => {
  const { groups } = req.body;

  if (!Array.isArray(groups) || groups.length === 0) {
    throw new ValidationError('groups must be a non-empty array');
  }

  const result = await mrpService.previewPOsFromRequirements({ groups });

  res.json({
    success: true,
    data: result,
  });
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
  groupBySupplier,
  bulkGeneratePO,
  validateBulkPO,
  getDistinctRequirementStyles,
  convertToGreigeProcessing,
  previewPOs,
};
