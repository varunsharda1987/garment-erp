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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new component master
router.post('/', createComponentMaster);

// Get all component masters with pagination and filters
router.get('/', getAllComponentMasters);

// Get all categories
router.get('/categories', getCategories);

// Get component master by ID
router.get('/:id', getComponentMasterById);

// Update component master
router.put('/:id', updateComponentMaster);

// Delete component master (soft delete)
router.delete('/:id', deleteComponentMaster);

export default router;
