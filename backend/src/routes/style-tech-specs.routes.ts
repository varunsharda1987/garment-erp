/**
 * Style Tech Specs Routes
 * API routes for style technical specifications
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getTechSpecs,
  saveTechSpecs,
  deleteTechSpecs,
  getOptions,
  getTechPackData,
} from '../controllers/style-tech-specs.controller';

const router = Router();

// Options endpoint (static route must come before parameterized routes)
router.get('/tech-specs/options', authenticateToken, getOptions);

// Style-specific tech specs routes
router.get('/:styleId/tech-specs', authenticateToken, getTechSpecs);
router.put('/:styleId/tech-specs', authenticateToken, saveTechSpecs);
router.delete('/:styleId/tech-specs', authenticateToken, deleteTechSpecs);
router.get('/:styleId/tech-pack-data', authenticateToken, getTechPackData);

export default router;
