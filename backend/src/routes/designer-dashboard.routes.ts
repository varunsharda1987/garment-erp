/**
 * Designer Dashboard Routes
 * API routes for design team dashboard
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getDashboard,
  getActivity,
  getMyStyles,
  getStylesBySeason,
  getStylesByCustomer,
} from '../controllers/designer-dashboard.controller';

const router = Router();

// Dashboard routes
router.get('/dashboard', authenticateToken, getDashboard);
router.get('/activity', authenticateToken, getActivity);
router.get('/my-styles', authenticateToken, getMyStyles);
router.get('/styles-by-season', authenticateToken, getStylesBySeason);
router.get('/styles-by-customer', authenticateToken, getStylesByCustomer);

export default router;
