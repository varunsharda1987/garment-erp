// Customer Management routes
import { Router } from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  canDeactivateCustomer,
  getCustomerAccessoryPresets,
  createAccessoryPreset,
  updateAccessoryPreset,
  deleteAccessoryPreset,
} from '../controllers/customer.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  customerIdParamSchema,
} from '../schemas/customer.schema';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/customers
 * @desc    Create new customer
 * @access  Protected - Admin, Sales
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER),
  validateBody(createCustomerSchema),
  asyncHandler(createCustomer)
);

/**
 * @route   GET /api/customers
 * @desc    Get all customers (paginated, searchable, filterable)
 * @access  Protected - All authenticated users
 */
router.get('/', validateQuery(customerQuerySchema), asyncHandler(getAllCustomers));

/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', validateParams(customerIdParamSchema), asyncHandler(getCustomerById));

/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Protected - Admin, Sales
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER),
  validateParams(customerIdParamSchema),
  validateBody(updateCustomerSchema),
  asyncHandler(updateCustomer)
);

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete (deactivate) customer
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(customerIdParamSchema), asyncHandler(deleteCustomer));

/**
 * @route   GET /api/customers/:id/can-deactivate
 * @desc    Check if customer can be deactivated
 * @access  Protected - Admin, Sales, Merchandiser
 */
router.get(
  '/:id/can-deactivate',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER),
  validateParams(customerIdParamSchema),
  asyncHandler(canDeactivateCustomer)
);

/**
 * @route   GET /api/customers/:id/accessory-presets
 * @desc    Get all accessory presets for a customer
 * @access  Protected - All authenticated users
 */
router.get('/:id/accessory-presets', validateParams(customerIdParamSchema), asyncHandler(getCustomerAccessoryPresets));

/**
 * @route   POST /api/customers/:id/accessory-presets
 * @desc    Create new accessory preset for a customer
 * @access  Protected - Admin, Sales, Merchandiser
 */
router.post(
  '/:id/accessory-presets',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER),
  validateParams(customerIdParamSchema),
  asyncHandler(createAccessoryPreset)
);

/**
 * @route   PUT /api/customers/:id/accessory-presets/:presetId
 * @desc    Update accessory preset
 * @access  Protected - Admin, Sales, Merchandiser
 */
router.put(
  '/:id/accessory-presets/:presetId',
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER),
  validateParams(customerIdParamSchema),
  asyncHandler(updateAccessoryPreset)
);

/**
 * @route   DELETE /api/customers/:id/accessory-presets/:presetId
 * @desc    Delete (deactivate) accessory preset
 * @access  Protected - Admin only
 */
router.delete(
  '/:id/accessory-presets/:presetId',
  authorize(UserRole.ADMIN),
  validateParams(customerIdParamSchema),
  asyncHandler(deleteAccessoryPreset)
);

export default router;
