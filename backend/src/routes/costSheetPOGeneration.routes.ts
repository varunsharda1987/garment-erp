/**
 * Cost Sheet PO Generation Routes
 * API routes for generating Purchase Orders from approved Cost Sheets
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  calculateRequirements,
  generateFabricPO,
  generateGreigePO,
  generateProcessingPO,
  generateTrimsPO,
  getGenerationStatus,
  getGenerationHistory,
} from '../controllers/costSheetPOGeneration.controller';
import {
  generateFabricPOSchema,
  generateGreigePOSchema,
  generateProcessingPOSchema,
  generateTrimsPOSchema,
} from '../schemas/costSheetPOGeneration.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Calculate requirements from cost sheet
router.get('/calculate', asyncHandler(calculateRequirements));

// Generate POs
router.post('/generate/fabric', validateBody(generateFabricPOSchema), asyncHandler(generateFabricPO));
router.post('/generate/greige', validateBody(generateGreigePOSchema), asyncHandler(generateGreigePO));
router.post('/generate/processing', validateBody(generateProcessingPOSchema), asyncHandler(generateProcessingPO));
router.post('/generate/trims', validateBody(generateTrimsPOSchema), asyncHandler(generateTrimsPO));

// Get status and history
router.get('/status/:costSheetId', asyncHandler(getGenerationStatus));
router.get('/history/:costSheetId', asyncHandler(getGenerationHistory));

export default router;
