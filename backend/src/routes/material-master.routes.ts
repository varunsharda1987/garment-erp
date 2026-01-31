import express from 'express';
import * as materialMasterController from '../controllers/material-master.controller';

const router = express.Router();

/**
 * Unified Material Master Routes
 * Replaces 31 individual material routes (lace, button, thread, etc.)
 *
 * Base path: /api/materials
 */

// Get all materials with filters
// Query params: type (MaterialType), active (boolean), search (string), supplierId (string)
router.get('/', materialMasterController.getAllMaterials);

// Get material types enum
router.get('/types', materialMasterController.getMaterialTypes);

// Get material count by type
router.get('/types/:type/count', materialMasterController.getMaterialCountByType);

// Get single material by ID
router.get('/:id', materialMasterController.getMaterialById);

// Create new material
router.post('/', materialMasterController.createMaterial);

// Update material
router.put('/:id', materialMasterController.updateMaterial);

// Soft delete material
router.delete('/:id', materialMasterController.deleteMaterial);

// Supplier management
router.get('/:id/suppliers', materialMasterController.getMaterialSuppliers);
router.post('/:id/suppliers', materialMasterController.addMaterialSupplier);

export default router;
