// Export Routes
import { Router } from 'express';
import * as exportController from '../controllers/export.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams, validateBody } from '../middleware/validation.middleware';
import { moduleParamSchema } from '../schemas/common.schema';
import { exportBodySchema } from '../schemas/export.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/export/:module
 * @desc    Export data from a module
 * @access  Private
 * @body    { format: 'csv' | 'excel' | 'pdf', templateId?: string, filters?: object }
 * @note    validateBody(exportBodySchema) constrains filters to scalar values
 *          only and blocks an isActive override; the controller further
 *          allowlists filter fields per module.
 */
router.post(
  '/:module',
  validateParams(moduleParamSchema),
  validateBody(exportBodySchema),
  asyncHandler(exportController.exportData)
);

export default router;
