/**
 * Lace Issue Note Routes
 *
 * API routes for lace issue notes management:
 * - Issue lace to production
 * - Record consumption
 * - Return to stock
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  createIssueNote,
  recordConsumptionController,
  returnToStockController,
  closeIssueNoteController,
  getIssueNoteByIdController,
  getIssueNotesController,
  getIssueNotesByOrderController,
} from '../controllers/laceIssueNote.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// QUERIES
// ============================================================================

/**
 * @route   GET /api/lace-issue-notes
 * @desc    Get issue notes with filters and pagination
 * @access  Private
 * @query   orderId, styleId, stockId, laceId, status, search, page, limit
 */
router.get('/', asyncHandler(getIssueNotesController));

/**
 * @route   GET /api/lace-issue-notes/order/:orderId
 * @desc    Get issue notes for a specific order
 * @access  Private
 */
router.get('/order/:orderId', asyncHandler(getIssueNotesByOrderController));

/**
 * @route   GET /api/lace-issue-notes/:id
 * @desc    Get issue note by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(getIssueNoteByIdController));

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * @route   POST /api/lace-issue-notes
 * @desc    Create a new issue note (issue lace to production)
 * @access  Private
 * @body    orderId, styleId, stockId, laceId, issuedQuantity, cuttingBatchId?, notes?
 */
router.post('/', asyncHandler(createIssueNote));

/**
 * @route   POST /api/lace-issue-notes/:id/consume
 * @desc    Record lace consumption during production
 * @access  Private
 * @body    consumedQuantity, notes?
 */
router.post('/:id/consume', asyncHandler(recordConsumptionController));

/**
 * @route   POST /api/lace-issue-notes/:id/return
 * @desc    Return unused lace to stock
 * @access  Private
 * @body    returnQuantity, notes?
 */
router.post('/:id/return', asyncHandler(returnToStockController));

/**
 * @route   POST /api/lace-issue-notes/:id/close
 * @desc    Close an issue note (finalize - all material accounted for)
 * @access  Private
 */
router.post('/:id/close', asyncHandler(closeIssueNoteController));

export default router;
