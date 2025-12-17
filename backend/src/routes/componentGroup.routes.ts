import express from 'express';
import { componentGroupController } from '../controllers/componentGroup.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new component group
router.post('/', componentGroupController.createComponentGroup.bind(componentGroupController));

// Reorder component groups (must be before /:id routes to avoid conflict)
router.post('/reorder', componentGroupController.reorderComponentGroups.bind(componentGroupController));

// Get all component groups with pagination
router.get('/', componentGroupController.getComponentGroups.bind(componentGroupController));

// Get component group by code
router.get('/code/:code', componentGroupController.getComponentGroupByCode.bind(componentGroupController));

// Get components in a specific group
router.get('/:id/components', componentGroupController.getComponentsByGroup.bind(componentGroupController));

// Get component group by ID
router.get('/:id', componentGroupController.getComponentGroupById.bind(componentGroupController));

// Update component group
router.put('/:id', componentGroupController.updateComponentGroup.bind(componentGroupController));

// Delete component group (soft delete)
router.delete('/:id', componentGroupController.deleteComponentGroup.bind(componentGroupController));

export default router;
