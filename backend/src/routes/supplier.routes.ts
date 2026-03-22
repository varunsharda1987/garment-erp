// Supplier Management Routes
import { Router } from 'express';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  canDeactivateSupplier,
} from '../controllers/supplier.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
  supplierIdParamSchema,
} from '../schemas/supplier.schema';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/suppliers
 * @desc    Create new supplier
 * @access  Private (Authenticated users)
 */
router.post('/', validateBody(createSupplierSchema), asyncHandler(createSupplier));

/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', validateQuery(supplierQuerySchema), asyncHandler(getAllSuppliers));

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get supplier by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', validateParams(supplierIdParamSchema), asyncHandler(getSupplierById));

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update supplier
 * @access  Private (Authenticated users)
 */
router.put(
  '/:id',
  validateParams(supplierIdParamSchema),
  validateBody(updateSupplierSchema),
  asyncHandler(updateSupplier)
);

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete supplier (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', validateParams(supplierIdParamSchema), asyncHandler(deleteSupplier));

/**
 * @route   GET /api/suppliers/:id/can-deactivate
 * @desc    Check if supplier can be deactivated
 * @access  Private (Authenticated users)
 */
router.get('/:id/can-deactivate', validateParams(supplierIdParamSchema), asyncHandler(canDeactivateSupplier));

export default router;
