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

const router = express.Router();

// Get all size category presets for a customer
router.get('/customers/:customerId/size-category-presets', getAllPresetsForCustomer);

// Get default size category preset for a customer
router.get('/customers/:customerId/size-category-presets/default', getDefaultPreset);

// Get a specific size category preset
router.get('/customers/:customerId/size-category-presets/:presetId', getPresetById);

// Create a new size category preset
router.post('/customers/:customerId/size-category-presets', createPreset);

// Update a size category preset
router.put('/customers/:customerId/size-category-presets/:presetId', updatePreset);

// Delete a size category preset
router.delete('/customers/:customerId/size-category-presets/:presetId', deletePreset);

// Set a preset as default
router.post('/customers/:customerId/size-category-presets/:presetId/set-default', setAsDefault);

// Clone a size category preset
router.post('/customers/:customerId/size-category-presets/:presetId/clone', clonePreset);

export default router;
