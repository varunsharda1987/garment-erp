// Processing Stage Routes
import { Router } from 'express';
import * as processingStageController from '../controllers/processingStage.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stage management
router.post('/', asyncHandler(processingStageController.createStage));
router.get('/', asyncHandler(processingStageController.getAllStages));
router.get('/batch/:batchId', asyncHandler(processingStageController.getStagesByBatch));
router.get('/processor/:processorId', asyncHandler(processingStageController.getStagesByProcessor));
router.get('/processor/:processorId/summary', asyncHandler(processingStageController.getProcessorSummary));
router.get('/:id', asyncHandler(processingStageController.getStageById));
router.put('/:id', asyncHandler(processingStageController.updateStage));
router.patch('/:id/status', asyncHandler(processingStageController.updateStageStatus));
router.post('/:id/complete', asyncHandler(processingStageController.completeStage));
router.post('/:id/rework', asyncHandler(processingStageController.markForRework));
router.delete('/:id', asyncHandler(processingStageController.deleteStage));

export default router;
