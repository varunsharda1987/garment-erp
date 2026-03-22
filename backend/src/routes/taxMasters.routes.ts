// Tax Masters Routes
import express from 'express';
import {
  createTax,
  getAllTaxes,
  getApplicableTaxes,
  getTaxById,
  updateTax,
  deleteTax,
} from '../controllers/taxMasters.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new tax
router.post('/', asyncHandler(createTax));

// Get all taxes with pagination and filters
router.get('/', asyncHandler(getAllTaxes));

// Get applicable taxes for a specific date
router.get('/applicable', asyncHandler(getApplicableTaxes));

// Get tax by ID
router.get('/:id', asyncHandler(getTaxById));

// Update tax
router.put('/:id', asyncHandler(updateTax));

// Delete tax (soft delete)
router.delete('/:id', asyncHandler(deleteTax));

export default router;
