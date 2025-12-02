/**
 * MRP (Material Requirement Planning) Routes
 * API endpoints for material requirements management
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import mrpController from '../controllers/mrp.controller';

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

// ============================================
// ORDER-LEVEL ENDPOINTS
// ============================================

/**
 * @route   GET /api/mrp/orders/:orderId/summary
 * @desc    Get requirements summary for an order
 * @access  Private
 */
router.get('/orders/:orderId/summary', mrpController.getOrderRequirementsSummary);

export default router;
