import express from 'express';
import { componentGroupController } from '../controllers/componentGroup.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { idParamSchema } from '../schemas/common.schema';
import {
  createComponentGroupSchema,
  updateComponentGroupSchema,
  reorderComponentGroupsSchema,
  componentGroupQuerySchema,
  componentGroupCodeParamSchema,
} from '../schemas/componentGroup.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new component group
router.post(
  '/',
  validateBody(createComponentGroupSchema),
  asyncHandler(componentGroupController.createComponentGroup.bind(componentGroupController))
);

// Reorder component groups (must be before /:id routes to avoid conflict)
router.post(
  '/reorder',
  validateBody(reorderComponentGroupsSchema),
  asyncHandler(componentGroupController.reorderComponentGroups.bind(componentGroupController))
);

// Get all component groups with pagination
router.get(
  '/',
  validateQuery(componentGroupQuerySchema),
  asyncHandler(componentGroupController.getComponentGroups.bind(componentGroupController))
);

// Get component group by code
router.get(
  '/code/:code',
  validateParams(componentGroupCodeParamSchema),
  asyncHandler(componentGroupController.getComponentGroupByCode.bind(componentGroupController))
);

// Get components in a specific group
router.get(
  '/:id/components',
  validateParams(idParamSchema),
  asyncHandler(componentGroupController.getComponentsByGroup.bind(componentGroupController))
);

// Get component group by ID
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(componentGroupController.getComponentGroupById.bind(componentGroupController))
);

// Update component group
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateComponentGroupSchema),
  asyncHandler(componentGroupController.updateComponentGroup.bind(componentGroupController))
);

// Delete component group (soft delete)
router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(componentGroupController.deleteComponentGroup.bind(componentGroupController))
);

export default router;
