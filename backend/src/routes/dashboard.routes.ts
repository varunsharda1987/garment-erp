// Dashboard routes
import { Router } from 'express';
import {
  getDashboardSummary,
  getStylesByStage,
} from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get dashboard summary with counts per stage
 * @access  Protected - All authenticated users
 */
router.get('/summary', getDashboardSummary);

/**
 * @route   GET /api/dashboard/stage/:stage
 * @desc    Get styles in a specific production stage (for drill-down)
 * @access  Protected - All authenticated users
 */
router.get('/stage/:stage', getStylesByStage);

export default router;
