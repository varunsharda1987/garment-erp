// Export Routes
import { Router } from 'express';
import * as exportController from '../controllers/export.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams } from '../middleware/validation.middleware';
import { moduleParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/export/:module
 * @desc    Export data from a module
 * @access  Private
 * @body    { format: 'csv' | 'excel' | 'pdf', templateId?: string, filters?: object }
 */
router.post('/:module', validateParams(moduleParamSchema), asyncHandler(exportController.exportData));

export default router;
