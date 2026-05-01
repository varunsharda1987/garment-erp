import { Router } from 'express';
import {
  getAll,
  getById,
  createGenericTrim,
  update,
  remove,
  getConfigs,
  getCounts,
} from '../controllers/generic-trim.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createGenericTrimSchema,
  updateGenericTrimSchema,
  genericTrimQuerySchema,
  trimTypeParamSchema,
  genericTrimIdParamSchema,
} from '../schemas/genericTrim.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Generic Trim Routes
 *
 * Base path: /api/generic-trims
 *
 * Supported trim types:
 * - hook_eye
 * - snap_button
 * - buckle
 * - velcro
 * - drawstring
 * - ribbon
 * - sequin
 * - bead
 * - motif
 * - interlining
 * - padding
 */

// Get all trim type configurations
router.get('/configs', asyncHandler(getConfigs));

// Get counts for all trim types (dashboard)
router.get('/counts', asyncHandler(getCounts));

// CRUD operations for specific trim type
router.get(
  '/:trimType',
  validateParams(trimTypeParamSchema),
  validateQuery(genericTrimQuerySchema),
  asyncHandler(getAll)
);
router.get('/:trimType/:id', validateParams(genericTrimIdParamSchema), asyncHandler(getById));
router.post(
  '/:trimType',
  validateParams(trimTypeParamSchema),
  validateBody(createGenericTrimSchema),
  asyncHandler(createGenericTrim)
);
router.put(
  '/:trimType/:id',
  validateParams(genericTrimIdParamSchema),
  validateBody(updateGenericTrimSchema),
  asyncHandler(update)
);
router.delete('/:trimType/:id', validateParams(genericTrimIdParamSchema), asyncHandler(remove));

export default router;
