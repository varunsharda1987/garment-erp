/**
 * Cost Sheet PO Generation Routes
 * API routes for generating Purchase Orders from approved Cost Sheets
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  calculateRequirements,
  generateFabricPO,
  generateGreigePO,
  generateProcessingPO,
  generateTrimsPO,
  getGenerationStatus,
  getGenerationHistory,
} from '../controllers/costSheetPOGeneration.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Calculate requirements from cost sheet
router.get('/calculate', calculateRequirements);

// Generate POs
router.post('/generate/fabric', generateFabricPO);
router.post('/generate/greige', generateGreigePO);
router.post('/generate/processing', generateProcessingPO);
router.post('/generate/trims', generateTrimsPO);

// Get status and history
router.get('/status/:costSheetId', getGenerationStatus);
router.get('/history/:costSheetId', getGenerationHistory);

export default router;
