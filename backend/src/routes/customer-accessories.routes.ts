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

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/customers/:customerId/accessory-presets
 * @desc    Get all accessory presets for a customer
 * @access  All authenticated users
 * @query   isActive - Filter by active status (true/false)
 */
router.get('/:customerId/accessory-presets', asyncHandler(getCustomerAccessoryPresets));

/**
 * @route   GET /api/customers/:customerId/accessory-presets/default
 * @desc    Get the default accessory preset for a customer
 * @access  All authenticated users
 */
router.get('/:customerId/accessory-presets/default', asyncHandler(getDefaultAccessoryPreset));

/**
 * @route   GET /api/customers/:customerId/accessory-presets/:presetId
 * @desc    Get a specific accessory preset by ID
 * @access  All authenticated users
 */
router.get('/:customerId/accessory-presets/:presetId', asyncHandler(getCustomerAccessoryPresetById));

/**
 * @route   POST /api/customers/:customerId/accessory-presets
 * @desc    Create a new accessory preset
 * @access  ADMIN, MERCHANDISER
 * @body    { presetName, description?, accessoryItems: [...], isDefault? }
 */
router.post('/:customerId/accessory-presets', authorize('ADMIN', 'MERCHANDISER'), asyncHandler(createAccessoryPreset));

/**
 * @route   PUT /api/customers/:customerId/accessory-presets/:presetId
 * @desc    Update an accessory preset
 * @access  ADMIN, MERCHANDISER
 */
router.put(
  '/:customerId/accessory-presets/:presetId',
  authorize('ADMIN', 'MERCHANDISER'),
  asyncHandler(updateAccessoryPreset)
);

/**
 * @route   DELETE /api/customers/:customerId/accessory-presets/:presetId
 * @desc    Delete an accessory preset
 * @access  ADMIN
 */
router.delete('/:customerId/accessory-presets/:presetId', authorize('ADMIN'), asyncHandler(deleteAccessoryPreset));

/**
 * @route   POST /api/customers/:customerId/accessory-presets/:presetId/set-default
 * @desc    Set a preset as the default for a customer
 * @access  ADMIN, MERCHANDISER
 */
router.post(
  '/:customerId/accessory-presets/:presetId/set-default',
  authorize('ADMIN', 'MERCHANDISER'),
  asyncHandler(setDefaultPreset)
);

/**
 * @route   POST /api/customers/:customerId/accessory-presets/:presetId/clone
 * @desc    Clone a preset to create a new one
 * @access  ADMIN, MERCHANDISER
 * @body    { newPresetName: string }
 */
router.post(
  '/:customerId/accessory-presets/:presetId/clone',
  authorize('ADMIN', 'MERCHANDISER'),
  asyncHandler(cloneAccessoryPreset)
);

export default router;
