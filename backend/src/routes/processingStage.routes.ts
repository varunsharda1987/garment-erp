// Processing Stage Routes
import { Router } from 'express';
import * as processingStageController from '../controllers/processingStage.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createProcessingStageSchema,
  updateProcessingStageSchema,
  updateStageStatusSchema,
  completeStageSchema,
  markForReworkSchema,
  processingStageQuerySchema,
  processingStageIdParamSchema,
  batchIdParamSchema,
  processorIdParamSchema,
} from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Phase 5b: batches are FROZEN pending stage-JWO wiring — mutations are role-gated
// (these routes previously had NO role check at all)
const mutatingAuthorize = authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR);
router.use((req, res, next) => (req.method === 'GET' ? next() : mutatingAuthorize(req, res, next)));

// Stage management
router.post('/', validateBody(createProcessingStageSchema), asyncHandler(processingStageController.createStage));
router.get('/', validateQuery(processingStageQuerySchema), asyncHandler(processingStageController.getAllStages));
router.get(
  '/batch/:batchId',
  validateParams(batchIdParamSchema),
  asyncHandler(processingStageController.getStagesByBatch)
);
router.get(
  '/processor/:processorId',
  validateParams(processorIdParamSchema),
  asyncHandler(processingStageController.getStagesByProcessor)
);
router.get(
  '/processor/:processorId/summary',
  validateParams(processorIdParamSchema),
  asyncHandler(processingStageController.getProcessorSummary)
);
router.get('/:id', validateParams(processingStageIdParamSchema), asyncHandler(processingStageController.getStageById));
router.put(
  '/:id',
  validateParams(processingStageIdParamSchema),
  validateBody(updateProcessingStageSchema),
  asyncHandler(processingStageController.updateStage)
);
router.patch(
  '/:id/status',
  validateParams(processingStageIdParamSchema),
  validateBody(updateStageStatusSchema),
  asyncHandler(processingStageController.updateStageStatus)
);
router.post(
  '/:id/complete',
  validateParams(processingStageIdParamSchema),
  validateBody(completeStageSchema),
  asyncHandler(processingStageController.completeStage)
);
router.post(
  '/:id/rework',
  validateParams(processingStageIdParamSchema),
  validateBody(markForReworkSchema),
  asyncHandler(processingStageController.markForRework)
);
router.delete(
  '/:id',
  validateParams(processingStageIdParamSchema),
  asyncHandler(processingStageController.deleteStage)
);

export default router;
