// Component Masters Routes
import express from 'express';
import {
  createComponentMaster,
  getAllComponentMasters,
  getComponentMasterById,
  updateComponentMaster,
  deleteComponentMaster,
  getCategories,
} from '../controllers/componentMasters.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createComponentMasterSchema,
  updateComponentMasterSchema,
  componentMasterQuerySchema,
  componentMasterIdParamSchema,
} from '../schemas/componentMasters.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new component master
router.post('/', validateBody(createComponentMasterSchema), asyncHandler(createComponentMaster));

// Get all component masters with pagination and filters
router.get('/', validateQuery(componentMasterQuerySchema), asyncHandler(getAllComponentMasters));

// Get all categories
router.get('/categories', asyncHandler(getCategories));

// Get component master by ID
router.get('/:id', validateParams(componentMasterIdParamSchema), asyncHandler(getComponentMasterById));

// Update component master
router.put(
  '/:id',
  validateParams(componentMasterIdParamSchema),
  validateBody(updateComponentMasterSchema),
  asyncHandler(updateComponentMaster)
);

// Delete component master (soft delete)
router.delete('/:id', validateParams(componentMasterIdParamSchema), asyncHandler(deleteComponentMaster));

export default router;
