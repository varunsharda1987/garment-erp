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
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { createCostCenterSchema, updateCostCenterSchema, costCenterQuerySchema } from '../schemas/costCenters.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new cost center
router.post('/', validateBody(createCostCenterSchema), asyncHandler(createCostCenter));

// Get all cost centers with pagination and filters
router.get('/', validateQuery(costCenterQuerySchema), asyncHandler(getAllCostCenters));

// Get cost center by ID
router.get('/:id', asyncHandler(getCostCenterById));

// Update cost center
router.put('/:id', validateBody(updateCostCenterSchema), asyncHandler(updateCostCenter));

// Delete cost center (soft delete)
router.delete('/:id', asyncHandler(deleteCostCenter));

export default router;
