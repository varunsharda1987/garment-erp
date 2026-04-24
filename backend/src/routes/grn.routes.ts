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
  approveGRN,
  rejectGRN,
} from '../controllers/grn.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createGRNSchema, approveGRNSchema, rejectGRNSchema } from '../schemas/grn.schema';

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
router.get('/', asyncHandler(getAllGRNs));

/**
 * @route   GET /api/grn/po/:poId
 * @desc    Get all GRNs for a specific PO
 * @access  Private
 */
router.get('/po/:poId', asyncHandler(getGRNsByPO));

/**
 * @route   GET /api/grn/po/:poId/processing-context
 * @desc    Get processing context for a PROCESSING PO (for GRN form)
 * @access  Private
 */
router.get('/po/:poId/processing-context', asyncHandler(getProcessingContext));

/**
 * @route   GET /api/grn/po/:poId/pending
 * @desc    Get pending items for a PO (for GRN creation)
 * @access  Private
 */
router.get('/po/:poId/pending', asyncHandler(getPendingItemsForPO));

/**
 * @route   GET /api/grn/po/:poId/summary
 * @desc    Get receiving summary by warehouse for a PO
 * @access  Private
 */
router.get('/po/:poId/summary', asyncHandler(getReceivingSummaryByPO));

/**
 * @route   GET /api/grn/:id
 * @desc    Get GRN by ID with all relations
 * @access  Private
 */
router.get('/:id', asyncHandler(getGRNById));

// ============================================
// CRUD Routes
// ============================================

/**
 * @route   POST /api/grn
 * @desc    Create a new GRN
 * @access  Private (WAREHOUSE, PURCHASE, ADMIN)
 */
router.post('/', validateBody(createGRNSchema), asyncHandler(createGRN));

// ============================================
// Status Transition Routes
// ============================================

/**
 * @route   PATCH /api/grn/:id/approve
 * @desc    Approve a GRN (PENDING_QC -> ACCEPTED)
 * @access  Private (QC, ADMIN)
 */
router.patch('/:id/approve', validateBody(approveGRNSchema), asyncHandler(approveGRN));

/**
 * @route   PATCH /api/grn/:id/reject
 * @desc    Reject a GRN (PENDING_QC -> REJECTED)
 * @access  Private (QC, ADMIN)
 */
router.patch('/:id/reject', validateBody(rejectGRNSchema), asyncHandler(rejectGRN));

export default router;
