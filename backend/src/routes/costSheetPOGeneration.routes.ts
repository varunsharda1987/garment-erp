/**
 * Cost Sheet PO Generation Routes
 * API routes for generating Purchase Orders from approved Cost Sheets
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
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
router.get('/calculate', asyncHandler(calculateRequirements));

// Generate POs
router.post('/generate/fabric', asyncHandler(generateFabricPO));
router.post('/generate/greige', asyncHandler(generateGreigePO));
router.post('/generate/processing', asyncHandler(generateProcessingPO));
router.post('/generate/trims', asyncHandler(generateTrimsPO));

// Get status and history
router.get('/status/:costSheetId', asyncHandler(getGenerationStatus));
router.get('/history/:costSheetId', asyncHandler(getGenerationHistory));

export default router;
