// Cost Centers Routes
import express from 'express';
import {
  createCostCenter,
  getAllCostCenters,
  getCostCenterById,
  updateCostCenter,
  deleteCostCenter,
} from '../controllers/costCenters.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new cost center
router.post('/', asyncHandler(createCostCenter));

// Get all cost centers with pagination and filters
router.get('/', asyncHandler(getAllCostCenters));

// Get cost center by ID
router.get('/:id', asyncHandler(getCostCenterById));

// Update cost center
router.put('/:id', asyncHandler(updateCostCenter));

// Delete cost center (soft delete)
router.delete('/:id', asyncHandler(deleteCostCenter));

export default router;
