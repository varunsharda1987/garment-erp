/**
 * Service Requirement Routes
 * API endpoints for work order service requirement management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import * as serviceRequirementController from '../controllers/service-requirement.controller';
import {
  calculateServicesSchema,
  serviceRequirementQuerySchema,
  listServiceRequirementsSchema,
  suggestProcessorSchema,
  suggestProcessorsBulkSchema,
  bulkAssignProcessorsSchema,
  autoAssignProcessorsSchema,
  groupByProcessorSchema,
  generatePOSchema,
  bulkGeneratePOsSchema,
  updateExecutionSchema,
} from '../schemas/serviceRequirement.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// WORK ORDER SERVICE CALCULATION
// ============================================

/**
 * @route   POST /api/work-orders/:workOrderId/calculate-services
 * @desc    Calculate service requirements from work order's style processes
 * @access  Private
 * @body    { userId: string }
 */
router.post(
  '/work-orders/:workOrderId/calculate-services',
  validateBody(calculateServicesSchema),
  asyncHandler(serviceRequirementController.calculateServices)
);

/**
 * @route   GET /api/work-orders/:workOrderId/service-requirements
 * @desc    Get service requirements for a work order
 * @access  Private
 * @query   status, serviceType
 */
router.get(
  '/work-orders/:workOrderId/service-requirements',
  validateQuery(serviceRequirementQuerySchema),
  asyncHandler(serviceRequirementController.getServiceRequirementsForWorkOrder)
);

/**
 * @route   GET /api/work-orders/:workOrderId/service-requirements/summary
 * @desc    Get service requirements summary for a work order
 * @access  Private
 */
router.get(
  '/work-orders/:workOrderId/service-requirements/summary',
  asyncHandler(serviceRequirementController.getServiceRequirementsSummaryController)
);

/**
 * @route   GET /api/orders/:orderId/service-requirements/summary
 * @desc    Get service requirements summary for an order (across all work orders)
 * @access  Private
 */
router.get(
  '/orders/:orderId/service-requirements/summary',
  asyncHandler(serviceRequirementController.getOrderServiceSummary)
);

// ============================================
// LIST & DASHBOARD (must be before :id routes)
// ============================================

/**
 * @route   GET /api/service-requirements/list
 * @desc    List all service requirements across all work orders with pagination
 * @access  Private
 * @query   workOrderId, status, serviceType, processorId, source, search, page, limit, sortBy, sortOrder
 */
router.get(
  '/service-requirements/list',
  validateQuery(listServiceRequirementsSchema),
  asyncHandler(serviceRequirementController.listAll)
);

/**
 * @route   GET /api/service-requirements/dashboard
 * @desc    Get dashboard statistics for service requirements
 * @access  Private
 */
router.get('/service-requirements/dashboard', asyncHandler(serviceRequirementController.dashboardStats));

// ============================================
// PROCESSOR SUGGESTIONS
// ============================================

/**
 * @route   POST /api/service-requirements/suggest-processor
 * @desc    Suggest processor for a service type
 * @access  Private
 * @body    { serviceType: ServiceType, styleId?: string }
 */
router.post(
  '/service-requirements/suggest-processor',
  validateBody(suggestProcessorSchema),
  asyncHandler(serviceRequirementController.suggestProcessor)
);

/**
 * @route   POST /api/service-requirements/suggest-processors-bulk
 * @desc    Suggest processors for multiple service requirements
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post(
  '/service-requirements/suggest-processors-bulk',
  validateBody(suggestProcessorsBulkSchema),
  asyncHandler(serviceRequirementController.suggestProcessorsBulk)
);

// ============================================
// PROCESSOR ASSIGNMENT
// ============================================

/**
 * @route   POST /api/service-requirements/bulk-assign-processors
 * @desc    Bulk assign processors to service requirements
 * @access  Private
 * @body    { assignments: Array<{ requirementId: string, processorId: string }> }
 */
router.post(
  '/service-requirements/bulk-assign-processors',
  validateBody(bulkAssignProcessorsSchema),
  asyncHandler(serviceRequirementController.bulkAssign)
);

/**
 * @route   POST /api/service-requirements/auto-assign-processors
 * @desc    Auto-assign processors based on suggestions
 * @access  Private
 * @body    { requirementIds: string[], minConfidence?: 'high' | 'medium' }
 */
router.post(
  '/service-requirements/auto-assign-processors',
  validateBody(autoAssignProcessorsSchema),
  asyncHandler(serviceRequirementController.autoAssign)
);

// ============================================
// GROUPING AND BULK PO GENERATION
// ============================================

/**
 * @route   POST /api/service-requirements/group-by-processor
 * @desc    Group service requirements by processor for bulk PO generation
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post(
  '/service-requirements/group-by-processor',
  validateBody(groupByProcessorSchema),
  asyncHandler(serviceRequirementController.groupByProcessor)
);

/**
 * @route   POST /api/service-requirements/generate-po
 * @desc    Generate a service purchase order
 * @access  Private
 * @body    { processorId: string, requirementIds: string[], expectedDeliveryDate: string, remarks?: string }
 */
router.post(
  '/service-requirements/generate-po',
  validateBody(generatePOSchema),
  asyncHandler(serviceRequirementController.generatePO)
);

/**
 * @route   POST /api/service-requirements/generate-pos-bulk
 * @desc    Bulk generate service purchase orders
 * @access  Private
 * @body    { groups: Array<{ processorId: string, requirementIds: string[], expectedDeliveryDate: string, remarks?: string }> }
 */
router.post(
  '/service-requirements/generate-pos-bulk',
  validateBody(bulkGeneratePOsSchema),
  asyncHandler(serviceRequirementController.bulkGeneratePOs)
);

// ============================================
// SERVICE EXECUTION
// ============================================

/**
 * @route   PATCH /api/service-requirements/:id/execution
 * @desc    Update service execution details
 * @access  Private
 * @body    { jobWorkOrderId?: string, embroiderySendOutId?: string, processingBatchId?: string, actualQuantity?: number, actualCost?: number, status: ServiceRequirementStatus }
 */
router.patch(
  '/service-requirements/:id/execution',
  validateBody(updateExecutionSchema),
  asyncHandler(serviceRequirementController.updateExecution)
);

export default router;
