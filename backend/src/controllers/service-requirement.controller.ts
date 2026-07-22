/**
 * Service Requirement Controller
 * HTTP endpoints for work order service requirement management
 */

import { Request, Response } from 'express';
import {
  calculateRequirementsFromWorkOrder,
  suggestProcessorForService,
  suggestProcessorsForRequirements,
  bulkAssignProcessors,
  autoAssignProcessors,
  groupRequirementsByProcessor,
  generateServicePO,
  bulkGenerateServicePOs,
  getServiceRequirements,
  getAllServiceRequirements,
  getServiceRequirementsSummary,
  getOrderServiceRequirementsSummary,
  getDashboardStats,
  updateServiceExecution,
} from '../services/work-order-service-requirement.service';
import { ServiceType, ServiceRequirementStatus, RequirementSource } from '@prisma/client';
import { ValidationError } from '../errors';
// Validation happens at the route layer via validateBody(schema) — see
// backend/src/routes/service-requirement.routes.ts. The single source of truth
// for these body schemas is backend/src/schemas/serviceRequirement.schema.ts.
// Do NOT re-add controller-local schemas or .parse(req.body) calls here.
import type {
  CalculateServicesInput,
  SuggestProcessorInput,
  SuggestProcessorsBulkInput,
  BulkAssignProcessorsInput,
  AutoAssignProcessorsInput,
  GroupByProcessorInput,
  GeneratePOInput,
  BulkGeneratePOsInput,
  UpdateExecutionInput,
} from '../schemas/serviceRequirement.schema';

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Calculate service requirements for a work order
 * POST /api/work-orders/:workOrderId/calculate-services
 */
export const calculateServices = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;
  const { userId } = req.body as CalculateServicesInput;

  if (!workOrderId) {
    throw new ValidationError('Work order ID is required');
  }

  const result = await calculateRequirementsFromWorkOrder({
    workOrderId,
    userId,
  });

  res.json({
    success: true,
    data: result,
    message: `${result.requirements.length} service requirement(s) calculated`,
  });
  // end calculateServices
};

/**
 * Get service requirements for a work order
 * GET /api/work-orders/:workOrderId/service-requirements
 */
export const getServiceRequirementsForWorkOrder = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;
  const { status, serviceType } = req.query;

  if (!workOrderId) {
    throw new ValidationError('Work order ID is required');
  }

  const filters: any = {};
  if (status) {
    filters.status = status as ServiceRequirementStatus;
  }
  if (serviceType) {
    filters.serviceType = serviceType as ServiceType;
  }

  const result = await getServiceRequirements(workOrderId, filters);

  res.json({
    success: true,
    data: result,
  });
  // end getServiceRequirementsForWorkOrder
};

/**
 * Get service requirements summary for a work order
 * GET /api/work-orders/:workOrderId/service-requirements/summary
 */
export const getServiceRequirementsSummaryController = async (req: Request, res: Response) => {
  const { workOrderId } = req.params;

  if (!workOrderId) {
    throw new ValidationError('Work order ID is required');
  }

  const summary = await getServiceRequirementsSummary(workOrderId);

  res.json({
    success: true,
    data: summary,
  });
  // end getServiceRequirementsSummaryController
};

/**
 * Suggest processor for a service type
 * POST /api/service-requirements/suggest-processor
 */
export const suggestProcessor = async (req: Request, res: Response) => {
  const { serviceType, styleId } = req.body as SuggestProcessorInput;

  const suggestion = await suggestProcessorForService(serviceType, styleId);

  res.json({
    success: true,
    data: suggestion,
  });
  // end suggestProcessor
};

/**
 * Suggest processors for multiple service requirements
 * POST /api/service-requirements/suggest-processors-bulk
 */
export const suggestProcessorsBulk = async (req: Request, res: Response) => {
  const { requirementIds } = req.body as SuggestProcessorsBulkInput;

  const suggestions = await suggestProcessorsForRequirements(requirementIds);

  // Summary statistics
  const stats = {
    total: suggestions.length,
    highConfidence: suggestions.filter((s) => s.confidence === 'high').length,
    mediumConfidence: suggestions.filter((s) => s.confidence === 'medium').length,
    lowConfidence: suggestions.filter((s) => s.confidence === 'low').length,
    withSuggestion: suggestions.filter((s) => s.suggestedProcessorId !== null).length,
    needsManual: suggestions.filter((s) => s.suggestedProcessorId === null).length,
  };

  res.json({
    success: true,
    data: {
      suggestions,
      stats,
    },
  });
  // end suggestProcessorsBulk
};

/**
 * Bulk assign processors to service requirements
 * POST /api/service-requirements/bulk-assign-processors
 */
export const bulkAssign = async (req: Request, res: Response) => {
  const { assignments } = req.body as BulkAssignProcessorsInput;

  const updatedCount = await bulkAssignProcessors(assignments);

  res.json({
    success: true,
    data: {
      updatedCount,
      requested: assignments.length,
    },
    message: `${updatedCount} service requirement(s) assigned to processors`,
  });
  // end bulkAssign
};

/**
 * Auto-assign processors based on suggestions
 * POST /api/service-requirements/auto-assign-processors
 */
