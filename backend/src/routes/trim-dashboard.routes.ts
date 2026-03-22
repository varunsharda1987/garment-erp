import { Router } from 'express';
import {
  getSummary,
  searchAllTrims,
  getRecentTrims
} from '../controllers/trim-dashboard.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/trims/summary
 * @desc    Get summary counts for all trim types
 * @access  Private
 */
router.get('/summary', asyncHandler(getSummary));

/**
 * @route   GET /api/trims/search
 * @desc    Search across all trim types with unified results
 * @access  Private
 * @query   page, limit, search, type (BUTTON|ZIPPER|LACE|THREAD|ELASTIC|LABEL)
 */
router.get('/search', asyncHandler(searchAllTrims));

/**
 * @route   GET /api/trims/recent
 * @desc    Get recent trims across all types
 * @access  Private
 * @query   limit (default: 10, max: 50)
 */
router.get('/recent', asyncHandler(getRecentTrims));

export default router;
