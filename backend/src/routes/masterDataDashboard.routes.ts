import { Router } from 'express';
import { getMasterDataSummary } from '../controllers/masterDataDashboard.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * Master Data Dashboard Routes
 * Provides unified access to all master data types
 */

// Get summary of all master data types
router.get('/summary', authenticateToken, getMasterDataSummary);

export default router;
