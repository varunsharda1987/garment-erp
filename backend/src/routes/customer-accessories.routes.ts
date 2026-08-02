import { Router } from 'express';
import {
  getCustomerAccessoryPresets,
  getCustomerAccessoryPresetById,
  getDefaultAccessoryPreset,
  createAccessoryPreset,
  updateAccessoryPreset,
  deleteAccessoryPreset,
  setDefaultPreset,
  cloneAccessoryPreset,
} from '../controllers/customer-accessories.controller';
import { authenticateToken as authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createAccessoryPresetSchema,
  updateAccessoryPresetSchema,
  cloneAccessoryPresetSchema,
  accessoryPresetQuerySchema,
} from '../schemas/customerAccessories.schema';
import { customerIdParamSchema, customerIdAndPresetIdParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/customers/:customerId/accessory-presets
 * @desc    Get all accessory presets for a customer
 * @access  All authenticated users
 * @query   isActive - Filter by active status (true/false)
 */
router.get(
  '/:customerId/accessory-presets',
  validateParams(customerIdParamSchema),
  validateQuery(accessoryPresetQuerySchema),
  asyncHandler(getCustomerAccessoryPresets)
);

/**
 * @route   GET /api/customers/:customerId/accessory-presets/default
 * @desc    Get the default accessory preset for a customer
 * @access  All authenticated users
 */
router.get(
  '/:customerId/accessory-presets/default',
  validateParams(customerIdParamSchema),
  asyncHandler(getDefaultAccessoryPreset)
);

/**
 * @route   GET /api/customers/:customerId/accessory-presets/:presetId
 * @desc    Get a specific accessory preset by ID
 * @access  All authenticated users
 */
router.get(
  '/:customerId/accessory-presets/:presetId',
  validateParams(customerIdAndPresetIdParamSchema),
  asyncHandler(getCustomerAccessoryPresetById)
);

/**
 * @route   POST /api/customers/:customerId/accessory-presets
 * @desc    Create a new accessory preset
 * @access  ADMIN, SALES, MERCHANDISER
 * @body    { presetName, description?, accessoryItems: [...], isDefault? }
 */
router.post(
  '/:customerId/accessory-presets',
  validateParams(customerIdParamSchema),
  authorize('ADMIN', 'SALES', 'MERCHANDISER'),
  validateBody(createAccessoryPresetSchema),
  asyncHandler(createAccessoryPreset)
);

/**
 * @route   PUT /api/customers/:customerId/accessory-presets/:presetId
 * @desc    Update an accessory preset
 * @access  ADMIN, SALES, MERCHANDISER
 */
router.put(
  '/:customerId/accessory-presets/:presetId',
  validateParams(customerIdAndPresetIdParamSchema),
  authorize('ADMIN', 'SALES', 'MERCHANDISER'),
  validateBody(updateAccessoryPresetSchema),
  asyncHandler(updateAccessoryPreset)
);

/**
 * @route   DELETE /api/customers/:customerId/accessory-presets/:presetId
 * @desc    Delete an accessory preset
 * @access  ADMIN
 */
router.delete(
  '/:customerId/accessory-presets/:presetId',
  validateParams(customerIdAndPresetIdParamSchema),
  authorize('ADMIN'),
  asyncHandler(deleteAccessoryPreset)
);

/**
 * @route   POST /api/customers/:customerId/accessory-presets/:presetId/set-default
 * @desc    Set a preset as the default for a customer
 * @access  ADMIN, SALES, MERCHANDISER
 */
router.post(
  '/:customerId/accessory-presets/:presetId/set-default',
  validateParams(customerIdAndPresetIdParamSchema),
  authorize('ADMIN', 'SALES', 'MERCHANDISER'),
  asyncHandler(setDefaultPreset)
);

/**
 * @route   POST /api/customers/:customerId/accessory-presets/:presetId/clone
 * @desc    Clone a preset to create a new one
 * @access  ADMIN, SALES, MERCHANDISER
 * @body    { newPresetName: string }
 */
router.post(
  '/:customerId/accessory-presets/:presetId/clone',
  validateParams(customerIdAndPresetIdParamSchema),
  authorize('ADMIN', 'SALES', 'MERCHANDISER'),
  validateBody(cloneAccessoryPresetSchema),
  asyncHandler(cloneAccessoryPreset)
);

export default router;
