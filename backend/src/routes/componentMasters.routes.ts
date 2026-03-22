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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new component master
router.post('/', asyncHandler(createComponentMaster));

// Get all component masters with pagination and filters
router.get('/', asyncHandler(getAllComponentMasters));

// Get all categories
router.get('/categories', asyncHandler(getCategories));

// Get component master by ID
router.get('/:id', asyncHandler(getComponentMasterById));

// Update component master
router.put('/:id', asyncHandler(updateComponentMaster));

// Delete component master (soft delete)
router.delete('/:id', asyncHandler(deleteComponentMaster));

export default router;
