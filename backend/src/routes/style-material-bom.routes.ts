// Style Material BOM Routes - Phase 2
import { Router } from 'express';
import {
  searchMaterials,
  getMaterialByCode,
  getStyleBOM,
  addMaterialToBOM,
  updateBOMItem,
  deleteBOMItem
} from '../controllers/style-material-bom.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Material search endpoints
router.get('/materials/search', asyncHandler(searchMaterials));
router.get('/materials/by-code/:materialCode', asyncHandler(getMaterialByCode));

// Style BOM management
router.get('/:styleId/bom', asyncHandler(getStyleBOM));
router.post('/:styleId/materials', asyncHandler(addMaterialToBOM));
router.put('/:styleId/materials/:bomId', asyncHandler(updateBOMItem));
router.delete('/:styleId/materials/:bomId', asyncHandler(deleteBOMItem));

export default router;
