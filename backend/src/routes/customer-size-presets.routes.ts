import express from 'express';
import {
  getAllPresetsForCustomer,
  getDefaultPreset,
  getPresetById,
  createPreset,
  updatePreset,
  deletePreset,
  setAsDefault,
  clonePreset,
} from '../controllers/customer-size-presets.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { customerIdParamSchema, customerIdAndPresetIdParamSchema } from '../schemas/common.schema';
import {
  createCustomerSizePresetSchema,
  updateCustomerSizePresetSchema,
  cloneCustomerSizePresetSchema,
} from '../schemas/customerSizePresets.schema';

const router = express.Router();

// Apply path-specific authentication (this router is mounted at '/')
router.use('/customers', authenticateToken);

// Get all size category presets for a customer
router.get(
  '/customers/:customerId/size-category-presets',
  validateParams(customerIdParamSchema),
  asyncHandler(getAllPresetsForCustomer)
);

// Get default size category preset for a customer
router.get(
  '/customers/:customerId/size-category-presets/default',
  validateParams(customerIdParamSchema),
  asyncHandler(getDefaultPreset)
);

// Get a specific size category preset
router.get(
  '/customers/:customerId/size-category-presets/:presetId',
  validateParams(customerIdAndPresetIdParamSchema),
  asyncHandler(getPresetById)
);

// Create a new size category preset
router.post(
  '/customers/:customerId/size-category-presets',
  validateParams(customerIdParamSchema),
  validateBody(createCustomerSizePresetSchema),
  asyncHandler(createPreset)
);

// Update a size category preset
router.put(
  '/customers/:customerId/size-category-presets/:presetId',
  validateParams(customerIdAndPresetIdParamSchema),
  validateBody(updateCustomerSizePresetSchema),
  asyncHandler(updatePreset)
);

// Delete a size category preset
router.delete(
  '/customers/:customerId/size-category-presets/:presetId',
  validateParams(customerIdAndPresetIdParamSchema),
  asyncHandler(deletePreset)
);

// Set a preset as default
// no-body: controller reads only :customerId/:presetId
router.post(
  '/customers/:customerId/size-category-presets/:presetId/set-default',
  validateParams(customerIdAndPresetIdParamSchema),
  asyncHandler(setAsDefault)
);

// Clone a size category preset
router.post(
  '/customers/:customerId/size-category-presets/:presetId/clone',
  validateParams(customerIdAndPresetIdParamSchema),
  validateBody(cloneCustomerSizePresetSchema),
  asyncHandler(clonePreset)
);

export default router;
