import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  checkStageTransition,
  checkSampleCreation,
  getOverrideHistory,
} from '../controllers/stageTransitionValidation.controller';

const router = Router();

/**
 * GET /api/stage-validation/check
 * Check if a stage transition is allowed
 * Query params: workOrderId, targetStage
 */
router.get('/check', authenticateToken, asyncHandler(checkStageTransition));

/**
 * GET /api/stage-validation/check-sample-creation
 * Check if sample creation is allowed (sequential dependencies)
 * Query params: styleId, sampleType
 */
router.get('/check-sample-creation', authenticateToken, asyncHandler(checkSampleCreation));

/**
 * GET /api/stage-validation/override-history
 * Get admin override history (admin only)
 * Query params: workOrderId?, sampleId?, limit?
 */
router.get('/override-history', authenticateToken, authorize('ADMIN'), asyncHandler(getOverrideHistory));

export default router;
