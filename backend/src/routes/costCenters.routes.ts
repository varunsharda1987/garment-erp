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
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createCostCenterSchema, updateCostCenterSchema, costCenterQuerySchema } from '../schemas/costCenters.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new cost center
router.post('/', validateBody(createCostCenterSchema), asyncHandler(createCostCenter));

// Get all cost centers with pagination and filters
router.get('/', validateQuery(costCenterQuerySchema), asyncHandler(getAllCostCenters));

// Get cost center by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getCostCenterById));

// Update cost center
router.put('/:id', validateParams(idParamSchema), validateBody(updateCostCenterSchema), asyncHandler(updateCostCenter));

// Delete cost center (soft delete)
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteCostCenter));

export default router;
