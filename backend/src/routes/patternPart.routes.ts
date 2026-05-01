import express from 'express';
import { patternPartController } from '../controllers/patternPart.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createPatternPartSchema,
  updatePatternPartSchema,
  reorderPatternPartsSchema,
  patternPartQuerySchema,
  patternPartIdParamSchema,
  patternPartCodeParamSchema,
} from '../schemas/patternPart.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new pattern part
router.post(
  '/',
  validateBody(createPatternPartSchema),
  asyncHandler(patternPartController.createPatternPart.bind(patternPartController))
);

// Reorder pattern parts (must be before /:id routes to avoid conflict)
router.post(
  '/reorder',
  validateBody(reorderPatternPartsSchema),
  asyncHandler(patternPartController.reorderPatternParts.bind(patternPartController))
);

// Get all pattern parts with pagination
router.get(
  '/',
  validateQuery(patternPartQuerySchema),
  asyncHandler(patternPartController.getPatternParts.bind(patternPartController))
);

// Get pattern part by code
router.get(
  '/code/:code',
  validateParams(patternPartCodeParamSchema),
  asyncHandler(patternPartController.getPatternPartByCode.bind(patternPartController))
);

// Get pattern part by ID
router.get(
  '/:id',
  validateParams(patternPartIdParamSchema),
  asyncHandler(patternPartController.getPatternPartById.bind(patternPartController))
);

// Update pattern part
router.put(
  '/:id',
  validateParams(patternPartIdParamSchema),
  validateBody(updatePatternPartSchema),
  asyncHandler(patternPartController.updatePatternPart.bind(patternPartController))
);

// Delete pattern part (soft delete)
router.delete(
  '/:id',
  validateParams(patternPartIdParamSchema),
  asyncHandler(patternPartController.deletePatternPart.bind(patternPartController))
);

export default router;
