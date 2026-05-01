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
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createTaxMasterSchema, updateTaxMasterSchema, taxMasterQuerySchema } from '../schemas/taxMasters.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new tax
router.post('/', validateBody(createTaxMasterSchema), asyncHandler(createTax));

// Get all taxes with pagination and filters
router.get('/', validateQuery(taxMasterQuerySchema), asyncHandler(getAllTaxes));

// Get applicable taxes for a specific date
router.get('/applicable', asyncHandler(getApplicableTaxes));

// Get tax by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getTaxById));

// Update tax
router.put('/:id', validateParams(idParamSchema), validateBody(updateTaxMasterSchema), asyncHandler(updateTax));

// Delete tax (soft delete)
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteTax));

export default router;
