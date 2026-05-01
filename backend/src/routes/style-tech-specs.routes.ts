/**
 * Style Tech Specs Routes
 * API routes for style technical specifications
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  getTechSpecs,
  saveTechSpecs,
  deleteTechSpecs,
  getOptions,
  getTechPackData,
} from '../controllers/style-tech-specs.controller';
import { saveTechSpecsSchema } from '../schemas/styleTechSpecs.schema';
import { styleIdParamSchema } from '../schemas/common.schema';

const router = Router();

// Options endpoint (static route must come before parameterized routes)
router.get('/tech-specs/options', authenticateToken, asyncHandler(getOptions));

// Style-specific tech specs routes
router.get('/:styleId/tech-specs', authenticateToken, validateParams(styleIdParamSchema), asyncHandler(getTechSpecs));
router.put(
  '/:styleId/tech-specs',
  authenticateToken,
  validateParams(styleIdParamSchema),
  validateBody(saveTechSpecsSchema),
  asyncHandler(saveTechSpecs)
);
router.delete(
  '/:styleId/tech-specs',
  authenticateToken,
  validateParams(styleIdParamSchema),
  asyncHandler(deleteTechSpecs)
);
router.get(
  '/:styleId/tech-pack-data',
  authenticateToken,
  validateParams(styleIdParamSchema),
  asyncHandler(getTechPackData)
);

export default router;
