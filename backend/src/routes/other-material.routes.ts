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
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  bulkImportOtherMaterialSchema,
  createOtherMaterialSchema,
  updateOtherMaterialSchema,
} from '../schemas/otherMaterial.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// CRUD routes
router.post('/', validateBody(createOtherMaterialSchema), asyncHandler(createOtherMaterial));
router.get('/', asyncHandler(getAllOtherMaterials));
router.get('/template', asyncHandler(downloadTemplate));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getOtherMaterialById));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateOtherMaterialSchema),
  asyncHandler(updateOtherMaterial)
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteOtherMaterial));

// Bulk operations
router.post('/bulk-import', validateBody(bulkImportOtherMaterialSchema), asyncHandler(bulkImportOtherMaterials));

export default router;
