// Customer Management routes
import { Router } from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/customers
 * @desc    Create new customer
 * @access  Protected - Admin, Sales
 */
router.post('/', authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER), createCustomer);

/**
 * @route   GET /api/customers
 * @desc    Get all customers (paginated, searchable, filterable)
 * @access  Protected - All authenticated users
 */
router.get('/', getAllCustomers);

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', getCustomerById);

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Protected - Admin, Sales
 */
router.put('/:id', authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER), updateCustomer);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete (deactivate) customer
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), deleteCustomer);

export default router;
