// Export Routes
import { Router } from 'express';
import * as exportController from '../controllers/export.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/export/:module
 * @desc    Export data from a module
 * @access  Private
 * @body    { format: 'csv' | 'excel' | 'pdf', templateId?: string, filters?: object }
 */
router.post('/:module', exportController.exportData);

export default router;
