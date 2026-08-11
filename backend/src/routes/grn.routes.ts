/**
 * GRN (Goods Receiving Notes) Routes
 * RESTful API routes for goods receiving management
 */

import { Router } from 'express';
import {
  getAllGRNs,
  getGRNById,
  getGRNsByPO,
  getPendingItemsForPO,
  getReceivingSummaryByPO,
  getProcessingContext,
  createGRN,
  createGRNFromJWO,
  approveGRN,
  rejectGRN,
  reverseGRN, // BUG-GRN6 fix
} from '../controllers/grn.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import {
  createGRNSchema,
  createJwoGRNSchema,
  approveGRNSchema,
  rejectGRNSchema,
  reverseGRNSchema,
  grnQuerySchema,
} from '../schemas/grn.schema';
import { idParamSchema, poIdParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// List & Query Routes
// ============================================

/**
 * @route   GET /api/grn
 * @desc    Get all GRNs with filters and pagination
 * @access  Private
 */
router.get('/', validateQuery(grnQuerySchema), asyncHandler(getAllGRNs));

/**
 * @route   GET /api/grn/po/:poId
 * @desc    Get all GRNs for a specific PO
 * @access  Private
 */
router.get('/po/:poId', validateParams(poIdParamSchema), asyncHandler(getGRNsByPO));

/**
 * @route   GET /api/grn/po/:poId/processing-context
 * @desc    Get processing context for a PROCESSING PO (for GRN form)
 * @access  Private
 */
router.get('/po/:poId/processing-context', validateParams(poIdParamSchema), asyncHandler(getProcessingContext));

/**
 * @route   GET /api/grn/po/:poId/pending
 * @desc    Get pending items for a PO (for GRN creation)
 * @access  Private
 */
router.get('/po/:poId/pending', validateParams(poIdParamSchema), asyncHandler(getPendingItemsForPO));

/**
 * @route   GET /api/grn/po/:poId/summary
 * @desc    Get receiving summary by warehouse for a PO
 * @access  Private
 */
router.get('/po/:poId/summary', validateParams(poIdParamSchema), asyncHandler(getReceivingSummaryByPO));

/**
 * @route   GET /api/grn/:id
 * @desc    Get GRN by ID with all relations
 * @access  Private
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getGRNById));

// ============================================
// CRUD Routes
// ============================================

/**
 * @route   POST /api/grn
 * @desc    Create a new GRN
 * @access  Private (INVENTORY, PURCHASE, ADMIN)
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE),
  validateBody(createGRNSchema),
  asyncHandler(createGRN)
);

/**
 * @route   POST /api/grn/jwo
 * @desc    Phase 4b: Create a GRN against a Job Work Order (no purchase order)
 * @access  Private (INVENTORY, PURCHASE, ADMIN)
 */
router.post(
  '/jwo',
  authorize(UserRole.ADMIN, UserRole.INVENTORY, UserRole.PURCHASE),
  validateBody(createJwoGRNSchema),
  asyncHandler(createGRNFromJWO)
);

// ============================================
// Status Transition Routes
// ============================================

/**
 * @route   PATCH /api/grn/:id/approve
 * @desc    Approve a GRN (PENDING_QC -> ACCEPTED)
 * @access  Private (QUALITY, INVENTORY, ADMIN)
 */
router.patch(
  '/:id/approve',
  authorize(UserRole.ADMIN, UserRole.QUALITY, UserRole.INVENTORY),
  validateParams(idParamSchema),
  validateBody(approveGRNSchema),
  asyncHandler(approveGRN)
);

/**
 * @route   PATCH /api/grn/:id/reject
 * @desc    Reject a GRN (PENDING_QC -> REJECTED)
 * @access  Private (QUALITY, INVENTORY, ADMIN)
 */
router.patch(
  '/:id/reject',
  authorize(UserRole.ADMIN, UserRole.QUALITY, UserRole.INVENTORY),
  validateParams(idParamSchema),
  validateBody(rejectGRNSchema),
  asyncHandler(rejectGRN)
);

// BUG-GRN6 fix: Comprehensive GRN reversal endpoint
/**
 * @route   PATCH /api/grn/:id/reverse
 * @desc    Reverse an accepted GRN (ACCEPTED -> REVERSED) - fully reverses all stock and transactions
 * @access  Private (ADMIN only)
 */
router.patch(
  '/:id/reverse',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  validateBody(reverseGRNSchema),
  asyncHandler(reverseGRN)
);

export default router;
