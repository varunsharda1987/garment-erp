import express from 'express';
import { componentGroupController } from '../controllers/componentGroup.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new component group
router.post('/', asyncHandler(componentGroupController.createComponentGroup.bind(componentGroupController)));

// Reorder component groups (must be before /:id routes to avoid conflict)
router.post('/reorder', asyncHandler(componentGroupController.reorderComponentGroups.bind(componentGroupController)));

// Get all component groups with pagination
router.get('/', asyncHandler(componentGroupController.getComponentGroups.bind(componentGroupController)));

// Get component group by code
router.get('/code/:code', asyncHandler(componentGroupController.getComponentGroupByCode.bind(componentGroupController)));

// Get components in a specific group
router.get('/:id/components', asyncHandler(componentGroupController.getComponentsByGroup.bind(componentGroupController)));

// Get component group by ID
router.get('/:id', asyncHandler(componentGroupController.getComponentGroupById.bind(componentGroupController)));

// Update component group
router.put('/:id', asyncHandler(componentGroupController.updateComponentGroup.bind(componentGroupController)));

// Delete component group (soft delete)
router.delete('/:id', asyncHandler(componentGroupController.deleteComponentGroup.bind(componentGroupController)));

export default router;
