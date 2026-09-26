// Style Material BOM Routes - Phase 2
import { Router } from 'express';
import {
  searchMaterials,
  getMaterialByCode,
  getStyleBOM,
  getStyleLabelSetHandler,
  addMaterialToBOM,
  updateBOMItem,
  deleteBOMItem,
} from '../controllers/style-material-bom.controller';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { styleIdParamSchema, materialCodeParamSchema } from '../schemas/common.schema';
import {
  styleAndBomIdParamSchema,
  labelSetQuerySchema,
  addStyleMaterialBOMSchema,
  updateStyleMaterialBOMSchema,
} from '../schemas/style.schema';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requirePermissionForWrites('styles'));

// Material search endpoints
router.get('/materials/search', asyncHandler(searchMaterials));
router.get(
  '/materials/by-code/:materialCode',
  validateParams(materialCodeParamSchema),
  asyncHandler(getMaterialByCode)
);

// Style BOM management
router.get('/:styleId/bom', validateParams(styleIdParamSchema), asyncHandler(getStyleBOM));
// The style's labels with their sizes, for ordering the whole set together (PO form → Order label set)
router.get(
  '/:styleId/label-set',
  validateParams(styleIdParamSchema),
  validateQuery(labelSetQuerySchema),
  asyncHandler(getStyleLabelSetHandler)
);
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
