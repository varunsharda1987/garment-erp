import { Router } from 'express';
import {
  createOtherMaterial,
  getAllOtherMaterials,
  getOtherMaterialById,
  updateOtherMaterial,
  deleteOtherMaterial,
  bulkImportOtherMaterials,
  downloadTemplate
} from '../controllers/other-material.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// CRUD routes
router.post('/', createOtherMaterial);
router.get('/', getAllOtherMaterials);
router.get('/template', downloadTemplate);
router.get('/:id', getOtherMaterialById);
router.put('/:id', updateOtherMaterial);
router.delete('/:id', deleteOtherMaterial);

// Bulk operations
router.post('/bulk-import', bulkImportOtherMaterials);

export default router;
