// Customer Management routes
import { Router } from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerAccessoryPresets,
  createAccessoryPreset,
  updateAccessoryPreset,
  deleteAccessoryPreset,
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

/**
 * @route   GET /api/customers/:id/accessory-presets
 * @desc    Get all accessory presets for a customer
 * @access  Protected - All authenticated users
 */
router.get('/:id/accessory-presets', getCustomerAccessoryPresets);

/**
 * @route   POST /api/customers/:id/accessory-presets
 * @desc    Create new accessory preset for a customer
 * @access  Protected - Admin, Sales, Merchandiser
 */
router.post('/:id/accessory-presets', authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER), createAccessoryPreset);

/**
 * @route   PUT /api/customers/:id/accessory-presets/:presetId
 * @desc    Update accessory preset
 * @access  Protected - Admin, Sales, Merchandiser
 */
router.put('/:id/accessory-presets/:presetId', authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER), updateAccessoryPreset);

/**
 * @route   DELETE /api/customers/:id/accessory-presets/:presetId
 * @desc    Delete (deactivate) accessory preset
 * @access  Protected - Admin only
 */
router.delete('/:id/accessory-presets/:presetId', authorize(UserRole.ADMIN), deleteAccessoryPreset);

export default router;
