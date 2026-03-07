/**
 * MRP (Material Requirement Planning) Routes
 * API endpoints for material requirements management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import mrpController from '../controllers/mrp.controller';
import * as vendorSuggestionController from '../controllers/vendor-suggestion.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// CALCULATION & DASHBOARD
// ============================================

/**
 * @route   POST /api/mrp/calculate
 * @desc    Calculate material requirements from an order's BOM
 * @access  Private
 * @body    { orderId: string, orderItemId?: string, requiredDate: string, checkStock?: boolean }
 */
router.post('/calculate', mrpController.calculateRequirements);

/**
 * @route   GET /api/mrp/dashboard
 * @desc    Get MRP dashboard statistics
 * @access  Private
 */
router.get('/dashboard', mrpController.getDashboardStats);

// ============================================
// REQUIREMENTS CRUD
// ============================================

/**
 * @route   GET /api/mrp/requirements
 * @desc    Get all material requirements with filters
 * @access  Private
 * @query   orderId, orderItemId, materialId, supplierId, status, source,
 *          requiredDateFrom, requiredDateTo, hasShortfall, search, page, limit, sortBy, sortOrder
 */
router.get('/requirements', mrpController.getRequirements);

/**
 * @route   POST /api/mrp/requirements
 * @desc    Create a manual material requirement (not from BOM)
 * @access  Private
 * @body    { materialId: string, quantity: number, unit: string, requiredDate: string, preferredSupplierId?: string }
 */
router.post('/requirements', mrpController.createManualRequirement);

/**
 * @route   GET /api/mrp/requirements/:id
 * @desc    Get a single requirement by ID
 * @access  Private
 */
router.get('/requirements/:id', mrpController.getRequirementById);

/**
 * @route   DELETE /api/mrp/requirements/:id
 * @desc    Cancel a requirement
 * @access  Private
 */
router.delete('/requirements/:id', mrpController.cancelRequirement);

// ============================================
// REQUIREMENT ACTIONS
// ============================================

/**
 * @route   POST /api/mrp/requirements/:id/allocate-stock
 * @desc    Allocate stock to a requirement
 * @access  Private
 * @body    { quantity: number, warehouseId?: string }
 */
router.post('/requirements/:id/allocate-stock', mrpController.allocateStock);

/**
 * @route   POST /api/mrp/requirements/:id/link-po
 * @desc    Link a requirement to an existing PO item
 * @access  Private
 * @body    { purchaseOrderId: string, purchaseOrderItemId: string, allocatedQuantity: number }
 */
router.post('/requirements/:id/link-po', mrpController.linkToPO);

/**
 * @route   PATCH /api/mrp/requirements/:id/status
 * @desc    Update requirement status
 * @access  Private
 * @body    { status: MaterialRequirementStatus }
 */
router.patch('/requirements/:id/status', mrpController.updateStatus);

// ============================================
// PO GENERATION
// ============================================

/**
 * @route   POST /api/mrp/generate-po
 * @desc    Generate Purchase Order from requirements
 * @access  Private
 * @body    { requirementIds: string[], supplierId: string, expectedDeliveryDate: string, remarks?: string, consolidate?: boolean }
 */
router.post('/generate-po', mrpController.generatePO);

/**
 * @route   POST /api/mrp/group-by-supplier
 * @desc    Group requirements by preferred supplier for bulk PO generation
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post('/group-by-supplier', mrpController.groupBySupplier);

/**
 * @route   POST /api/mrp/generate-pos-bulk
 * @desc    Generate multiple POs from grouped requirements (bulk operation)
 * @access  Private
 * @body    { groups: [{ supplierId: string, requirementIds: string[], expectedDeliveryDate: string, remarks?: string }] }
 */
router.post('/generate-pos-bulk', mrpController.bulkGeneratePO);

/**
 * @route   POST /api/mrp/validate-bulk-po
 * @desc    Validate requirements for bulk PO generation
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post('/validate-bulk-po', mrpController.validateBulkPO);

// ============================================
// ORDER-LEVEL ENDPOINTS
// ============================================

/**
 * @route   GET /api/mrp/orders/:orderId/summary
 * @desc    Get requirements summary for an order
 * @access  Private
 */
router.get('/orders/:orderId/summary', mrpController.getOrderRequirementsSummary);

// ============================================
// VENDOR SUGGESTIONS
// ============================================

/**
 * @route   POST /api/mrp/vendor-suggestions/material
 * @desc    Get vendor suggestion for a single material
 * @access  Private
 * @body    { materialId: string }
 */
router.post('/vendor-suggestions/material', vendorSuggestionController.suggestForMaterial);

/**
 * @route   POST /api/mrp/vendor-suggestions/requirements
 * @desc    Get vendor suggestions for multiple requirements
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post('/vendor-suggestions/requirements', vendorSuggestionController.suggestForRequirements);

/**
 * @route   POST /api/mrp/vendor-suggestions/bulk-assign
 * @desc    Bulk assign vendors to requirements
 * @access  Private
 * @body    { assignments: [{ requirementId: string, supplierId: string }] }
 */
router.post('/vendor-suggestions/bulk-assign', vendorSuggestionController.bulkAssign);

/**
 * @route   POST /api/mrp/vendor-suggestions/auto-assign
 * @desc    Auto-assign vendors based on suggestions (high/medium confidence)
 * @access  Private
 * @body    { requirementIds: string[], minConfidence?: 'high' | 'medium' }
 */
router.post('/vendor-suggestions/auto-assign', vendorSuggestionController.autoAssign);

/**
 * @route   GET /api/mrp/vendor-suggestions/suppliers-by-type
 * @desc    Get suppliers filtered by material type
 * @access  Private
 * @query   materialType (e.g., GREIGE, BUTTON, THREAD)
 */
router.get('/vendor-suggestions/suppliers-by-type', vendorSuggestionController.getSuppliersByType);

// ============================================
// PROCESSING REQUIREMENT PROCESSOR ASSIGNMENT
// ============================================

/**
 * @route   POST /api/mrp/processing-assignment/suggest
 * @desc    Get processor suggestions for PROCESSING material requirements
 * @access  Private
 * @body    { requirementIds: string[] }
 */
router.post('/processing-assignment/suggest', vendorSuggestionController.suggestProcessorsForProcessing);

/**
 * @route   POST /api/mrp/processing-assignment/bulk-assign
 * @desc    Bulk assign processors to PROCESSING requirements
 * @access  Private
 * @body    { assignments: [{ requirementId: string, processorId: string }] }
 */
router.post('/processing-assignment/bulk-assign', vendorSuggestionController.bulkAssignProcessorsForProcessing);

/**
 * @route   POST /api/mrp/processing-assignment/auto-assign
 * @desc    Auto-assign processors to PROCESSING requirements
 * @access  Private
 * @body    { requirementIds: string[], minConfidence?: 'high' | 'medium' }
 */
router.post('/processing-assignment/auto-assign', vendorSuggestionController.autoAssignProcessorsForProcessing);

/**
 * @route   GET /api/mrp/processing-assignment/processors
 * @desc    Get list of processor suppliers (DYEING_PRINTING, WASHING, etc.)
 * @access  Private
 */
router.get('/processing-assignment/processors', vendorSuggestionController.getProcessorList);

export default router;
