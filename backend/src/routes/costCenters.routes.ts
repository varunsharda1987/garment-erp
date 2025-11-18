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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new cost center
router.post('/', createCostCenter);

// Get all cost centers with pagination and filters
router.get('/', getAllCostCenters);

// Get cost center by ID
router.get('/:id', getCostCenterById);

// Update cost center
router.put('/:id', updateCostCenter);

// Delete cost center (soft delete)
router.delete('/:id', deleteCostCenter);

export default router;
