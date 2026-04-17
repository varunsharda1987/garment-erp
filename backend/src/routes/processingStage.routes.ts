// Processing Stage Routes
import { Router } from 'express';
import * as processingStageController from '../controllers/processingStage.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createProcessingStageSchema,
  updateProcessingStageSchema,
  updateStageStatusSchema,
  completeStageSchema,
  markForReworkSchema,
  processingStageQuerySchema,
} from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stage management
router.post('/', validateBody(createProcessingStageSchema), asyncHandler(processingStageController.createStage));
router.get('/', validateQuery(processingStageQuerySchema), asyncHandler(processingStageController.getAllStages));
router.get('/batch/:batchId', asyncHandler(processingStageController.getStagesByBatch));
router.get('/processor/:processorId', asyncHandler(processingStageController.getStagesByProcessor));
router.get('/processor/:processorId/summary', asyncHandler(processingStageController.getProcessorSummary));
router.get('/:id', asyncHandler(processingStageController.getStageById));
router.put('/:id', validateBody(updateProcessingStageSchema), asyncHandler(processingStageController.updateStage));
router.patch(
  '/:id/status',
  validateBody(updateStageStatusSchema),
  asyncHandler(processingStageController.updateStageStatus)
);
router.post('/:id/complete', validateBody(completeStageSchema), asyncHandler(processingStageController.completeStage));
router.post('/:id/rework', validateBody(markForReworkSchema), asyncHandler(processingStageController.markForRework));
router.delete('/:id', asyncHandler(processingStageController.deleteStage));

export default router;
