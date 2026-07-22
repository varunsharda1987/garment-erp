import express from 'express';
import { patternPartController } from '../controllers/patternPart.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { addComponentPatternPartSchema, updateComponentPatternPartSchema } from '../schemas/patternPart.schema';

const router = express.Router({ mergeParams: true }); // mergeParams to access :componentId from parent router

// All routes require authentication
router.use(authenticateToken);

// Get pattern parts for a component
router.get('/', asyncHandler(patternPartController.getPatternPartsByComponent.bind(patternPartController)));

// Add pattern part to component
router.post(
  '/',
  validateBody(addComponentPatternPartSchema),
  asyncHandler(patternPartController.addPatternPartToComponent.bind(patternPartController))
);

// Update component-pattern part association
router.put(
  '/:patternPartId',
  validateBody(updateComponentPatternPartSchema),
  asyncHandler(patternPartController.updateComponentPatternPart.bind(patternPartController))
);

// Remove pattern part from component
router.delete(
  '/:patternPartId',
  asyncHandler(patternPartController.removePatternPartFromComponent.bind(patternPartController))
);

export default router;
