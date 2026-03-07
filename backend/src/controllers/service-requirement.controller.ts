/**
 * Service Requirement Controller
 * HTTP endpoints for work order service requirement management
 */

import { Request, Response } from 'express';
import { z } from 'zod';
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
import { logError } from '../utils/logger';
import { ValidationError, NotFoundError, BusinessError } from '../errors';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const CalculateServicesSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

const SuggestProcessorSchema = z.object({
  serviceType: z.nativeEnum(ServiceType, { message: 'Invalid service type' }),
  styleId: z.string().uuid('Invalid style ID').optional(),
});

const SuggestProcessorsForRequirementsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
});

const BulkAssignProcessorsSchema = z.object({
  assignments: z
    .array(
      z.object({
        requirementId: z.string().uuid('Invalid requirement ID'),
        processorId: z.string().uuid('Invalid processor ID'),
      })
    )
    .min(1, 'At least one assignment is required'),
});

const AutoAssignProcessorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  minConfidence: z.enum(['high', 'medium']).optional().default('medium'),
});

const GroupByProcessorSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
});

const GenerateServicePOSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  expectedDeliveryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  remarks: z.string().optional(),
});

const BulkGenerateServicePOsSchema = z.object({
  groups: z
    .array(
      z.object({
        processorId: z.string().uuid('Invalid processor ID'),
        requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
        expectedDeliveryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: 'Invalid date format',
        }),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one processor group is required'),
});

const UpdateServiceExecutionSchema = z.object({
  jobWorkOrderId: z.string().uuid().optional(),
  embroiderySendOutId: z.string().uuid().optional(),
  processingBatchId: z.string().uuid().optional(),
  actualQuantity: z.number().positive().optional(),
  actualCost: z.number().positive().optional(),
  status: z.nativeEnum(ServiceRequirementStatus, { message: 'Invalid status' }),
});

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * Calculate service requirements for a work order
 * POST /api/work-orders/:workOrderId/calculate-services
 */
export const calculateServices = async (req: Request, res: Response) => {
  try {
    const { workOrderId } = req.params;
    const validatedData = CalculateServicesSchema.parse(req.body);

    if (!workOrderId) {
      throw new ValidationError('Work order ID is required');
    }

    const result = await calculateRequirementsFromWorkOrder({
      workOrderId,
      userId: validatedData.userId,
    });

    res.json({
      success: true,
      data: result,
      message: `${result.requirements.length} service requirement(s) calculated`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to calculate service requirements');
  }
};

/**
 * Get service requirements for a work order
 * GET /api/work-orders/:workOrderId/service-requirements
 */
export const getServiceRequirementsForWorkOrder = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    handleError(res, error, 'Failed to get service requirements');
  }
};

/**
 * Get service requirements summary for a work order
 * GET /api/work-orders/:workOrderId/service-requirements/summary
 */
export const getServiceRequirementsSummaryController = async (req: Request, res: Response) => {
  try {
    const { workOrderId } = req.params;

    if (!workOrderId) {
      throw new ValidationError('Work order ID is required');
    }

    const summary = await getServiceRequirementsSummary(workOrderId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get service requirements summary');
  }
};

/**
 * Suggest processor for a service type
 * POST /api/service-requirements/suggest-processor
 */
export const suggestProcessor = async (req: Request, res: Response) => {
  try {
    const validatedData = SuggestProcessorSchema.parse(req.body);

    const suggestion = await suggestProcessorForService(
      validatedData.serviceType,
      validatedData.styleId
    );

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    handleError(res, error, 'Failed to suggest processor');
  }
};

/**
 * Suggest processors for multiple service requirements
 * POST /api/service-requirements/suggest-processors-bulk
 */
export const suggestProcessorsBulk = async (req: Request, res: Response) => {
  try {
    const validatedData = SuggestProcessorsForRequirementsSchema.parse(req.body);

    const suggestions = await suggestProcessorsForRequirements(validatedData.requirementIds);

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
  } catch (error) {
    handleError(res, error, 'Failed to suggest processors for requirements');
  }
};

/**
 * Bulk assign processors to service requirements
 * POST /api/service-requirements/bulk-assign-processors
 */
export const bulkAssign = async (req: Request, res: Response) => {
  try {
    const validatedData = BulkAssignProcessorsSchema.parse(req.body);

    const updatedCount = await bulkAssignProcessors(validatedData.assignments);

    res.json({
      success: true,
      data: {
        updatedCount,
        requested: validatedData.assignments.length,
      },
      message: `${updatedCount} service requirement(s) assigned to processors`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to bulk assign processors');
  }
};

/**
 * Auto-assign processors based on suggestions
 * POST /api/service-requirements/auto-assign-processors
 */
export const autoAssign = async (req: Request, res: Response) => {
  try {
    const validatedData = AutoAssignProcessorsSchema.parse(req.body);

    const result = await autoAssignProcessors(
      validatedData.requirementIds,
      validatedData.minConfidence
    );

    res.json({
      success: true,
      data: result,
      message: `${result.assigned} service requirement(s) auto-assigned (${result.skipped} skipped due to low confidence)`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to auto-assign processors');
  }
};

/**
 * Group service requirements by processor
 * POST /api/service-requirements/group-by-processor
 */
export const groupByProcessor = async (req: Request, res: Response) => {
  try {
    const validatedData = GroupByProcessorSchema.parse(req.body);

    const result = await groupRequirementsByProcessor(validatedData.requirementIds);

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
  } catch (error) {
    handleError(res, error, 'Failed to group requirements by processor');
  }
};

/**
 * Generate a service purchase order
 * POST /api/service-requirements/generate-po
 */
export const generatePO = async (req: Request, res: Response) => {
  try {
    const validatedData = GenerateServicePOSchema.parse(req.body);

    // Get user ID from request (should be added by auth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    const result = await generateServicePO({
      processorId: validatedData.processorId,
      requirementIds: validatedData.requirementIds,
      expectedDeliveryDate: new Date(validatedData.expectedDeliveryDate),
      remarks: validatedData.remarks,
      userId,
    });

    res.json({
      success: true,
      data: result,
      message: `Service PO ${result.purchaseOrder.poNumber} created with ${result.linkedRequirements} requirement(s)`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to generate service PO');
  }
};

/**
 * Bulk generate service purchase orders
 * POST /api/service-requirements/generate-pos-bulk
 */
export const bulkGeneratePOs = async (req: Request, res: Response) => {
  try {
    const validatedData = BulkGenerateServicePOsSchema.parse(req.body);

    // Get user ID from request (should be added by auth middleware)
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new ValidationError('User ID not found in request');
    }

    const result = await bulkGenerateServicePOs(validatedData.groups, userId);

    res.json({
      success: true,
      data: result,
      message: `${result.totalPOs} service PO(s) generated${
        result.errors.length > 0 ? ` (${result.errors.length} error(s))` : ''
      }`,
    });
  } catch (error) {
    handleError(res, error, 'Failed to bulk generate service POs');
  }
};

/**
 * Update service execution details
 * PATCH /api/service-requirements/:id/execution
 */
export const updateExecution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = UpdateServiceExecutionSchema.parse(req.body);

    if (!id) {
      throw new ValidationError('Service requirement ID is required');
    }

    const result = await updateServiceExecution(id, validatedData);

    res.json({
      success: true,
      data: result,
      message: 'Service execution updated',
    });
  } catch (error) {
    handleError(res, error, 'Failed to update service execution');
  }
};

/**
 * GET /api/orders/:orderId/service-requirements/summary
 * Get service requirements summary for an order (across all work orders)
 */
export const getOrderServiceSummary = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new ValidationError('Order ID is required');
    }

    const summary = await getOrderServiceRequirementsSummary(orderId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get order service summary');
  }
};

// ============================================
// LIST ALL SERVICE REQUIREMENTS
// ============================================

/**
 * GET /api/service-requirements/list
 * List all service requirements across all work orders with pagination
 */
export const listAll = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    handleError(res, error, 'Failed to list service requirements');
  }
};

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * GET /api/service-requirements/dashboard
 * Get dashboard statistics for service requirements
 */
export const dashboardStats = async (_req: Request, res: Response) => {
  try {
    const stats = await getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get service requirement dashboard stats');
  }
};

// ============================================
// ERROR HANDLER
// ============================================

function handleError(res: Response, error: unknown, defaultMessage: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.issues.map((e: z.ZodIssue) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      error: error.message,
    });
  }

  if (error instanceof BusinessError) {
    return res.status(422).json({
      success: false,
      error: error.message,
    });
  }

  logError(`${defaultMessage}:`, error);
  return res.status(500).json({
    success: false,
    error: defaultMessage,
  });
}
