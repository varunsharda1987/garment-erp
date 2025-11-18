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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new tax
router.post('/', createTax);

// Get all taxes with pagination and filters
router.get('/', getAllTaxes);

// Get applicable taxes for a specific date
router.get('/applicable', getApplicableTaxes);

// Get tax by ID
router.get('/:id', getTaxById);

// Update tax
router.put('/:id', updateTax);

// Delete tax (soft delete)
router.delete('/:id', deleteTax);

export default router;
