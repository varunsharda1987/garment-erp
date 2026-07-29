// Style Material BOM Routes - Phase 2
import { Router } from 'express';
import {
  searchMaterials,
  getMaterialByCode,
  getStyleBOM,
  addMaterialToBOM,
  updateBOMItem,
  deleteBOMItem,
} from '../controllers/style-material-bom.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { styleIdParamSchema, materialCodeParamSchema } from '../schemas/common.schema';
import {
  styleAndBomIdParamSchema,
  addStyleMaterialBOMSchema,
  updateStyleMaterialBOMSchema,
} from '../schemas/style.schema';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Material search endpoints
router.get('/materials/search', asyncHandler(searchMaterials));
router.get(
  '/materials/by-code/:materialCode',
  validateParams(materialCodeParamSchema),
  asyncHandler(getMaterialByCode)
);

// Style BOM management
router.get('/:styleId/bom', validateParams(styleIdParamSchema), asyncHandler(getStyleBOM));
router.post(
  '/:styleId/materials',
  validateParams(styleIdParamSchema),
  validateBody(addStyleMaterialBOMSchema),
  asyncHandler(addMaterialToBOM)
);
router.put(
  '/:styleId/materials/:bomId',
  validateParams(styleAndBomIdParamSchema),
  validateBody(updateStyleMaterialBOMSchema),
  asyncHandler(updateBOMItem)
);
router.delete('/:styleId/materials/:bomId', validateParams(styleAndBomIdParamSchema), asyncHandler(deleteBOMItem));

export default router;
