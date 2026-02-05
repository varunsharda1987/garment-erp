/**
 * Lace Defect Routes
 *
 * API routes for lace defect tracking and claims:
 * - Log defects
 * - Submit and manage claims
 * - Record replacements
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  logDefect,
  submitClaimController,
  updateClaimStatusController,
  recordReplacementController,
  getDefectByIdController,
  getDefectsController,
  getPendingClaimsController,
  getDefectStatisticsController,
} from '../controllers/laceDefect.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================================================
// REPORTS & DASHBOARD
// ============================================================================

/**
 * @route   GET /api/lace-defects/claims/pending
 * @desc    Get pending claims dashboard
 * @access  Private
 */
router.get('/claims/pending', getPendingClaimsController);

/**
 * @route   GET /api/lace-defects/statistics
 * @desc    Get defect statistics
 * @access  Private
 */
router.get('/statistics', getDefectStatisticsController);

// ============================================================================
// QUERIES
// ============================================================================

/**
 * @route   GET /api/lace-defects
 * @desc    Get defects with filters and pagination
 * @access  Private
 * @query   stockId, laceId, orderId, styleId, defectType, claimStatus, discoveredAt, search, page, limit
 */
router.get('/', getDefectsController);

/**
 * @route   GET /api/lace-defects/:id
 * @desc    Get defect by ID
 * @access  Private
 */
router.get('/:id', getDefectByIdController);

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * @route   POST /api/lace-defects
 * @desc    Log a new defect
 * @access  Private
 * @body    stockId, laceId, defectType, defectQuantity, discoveredAt,
 *          orderId?, styleId?, defectDescription?, photos?
 */
router.post('/', logDefect);

/**
 * @route   POST /api/lace-defects/:id/claim/submit
 * @desc    Submit a claim for a defect
 * @access  Private
 * @body    claimReference, claimAmount, notes?
 */
router.post('/:id/claim/submit', submitClaimController);

/**
 * @route   PUT /api/lace-defects/:id/claim/status
 * @desc    Update claim status (APPROVED, REJECTED, RESOLVED)
 * @access  Private
 * @body    status, resolution?
 */
router.put('/:id/claim/status', updateClaimStatusController);

/**
 * @route   POST /api/lace-defects/:id/replacement
 * @desc    Record replacement material
 * @access  Private
 * @body    replacementStockId, replacementQuantity
 */
router.post('/:id/replacement', recordReplacementController);

export default router;