export const autoAssign = async (req: Request, res: Response) => {
  const { requirementIds, minConfidence } = req.body as AutoAssignProcessorsInput;

  // minConfidence may be undefined — autoAssignProcessors defaults it to 'medium'
  const result = await autoAssignProcessors(requirementIds, minConfidence);

  res.json({
    success: true,
    data: result,
    message: `${result.assigned} service requirement(s) auto-assigned (${result.skipped} skipped due to low confidence)`,
  });
  // end autoAssign
};

/**
 * Group service requirements by processor
 * POST /api/service-requirements/group-by-processor
 */
export const groupByProcessor = async (req: Request, res: Response) => {
  const { requirementIds } = req.body as GroupByProcessorInput;

  const result = await groupRequirementsByProcessor(requirementIds);

  // Convert Map to object for JSON serialization
  const groupsObject: Record<string, any> = {};
  result.groups.forEach((requirements, processorId) => {
    groupsObject[processorId] = requirements;
  });

  res.json({
    success: true,
    data: {
      groups: groupsObject,
      unassigned: result.unassigned,
      summary: result.summary,
    },
  });
  // end groupByProcessor
};

/**
 * Generate a service purchase order
 * POST /api/service-requirements/generate-po
 */
export const generatePO = async (req: Request, res: Response) => {
  // expectedDeliveryDate arrives as a Date (z.coerce.date in generatePOSchema)
  const { processorId, requirementIds, expectedDeliveryDate, remarks } = req.body as GeneratePOInput;

  // Get user ID from request (should be added by auth middleware)
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User ID not found in request');
  }

  const result = await generateServicePO({
    processorId,
    requirementIds,
    expectedDeliveryDate,
    remarks,
    userId,
  });

  res.json({
    success: true,
    data: result,
    message: `Service PO ${result.purchaseOrder.poNumber} created with ${result.linkedRequirements} requirement(s)`,
  });
  // end generatePO
};

/**
 * Bulk generate service purchase orders
 * POST /api/service-requirements/generate-pos-bulk
 */
export const bulkGeneratePOs = async (req: Request, res: Response) => {
  const { groups } = req.body as BulkGeneratePOsInput;

  // Get user ID from request (should be added by auth middleware)
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User ID not found in request');
  }

  const result = await bulkGenerateServicePOs(groups, userId);

  res.json({
    success: true,
    data: result,
    message: `${result.totalPOs} service PO(s) generated${
      result.errors.length > 0 ? ` (${result.errors.length} error(s))` : ''
    }`,
  });
  // end bulkGeneratePOs
};

/**
 * Update service execution details
 * PATCH /api/service-requirements/:id/execution
 */
export const updateExecution = async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = req.body as UpdateExecutionInput;

  if (!id) {
    throw new ValidationError('Service requirement ID is required');
  }

  const result = await updateServiceExecution(id, validatedData);

  res.json({
    success: true,
    data: result,
    message: 'Service execution updated',
  });
  // end updateExecution
};

/**
 * GET /api/orders/:orderId/service-requirements/summary
 * Get service requirements summary for an order (across all work orders)
 */
export const getOrderServiceSummary = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  if (!orderId) {
    throw new ValidationError('Order ID is required');
  }

  const summary = await getOrderServiceRequirementsSummary(orderId);

  res.json({
    success: true,
    data: summary,
  });
  // end getOrderServiceSummary
};

// ============================================
// LIST ALL SERVICE REQUIREMENTS
// ============================================

/**
 * GET /api/service-requirements/list
 * List all service requirements across all work orders with pagination
 */
export const listAll = async (req: Request, res: Response) => {
  const filters = {
    orderId: req.query.orderId as string | undefined,
    workOrderId: req.query.workOrderId as string | undefined,
    status: undefined as ServiceRequirementStatus | ServiceRequirementStatus[] | undefined,
    serviceType: undefined as ServiceType | ServiceType[] | undefined,
    processorId: req.query.processorId as string | undefined,
    source: req.query.source as RequirementSource | undefined,
    search: req.query.search as string | undefined,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: (req.query.sortBy as string) || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
  };

  // Handle status (single or comma-separated)
  if (req.query.status) {
    const statusStr = req.query.status as string;
    if (statusStr.includes(',')) {
      filters.status = statusStr.split(',') as ServiceRequirementStatus[];
    } else {
      filters.status = statusStr as ServiceRequirementStatus;
    }
  }

  // Handle serviceType (single or comma-separated)
  if (req.query.serviceType) {
    const typeStr = req.query.serviceType as string;
    if (typeStr.includes(',')) {
      filters.serviceType = typeStr.split(',') as ServiceType[];
    } else {
      filters.serviceType = typeStr as ServiceType;
    }
  }

  const { data, total } = await getAllServiceRequirements(filters);

  res.json({
    success: true,
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  });
  // end listAll
};

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * GET /api/service-requirements/dashboard
 * Get dashboard statistics for service requirements
 */
export const dashboardStats = async (_req: Request, res: Response) => {
  const stats = await getDashboardStats();

  res.json({
    success: true,
    data: stats,
  });
  // end dashboardStats
};
