/**
 * Lace Costing Routes
 *
 * API routes for lace cost calculation with sourcing strategies:
 * - STOCK_REUSE: Use existing lace stock
 * - READY_LACE: Purchase ready/finished lace
 * - GREIGE_PROCESSED: Purchase greige lace and dye it
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  calculateSingleLaceCost,
  calculateBatchLaceCosts,
  validateLaceCostingForPO,
} from '../controllers/laceCosting.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/lace-costing/calculate
 * @desc    Calculate lace cost with all sourcing options
 * @access  Private
 * @body    laceId, quantityPerGarment, orderQuantity?, wastagePercent?, styleId?, costSheetId?
 */
router.post('/calculate', asyncHandler(calculateSingleLaceCost));

/**
 * @route   POST /api/lace-costing/batch-calculate
 * @desc    Calculate costs for multiple lace items
 * @access  Private
 * @body    laceItems[], orderQuantity?, styleId?, costSheetId?
 */
router.post('/batch-calculate', asyncHandler(calculateBatchLaceCosts));

/**
 * @route   POST /api/lace-costing/validate-po
 * @desc    Validate if lace costing item is ready for PO generation
 * @access  Private
 * @body    costingItemId
 *
 * Returns:
 * - valid: boolean - Whether PO can be generated
 * - labDipApproved: boolean - Lab dip approval status
 * - labDipId: string | null - Lab dip ID if exists
 * - message: string - Descriptive message
 */
router.post('/validate-po', asyncHandler(validateLaceCostingForPO));

export default router;
