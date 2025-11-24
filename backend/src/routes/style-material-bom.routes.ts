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

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Material search endpoints
router.get('/materials/search', searchMaterials);
router.get('/materials/by-code/:materialCode', getMaterialByCode);

// Style BOM management
router.get('/:styleId/bom', getStyleBOM);
router.post('/:styleId/materials', addMaterialToBOM);
router.put('/:styleId/materials/:bomId', updateBOMItem);
router.delete('/:styleId/materials/:bomId', deleteBOMItem);

export default router;
