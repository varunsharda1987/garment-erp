/**
 * Designer Dashboard Routes
 * API routes for design team dashboard
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  getDashboard,
  getActivity,
  getMyStyles,
  getStylesBySeason,
  getStylesByCustomer,
} from '../controllers/designer-dashboard.controller';

const router = Router();

// Dashboard routes
router.get('/dashboard', authenticateToken, asyncHandler(getDashboard));
router.get('/activity', authenticateToken, asyncHandler(getActivity));
router.get('/my-styles', authenticateToken, asyncHandler(getMyStyles));
router.get('/styles-by-season', authenticateToken, asyncHandler(getStylesBySeason));
router.get('/styles-by-customer', authenticateToken, asyncHandler(getStylesByCustomer));

export default router;
