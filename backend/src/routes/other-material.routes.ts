import { Router } from 'express';
import {
  createOtherMaterial,
  getAllOtherMaterials,
  getOtherMaterialById,
  updateOtherMaterial,
  deleteOtherMaterial,
  bulkImportOtherMaterials,
  downloadTemplate,
} from '../controllers/other-material.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { bulkImportOtherMaterialSchema } from '../schemas/otherMaterial.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// CRUD routes
router.post('/', asyncHandler(createOtherMaterial));
router.get('/', asyncHandler(getAllOtherMaterials));
router.get('/template', asyncHandler(downloadTemplate));
router.get('/:id', asyncHandler(getOtherMaterialById));
router.put('/:id', asyncHandler(updateOtherMaterial));
router.delete('/:id', asyncHandler(deleteOtherMaterial));

// Bulk operations
router.post('/bulk-import', validateBody(bulkImportOtherMaterialSchema), asyncHandler(bulkImportOtherMaterials));

export default router;
