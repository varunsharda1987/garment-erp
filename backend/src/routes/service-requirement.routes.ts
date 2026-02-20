/**
 * Service Requirement Routes
 * API endpoints for work order service requirement management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as serviceRequirementController from '../controllers/service-requirement.controller';

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
  serviceRequirementController.calculateServices
);

/**
 * @route   GET /api/work-orders/:workOrderId/service-requirements
 * @desc    Get service requirements for a work order
 * @access  Private
 * @query   status, serviceType
 */
router.get(
  '/work-orders/:workOrderId/service-requirements',
  serviceRequirementController.getServiceRequirementsForWorkOrder
);

/**
 * @route   GET /api/work-orders/:workOrderId/service-requirements/summary
 * @desc    Get service requirements summary for a work order
 * @access  Private
 */
router.get(
  '/work-orders/:workOrderId/service-requirements/summary',
  serviceRequirementController.getServiceRequirementsSummaryController
);

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
  serviceRequirementController.suggestProcessor
);

/**
 * @route   POST /api/service-requirements/suggest-processors-bulk
 * @desc    Suggest processors for multiple service requirements
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post(
  '/service-requirements/suggest-processors-bulk',
  serviceRequirementController.suggestProcessorsBulk
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
  serviceRequirementController.bulkAssign
);

/**
 * @route   POST /api/service-requirements/auto-assign-processors
 * @desc    Auto-assign processors based on suggestions
 * @access  Private
 * @body    { requirementIds: string[], minConfidence?: 'high' | 'medium' }
 */
router.post(
  '/service-requirements/auto-assign-processors',
  serviceRequirementController.autoAssign
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
  serviceRequirementController.groupByProcessor
);

/**
 * @route   POST /api/service-requirements/generate-po
 * @desc    Generate a service purchase order
 * @access  Private
 * @body    { processorId: string, requirementIds: string[], expectedDeliveryDate: string, remarks?: string }
 */
router.post('/service-requirements/generate-po', serviceRequirementController.generatePO);

/**
 * @route   POST /api/service-requirements/generate-pos-bulk
 * @desc    Bulk generate service purchase orders
 * @access  Private
 * @body    { groups: Array<{ processorId: string, requirementIds: string[], expectedDeliveryDate: string, remarks?: string }> }
 */
router.post('/service-requirements/generate-pos-bulk', serviceRequirementController.bulkGeneratePOs);

// ============================================
// SERVICE EXECUTION
// ============================================

/**
 * @route   PATCH /api/service-requirements/:id/execution
 * @desc    Update service execution details
 * @access  Private
 * @body    { jobWorkOrderId?: string, embroiderySendOutId?: string, processingBatchId?: string, actualQuantity?: number, actualCost?: number, status: ServiceRequirementStatus }
 */
router.patch('/service-requirements/:id/execution', serviceRequirementController.updateExecution);

export default router;
