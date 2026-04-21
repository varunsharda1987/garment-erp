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

const router = express.Router();

// Apply path-specific authentication (this router is mounted at '/')
router.use('/customers', authenticateToken);

// Get all size category presets for a customer
router.get('/customers/:customerId/size-category-presets', asyncHandler(getAllPresetsForCustomer));

// Get default size category preset for a customer
router.get('/customers/:customerId/size-category-presets/default', asyncHandler(getDefaultPreset));

// Get a specific size category preset
router.get('/customers/:customerId/size-category-presets/:presetId', asyncHandler(getPresetById));

// Create a new size category preset
router.post('/customers/:customerId/size-category-presets', asyncHandler(createPreset));

// Update a size category preset
router.put('/customers/:customerId/size-category-presets/:presetId', asyncHandler(updatePreset));

// Delete a size category preset
router.delete('/customers/:customerId/size-category-presets/:presetId', asyncHandler(deletePreset));

// Set a preset as default
router.post('/customers/:customerId/size-category-presets/:presetId/set-default', asyncHandler(setAsDefault));

// Clone a size category preset
router.post('/customers/:customerId/size-category-presets/:presetId/clone', asyncHandler(clonePreset));

export default router;
