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

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/suppliers
 * @desc    Create new supplier
 * @access  Private (Authenticated users)
 */
router.post('/', createSupplier);

/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', getAllSuppliers);

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get supplier by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', getSupplierById);

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update supplier
 * @access  Private (Authenticated users)
 */
router.put('/:id', updateSupplier);

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete supplier (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', deleteSupplier);

export default router;
