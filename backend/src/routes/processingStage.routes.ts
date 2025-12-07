// Processing Stage Routes
import { Router } from 'express';
import * as processingStageController from '../controllers/processingStage.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stage management
router.post('/', processingStageController.createStage);
router.get('/', processingStageController.getAllStages);
router.get('/batch/:batchId', processingStageController.getStagesByBatch);
router.get('/processor/:processorId', processingStageController.getStagesByProcessor);
router.get('/processor/:processorId/summary', processingStageController.getProcessorSummary);
router.get('/:id', processingStageController.getStageById);
router.put('/:id', processingStageController.updateStage);
router.patch('/:id/status', processingStageController.updateStageStatus);
router.post('/:id/complete', processingStageController.completeStage);
router.post('/:id/rework', processingStageController.markForRework);
router.delete('/:id', processingStageController.deleteStage);

export default router;
