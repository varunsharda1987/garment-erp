// Supplier Management Routes
import { Router } from 'express';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createSupplierSchema, updateSupplierSchema, supplierQuerySchema, supplierIdParamSchema } from '../schemas/supplier.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/suppliers
 * @desc    Create new supplier
 * @access  Private (Authenticated users)
 */
router.post('/', validateBody(createSupplierSchema), createSupplier);

/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', validateQuery(supplierQuerySchema), getAllSuppliers);

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get supplier by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', validateParams(supplierIdParamSchema), getSupplierById);

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update supplier
 * @access  Private (Authenticated users)
 */
router.put('/:id', validateParams(supplierIdParamSchema), validateBody(updateSupplierSchema), updateSupplier);

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete supplier (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', validateParams(supplierIdParamSchema), deleteSupplier);

export default router;
