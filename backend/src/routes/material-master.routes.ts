import express from 'express';
import * as materialMasterController from '../controllers/material-master.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

/**
 * Unified Material Master Routes
 * Replaces 31 individual material routes (lace, button, thread, etc.)
 *
 * Base path: /api/materials
 */

// Get all materials with filters
// Query params: type (MaterialType), active (boolean), search (string), supplierId (string)
router.get('/', asyncHandler(materialMasterController.getAllMaterials));

// Get material types enum
router.get('/types', asyncHandler(materialMasterController.getMaterialTypes));

// Get material count by type
router.get('/types/:type/count', asyncHandler(materialMasterController.getMaterialCountByType));

// Get single material by ID
router.get('/:id', asyncHandler(materialMasterController.getMaterialById));

// Create new material
router.post('/', asyncHandler(materialMasterController.createMaterial));

// Update material
router.put('/:id', asyncHandler(materialMasterController.updateMaterial));

// Soft delete material
router.delete('/:id', asyncHandler(materialMasterController.deleteMaterial));

// Supplier management
router.get('/:id/suppliers', asyncHandler(materialMasterController.getMaterialSuppliers));
router.post('/:id/suppliers', asyncHandler(materialMasterController.addMaterialSupplier));

export default router;
