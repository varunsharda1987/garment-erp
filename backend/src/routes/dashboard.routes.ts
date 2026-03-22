// Dashboard routes
import { Router } from 'express';
import {
  getDashboardSummary,
  getStylesByStage,
  getGeneralDashboardStats,
  getProductionDashboardStats,
  getAccountsDashboardStats,
  getSalesDashboardStats,
} from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get dashboard summary with counts per stage
 * @access  Protected - All authenticated users
 */
router.get('/summary', asyncHandler(getDashboardSummary));

/**
 * @route   GET /api/dashboard/stage/:stage
 * @desc    Get styles in a specific production stage (for drill-down)
 * @access  Protected - All authenticated users
 */
router.get('/stage/:stage', asyncHandler(getStylesByStage));

// Stats endpoints for individual dashboards
router.get('/general-stats', asyncHandler(getGeneralDashboardStats));
router.get('/production-stats', asyncHandler(getProductionDashboardStats));
router.get('/accounts-stats', asyncHandler(getAccountsDashboardStats));
router.get('/sales-stats', asyncHandler(getSalesDashboardStats));

export default router;
